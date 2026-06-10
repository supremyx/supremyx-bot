const mongoose = require('mongoose');

const autoMessageSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  channelId:  { type: String, required: true },
  title:      { type: String, default: '' },
  content:    { type: String, required: true },
  color:      { type: String, default: 'bleu' },
  // Type : unique | quotidien | hebdo | mensuel | annuel
  type:       { type: String, required: true },
  // Heure (UTC = heure Abidjan, UTC+0)
  hour:       { type: Number, default: 0 },
  minute:     { type: Number, default: 0 },
  // hebdo : 0=dim 1=lun 2=mar 3=mer 4=jeu 5=ven 6=sam
  dayOfWeek:  { type: Number, default: null },
  // mensuel
  dayOfMonth: { type: Number, default: null },
  // annuel
  month:      { type: Number, default: null },
  day:        { type: Number, default: null },
  // unique
  runAt:      { type: Date, default: null },
  // État
  active:     { type: Boolean, default: true },
  nextRun:    { type: Date, default: null },
  lastRun:    { type: Date, default: null },
  createdBy:  { type: String },
}, { timestamps: true });

module.exports = mongoose.model('AutoMessage', autoMessageSchema);
