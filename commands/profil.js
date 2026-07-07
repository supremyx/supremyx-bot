/**
 * !profil [@membre]
 * Fiche complète d'un joueur : infos Discord, équipe, stats K/D, XP, warns.
 */
const { EmbedBuilder } = require('discord.js');
const XpEntry     = require('../database/models/XpEntry');
const Warning     = require('../database/models/Warning');
const Roster      = require('../database/models/Roster');
const PlayerStat  = require('../database/models/PlayerStat');
const PlayerBadge = require('../database/models/PlayerBadge');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');
const { escapeRegex } = require('../utils/lib');

function xpToLevel(xp)         { return Math.floor(Math.sqrt(xp / 50)); }
function xpForNextLevel(level)  { return Math.pow(level + 1, 2) * 50; }

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild)                           return;
      if (message.author.bot)                       return;
      if (!message.content.startsWith('!profil'))   return;

      const cd = checkCooldown(message.author.id, 'profil', 8);
      if (cd) return replyCooldown(message, cd, 'profil');

      const target = message.mentions.members.first() || message.member;
      const user   = target.user;

      // ── Requêtes en parallèle ──────────────────────────────────────────────
      const displayName = target.displayName || user.username;
      const [xpEntry, warns, rosters, playerStat, badges] = await Promise.all([
        XpEntry.findOne({ guildId: message.guild.id, userId: user.id }),
        Warning.find({ guildId: message.guild.id, userId: user.id }),
        Roster.find({ guildId: message.guild.id }),
        PlayerStat.findOne({ guildId: message.guild.id, tag: user.tag }),
        PlayerBadge.find({ guildId: message.guild.id, displayName: { $regex: new RegExp(`^${escapeRegex(displayName)}$`, 'i') } }).lean(),
      ]);

      // ── Équipe via Roster ──────────────────────────────────────────────────
      const memberRoster = rosters.find(r =>
        r.members?.some(m => m.userId === user.id)
      );
      const memberEntry = memberRoster?.members?.find(m => m.userId === user.id);

      // ── Niveau XP ─────────────────────────────────────────────────────────
      const xp     = xpEntry?.xp    || 0;
      const level  = xpEntry?.level || 0;
      const nextXP = xpForNextLevel(level);
      const pct    = Math.min(Math.round((xp / nextXP) * 10), 10);
      const bar    = '█'.repeat(pct) + '░'.repeat(10 - pct);

      // ── Stats joueur ──────────────────────────────────────────────────────
      const kills   = playerStat?.kills   || 0;
      const matches = playerStat?.matches || 0;
      const kd      = matches > 0 ? (kills / matches).toFixed(2) : '—';

      // ── Warns ─────────────────────────────────────────────────────────────
      const warnCount = warns.length;

      // ── Infos Discord ─────────────────────────────────────────────────────
      const joinedTs  = target.joinedAt
        ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:D>`
        : '—';
      const createdTs = `<t:${Math.floor(user.createdAt.getTime() / 1000)}:D>`;

      const embed = new EmbedBuilder()
        .setAuthor({ name: `👤 Profil — ${target.displayName}`, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setColor(
          target.displayHexColor && target.displayHexColor !== '#000000'
            ? target.displayHexColor
            : 0x5865F2
        )
        .addFields(
          {
            name: '🎮 Identité',
            value: [
              `> **Tag :** ${user.tag}`,
              `> **Rejoint le :** ${joinedTs}`,
              `> **Compte créé :** ${createdTs}`,
            ].join('\n'),
            inline: false
          },
          {
            name: '🏷️ Équipe',
            value: memberRoster
              ? `> **${memberRoster.teamName}** — Rôle : **${memberEntry?.role || '—'}**`
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
            value: matches > 0
              ? `> **${kills}** kills · **${matches}** matchs · K/Match **${kd}**`
              : '> *Aucun match individuel enregistré*',
            inline: false
          },
          {
            name: '⚠️ Modération',
            value: warnCount === 0
              ? '> ✅ Aucun avertissement'
              : `> 🔴 **${warnCount}** avertissement(s)`,
            inline: false
          },
          ...(badges.length ? [{
            name: `🎖️ Badges (${badges.length})`,
            value: badges.map(b => `${b.emoji} **${b.badgeName}**${b.description ? ` — _${b.description}_` : ''}`).join('\n'),
            inline: false,
          }] : [])
        )
        .setFooter({ text: `SUPREMYX CI • ID : ${user.id}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[profil]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
