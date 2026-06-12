const { EmbedBuilder } = require('discord.js');
const Roster = require('../database/models/Roster');
const Team = require('../database/models/Team');
const { logStaffAction } = require('../utils/staffLog');

const VALID_ROLES = ['IGL', 'Fragger', 'Support', 'Sniper', 'Entry', 'Flex', 'Coach', 'Remplaçant'];

const ROLE_ICONS = {
  IGL: '🎯',
  Fragger: '💥',
  Support: '🛡️',
  Sniper: '🔭',
  Entry: '🚪',
  Flex: '🔄',
  Coach: '📋',
  'Remplaçant': '🔁'
};

function normalizeRole(str) {
  if (!str) return null;
  const lower = str.toLowerCase();
  return VALID_ROLES.find(r => r.toLowerCase() === lower) || null;
}

async function getRoster(guildId, teamName) {
  return Roster.findOne({ guildId, teamName: { $regex: new RegExp(`^${teamName}$`, 'i') } });
}

function buildRosterEmbed(roster, teamName) {
  const embed = new EmbedBuilder()
    .setTitle(`👥 Roster — ${teamName}`)
    .setColor(0x5865F2)
    .setTimestamp();

  if (!roster || !roster.members.length) {
    embed.setDescription('*Aucun membre dans ce roster pour l\'instant.*');
    return embed;
  }

  const byRole = {};
  for (const m of roster.members) {
    if (!byRole[m.role]) byRole[m.role] = [];
    byRole[m.role].push(m);
  }

  const lines = [];
  for (const role of VALID_ROLES) {
    if (!byRole[role]) continue;
    for (const m of byRole[role]) {
      const mention = m.userId ? `<@${m.userId}>` : `**${m.displayName}**`;
      const note = m.note ? ` — *${m.note}*` : '';
      const since = `<t:${Math.floor(new Date(m.joinedAt).getTime() / 1000)}:R>`;
      lines.push(`${ROLE_ICONS[role]} **${role}** — ${mention}${note} *(ajouté ${since})*`);
    }
  }

  embed.setDescription(lines.join('\n'));
  embed.setFooter({ text: `${roster.members.length} membre(s) • Mis à jour` });
  return embed;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!content.startsWith('!liste')) return;
    if (!message.guild) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.slice('!liste'.length).trim().split(/\s+/);
    const sub = args[0]?.toLowerCase();

    // --- !liste <équipe> — afficher le roster ---
    if (!sub || (!['ajouter', 'retirer', 'role', 'note', 'vider', 'liste'].includes(sub) && sub)) {
      const teamName = args.join(' ').trim();
      if (!teamName) {
        return message.reply(
          '**Usage :**\n' +
          '`!liste <équipe>` — Afficher le roster\n' +
          '`!liste ajouter <équipe> @user <rôle> [note]` — Ajouter *(staff)*\n' +
          '`!liste retirer <équipe> @user` — Retirer *(staff)*\n' +
          '`!liste role <équipe> @user <rôle>` — Changer le rôle *(staff)*\n' +
          '`!liste note <équipe> @user <note>` — Ajouter une note *(staff)*\n' +
          '`!liste vider <équipe>` — Vider le roster *(staff)*\n' +
          '`!liste liste` — Tous les rosters enregistrés\n\n' +
          `**Rôles disponibles :** ${VALID_ROLES.join(', ')}`
        );
      }

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const roster = await getRoster(message.guild.id, team.name);
      const embed = buildRosterEmbed(roster, team.name);
      return message.channel.send({ embeds: [embed] });
    }

    // --- !liste liste ---
    if (sub === 'liste') {
      const rosters = await Roster.find({ guildId: message.guild.id });
      if (!rosters.length) return message.reply('❌ Aucun roster enregistré.');

      const embed = new EmbedBuilder()
        .setTitle('👥 Rosters enregistrés')
        .setColor(0x5865F2)
        .setDescription(
          rosters.map(r => `• **${r.teamName}** — ${r.members.length} membre(s)`).join('\n')
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    // --- Staff-only commands from here ---
    if (!isStaff) return message.reply('⛔ Staff uniquement.');

    // --- !liste ajouter <équipe> @user <rôle> [note] ---
    if (sub === 'ajouter') {
      const mention = message.mentions.members.first();
      if (!mention) return message.reply('Usage : `!liste ajouter <équipe> @user <rôle> [note]`');

      // Team name is everything between "ajouter" and the mention
      const rawContent = content.slice(content.toLowerCase().indexOf('!liste ajouter') + '!liste ajouter'.length).trim();
      const mentionPattern = /<@!?\d+>/;
      const mentionMatch = rawContent.match(mentionPattern);
      if (!mentionMatch) return message.reply('Usage : `!liste ajouter <équipe> @user <rôle> [note]`');

      const teamName = rawContent.slice(0, rawContent.indexOf(mentionMatch[0])).trim();
      const afterMention = rawContent.slice(rawContent.indexOf(mentionMatch[0]) + mentionMatch[0].length).trim().split(/\s+/);
      const ingameRole = normalizeRole(afterMention[0]);
      const note = afterMention.slice(1).join(' ').trim();

      if (!teamName) return message.reply('Usage : `!liste ajouter <équipe> @user <rôle> [note]`');
      if (!ingameRole) return message.reply(`❌ Rôle invalide. Choisissez parmi : ${VALID_ROLES.join(', ')}`);

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const roster = await Roster.findOneAndUpdate(
        { guildId: message.guild.id, teamName: team.name },
        { $setOnInsert: { guildId: message.guild.id, teamName: team.name } },
        { upsert: true, new: true }
      );

      const existing = roster.members.find(m => m.userId === mention.id);
      if (existing) return message.reply(`❌ <@${mention.id}> est déjà dans le roster de **${team.name}**.`);

      roster.members.push({
        userId: mention.id,
        userTag: mention.user.tag,
        displayName: mention.displayName,
        role: ingameRole,
        note: note || '',
        joinedAt: new Date()
      });
      roster.updatedAt = new Date();
      await roster.save();

      logStaffAction(client, `👥 **Roster** — \`${mention.user.tag}\` ajouté à **${team.name}** en tant que **${ingameRole}** | Par : ${message.author.tag}`);
      return message.reply(`✅ <@${mention.id}> ajouté au roster de **${team.name}** en tant que **${ROLE_ICONS[ingameRole]} ${ingameRole}**.`);
    }

    // --- !liste retirer <équipe> @user ---
    if (sub === 'retirer') {
      const mention = message.mentions.members.first();
      if (!mention) return message.reply('Usage : `!liste retirer <équipe> @user`');

      const rawContent = content.slice(content.toLowerCase().indexOf('!liste retirer') + '!liste retirer'.length).trim();
      const mentionPattern = /<@!?\d+>/;
      const mentionMatch = rawContent.match(mentionPattern);
      const teamName = rawContent.slice(0, rawContent.indexOf(mentionMatch[0])).trim();

      if (!teamName) return message.reply('Usage : `!liste retirer <équipe> @user`');

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const roster = await getRoster(message.guild.id, team.name);
      if (!roster) return message.reply(`❌ Aucun roster pour **${team.name}**.`);

      const before = roster.members.length;
      roster.members = roster.members.filter(m => m.userId !== mention.id);
      if (roster.members.length === before) return message.reply(`❌ <@${mention.id}> n'est pas dans le roster de **${team.name}**.`);

      roster.updatedAt = new Date();
      await roster.save();

      logStaffAction(client, `👥 **Roster** — \`${mention.user.tag}\` retiré de **${team.name}** | Par : ${message.author.tag}`);
      return message.reply(`✅ <@${mention.id}> retiré du roster de **${team.name}**.`);
    }

    // --- !liste role <équipe> @user <rôle> ---
    if (sub === 'role') {
      const mention = message.mentions.members.first();
      if (!mention) return message.reply('Usage : `!liste role <équipe> @user <nouveau-rôle>`');

      const rawContent = content.slice(content.toLowerCase().indexOf('!liste role') + '!liste role'.length).trim();
      const mentionPattern = /<@!?\d+>/;
      const mentionMatch = rawContent.match(mentionPattern);
      const teamName = rawContent.slice(0, rawContent.indexOf(mentionMatch[0])).trim();
      const afterMention = rawContent.slice(rawContent.indexOf(mentionMatch[0]) + mentionMatch[0].length).trim();
      const ingameRole = normalizeRole(afterMention);

      if (!teamName) return message.reply('Usage : `!liste role <équipe> @user <rôle>`');
      if (!ingameRole) return message.reply(`❌ Rôle invalide. Choisissez parmi : ${VALID_ROLES.join(', ')}`);

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const roster = await getRoster(message.guild.id, team.name);
      if (!roster) return message.reply(`❌ Aucun roster pour **${team.name}**.`);

      const member = roster.members.find(m => m.userId === mention.id);
      if (!member) return message.reply(`❌ <@${mention.id}> n'est pas dans le roster de **${team.name}**.`);

      member.role = ingameRole;
      roster.updatedAt = new Date();
      await roster.save();

      logStaffAction(client, `👥 **Roster** — Rôle de \`${mention.user.tag}\` dans **${team.name}** → **${ingameRole}** | Par : ${message.author.tag}`);
      return message.reply(`✅ Rôle de <@${mention.id}> mis à jour : **${ROLE_ICONS[ingameRole]} ${ingameRole}**.`);
    }

    // --- !liste note <équipe> @user <note> ---
    if (sub === 'note') {
      const mention = message.mentions.members.first();
      if (!mention) return message.reply('Usage : `!liste note <équipe> @user <note>`');

      const rawContent = content.slice(content.toLowerCase().indexOf('!liste note') + '!liste note'.length).trim();
      const mentionPattern = /<@!?\d+>/;
      const mentionMatch = rawContent.match(mentionPattern);
      const teamName = rawContent.slice(0, rawContent.indexOf(mentionMatch[0])).trim();
      const note = rawContent.slice(rawContent.indexOf(mentionMatch[0]) + mentionMatch[0].length).trim();

      if (!teamName || !note) return message.reply('Usage : `!liste note <équipe> @user <note>`');

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const roster = await getRoster(message.guild.id, team.name);
      if (!roster) return message.reply(`❌ Aucun roster pour **${team.name}**.`);

      const member = roster.members.find(m => m.userId === mention.id);
      if (!member) return message.reply(`❌ <@${mention.id}> n'est pas dans le roster de **${team.name}**.`);

      member.note = note;
      roster.updatedAt = new Date();
      await roster.save();

      return message.reply(`✅ Note mise à jour pour <@${mention.id}> dans **${team.name}**.`);
    }

    // --- !liste vider <équipe> ---
    if (sub === 'vider') {
      const teamName = args.slice(1).join(' ').trim();
      if (!teamName) return message.reply('Usage : `!liste vider <équipe>`');

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const roster = await getRoster(message.guild.id, team.name);
      if (!roster || !roster.members.length) return message.reply(`❌ Le roster de **${team.name}** est déjà vide.`);

      const count = roster.members.length;
      roster.members = [];
      roster.updatedAt = new Date();
      await roster.save();

      logStaffAction(client, `👥 **Roster vidé** — **${team.name}** (${count} membres supprimés) | Par : ${message.author.tag}`);
      return message.reply(`✅ Roster de **${team.name}** vidé (${count} membre(s) supprimé(s)).`);
    }
    } catch (err) {
      console.error('[roster] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
