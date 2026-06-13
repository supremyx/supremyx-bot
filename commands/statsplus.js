const { EmbedBuilder } = require('discord.js');
const Team  = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const Schedule   = require('../database/models/Schedule');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const MEDALS = ['🥇', '🥈', '🥉'];

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function fmtDate(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    const args    = content.split(/\s+/);
    const cmd     = args[0].toLowerCase();

    // ── !moyenne <équipe> ──────────────────────────────────────────────────────
    if (cmd === '!moyenne') {
      const cd = checkCooldown(message.author.id, 'moyenne', 10);
      if (cd) return replyCooldown(message, cd, 'moyenne');

      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!moyenne <équipe>`');

      const team = await Team.findOne({ name: new RegExp(`^${escRe(name)}$`, 'i') });
      if (!team) return message.reply(`❌ Équipe **${name}** introuvable.`);

      const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 });
      if (!matches.length) return message.reply(`❌ Aucun match enregistré pour **${team.name}**.`);

      const n  = matches.length;
      const avgKills  = (team.kills  / n).toFixed(2);
      const avgPoints = (team.points / n).toFixed(2);
      const avgPlacement = (matches.reduce((a, m) => a + m.placement, 0) / n).toFixed(2);
      const wins   = team.wins;
      const losses = team.losses;
      const winRate = n > 0 ? ((wins / n) * 100).toFixed(1) : '0.0';

      const best  = matches.reduce((a, b) => b.kills > a.kills ? b : a);
      const worst = matches.reduce((a, b) => b.placement > a.placement ? b : a);

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `📊 Moyennes — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '📈 Par match', value: [`> Kills : **${avgKills}**`, `> Points : **${avgPoints}**`, `> Placement moyen : **${avgPlacement}**`].join('\n'), inline: true },
          { name: '🏆 Bilan', value: [`> ${wins}V / ${losses}D`, `> Win rate : **${winRate}%**`, `> Matchs joués : **${n}**`].join('\n'), inline: true },
          { name: '⭐ Records', value: [`> Meilleur match : **${best.kills}** kills (placement ${best.placement})`, `> Pire placement : **${worst.placement}** (${worst.kills} kills)`].join('\n'), inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · Statistiques en temps réel' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !tendance <équipe> ─────────────────────────────────────────────────────
    if (cmd === '!tendance') {
      const cd = checkCooldown(message.author.id, 'tendance', 10);
      if (cd) return replyCooldown(message, cd, 'tendance');

      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!tendance <équipe>`');

      const team = await Team.findOne({ name: new RegExp(`^${escRe(name)}$`, 'i') });
      if (!team) return message.reply(`❌ Équipe **${name}** introuvable.`);

      const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 }).limit(10);
      if (matches.length < 2) return message.reply(`❌ Pas assez de matchs pour calculer une tendance (min. 2).`);

      const reversed = [...matches].reverse();
      const lines = reversed.map((m, i) => {
        const prev = reversed[i - 1];
        let arrow = '';
        if (prev) {
          if (m.points > prev.points) arrow = '↗️';
          else if (m.points < prev.points) arrow = '↘️';
          else arrow = '➡️';
        }
        const bar = '█'.repeat(Math.min(10, Math.round(m.points / 2))) || '▏';
        return `${arrow || '🏁'} M${i + 1} \`${bar.padEnd(10)}\` **${m.points}pts** | ${m.kills}k | #${m.placement}`;
      });

      const first  = reversed[0].points;
      const last   = reversed[reversed.length - 1].points;
      const trend  = last > first ? '📈 En progression' : last < first ? '📉 En déclin' : '➡️ Stable';
      const avgRecent = (matches.slice(0, 5).reduce((a, m) => a + m.points, 0) / Math.min(5, matches.length)).toFixed(1);

      const embed = new EmbedBuilder()
        .setColor(last >= first ? 0x57F287 : 0xED4245)
        .setAuthor({ name: `📈 Tendance — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(lines.join('\n'))
        .addFields({ name: 'Résumé', value: `${trend} · Moy. 5 derniers matchs : **${avgRecent} pts**`, inline: false })
        .setFooter({ text: `SUPREMYX Esports · ${matches.length} derniers matchs affichés` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !meilleurmatch <équipe> ────────────────────────────────────────────────
    if (cmd === '!meilleurmatch') {
      const cd = checkCooldown(message.author.id, 'meilleurmatch', 10);
      if (cd) return replyCooldown(message, cd, 'meilleurmatch');

      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!meilleurmatch <équipe>`');

      const team = await Team.findOne({ name: new RegExp(`^${escRe(name)}$`, 'i') });
      if (!team) return message.reply(`❌ Équipe **${name}** introuvable.`);

      const matches = await Match.find({ team: team.name });
      if (!matches.length) return message.reply(`❌ Aucun match enregistré pour **${team.name}**.`);

      const byKills  = matches.reduce((a, b) => b.kills > a.kills ? b : a);
      const byPoints = matches.reduce((a, b) => b.points > a.points ? b : a);
      const byPlace  = matches.reduce((a, b) => b.placement < a.placement ? b : a);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({ name: `⭐ Meilleur match — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '🔫 Max Kills', value: [`**${byKills.kills}** kills`, `${byKills.points} pts · #${byKills.placement}`, byKills.tournamentName ? `Tournoi : ${byKills.tournamentName}` : '', `Date : ${fmtDate(byKills.createdAt)}`].filter(Boolean).join('\n'), inline: true },
          { name: '🏆 Max Points', value: [`**${byPoints.points}** pts`, `${byPoints.kills} kills · #${byPoints.placement}`, byPoints.tournamentName ? `Tournoi : ${byPoints.tournamentName}` : '', `Date : ${fmtDate(byPoints.createdAt)}`].filter(Boolean).join('\n'), inline: true },
          { name: '🥇 Meilleur placement', value: [`**#${byPlace.placement}**`, `${byPlace.kills} kills · ${byPlace.points} pts`, byPlace.tournamentName ? `Tournoi : ${byPlace.tournamentName}` : '', `Date : ${fmtDate(byPlace.createdAt)}`].filter(Boolean).join('\n'), inline: true },
        )
        .setFooter({ text: `SUPREMYX Esports · Sur ${matches.length} matchs` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !pirematch <équipe> ────────────────────────────────────────────────────
    if (cmd === '!pirematch') {
      const cd = checkCooldown(message.author.id, 'pirematch', 10);
      if (cd) return replyCooldown(message, cd, 'pirematch');

      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!pirematch <équipe>`');

      const team = await Team.findOne({ name: new RegExp(`^${escRe(name)}$`, 'i') });
      if (!team) return message.reply(`❌ Équipe **${name}** introuvable.`);

      const matches = await Match.find({ team: team.name });
      if (!matches.length) return message.reply(`❌ Aucun match enregistré pour **${team.name}**.`);

      const byKills  = matches.reduce((a, b) => b.kills < a.kills ? b : a);
      const byPoints = matches.reduce((a, b) => b.points < a.points ? b : a);
      const byPlace  = matches.reduce((a, b) => b.placement > a.placement ? b : a);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: `💀 Pire match — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '🔫 Moins de kills', value: [`**${byKills.kills}** kills`, `${byKills.points} pts · #${byKills.placement}`, byKills.tournamentName || '', `Date : ${fmtDate(byKills.createdAt)}`].filter(Boolean).join('\n'), inline: true },
          { name: '📉 Moins de points', value: [`**${byPoints.points}** pts`, `${byPoints.kills} kills · #${byPoints.placement}`, byPoints.tournamentName || '', `Date : ${fmtDate(byPoints.createdAt)}`].filter(Boolean).join('\n'), inline: true },
          { name: '😔 Pire placement', value: [`**#${byPlace.placement}**`, `${byPlace.kills} kills · ${byPlace.points} pts`, byPlace.tournamentName || '', `Date : ${fmtDate(byPlace.createdAt)}`].filter(Boolean).join('\n'), inline: true },
        )
        .setFooter({ text: `SUPREMYX Esports · Sur ${matches.length} matchs` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !podium ────────────────────────────────────────────────────────────────
    if (cmd === '!podium') {
      const cd = checkCooldown(message.author.id, 'podium', 10);
      if (cd) return replyCooldown(message, cd, 'podium');

      const teams = await Team.find().sort({ points: -1 }).limit(3);
      if (teams.length < 1) return message.reply('❌ Aucune équipe enregistrée.');

      const activeTournoi = await Tournament.findOne({ active: true });
      const displays = [
        { pos: 0, emoji: '🥇', bg: '━━━━━━━━━━━━' },
        { pos: 1, emoji: '🥈', bg: '━━━━━━━━━━' },
        { pos: 2, emoji: '🥉', bg: '━━━━━━━━' },
      ];

      const fields = teams.map((t, i) => {
        const d = displays[i];
        const n = teams.length;
        const matchCount = t.wins + t.losses;
        const winRate = matchCount > 0 ? ((t.wins / matchCount) * 100).toFixed(0) : '0';
        return {
          name: `${d.emoji} #${i + 1} — ${t.name}`,
          value: [`**${t.points}** pts · ${t.kills} kills`, `${t.wins}V/${t.losses}D · Win rate ${winRate}%`].join('\n'),
          inline: false,
        };
      });

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({ name: '🏆 Podium SUPREMYX', iconURL: client.user.displayAvatarURL() })
        .setDescription(activeTournoi ? `Tournoi en cours : **${activeTournoi.name}**` : '*Aucun tournoi actif*')
        .addFields(fields)
        .setFooter({ text: `SUPREMYX Esports · Classement en temps réel · ${teams.length} équipe(s) affichée(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !resume ────────────────────────────────────────────────────────────────
    if (cmd === '!resume') {
      const cd = checkCooldown(message.author.id, 'resume', 15);
      if (cd) return replyCooldown(message, cd, 'resume');

      const [activeTournoi, topTeams, recentMatches, nextMatch] = await Promise.all([
        Tournament.findOne({ active: true }),
        Team.find().sort({ points: -1 }).limit(3),
        Match.find().sort({ createdAt: -1 }).limit(5),
        Schedule.findOne({ date: { $gt: new Date() }, completed: false }).sort({ date: 1 }),
      ]);

      const rankingLines = topTeams.length
        ? topTeams.map((t, i) => `${MEDALS[i] ?? `#${i + 1}`} **${t.name}** — ${t.points} pts | ${t.kills} kills`).join('\n')
        : '*Aucune équipe classée*';

      const matchLines = recentMatches.length
        ? recentMatches.map(m => `• **${m.team}** → #${m.placement} · ${m.kills} kills · ${m.points} pts`).join('\n')
        : '*Aucun match récent*';

      const fields = [
        { name: '🏆 Classement actuel (top 3)', value: rankingLines, inline: false },
        { name: '⚽ Derniers matchs', value: matchLines, inline: false },
      ];

      if (nextMatch) {
        fields.push({
          name: '📅 Prochain match planifié',
          value: [`**Équipes :** ${nextMatch.teams.join(' vs ')}`, `**Date :** ${fmtDate(nextMatch.date)}`, nextMatch.tournamentName ? `**Tournoi :** ${nextMatch.tournamentName}` : '', nextMatch.note ? `**Note :** ${nextMatch.note}` : ''].filter(Boolean).join('\n'),
          inline: false,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `📋 Résumé — ${activeTournoi ? activeTournoi.name : 'SUPREMYX'}`, iconURL: client.user.displayAvatarURL() })
        .addFields(fields)
        .setFooter({ text: 'SUPREMYX Esports · Données en temps réel' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !prediction <T1> <T2> ─────────────────────────────────────────────────
    if (cmd === '!prediction') {
      const cd = checkCooldown(message.author.id, 'prediction', 10);
      if (cd) return replyCooldown(message, cd, 'prediction');

      const rest = args.slice(1).join(' ');
      const sep  = rest.toLowerCase().includes(' vs ') ? ' vs ' : ' VS ';
      const parts = rest.split(new RegExp(sep, 'i'));
      if (parts.length < 2) return message.reply('Usage : `!prediction <équipe1> vs <équipe2>`');

      const [n1, n2] = parts.map(s => s.trim());
      const [t1, t2] = await Promise.all([
        Team.findOne({ name: new RegExp(`^${escRe(n1)}$`, 'i') }),
        Team.findOne({ name: new RegExp(`^${escRe(n2)}$`, 'i') }),
      ]);

      if (!t1) return message.reply(`❌ Équipe **${n1}** introuvable.`);
      if (!t2) return message.reply(`❌ Équipe **${n2}** introuvable.`);

      // Scoring pondéré : points (50%), kills (30%), win rate (20%)
      const m1 = t1.wins + t1.losses || 1;
      const m2 = t2.wins + t2.losses || 1;

      const score1 = (t1.points * 0.5) + (t1.kills * 0.3) + ((t1.wins / m1) * 100 * 0.2);
      const score2 = (t2.points * 0.5) + (t2.kills * 0.3) + ((t2.wins / m2) * 100 * 0.2);
      const total  = score1 + score2 || 1;

      const pct1 = Math.round((score1 / total) * 100);
      const pct2 = 100 - pct1;
      const fav  = pct1 >= pct2 ? t1.name : t2.name;

      const bar = (pct) => '█'.repeat(Math.round(pct / 5)).padEnd(20, '░');

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: '🔮 Prédiction de match', iconURL: client.user.displayAvatarURL() })
        .setDescription(`**${t1.name}** vs **${t2.name}**\n> Basé sur les points, kills et win rate respectifs`)
        .addFields(
          { name: `🟧 ${t1.name}`, value: [`\`${bar(pct1)}\` **${pct1}%**`, `${t1.points} pts · ${t1.kills} kills · ${t1.wins}V/${t1.losses}D`].join('\n'), inline: false },
          { name: `🟦 ${t2.name}`, value: [`\`${bar(pct2)}\` **${pct2}%**`, `${t2.points} pts · ${t2.kills} kills · ${t2.wins}V/${t2.losses}D`].join('\n'), inline: false },
          { name: '🏆 Favori', value: `**${fav}** avec **${Math.max(pct1, pct2)}%** de chances de victoire`, inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · Prédiction statistique (non garantie)' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
