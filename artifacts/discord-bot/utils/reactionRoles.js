const ReactionRole = require('../database/models/ReactionRole');

function emojiKey(emoji) {
  // Custom emoji: <:name:id> → "name:id", Unicode emoji → the emoji itself
  return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

async function startReactionRoles(client) {
  // Handle partial reactions (messages sent before bot started)
  async function resolvePartials(reaction, user) {
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch {
      return false;
    }
    if (user.bot) return false;
    return true;
  }

  client.on('messageReactionAdd', async (reaction, user) => {
    if (!await resolvePartials(reaction, user)) return;

    const key = emojiKey(reaction.emoji);
    const entry = await ReactionRole.findOne({
      messageId: reaction.message.id,
      emoji: key
    }).catch(() => null);

    if (!entry) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(entry.roleId);
    if (!role) return;

    await member.roles.add(role).catch(() => {});
  });

  client.on('messageReactionRemove', async (reaction, user) => {
    if (!await resolvePartials(reaction, user)) return;

    const key = emojiKey(reaction.emoji);
    const entry = await ReactionRole.findOne({
      messageId: reaction.message.id,
      emoji: key
    }).catch(() => null);

    if (!entry) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = guild.roles.cache.get(entry.roleId);
    if (!role) return;

    await member.roles.remove(role).catch(() => {});
  });
}

module.exports = { startReactionRoles };
