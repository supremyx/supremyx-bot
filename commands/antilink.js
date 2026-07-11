const AntiLinkConfig = require('../database/models/AntiLinkConfig');
const { invalidateConfigCache } = require('../utils/antiLink');
const { EmbedBuilder } = require('discord.js');

async function getOrCreate(guildId) {
  return AntiLinkConfig.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { upsert: true, new: true }
  );
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.content.startsWith('!antilink')) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('🔒 Réservé aux administrateurs.');

    const guildId = message.guild.id;
    const args    = message.content.split(/\s+/).slice(1);
    const sub     = args[0]?.toLowerCase();

    if (!sub) {
      const cfg = await AntiLinkConfig.findOne({ guildId });
      const embed = new EmbedBuilder()
        .setTitle('🔗 Configuration Anti-Liens')
        .setColor(cfg?.enabled ? 0x34D399 : 0x6B7280)
        .addFields(
          { name: '🔛 Statut',              value: cfg?.enabled ? '✅ Actif' : '❌ Inactif', inline: true },
          { name: '🛡️ Invitations Discord', value: cfg?.blockDiscordInvites ? '✅ Bloquées' : '❌ Autorisées', inline: true },
          { name: '🌐 Liens externes',      value: cfg?.blockExternalLinks  ? '✅ Bloqués'  : '❌ Autorisés', inline: true },
          { name: '⚡ Action',              value: cfg?.action || 'delete_warn', inline: true },
          { name: '⏱️ Timeout',             value: `${cfg?.timeoutSeconds ?? 300}s`, inline: true },
          { name: '🔢 Seuil violations',    value: `${cfg?.violationThreshold ?? 3}`, inline: true },
          { name: '✅ Domaines autorisés',  value: cfg?.allowedDomains?.join(', ') || '*aucun*', inline: false },
          { name: '🎭 Rôles exempts',       value: cfg?.exemptRoles?.map(id => `<@&${id}>`).join(', ') || '*aucun*', inline: true },
          { name: '📍 Salons exempts',      value: cfg?.exemptChannels?.map(id => `<#${id}>`).join(', ') || '*aucun*', inline: true },
        )
        .setFooter({ text: 'Usage: !antilink activer | désactiver | invites | liens | domaine | action | timeout | exemptrole | exemptchannel' });
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'activer' || sub === 'désactiver' || sub === 'desactiver') {
      const enabled = sub === 'activer';
      await AntiLinkConfig.findOneAndUpdate({ guildId }, { enabled }, { upsert: true });
      invalidateConfigCache(guildId);
      return message.reply(`${enabled ? '✅' : '⛔'} Anti-liens **${enabled ? 'activé' : 'désactivé'}**.`);
    }

    if (sub === 'invites') {
      const val = args[1]?.toLowerCase() === 'activer';
      await AntiLinkConfig.findOneAndUpdate({ guildId }, { blockDiscordInvites: val }, { upsert: true });
      invalidateConfigCache(guildId);
      return message.reply(`${val ? '✅' : '⛔'} Blocage des invitations Discord **${val ? 'activé' : 'désactivé'}**.`);
    }

    if (sub === 'liens') {
      const val = args[1]?.toLowerCase() === 'activer';
      await AntiLinkConfig.findOneAndUpdate({ guildId }, { blockExternalLinks: val }, { upsert: true });
      invalidateConfigCache(guildId);
      return message.reply(`${val ? '✅' : '⛔'} Blocage des liens externes **${val ? 'activé' : 'désactivé'}**.`);
    }

    if (sub === 'action') {
      const valid = ['delete', 'delete_warn', 'delete_timeout'];
      const action = args[1]?.toLowerCase();
      if (!valid.includes(action))
        return message.reply(`❌ Action invalide. Valeurs : \`${valid.join(' | ')}\``);
      await AntiLinkConfig.findOneAndUpdate({ guildId }, { action }, { upsert: true });
      invalidateConfigCache(guildId);
      return message.reply(`✅ Action définie : \`${action}\``);
    }

    if (sub === 'timeout') {
      const seconds = parseInt(args[1], 10);
      if (isNaN(seconds) || seconds < 10 || seconds > 86400)
        return message.reply('❌ Durée invalide (10–86400 secondes).');
      await AntiLinkConfig.findOneAndUpdate({ guildId }, { timeoutSeconds: seconds }, { upsert: true });
      invalidateConfigCache(guildId);
      return message.reply(`✅ Durée de timeout : **${seconds}s**`);
    }

    if (sub === 'seuil') {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 1 || n > 50)
        return message.reply('❌ Seuil invalide (1–50).');
      await AntiLinkConfig.findOneAndUpdate({ guildId }, { violationThreshold: n }, { upsert: true });
      invalidateConfigCache(guildId);
      return message.reply(`✅ Seuil de violations : **${n}**`);
    }

    if (sub === 'domaine') {
      const action = args[1]?.toLowerCase();
      const domain = args[2]?.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      if (!domain) return message.reply('Usage : `!antilink domaine ajouter|retirer <domain.com>`');
      const cfg = await getOrCreate(guildId);
      let domains = cfg.allowedDomains || [];
      if (action === 'ajouter') {
        if (!domains.includes(domain)) domains.push(domain);
      } else if (action === 'retirer') {
        domains = domains.filter(d => d !== domain);
      } else return message.reply('Usage : `!antilink domaine ajouter|retirer <domain.com>`');
      await AntiLinkConfig.findOneAndUpdate({ guildId }, { allowedDomains: domains });
      invalidateConfigCache(guildId);
      return message.reply(`✅ Domaine \`${domain}\` **${action === 'ajouter' ? 'ajouté' : 'retiré'}** de la liste blanche.`);
    }

    if (sub === 'exemptrole') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply('❌ Mentionne un rôle. Ex: `!antilink exemptrole @Modérateur`');
      const cfg  = await getOrCreate(guildId);
      let roles  = cfg.exemptRoles || [];
      if (roles.includes(role.id)) {
        roles = roles.filter(r => r !== role.id);
        await AntiLinkConfig.findOneAndUpdate({ guildId }, { exemptRoles: roles });
        return message.reply(`✅ Rôle ${role} **retiré** des exemptions.`);
      } else {
        roles.push(role.id);
        await AntiLinkConfig.findOneAndUpdate({ guildId }, { exemptRoles: roles });
        return message.reply(`✅ Rôle ${role} **ajouté** aux exemptions.`);
      }
    }

    if (sub === 'exemptchannel') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ Mentionne un salon. Ex: `!antilink exemptchannel #général`');
      const cfg      = await getOrCreate(guildId);
      let channels   = cfg.exemptChannels || [];
      if (channels.includes(channel.id)) {
        channels = channels.filter(c => c !== channel.id);
        await AntiLinkConfig.findOneAndUpdate({ guildId }, { exemptChannels: channels });
        return message.reply(`✅ Salon ${channel} **retiré** des exemptions.`);
      } else {
        channels.push(channel.id);
        await AntiLinkConfig.findOneAndUpdate({ guildId }, { exemptChannels: channels });
        return message.reply(`✅ Salon ${channel} **ajouté** aux exemptions.`);
      }
    }

    return message.reply('❓ Sous-commande inconnue. Usage : `!antilink` pour voir la config.');
  });
};
