const AntiRaidConfig = require('../database/models/AntiRaidConfig');
const { unlockGuild } = require('../utils/antiRaid');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.content.startsWith('!antiraid')) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('🔒 Réservé aux administrateurs.');

    const guildId = message.guild.id;
    const args    = message.content.split(/\s+/).slice(1);
    const sub     = args[0]?.toLowerCase();

    const getOrCreate = () => AntiRaidConfig.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true }
    );

    if (!sub) {
      const cfg = await AntiRaidConfig.findOne({ guildId });
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Configuration Anti-Raid')
        .setColor(cfg?.enabled ? 0x34D399 : 0x6B7280)
        .addFields(
          { name: '🔛 Statut',           value: cfg?.enabled ? '✅ Actif' : '❌ Inactif', inline: true },
          { name: '🔒 Verrouillage actif', value: cfg?.lockdownActive ? '🔴 OUI' : '🟢 NON', inline: true },
          { name: '📊 Seuil de raid',    value: `${cfg?.joinThreshold ?? 10} arrivées / ${cfg?.joinWindowSeconds ?? 10}s`, inline: true },
          { name: '📅 Âge min. compte', value: `${cfg?.minAccountAgeDays ?? 7} jour(s)`, inline: true },
          { name: '⚡ Action',           value: cfg?.action ?? 'alert', inline: true },
          { name: '⏱️ Déverr. auto',    value: `${cfg?.autoUnlockMinutes ?? 30} min`, inline: true },
          { name: '⏰ Dernier raid',     value: cfg?.lastRaidAt ? new Date(cfg.lastRaidAt).toLocaleString('fr-FR') : 'Jamais', inline: true },
        )
        .setFooter({ text: 'Usage: !antiraid activer | désactiver | seuil | âge | action | debloquage | debloquer' });
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'activer' || sub === 'désactiver' || sub === 'desactiver') {
      const enabled = sub === 'activer';
      await AntiRaidConfig.findOneAndUpdate({ guildId }, { enabled }, { upsert: true });
      return message.reply(`${enabled ? '✅' : '⛔'} Anti-raid **${enabled ? 'activé' : 'désactivé'}**.`);
    }

    if (sub === 'seuil') {
      const nb  = parseInt(args[1], 10);
      const sec = parseInt(args[2], 10);
      if (isNaN(nb) || nb < 2 || isNaN(sec) || sec < 1)
        return message.reply('Usage : `!antiraid seuil <nb_arrivées> <secondes>` ex: `!antiraid seuil 10 10`');
      await AntiRaidConfig.findOneAndUpdate({ guildId }, { joinThreshold: nb, joinWindowSeconds: sec }, { upsert: true });
      return message.reply(`✅ Seuil : **${nb} arrivées en ${sec}s**`);
    }

    if (sub === 'age' || sub === 'âge') {
      const days = parseInt(args[1], 10);
      if (isNaN(days) || days < 0 || days > 365)
        return message.reply('❌ Âge invalide (0–365 jours).');
      await AntiRaidConfig.findOneAndUpdate({ guildId }, { minAccountAgeDays: days }, { upsert: true });
      return message.reply(`✅ Âge minimum du compte : **${days} jour(s)**`);
    }

    if (sub === 'action') {
      const valid = ['alert', 'kick', 'ban', 'lockdown'];
      const action = args[1]?.toLowerCase();
      if (!valid.includes(action))
        return message.reply(`❌ Action invalide. Valeurs : \`${valid.join(' | ')}\``);
      await AntiRaidConfig.findOneAndUpdate({ guildId }, { action }, { upsert: true });
      return message.reply(`✅ Action anti-raid : \`${action}\``);
    }

    if (sub === 'debloquage') {
      const minutes = parseInt(args[1], 10);
      if (isNaN(minutes) || minutes < 1 || minutes > 1440)
        return message.reply('❌ Durée invalide (1–1440 min).');
      await AntiRaidConfig.findOneAndUpdate({ guildId }, { autoUnlockMinutes: minutes }, { upsert: true });
      return message.reply(`✅ Déverrouillage automatique dans **${minutes} min** après lockdown.`);
    }

    if (sub === 'debloquer') {
      const cfg = await AntiRaidConfig.findOne({ guildId });
      if (!cfg?.lockdownActive) return message.reply('ℹ️ Le serveur n\'est pas en lockdown.');
      await unlockGuild(message.guild, client);
      return message.reply('🔓 Serveur **déverrouillé** manuellement.');
    }

    return message.reply('❓ Sous-commande inconnue. Tape `!antiraid` pour voir la config.');
  });
};
