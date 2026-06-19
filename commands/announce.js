const { EmbedBuilder } = require('discord.js');
const { staffLog } = require('../utils/staffLog');
const { getAnnounceChannelId } = require('../utils/channelConfig');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!annonce')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const text = message.content.split(' ').slice(1).join(' ').trim();
    if (!text) return message.reply('Usage : `!annonce <message>`');

    const channelId = getAnnounceChannelId();
    if (!channelId)
      return message.reply('❌ Salon d\'annonces non configuré. Utilise `!setannonce #salon` pour le définir.');

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
      action: 'announce',
      details: `**Annonce envoyée :**\n${text}`,
      author: message.author.tag
    });
  });
};
