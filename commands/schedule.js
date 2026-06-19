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
    if (!message.content.startsWith('!calendrier')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const args    = message.content.split(' ').slice(1);
    const sub     = args[0]?.toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // ─── !calendrier / !calendrier liste ─────────────────────────
    if (!sub || sub === 'liste') {
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

    // ─── !calendrier ajouter <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note] ─
    if (sub === 'ajouter') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const dateStr  = args[1];
      const timeStr  = args[2];
      const teamsRaw = args[3];
      const note     = args.slice(4).join(' ');

      if (!dateStr || !timeStr || !teamsRaw)
        return message.reply(
          '**Usage :** `!calendrier ajouter <DD/MM/YYYY> <HH:MM> <equipe1,equipe2,...> [note]`\n' +
          '**Exemple :** `!calendrier ajouter 15/06/2025 20:00 TeamA,TeamB Match de poules`'
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

    // ─── !calendrier modifier <id> <DD/MM/YYYY> <HH:MM> [eq1,eq2] [note] ──
    if (sub === 'modifier') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const id      = args[1];
      const dateStr = args[2];
      const timeStr = args[3];

      if (!id || !dateStr || !timeStr)
        return message.reply('**Usage :** `!calendrier modifier <id> <DD/MM/YYYY> <HH:MM> [equipe1,equipe2] [note]`');

      const match = await Schedule.findById(id).catch(() => null);
      if (!match) return message.reply('❌ Match introuvable avec cet ID.');

      const date = parseDateTime(dateStr, timeStr);
      if (!date) return message.reply('❌ Date ou heure invalide.');

      match.date = date;
      if (args[4]) match.teams = args[4].split(',').map(t => t.trim()).filter(Boolean);
      if (args[5]) match.note  = args.slice(5).join(' ');
      match.reminded24h = false;
      match.reminded1h  = false;
      match.reminded15m = false;
      await match.save();

      logStaffAction(client, `✏️ **Match modifié** — ${match.teams.join(' vs ')} | ${formatDate(date)} ${formatTime(date)} | Par : ${message.author.tag}`);
      return message.reply(`✅ Match mis à jour : **${formatDate(date)} à ${formatTime(date)}**`);
    }

    // ─── !calendrier supprimer <id> ──────────────────────────────
    if (sub === 'supprimer') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const id = args[1];
      if (!id) return message.reply('Usage : `!calendrier supprimer <id>`');

      const deleted = await Schedule.findByIdAndDelete(id).catch(() => null);
      if (!deleted) return message.reply('❌ Aucun match trouvé avec cet ID.');

      logStaffAction(client, `🗑️ **Match supprimé** — ${deleted.teams.join(' vs ')} | Par : ${message.author.tag}`);
      return message.reply(`✅ Match du **${formatDate(deleted.date)} à ${formatTime(deleted.date)}** supprimé.`);
    }

    // ─── !calendrier vider ────────────────────────────────────────
    if (sub === 'vider') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');
      const result = await Schedule.deleteMany({ date: { $lt: new Date() } });
      return message.reply(`🗑️ **${result.deletedCount}** match(s) passé(s) supprimé(s).`);
    }

    // ─── !calendrier salon #salon ─────────────────────────────────
    if (sub === 'salon') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const target = message.mentions.channels.first() || (args[1] ? message.guild.channels.cache.get(args[1]) : null);
      if (!target) return message.reply('Usage : `!calendrier salon #salon`');

      await ScheduleConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { channelId: target.id },
        { upsert: true }
      );

      logStaffAction(client, `📅 **Salon rappels calendrier** → <#${target.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Les rappels de matchs seront envoyés dans <#${target.id}>.\nRappels : **24h avant**, **1h avant**, **15 min avant**.`);
    }

    // ─── !calendrier rappel <activer|desactiver> [24h|1h|15m] ────
    if (sub === 'rappel') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');
      const action = args[1]?.toLowerCase();
      const type   = args[2]?.toLowerCase();

      if (!action || !['activer', 'desactiver'].includes(action))
        return message.reply('Usage : `!calendrier rappel <activer|desactiver> [24h|1h|15m]`\nOmets le type pour tout activer/désactiver.');

      const enabled = action === 'activer';
      const cfg     = await getConfig(message.guild.id);

      if (!type || type === 'tout') {
        cfg.remind24h = enabled;
        cfg.remind1h  = enabled;
        cfg.remind15m = enabled;
      } else if (type === '24h') cfg.remind24h = enabled;
      else if (type === '1h')   cfg.remind1h  = enabled;
      else if (type === '15m')  cfg.remind15m = enabled;
      else return message.reply('Type invalide. Utilise : `24h`, `1h`, `15m`, ou rien pour tout.');

      await cfg.save();
      const label = type && type !== 'tout' ? `rappel ${type}` : 'tous les rappels';
      return message.reply(`✅ **${label}** ${enabled ? 'activé' : 'désactivé'}.`);
    }

    // ─── !calendrier statut ───────────────────────────────────────
    if (sub === 'statut') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const cfg = await getConfig(message.guild.id);
      const ch  = cfg.channelId ? `<#${cfg.channelId}>` : '*non configuré*';

      const embed = new EmbedBuilder()
        .setTitle('📅 Configuration — Calendrier')
        .setColor(0x5865F2)
        .addFields(
          { name: '📢 Salon des rappels', value: ch,                                            inline: false },
          { name: '⏰ Rappel 24h',        value: cfg.remind24h ? '✅ Activé' : '❌ Désactivé', inline: true  },
          { name: '⏰ Rappel 1h',         value: cfg.remind1h  ? '✅ Activé' : '❌ Désactivé', inline: true  },
          { name: '⏰ Rappel 15 min',     value: cfg.remind15m ? '✅ Activé' : '❌ Désactivé', inline: true  },
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ─── !calendrier prochain ─────────────────────────────────────
    if (sub === 'prochain') {
      const now  = new Date();
      const next = await Schedule.findOne({ date: { $gte: now } }).sort({ date: 1 });
      if (!next) return message.reply('📅 Aucun match planifié prochainement.');

      const teamsStr = next.teams.length ? next.teams.join(' vs ') : 'Équipes non précisées';
      const msLeft   = next.date - now;
      const hLeft    = Math.floor(msLeft / 3600000);
      const countdown = hLeft < 1
        ? '⚡ Dans moins d\'une heure'
        : hLeft < 24 ? `⏰ Dans **${hLeft}h**` : `📆 Dans **${Math.floor(hLeft / 24)}j**`;

      const embed = new EmbedBuilder()
        .setTitle('📅 Prochain match')
        .setColor(0xFEE75C)
        .addFields(
          { name: '📆 Date',    value: `${formatDate(next.date)} à **${formatTime(next.date)}**`, inline: false },
          { name: '🎮 Équipes', value: teamsStr,  inline: true },
          { name: '⏱️ Compte à rebours', value: countdown, inline: true }
        );

      if (next.note)           embed.addFields({ name: '📝 Note',    value: next.note,             inline: false });
      if (next.tournamentName) embed.addFields({ name: '🏁 Tournoi', value: next.tournamentName,   inline: false });
      embed.setFooter({ text: `ID : ${next._id}` }).setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ─── !calendrier equipe <nom> ─────────────────────────────────
    if (sub === 'equipe' || sub === 'équipe') {
      const teamName = args.slice(1).join(' ').trim();
      if (!teamName) return message.reply('Usage : `!calendrier equipe <nom>`');

      const now      = new Date();
      const allNext  = await Schedule.find({ date: { $gte: now } }).sort({ date: 1 });
      const matches  = allNext.filter(s =>
        s.teams.some(t => t.toLowerCase().includes(teamName.toLowerCase()))
      );

      if (!matches.length)
        return message.reply(`📅 Aucun match à venir pour **${teamName}**.`);

      const embed = new EmbedBuilder()
        .setTitle(`📅 Matchs à venir — ${teamName}`)
        .setColor(0xFEE75C)
        .setTimestamp();

      for (const s of matches.slice(0, 8)) {
        const teamsStr = s.teams.join(' vs ');
        const note     = s.note ? `\n📝 ${s.note}` : '';
        embed.addFields({
          name:  `${formatDate(s.date)} à ${formatTime(s.date)}`,
          value: `🎮 ${teamsStr}${note}\n\`ID: ${s._id}\``
        });
      }

      return message.channel.send({ embeds: [embed] });
    }

    // ─── Aide ─────────────────────────────────────────────────────
    return message.reply([
      '**Commandes `!calendrier` :**',
      '`!calendrier` — Liste les matchs à venir',
      '`!calendrier ajouter <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note]` — Ajouter *(staff)*',
      '`!calendrier modifier <id> <DD/MM/YYYY> <HH:MM> [eq1,eq2] [note]` — Modifier *(staff)*',
      '`!calendrier supprimer <id>` — Supprimer un match *(staff)*',
      '`!calendrier vider` — Supprimer les matchs passés *(staff)*',
      '`!calendrier salon #salon` — Définir le salon des rappels *(staff)*',
      '`!calendrier rappel <activer|desactiver> [24h|1h|15m]` — Gérer les rappels *(staff)*',
      '`!calendrier statut` — Voir la configuration *(staff)*',
      '`!calendrier prochain` — Voir le prochain match uniquement',
      '`!calendrier equipe <nom>` — Matchs à venir d\'une équipe',
    ].join('\n'));
  });
};
