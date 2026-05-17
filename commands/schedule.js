const Schedule = require('../database/models/Schedule');
const ScheduleConfig = require('../database/models/ScheduleConfig');
const Tournament = require('../database/models/Tournament');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

function parseDateTime(dateStr, timeStr) {
  const [day, month, year] = dateStr.split('/');
  const [hour, minute] = timeStr.split(':');
  if (!day || !month || !year || !hour || !minute) return null;
  const d = new Date(year, month - 1, day, hour, minute);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}
function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function getConfig(guildId) {
  return ScheduleConfig.findOneAndUpdate(
    { guildId },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!schedule')) return;

    const args    = message.content.split(' ').slice(1);
    const sub     = args[0]?.toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // ─── !schedule / !schedule list ──────────────────────────────
    if (!sub || sub === 'list') {
      const now      = new Date();
      const upcoming = await Schedule.find({ date: { $gte: now } }).sort({ date: 1 }).limit(10);

      if (!upcoming.length)
        return message.reply('📅 Aucun match planifié pour le moment.');

      const embed = new EmbedBuilder()
        .setTitle('📅 Calendrier des matchs')
        .setColor(0xFEE75C)
        .setTimestamp();

      for (const s of upcoming) {
        const teamsStr   = s.teams.length ? s.teams.join(' vs ') : 'Équipes non précisées';
        const noteStr    = s.note           ? `\n📝 ${s.note}`           : '';
        const tournoiStr = s.tournamentName ? `\n🏁 ${s.tournamentName}` : '';
        const msLeft     = s.date - now;
        const hLeft      = Math.floor(msLeft / 3600000);
        const countdown  = hLeft < 1
          ? `⚡ Dans moins d'une heure`
          : hLeft < 24
            ? `⏰ Dans ${hLeft}h`
            : `📆 Dans ${Math.floor(hLeft / 24)}j`;

        embed.addFields({
          name:  `${formatDate(s.date)} à ${formatTime(s.date)} — ${countdown}`,
          value: `🎮 ${teamsStr}${tournoiStr}${noteStr}\n\`ID: ${s._id}\``
        });
      }

      const cfg = await getConfig(message.guild.id);
      if (cfg.channelId)
        embed.setFooter({ text: `Rappels activés dans #${client.channels.cache.get(cfg.channelId)?.name || cfg.channelId}` });

      return message.channel.send({ embeds: [embed] });
    }

    // ─── !schedule add <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note] ─
    if (sub === 'add') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const dateStr  = args[1];
      const timeStr  = args[2];
      const teamsRaw = args[3];
      const note     = args.slice(4).join(' ');

      if (!dateStr || !timeStr || !teamsRaw)
        return message.reply(
          '**Usage :** `!schedule add <DD/MM/YYYY> <HH:MM> <equipe1,equipe2,...> [note]`\n' +
          '**Exemple :** `!schedule add 15/06/2025 20:00 TeamA,TeamB Match de poules`'
        );

      const date = parseDateTime(dateStr, timeStr);
      if (!date)          return message.reply('❌ Date ou heure invalide. Format : `DD/MM/YYYY HH:MM`');
      if (date < new Date()) return message.reply('❌ La date est déjà passée.');

      const teams = teamsRaw.split(',').map(t => t.trim()).filter(Boolean);
      if (!teams.length)  return message.reply('❌ Précise au moins une équipe.');

      const activeTournoi = await Tournament.findOne({ active: true });

      await Schedule.create({
        date, teams, note,
        tournamentName: activeTournoi?.name || '',
        createdBy: message.author.tag
      });

      const embed = new EmbedBuilder()
        .setTitle('✅ Match planifié')
        .setColor(0x57F287)
        .addFields(
          { name: '📆 Date',    value: `${formatDate(date)} à ${formatTime(date)}`, inline: false },
          { name: '🎮 Équipes', value: teams.join(' vs '),                          inline: false }
        )
        .setFooter({ text: `Ajouté par ${message.author.tag}` })
        .setTimestamp();

      if (note)           embed.addFields({ name: '📝 Note',    value: note });
      if (activeTournoi)  embed.addFields({ name: '🏁 Tournoi', value: activeTournoi.name });

      logStaffAction(client, `📅 **Match planifié** — ${teams.join(' vs ')} | ${formatDate(date)} ${formatTime(date)} | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // ─── !schedule edit <id> <DD/MM/YYYY> <HH:MM> [eq1,eq2] [note] ──
    if (sub === 'edit') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const id      = args[1];
      const dateStr = args[2];
      const timeStr = args[3];

      if (!id || !dateStr || !timeStr)
        return message.reply('**Usage :** `!schedule edit <id> <DD/MM/YYYY> <HH:MM> [equipe1,equipe2] [note]`');

      const match = await Schedule.findById(id).catch(() => null);
      if (!match) return message.reply('❌ Match introuvable avec cet ID.');

      const date = parseDateTime(dateStr, timeStr);
      if (!date) return message.reply('❌ Date ou heure invalide.');

      match.date = date;
      if (args[4]) match.teams = args[4].split(',').map(t => t.trim()).filter(Boolean);
      if (args[5]) match.note  = args.slice(5).join(' ');
      // Reset reminders so they fire again with the new date
      match.reminded24h = false;
      match.reminded1h  = false;
      match.reminded15m = false;
      await match.save();

      logStaffAction(client, `✏️ **Match modifié** — ${match.teams.join(' vs ')} | ${formatDate(date)} ${formatTime(date)} | Par : ${message.author.tag}`);
      return message.reply(`✅ Match mis à jour : **${formatDate(date)} à ${formatTime(date)}**`);
    }

    // ─── !schedule delete <id> ────────────────────────────────────
    if (sub === 'delete' || sub === 'del') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const id = args[1];
      if (!id) return message.reply('Usage : `!schedule delete <id>`');

      const deleted = await Schedule.findByIdAndDelete(id).catch(() => null);
      if (!deleted) return message.reply('❌ Aucun match trouvé avec cet ID.');

      logStaffAction(client, `🗑️ **Match supprimé** — ${deleted.teams.join(' vs ')} | Par : ${message.author.tag}`);
      return message.reply(`✅ Match du **${formatDate(deleted.date)} à ${formatTime(deleted.date)}** supprimé.`);
    }

    // ─── !schedule clear ──────────────────────────────────────────
    if (sub === 'clear') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');
      const result = await Schedule.deleteMany({ date: { $lt: new Date() } });
      return message.reply(`🗑️ **${result.deletedCount}** match(s) passé(s) supprimé(s).`);
    }

    // ─── !schedule channel #salon ─────────────────────────────────
    if (sub === 'channel') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const target = message.mentions.channels.first() || (args[1] ? message.guild.channels.cache.get(args[1]) : null);
      if (!target) return message.reply('Usage : `!schedule channel #salon`');

      await ScheduleConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { channelId: target.id },
        { upsert: true }
      );

      logStaffAction(client, `📅 **Salon rappels calendrier** → <#${target.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Les rappels de matchs seront envoyés dans <#${target.id}>.\nRappels : **24h avant**, **1h avant**, **15 min avant**.`);
    }

    // ─── !schedule remind off/on ──────────────────────────────────
    if (sub === 'remind') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');
      const action = args[1]?.toLowerCase();
      const type   = args[2]?.toLowerCase(); // 24h | 1h | 15m | all

      if (!action || !['on', 'off'].includes(action))
        return message.reply('Usage : `!schedule remind <on|off> [24h|1h|15m]`\nOmets le type pour tout activer/désactiver.');

      const enabled = action === 'on';
      const cfg     = await getConfig(message.guild.id);

      if (!type || type === 'all') {
        cfg.remind24h = enabled;
        cfg.remind1h  = enabled;
        cfg.remind15m = enabled;
      } else if (type === '24h') cfg.remind24h = enabled;
      else if (type === '1h')   cfg.remind1h  = enabled;
      else if (type === '15m')  cfg.remind15m = enabled;
      else return message.reply('Type invalide. Utilise : `24h`, `1h`, `15m`, ou rien pour tout.');

      await cfg.save();
      const label = type && type !== 'all' ? `rappel ${type}` : 'tous les rappels';
      return message.reply(`✅ **${label}** ${enabled ? 'activé' : 'désactivé'}.`);
    }

    // ─── !schedule status ─────────────────────────────────────────
    if (sub === 'status') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const cfg = await getConfig(message.guild.id);
      const ch  = cfg.channelId ? `<#${cfg.channelId}>` : '*non configuré*';

      const embed = new EmbedBuilder()
        .setTitle('📅 Configuration — Calendrier')
        .setColor(0x5865F2)
        .addFields(
          { name: '📢 Salon des rappels', value: ch,                                       inline: false },
          { name: '⏰ Rappel 24h',        value: cfg.remind24h ? '✅ Activé' : '❌ Désactivé', inline: true },
          { name: '⏰ Rappel 1h',         value: cfg.remind1h  ? '✅ Activé' : '❌ Désactivé', inline: true },
          { name: '⏰ Rappel 15 min',     value: cfg.remind15m ? '✅ Activé' : '❌ Désactivé', inline: true },
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ─── Help ─────────────────────────────────────────────────────
    return message.reply([
      '**Commandes `!schedule` :**',
      '`!schedule` — Liste les matchs à venir',
      '`!schedule add <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note]` — Ajouter *(staff)*',
      '`!schedule edit <id> <DD/MM/YYYY> <HH:MM> [eq1,eq2] [note]` — Modifier *(staff)*',
      '`!schedule delete <id>` — Supprimer *(staff)*',
      '`!schedule clear` — Supprimer les matchs passés *(staff)*',
      '`!schedule channel #salon` — Définir le salon des rappels *(staff)*',
      '`!schedule remind <on|off> [24h|1h|15m]` — Gérer les rappels *(staff)*',
      '`!schedule status` — Voir la configuration *(staff)*',
    ].join('\n'));
  });
};
