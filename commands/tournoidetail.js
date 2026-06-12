const Tournament = require('../database/models/Tournament');
const Match = require('../database/models/Match');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (message.author.bot) return;

    const content = message.content.trim();
    if (!content.startsWith('!detailtournoi ') && content !== '!detailtournoi') return;

    const cd = checkCooldown(message.author.id, 'tournoidetail', 8);
    if (cd) return replyCooldown(message, cd, 'tournoidetail');

    const name = content.slice('!detailtournoi'.length).trim();
    if (!name)
      return message.reply('Usage : `!tournoi <nom>` — Voir les détails d\'un tournoi.\nListez tous les tournois avec `!tournois`.');

    const tournament = await Tournament.findOne({
      name: { $regex: new RegExp(name, 'i') }
    }).sort({ startedAt: -1 });

    if (!tournament)
      return message.reply(`❌ Tournoi **${name}** introuvable. Utilisez \`!tournois\` pour voir la liste.`);

    const matches = await Match.find({ tournamentId: tournament._id.toString() });

    // Aggregate standings
    const statsMap = {};
    for (const m of matches) {
      if (!statsMap[m.team]) statsMap[m.team] = { points: 0, kills: 0, wins: 0, matchCount: 0 };
      statsMap[m.team].points    += m.points;
      statsMap[m.team].kills     += m.kills;
      statsMap[m.team].matchCount++;
      if (m.placement === 1) statsMap[m.team].wins++;
    }

    const sorted = Object.entries(statsMap).sort((a, b) => b[1].points - a[1].points);
    const teamCount  = sorted.length;
    const totalKills = sorted.reduce((s, [, v]) => s + v.kills, 0);

    const status   = tournament.active ? '🟢 **En cours**' : '🔴 **Terminé**';
    const startDate = new Date(tournament.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const endDate   = tournament.endedAt
      ? new Date(tournament.endedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;

    // Build standings table (up to 10)
    const standingsText = sorted.slice(0, 10).map(([team, s], i) => {
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      const wr = s.matchCount > 0 ? `${Math.round((s.wins / s.matchCount) * 100)}%` : '—';
      return `${medal} **${team}** — ${s.points} pts | ${s.kills} kills | ${s.matchCount} matchs | wr ${wr}`;
    }).join('\n') || '*Aucun match enregistré*';

    const embed = new EmbedBuilder()
      .setTitle(`🏁 ${tournament.name}`)
      .setColor(tournament.active ? 0x57F287 : 0xF1C40F)
      .addFields(
        { name: 'Statut',      value: status,                                          inline: true },
        { name: 'Démarré le', value: startDate,                                        inline: true },
        { name: 'Créé par',   value: tournament.startedBy || '*inconnu*',              inline: true },
        ...(endDate ? [{ name: 'Terminé le', value: endDate, inline: true }] : []),
        ...(tournament.winner ? [{ name: '🥇 Vainqueur', value: `**${tournament.winner}**`, inline: true }] : []),
        { name: '\u200B', value: '\u200B', inline: false },
        { name: '👥 Équipes', value: `${teamCount}`, inline: true },
        { name: '🎮 Matchs',  value: `${matches.length}`, inline: true },
        { name: '💀 Kills',   value: `${totalKills}`, inline: true },
        { name: `📊 Classement — Top ${Math.min(sorted.length, 10)}`, value: standingsText, inline: false }
      )
      .setFooter({ text: `ID : ${tournament._id} • SUPREMYX` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[tournoidetail] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
