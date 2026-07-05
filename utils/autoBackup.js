const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { logAdmin } = require('./adminLog');

let _interval    = null;
let _channelId   = process.env.BACKUP_CHANNEL_ID || null;
let _intervalHrs = 24;
let _enabled     = false;

function setBackupChannel(channelId) { _channelId = channelId; }
function isEnabled() { return _enabled; }
function getIntervalHrs() { return _intervalHrs; }

async function runBackup(client, { manual = false, requesterId = null, requesterTag = null } = {}) {
  const collections = mongoose.connection.collections;
  const snapshot = { exportedAt: new Date().toISOString(), type: manual ? 'manuel' : 'automatique', collections: {} };

  for (const [name, col] of Object.entries(collections)) {
    try {
      snapshot.collections[name] = await col.find({}).toArray();
    } catch (err) {
      console.error(`[autoBackup] Erreur lors de l'export de la collection "${name}" :`, err);
    }
  }

  const totalDocs = Object.values(snapshot.collections).reduce((s, arr) => s + arr.length, 0);
  const json   = JSON.stringify(snapshot, null, 2);
  const buffer = Buffer.from(json, 'utf-8');
  const day    = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  const file   = new AttachmentBuilder(buffer, { name: `backup_supremyx_${day}.json` });

  const colLines = Object.entries(snapshot.collections)
    .map(([n, docs]) => `\`${n}\` — **${docs.length}**`)
    .slice(0, 20)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`💾 Sauvegarde ${manual ? 'manuelle' : 'automatique'} — Base de données`)
    .setColor(0xEB459E)
    .setDescription(colLines || 'Aucune collection.')
    .addFields(
      { name: '📦 Collections', value: `${Object.keys(snapshot.collections).length}`, inline: true },
      { name: '📄 Documents',   value: `${totalDocs}`,                                inline: true },
    )
    .setFooter({ text: `SUPREMYX • ${new Date().toLocaleString('fr-FR')}${requesterTag ? ` • Demandé par ${requesterTag}` : ''}` })
    .setTimestamp();

  const channelId = _channelId;
  if (channelId) {
    const ch = client.channels.cache.get(channelId);
    if (ch) await ch.send({ embeds: [embed], files: [file] }).catch(() => {});
  }

  await logAdmin({
    action:   `Sauvegarde ${manual ? 'manuelle' : 'automatique'} effectuée`,
    category: 'données',
    detail:   `${Object.keys(snapshot.collections).length} collections, ${totalDocs} documents`,
    severity: 'info',
    userId:   requesterId,
    userTag:  requesterTag,
  });

  return { embed, file };
}

function startAutoBackup(client, intervalHours = 24) {
  _intervalHrs = intervalHours;
  _enabled     = true;
  if (_interval) clearInterval(_interval);
  _interval = setInterval(() => {
    runBackup(client, { manual: false }).catch(console.error);
  }, intervalHours * 60 * 60 * 1000);
  console.log(`💾 Sauvegarde automatique activée (toutes les ${intervalHours}h)`);
}

function stopAutoBackup() {
  _enabled = false;
  if (_interval) { clearInterval(_interval); _interval = null; }
  console.log('💾 Sauvegarde automatique désactivée');
}

module.exports = { startAutoBackup, stopAutoBackup, runBackup, setBackupChannel, isEnabled, getIntervalHrs };
