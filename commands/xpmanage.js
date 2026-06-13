const { EmbedBuilder } = require('discord.js');
const XpEntry = require('../database/models/XpEntry');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

function xpToLevel(xp) { return Math.floor(Math.sqrt(xp / 50)); }
function xpForNextLevel(level) { return Math.pow(level + 1, 2) * 50; }

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const content = message.content.trim();
    const args    = content.split(/\s+/);
    const cmd     = args[0].toLowerCase();

    // ── !progression [@user] ───────────────────────────────────────────────────
    if (cmd === '!progression') {
      const cd = checkCooldown(message.author.id, 'progression', 10);
      if (cd) return replyCooldown(message, cd, 'progression');

      const target = message.mentions.members.first() ?? message.member;
      const guildId = message.guild.id;

      const entry = await XpEntry.findOne({ guildId, userId: target.id });
      if (!entry || entry.xp === 0) {
        return message.reply(`❌ **${target.displayName}** n'a pas encore d'XP enregistré sur ce serveur.`);
      }

      const xp       = entry.xp ?? 0;
      const level    = entry.level ?? xpToLevel(xp);
      const nextXp   = xpForNextLevel(level);
      const prevXp   = xpForNextLevel(level - 1);
      const progress = Math.min(Math.round(((xp - prevXp) / (nextXp - prevXp)) * 20), 20);
      const bar      = '█'.repeat(progress) + '░'.repeat(20 - progress);

      const xpNeeded = Math.max(0, nextXp - xp);
      const lastSeen = entry.lastXpAt
        ? new Date(entry.lastXpAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `📈 Progression XP — ${target.displayName}`, iconURL: target.user.displayAvatarURL() })
        .addFields(
          { name: '🏆 Niveau', value: `**${level}**`, inline: true },
          { name: '⭐ XP total', value: `**${xp.toLocaleString('fr-FR')}**`, inline: true },
          { name: '🎯 Prochain niveau', value: `**${xpNeeded.toLocaleString('fr-FR')}** XP restants`, inline: true },
          { name: '📊 Barre de progression', value: `\`${bar}\` ${xp - prevXp}/${nextXp - prevXp}`, inline: false },
          { name: '🕐 Dernière activité XP', value: lastSeen, inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · XP gagné en envoyant des messages' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !donnerxp @user <montant> ──────────────────────────────────────────────
    if (cmd === '!donnerxp') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage : `!donnerxp @utilisateur <montant>`');

      const amount = parseInt(args[2]);
      if (isNaN(amount) || amount <= 0) return message.reply('❌ Le montant doit être un entier positif.');
      if (amount > 100000) return message.reply('❌ Maximum 100 000 XP par don.');

      const guildId = message.guild.id;
      const entry   = await XpEntry.findOneAndUpdate(
        { guildId, userId: target.id },
        { $inc: { xp: amount }, username: target.user.username, lastXpAt: new Date() },
        { upsert: true, new: true }
      );

      const newLevel = xpToLevel(entry.xp);
      if (newLevel !== entry.level) {
        await XpEntry.updateOne({ guildId, userId: target.id }, { level: newLevel });
        entry.level = newLevel;
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: '⭐ XP attribué', iconURL: client.user.displayAvatarURL() })
        .setDescription(`**+${amount.toLocaleString('fr-FR')} XP** attribués à ${target}`)
        .addFields(
          { name: 'Nouveau total', value: `**${entry.xp.toLocaleString('fr-FR')}** XP · Niv. **${entry.level}**`, inline: true },
        )
        .setFooter({ text: `Attribué par ${message.author.username}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !retirerxp @user <montant> ─────────────────────────────────────────────
    if (cmd === '!retirerxp') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage : `!retirerxp @utilisateur <montant>`');

      const amount = parseInt(args[2]);
      if (isNaN(amount) || amount <= 0) return message.reply('❌ Le montant doit être un entier positif.');

      const guildId = message.guild.id;
      const entry   = await XpEntry.findOne({ guildId, userId: target.id });
      if (!entry) return message.reply(`❌ **${target.displayName}** n'a pas d'XP enregistré.`);

      const newXp    = Math.max(0, entry.xp - amount);
      const removed  = entry.xp - newXp;
      const newLevel = xpToLevel(newXp);

      await XpEntry.updateOne({ guildId, userId: target.id }, { xp: newXp, level: newLevel });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: '⭐ XP retiré', iconURL: client.user.displayAvatarURL() })
        .setDescription(`**-${removed.toLocaleString('fr-FR')} XP** retirés de ${target}`)
        .addFields(
          { name: 'Nouveau total', value: `**${newXp.toLocaleString('fr-FR')}** XP · Niv. **${newLevel}**`, inline: true },
        )
        .setFooter({ text: `Retiré par ${message.author.username}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
