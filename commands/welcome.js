const WelcomeConfig = require('../database/models/WelcomeConfig');
const AutoroleConfig = require('../database/models/AutoroleConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

function applyTemplate(template, member) {
  return template
    .replace(/{user}/g, `${member}`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount.toString());
}

module.exports = (client) => {
  // --- Welcome on member join ---
  client.on('guildMemberAdd', async member => {
    try {
      // Welcome message
      const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
      if (config && config.enabled && config.channelId) {
        const channel = member.guild.channels.cache.get(config.channelId);
        if (channel) {
          const text = applyTemplate(config.message, member);
          const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(text)
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ text: `${member.guild.name} • ${member.guild.memberCount} membres` })
            .setTimestamp();
          await channel.send({ embeds: [embed] });
        }
      }

      // Auto-role
      const autorole = await AutoroleConfig.findOne({ guildId: member.guild.id });
      if (autorole && autorole.enabled && autorole.roleId) {
        const role = member.guild.roles.cache.get(autorole.roleId);
        if (role) await member.roles.add(role).catch(() => {});
      }
    } catch {
      // Silent fail
    }
  });

  // --- !welcome commands ---
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!welcome')) return;
    if (!message.guild) return;
    if (!message.member.permissions.has('Administrator')) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    // --- !welcome set <message> ---
    if (sub === 'set') {
      const text = content.slice('!welcome set'.length).trim();
      if (!text) return message.reply(
        'Usage : `!welcome set <message>`\n' +
        'Variables : `{user}` `{username}` `{server}` `{count}`\n' +
        'Ex : `!welcome set Bienvenue {user} sur {server} ! Tu es notre {count}e membre.`'
      );
      await WelcomeConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { $set: { message: text, enabled: true } },
        { upsert: true, new: true }
      );
      logStaffAction(client, `👋 **Welcome message** mis à jour | Par : ${message.author.tag}`);
      return message.reply(`✅ Message de bienvenue mis à jour.`);
    }

    // --- !welcome channel #salon ---
    if (sub === 'channel') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!welcome channel #salon`');
      await WelcomeConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { $set: { channelId: channel.id, enabled: true } },
        { upsert: true, new: true }
      );
      logStaffAction(client, `👋 **Welcome channel** → <#${channel.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Les messages de bienvenue iront dans <#${channel.id}>.`);
    }

    // --- !welcome test ---
    if (sub === 'test') {
      const config = await WelcomeConfig.findOne({ guildId: message.guild.id });
      if (!config || !config.channelId) return message.reply('❌ Configure d\'abord un salon avec `!welcome channel #salon`.');
      const channel = message.guild.channels.cache.get(config.channelId);
      if (!channel) return message.reply('❌ Salon introuvable.');
      const text = applyTemplate(config.message, message.member);
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(text)
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `${message.guild.name} • ${message.guild.memberCount} membres` })
        .setTimestamp();
      await channel.send({ embeds: [embed] });
      return message.reply(`✅ Message de bienvenue test envoyé dans <#${channel.id}>.`);
    }

    // --- !welcome off ---
    if (sub === 'off') {
      await WelcomeConfig.findOneAndUpdate({ guildId: message.guild.id }, { enabled: false }, { upsert: true });
      logStaffAction(client, `👋 **Welcome désactivé** | Par : ${message.author.tag}`);
      return message.reply('⛔ Messages de bienvenue désactivés.');
    }

    // --- !welcome on ---
    if (sub === 'on') {
      await WelcomeConfig.findOneAndUpdate({ guildId: message.guild.id }, { enabled: true }, { upsert: true });
      logStaffAction(client, `👋 **Welcome activé** | Par : ${message.author.tag}`);
      return message.reply('✅ Messages de bienvenue activés.');
    }

    // --- !welcome (no sub) → status ---
    const config = await WelcomeConfig.findOne({ guildId: message.guild.id });
    const embed = new EmbedBuilder()
      .setTitle('👋 Configuration des messages de bienvenue')
      .setColor(config?.enabled ? 0x57F287 : 0xED4245)
      .addFields(
        { name: '🔘 Statut', value: config?.enabled ? '✅ Activé' : '⛔ Désactivé', inline: true },
        { name: '📍 Salon', value: config?.channelId ? `<#${config.channelId}>` : 'Non configuré', inline: true },
        { name: '💬 Message', value: config?.message || 'Défaut' }
      )
      .setFooter({ text: 'Variables : {user} {username} {server} {count}' })
      .setTimestamp();
    return message.channel.send({ embeds: [embed] });
  });
};
