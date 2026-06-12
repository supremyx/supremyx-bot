const AutoroleConfig = require('../database/models/AutoroleConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!content.startsWith('!rolesauto')) return;
    if (!message.guild) return;
    if (!message.member.permissions.has('Administrator')) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    // --- !rolesauto set @role ---
    if (sub === 'set') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply('Usage : `!rolesauto set @role`');
      await AutoroleConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { guildId: message.guild.id, roleId: role.id, enabled: true },
        { upsert: true, new: true }
      );
      logStaffAction(client, `🎭 **Autorole** configuré → @${role.name} | Par : ${message.author.tag}`);
      return message.reply(`✅ Le rôle **@${role.name}** sera attribué automatiquement aux nouveaux membres.`);
    }

    // --- !rolesauto off ---
    if (sub === 'off') {
      await AutoroleConfig.findOneAndUpdate({ guildId: message.guild.id }, { enabled: false }, { upsert: true });
      logStaffAction(client, `🎭 **Autorole désactivé** | Par : ${message.author.tag}`);
      return message.reply('⛔ Autorole désactivé.');
    }

    // --- !rolesauto on ---
    if (sub === 'on') {
      await AutoroleConfig.findOneAndUpdate({ guildId: message.guild.id }, { enabled: true }, { upsert: true });
      logStaffAction(client, `🎭 **Autorole activé** | Par : ${message.author.tag}`);
      return message.reply('✅ Autorole activé.');
    }

    // --- !autorole (status) ---
    const config = await AutoroleConfig.findOne({ guildId: message.guild.id });
    const role = config ? message.guild.roles.cache.get(config.roleId) : null;
    const embed = new EmbedBuilder()
      .setTitle('🎭 Configuration Autorole')
      .setColor(config?.enabled ? 0x57F287 : 0xED4245)
      .addFields(
        { name: '🔘 Statut', value: config?.enabled ? '✅ Activé' : '⛔ Désactivé', inline: true },
        { name: '🏷️ Rôle', value: role ? `@${role.name}` : 'Non configuré', inline: true }
      )
      .setFooter({ text: 'Configure avec !rolesauto set @role' })
      .setTimestamp();
    return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[autorole] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
