const AfkStatus = require('../database/models/AfkStatus');

// In-memory cache for performance
const afkCache = new Map(); // `${guildId}:${userId}` → { message, since }

async function loadAfkCache(guildId) {
  const entries = await AfkStatus.find({ guildId });
  for (const e of entries) {
    afkCache.set(`${e.guildId}:${e.userId}`, { message: e.message, since: e.since });
  }
}

module.exports = (client) => {
  // Load AFK cache when bot is ready
  client.once('ready', async () => {
    for (const [, guild] of client.guilds.cache) {
      await loadAfkCache(guild.id).catch(() => {});
    }
  });

  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const content = message.content.trim();
    const guildId = message.guild?.id;
    if (!guildId) return;

    const cacheKey = `${guildId}:${message.author.id}`;

    // --- Remove AFK when user sends a message ---
    if (!content.startsWith('!absent') && afkCache.has(cacheKey)) {
      afkCache.delete(cacheKey);
      await AfkStatus.deleteOne({ guildId, userId: message.author.id }).catch(() => {});
      const reply = await message.reply('✅ Ton statut AFK a été retiré. Bienvenue de retour !');
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      return;
    }

    // --- Mention detection: notify if mentioned user is AFK ---
    if (message.mentions.users.size > 0 && !content.startsWith('!absent')) {
      for (const [, user] of message.mentions.users) {
        const key = `${guildId}:${user.id}`;
        if (afkCache.has(key) && user.id !== message.author.id) {
          const { message: afkMsg, since } = afkCache.get(key);
          const elapsed = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
          const timeStr = elapsed < 1 ? 'à l\'instant' : `il y a ${elapsed} minute(s)`;
          await message.reply(`⚠️ **${user.username}** est AFK (${timeStr}) : *${afkMsg}*`);
        }
      }
    }

    // --- !afk [message] ---
    if (content.startsWith('!absent')) {
      const afkMsg = content.slice('!absent'.length).trim() || 'AFK';
      const since = new Date();

      await AfkStatus.findOneAndUpdate(
        { guildId, userId: message.author.id },
        { guildId, userId: message.author.id, message: afkMsg, since },
        { upsert: true, new: true }
      );
      afkCache.set(cacheKey, { message: afkMsg, since });

      const reply = await message.reply(`💤 Tu es désormais AFK : *${afkMsg}*`);
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    }
  });
};
