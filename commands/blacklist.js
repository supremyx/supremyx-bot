const Blacklist = require('../database/models/Blacklist');
const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!content.startsWith('!listenoiree')) return;
    if (!message.guild) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    // --- !listenoiree ajouter <cible> | <raison> ---
    if (sub === 'ajouter') {
      if (!isStaff) return message.reply('Staff uniquement');

      const raw = content.slice('!listenoiree ajouter'.length).trim();
      const pipeIdx = raw.indexOf('|');
      const target = (pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw).trim();
      const reason = (pipeIdx >= 0 ? raw.slice(pipeIdx + 1) : '').trim() || 'Aucune raison précisée';

      if (!target) return message.reply('Usage : `!listenoiree ajouter <équipe ou joueur> | <raison>`');

      const existing = await Blacklist.findOne({ target: { $regex: new RegExp(`^${target}$`, 'i') } });
      if (existing) return message.reply(`⚠️ **${target}** est déjà dans la blacklist.`);

      await Blacklist.create({ target, reason, addedBy: message.author.tag });

      const embed = new EmbedBuilder()
        .setTitle('🚫 Ajouté à la blacklist')
        .setColor(0xED4245)
        .addFields(
          { name: '🎯 Cible', value: target, inline: true },
          { name: '📝 Raison', value: reason }
        )
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();

      logStaffAction(client, `🚫 **Blacklist** — \`${target}\` ajouté | Raison : ${reason} | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // --- !listenoiree retirer <cible> ---
    if (sub === 'retirer' || sub === 'supprimer') {
      if (!isStaff) return message.reply('Staff uniquement');

      const target = args.slice(2).join(' ').trim();
      if (!target) return message.reply('Usage : `!listenoiree retirer <équipe ou joueur>`');

      const deleted = await Blacklist.findOneAndDelete({ target: { $regex: new RegExp(`^${target}$`, 'i') } });
      if (!deleted) return message.reply(`❌ **${target}** n'est pas dans la blacklist.`);

      logStaffAction(client, `✅ **Blacklist retirée** — \`${target}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ **${deleted.target}** retiré de la blacklist.`);
    }

    // --- !listenoiree liste ---
    if (!sub || sub === 'liste') {
      const entries = await Blacklist.find().sort({ createdAt: -1 });
      if (!entries.length) return message.reply('✅ La blacklist est vide.');

      const embed = new EmbedBuilder()
        .setTitle(`🚫 Blacklist — ${entries.length} entrée(s)`)
        .setColor(0xED4245)
        .setTimestamp();

      for (const e of entries.slice(0, 15)) {
        const date = new Date(e.createdAt).toLocaleDateString('fr-FR');
        embed.addFields({
          name: e.target,
          value: `📝 ${e.reason}\n👮 ${e.addedBy} • ${date}`
        });
      }

      if (entries.length > 15) embed.setFooter({ text: `Affichage de 15 sur ${entries.length}` });
      return message.channel.send({ embeds: [embed] });
    }

    // --- !listenoiree verifier <cible> ---
    if (sub === 'verifier') {
      const target = args.slice(2).join(' ').trim();
      if (!target) return message.reply('Usage : `!listenoiree verifier <équipe ou joueur>`');

      const entry = await Blacklist.findOne({ target: { $regex: new RegExp(`^${target}$`, 'i') } });
      if (!entry) return message.reply(`✅ **${target}** n'est pas dans la blacklist.`);

      const embed = new EmbedBuilder()
        .setTitle('🚫 Présent dans la blacklist')
        .setColor(0xED4245)
        .addFields(
          { name: '🎯 Cible', value: entry.target, inline: true },
          { name: '👮 Ajouté par', value: entry.addedBy, inline: true },
          { name: '📝 Raison', value: entry.reason },
          { name: '📅 Date', value: new Date(entry.createdAt).toLocaleDateString('fr-FR') }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    message.reply(
      '**Commandes `!listenoiree` :**\n' +
      '`!listenoiree add <cible> | <raison>` — Ajouter *(staff)*\n' +
      '`!listenoiree remove <cible>` — Retirer *(staff)*\n' +
      '`!listenoiree list` — Voir toute la blacklist\n' +
      '`!listenoiree check <cible>` — Vérifier une cible'
    );
    } catch (err) {
      console.error('[blacklist] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
