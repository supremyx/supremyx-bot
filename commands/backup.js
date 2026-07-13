const { createBackup, restoreBackup, listBackups, deleteBackup } = require('../utils/serverBackup');
const { EmbedBuilder } = require('discord.js');

function fmtDate(d) {
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.content.startsWith('!sauvegarde')) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('🔒 Réservé aux administrateurs.');

    const guildId = message.guild.id;
    const args    = message.content.split(/\s+/).slice(1);
    const sub     = args[0]?.toLowerCase();

    // List backups
    if (!sub || sub === 'liste') {
      const backups = await listBackups(guildId);
      if (!backups.length) return message.reply('📂 Aucune sauvegarde pour ce serveur. Utilise `!sauvegarde creer` pour en créer une.');

      const embed = new EmbedBuilder()
        .setTitle('💾 Sauvegardes du serveur')
        .setColor(0x5865F2)
        .setDescription(backups.map((b, i) =>
          `**${i + 1}.** \`${b._id.toString().slice(-6)}\` · **${b.name}** · ${fmtDate(b.createdAt)}${b.restoredAt ? ` *(restauré le ${fmtDate(b.restoredAt)})*` : ''} · par ${b.createdBy}`
        ).join('\n'))
        .setFooter({ text: '!sauvegarde creer [nom] | !sauvegarde restaurer <id> | !sauvegarde supprimer <id>' });
      return message.reply({ embeds: [embed] });
    }

    if (sub === 'creer') {
      const name = args.slice(1).join(' ') || `Sauvegarde ${new Date().toLocaleString('fr-FR')}`;
      const msg  = await message.reply('⏳ Création de la sauvegarde en cours...');
      try {
        const backup = await createBackup(guildId, name, message.author.tag);
        await msg.edit(`✅ Sauvegarde **"${backup.name}"** créée (ID: \`${backup._id.toString().slice(-6)}\`)`);
      } catch (err) {
        await msg.edit(`❌ Erreur : ${err.message}`);
      }
      return;
    }

    if (sub === 'restaurer') {
      const idPart = args[1];
      if (!idPart) return message.reply('Usage : `!sauvegarde restaurer <id>` (les 6 derniers caractères de l\'ID)');

      // Find by suffix
      const backups = await listBackups(guildId, 50);
      const backup  = backups.find(b => b._id.toString().endsWith(idPart) || b._id.toString().slice(-6) === idPart);
      if (!backup) return message.reply(`❌ Sauvegarde \`${idPart}\` introuvable.`);

      const confirm = await message.reply(`⚠️ Restaurer **"${backup.name}"** (${fmtDate(backup.createdAt)}) ? Cette action remplace les configurations actuelles. Réponds \`oui\` en moins de 30 secondes.`);
      const filter  = m => m.author.id === message.author.id && m.content.toLowerCase() === 'oui';
      try {
        await message.channel.awaitMessages({ filter, max: 1, time: 30_000, errors: ['time'] });
      } catch {
        return confirm.edit('⛔ Restauration annulée (temps écoulé).');
      }

      const msg = await message.channel.send('⏳ Restauration en cours...');
      try {
        const results = await restoreBackup(backup._id.toString(), message.author.tag);
        const summary = Object.entries(results).map(([m, n]) => `${m}: ${n}`).join(', ');
        await msg.edit(`✅ Restauration terminée.\n\`\`\`${summary}\`\`\``);
      } catch (err) {
        await msg.edit(`❌ Erreur lors de la restauration : ${err.message}`);
      }
      return;
    }

    if (sub === 'supprimer') {
      const idPart = args[1];
      if (!idPart) return message.reply('Usage : `!sauvegarde supprimer <id>`');
      const backups = await listBackups(guildId, 50);
      const backup  = backups.find(b => b._id.toString().endsWith(idPart) || b._id.toString().slice(-6) === idPart);
      if (!backup) return message.reply(`❌ Sauvegarde \`${idPart}\` introuvable.`);
      await deleteBackup(backup._id.toString());
      return message.reply(`🗑️ Sauvegarde **"${backup.name}"** supprimée.`);
    }

    return message.reply('❓ Usage : `!sauvegarde` | `!sauvegarde creer [nom]` | `!sauvegarde restaurer <id>` | `!sauvegarde supprimer <id>`');
  });
};
