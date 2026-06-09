const XpEntry = require('../database/models/XpEntry');
const LevelConfig = require('../database/models/LevelConfig');
const { EmbedBuilder } = require('discord.js');

// In-memory L1 cache: cacheKey → timestamp of last XP gain
// Fast-reject path while the process is alive; never the sole gate.
const xpCooldown = new Map();
const COOLDOWN_MS = 60 * 1000; // 1 minute between XP gains

function xpToLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50));
}

function randomXp() {
  return Math.floor(Math.random() * 6) + 10; // 10-15 XP
}

async function startLevelManager(client) {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    try {
      const userId = message.author.id;
      const guildId = message.guild.id;
      const now = Date.now();
      const cacheKey = `${guildId}:${userId}`;

      // L1 cache fast-reject (avoids a DB round-trip when process is warm)
      const cachedLast = xpCooldown.get(cacheKey);
      if (cachedLast !== undefined && now - cachedLast < COOLDOWN_MS) return;

      // Check if levels enabled
      const config = await LevelConfig.findOne({ guildId }).catch(() => null);
      if (config && !config.enabled) return;

      const xpGain = randomXp();
      const cooldownCutoff = new Date(now - COOLDOWN_MS);

      // Atomic cooldown-gated XP grant.
      // The filter only matches when lastXpAt is absent/null (new user) or
      // older than the cooldown window. If the document exists but the cooldown
      // is still active, the filter won't match; with upsert:true MongoDB
      // would try to insert a second document, which hits the unique index and
      // throws error code 11000 — we treat that as "cooldown active".
      let entry;
      try {
        entry = await XpEntry.findOneAndUpdate(
          {
            guildId,
            userId,
            $or: [
              { lastXpAt: null },
              { lastXpAt: { $lt: cooldownCutoff } }
            ]
          },
          {
            $inc: { xp: xpGain },
            $set: { username: message.author.username, lastXpAt: new Date(now) }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        if (err.code === 11000) {
          // Unique index conflict → document exists but cooldown is still active.
          // Warm the cache so subsequent messages are rejected without a DB hit.
          xpCooldown.set(cacheKey, now);
          return;
        }
        throw err;
      }

      if (!entry) return;

      // Warm the L1 cache with the confirmed grant time
      xpCooldown.set(cacheKey, now);

      const newLevel = xpToLevel(entry.xp);
      if (newLevel > (entry.level || 0)) {
        // Level up!
        await XpEntry.findOneAndUpdate({ guildId, userId }, { level: newLevel });

        // Find where to announce
        let announceChannel = null;
        if (config?.channelId) {
          announceChannel = message.guild.channels.cache.get(config.channelId);
        }
        announceChannel = announceChannel || message.channel;

        const embed = new EmbedBuilder()
          .setTitle('📈 Level Up !')
          .setDescription(`Félicitations ${message.author} ! Tu passes au **niveau ${newLevel}** ! 🎉`)
          .setColor(0xFEE75C)
          .setThumbnail(message.author.displayAvatarURL())
          .setTimestamp();

        await announceChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      console.error('[levelManager] Erreur:', err);
    }
  });
}

module.exports = { startLevelManager };
