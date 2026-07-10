const cooldowns = new Map();

// DB config cache: command → seconds (overrides hardcoded defaults)
let dbConfig = new Map();

// Lazy-load model to avoid circular require at startup
function getModel() {
  return require('../database/models/CooldownConfig');
}

async function refreshDbConfig() {
  try {
    const CooldownConfig = getModel();
    const entries = await CooldownConfig.find();
    const fresh = new Map();
    for (const e of entries) fresh.set(e.command, e.seconds);
    dbConfig = fresh;
  } catch {
    // Silent fail — keep existing cache
  }
}

// Refresh cache every 60 seconds
setInterval(refreshDbConfig, 60 * 1000);
refreshDbConfig();

// Cleanup expired cooldowns every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of cooldowns.entries()) {
    if (now >= expiry) cooldowns.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Checks if a user is on cooldown for a command.
 * DB config overrides defaultSeconds. Returns 0 if command is disabled (0s).
 * @returns {number} Remaining seconds, or 0 if not on cooldown.
 */
function checkCooldown(userId, command, defaultSeconds, guildId = 'global') {
  const seconds = dbConfig.has(command) ? dbConfig.get(command) : defaultSeconds;
  if (seconds === 0) return 0; // 0 = no cooldown

  const key = `${guildId}:${userId}:${command}`;
  const now = Date.now();

  if (cooldowns.has(key)) {
    const expiry = cooldowns.get(key);
    if (now < expiry) return Math.ceil((expiry - now) / 1000);
  }

  cooldowns.set(key, now + seconds * 1000);
  return 0;
}

/**
 * Replies with a cooldown warning and auto-deletes after 4s.
 */
async function replyCooldown(message, remaining, command) {
  const msg = await message.reply(`⏳ Attends encore **${remaining}s** avant de réutiliser \`!${command}\`.`);
  setTimeout(() => msg.delete().catch(() => {}), 4000);
}

/**
 * Forces an immediate refresh of the DB config cache.
 */
async function invalidateCooldownCache() {
  await refreshDbConfig();
}

module.exports = { checkCooldown, replyCooldown, invalidateCooldownCache };
