const MaintenanceConfig = require('../database/models/MaintenanceConfig');

// ── Cache maintenance par serveur ─────────────────────────────────────────────
const cache = new Map();

// ── Déduplication des messages ────────────────────────────────────────────────
// Bloque le traitement d'un même message plusieurs fois dans le même processus.
// Protège aussi contre les doubles événements Discord (reconnexion gateway).
const processedIds = new Set();
const DEDUP_TTL_MS = 8000;

function isDuplicate(messageId) {
  if (processedIds.has(messageId)) return true;
  processedIds.add(messageId);
  setTimeout(() => processedIds.delete(messageId), DEDUP_TTL_MS);
  return false;
}

// ── Exports maintenance ───────────────────────────────────────────────────────
async function loadCache(guildId) {
  const doc = await MaintenanceConfig.findOne({ guildId }).lean();
  if (doc) cache.set(guildId, { active: doc.active, message: doc.message });
  return cache.get(guildId);
}

function getCached(guildId) {
  return cache.get(guildId);
}

async function setMaintenance(guildId, active, message, userId, userTag) {
  const doc = await MaintenanceConfig.findOneAndUpdate(
    { guildId },
    {
      active,
      ...(message !== undefined ? { message } : {}),
      ...(active ? { startedBy: userId, startedTag: userTag, startedAt: new Date() } : {})
    },
    { upsert: true, new: true }
  );
  cache.set(guildId, { active: doc.active, message: doc.message });
  return doc;
}

async function setMessage(guildId, message) {
  const doc = await MaintenanceConfig.findOneAndUpdate(
    { guildId },
    { message },
    { upsert: true, new: true }
  );
  cache.set(guildId, { active: doc.active, message: doc.message });
  return doc;
}

// ── Setup du guard (patch client.emit) ────────────────────────────────────────
function setupMaintenanceGuard(client) {
  MaintenanceConfig.find({ active: true }).lean().then(docs => {
    for (const doc of docs) {
      cache.set(doc.guildId, { active: doc.active, message: doc.message });
    }
  }).catch(() => {});

  const originalEmit = client.emit.bind(client);

  client.emit = function (event, ...args) {
    if (event === 'messageCreate') {
      const message = args[0];

      // ── Déduplication ─────────────────────────────────────────────────────
      if (message?.id && isDuplicate(message.id)) {
        console.warn(`[dedup] Message ${message.id} ignoré (doublon détecté).`);
        return true;
      }

      // ── Blocage maintenance ───────────────────────────────────────────────
      if (
        message?.guild &&
        !message?.author?.bot &&
        message?.content?.trim().startsWith('!')
      ) {
        const state = cache.get(message.guild.id);
        if (state?.active) {
          const isStaff = message.member?.permissions.has('Administrator');
          if (!isStaff) {
            message.reply(state.message).catch(() => {});
            return true;
          }
        }
      }
    }

    return originalEmit(event, ...args);
  };
}

module.exports = { setupMaintenanceGuard, setMaintenance, setMessage, getCached, loadCache };
