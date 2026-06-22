const { EmbedBuilder } = require('discord.js');
const ScheduledEmbed = require('../database/models/ScheduledEmbed');

let _client = null;

async function processDueEmbeds() {
  if (!_client) return;
  try {
    const due = await ScheduledEmbed.find({ sent: false, scheduledAt: { $lte: new Date() } });
    for (const doc of due) {
      try {
        const channel = _client.channels.cache.get(doc.channelId);
        if (!channel) {
          await ScheduledEmbed.findByIdAndUpdate(doc._id, { sent: true });
          continue;
        }

        const embed = new EmbedBuilder().setColor(doc.color).setTimestamp();

        if (doc.title)        embed.setTitle(doc.title);
        if (doc.description)  embed.setDescription(doc.description);
        if (doc.imageUrl)     embed.setImage(doc.imageUrl);
        if (doc.thumbnailUrl) embed.setThumbnail(doc.thumbnailUrl);
        if (doc.footer)       embed.setFooter({ text: doc.footer });
        if (doc.authorName) {
          embed.setAuthor({
            name:    doc.authorName,
            iconURL: doc.authorIconUrl || undefined,
          });
        }

        await channel.send({ embeds: [embed] });
        await ScheduledEmbed.findByIdAndUpdate(doc._id, { sent: true });
        console.log(`📤 Embed programmé publié → #${channel.name} (${doc._id})`);
      } catch (err) {
        console.error(`[scheduledEmbed] Erreur publication ${doc._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[scheduledEmbedManager] Erreur:', err.message);
  }
}

let started = false;

function startScheduledEmbedManager(client) {
  if (started) return;
  started = true;
  _client = client;
  setInterval(processDueEmbeds, 30_000);
  processDueEmbeds();
  console.log('📅 Système embeds programmés activé');
}

module.exports = { startScheduledEmbedManager };
