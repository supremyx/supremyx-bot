const mongoose = require('mongoose');
const NewsletterConfigSchema = new mongoose.Schema({
  guildId:    { type: String, required: true, unique: true },
  channelId:  { type: String, default: null },
  active:     { type: Boolean, default: false },
  lastSentAt: { type: Date, default: null },
});
module.exports = mongoose.models.NewsletterConfig || mongoose.model('NewsletterConfig', NewsletterConfigSchema);
