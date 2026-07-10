const { EmbedBuilder } = require('discord.js');
const PlayerStat = require('../database/models/PlayerStat');
const Roster     = require('../database/models/Roster');
const Note       = require('../database/models/Note');
const Absence    = require('../database/models/Absence');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!depistage')) return;
      if (!message.member) return;

      const content = message.content.trim();
      const args    = content.slice('!depistage'.length).trim();
      const guildId = message.guild.id;

      const cd = checkCooldown(message.author.id, 'depistage', 15, message.guild?.id);
      if (cd) return replyCooldown(message, cd, 'depistage');

      // ── !depistage comparer <J1> vs <J2> ─────────────────────────────────────
      const vsIdx = args.toLowerCase().indexOf(' vs ');
      if (args.toLowerCase().startsWith('comparer ') || vsIdx !== -1) {
        const rest = args.toLowerCase().startsWith('comparer ')
          ? args.slice('comparer '.length).trim()
          : args;
        const vsI = rest.toLowerCase().indexOf(' vs ');
        if (vsI === -1) return message.reply('Usage : `!depistage comparer <J1> vs <J2>`');

        const name1 = rest.slice(0, vsI).trim();
        const name2 = rest.slice(vsI + 4).trim();

        const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const [s1, s2] = await Promise.all([
          PlayerStat.findOne({ guildId, displayName: new RegExp(`^${esc(name1)}$`, 'i') }),
          PlayerStat.findOne({ guildId, displayName: new RegExp(`^${esc(name2)}$`, 'i') }),
        ]);
        if (!s1) return message.reply(`❌ Joueur **${name1}** introuvable.`);
        if (!s2) return message.reply(`❌ Joueur **${name2}** introuvable.`);

        const avg1 = s1.totalMatches > 0 ? (s1.totalKills / s1.totalMatches).toFixed(2) : '0.00';
        const avg2 = s2.totalMatches > 0 ? (s2.totalKills / s2.totalMatches).toFixed(2) : '0.00';

        const rec = (v1, v2) => parseFloat(v1) > parseFloat(v2) ? '✅' : parseFloat(v1) < parseFloat(v2) ? '❌' : '➖';

        const embed = new EmbedBuilder()
          .setColor(0xEB459E)
          .setTitle(`🔍 Comparaison Scouting — ${s1.displayName} vs ${s2.displayName}`)
          .addFields(
            { name: 'Critère',           value: '🎮 Matchs joués\n🔫 Kills totaux\n📈 Kills/match\n⭐ Meilleur match\n🏷️ Équipe', inline: true },
            { name: s1.displayName,      value: `${s1.totalMatches}\n${s1.totalKills}\n${rec(avg1, avg2)} ${avg1}\n${s1.bestKills}\n${s1.teamName}`, inline: true },
            { name: s2.displayName,      value: `${s2.totalMatches}\n${s2.totalKills}\n${rec(avg2, avg1)} ${avg2}\n${s2.bestKills}\n${s2.teamName}`, inline: true },
          )
          .setFooter({ text: '!depistage <joueur> pour une fiche complète' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !depistage <joueur> ───────────────────────────────────────────────────
      const playerName = args.trim();
      if (!playerName) return message.reply('Usage : `!depistage <joueur>` ou `!depistage comparer <J1> vs <J2>`');

      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const stat = await PlayerStat.findOne({ guildId, displayName: new RegExp(`^${esc(playerName)}$`, 'i') });
      if (!stat) return message.reply(`❌ Joueur **${playerName}** introuvable.`);

      const avg   = stat.totalMatches > 0 ? (stat.totalKills / stat.totalMatches).toFixed(2) : '0.00';

      // Forme récente (5 derniers)
      const recent = (stat.history ?? []).slice(-5).reverse();
      const formeStr = recent.length
        ? recent.map(m => `#${m.teamPlacement} ${m.kills}k`).join(' · ')
        : 'Aucun match récent';

      // Tendance
      const last5  = (stat.history ?? []).slice(-5);
      const prev5  = (stat.history ?? []).slice(-10, -5);
      const avgL5  = last5.length  ? (last5.reduce((s, m) => s + m.kills, 0) / last5.length).toFixed(1) : null;
      const avgP5  = prev5.length  ? (prev5.reduce((s, m) => s + m.kills, 0) / prev5.length).toFixed(1) : null;
      const tendance = avgL5 && avgP5
        ? parseFloat(avgL5) >= parseFloat(avgP5) ? `📈 En hausse (${avgP5} → ${avgL5} kills/match)` : `📉 En baisse (${avgP5} → ${avgL5} kills/match)`
        : '—';

      // Statut équipe (roster)
      const rosterEntry = await Roster.findOne({ guildId, 'players.name': new RegExp(`^${esc(stat.displayName)}$`, 'i') });
      const statusStr = rosterEntry ? `🟢 Dans l'équipe **${rosterEntry.team}**` : '🔴 **Free agent** — disponible';

      // Notes staff
      const notes = await Note.find({ guildId, target: stat.teamName }).limit(1);
      const noteStr = notes.length ? `📝 ${notes[0].content}` : '—';

      // Absences récentes
      const absence = await Absence.findOne({ guildId, userId: { $exists: false }, team: stat.teamName });

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle(`🔍 Fiche Scouting — ${stat.displayName}`)
        .setDescription(statusStr)
        .addFields(
          { name: '📊 Stats globales',  value: `🎮 **${stat.totalMatches}** matchs\n🔫 **${stat.totalKills}** kills au total\n📈 **${avg}** kills/match\n⭐ Meilleur : **${stat.bestKills}** kills`, inline: true },
          { name: '🏷️ Équipe',          value: `**${stat.teamName || '—'}**`, inline: true },
          { name: '🔥 Forme récente',   value: formeStr, inline: false },
          { name: '📈 Tendance',        value: tendance, inline: false },
          { name: '📋 Note staff',      value: noteStr, inline: false },
        )
        .setFooter({ text: '!depistage comparer <J1> vs <J2> pour comparer deux joueurs' })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[scout]', err);
    }
  });
};
