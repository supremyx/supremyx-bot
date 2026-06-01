const Team       = require('../database/models/Team');
const Match      = require('../database/models/Match');
const Schedule   = require('../database/models/Schedule');
const Tournament = require('../database/models/Tournament');
const Config     = require('../database/models/Config');
const Blacklist  = require('../database/models/Blacklist');
const ResultConfig = require('../database/models/ResultConfig');
const { EmbedBuilder } = require('discord.js');
const { staffLog }     = require('../utils/staffLog');
const { syncRanks }    = require('../utils/syncRanks');

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

async function getPoints(placement, kills) {
  const config = await Config.findOne();
  const ptMap = config?.pointSystem instanceof Map
    ? config.pointSystem
    : new Map([['1',10],['2',6],['3',5],['4',4],['5',3],['6',2],['7',1],['8',1]]);
  const killBonus = config?.killBonus ?? 1;
  return (ptMap.get(String(placement)) ?? 0) + (kills * killBonus);
}

async function getResultChannel(client, guild) {
  const cfg = await ResultConfig.findOne({ guildId: guild.id });
  if (!cfg?.channelId) return null;
  return client.channels.cache.get(cfg.channelId) || null;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!result')) return;
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    const args    = content.split(' ').slice(1);
    const sub     = args[0]?.toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // ─── !result channel #salon ───────────────────────────────────
    if (sub === 'channel') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');
      const target = message.mentions.channels.first() ||
                     (args[1] ? message.guild.channels.cache.get(args[1]) : null);
      if (!target) return message.reply('Usage : `!result channel #salon`');

      await ResultConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { channelId: target.id },
        { upsert: true }
      );
      return message.reply(`✅ Les résultats de matchs seront postés dans <#${target.id}>.`);
    }

    // ─── !result status ───────────────────────────────────────────
    if (sub === 'status') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');
      const cfg = await ResultConfig.findOne({ guildId: message.guild.id });
      const ch  = cfg?.channelId ? `<#${cfg.channelId}>` : '*non configuré*';
      return message.reply(`📢 **Salon des résultats :** ${ch}`);
    }

    // ─── !result from <scheduleId> <eq:place:kills> [...] ─────────
    // Post results linked to a scheduled match
    if (sub === 'from') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const scheduleId = args[1];
      const teamArgs   = args.slice(2);

      if (!scheduleId || !teamArgs.length)
        return message.reply(
          '**Usage :** `!result from <scheduleId> <équipe:placement:kills> [équipe:placement:kills ...]`\n' +
          '**Exemple :** `!result from 6641abc TeamA:1:8 TeamB:3:5 TeamC:5:2`'
        );

      const scheduled = await Schedule.findById(scheduleId).catch(() => null);
      if (!scheduled) return message.reply('❌ Match planifié introuvable. Vérifie l\'ID avec `!schedule`.');
      if (scheduled.completed) return message.reply('⚠️ Ce match a déjà été clôturé.');

      return processResults(client, message, teamArgs, scheduled);
    }

    // ─── !result <équipe:placement:kills> [...] ───────────────────
    // Quick post without schedule link
    if (args.length && args[0].includes(':')) {
      if (!isStaff) return message.reply('❌ Staff uniquement.');
      return processResults(client, message, args, null);
    }

    // ─── Help ─────────────────────────────────────────────────────
    return message.reply([
      '**Commandes `!result` :**',
      '',
      '**Poster des résultats (plusieurs équipes d\'un coup) :**',
      '`!result <eq:placement:kills> [eq:placement:kills ...]`',
      '`!result TeamA:1:8 TeamB:3:5 TeamC:5:2`',
      '',
      '**Lier à un match planifié :**',
      '`!result from <scheduleId> <eq:placement:kills> [...]`',
      '',
      '**Configuration :**',
      '`!result channel #salon` — Salon pour les résultats *(staff)*',
      '`!result status` — Voir la configuration *(staff)*',
    ].join('\n'));
  });
};

async function processResults(client, message, teamArgs, scheduled) {
  const activeTournoi = await Tournament.findOne({ active: true });
  const results = [];
  const errors  = [];

  for (const arg of teamArgs) {
    const parts = arg.split(':');
    if (parts.length < 3) { errors.push(`❌ Format invalide : \`${arg}\` (attendu \`équipe:placement:kills\`)`); continue; }

    const [rawName, rawPlace, rawKills] = parts;
    const placement = parseInt(rawPlace);
    const kills     = parseInt(rawKills);

    if (isNaN(placement) || isNaN(kills)) { errors.push(`❌ Placement/kills invalide pour **${rawName}**`); continue; }

    const blacklisted = await Blacklist.findOne({ target: { $regex: new RegExp(`^${rawName}$`, 'i') } });
    if (blacklisted) { errors.push(`🚫 **${rawName}** est dans la blacklist.`); continue; }

    const team = await Team.findOne({ name: { $regex: new RegExp('^' + rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
    if (!team) { errors.push(`❌ Équipe inconnue : **${rawName}**`); continue; }

    const pts = await getPoints(placement, kills);

    team.points += pts;
    team.kills  += kills;
    if (placement === 1) team.wins   += 1;
    else                 team.losses += 1;
    await team.save();

    await Match.create({
      team: team.name,
      placement,
      kills,
      points: pts,
      tournamentId:   activeTournoi?._id?.toString() || null,
      tournamentName: activeTournoi?.name            || null,
      addedBy: message.author.tag
    });

    results.push({ name: team.name, placement, kills, pts });
  }

  if (!results.length) {
    const errMsg = errors.join('\n');
    return message.reply(`❌ Aucun résultat enregistré.\n${errMsg}`);
  }

  // Sort by placement
  results.sort((a, b) => a.placement - b.placement);

  // Build embed
  const matchTitle = scheduled
    ? `${scheduled.teams.join(' vs ')}${scheduled.tournamentName ? ` — ${scheduled.tournamentName}` : ''}`
    : activeTournoi
      ? `Match — ${activeTournoi.name}`
      : 'Résultats du match';

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${matchTitle}`)
    .setColor(0xFEE75C)
    .setTimestamp()
    .setFooter({ text: `Posté par ${message.author.tag}` });

  const rows = results.map(r => {
    const medal = MEDAL[r.placement] ?? `**#${r.placement}**`;
    return `${medal} **${r.name}** — ${r.pts > 0 ? `+${r.pts} pts` : `${r.pts} pts`} | ${r.kills} kills`;
  });

  embed.setDescription(rows.join('\n'));

  if (scheduled) {
    const d = scheduled.date;
    embed.addFields({
      name:  '📆 Match planifié',
      value: `${d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long' })} à ${d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}`
    });
  }

  if (errors.length) embed.addFields({ name: '⚠️ Avertissements', value: errors.join('\n') });

  // Post in results channel if configured, otherwise in current channel
  const resultChannel = await getResultChannel(client, message.guild);
  const postChannel   = resultChannel || message.channel;
  await postChannel.send({ embeds: [embed] });

  if (resultChannel && resultChannel.id !== message.channel.id)
    message.reply(`✅ Résultats enregistrés et postés dans <#${resultChannel.id}>.`);
  else
    message.reply(`✅ **${results.length}** résultat(s) enregistré(s).`);

  // Mark scheduled match as completed
  if (scheduled) {
    scheduled.completed      = true;
    scheduled.resultPostedAt = new Date();
    await scheduled.save();
  }

  // Sync rank roles
  syncRanks(message.guild).catch(() => {});

  // Staff log
  const details = results.map(r =>
    `**${r.name}** — Place #${r.placement}, ${r.kills} kills, +${r.pts} pts`
  ).join('\n');
  await staffLog(client, {
    action:  'result',
    details: `**Match :** ${matchTitle}\n${details}${scheduled ? `\n**Match planifié :** clôturé` : ''}`,
    author:  message.author.tag
  });
}
