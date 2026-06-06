const { EmbedBuilder } = require('discord.js');
const LiveScore = require('../database/models/LiveScore');
const { logStaffAction } = require('../utils/staffLog');

async function updateLiveMessage(client, liveScore) {
  if (!liveScore.channelId || !liveScore.messageId) return;
  try {
    const channel = client.channels.cache.get(liveScore.channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(liveScore.messageId);
    if (msg) await msg.edit({ embeds: [buildLiveEmbed(liveScore)] });
  } catch {}
}

function buildLiveEmbed(live) {
  const embed = new EmbedBuilder()
    .setTitle(`🔴 LIVE — ${live.matchTitle}`)
    .setColor(live.active ? 0xED4245 : 0x808080)
    .setTimestamp();

  if (!live.rounds.length) {
    embed.setDescription('*En attente du premier round...*');
    embed.setFooter({ text: 'Équipes : ' + live.teams.join(' · ') });
    return embed;
  }

  // Aggregate cumulative scores
  const totals = {};
  for (const team of live.teams) totals[team] = { kills: 0, points: 0, placements: [] };

  for (const round of live.rounds) {
    for (const s of round.scores) {
      if (!totals[s.team]) totals[s.team] = { kills: 0, points: 0, placements: [] };
      totals[s.team].kills += s.kills;
      totals[s.team].points += s.points;
      if (s.placement > 0) totals[s.team].placements.push(s.placement);
    }
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1].points - a[1].points || b[1].kills - a[1].kills);
  const medals = ['🥇', '🥈', '🥉'];

  const lines = sorted.map(([team, s], i) => {
    const m = medals[i] || `**${i + 1}.**`;
    return `${m} **${team}** — ${s.points} pts · ${s.kills} kills`;
  });

  embed.setDescription(lines.join('\n'));

  const lastRound = live.rounds[live.rounds.length - 1];
  const roundLines = lastRound.scores
    .sort((a, b) => a.placement - b.placement || b.kills - a.kills)
    .map(s => {
      const plIcon = s.placement === 1 ? '🥇' : s.placement <= 3 ? '🟢' : s.placement <= 5 ? '🟡' : '🔴';
      return `${plIcon} **${s.team}** — Pl. ${s.placement} · ${s.kills} kills · ${s.points} pts`;
    });

  embed.addFields({ name: `📋 Round ${lastRound.round}`, value: roundLines.join('\n') || '—' });
  embed.setFooter({ text: `Round ${live.rounds.length} · ${live.active ? 'LIVE EN COURS' : 'Match terminé'}` });

  return embed;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    const content = message.content.trim();
    const lower = content.toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // --- !livescore create <titre> | <team1,team2,...> [#salon] ---
    if (lower.startsWith('!livescore create') || lower.startsWith('!livescore new')) {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');

      const raw = content.slice(content.indexOf(' ', 11)).trim();
      const pipeIdx = raw.indexOf('|');
      if (pipeIdx === -1) return message.reply('Usage : `!livescore create <titre> | <team1,team2,...> [#salon]`');

      const matchTitle = raw.slice(0, pipeIdx).trim();
      const rest = raw.slice(pipeIdx + 1).trim();
      const mentionedChannel = message.mentions.channels.first();
      const teamsRaw = mentionedChannel ? rest.replace(/<#\d+>/, '').trim() : rest;
      const teams = teamsRaw.split(',').map(t => t.trim()).filter(Boolean);

      if (!matchTitle) return message.reply('Précise le titre du match.');
      if (teams.length < 2) return message.reply('Minimum 2 équipes.');

      await LiveScore.updateMany({ guildId: message.guild.id, active: true }, { active: false, endedAt: new Date() });

      const targetChannel = mentionedChannel || message.channel;

      const live = await LiveScore.create({
        guildId: message.guild.id,
        channelId: targetChannel.id,
        matchTitle, teams,
        rounds: [],
        active: true,
        createdBy: message.author.tag
      });

      const sent = await targetChannel.send({ embeds: [buildLiveEmbed(live)] });
      await LiveScore.findByIdAndUpdate(live._id, { messageId: sent.id });

      logStaffAction(client, `🔴 **LiveScore** créé : **${matchTitle}** | ${teams.join(', ')} | Par : ${message.author.tag}`);
      if (targetChannel.id !== message.channel.id) message.reply(`✅ LiveScore créé dans ${targetChannel}.`);
      return;
    }

    // --- !livescore addround <team:placement:kills:points> ... ---
    if (lower.startsWith('!livescore addround') || lower.startsWith('!livescore round')) {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');

      const live = await LiveScore.findOne({ guildId: message.guild.id, active: true });
      if (!live) return message.reply('❌ Aucun LiveScore actif. Lance-en un avec `!livescore create`.');

      const raw = content.slice(content.toLowerCase().indexOf('round') + 5).trim();
      if (!raw) return message.reply('Usage : `!livescore addround <team:placement:kills:points> ...`');

      const entries = raw.split(' ').map(e => {
        const parts = e.split(':');
        if (parts.length < 4) return null;
        const [teamRaw, placementRaw, killsRaw, pointsRaw] = parts;
        return {
          team: teamRaw,
          placement: parseInt(placementRaw) || 0,
          kills: parseInt(killsRaw) || 0,
          points: parseInt(pointsRaw) || 0
        };
      }).filter(Boolean);

      if (!entries.length) return message.reply('Format invalide. Ex : `TeamA:1:8:12 TeamB:2:5:9`');

      const roundNum = live.rounds.length + 1;
      live.rounds.push({ round: roundNum, scores: entries, addedAt: new Date() });
      await live.save();

      await updateLiveMessage(client, live);
      return message.reply(`✅ Round ${roundNum} enregistré.`);
    }

    // --- !livescore end ---
    if (lower === '!livescore end' || lower === '!livescore stop') {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');

      const live = await LiveScore.findOne({ guildId: message.guild.id, active: true });
      if (!live) return message.reply('❌ Aucun LiveScore actif.');

      live.active = false;
      live.endedAt = new Date();
      await live.save();
      await updateLiveMessage(client, live);

      logStaffAction(client, `🔴 **LiveScore terminé** : **${live.matchTitle}** | Par : ${message.author.tag}`);
      return message.reply('✅ LiveScore terminé. Le message a été mis à jour.');
    }

    // --- !livescore status ---
    if (lower === '!livescore status' || lower === '!livescore') {
      const live = await LiveScore.findOne({ guildId: message.guild.id, active: true });
      if (!live) return message.reply('❌ Aucun LiveScore actif en ce moment.');
      return message.channel.send({ embeds: [buildLiveEmbed(live)] });
    }
  });
};
