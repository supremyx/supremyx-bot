const Birthday = require('../database/models/Birthday');
const BirthdayConfig = require('../database/models/BirthdayConfig');
const { EmbedBuilder } = require('discord.js');

// Track announced birthdays per day: "userId-guildId-YYYY-MM-DD"
const announcedToday = new Set();
let lastCleanupDate = new Date().toDateString();

function getTodayKey(userId, guildId) {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  return `${userId}-${guildId}-${dateStr}`;
}

function cleanupIfNewDay() {
  const today = new Date().toDateString();
  if (today !== lastCleanupDate) {
    announcedToday.clear();
    lastCleanupDate = today;
  }
}

async function checkBirthdays(client) {
  cleanupIfNewDay();
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;

  try {
    const birthdays = await Birthday.find({ day, month });
    for (const b of birthdays) {
      const key = getTodayKey(b.userId, b.guildId);
      if (announcedToday.has(key)) continue;

      const config = await BirthdayConfig.findOne({ guildId: b.guildId });
      if (!config) continue;

      const guild = client.guilds.cache.get(b.guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(config.channelId);
      if (!channel) continue;

      const member = await guild.members.fetch(b.userId).catch(() => null);
      if (!member) continue;

      const age = b.year ? now.getFullYear() - b.year : null;
      const ageStr = age ? ` (**${age} ans**)` : '';

      const embed = new EmbedBuilder()
        .setTitle('🎂 Joyeux Anniversaire !')
        .setDescription(`🎉 Tout le serveur souhaite un joyeux anniversaire à ${member}${ageStr} ! 🎈`)
        .setColor(0xFEE75C)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      announcedToday.add(key);
    }
  } catch (err) {
    console.error('[birthday] Erreur:', err.message);
  }
}

function startBirthdayManager(client) {
  checkBirthdays(client);
  setInterval(() => checkBirthdays(client), 60 * 60 * 1000);
}

module.exports = { startBirthdayManager };
