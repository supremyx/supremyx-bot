const mongoose = require('mongoose');

const EmbedTemplateSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  name:         { type: String, required: true },
  title:        { type: String, default: '' },
  description:  { type: String, default: '' },
  color:        { type: Number, default: 0x5865F2 },
  imageUrl:     { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  authorName:   { type: String, default: '' },
  authorIconUrl:{ type: String, default: '' },
  footer:       { type: String, default: '' },
  urlTitre:     { type: String, default: '' },
  buttons:      [{ label: String, url: String }],
  fields:       [{ name: String, value: String, inline: Boolean }],
  createdBy:    { type: String, default: '' },
  updatedBy:    { type: String, default: '' },
}, { timestamps: true });

EmbedTemplateSchema.index({ guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('EmbedTemplate', EmbedTemplateSchema);
