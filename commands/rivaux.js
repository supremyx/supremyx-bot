/**
 * !rivaux <équipe>  — Rivaux d'une équipe : qui la croise le plus souvent
 *                     et comparaison statistique directe.
 */
const { EmbedBuilder } = require('discord.js');
const Match = require('../database/models/Match');
const Team  = require('../database/models/Team');
const { escapeRegex } = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!rivaux')) return;

      const teamName = message.content.slice('!rivaux'.length).trim();
      if (!teamName) return message.reply('Usage : `!rivaux <équipe>`');

      await message.channel.sendTyping();

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } }).lean();
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      // Trouver tous les matchs de cette équipe
      const myMatches = await Match.find({ team: team.name }).lean();
      if (!myMatches.length)
        return message.reply(`❌ Aucun match enregistré pour **${team.name}**.`);

      // Pour chaque match, trouver les équipes qui y ont participé en même temps (même tournoi + même date ~15min)
      const rivalCount = {};
      const rivalHead2Head = {};

      for (const m of myMatches) {
        if (!m.tournamentId && !m.tournamentName) continue;

        // Chercher matchs du même tournoi dans les 30 minutes
        const sameTournoi = await Match.find({
          tournamentId: m.tournamentId,
          team: { $ne: team.name },
          createdAt: {
            $gte: new Date(new Date(m.createdAt).getTime() - 30 * 60000),
            $lte: new Date(new Date(m.createdAt).getTime() + 30 * 60000),
          },
        }).lean();

        for (const r of sameTournoi) {
          rivalCount[r.team] = (rivalCount[r.team] || 0) + 1;
          if (!rivalHead2Head[r.team]) rivalHead2Head[r.team] = { myKills: 0, theirKills: 0, myPoints: 0, theirPoints: 0, n: 0 };
          rivalHead2Head[r.team].myKills    += m.kills;
          rivalHead2Head[r.team].theirKills += r.kills;
          rivalHead2Head[r.team].myPoints   += m.points;
          rivalHead2Head[r.team].theirPoints += r.points;
          rivalHead2Head[r.team].n++;
        }
      }

      const sorted = Object.entries(rivalCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

      if (!sorted.length) {
        // Fallback : classement des adversaires par période de temps sans tournoi
        const allTeams = await Team.find({ name: { $ne: team.name } }).lean();
        const embed = new EmbedBuilder()
          .setTitle(`⚔️ Rivaux — ${team.name}`)
          .setDescription('Pas assez de données de tournois pour identifier les rivaux directs.\nLes équipes du serveur sont :')
          .setColor(0xED4245)
          .addFields(allTeams.slice(0, 10).map(t => ({
            name: t.name,
            value: `${t.points} pts · ${t.kills} kills`,
            inline: true,
          })))
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const myTotalKills = myMatches.reduce((s, m) => s + m.kills, 0);
      const myTotalPts   = myMatches.reduce((s, m) => s + m.points, 0);

      const fields = sorted.map(([rival, meetings], i) => {
        const h2h = rivalHead2Head[rival];
        if (!h2h) return { name: `#${i + 1} ${rival}`, value: `${meetings} rencontre(s)`, inline: true };
        const avgMyK    = (h2h.myKills    / h2h.n).toFixed(1);
        const avgTheirK = (h2h.theirKills / h2h.n).toFixed(1);
        const killWin   = h2h.myKills > h2h.theirKills ? '✅ Avantage kills' : '❌ Désavantage kills';
        const ptsWin    = h2h.myPoints > h2h.theirPoints ? '✅ Avantage points' : '❌ Désavantage points';
        return {
          name: `#${i + 1} ⚔️ ${rival} (${meetings} rencontre${meetings > 1 ? 's' : ''})`,
          value: `💀 Kills : ${avgMyK} vs ${avgTheirK} — ${killWin}\n⭐ Pts/match : ${(h2h.myPoints/h2h.n).toFixed(0)} vs ${(h2h.theirPoints/h2h.n).toFixed(0)} — ${ptsWin}`,
          inline: false,
        };
      });

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Rivaux — ${team.name}`)
        .setDescription(`Équipes rencontrées le plus souvent en tournoi.\n**${team.name}** : ${myTotalKills} kills totaux · ${myTotalPts} pts totaux`)
        .setColor(0xED4245)
        .addFields(fields)
        .setFooter({ text: 'Basé sur les matchs de mêmes tournois · Fenêtre ±30 min' })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[rivaux] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
