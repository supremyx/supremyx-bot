const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!mvp') return;
    const cd = checkCooldown(message.author.id, 'mvp', 15);
    if (cd) return replyCooldown(message, cd, 'mvp');

    const teams = await Team.find();
    if (!teams.length) return message.channel.send('Aucune équipe enregistrée.');

    const teamsWithRatio = await Promise.all(
      teams.map(async (t) => {
        const matchCount = await Match.countDocuments({ team: t.name });
        const ratio = matchCount > 0 ? t.kills / matchCount : 0;
        return { name: t.name, kills: t.kills, points: t.points, matchCount, ratio };
      })
    );

    const eligible = teamsWithRatio.filter(t => t.matchCount > 0);
    if (!eligible.length) return message.channel.send('Aucun match enregistré.');

    eligible.sort((a, b) => b.ratio - a.ratio);

    const mvp = eligible[0];
    const podium = eligible.slice(0, 3).map((t, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      return `${medals[i]} **${t.name}** — ${t.ratio.toFixed(2)} kills/match (${t.kills} kills en ${t.matchCount} matchs)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ MVP — ${mvp.name}`)
      .setDescription(`**${mvp.name}** domine avec **${mvp.ratio.toFixed(2)} kills/match** en moyenne.\n\n${podium}`)
      .setColor(0xE91E63)
      .addFields(
        { name: '💀 Kills totaux', value: `${mvp.kills}`, inline: true },
        { name: '🎮 Matchs joués', value: `${mvp.matchCount}`, inline: true },
        { name: '🏆 Points totaux', value: `${mvp.points}`, inline: true }
      )
      .setFooter({ text: 'Classé par kills/match — équipes avec au moins 1 match' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
