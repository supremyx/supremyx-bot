const mongoose = require('mongoose');

const SearchHistorySchema = new mongoose.Schema({
  userId:  { type: String, required: true },
  guildId: { type: String, required: true },
  type:    { type: String, enum: ['aide', 'staff'], default: 'aide' },
  terms: [
    {
      term: { type: String, required: true },
      at:   { type: Date, default: Date.now },
    },
  ],
});

SearchHistorySchema.index({ userId: 1, guildId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('SearchHistory', SearchHistorySchema);
