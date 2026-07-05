const Match = require('../database/models/Match');
const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content !== '!matchs') return;
    const cd = checkCooldown(message.author.id, 'matchs', 15);
    if (cd) return replyCooldown(message, cd, 'matchs');

    let matches, teams;
    try {
      [matches, teams] = await Promise.all([
        Match.find().sort({ createdAt: -1 }),
        Team.find()
      ]);
    } catch (err) {
      console.error('[matchs] Erreur DB:', err);
      return message.channel.send('❌ Une erreur est survenue lors de la récupération des matchs.').catch(() => {});
    }

    if (!matches.length) return message.channel.send('Aucun match enregistré pour le moment.');

    const totalMatches = matches.length;
    const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
    const totalPoints = matches.reduce((sum, m) => sum + m.points, 0);
    const avgKills = (totalKills / totalMatches).toFixed(1);

    const bestKillsMatch = matches.reduce((best, m) => m.kills > best.kills ? m : best, matches[0]);
    const bestPointsMatch = matches.reduce((best, m) => m.points > best.points ? m : best, matches[0]);

    const firstDate = new Date(matches[matches.length - 1].createdAt).toLocaleDateString('fr-FR');
    const lastDate = new Date(matches[0].createdAt).toLocaleDateString('fr-FR');

    const embed = new EmbedBuilder()
      .setTitle('📊 Résumé global des matchs')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '📈 Chiffres clés',
          value: [
            `**Matchs enregistrés :** ${totalMatches}`,
            `**Équipes inscrites :** ${teams.length}`,
            `**Kills totaux :** ${totalKills}`,
            `**Points distribués :** ${totalPoints}`,
            `**Kills/match (moy.) :** ${avgKills}`,
          ].join('\n'),
          inline: false
        },
        {
          name: '🏅 Records',
          value: [
            `**Plus de kills en 1 match :** ${bestKillsMatch.kills} kills — *${bestKillsMatch.team}* (place #${bestKillsMatch.placement})`,
            `**Plus de points en 1 match :** ${bestPointsMatch.points} pts — *${bestPointsMatch.team}* (place #${bestPointsMatch.placement})`,
          ].join('\n'),
          inline: false
        },
        {
          name: '📅 Période',
          value: `Du **${firstDate}** au **${lastDate}**`,
          inline: false
        }
      )
      .setFooter({ text: 'Basé sur tous les matchs enregistrés' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
