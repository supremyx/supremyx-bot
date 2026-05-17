const Schedule = require('../database/models/Schedule');
const ScheduleConfig = require('../database/models/ScheduleConfig');
const { EmbedBuilder } = require('discord.js');

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
}
function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function sendReminder(client, match, label, color) {
  const configs = await ScheduleConfig.find({ channelId: { $ne: '' } });
  if (!configs.length) return;

  const teamsStr = match.teams.join(' **vs** ');
  const embed = new EmbedBuilder()
    .setTitle(`⏰ Rappel match — ${label}`)
    .setColor(color)
    .addFields(
      { name: '🎮 Équipes',   value: teamsStr,                                     inline: false },
      { name: '📆 Date',      value: `${formatDate(match.date)} à **${formatTime(match.date)}**`, inline: false }
    )
    .setTimestamp();

  if (match.tournamentName) embed.addFields({ name: '🏁 Tournoi', value: match.tournamentName, inline: true });
  if (match.note)           embed.addFields({ name: '📝 Note',    value: match.note,            inline: true });

  for (const cfg of configs) {
    try {
      const channel = client.channels.cache.get(cfg.channelId);
      if (channel) await channel.send({ embeds: [embed] });
    } catch { /* channel inaccessible */ }
  }
}

function startScheduleManager(client) {
  // Check every minute
  setInterval(async () => {
    try {
      const now  = new Date();
      const upcoming = await Schedule.find({ date: { $gte: now } });

      for (const match of upcoming) {
        const msUntil = match.date.getTime() - now.getTime();
        const minUntil = msUntil / 60000;
        let changed = false;

        // 24h reminder (between 23h50 and 24h10)
        if (!match.reminded24h && minUntil >= 1430 && minUntil <= 1450) {
          await sendReminder(client, match, 'dans 24 heures', 0x5865F2);
          match.reminded24h = true;
          changed = true;
        }

        // 1h reminder (between 55 and 65 min)
        if (!match.reminded1h && minUntil >= 55 && minUntil <= 65) {
          await sendReminder(client, match, 'dans 1 heure', 0xFEE75C);
          match.reminded1h = true;
          changed = true;
        }

        // 15min reminder (between 12 and 18 min)
        if (!match.reminded15m && minUntil >= 12 && minUntil <= 18) {
          await sendReminder(client, match, 'dans 15 minutes', 0xED4245);
          match.reminded15m = true;
          changed = true;
        }

        if (changed) await match.save();
      }
    } catch (err) {
      console.error('[scheduleManager]', err);
    }
  }, 60_000);
}

module.exports = { startScheduleManager };
