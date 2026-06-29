const { EmbedBuilder } = require('discord.js');
const { checkPerm, permDenied, LEVELS } = require('../utils/permissions');
const { runBackup, startAutoBackup, stopAutoBackup, setBackupChannel, isEnabled, getIntervalHrs } = require('../utils/autoBackup');
const { logAdmin } = require('../utils/adminLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.trim().startsWith('!sauvegarde')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!await checkPerm(message, LEVELS.ADMIN)) return permDenied(message, LEVELS.ADMIN);

    const args = message.content.trim().split(/\s+/).slice(1);
    const sub  = args[0]?.toLowerCase();

    if (sub === 'automatique' || sub === 'auto') {
      const action = args[1]?.toLowerCase();
      const hours  = parseInt(args[2]) || 24;
      if (action === 'désactiver' || action === 'desactiver' || action === 'arreter' || action === 'arrêter') {
        stopAutoBackup();
        await logAdmin({ guildId: message.guild.id, guildName: message.guild.name, userId: message.author.id, userTag: message.author.tag, channelId: message.channel.id, action: 'Sauvegarde automatique désactivée', category: 'données', severity: 'warn' });
        return message.reply('🔴 Sauvegarde automatique **désactivée**.');
      }
      startAutoBackup(client, hours);
      await logAdmin({ guildId: message.guild.id, guildName: message.guild.name, userId: message.author.id, userTag: message.author.tag, channelId: message.channel.id, action: `Sauvegarde automatique activée (${hours}h)`, category: 'données', severity: 'info' });
      return message.reply(`✅ Sauvegarde automatique **activée** toutes les **${hours}h**.\nFichiers envoyés dans le canal configuré.\n*(Utilise \`!sauvegarde automatique désactiver\` pour arrêter.)*`);
    }

    if (sub === 'canal') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('❌ Mentionne un salon : `!sauvegarde canal #salon`');
      setBackupChannel(channel.id);
      await logAdmin({ guildId: message.guild.id, guildName: message.guild.name, userId: message.author.id, userTag: message.author.tag, channelId: message.channel.id, action: `Canal de sauvegarde → #${channel.name}`, category: 'config', severity: 'info' });
      return message.reply(`✅ Canal de sauvegarde défini : ${channel}`);
    }

    if (sub === 'statut') {
      const embed = new EmbedBuilder()
        .setTitle('💾 Statut — Sauvegarde automatique')
        .setColor(isEnabled() ? 0x57F287 : 0xED4245)
        .addFields(
          { name: '🔄 État',       value: isEnabled() ? '✅ Activée' : '🔴 Désactivée', inline: true },
          { name: '⏱️ Intervalle', value: isEnabled() ? `${getIntervalHrs()}h` : '—',   inline: true },
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    message.channel.sendTyping().catch(() => {});
    try {
      const { embed, file } = await runBackup(client, {
        manual: true,
        requesterId: message.author.id,
        requesterTag: message.author.tag,
      });
      try {
        const dm = await message.author.createDM();
        await dm.send({ content: '**💾 Sauvegarde SUPREMYX** — Conserve ce fichier en lieu sûr.', files: [file] });
        embed.setDescription((embed.data.description ?? '') + '\n\n📬 Fichier JSON envoyé en DM.');
      } catch {
        embed.setDescription((embed.data.description ?? '') + '\n\n⚠️ Impossible d\'envoyer en DM (messages privés fermés).');
      }
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[backup] Erreur:', err);
      return message.reply('❌ Erreur lors de la sauvegarde.');
    }
  });
};
