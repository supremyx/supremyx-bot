/**
 * Parses a duration string like "30m", "1h30m", "2h", "1d", "45s"
 * Returns milliseconds, or null if invalid.
 */
function parseDuration(str) {
  if (!str) return null;
  const regex = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i;
  const match = str.trim().match(regex);
  if (!match) return null;
  const [, d, h, m, s] = match;
  const ms =
    (parseInt(d, 10) || 0) * 86400000 +
    (parseInt(h, 10) || 0) * 3600000 +
    (parseInt(m, 10) || 0) * 60000 +
    (parseInt(s, 10) || 0) * 1000;
  return ms > 0 ? ms : null;
}

/**
 * Formats milliseconds into a human-readable string.
 */
function formatDuration(ms) {
  const totalS = Math.floor(ms / 1000);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const totalH = Math.floor(totalM / 60);
  const h = totalH % 24;
  const d = Math.floor(totalH / 24);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}

module.exports = { parseDuration, formatDuration };
