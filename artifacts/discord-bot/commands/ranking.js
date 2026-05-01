const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');

const medals = ['🥇', '🥈', '🥉'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content === '!ranking') {

      const teams = await Team.find().sort({ points: -1 });

      if (!teams.length) return message.channel.send('Aucune équipe enregistrée.');

      const rows = teams.map((t, i) => {
        const medal = medals[i] || `**#${i + 1}**`;
        return `${medal} **${t.name}** — ${t.points} pts | ${t.kills} kills`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🏆 Classement général')
        .setDescription(rows)
        .setColor(0xF1C40F)
        .setFooter({ text: `${teams.length} équipe(s) enregistrée(s)` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    }
  });
};
