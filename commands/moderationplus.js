const { EmbedBuilder } = require('discord.js');
const Warning  = require('../database/models/Warning');
const Sanction = require('../database/models/Sanction');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const MEDALS = ['🥇', '🥈', '🥉'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const content = message.content.trim();
    const args    = content.split(/\s+/);
    const cmd     = args[0].toLowerCase();

    // ── !casier @user ──────────────────────────────────────────────────────────
    if (cmd === '!casier') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const cd = checkCooldown(message.author.id, 'casier', 10);
      if (cd) return replyCooldown(message, cd, 'casier');

      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage : `!casier @utilisateur`');

      const guildId = message.guild.id;
      const userId  = target.id;

      const [warnings, sanctions] = await Promise.all([
        Warning.find({ targetId: userId }).sort({ createdAt: -1 }),
        Sanction.find({ guildId, userId }).sort({ createdAt: -1 }),
      ]);

      const warnLines = warnings.length
        ? warnings.map((w, i) => `\`${i + 1}\` ${fmtDate(w.createdAt)} — ${w.reason} *(par ${w.warnedBy})*`)
        : ['*Aucun avertissement*'];

      const sanctLines = sanctions.length
        ? sanctions.map((s, i) => {
            const typeEmoji = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨' }[s.type] ?? '🛡️';
            const durationStr = s.duration ? ` (${s.duration} min)` : '';
            return `\`${i + 1}\` ${typeEmoji} **${s.type.toUpperCase()}**${durationStr} — ${s.reason} *(${fmtDate(s.createdAt)})*`;
          })
        : ['*Aucune sanction*'];

      const totalScore = warnings.length + sanctions.filter(s => ['kick', 'ban'].includes(s.type)).length * 2;
      const riskLevel  = totalScore === 0 ? '🟢 Propre' : totalScore < 3 ? '🟡 Léger' : totalScore < 6 ? '🟠 Modéré' : '🔴 Grave';

      const embed = new EmbedBuilder()
        .setColor(totalScore === 0 ? 0x57F287 : totalScore < 3 ? 0xF1C40F : 0xED4245)
        .setAuthor({ name: `📋 Casier — ${target.user.username}`, iconURL: target.user.displayAvatarURL() })
        .addFields(
          { name: '⚠️ Avertissements', value: warnLines.slice(0, 10).join('\n'), inline: false },
          { name: '🛡️ Sanctions', value: sanctLines.slice(0, 10).join('\n'), inline: false },
          { name: '🔎 Niveau de risque', value: riskLevel, inline: true },
          { name: '📊 Total', value: `${warnings.length} warn(s) · ${sanctions.length} sanction(s)`, inline: true },
        )
        .setFooter({ text: `ID : ${userId}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !rapport ───────────────────────────────────────────────────────────────
    if (cmd === '!rapport') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const cd = checkCooldown(message.author.id, 'rapport', 30);
      if (cd) return replyCooldown(message, cd, 'rapport');

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const guildId = message.guild.id;

      const [recentWarns, recentSanctions, allSanctions] = await Promise.all([
        Warning.find({ createdAt: { $gte: since } }),
        Sanction.find({ guildId, createdAt: { $gte: since } }),
        Sanction.find({ guildId }),
      ]);

      // Répartition par type
      const byType = recentSanctions.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {});

      const typeLines = Object.entries(byType).length
        ? Object.entries(byType).map(([type, n]) => {
            const e = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨' }[type] ?? '🛡️';
            return `${e} **${type.toUpperCase()}** : ${n}`;
          }).join('\n')
        : '*Aucune sanction cette semaine*';

      // Membres les plus sanctionnés cette semaine
      const userCount = {};
      for (const s of recentSanctions) {
        userCount[s.userId] = (userCount[s.userId] || { tag: s.userTag, count: 0 });
        userCount[s.userId].count++;
      }
      const topThisWeek = Object.values(userCount).sort((a, b) => b.count - a.count).slice(0, 5);
      const topLines = topThisWeek.length
        ? topThisWeek.map((u, i) => `${MEDALS[i] ?? `${i + 1}.`} **${u.tag}** — ${u.count} sanction(s)`)
        : ['*Aucune*'];

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: '📊 Rapport de modération — 7 derniers jours', iconURL: client.user.displayAvatarURL() })
        .addFields(
          {
            name: '📈 Vue d\'ensemble',
            value: [
              `> Avertissements : **${recentWarns.length}**`,
              `> Sanctions : **${recentSanctions.length}**`,
              `> Total historique : **${allSanctions.length}**`,
            ].join('\n'),
            inline: false,
          },
          { name: '🛡️ Par type (cette semaine)', value: typeLines, inline: false },
          { name: '⚠️ Membres les plus sanctionnés', value: topLines.join('\n'), inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · Rapport généré automatiquement' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !topwarn ───────────────────────────────────────────────────────────────
    if (cmd === '!topavertissements' || cmd === '!topwarn') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const cd = checkCooldown(message.author.id, 'topwarn', 15);
      if (cd) return replyCooldown(message, cd, 'topwarn');

      const guildId = message.guild.id;
      const [topWarns, topSanctions] = await Promise.all([
        Warning.aggregate([
          { $group: { _id: { targetId: '$targetId', target: '$target' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Sanction.aggregate([
          { $match: { guildId } },
          { $group: { _id: { userId: '$userId', userTag: '$userTag' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
      ]);

      const warnLines = topWarns.length
        ? topWarns.map((w, i) => `${MEDALS[i] ?? `\`${i + 1}\``} **${w._id.target || `<@${w._id.targetId}>`}** — ${w.count} avertissement(s)`)
        : ['*Aucun avertissement enregistré*'];

      const sanctLines = topSanctions.length
        ? topSanctions.map((s, i) => `${MEDALS[i] ?? `\`${i + 1}\``} **${s._id.userTag}** — ${s.count} sanction(s)`)
        : ['*Aucune sanction enregistrée*'];

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: '⚠️ Top membres avertis/sanctionnés', iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '⚠️ Top avertissements', value: warnLines.join('\n'), inline: false },
          { name: '🛡️ Top sanctions', value: sanctLines.join('\n'), inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · Historique complet' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
