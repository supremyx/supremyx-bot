const { EmbedBuilder } = require('discord.js');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000 };
  return val * multipliers[unit];
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!remind')) return;

    const args = message.content.trim().split(' ');
    const durationStr = args[1];
    const text = args.slice(2).join(' ').trim();

    if (!durationStr || !text)
      return message.reply('Usage : `!remind <durée> <message>`\nExemple : `!remind 30m Lancer le match`\nUnités : s, m, h');

    const duration = parseDuration(durationStr);
    if (!duration) return message.reply('❌ Durée invalide. Utilise : `30s`, `10m`, `2h`');
    if (duration > 24 * 3600000) return message.reply('❌ Maximum 24 heures.');

    const endsAt = new Date(Date.now() + duration);
    const endsStr = endsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    message.reply(`⏰ Rappel enregistré ! Je te contacte à **${endsStr}** en DM.`);

    setTimeout(async () => {
      const embed = new EmbedBuilder()
        .setTitle('⏰ Rappel !')
        .setColor(0xFEE75C)
        .setDescription(text)
        .setFooter({ text: `Rappel demandé depuis #${message.channel.name}` })
        .setTimestamp();

      message.author.createDM()
        .then(dm => dm.send({ embeds: [embed] }))
        .catch(() => {
          message.channel.send(`⏰ ${message.author} — rappel : ${text}`);
        });
    }, duration);
  });
};
