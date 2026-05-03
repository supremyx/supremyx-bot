const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!compare')) return;
    const cd = checkCooldown(message.author.id, 'compare', 5);
    if (cd) return replyCooldown(message, cd, 'compare');

    const args = message.content.split(' ').slice(1);
    const separator = args.indexOf('vs');

    if (separator === -1 || separator === 0 || separator === args.length - 1)
      return message.reply('Usage : `!compare <équipe1> vs <équipe2>`');

    const name1 = args.slice(0, separator).join(' ');
    const name2 = args.slice(separator + 1).join(' ');

    const [team1, team2] = await Promise.all([
      Team.findOne({ name: { $regex: new RegExp(`^${name1}$`, 'i') } }),
      Team.findOne({ name: { $regex: new RegExp(`^${name2}$`, 'i') } })
    ]);

    if (!team1) return message.reply(`❌ Équipe **${name1}** introuvable.`);
    if (!team2) return message.reply(`❌ Équipe **${name2}** introuvable.`);

    const [count1, count2] = await Promise.all([
      Match.countDocuments({ team: team1.name }),
      Match.countDocuments({ team: team2.name })
    ]);

    const avg1 = count1 > 0 ? (team1.kills / count1).toFixed(1) : '0';
    const avg2 = count2 > 0 ? (team2.kills / count2).toFixed(1) : '0';

    const winner = team1.points > team2.points ? team1.name
      : team2.points > team1.points ? team2.name
      : null;

    function stat(v1, v2) {
      if (v1 > v2) return ['⬆️', '⬇️'];
      if (v2 > v1) return ['⬇️', '⬆️'];
      return ['➡️', '➡️'];
    }

    const [pA, pB] = stat(team1.points, team2.points);
    const [kA, kB] = stat(team1.kills, team2.kills);
    const [mA, mB] = stat(count1, count2);
    const [aA, aB] = stat(parseFloat(avg1), parseFloat(avg2));

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${team1.name} vs ${team2.name}`)
      .setColor(0xEB459E)
      .addFields(
        {
          name: `🔵 ${team1.name}`,
          value: [
            `${pA} **Points :** ${team1.points}`,
            `${kA} **Kills :** ${team1.kills}`,
            `${mA} **Matchs :** ${count1}`,
            `${aA} **Kills/match :** ${avg1}`,
          ].join('\n'),
          inline: true
        },
        {
          name: `🔴 ${team2.name}`,
          value: [
            `${pB} **Points :** ${team2.points}`,
            `${kB} **Kills :** ${team2.kills}`,
            `${mB} **Matchs :** ${count2}`,
            `${aB} **Kills/match :** ${avg2}`,
          ].join('\n'),
          inline: true
        },
        {
          name: '🏆 Avantage',
          value: winner ? `**${winner}** mène au classement` : '**Égalité** au classement',
          inline: false
        }
      )
      .setFooter({ text: '⬆️ = meilleur  |  ⬇️ = inférieur  |  ➡️ = égal' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
