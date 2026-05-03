const Sanction = require('../database/models/Sanction');
const EscaladeConfig = require('../database/models/EscaladeConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('./staffLog');

const DEFAULT_RULES = [
  { warnCount: 3, action: 'mute', duration: 60 },
  { warnCount: 5, action: 'mute', duration: 1440 },
  { warnCount: 7, action: 'ban', duration: null }
];

const ACTION_LABELS = {
  warn: '⚠️ Avertissement',
  mute: '🔇 Mute',
  kick: '👢 Kick',
  ban: '🔨 Ban'
};

const ACTION_COLORS = {
  warn: 0xFEE75C,
  mute: 0xE67E22,
  kick: 0xED4245,
  ban: 0x800000
};

/**
 * Adds a sanction, saves to DB, checks auto-escalation.
 * @returns {Promise<{sanction, escalation}>}
 */
async function addSanction(client, guild, data) {
  const sanction = await Sanction.create({
    guildId: guild.id,
    userId: data.userId,
    userTag: data.userTag,
    type: data.type,
    reason: data.reason,
    duration: data.duration || null,
    moderatorId: data.moderatorId,
    moderatorTag: data.moderatorTag,
    autoEscalation: false
  });

  let escalation = null;

  // Only check escalation for warns
  if (data.type === 'warn') {
    escalation = await checkEscalation(client, guild, data);
  }

  return { sanction, escalation };
}

async function checkEscalation(client, guild, data) {
  try {
    let config = await EscaladeConfig.findOne({ guildId: guild.id });
    if (config && !config.enabled) return null;

    const rules = config?.rules?.length ? config.rules : DEFAULT_RULES;
    const warnCount = await Sanction.countDocuments({ guildId: guild.id, userId: data.userId, type: 'warn' });

    const rule = rules.find(r => r.warnCount === warnCount);
    if (!rule) return null;

    // Fetch the member
    const member = await guild.members.fetch(data.userId).catch(() => null);
    if (!member) return null;

    // Apply the sanction
    if (rule.action === 'mute') {
      const durationMs = (rule.duration || 60) * 60 * 1000;
      await member.timeout(durationMs, `Auto-escalade : ${warnCount} avertissements`).catch(() => {});
    } else if (rule.action === 'kick') {
      await member.kick(`Auto-escalade : ${warnCount} avertissements`).catch(() => {});
    } else if (rule.action === 'ban') {
      await member.ban({ reason: `Auto-escalade : ${warnCount} avertissements` }).catch(() => {});
    }

    // Save the auto-escalation sanction
    await Sanction.create({
      guildId: guild.id,
      userId: data.userId,
      userTag: data.userTag,
      type: rule.action,
      reason: `Auto-escalade — ${warnCount} avertissements`,
      duration: rule.duration || null,
      moderatorId: 'BOT',
      moderatorTag: 'MoSeTo (Auto)',
      autoEscalation: true
    });

    // Log it
    const durationStr = rule.duration ? `${rule.duration} min` : 'permanent';
    logStaffAction(client,
      `🤖 **Auto-escalade** — \`${data.userTag}\` → **${ACTION_LABELS[rule.action]}**${rule.action === 'mute' ? ` (${durationStr})` : ''} | Seuil : ${warnCount} warns`
    );

    // Try to notify the user by DM
    try {
      const user = await client.users.fetch(data.userId);
      const actionStr = rule.action === 'mute'
        ? `mis en sourdine pendant **${durationStr}**`
        : rule.action === 'kick' ? 'expulsé du serveur' : 'banni du serveur';
      await user.send(
        `⚠️ **Action automatique sur ${guild.name}**\n` +
        `Suite à **${warnCount} avertissements**, tu as été ${actionStr}.\n` +
        `Raison : Auto-escalade de sanctions.`
      ).catch(() => {});
    } catch {}

    return { rule, warnCount };
  } catch {
    return null;
  }
}

/**
 * Returns all sanctions for a user in a guild, sorted newest first.
 */
async function getSanctions(guildId, userId) {
  return Sanction.find({ guildId, userId }).sort({ createdAt: -1 });
}

/**
 * Builds a summary embed for a user's sanctions.
 */
function buildSanctionEmbed(user, sanctions, guild) {
  const counts = { warn: 0, mute: 0, kick: 0, ban: 0 };
  for (const s of sanctions) counts[s.type] = (counts[s.type] || 0) + 1;

  const totalRisk = counts.warn + counts.mute * 3 + counts.kick * 5 + counts.ban * 10;
  const riskLevel = totalRisk === 0 ? '✅ Propre'
    : totalRisk < 5 ? '🟡 Faible'
    : totalRisk < 15 ? '🟠 Modéré'
    : '🔴 Élevé';

  const embed = new EmbedBuilder()
    .setTitle(`📋 Sanctions — ${user.tag || user}`)
    .setColor(totalRisk === 0 ? 0x57F287 : totalRisk < 5 ? 0xFEE75C : totalRisk < 15 ? 0xE67E22 : 0xED4245)
    .setThumbnail(user.displayAvatarURL ? user.displayAvatarURL() : null)
    .addFields(
      { name: '⚠️ Warns', value: `${counts.warn}`, inline: true },
      { name: '🔇 Mutes', value: `${counts.mute}`, inline: true },
      { name: '👢 Kicks', value: `${counts.kick}`, inline: true },
      { name: '🔨 Bans', value: `${counts.ban}`, inline: true },
      { name: '🧮 Total', value: `${sanctions.length}`, inline: true },
      { name: '🎯 Niveau de risque', value: riskLevel, inline: true }
    )
    .setTimestamp();

  for (const s of sanctions.slice(0, 8)) {
    const date = `<t:${Math.floor(new Date(s.createdAt).getTime() / 1000)}:R>`;
    const auto = s.autoEscalation ? ' *(auto)*' : '';
    const dur = s.duration ? ` — ${s.duration} min` : '';
    embed.addFields({
      name: `${ACTION_LABELS[s.type]}${auto}${dur} — ${date}`,
      value: `📝 ${s.reason}\n👮 ${s.moderatorTag}`
    });
  }

  if (sanctions.length > 8) embed.setFooter({ text: `Affichage de 8 sur ${sanctions.length} sanctions` });
  return embed;
}

module.exports = { addSanction, getSanctions, buildSanctionEmbed, DEFAULT_RULES, ACTION_LABELS, ACTION_COLORS };
