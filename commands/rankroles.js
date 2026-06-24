const RankReward = require('../database/models/RankReward');
const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');
const { syncRanks } = require('../utils/syncRanks');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex } = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    const isStaff = message.member.permissions.has('Administrator');

    // --- !setrankreward <rang> @role [label] ---
    if (cmd === '!definitrecompense' || cmd === '!setrecompense') {
      if (!isStaff) return message.reply('Staff uniquement');

      const rank = parseInt(args[1]);
      const role = message.mentions.roles.first();
      const label = args.slice(3).join(' ').trim() || `Top ${rank}`;

      if (isNaN(rank) || rank < 1 || !role)
        return message.reply('Usage : `!definitrecompense <rang> @role [label]`\nExemple : `!definitrecompense 1 @Champion 🥇 Champion`');

      await RankReward.findOneAndUpdate(
        { rank },
        { rank, roleId: role.id, label },
        { upsert: true, new: true }
      );

      logStaffAction(client, `🏅 **Rank reward défini** — Rang ${rank} → @${role.name} | Par : ${message.author.tag}`);
      return message.reply(`✅ Rang **#${rank}** → rôle **${role.name}** (${label})\nUtilise \`!synchroniserrangs\` pour appliquer immédiatement.`);
    }

    // --- !linkteam <nom équipe> @role ---
    if (cmd === '!lierequipe') {
      if (!isStaff) return message.reply('Staff uniquement');

      const role = message.mentions.roles.first();
      const teamName = args.slice(1, message.mentions.roles.size ? -1 : undefined)
        .join(' ').replace(/<@&\d+>/g, '').trim();

      if (!teamName || !role)
        return message.reply('Usage : `!lierequipe <nom équipe> @role`\nExemple : `!lierequipe TeamA @TeamA`');

      const team = await Team.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } },
        { $set: { roleId: role.id } },
        { new: true }
      );
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable. Utilise \`!register\` d'abord.`);

      logStaffAction(client, `🔗 **Team liée** — \`${team.name}\` → @${role.name} | Par : ${message.author.tag}`);
      return message.reply(`✅ **${team.name}** est maintenant liée au rôle **${role.name}**.\nLes membres portant ce rôle recevront les récompenses de rang automatiquement.`);
    }

    // --- !rankrewards — afficher la configuration ---
    if (cmd === '!recompenses') {
      const [rewards, teams] = await Promise.all([
        RankReward.find().sort({ rank: 1 }),
        Team.find().sort({ points: -1 })
      ]);

      if (!rewards.length)
        return message.reply('Aucune récompense de rang configurée. Utilise `!definitrecompense <rang> @role`.');

      const embed = new EmbedBuilder()
        .setTitle('🏅 Récompenses de rang')
        .setColor(0xFEE75C)
        .setTimestamp();

      for (const r of rewards) {
        const teamAtRank = teams[r.rank - 1];
        const role = message.guild.roles.cache.get(r.roleId);
        embed.addFields({
          name: `#${r.rank} — ${r.label}`,
          value: `Rôle : ${role ? `@${role.name}` : '❌ Rôle introuvable'}\nÉquipe actuelle : **${teamAtRank?.name ?? '—'}**`
        });
      }

      return message.channel.send({ embeds: [embed] });
    }

    // --- !syncranks --- 
    if (cmd === '!synchroniserrangs' || cmd === '!syncrangs') {
      if (!isStaff) return message.reply('Staff uniquement');

      const waiting = await message.reply('⏳ Synchronisation des rôles en cours...');
      await syncRanks(message.guild);
      logStaffAction(client, `🔄 **Sync rangs** déclenché manuellement | Par : ${message.author.tag}`);
      return waiting.edit('✅ Rôles de rang synchronisés avec le classement actuel.');
    }

    // --- !delrankreward <rang> ---
    if (cmd === '!supprimerrecompense') {
      if (!isStaff) return message.reply('Staff uniquement');

      const rank = parseInt(args[1]);
      if (isNaN(rank)) return message.reply('Usage : `!supprimerrecompense <rang>`');

      const deleted = await RankReward.findOneAndDelete({ rank });
      if (!deleted) return message.reply(`❌ Aucune récompense configurée pour le rang #${rank}.`);

      logStaffAction(client, `🗑️ **Rank reward supprimé** — Rang ${rank} | Par : ${message.author.tag}`);
      return message.reply(`✅ Récompense du rang **#${rank}** supprimée.`);
    }
    } catch (err) {
      console.error('[rankroles] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
