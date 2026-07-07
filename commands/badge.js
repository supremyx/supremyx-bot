/**
 * !badge donner <@membre> <emoji> <nom> [description]  — Attribuer un badge (Staff)
 * !badge retirer <@membre> <nom>                       — Retirer un badge (Staff)
 * !badge liste [@membre]                               — Voir les badges d'un joueur ou tous
 * !badges                                              — Galerie des badges du serveur
 */
const { EmbedBuilder } = require('discord.js');
const PlayerBadge = require('../database/models/PlayerBadge');
const PlayerStat  = require('../database/models/PlayerStat');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const content = message.content.trim();
      const guildId = message.guild.id;

      // !badges — galerie serveur
      if (content === '!badges') {
        const all = await PlayerBadge.find({ guildId }).lean();
        if (!all.length) return message.reply('📭 Aucun badge distribué sur ce serveur pour le moment.');

        // Grouper par badge
        const grouped = {};
        for (const b of all) {
          const key = b.badgeName;
          if (!grouped[key]) grouped[key] = { emoji: b.emoji, desc: b.description, players: [] };
          grouped[key].players.push(b.displayName);
        }

        const lines = Object.entries(grouped).map(([name, g]) =>
          `${g.emoji} **${name}** — _${g.desc || 'Pas de description'}_\n   Joueurs : ${g.players.join(', ')}`
        ).join('\n\n');

        const embed = new EmbedBuilder()
          .setTitle(`🎖️ Galerie des badges — ${message.guild.name}`)
          .setDescription(lines.slice(0, 4000))
          .setColor(0xF1C40F)
          .setFooter({ text: `${all.length} badge(s) distribué(s) · ${Object.keys(grouped).length} type(s)` })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (!content.startsWith('!badge')) return;
      const parts = content.split(/\s+/);
      const sub = parts[1];

      // !badge liste [@membre]
      if (sub === 'liste') {
        const mention = message.mentions.members?.first();
        let targetName = null;
        if (mention) {
          targetName = mention.displayName || mention.user.username;
        } else if (parts[2]) {
          targetName = parts.slice(2).join(' ');
        }

        const query = targetName
          ? { guildId, displayName: { $regex: new RegExp(targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } }
          : { guildId };
        const badges = await PlayerBadge.find(query).sort({ awardedAt: -1 }).lean();

        if (!badges.length)
          return message.reply(targetName ? `📭 **${targetName}** n'a pas encore de badge.` : '📭 Aucun badge distribué.');

        // Grouper par joueur si pas de filtre
        if (!targetName) {
          const byPlayer = {};
          for (const b of badges) {
            if (!byPlayer[b.displayName]) byPlayer[b.displayName] = [];
            byPlayer[b.displayName].push(`${b.emoji} ${b.badgeName}`);
          }
          const lines = Object.entries(byPlayer).map(([p, bs]) => `**${p}** : ${bs.join(' · ')}`).join('\n');
          const embed = new EmbedBuilder()
            .setTitle('🎖️ Badges du serveur')
            .setDescription(lines.slice(0, 4000))
            .setColor(0xF1C40F)
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }

        const lines = badges.map(b => {
          const date = new Date(b.awardedAt).toLocaleDateString('fr-FR');
          return `${b.emoji} **${b.badgeName}** — _${b.description || 'Pas de description'}_ (${date})`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`🎖️ Badges de ${targetName}`)
          .setDescription(lines.slice(0, 4000))
          .setColor(0xF1C40F)
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // Commandes staff suivantes
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      // !badge donner <@membre|nom> <emoji> <nomBadge> [description...]
      if (sub === 'donner') {
        const member = message.mentions.members?.first();
        if (!member)
          return message.reply('Usage : `!badge donner @membre <emoji> <nomBadge> [description]`');

        const rest = content.replace(`!badge donner <@${member.id}>`, '')
                            .replace(`!badge donner <@!${member.id}>`, '').trim();
        const restParts = rest.split(/\s+/);
        const emoji = restParts[0] || '🏅';
        const badgeName = restParts[1];
        const description = restParts.slice(2).join(' ');

        if (!badgeName) return message.reply('Précise un nom de badge. Ex: `!badge donner @Joueur 🔥 KillStreak Meilleur chasseur de kills`');

        const displayName = member.displayName || member.user.username;
        const escapedDisplayName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const teamStat = await PlayerStat.findOne({ guildId, displayName: { $regex: new RegExp(`^${escapedDisplayName}$`, 'i') } }).lean();

        await PlayerBadge.create({
          guildId,
          displayName,
          teamName: teamStat?.teamName || '',
          badgeName,
          emoji,
          description,
          awardedBy: message.author.username,
        });

        const embed = new EmbedBuilder()
          .setTitle('🎖️ Badge attribué !')
          .setDescription(`${emoji} **${badgeName}** décerné à **${displayName}**`)
          .setColor(0x57F287)
          .addFields(
            { name: 'Description', value: description || '_Aucune_', inline: false },
            { name: 'Attribué par', value: message.author.username, inline: true },
          )
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // !badge retirer <@membre|nom> <nomBadge>
      if (sub === 'retirer') {
        const member = message.mentions.members?.first();
        if (!member)
          return message.reply('Usage : `!badge retirer @membre <nomBadge>`');

        const rest = content.replace(`!badge retirer <@${member.id}>`, '')
                            .replace(`!badge retirer <@!${member.id}>`, '').trim();
        const badgeName = rest;
        if (!badgeName) return message.reply('Précise le nom du badge à retirer.');

        const displayName = member.displayName || member.user.username;
        const escapedDisplayName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedBadgeName = badgeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const del = await PlayerBadge.findOneAndDelete({
          guildId,
          displayName: { $regex: new RegExp(`^${escapedDisplayName}$`, 'i') },
          badgeName:   { $regex: new RegExp(`^${escapedBadgeName}$`, 'i') },
        });

        if (!del) return message.reply(`❌ Badge **${badgeName}** introuvable pour **${displayName}**.`);
        return message.reply(`✅ Badge **${badgeName}** retiré à **${displayName}**.`);
      }

      return message.reply('Sous-commandes : `donner`, `retirer`, `liste`');

    } catch (err) {
      console.error('[badge] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
