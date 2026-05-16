const { staffLog } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!say')) return;
    if (message.author.bot) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Staff uniquement.');

    // Parse args: !say [#channel] [texte]
    const args = message.content.slice(4).trim();

    // Detect if first arg is a channel mention or ID
    let targetChannel = null;
    let text = args;

    const channelMention = args.match(/^<#(\d+)>/);
    const channelId      = args.match(/^(\d{17,20})/);

    if (channelMention) {
      targetChannel = message.guild.channels.cache.get(channelMention[1]);
      text = args.slice(channelMention[0].length).trim();
    } else if (channelId) {
      targetChannel = message.guild.channels.cache.get(channelId[1]);
      if (targetChannel) text = args.slice(channelId[0].length).trim();
    }

    // Default to current channel if none specified
    if (!targetChannel) targetChannel = message.channel;

    const attachments = [...message.attachments.values()];
    const hasText = text.length > 0;
    const hasMedia = attachments.length > 0;

    if (!hasText && !hasMedia)
      return message.reply('❌ Usage : `!say [#salon] <texte et/ou fichier joint>`');

    const payload = {};
    if (hasText)  payload.content = text;
    if (hasMedia) payload.files   = attachments.map(a => a.url);

    try {
      await targetChannel.send(payload);
      await message.delete().catch(() => {});

      await staffLog(client, {
        action: 'say',
        details: [
          `**Salon :** <#${targetChannel.id}>`,
          hasText  ? `**Texte :** ${text.length > 200 ? text.slice(0, 200) + '…' : text}` : null,
          hasMedia ? `**Médias :** ${attachments.map(a => a.name).join(', ')}` : null,
        ].filter(Boolean).join('\n'),
        author: message.author.tag
      });
    } catch (err) {
      console.error('[say] Erreur :', err);
      message.reply('❌ Impossible d\'envoyer dans ce salon. Vérifie les permissions du bot.');
    }
  });
};
