const { staffLog } = require('../utils/staffLog');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!dire')) return;
    if (!message.guild) return;
    if (message.author.bot) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Staff uniquement.');

    // Parse args: !dire [#channel] [texte]
    const args = message.content.slice(5).trim();

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
      return message.reply('❌ Usage : `!dire [#salon] <texte et/ou fichier joint>`');

    const payload = {};
    if (hasText)  payload.content = text;
    if (hasMedia) payload.files   = attachments.map(a => a.url);

    const publish = async () => {
      try {
        await targetChannel.send(payload);

        await staffLog(client, {
          action: 'say',
          details: [
            `**Salon :** <#${targetChannel.id}>`,
            hasText  ? `**Texte :** ${text.length > 200 ? text.slice(0, 200) + '…' : text}` : null,
            hasMedia ? `**Médias :** ${attachments.map(a => a.name).join(', ')}` : null,
          ].filter(Boolean).join('\n'),
          author: message.author.tag
        });
        return true;
      } catch (err) {
        console.error('[say] Erreur :', err);
        return false;
      }
    };

    // ── Aperçu avant publication ──
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('say_confirm').setLabel('✅ Publier').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('say_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
    );

    const previewLines = [
      `📢 **Aperçu du message à publier dans <#${targetChannel.id}> :**`,
      '',
      hasText ? text : '*(aucun texte, pièce(s) jointe(s) uniquement)*',
    ];
    if (hasMedia) previewLines.push('', `📎 **Médias :** ${attachments.map(a => a.name).join(', ')}`);

    let preview;
    try {
      preview = await message.reply({ content: previewLines.join('\n'), components: [row] });
    } catch (err) {
      console.error('[say] Erreur envoi aperçu :', err);
      return message.reply('❌ Impossible de générer l\'aperçu.');
    }

    const collector = preview.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
      max: 1,
    });

    let handled = false;

    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: '⛔ Seul l\'auteur de la commande peut confirmer.', ephemeral: true });
      }

      handled = true;

      if (i.customId === 'say_cancel') {
        await i.update({ content: '❌ Publication annulée.', components: [] });
        await message.delete().catch(() => {});
        return;
      }

      const ok = await publish();
      if (ok) {
        await i.update({ content: '✅ Message publié.', components: [] });
      } else {
        await i.update({ content: '❌ Impossible d\'envoyer dans ce salon. Vérifie les permissions du bot.', components: [] });
      }
      await message.delete().catch(() => {});
    });

    collector.on('end', async () => {
      if (handled) return;
      await preview.edit({ content: '⏱️ Aperçu expiré, publication annulée.', components: [] }).catch(() => {});
      await message.delete().catch(() => {});
    });
  });
};
