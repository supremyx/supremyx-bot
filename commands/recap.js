const { EmbedBuilder } = require('discord.js');
const Tournament = require('../database/models/Tournament');
const Team       = require('../database/models/Team');
const Match      = require('../database/models/Match');
const PlayerStat = require('../database/models/PlayerStat');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const MEDALS = ['🥇', '🥈', '🥉'];
function medal(n) { return { 1: '🥇', 2: '🥈', 3: '🥉' }[n] ?? `#${n}`; }
function avg(a, b) { return b > 0 ? (a / b).toFixed(1) : '0'; }

const PERIOD_KEYS = new Set(['24h', '1', '7', '30', 'mois', 'saison', 'tout']);

function parsePeriod(arg) {
  if (!arg || arg === '24h' || arg === '1') return { ms: 86_400_000,      label: '24 dernières heures', short: '24h'   };
  if (arg === '7')                          return { ms: 7  * 86_400_000, label: '7 derniers jours',    short: '7j'    };
  if (arg === '30' || arg === 'mois')       return { ms: 30 * 86_400_000, label: '30 derniers jours',   short: '30j'   };
  if (arg === 'saison' || arg === 'tout')   return { ms: null,            label: 'toute la saison',     short: 'saison'};
  const n = parseInt(arg, 10);
  if (!isNaN(n) && n > 0)                  return { ms: n  * 86_400_000, label: `${n} derniers jours`, short: `${n}j` };
  return null; // not a period → treat as tournament name
}

// ── MODE PÉRIODE ──────────────────────────────────────────────────────────────
async function recapPeriode(message, period) {
  const cutoff  = period.ms ? new Date(Date.now() - period.ms) : new Date(0);
  const matches = await Match.find({ createdAt: { $gte: cutoff } }).lean();

  if (!matches.length)
    return message.reply(`📭 Aucun match enregistré sur les ${period.label}.`);

  // Aggregate by team
  const byTeam = {};
  for (const m of matches) {
    if (!byTeam[m.team]) byTeam[m.team] = { matches: 0, kills: 0, points: 0, placements: [] };
    byTeam[m.team].matches++;
    byTeam[m.team].kills    += m.kills;
    byTeam[m.team].points   += m.points;
    byTeam[m.team].placements.push(m.placement);
  }

  const teams = Object.entries(byTeam).map(([name, d]) => ({
    name,
    ...d,
    bestPlacement: Math.min(...d.placements),
    wins: d.placements.filter(p => p === 1).length,
  }));

  const totalMatches = matches.length;
  const totalKills   = matches.reduce((s, m) => s + m.kills, 0);
  const totalPoints  = matches.reduce((s, m) => s + m.points, 0);

  const bestMatchKills = matches.reduce((b, m) => (!b || m.kills > b.kills) ? m : b, null);
  const bestMatchPlace = matches.reduce((b, m) => (!b || m.placement < b.placement) ? m : b, null);
  const mostActive     = [...teams].sort((a, b) => b.matches - a.matches)[0];
  const topKillTeam    = [...teams].sort((a, b) => b.kills - a.kills)[0];
  const podium         = [...teams].sort((a, b) => b.points - a.points || b.kills - a.kills).slice(0, 3);

  // Top player by kills
  const players = await PlayerStat.find({ guildId: message.guild.id }).lean();
  const mvp = players
    .map(p => {
      const kk = p.history.filter(h => new Date(h.date) >= cutoff).reduce((s, h) => s + h.kills, 0);
      const mm = p.history.filter(h => new Date(h.date) >= cutoff).length;
      return { name: p.displayName, team: p.teamName, kills: kk, matches: mm };
    })
    .filter(p => p.kills > 0)
    .sort((a, b) => b.kills - a.kills)[0] ?? null;

  const podiumLines = podium.map((t, i) =>
    `${MEDALS[i]} **${t.name}** — ${t.points} pts · ${t.kills} kills · ${t.matches} match${t.matches > 1 ? 's' : ''}`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`📋 Récapitulatif — ${period.label}`)
    .setColor(0xD4963A)
    .setDescription(
      `**${totalMatches}** match${totalMatches > 1 ? 's' : ''} joué${totalMatches > 1 ? 's' : ''} · **${teams.length}** équipe${teams.length > 1 ? 's' : ''} actives · **${totalKills}** kills · **${totalPoints}** pts distribués`
    )
    .addFields(
      { name: '🏆 Classement période', value: podiumLines || '—' },
      {
        name: '🎖️ MVP joueur (kills)',
        value: mvp
          ? `**${mvp.name}** (${mvp.team})\n${mvp.kills} kills · ${mvp.matches} match${mvp.matches > 1 ? 's' : ''} · moy. ${avg(mvp.kills, mvp.matches)}`
          : '— Aucune donnée joueur',
        inline: true,
      },
      {
        name: '💥 Meilleure perf. (kills)',
        value: bestMatchKills
          ? `**${bestMatchKills.team}** — ${bestMatchKills.kills} kills${bestMatchKills.tournamentName ? `\n📌 ${bestMatchKills.tournamentName}` : ''}`
          : '—',
        inline: true,
      },
      { name: '\u200b', value: '\u200b', inline: true },
      {
        name: `${medal(bestMatchPlace?.placement)} Meilleur placement`,
        value: bestMatchPlace
          ? `**${bestMatchPlace.team}** — ${medal(bestMatchPlace.placement)}${bestMatchPlace.tournamentName ? `\n📌 ${bestMatchPlace.tournamentName}` : ''}`
          : '—',
        inline: true,
      },
      {
        name: '🔥 Équipe la + active',
        value: mostActive
          ? `**${mostActive.name}** — ${mostActive.matches} match${mostActive.matches > 1 ? 's' : ''} · ${mostActive.kills} kills`
          : '—',
        inline: true,
      },
      {
        name: '📈 Top kills (équipe)',
        value: topKillTeam
          ? `**${topKillTeam.name}** — ${topKillTeam.kills} kills · moy. ${avg(topKillTeam.kills, topKillTeam.matches)}/match`
          : '—',
        inline: true,
      },
    )
    .setFooter({ text: `SUPREMYX CI · !recapitulatif [24h|7|30|saison] ou !recapitulatif <tournoi>`, iconURL: message.guild.iconURL({ dynamic: true }) ?? undefined })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
}

// ── MODE TOURNOI ──────────────────────────────────────────────────────────────
async function recapTournoi(message, tournName) {
  const loading = await message.channel.send('📊 Génération du récap en cours…');

  let tourn;
  if (tournName) {
    tourn = await Tournament.findOne({ name: new RegExp(`^${tournName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (!tourn) {
      await loading.delete().catch(() => {});
      return message.reply(`❌ Tournoi **${tournName}** introuvable.`);
    }
  } else {
    tourn = await Tournament.findOne({ active: true }) ?? await Tournament.findOne().sort({ createdAt: -1 });
    if (!tourn) {
      await loading.delete().catch(() => {});
      return message.reply('❌ Aucun tournoi trouvé.');
    }
  }

  const [allMatches] = await Promise.all([
    Match.find({ tournamentId: tourn._id.toString() }).sort({ createdAt: 1 }),
  ]);

  if (!allMatches.length) {
    await loading.delete().catch(() => {});
    return message.reply(`❌ Aucun match enregistré pour **${tourn.name}**.`);
  }

  const teamsInTourn = [...new Set(allMatches.map(m => m.team))];
  const teamStats = teamsInTourn.map(name => {
    const ms     = allMatches.filter(m => m.team === name);
    const kills  = ms.reduce((s, m) => s + m.kills, 0);
    const points = ms.reduce((s, m) => s + m.points, 0);
    const wins   = ms.filter(m => m.placement === 1).length;
    return { name, kills, points, matchs: ms.length, wins, avgKills: avg(kills, ms.length) };
  }).sort((a, b) => b.points - a.points || b.kills - a.kills);

  const winner     = teamStats[0];
  const bestMatch  = [...allMatches].sort((a, b) => b.kills - a.kills)[0];
  const bestPts    = [...allMatches].sort((a, b) => b.points - a.points)[0];
  const mvpPlayer  = await PlayerStat.findOne({ guildId: message.guild.id }).sort({ totalKills: -1 });

  const podiumLines = teamStats.slice(0, 3).map((t, i) =>
    `${MEDALS[i]} **${t.name}** — ${t.points} pts · ${t.kills} kills`
  ).join('\n');

  const top5 = teamStats.slice(0, 5).map((t, i) =>
    `**${i + 1}.** ${t.name} — ${t.points} pts · ${t.kills} kills · ${t.matchs} matchs`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xFF8C00)
    .setTitle(`🏆 Récapitulatif — ${tourn.name}`)
    .setDescription(`**${allMatches.length}** matchs joués · **${teamsInTourn.length}** équipes`)
    .addFields(
      { name: '🥇 Podium final',            value: podiumLines || '—' },
      { name: '🏆 Vainqueur',               value: winner ? `**${winner.name}** — ${winner.points} pts · ${winner.kills} kills` : '—' },
      { name: '🔥 Meilleur match (kills)',   value: bestMatch ? `**${bestMatch.team}** — ${bestMatch.kills} kills (#${bestMatch.placement})` : '—', inline: true },
      { name: '⭐ Meilleur match (points)',  value: bestPts   ? `**${bestPts.team}** — ${bestPts.points} pts (#${bestPts.placement})` : '—',    inline: true },
      { name: '🎖️ MVP joueur',              value: mvpPlayer ? `**${mvpPlayer.displayName}** — ${mvpPlayer.totalKills} kills en ${mvpPlayer.totalMatches} matchs` : '—' },
      { name: '📊 Top 5 équipes',            value: top5 || '—' },
    )
    .setFooter({ text: `SUPREMYX CI · Tournoi ${tourn.active ? 'en cours 🟢' : 'terminé 🔴'}`, iconURL: message.guild.iconURL({ dynamic: true }) ?? undefined })
    .setTimestamp();

  await loading.delete().catch(() => {});
  await message.channel.send({ embeds: [embed] });
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────────
module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    try {
      if (!message.guild)     return;
      if (message.author.bot) return;
      if (!message.member)    return;
      if (!message.content.startsWith('!recapitulatif') && !message.content.startsWith('!recap')) return;

      const cd = checkCooldown(message.author.id, 'recapitulatif', 20);
      if (cd) return replyCooldown(message, cd, 'recapitulatif');

      const arg = message.content.trim().split(/\s+/).slice(1).join(' ').trim().toLowerCase();

      // Detect mode: period keyword/number → période, else → tournoi
      const firstWord = arg.split(/\s+/)[0];
      const isPeriod  = !arg || PERIOD_KEYS.has(firstWord) || (!isNaN(parseInt(firstWord, 10)) && parseInt(firstWord, 10) <= 365);

      if (isPeriod) {
        const period = parsePeriod(firstWord || null) ?? parsePeriod(null);
        await recapPeriode(message, period);
      } else {
        await recapTournoi(message, arg);
      }

    } catch (err) {
      console.error('[recap]', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
