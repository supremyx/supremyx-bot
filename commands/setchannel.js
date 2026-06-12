const { EmbedBuilder } = require('discord.js');
const Config = require('../database/models/Config');
const { logStaffAction } = require('../utils/staffLog');
const { invalidateChannelCache } = require('../utils/channelConfig');

async function getOrCreateConfig() {
  let config = await Config.findOne();
  if (!config) config = await Config.create({});
  return config;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (!message.member) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    const args = content.split(/\s+/);
    const cmd = args[0].toLowerCase();

    if (cmd !== '!setannonce' && cmd !== '!setlogs') return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Cette commande est réservée au staff Administrateur.');

    const mention = message.mentions.channels.first();
    if (!mention) {
      const usage = cmd === '!setannonce'
        ? '`!setannonce #salon` — Définit le salon d\'annonces'
        : '`!setlogs #salon` — Définit le salon de logs staff';
      return message.reply(`❌ Mentionne un salon.\nUsage : ${usage}`);
    }

    try {
      const config = await getOrCreateConfig();

      if (cmd === '!setannonce') {
        config.announceChannelId = mention.id;
        await config.save();
        await invalidateChannelCache();

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('📢 Salon d\'annonces configuré')
          .setDescription(`Le salon d\'annonces a été défini sur ${mention}.`)
          .addFields({ name: '📍 Salon', value: `${mention} (\`${mention.id}\`)` })
          .setFooter({ text: `Configuré par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        logStaffAction(client, `📢 **Salon annonces** défini sur <#${mention.id}> | Par : ${message.author.tag}`);

      } else if (cmd === '!setlogs') {
        config.logChannelId = mention.id;
        await config.save();
        await invalidateChannelCache();

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🔒 Salon de logs configuré')
          .setDescription(`Le salon de logs staff a été défini sur ${mention}.`)
          .addFields({ name: '📍 Salon', value: `${mention} (\`${mention.id}\`)` })
          .setFooter({ text: `Configuré par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        logStaffAction(client, `🔒 **Salon logs** défini sur <#${mention.id}> | Par : ${message.author.tag}`);
      }

    } catch (err) {
      console.error('[setchannel] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
