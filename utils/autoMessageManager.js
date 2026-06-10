const { EmbedBuilder } = require('discord.js');
const AutoMessage = require('../database/models/AutoMessage');

const COLOR_MAP = {
  rouge: 0xED4245, vert: 0x57F287, bleu: 0x5865F2, jaune: 0xFEE75C,
  orange: 0xE67E22, violet: 0x9B59B6, blanc: 0xFFFFFF, noir: 0x2C2F33,
  or: 0xF1C40F, cyan: 0x1ABC9C, rose: 0xEB459E, gris: 0x808080,
};

function resolveColor(raw = '') {
  const key = raw.trim().toLowerCase();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  if (key.startsWith('#')) {
    const p = parseInt(key.slice(1), 16);
    if (!isNaN(p)) return p;
  }
  return 0x5865F2;
}

// Calcule la prochaine exécution à partir de `from` (Date UTC = heure Abidjan)
function computeNextRun(doc, from = new Date()) {
  const { type, hour, minute, dayOfWeek, dayOfMonth, month, day, runAt } = doc;

  if (type === 'unique') return runAt;

  const d = new Date(from);
  d.setUTCSeconds(0, 0);

  if (type === 'quotidien') {
    d.setUTCHours(hour, minute, 0, 0);
    if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  if (type === 'hebdo') {
    d.setUTCHours(hour, minute, 0, 0);
    const currentDay = d.getUTCDay();
    let diff = (dayOfWeek - currentDay + 7) % 7;
    if (diff === 0 && d <= from) diff = 7;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }

  if (type === 'mensuel') {
    d.setUTCDate(1); // évite les débordements de mois
    d.setUTCHours(hour, minute, 0, 0);
    d.setUTCDate(dayOfMonth);
    if (d <= from) {
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCDate(dayOfMonth);
    }
    return d;
  }

  if (type === 'annuel') {
    d.setUTCMonth(month - 1, day);
    d.setUTCHours(hour, minute, 0, 0);
    if (d <= from) d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  }

  return null;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS  = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
               'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function describeSchedule(doc) {
  const hm = `${String(doc.hour).padStart(2,'0')}:${String(doc.minute).padStart(2,'0')}`;
  if (doc.type === 'unique')    return `Une fois le ${doc.runAt?.toISOString().slice(0,10)} à ${hm}`;
  if (doc.type === 'quotidien') return `Tous les jours à ${hm}`;
  if (doc.type === 'hebdo')     return `Chaque ${JOURS[doc.dayOfWeek]} à ${hm}`;
  if (doc.type === 'mensuel')   return `Le ${doc.dayOfMonth} de chaque mois à ${hm}`;
  if (doc.type === 'annuel')    return `Le ${doc.day} ${MOIS[doc.month]} chaque année à ${hm}`;
  return '—';
}

let started = false;

function startAutoMessageManager(client) {
  if (started) return;
  started = true;

  setInterval(async () => {
    try {
      const now = new Date();
      const due = await AutoMessage.find({
        active: true,
        nextRun: { $lte: now },
      });

      for (const doc of due) {
        const channel = client.channels.cache.get(doc.channelId);
        if (!channel) {
          // Salon supprimé — désactiver
          doc.active = false;
          await doc.save();
          continue;
        }

        const embed = new EmbedBuilder()
          .setColor(resolveColor(doc.color))
          .setDescription(doc.content)
          .setTimestamp();

        if (doc.title) embed.setTitle(doc.title);

        try {
          await channel.send({ embeds: [embed] });
        } catch { /* accès refusé, on ne crash pas */ }

        doc.lastRun = now;

        if (doc.type === 'unique') {
          doc.active  = false;
          doc.nextRun = null;
        } else {
          doc.nextRun = computeNextRun(doc, now);
        }

        await doc.save();
      }
    } catch (err) {
      console.error('[autoMessageManager]', err);
    }
  }, 30_000); // vérifie toutes les 30 secondes pour ne pas rater une minute exacte
}

module.exports = { startAutoMessageManager, computeNextRun, describeSchedule, resolveColor };
