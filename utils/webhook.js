/**
 * utils/webhook.js
 * Sends Discord webhook embeds for key bot events.
 * Uses the native fetch (Node 18+). Silent on failure — never crashes the bot.
 */

const COLORS = {
  green:  0x57F287,
  red:    0xED4245,
  yellow: 0xFEE75C,
  blue:   0x5865F2,
  orange: 0xFFA500,
};

async function sendWebhook(embed) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'SUPREMYX Staff',
        avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
        embeds: [{ ...embed, timestamp: new Date().toISOString() }],
      }),
    });
  } catch {
    // Silent fail — webhook errors must never crash the bot
  }
}

// ─── Team events ──────────────────────────────────────────────────────────────

function notifyTeamRegistered({ teamName, staffTag, guildName }) {
  return sendWebhook({
    title: '✅ Nouvelle équipe enregistrée',
    color: COLORS.green,
    fields: [
      { name: '🏷️ Équipe',   value: `**${teamName}**`, inline: true },
      { name: '👮 Staff',    value: staffTag,           inline: true },
      { name: '🌐 Serveur',  value: guildName,          inline: true },
    ],
    footer: { text: 'SUPREMYX · Enregistrement équipe' },
  });
}

function notifyTeamDeleted({ teamName, staffTag, guildName }) {
  return sendWebhook({
    title: '🗑️ Équipe supprimée',
    color: COLORS.red,
    fields: [
      { name: '🏷️ Équipe',   value: `**${teamName}**`, inline: true },
      { name: '👮 Staff',    value: staffTag,           inline: true },
      { name: '🌐 Serveur',  value: guildName,          inline: true },
    ],
    footer: { text: 'SUPREMYX · Suppression équipe' },
  });
}

// ─── Match events ─────────────────────────────────────────────────────────────

function notifyMatchAdded({ teamName, placement, kills, points, tournamentName, staffTag, guildName }) {
  const fields = [
    { name: '🏷️ Équipe',         value: `**${teamName}**`, inline: true },
    { name: '🏆 Placement',      value: `#${placement}`,   inline: true },
    { name: '💀 Kills',          value: `${kills}`,        inline: true },
    { name: '⭐ Points gagnés',  value: `+${points}`,      inline: true },
    { name: '👮 Staff',          value: staffTag,           inline: true },
  ];
  if (tournamentName) {
    fields.push({ name: '🎖️ Tournoi', value: tournamentName, inline: true });
  }
  return sendWebhook({
    title: '🎯 Match ajouté',
    color: COLORS.blue,
    fields,
    footer: { text: `SUPREMYX · ${guildName}` },
  });
}

// ─── Moderation events ────────────────────────────────────────────────────────

function notifyWarn({ target, reason, totalWarns, staffTag, guildName, escalationMsg }) {
  const fields = [
    { name: '🎯 Cible',         value: target,         inline: true },
    { name: '⚠️ Total warns',  value: `${totalWarns}`, inline: true },
    { name: '👮 Staff',         value: staffTag,        inline: true },
    { name: '📝 Raison',        value: reason,          inline: false },
  ];
  if (guildName) fields.push({ name: '🌐 Serveur', value: guildName, inline: true });
  if (escalationMsg) fields.push({ name: '🤖 Auto-escalade', value: escalationMsg, inline: false });
  return sendWebhook({
    title: '⚠️ Avertissement émis',
    color: totalWarns >= 3 ? COLORS.red : COLORS.yellow,
    fields,
    footer: { text: 'SUPREMYX · Modération' },
  });
}

function notifySanction({ type, targetTag, duration, reason, staffTag, guildName }) {
  const META = {
    mute:   { icon: '🔇', label: 'Mise en sourdine',   color: COLORS.yellow },
    kick:   { icon: '👢', label: 'Expulsion',           color: COLORS.orange },
    ban:    { icon: '🔨', label: 'Bannissement',        color: COLORS.red    },
    unban:  { icon: '🔓', label: 'Débannissement',      color: COLORS.green  },
    unmute: { icon: '🔊', label: 'Retrait de sourdine', color: COLORS.green  },
  };
  const meta = META[type] ?? { icon: '🚨', label: type, color: COLORS.red };
  const fields = [
    { name: '🎯 Cible',    value: targetTag, inline: true },
    { name: '👮 Staff',    value: staffTag,  inline: true },
    { name: '🌐 Serveur',  value: guildName, inline: true },
  ];
  if (duration) fields.push({ name: '⏱️ Durée', value: duration, inline: true });
  if (reason)   fields.push({ name: '📝 Raison', value: reason,  inline: false });
  return sendWebhook({
    title: `${meta.icon} ${meta.label}`,
    color: meta.color,
    fields,
    footer: { text: 'SUPREMYX · Modération' },
  });
}

module.exports = {
  notifyTeamRegistered,
  notifyTeamDeleted,
  notifyMatchAdded,
  notifyWarn,
  notifySanction,
};
