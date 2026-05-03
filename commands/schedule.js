const Schedule = require('../database/models/Schedule');
const Tournament = require('../database/models/Tournament');
const { EmbedBuilder } = require('discord.js');

function parseDateTime(dateStr, timeStr) {
  // Expects DD/MM/YYYY and HH:MM
  const [day, month, year] = dateStr.split('/');
  const [hour, minute] = timeStr.split(':');
  if (!day || !month || !year || !hour || !minute) return null;
  const d = new Date(year, month - 1, day, hour, minute);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!schedule')) return;

    const args = message.content.split(' ').slice(1);
    const sub = args[0]?.toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // --- !schedule (list upcoming) ---
    if (!sub || sub === 'list') {
      const now = new Date();
      const upcoming = await Schedule.find({ date: { $gte: now } }).sort({ date: 1 }).limit(10);

      if (!upcoming.length) {
        return message.reply('Aucun match planifié pour le moment.');
      }

      const embed = new EmbedBuilder()
        .setTitle('📅 Calendrier des matchs')
        .setColor(0xFEE75C)
        .setTimestamp();

      for (const s of upcoming) {
        const teamsStr = s.teams.length ? s.teams.join(' vs ') : 'Équipes non précisées';
        const noteStr = s.note ? `\n📝 ${s.note}` : '';
        const tournoiStr = s.tournamentName ? `\n🏁 ${s.tournamentName}` : '';
        embed.addFields({
          name: `📆 ${formatDate(s.date)} à ${formatTime(s.date)}`,
          value: `🎮 ${teamsStr}${tournoiStr}${noteStr}\n\`ID: ${s._id}\``
        });
      }

      return message.channel.send({ embeds: [embed] });
    }

    // --- !schedule add <DD/MM/YYYY> <HH:MM> <equipe1,equipe2,...> [note] ---
    if (sub === 'add') {
      if (!isStaff) return message.reply('Staff uniquement');

      const dateStr = args[1];
      const timeStr = args[2];
      const teamsRaw = args[3];
      const note = args.slice(4).join(' ');

      if (!dateStr || !timeStr || !teamsRaw) {
        return message.reply(
          'Usage : `!schedule add <DD/MM/YYYY> <HH:MM> <equipe1,equipe2,...> [note]`\n' +
          'Exemple : `!schedule add 15/06/2025 20:00 TeamA,TeamB Match de poules`'
        );
      }

      const date = parseDateTime(dateStr, timeStr);
      if (!date) return message.reply('❌ Date ou heure invalide. Format attendu : `DD/MM/YYYY HH:MM`');
      if (date < new Date()) return message.reply('❌ La date est déjà passée.');

      const teams = teamsRaw.split(',').map(t => t.trim()).filter(Boolean);
      if (!teams.length) return message.reply('❌ Précise au moins une équipe.');

      const activeTournoi = await Tournament.findOne({ active: true });

      await Schedule.create({
        date,
        teams,
        note,
        tournamentName: activeTournoi?.name || '',
        createdBy: message.author.tag
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Match planifié')
        .setColor(0x57F287)
        .addFields(
          { name: '📆 Date', value: `${formatDate(date)} à ${formatTime(date)}`, inline: false },
          { name: '🎮 Équipes', value: teams.join(' vs '), inline: false }
        )
        .setFooter({ text: `Ajouté par ${message.author.tag}` })
        .setTimestamp();

      if (note) embed.addFields({ name: '📝 Note', value: note });
      if (activeTournoi) embed.addFields({ name: '🏁 Tournoi', value: activeTournoi.name });

      return message.channel.send({ embeds: [embed] });
    }

    // --- !schedule delete <id> ---
    if (sub === 'delete' || sub === 'del') {
      if (!isStaff) return message.reply('Staff uniquement');

      const id = args[1];
      if (!id) return message.reply('Usage : `!schedule delete <id>`');

      const deleted = await Schedule.findByIdAndDelete(id).catch(() => null);
      if (!deleted) return message.reply('❌ Aucun match trouvé avec cet ID.');

      return message.reply(`✅ Match du **${formatDate(deleted.date)} à ${formatTime(deleted.date)}** supprimé.`);
    }

    // --- !schedule clear (staff only, removes past events) ---
    if (sub === 'clear') {
      if (!isStaff) return message.reply('Staff uniquement');

      const result = await Schedule.deleteMany({ date: { $lt: new Date() } });
      return message.reply(`🗑️ **${result.deletedCount}** match(s) passé(s) supprimé(s).`);
    }

    message.reply(
      '**Commandes `!schedule` :**\n' +
      '`!schedule` — Liste les matchs à venir\n' +
      '`!schedule add <DD/MM/YYYY> <HH:MM> <equipe1,equipe2,...> [note]` — Ajouter *(staff)*\n' +
      '`!schedule delete <id>` — Supprimer un match *(staff)*\n' +
      '`!schedule clear` — Supprimer les matchs passés *(staff)*'
    );
  });
};
