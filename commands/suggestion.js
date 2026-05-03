const Suggestion = require('../database/models/Suggestion');
const SuggestionConfig = require('../database/models/SuggestionConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();

    // --- !setsuggestion #channel ---
    if (content.startsWith('!setsuggestion')) {
      if (!message.member.permissions.has('Administrator')) return message.reply('Staff uniquement');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!setsuggestion #salon`');
      await SuggestionConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { guildId: message.guild.id, channelId: channel.id },
        { upsert: true, new: true }
      );
      logStaffAction(client, `💡 **Salon suggestions** configuré : <#${channel.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Les suggestions seront envoyées dans <#${channel.id}>.`);
    }

    // --- !suggestion <texte> ---
    if (content.startsWith('!suggestion')) {
      const text = content.slice('!suggestion'.length).trim();
      if (!text) return message.reply('Usage : `!suggestion <ton idée>`');

      const config = await SuggestionConfig.findOne({ guildId: message.guild.id });
      if (!config) return message.reply('❌ Aucun salon de suggestions configuré. Un staff doit utiliser `!setsuggestion #salon`.');

      const suggChannel = message.guild.channels.cache.get(config.channelId);
      if (!suggChannel) return message.reply('❌ Salon de suggestions introuvable. Reconfigurez avec `!setsuggestion`.');

      const sugg = await Suggestion.create({
        guildId: message.guild.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        text
      });

      const embed = new EmbedBuilder()
        .setTitle('💡 Nouvelle suggestion')
        .setDescription(text)
        .setColor(0xFEE75C)
        .addFields({ name: '👤 Auteur', value: `${message.author} (${message.author.tag})`, inline: true })
        .setFooter({ text: `ID : ${sugg._id}` })
        .setTimestamp()
        .setThumbnail(message.author.displayAvatarURL());

      const sent = await suggChannel.send({ embeds: [embed] });
      await sent.react('✅').catch(() => {});
      await sent.react('❌').catch(() => {});

      await Suggestion.findByIdAndUpdate(sugg._id, { messageId: sent.id, channelId: config.channelId });

      try { await message.delete(); } catch {}
      const confirm = await message.channel.send(`✅ ${message.author} ta suggestion a été soumise !`);
      setTimeout(() => confirm.delete().catch(() => {}), 5000);
    }

    // --- !suggestion accept/reject <id> [note] ---
    if (content.startsWith('!sugaccept') || content.startsWith('!sugreject')) {
      if (!message.member.permissions.has('Administrator')) return message.reply('Staff uniquement');
      const isAccept = content.startsWith('!sugaccept');
      const args = content.split(' ');
      const id = args[1];
      const note = args.slice(2).join(' ').trim();
      if (!id) return message.reply(`Usage : \`!${isAccept ? 'sugaccept' : 'sugreject'} <id> [note]\``);

      const sugg = await Suggestion.findById(id).catch(() => null);
      if (!sugg) return message.reply('❌ Suggestion introuvable.');

      sugg.status = isAccept ? 'accepted' : 'rejected';
      sugg.staffNote = note;
      await sugg.save();

      // Update original embed
      const chan = message.guild.channels.cache.get(sugg.channelId);
      if (chan && sugg.messageId) {
        const msg = await chan.messages.fetch(sugg.messageId).catch(() => null);
        if (msg) {
          const embed = EmbedBuilder.from(msg.embeds[0])
            .setColor(isAccept ? 0x57F287 : 0xED4245)
            .setTitle(isAccept ? '✅ Suggestion acceptée' : '❌ Suggestion refusée');
          if (note) embed.addFields({ name: '📝 Note staff', value: note });
          await msg.edit({ embeds: [embed] }).catch(() => {});
        }
      }

      logStaffAction(client, `💡 **Suggestion ${isAccept ? 'acceptée' : 'refusée'}** | Par : ${message.author.tag}${note ? ` | Note : ${note}` : ''}`);
      return message.reply(`✅ Suggestion **${isAccept ? 'acceptée' : 'refusée'}**.`);
    }
  });
};
