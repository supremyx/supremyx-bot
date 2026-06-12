const Schedule = require('../database/models/Schedule');
const { EmbedBuilder } = require('discord.js');
const { getAnnounceChannelId } = require('./channelConfig');

function startReminder(client) {
  // Check every minute
  setInterval(async () => {
    try {
      const announceChannel = client.channels.cache.get(getAnnounceChannelId());
      if (!announceChannel) return;

      const now = new Date();

      // Find matches starting between 29m30s and 30m30s from now (±30s window)
      // that have NOT already been reminded (persisted flag survives restarts)
      const windowStart = new Date(now.getTime() + 29.5 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 30.5 * 60 * 1000);

      const upcoming = await Schedule.find({
        date: { $gte: windowStart, $lte: windowEnd },
        reminded30m: { $ne: true }
      });

      for (const match of upcoming) {
        // Atomically mark as reminded so a concurrent process or rapid restart cannot double-send
        const updated = await Schedule.findOneAndUpdate(
          { _id: match._id, reminded30m: { $ne: true } },
          { $set: { reminded30m: true } },
          { new: false }
        );
        // If another process already set the flag, updated will be null — skip
        if (!updated) continue;

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
