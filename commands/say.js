const { staffLog } = require('../utils/staffLog');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

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
    let hasText = text.length > 0;
    const hasMedia = attachments.length > 0;

    if (!hasText && !hasMedia)
      return message.reply('❌ Usage : `!dire [#salon] <texte et/ou fichier joint>`');

    const buildPayload = () => {
      const payload = {};
      if (hasText)  payload.content = text;
      if (hasMedia) payload.files   = attachments.map(a => a.url);
      return payload;
    };

    const publish = async () => {
      try {
        await targetChannel.send(buildPayload());

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

    const buildPreviewContent = () => {
      const lines = [
        `📢 **Aperçu du message à publier dans <#${targetChannel.id}> :**`,
        '',
        hasText ? text : '*(aucun texte, pièce(s) jointe(s) uniquement)*',
      ];
      if (hasMedia) lines.push('', `📎 **Médias :** ${attachments.map(a => a.name).join(', ')}`);
      return lines.join('\n');
    };

    const buildRow = () => new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('say_confirm').setLabel('✅ Publier').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('say_edit').setLabel('✏️ Modifier').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('say_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary)
    );

    let preview;
    try {
      preview = await message.reply({ content: buildPreviewContent(), components: [buildRow()] });
    } catch (err) {
      console.error('[say] Erreur envoi aperçu :', err);
      return message.reply('❌ Impossible de générer l\'aperçu.');
    }

    const collector = preview.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    let handled = false;

    collector.on('collect', async (i) => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: '⛔ Seul l\'auteur de la commande peut modifier ce message.', ephemeral: true });
      }

      if (i.customId === 'say_edit') {
        const modal = new ModalBuilder()
          .setCustomId('say_edit_modal')
          .setTitle('Modifier le message');

        const input = new TextInputBuilder()
          .setCustomId('say_edit_text')
          .setLabel('Texte du message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(!hasMedia)
          .setMaxLength(2000)
          .setValue(text.slice(0, 4000));

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        try {
          await i.showModal(modal);
          const modalSubmit = await i.awaitModalSubmit({
            filter: (mi) => mi.customId === 'say_edit_modal' && mi.user.id === message.author.id,
            time: 120_000,
          });

          text = modalSubmit.fields.getTextInputValue('say_edit_text').trim();
          hasText = text.length > 0;

          if (!hasText && !hasMedia) {
            await modalSubmit.reply({ content: '❌ Le message ne peut pas être vide.', ephemeral: true });
            return;
          }

          await modalSubmit.update({ content: buildPreviewContent(), components: [buildRow()] });
        } catch {
          /* modal timed out or dismissed — keep previous preview */
        }
        return;
      }

      handled = true;
      collector.stop();

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
