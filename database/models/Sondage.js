const mongoose = require('mongoose');

const sondageSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, default: '' },
  question: { type: String, required: true },
  options: [{ type: String }],
  endTime: { type: Date, required: true },
  closed: { type: Boolean, default: false },
  createdBy: { type: String, default: '' },
  results: [{
    option: { type: String },
    count:  { type: Number, default: 0 }
  }],
  totalVotes: { type: Number, default: 0 },
  winner:     { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Sondage', sondageSchema);
