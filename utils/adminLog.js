const AdminLog    = require('../database/models/AdminLog');
const StaffLogEntry = require('../database/models/StaffLogEntry');

async function logAdmin({
  guildId    = null,
  guildName  = null,
  userId     = null,
  userTag    = null,
  channelId  = null,
  action,
  category   = 'général',
  detail     = null,
  severity   = 'info',
} = {}) {
  const msg = `[${category.toUpperCase()}] ${action}${detail ? ` — ${detail}` : ''}${userTag ? ` (par ${userTag})` : ''}`;
  try {
    await Promise.all([
      AdminLog.create({ guildId, guildName, userId, userTag, channelId, action, category, detail, severity }),
      StaffLogEntry.create({ message: msg, category }),
    ]);
  } catch (e) {
    console.error('[adminLog] Erreur écriture log:', e.message);
  }
}

module.exports = { logAdmin };
