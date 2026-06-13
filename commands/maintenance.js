const { EmbedBuilder } = require('discord.js');
const { setMaintenance, setMessage, loadCache, getCached } = require('../utils/maintenanceGuard');
const MaintenanceConfig = require('../database/models/MaintenanceConfig');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!maintenance')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const args    = content.split(' ').slice(1);
    const sub     = args[0]?.toLowerCase();
    const guildId = message.guild.id;

    try {

      // --- !maintenance on [message personnalisé] ---
      if (sub === 'on') {
        const customMsg = args.slice(1).join(' ').trim() || undefined;
        const doc = await setMaintenance(
          guildId, true, customMsg,
          message.author.id, message.author.tag
        );

        const embed = new EmbedBuilder()
          .setTitle('🛠️ Maintenance activée')
          .setColor(0xFEE75C)
          .addFields(
            { name: '📢 Message affiché', value: `> ${doc.message}` },
            { name: '👤 Activée par', value: `<@${message.author.id}>` }
          )
          .setFooter({ text: 'Seul le staff (Administrateur) peut utiliser les commandes.' })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // --- !maintenance off ---
      if (sub === 'off') {
        const doc = await setMaintenance(guildId, false);
        const embed = new EmbedBuilder()
          .setTitle('✅ Maintenance désactivée')
          .setColor(0x57F287)
          .addFields({ name: '👤 Désactivée par', value: `<@${message.author.id}>` })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // --- !maintenance message <texte> ---
      if (sub === 'message') {
        const newMsg = args.slice(1).join(' ').trim();
        if (!newMsg) return message.reply('Usage : `!maintenance message <nouveau texte>`');

        const doc = await setMessage(guildId, newMsg);
        return message.reply(`✅ Message de maintenance mis à jour :\n> ${doc.message}`);
      }

      // --- !maintenance status ---
      if (!sub || sub === 'status') {
        let state = getCached(guildId);
        if (!state) state = await loadCache(guildId);

        const doc = await MaintenanceConfig.findOne({ guildId }).lean();

        const active = state?.active || false;
        const msg    = state?.message || '🛠️ Le bot est en maintenance. Revenez plus tard !';
        const since  = doc?.startedAt
          ? new Date(doc.startedAt).toLocaleDateString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })
          : '—';

        const embed = new EmbedBuilder()
          .setTitle('🛠️ Statut de la maintenance')
          .setColor(active ? 0xFEE75C : 0x57F287)
          .addFields(
            { name: '📌 État', value: active ? '🔴 **En maintenance**' : '🟢 **Normal**', inline: true },
            { name: '📢 Message', value: `> ${msg}`, inline: false },
            ...(active && doc?.startedTag ? [
              { name: '👤 Activée par', value: doc.startedTag, inline: true },
              { name: '🕐 Depuis', value: since, inline: true }
            ] : [])
          )
          .setFooter({ text: '!maintenance on | off | message <texte>' })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      return message.reply(
        '**Commandes `!maintenance` :**\n' +
        '`!maintenance on [message]` — Activer (message optionnel)\n' +
        '`!maintenance off` — Désactiver\n' +
        '`!maintenance message <texte>` — Changer le message\n' +
        '`!maintenance status` — Voir l\'état actuel'
      );

    } catch (err) {
      console.error('[maintenance]', err);
      message.reply('❌ Erreur lors de la gestion de la maintenance.').catch(() => {});
    }
  });
};
