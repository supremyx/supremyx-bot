const AuditLog = require('../database/models/AuditLog');

/**
 * Comprehensive Discord event audit logger.
 * Saves all significant guild events to the AuditLog collection.
 */
async function log(data) {
  try {
    await AuditLog.create(data);
  } catch { /* never crash the bot on a log failure */ }
}

function safeTag(user) {
  if (!user) return null;
  return user.tag || user.username || user.id;
}

async function startAuditLogger(client) {

  // ── Messages ────────────────────────────────────────────────────────────
  client.on('messageDelete', async message => {
    if (!message.guild || message.author?.bot) return;
    try {
      await log({
        guildId:  message.guild.id,
        type:     'MESSAGE_DELETE',
        category: 'message',
        actorId:  message.author?.id,
        actorTag: safeTag(message.author),
        channelId:message.channel.id,
        details:  { content: message.content?.slice(0, 1000), attachments: message.attachments?.size ?? 0 },
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    try {
      await log({
        guildId:  newMsg.guild.id,
        type:     'MESSAGE_EDIT',
        category: 'message',
        actorId:  newMsg.author?.id,
        actorTag: safeTag(newMsg.author),
        channelId:newMsg.channel.id,
        details:  {
          before: oldMsg.content?.slice(0, 500) || null,
          after:  newMsg.content?.slice(0, 500),
          url:    newMsg.url,
        },
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  // ── Members ─────────────────────────────────────────────────────────────
  client.on('guildMemberAdd', async member => {
    try {
      const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
      await log({
        guildId:  member.guild.id,
        type:     'MEMBER_JOIN',
        category: 'member',
        actorId:  member.id,
        actorTag: safeTag(member.user),
        details:  { accountAgeDays: ageDays, bot: member.user.bot },
        severity: ageDays < 7 ? 'warn' : 'info',
      });
    } catch { /* ignore */ }
  });

  client.on('guildMemberRemove', async member => {
    try {
      await log({
        guildId:  member.guild.id,
        type:     'MEMBER_LEAVE',
        category: 'member',
        actorId:  member.id,
        actorTag: safeTag(member.user),
        details:  { roles: member.roles.cache.map(r => r.name).filter(n => n !== '@everyone') },
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
      const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
      const nickChange   = oldMember.nickname !== newMember.nickname;

      if (!addedRoles.size && !removedRoles.size && !nickChange) return;

      await log({
        guildId:  newMember.guild.id,
        type:     'MEMBER_UPDATE',
        category: 'member',
        targetId: newMember.id,
        targetTag:safeTag(newMember.user),
        details:  {
          rolesAdded:   addedRoles.map(r => r.name),
          rolesRemoved: removedRoles.map(r => r.name),
          nickBefore:   nickChange ? oldMember.nickname : undefined,
          nickAfter:    nickChange ? newMember.nickname : undefined,
        },
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  // ── Voice ────────────────────────────────────────────────────────────────
  client.on('voiceStateUpdate', async (oldState, newState) => {
    if (!newState.guild || newState.member?.user?.bot) return;
    try {
      let type = null;
      if (!oldState.channelId && newState.channelId) type = 'VOICE_JOIN';
      else if (oldState.channelId && !newState.channelId) type = 'VOICE_LEAVE';
      else if (oldState.channelId !== newState.channelId) type = 'VOICE_MOVE';
      if (!type) return;

      await log({
        guildId:  newState.guild.id,
        type,
        category: 'voice',
        actorId:  newState.id,
        actorTag: safeTag(newState.member?.user),
        channelId:newState.channelId || oldState.channelId,
        details:  { from: oldState.channel?.name || null, to: newState.channel?.name || null },
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  // ── Channels ─────────────────────────────────────────────────────────────
  client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    try {
      await log({
        guildId:  channel.guild.id,
        type:     'CHANNEL_CREATE',
        category: 'channel',
        channelId:channel.id,
        details:  { name: channel.name, type: channel.type },
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    try {
      await log({
        guildId:  channel.guild.id,
        type:     'CHANNEL_DELETE',
        category: 'channel',
        channelId:channel.id,
        details:  { name: channel.name, type: channel.type },
        severity: 'warn',
      });
    } catch { /* ignore */ }
  });

  client.on('channelUpdate', async (oldChannel, newChannel) => {
    if (!newChannel.guild) return;
    if (oldChannel.name === newChannel.name && oldChannel.topic === newChannel.topic) return;
    try {
      await log({
        guildId:  newChannel.guild.id,
        type:     'CHANNEL_UPDATE',
        category: 'channel',
        channelId:newChannel.id,
        details:  {
          nameBefore:  oldChannel.name,
          nameAfter:   newChannel.name,
          topicBefore: oldChannel.topic,
          topicAfter:  newChannel.topic,
        },
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  // ── Roles ────────────────────────────────────────────────────────────────
  client.on('roleCreate', async role => {
    try {
      await log({
        guildId:  role.guild.id,
        type:     'ROLE_CREATE',
        category: 'role',
        targetId: role.id,
        targetTag:role.name,
        severity: 'info',
      });
    } catch { /* ignore */ }
  });

  client.on('roleDelete', async role => {
    try {
      await log({
        guildId:  role.guild.id,
        type:     'ROLE_DELETE',
        category: 'role',
        targetId: role.id,
        targetTag:role.name,
        severity: 'warn',
      });
    } catch { /* ignore */ }
  });

  // ── Bans ─────────────────────────────────────────────────────────────────
  client.on('guildBanAdd', async ban => {
    try {
      await log({
        guildId:  ban.guild.id,
        type:     'BAN_ADD',
        category: 'moderation',
        targetId: ban.user.id,
        targetTag:safeTag(ban.user),
        details:  { reason: ban.reason },
        severity: 'critical',
      });
    } catch { /* ignore */ }
  });

  client.on('guildBanRemove', async ban => {
    try {
      await log({
        guildId:  ban.guild.id,
        type:     'BAN_REMOVE',
        category: 'moderation',
        targetId: ban.user.id,
        targetTag:safeTag(ban.user),
        severity: 'info',
      });
    } catch { /* ignore */ }
  });
}

module.exports = { startAuditLogger };
