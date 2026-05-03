const Schedule = require('../database/models/Schedule');
const { EmbedBuilder } = require('discord.js');

// Track which schedule IDs have already been reminded
const reminded = new Set();

function startReminder(client) {
  // Check every minute
  setInterval(async () => {
    try {
      const announceChannel = client.channels.cache.get(process.env.ANNOUNCE_CHANNEL_ID);
      if (!announceChannel) return;

      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 60 * 1000);
      const in31 = new Date(now.getTime() + 31 * 60 * 1000);

      // Find matches starting between 29m30s and 30m30s from now (±30s window)
      const windowStart = new Date(now.getTime() + 29.5 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 30.5 * 60 * 1000);

      const upcoming = await Schedule.find({
        date: { $gte: windowStart, $lte: windowEnd }
      });

      for (const match of upcoming) {
        const id = match._id.toString();
        if (reminded.has(id)) continue;
        reminded.add(id);

        const teamsStr = match.teams.length ? match.teams.join(' vs ') : 'Équipes à confirmer';
        const timeStr = match.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        const embed = new EmbedBuilder()
          .setTitle('⏰ Rappel — Match dans 30 minutes !')
          .setColor(0xED4245)
          .addFields(
            { name: '🎮 Équipes', value: teamsStr, inline: false },
            { name: '🕐 Heure', value: timeStr, inline: true }
          )
          .setTimestamp();

        if (match.tournamentName) {
          embed.addFields({ name: '🏁 Tournoi', value: match.tournamentName, inline: true });
        }
        if (match.note) {
          embed.addFields({ name: '📝 Note', value: match.note, inline: false });
        }

        embed.setFooter({ text: 'Bonne chance à toutes les équipes !' });

        announceChannel.send({ content: '@everyone', embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      // Silent fail — reminder is non-critical
    }
  }, 60 * 1000); // every 60 seconds
}

module.exports = { startReminder };
