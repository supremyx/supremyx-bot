const ReactionRole = require('../database/models/ReactionRole');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

function emojiKey(raw) {
  const match = raw.match(/<a?:(\w+):(\d+)>/);
  if (match) return `${match[1]}:${match[2]}`;
  return raw.trim();
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!rolereaction')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const isStaff = message.member.permissions.has('Administrator');
    if (!isStaff) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    // --- !rolereaction ajouter #salon <messageId> <emoji> @role [label] ---
    if (sub === 'ajouter') {
      const targetChannel = message.mentions.channels.first();
      const msgId = targetChannel ? args[3] : args[2];
      const emoji = targetChannel ? args[4] : args[3];
      const role = message.mentions.roles.first();
      const labelStart = targetChannel ? 6 : 5;
      const label = args.slice(labelStart).join(' ').trim();

      if (!msgId || !emoji || !role || !targetChannel)
        return message.reply(
          'Usage : `!rolereaction ajouter #salon <messageId> <emoji> @role [label]`\n' +
          'Exemple : `!rolereaction ajouter #général 123456789 🎮 @Joueur Rôle joueur`\n\n' +
          'Astuce : active le mode développeur Discord pour copier l\'ID d\'un message.'
        );

      const targetMsg = await targetChannel.messages.fetch(msgId).catch(() => null);
      if (!targetMsg)
        return message.reply('❌ Message introuvable dans ce salon. Vérifie l\'ID et que le bot a accès au salon.');

      const emojiStr = emojiKey(emoji);
      const existing = await ReactionRole.findOne({ messageId: msgId, emoji: emojiStr });
      if (existing)
        return message.reply(`❌ Cet emoji est déjà configuré sur ce message.`);

      await ReactionRole.create({
        guildId: message.guild.id,
        channelId: targetMsg.channel.id,
        messageId: msgId,
        emoji: emojiStr,
        roleId: role.id,
        label
      });

      await targetMsg.react(emoji).catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle('✅ Reaction-role configuré')
        .setColor(0x57F287)
        .addFields(
          { name: '💬 Message', value: `[Voir le message](${targetMsg.url})`, inline: true },
          { name: '🎭 Emoji',   value: emoji,                                  inline: true },
          { name: '🏷️ Rôle',   value: `<@&${role.id}>`,                       inline: true }
        )
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();

      if (label) embed.addFields({ name: '📝 Label', value: label });

      logStaffAction(client, `🎭 **Reaction-role** ajouté — emoji ${emoji} → @${role.name} | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // --- !rolereaction retirer <messageId> <emoji> ---
    if (sub === 'retirer' || sub === 'supprimer') {
      const msgId = args[2];
      const emoji = args[3];

      if (!msgId || !emoji)
        return message.reply('Usage : `!rolereaction retirer <messageId> <emoji>`');

      const emojiStr = emojiKey(emoji);
      const deleted = await ReactionRole.findOneAndDelete({ messageId: msgId, emoji: emojiStr });

      if (!deleted) return message.reply('❌ Aucun reaction-role trouvé pour cet emoji sur ce message.');

      logStaffAction(client, `🗑️ **Reaction-role supprimé** — emoji ${emoji} | Par : ${message.author.tag}`);
      return message.reply(`✅ Reaction-role **${emoji}** supprimé.`);
    }

    // --- !rolereaction liste ---
    if (!sub || sub === 'liste') {
      const entries = await ReactionRole.find({ guildId: message.guild.id }).sort({ createdAt: -1 });

      if (!entries.length)
        return message.reply('Aucun reaction-role configuré. Utilise `!rolereaction ajouter` pour en créer un.');

      const embed = new EmbedBuilder()
        .setTitle(`🎭 Reaction-roles — ${entries.length} entrée(s)`)
        .setColor(0x5865F2)
        .setTimestamp();

      for (const e of entries.slice(0, 10)) {
        const role = message.guild.roles.cache.get(e.roleId);
        embed.addFields({
          name:  `${e.emoji} → ${role ? `@${role.name}` : '❌ Rôle introuvable'}`,
          value: `📍 <#${e.channelId}> | ID message : \`${e.messageId}\`${e.label ? `\n📝 ${e.label}` : ''}`
        });
      }

      if (entries.length > 10) embed.setFooter({ text: `Affichage de 10 sur ${entries.length}` });
      return message.channel.send({ embeds: [embed] });
    }

    // --- !rolereaction vider <messageId> ---
    if (sub === 'vider') {
      const msgId = args[2];
      if (!msgId) return message.reply('Usage : `!rolereaction vider <messageId>`');

      const result = await ReactionRole.deleteMany({ messageId: msgId });
      if (!result.deletedCount) return message.reply('❌ Aucun reaction-role sur ce message.');

      logStaffAction(client, `🗑️ **Reaction-roles effacés** — message ${msgId} (${result.deletedCount}) | Par : ${message.author.tag}`);
      return message.reply(`✅ **${result.deletedCount}** reaction-role(s) supprimé(s) pour ce message.`);
    }

    message.reply(
      '**Commandes `!rolereaction` :**\n' +
      '`!rolereaction ajouter #salon <msgId> <emoji> @role [label]` — Configurer\n' +
      '`!rolereaction retirer <msgId> <emoji>` — Supprimer\n' +
      '`!rolereaction vider <msgId>` — Supprimer tous les reaction-roles d\'un message\n' +
      '`!rolereaction liste` — Voir tous les reaction-roles'
    );
  });
};
