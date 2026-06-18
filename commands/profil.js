/**
 * !profil [@membre]
 * Fiche complète d'un joueur : infos Discord, équipe, stats K/D, XP, warns, trophées.
 */
const { EmbedBuilder } = require('discord.js');
const XpEntry   = require('../database/models/XpEntry');
const Warning   = require('../database/models/Warning');
const Team      = require('../database/models/Team');
const PlayerStat = require('../database/models/PlayerStat');
const Achievement = require('../database/models/Achievement');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

function xpToLevel(xp) { return Math.floor(Math.sqrt(xp / 50)); }
function xpForNextLevel(level) { return Math.pow(level + 1, 2) * 50; }

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!profil')) return;

      const cd = checkCooldown(message.author.id, 'profil', 8);
      if (cd) return replyCooldown(message, cd, 'profil');

      const target = message.mentions.members.first() || message.member;
      const user   = target.user;

      // ── Requêtes en parallèle ──────────────────────────────────────────────
      const [xpEntry, warns, allTeams, playerStat, achievements] = await Promise.all([
        XpEntry.findOne({ guildId: message.guild.id, userId: user.id }),
        Warning.find({ guildId: message.guild.id, userId: user.id }),
        Team.find({ guildId: message.guild.id }),
        PlayerStat.findOne({ guildId: message.guild.id, tag: user.tag }),
        Achievement?.find?.({ guildId: message.guild.id, teamName: { $exists: false } }) ?? Promise.resolve([]),
      ]);

      // ── Niveau XP ─────────────────────────────────────────────────────────
      const xp      = xpEntry?.xp    || 0;
      const level   = xpEntry?.level || 0;
      const nextXP  = xpForNextLevel(level);
      const pct     = Math.min(Math.round((xp / nextXP) * 10), 10);
      const bar     = '█'.repeat(pct) + '░'.repeat(10 - pct);

      // ── Équipe ────────────────────────────────────────────────────────────
      const team = allTeams.find(t =>
        t.members?.some(m => m.userId === user.id || m.userTag === user.tag)
      );

      // ── Stats joueur ──────────────────────────────────────────────────────
      const kills   = playerStat?.kills   || 0;
      const matcheP = playerStat?.matches || 0;
      const kd      = matcheP > 0 ? (kills / matcheP).toFixed(2) : '—';

      // ── Warns ─────────────────────────────────────────────────────────────
      const warnCount = warns.length;

      // ── Infos Discord ─────────────────────────────────────────────────────
      const joinedAt = target.joinedAt
        ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:D>`
        : '—';
      const createdAt = `<t:${Math.floor(user.createdAt.getTime() / 1000)}:D>`;

      const embed = new EmbedBuilder()
        .setAuthor({ name: `👤 Profil — ${target.displayName}`, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setColor(target.displayHexColor !== '#000000' ? target.displayHexColor : 0x5865F2)
        .addFields(
          {
            name: '🎮 Identité',
            value: [
              `> **Tag :** ${user.tag}`,
              `> **Rejoint le :** ${joinedAt}`,
              `> **Compte créé :** ${createdAt}`,
            ].join('\n'),
            inline: false
          },
          {
            name: '🏷️ Équipe',
            value: team
              ? `> **${team.name}** — ${team.points} pts · ${team.kills} kills`
              : '> *Aucune équipe enregistrée*',
            inline: false
          },
          {
            name: '📈 Niveau XP',
            value: [
              `> Niveau **${level}** · **${xp}** XP`,
              `> \`${bar}\` ${xp}/${nextXP}`,
            ].join('\n'),
            inline: false
          },
          {
            name: '🎯 Stats matchs',
            value: matcheP > 0
              ? `> **${kills}** kills · **${matcheP}** matchs · K/Match **${kd}**`
              : '> *Aucun match individuel enregistré*',
            inline: false
          },
          {
            name: '⚠️ Modération',
            value: warnCount === 0
              ? '> ✅ Aucun avertissement'
              : `> 🔴 **${warnCount}** avertissement(s) actif(s)`,
            inline: false
          }
        )
        .setFooter({ text: `SUPREMYX CI • ID: ${user.id}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[profil]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
