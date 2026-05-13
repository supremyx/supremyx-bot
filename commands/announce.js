const { EmbedBuilder } = require('discord.js');
const { staffLog } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!announce')) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const text = message.content.split(' ').slice(1).join(' ').trim();
    if (!text) return message.reply('Usage : `!announce <message>`');

    const channelId = process.1498861682221383740;
    if (!channelId)
      return message.reply('❌ `ANNOUNCE_CHANNEL_ID` non configuré. Ajoute l\'ID du salon d\'annonces dans les variables d\'environnement.');

    const channel = client.channels.cache.get(channelId);
    if (!channel)
      return message.reply('❌ Salon d\'annonces introuvable. Vérifie que le bot a accès à ce salon.');

    const embed = new EmbedBuilder()
      .setTitle('📢 Annonce')
      .setDescription(text)
      .setColor(0xEB459E)
      .setFooter({ text: `Annonce de ${message.author.tag}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    message.reply('✅ Annonce envoyée.');

    await message.delete().catch(() => {});

    await staffLog(client, {
      action: 'addmatch',
      details: `**Annonce envoyée :**\n${text}`,
      author: message.author.tag
    });
  });
};
