const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const Config = require('../database/models/Config');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const medals = ['🥇', '🥈', '🥉'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (!message.content.startsWith('!classement')) return;
    const cd = checkCooldown(message.author.id, 'ranking', 10);
    if (cd) return replyCooldown(message, cd, 'ranking');

    const tournamentName = message.content.split(' ').slice(1).join(' ').trim();
    const lcTournament = tournamentName.toLowerCase();

    // --- !classement kills ---
    if (lcTournament === 'kills') {
      const teams = await Team.find().sort({ kills: -1 });
      if (!teams.length) return message.channel.send('Aucune équipe enregistrée.');
      const rows = teams.map((t, i) => {
        const medal = medals[i] || `**#${i + 1}**`;
        const n = t.wins + t.losses || 1;
        const avg = (t.kills / n).toFixed(1);
        return `${medal} **${t.name}** — ${t.kills} kills | Moy : ${avg}/match | ${t.points} pts`;
      }).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('🔫 Classement par Kills')
        .setDescription(rows)
        .setColor(0xED4245)
        .setFooter({ text: `${teams.length} équipe(s)` })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    // --- !classement ratio ---
    if (lcTournament === 'ratio') {
      const teams = await Team.find();
      if (!teams.length) return message.channel.send('Aucune équipe enregistrée.');
      const sorted = teams
        .map(t => {
          const n = t.wins + t.losses || 1;
          return { t, ratio: t.kills / n };
        })
        .sort((a, b) => b.ratio - a.ratio);
      const rows = sorted.map(({ t, ratio }, i) => {
        const medal = medals[i] || `**#${i + 1}**`;
        return `${medal} **${t.name}** — **${ratio.toFixed(2)}** kills/match | ${t.kills} total | ${t.points} pts`;
      }).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('📊 Classement Kills/Match (Ratio)')
        .setDescription(rows)
        .setColor(0x5865F2)
        .setFooter({ text: `${sorted.length} équipe(s)` })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    // --- Classement global ---
    if (!tournamentName) {
      const teams = await Team.find().sort({ points: -1 });
      if (!teams.length) return message.channel.send('Aucune équipe enregistrée.');

      const rows = teams.map((t, i) => {
        const medal = medals[i] || `**#${i + 1}**`;
        return `${medal} **${t.name}** — ${t.points} pts | ${t.kills} kills`;
      }).join('\n');

      const activeTournoi = await Tournament.findOne({ active: true });
      const config = await Config.findOne();
      const frozen = config?.rankFrozen ?? false;

      const embed = new EmbedBuilder()
        .setTitle(frozen ? '❄️ Classement général (gelé)' : '🏆 Classement général')
        .setDescription(frozen ? `> ❄️ **Le classement est actuellement gelé** — positions figées pour les playoffs.\n\n${rows}` : rows)
        .setColor(frozen ? 0x87CEEB : 0xF1C40F)
        .setFooter({ text: activeTournoi ? `Tournoi en cours : ${activeTournoi.name}` : `${teams.length} équipe(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- Classement par tournoi ---
    const tournament = await Tournament.findOne({
      name: { $regex: new RegExp(`^${tournamentName}$`, 'i') }
    });

    if (!tournament)
      return message.reply(`❌ Tournoi **${tournamentName}** introuvable. Vérifie le nom avec \`!tournois\`.`);

    const matches = await Match.find({ tournamentId: tournament._id.toString() });

    if (!matches.length)
      return message.channel.send(`Aucun match enregistré pour le tournoi **${tournament.name}**.`);

    // Agréger les stats par équipe pour ce tournoi uniquement
    const statsMap = {};
    for (const m of matches) {
      if (!statsMap[m.team]) statsMap[m.team] = { points: 0, kills: 0, matchCount: 0 };
      statsMap[m.team].points += m.points;
      statsMap[m.team].kills += m.kills;
      statsMap[m.team].matchCount++;
    }

    const sorted = Object.entries(statsMap)
      .sort((a, b) => b[1].points - a[1].points);

    const rows = sorted.map(([name, s], i) => {
      const medal = medals[i] || `**#${i + 1}**`;
      return `${medal} **${name}** — ${s.points} pts | ${s.kills} kills | ${s.matchCount} matchs`;
    }).join('\n');

    const status = tournament.active ? '🟢 En cours' : '🔴 Terminé';
    const winner = tournament.winner ? `🥇 ${tournament.winner}` : null;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Classement — ${tournament.name}`)
      .setDescription(rows)
      .setColor(tournament.active ? 0x57F287 : 0xF1C40F)
      .addFields(
        { name: 'Statut', value: status, inline: true },
        { name: 'Matchs', value: `${matches.length}`, inline: true },
        ...(winner ? [{ name: 'Vainqueur', value: winner, inline: true }] : [])
      )
      .setFooter({ text: `${sorted.length} équipe(s) participantes` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[ranking] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
