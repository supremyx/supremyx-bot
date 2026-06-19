/**
 * !absence
 *   !absence declarer [raison]       — déclarer son absence au prochain match
 *   !absence annuler                 — annuler son absence
 *   !absence liste <équipe>          — voir les absences d'une équipe
 *   !absence toutes                  — toutes les absences actives (staff)
 *   !absence effacer @membre         — effacer l'absence de quelqu'un (staff)
 */
const { EmbedBuilder } = require('discord.js');
const Absence = require('../database/models/Absence');
const Roster  = require('../database/models/Roster');
const Team    = require('../database/models/Team');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex }    = require('../utils/lib');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild)                           return;
      if (message.author.bot)                       return;
      if (!message.content.startsWith('!absence'))  return;
      if (!message.member)                          return;

      const content = message.content.trim();
      const args    = content.slice('!absence'.length).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const isStaff = message.member.permissions.has('Administrator');

      // ── Aide ──────────────────────────────────────────────────────────────
      if (!sub) {
        return message.reply(
          '**Commandes `!absence` :**\n' +
          '`!absence declarer [raison]` — Déclarer son absence au prochain match\n' +
          '`!absence annuler` — Annuler son absence\n' +
          '`!absence liste <équipe>` — Voir les absences d\'une équipe\n' +
          '`!absence toutes` — Toutes les absences actives *(staff)*\n' +
          '`!absence effacer @membre` — Effacer l\'absence de quelqu\'un *(staff)*'
        );
      }

      // ── !absence declarer [raison] ────────────────────────────────────────
      if (sub === 'declarer' || sub === 'déclarer') {
        const raison = args.slice(1).join(' ').trim() || 'Non précisée';

        // Trouver l'équipe du joueur via Roster
        const rosters = await Roster.find({ guildId: message.guild.id });
        const myRoster = rosters.find(r => r.members?.some(m => m.userId === message.author.id));
        const teamName  = myRoster?.teamName || '';

        await Absence.findOneAndUpdate(
          { guildId: message.guild.id, userId: message.author.id },
          {
            guildId:  message.guild.id,
            userId:   message.author.id,
            userTag:  message.author.tag,
            teamName,
            raison,
            active:   true
          },
          { upsert: true, new: true }
        );

        const teamInfo = teamName ? ` *(équipe : **${teamName}**)* ` : ' ';
        return message.reply(
          `⚠️ Ton absence${teamInfo}a été enregistrée.\n` +
          `> **Raison :** ${raison}\n` +
          'Tape `!absence annuler` pour annuler.'
        );
      }

      // ── !absence annuler ─────────────────────────────────────────────────
      if (sub === 'annuler') {
        const existing = await Absence.findOneAndUpdate(
          { guildId: message.guild.id, userId: message.author.id, active: true },
          { active: false },
          { new: true }
        );

        if (!existing) return message.reply('❌ Tu n\'as aucune absence active.');
        return message.reply('✅ Ton absence a été annulée.');
      }

      // ── !absence liste <équipe> ───────────────────────────────────────────
      if (sub === 'liste') {
        const teamName = args.slice(1).join(' ').trim();
        if (!teamName) return message.reply('Usage : `!absence liste <équipe>`');

        const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } });
        if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

        const absences = await Absence.find({ guildId: message.guild.id, teamName: team.name, active: true });

        const embed = new EmbedBuilder()
          .setTitle(`⚠️ Absences — ${team.name}`)
          .setColor(0xFEE75C)
          .setTimestamp();

        if (!absences.length) {
          embed.setDescription('✅ Aucune absence déclarée pour cette équipe.');
        } else {
          embed.setDescription(
            absences.map(a => {
              const when = `<t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:R>`;
              return `⚠️ <@${a.userId}> — *${a.raison}* (déclaré ${when})`;
            }).join('\n')
          );
        }

        return message.channel.send({ embeds: [embed] });
      }

      // ── !absence toutes (staff) ───────────────────────────────────────────
      if (sub === 'toutes') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');

        const absences = await Absence.find({ guildId: message.guild.id, active: true }).sort({ teamName: 1 });

        if (!absences.length) return message.reply('✅ Aucune absence déclarée sur ce serveur.');

        const embed = new EmbedBuilder()
          .setTitle(`⚠️ Toutes les absences actives — ${absences.length}`)
          .setColor(0xED4245)
          .setDescription(
            absences.map(a => {
              const team = a.teamName ? `**${a.teamName}**` : '*Sans équipe*';
              const when = `<t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:R>`;
              return `• <@${a.userId}> (${team}) — *${a.raison}* — ${when}`;
            }).join('\n')
          )
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // ── !absence effacer @membre (staff) ─────────────────────────────────
      if (sub === 'effacer') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');

        const target = message.mentions.users.first();
        if (!target) return message.reply('Usage : `!absence effacer @membre`');

        const deleted = await Absence.findOneAndUpdate(
          { guildId: message.guild.id, userId: target.id, active: true },
          { active: false },
          { new: true }
        );

        if (!deleted) return message.reply(`❌ **${target.username}** n'a pas d'absence active.`);

        logStaffAction(client, `⚠️ **Absence effacée** — \`${target.tag}\` | Par : ${message.author.tag}`);
        return message.reply(`✅ Absence de **${target.username}** effacée.`);
      }

      return message.reply(
        '**Commandes `!absence` :**\n' +
        '`!absence declarer [raison]` — Déclarer son absence\n' +
        '`!absence annuler` — Annuler son absence\n' +
        '`!absence liste <équipe>` — Voir les absences d\'une équipe\n' +
        '`!absence toutes` — Toutes les absences *(staff)*\n' +
        '`!absence effacer @membre` — Effacer une absence *(staff)*'
      );

    } catch (err) {
      console.error('[absence]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
