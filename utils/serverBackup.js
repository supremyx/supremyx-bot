const ServerBackup  = require('../database/models/ServerBackup');
const mongoose      = require('mongoose');

// Collections to include in a backup (model name → Mongoose model path)
const BACKUP_COLLECTIONS = [
  'Config', 'AutomodConfig', 'AntispamConfig', 'AntiLinkConfig', 'AntiRaidConfig',
  'WelcomeConfig', 'AutoroleConfig', 'LevelConfig', 'CooldownConfig', 'DashboardConfig',
  'MaintenanceConfig', 'BirthdayConfig', 'InscriptionConfig', 'DiffuseurConfig',
];

function safeRequireModel(name) {
  try {
    return mongoose.models[name] || require(`../database/models/${name}`);
  } catch { return null; }
}

/**
 * Create a backup snapshot of all guild configs.
 */
async function createBackup(guildId, name, createdBy = 'system') {
  const snapshot = {};

  for (const modelName of BACKUP_COLLECTIONS) {
    const Model = safeRequireModel(modelName);
    if (!Model) continue;
    try {
      // Try guildId filter first, then no filter (for singleton configs)
      let docs = await Model.find({ guildId }).lean();
      if (!docs.length) docs = await Model.find({}).lean();
      snapshot[modelName] = docs;
    } catch { /* model may not support this query */ }
  }

  const backup = await ServerBackup.create({ guildId, name, createdBy, data: snapshot });
  return backup;
}

/**
 * Restore a backup snapshot.
 */
async function restoreBackup(backupId, restoredBy = 'system') {
  const backup = await ServerBackup.findById(backupId);
  if (!backup) throw new Error('Sauvegarde introuvable');

  const { guildId, data } = backup;
  const results = {};

  for (const [modelName, docs] of Object.entries(data)) {
    const Model = safeRequireModel(modelName);
    if (!Model || !Array.isArray(docs)) continue;

    let restored = 0;
    for (const doc of docs) {
      try {
        const { _id, __v, ...fields } = doc;
        await Model.findOneAndUpdate(
          { guildId: fields.guildId || guildId },
          { $set: fields },
          { upsert: true }
        );
        restored++;
      } catch { /* ignore individual doc errors */ }
    }
    results[modelName] = restored;
  }

  await ServerBackup.findByIdAndUpdate(backupId, { restoredAt: new Date() });
  return results;
}

/**
 * List backups for a guild, newest first.
 */
async function listBackups(guildId, limit = 20) {
  return ServerBackup.find({ guildId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('_id name createdBy createdAt restoredAt')
    .lean();
}

/**
 * Delete a backup by id.
 */
async function deleteBackup(id) {
  return ServerBackup.findByIdAndDelete(id);
}

module.exports = { createBackup, restoreBackup, listBackups, deleteBackup };
