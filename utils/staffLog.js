const { EmbedBuilder } = require('discord.js');
const StaffLogEntry = require('../database/models/StaffLogEntry');
const { getLogChannelId } = require('./channelConfig');

// Detect category from message content
function detectCategory(message) {
  const m = message.toLowerCase();
  if (m.includes('addmatch') || m.includes('match')) return 'match';
  if (m.includes('warn') || m.includes('mute') || m.includes('ban') || m.includes('blacklist')) return 'modération';
  if (m.includes('tournoi') || m.includes('tournament') || m.includes('saison')) return 'tournoi';
  if (m.includes('backup') || m.includes('restore') || m.includes('export')) return 'données';
  if (m.includes('config') || m.includes('règle') || m.includes('rule') || m.includes('motd')) return 'config';
  if (m.includes('ticket')) return 'ticket';
  if (m.includes('rank') || m.includes('rang')) return 'rang';
  if (m.includes('achievement') || m.includes('trophée')) return 'trophée';
  if (m.includes('giveaway')) return 'événement';
  if (m.includes('register') || m.includes('merge') || m.includes('rename') || m.includes('lineup')) return 'équipe';
  return 'général';
}

/**
 * Logs a staff action string to the log channel AND saves to DB.
 * Usage: logStaffAction(client, '🎯 **Action** details | Par : tag')
 */
async function logStaffAction(client, message) {
  const channelId = getLogChannelId();
  if (channelId) {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setDescription(message)
        .setColor(0x5865F2)
        .setTimestamp();
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
  // Persist to DB
  const category = detectCategory(message);
  await StaffLogEntry.create({ message, category }).catch(() => {});
}

/**
 * Legacy structured log format for addmatch etc.
 * Usage: staffLog(client, { action, details, author })
 */
async function staffLog(client, { action, details, author }) {
  const colors = { addmatch: 0x57F287, unregister: 0xED4245, resetmatch: 0xFEE75C };
  const icons = { addmatch: '🎯', unregister: '🗑️', resetmatch: '🔄' };

  const channelId = getLogChannelId();
  if (channelId) {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(`${icons[action] || '📋'} Action staff — ${action}`)
        .setDescription(details)
        .setColor(colors[action] || 0x5865F2)
        .setFooter({ text: `Effectué par ${author}` })
        .setTimestamp();
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
  // Persist to DB
  const message = `**${action}** — ${details.replace(/\*\*/g, '')} | Par : ${author}`;
  await StaffLogEntry.create({ message, category: action }).catch(() => {});
}

module.exports = { staffLog, logStaffAction };
