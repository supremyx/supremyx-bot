const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const medals = ['🥇', '🥈', '🥉'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!top')) return;
    const cd = checkCooldown(message.author.id, 'top', 10);
    if (cd) return replyCooldown(message, cd, 'top');

    const n = parseInt(message.content.split(' ')[1]) || 3;

    if (n < 1 || n > 25)
      return message.reply('Nombre entre 1 et 25 svp.');

    const teams = await Team.find().sort({ points: -1 }).limit(n);

    if (!teams.length) return message.channel.send('Aucune équipe enregistrée.');

    const rows = teams.map((t, i) => {
      const medal = medals[i] || `**#${i + 1}**`;
      return `${medal} **${t.name}** — ${t.points} pts | ${t.kills} kills`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Top ${n}`)
      .setDescription(rows)
      .setColor(0xE67E22)
      .setFooter({ text: `Classement basé sur les points totaux` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
