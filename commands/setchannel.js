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

    if (cmd !== '!salonannonce' && cmd !== '!salonjournaux' && cmd !== '!salonsoumissionlogos' && cmd !== '!salonaffichagelogos') return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Cette commande est réservée au staff Administrateur.');

    const mention = message.mentions.channels.first();
    if (!mention) {
      const usages = {
        '!salonannonce':     '`!salonannonce #salon`     — Salon d\'annonces',
        '!salonjournaux':    '`!salonjournaux #salon`    — Salon de journaux staff',
        '!salonsoumissionlogos': '`!salonsoumissionlogos #salon` — Salon de soumission des logos (%logo)',
        '!salonaffichagelogos':  '`!salonaffichagelogos #salon`  — Salon d\'affichage des logos',
      };
      return message.reply(`❌ Mentionne un salon.\nUsage : ${usages[cmd] ?? '`!<commande> #salon`'}`);
    }

    try {
      const config = await getOrCreateConfig();

      if (cmd === '!salonannonce') {
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

      } else if (cmd === '!salonjournaux') {
        config.logChannelId = mention.id;
        await config.save();
        await invalidateChannelCache();

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🔒 Salon de journaux configuré')
          .setDescription(`Le salon de journaux staff a été défini sur ${mention}.`)
          .addFields({ name: '📍 Salon', value: `${mention} (\`${mention.id}\`)` })
          .setFooter({ text: `Configuré par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        logStaffAction(client, `🔒 **Salon journaux** défini sur <#${mention.id}> | Par : ${message.author.tag}`);

      } else if (cmd === '!salonsoumissionlogos') {
        config.logoSubmitChannelId = mention.id;
        await config.save();

        const embed = new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle('🖼️ Salon de soumission des logos configuré')
          .setDescription(
            `Les équipes peuvent maintenant soumettre leur logo dans ${mention} avec le format :\n\n` +
            '```\n%logo\nNOM DE L\'ÉQUIPE\n```\n*(+ image jointe)*'
          )
          .addFields({ name: '📍 Salon', value: `${mention} (\`${mention.id}\`)` })
          .setFooter({ text: `Configuré par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        logStaffAction(client, `🖼️ **Salon soumission logo** défini sur <#${mention.id}> | Par : ${message.author.tag}`);

      } else if (cmd === '!salonaffichagelogos') {
        config.logoListChannelId = mention.id;
        config.logoListMessages = new Map();
        await config.save();

        const embed = new EmbedBuilder()
          .setColor(0xE67E22)
          .setTitle('📋 Salon d\'affichage des logos configuré')
          .setDescription(`Les logos des équipes seront automatiquement affichés dans ${mention} après chaque soumission.`)
          .addFields({ name: '📍 Salon', value: `${mention} (\`${mention.id}\`)` })
          .setFooter({ text: `Configuré par ${message.author.tag}` })
          .setTimestamp();

        await message.channel.send({ embeds: [embed] });
        logStaffAction(client, `📋 **Salon logo list** défini sur <#${mention.id}> | Par : ${message.author.tag}`);
      }

    } catch (err) {
      console.error('[setchannel] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
