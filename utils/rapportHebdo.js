const { EmbedBuilder } = require('discord.js');
const RapportHebdoConfig = require('../database/models/RapportHebdoConfig');
const Match        = require('../database/models/Match');
const PlayerStat   = require('../database/models/PlayerStat');
const XpEntry      = require('../database/models/XpEntry');
const Sanction     = require('../database/models/Sanction');
const CommandStat  = require('../database/models/CommandStat');
const Team         = require('../database/models/Team');

function since7Days() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

async function buildRapportEmbed(client, guildId) {
  const from = since7Days();
  const now  = new Date();

  const [
    matchesSemaine,
    sanctionsSemaine,
    commandsSemaine,
    activeXpUsers,
    allTeams,
    topPlayers,
  ] = await Promise.all([
    Match.find({ createdAt: { $gte: from } }),
    Sanction.find({ guildId, createdAt: { $gte: from } }),
    CommandStat.countDocuments({ guildId, usedAt: { $gte: from } }),
    XpEntry.countDocuments({ guildId, lastXpAt: { $gte: from } }),
    Team.find().lean(),
    PlayerStat.find({ guildId }).lean(),
  ]);

  // ── Stats matchs ────────────────────────────────────────────────────────────
  const totalMatchs = matchesSemaine.length;
  const totalKills  = matchesSemaine.reduce((s, m) => s + (m.kills || 0), 0);
  const avgKills    = totalMatchs ? (totalKills / totalMatchs).toFixed(1) : '0.0';

  // ── Top 3 équipes par kills (semaine) ──────────────────────────────────────
  const killsByTeam = {};
  for (const m of matchesSemaine) {
    if (!m.team) continue;
    killsByTeam[m.team] = (killsByTeam[m.team] || 0) + (m.kills || 0);
  }
  const topTeams = Object.entries(killsByTeam)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // ── Top 3 joueurs par kills (semaine via history) ──────────────────────────
  const playerKills = [];
  for (const ps of topPlayers) {
    const weekKills = (ps.history || [])
      .filter(h => new Date(h.date) >= from)
      .reduce((s, h) => s + (h.kills || 0), 0);
    if (weekKills > 0) playerKills.push({ name: ps.displayName, team: ps.teamName, kills: weekKills });
  }
  playerKills.sort((a, b) => b.kills - a.kills);
  const topPlayersList = playerKills.slice(0, 3);

  // ── Modération ──────────────────────────────────────────────────────────────
  const warns  = sanctionsSemaine.filter(s => s.type === 'warn').length;
  const mutes  = sanctionsSemaine.filter(s => s.type === 'mute').length;
  const kicks  = sanctionsSemaine.filter(s => s.type === 'kick').length;
  const bans   = sanctionsSemaine.filter(s => s.type === 'ban').length;

  // ── Dates affichage ─────────────────────────────────────────────────────────
  const fmt = d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Construction embed ──────────────────────────────────────────────────────
  const medals = ['🥇', '🥈', '🥉'];

  const teamField = topTeams.length
    ? topTeams.map(([t, k], i) => `${medals[i]} **${t}** — ${k} kills`).join('\n')
    : '_Aucun match cette semaine_';

  const playerField = topPlayersList.length
    ? topPlayersList.map((p, i) => `${medals[i]} **${p.name}** (${p.team}) — ${p.kills} kills`).join('\n')
    : '_Aucune stat disponible_';

  const embed = new EmbedBuilder()
    .setColor(0xFF8C00)
    .setTitle('📊 Rapport hebdomadaire SUPREMYX')
    .setDescription(
      `Récapitulatif de la semaine du **${fmt(from)}** au **${fmt(now)}**\n` +
      `> Généré automatiquement chaque dimanche à 20h00`
    )
    .addFields(
      {
        name: '🎮 Matchs de la semaine',
        value: totalMatchs
          ? `**${totalMatchs}** match(s) joué(s)\n**${totalKills}** kills au total · Moyenne : **${avgKills}** kills/match`
          : '_Aucun match enregistré cette semaine_',
        inline: false,
      },
      {
        name: '🏆 Top 3 équipes',
        value: teamField,
        inline: true,
      },
      {
        name: '⭐ Top 3 joueurs',
        value: playerField,
        inline: true,
      },
      {
        name: '\u200b',
        value: '\u200b',
        inline: false,
      },
      {
        name: '📈 Activité serveur',
        value: `**${activeXpUsers}** membre(s) actif(s) (XP)\n**${commandsSemaine}** commandes utilisées`,
        inline: true,
      },
      {
        name: '🛡️ Modération',
        value: sanctionsSemaine.length
          ? `⚠️ ${warns} warn · 🔇 ${mutes} mute · 👢 ${kicks} kick · 🔨 ${bans} ban`
          : '✅ Aucune sanction cette semaine',
        inline: true,
      },
    )
    .setFooter({ text: `SUPREMYX Esports · ${allTeams.length} équipes enregistrées` })
    .setTimestamp();

  return embed;
}

async function sendRapportHebdo(client, guildId, channelId) {
  try {
    const embed = await buildRapportEmbed(client, guildId);
    const channel = client.channels.cache.get(channelId);
    if (!channel) return false;
    await channel.send({ embeds: [embed] });
    await RapportHebdoConfig.findOneAndUpdate(
      { guildId },
      { lastSentAt: new Date() },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error('[rapportHebdo] erreur envoi :', err);
    return false;
  }
}

let rapportStarted = false;

function startRapportHebdo(client) {
  if (rapportStarted) return;
  rapportStarted = true;

  // Vérification chaque minute
  setInterval(async () => {
    try {
      const now = new Date();
      // Dimanche (0) à 20h00 (±1 minute)
      if (now.getDay() !== 0) return;
      if (now.getHours() !== 20 || now.getMinutes() !== 0) return;

      const configs = await RapportHebdoConfig.find({ active: true, channelId: { $ne: '' } });
      for (const cfg of configs) {
        // Anti-doublon : ne pas renvoyer si déjà envoyé dans la dernière heure
        if (cfg.lastSentAt && (now - cfg.lastSentAt) < 60 * 60 * 1000) continue;
        await sendRapportHebdo(client, cfg.guildId, cfg.channelId);
      }
    } catch (err) {
      console.error('[rapportHebdo] erreur planification :', err);
    }
  }, 60 * 1000);

  console.log('📊 Rapport hebdomadaire planifié (dimanche 20h00)');
}

module.exports = { startRapportHebdo, sendRapportHebdo, buildRapportEmbed };
