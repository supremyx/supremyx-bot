const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');
const { getAnnounceChannelId, getLogChannelId } = require('../utils/channelConfig');
const Config = require('../database/models/Config');
const BirthdayConfig = require('../database/models/BirthdayConfig');
const LevelConfig = require('../database/models/LevelConfig');
const WelcomeConfig = require('../database/models/WelcomeConfig');
const AutoroleConfig = require('../database/models/AutoroleConfig');
const AntispamConfig = require('../database/models/AntispamConfig');
const AutomodConfig = require('../database/models/AutomodConfig');

function salon(id, guild) {
  if (!id) return '`Non configuré`';
  const ch = guild.channels.cache.get(id);
  return ch ? `<#${id}>` : `\`${id}\` *(introuvable)*`;
}

function role(id, guild) {
  if (!id) return '`Non configuré`';
  const r = guild.roles.cache.get(id);
  return r ? `<@&${id}>` : `\`${id}\` *(introuvable)*`;
}

function etat(enabled) {
  return enabled ? '✅ Activé' : '❌ Désactivé';
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (!message.member) return;
    if (message.author.bot) return;
    if (message.content.trim() !== '!voirconfig') return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Cette commande est réservée au staff Administrateur.');

    const cd = checkCooldown(message.author.id, 'voirconfig', 10, message.guild?.id);
    if (cd) return replyCooldown(message, cd, 'voirconfig');

    try {
      const guildId = message.guild.id;

      const [config, birthdayConf, levelConf, welcomeConf, autoroleConf, antispamConf, automodConf] =
        await Promise.all([
          Config.findOne(),
          BirthdayConfig.findOne({ guildId }),
          LevelConfig.findOne({ guildId }),
          WelcomeConfig.findOne({ guildId }),
          AutoroleConfig.findOne({ guildId }),
          AntispamConfig.findOne(),
          AutomodConfig.findOne(),
        ]);

      const announceId = getAnnounceChannelId();
      const logId = getLogChannelId();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: 'SUPREMYX — Configuration du serveur', iconURL: client.user.displayAvatarURL() })
        .setDescription('Vue d\'ensemble de tous les paramètres configurés sur ce serveur.')
        .addFields(
          {
            name: '📢 Salons',
            value: [
              `**Annonces :** ${salon(announceId, message.guild)}`,
              `**Journaux staff :** ${salon(logId, message.guild)}`,
              `**Anniversaires :** ${salon(birthdayConf?.channelId, message.guild)}`,
              `**Montées de niveau :** ${salon(levelConf?.channelId, message.guild)}`,
              `**Bienvenue :** ${salon(welcomeConf?.channelId, message.guild)}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '⚙️ Systèmes',
            value: [
              `**Anti-spam :** ${etat(antispamConf?.enabled ?? true)} — \`${antispamConf?.maxMessages ?? 5}\` msgs / \`${antispamConf?.windowSeconds ?? 5}\`s`,
              `**Automod :** ${etat(automodConf?.enabled ?? true)}`,
              `**Niveaux XP :** ${etat(levelConf?.enabled ?? true)}`,
              `**Bienvenue :** ${etat(welcomeConf?.enabled ?? true)}`,
              `**Rôle auto :** ${autoroleConf?.enabled ? role(autoroleConf.roleId, message.guild) : '❌ Désactivé'}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '🏆 Points & Kills',
            value: (() => {
              if (!config) return '`Par défaut`';
              const ptMap = config.pointSystem instanceof Map
                ? Object.fromEntries(config.pointSystem)
                : config.pointSystem;
              const rows = Object.entries(ptMap)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([place, pts]) => `#${place}→${pts}pts`)
                .join('  ');
              return `${rows}\n💀 **Bonus kill :** \`${config.killBonus ?? 1}\` pt(s)`;
            })(),
            inline: false,
          }
        )
        .setFooter({ text: `Consulté par ${message.author.tag}` })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[voirconfig] Erreur:', err);
      message.reply('❌ Une erreur est survenue lors de la récupération de la configuration.').catch(() => {});
    }
  });
};
