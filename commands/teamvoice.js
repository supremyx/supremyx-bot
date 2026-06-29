/**
 * !teamvoice <équipe>           — Créer un salon vocal temporaire pour une équipe (Staff)
 * !teamvoice supprimer <équipe> — Supprimer le salon vocal de l'équipe (Staff)
 */
const { PermissionsBitField, ChannelType } = require('discord.js');
const Roster = require('../database/models/Roster');
const Team   = require('../database/models/Team');

const activeVoices = new Map(); // teamName → channelId

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!teamvoice')) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const content = message.content.trim();
      const parts   = content.split(/\s+/);
      const sub     = parts[1];

      if (sub === 'supprimer') {
        const teamName = parts.slice(2).join(' ');
        if (!teamName) return message.reply('Usage : `!teamvoice supprimer <équipe>`');

        const key = Object.keys(Object.fromEntries(activeVoices)).find(k => k.toLowerCase() === teamName.toLowerCase());
        const channelId = activeVoices.get(key || teamName);
        if (!channelId) return message.reply(`❌ Aucun salon vocal actif pour **${teamName}**.`);

        const ch = message.guild.channels.cache.get(channelId);
        if (ch) await ch.delete('Suppression manuelle par staff').catch(() => {});
        activeVoices.delete(key || teamName);
        return message.reply(`✅ Salon vocal de **${teamName}** supprimé.`);
      }

      const teamName = parts.slice(1).join(' ');
      if (!teamName) return message.reply('Usage : `!teamvoice <équipe>`');

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } }).lean();
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      // Vérifier si déjà existant
      const existingId = activeVoices.get(team.name);
      if (existingId) {
        const existing = message.guild.channels.cache.get(existingId);
        if (existing) return message.reply(`⚠️ Un salon vocal existe déjà pour **${team.name}** : <#${existingId}>`);
        activeVoices.delete(team.name);
      }

      // Récupérer le roster pour les permissions
      const roster = await Roster.findOne({ teamName: team.name }).lean();
      const memberNames = roster?.members?.map(m => m.userId).filter(Boolean) || [];

      // Trouver ou créer une catégorie "Équipes"
      let category = message.guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('équipe')
      ) || null;

      // Permissions : everyone deny, membres de l'équipe allow
      const permOverwrites = [
        { id: message.guild.id, deny: [PermissionsBitField.Flags.Connect] },
        { id: message.author.id, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.MoveMembers] },
      ];

      for (const uid of memberNames) {
        const member = message.guild.members.cache.get(uid) || await message.guild.members.fetch(uid).catch(() => null);
        if (member) {
          permOverwrites.push({ id: uid, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] });
        }
      }

      // Ajouter le rôle de l'équipe si défini
      if (team.roleId) {
        permOverwrites.push({ id: team.roleId, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] });
      }

      const voiceChannel = await message.guild.channels.create({
        name: `🔊 ${team.name}`,
        type: ChannelType.GuildVoice,
        parent: category?.id || null,
        permissionOverwrites: permOverwrites,
        reason: `Salon vocal temporaire créé par ${message.author.tag}`,
      });

      activeVoices.set(team.name, voiceChannel.id);

      // Auto-suppression après 3 heures
      setTimeout(async () => {
        const ch = message.guild.channels.cache.get(voiceChannel.id);
        if (ch) await ch.delete('Expiration automatique (3h)').catch(() => {});
        activeVoices.delete(team.name);
      }, 3 * 60 * 60 * 1000);

      return message.reply(`✅ Salon vocal <#${voiceChannel.id}> créé pour **${team.name}** — auto-suppression dans 3h.\n💡 Utilise \`!teamvoice supprimer ${team.name}\` pour le supprimer manuellement.`);

    } catch (err) {
      console.error('[teamvoice] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Vérifie que le bot a la permission de gérer les salons.').catch(() => {});
    }
  });
};
