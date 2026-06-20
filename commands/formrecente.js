const Match = require('../database/models/Match');
const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');
const { escapeRegex } = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      const content = message.content.trim();
      if (!content.startsWith('!formrecente')) return;
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const cd = checkCooldown(message.author.id, 'formrecente', 10);
      if (cd) return replyCooldown(message, cd, 'formrecente');

      const raw = content.slice('!formrecente'.length).trim();
      if (!raw) return message.reply('**Usage :** `!formrecente <équipe> [N]`\nExemple : `!formrecente TeamAlpha 10`');

      const parts = raw.split(' ');
      const lastPart = parts[parts.length - 1];
      const nParsed = parseInt(lastPart);
      let N = 5;
      let teamName;

      if (!isNaN(nParsed) && nParsed >= 1 && nParsed <= 20 && parts.length > 1) {
        N = nParsed;
        teamName = parts.slice(0, -1).join(' ').trim();
      } else {
        teamName = raw;
      }

      if (!teamName) return message.reply('**Usage :** `!formrecente <équipe> [N]`\nExemple : `!formrecente TeamAlpha 10`');

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable. Vérifie l'orthographe ou consulte \`!equipes\`.`);

      const matches = await Match.find({ team: { $regex: new RegExp(`^${escapeRegex(team.name)}$`, 'i') } })
        .sort({ createdAt: -1 })
        .limit(N);

      if (!matches.length) return message.reply(`❌ Aucun match enregistré pour **${team.name}**.`);

      function formIcon(placement) {
        if (placement === 1) return '🥇';
        if (placement <= 3) return '🏅';
        if (placement <= 5) return '🟢';
        if (placement <= 8) return '🟡';
        return '🔴';
      }

      const wins = matches.filter(m => m.placement === 1).length;
      const top3 = matches.filter(m => m.placement <= 3).length;
      const top5 = matches.filter(m => m.placement <= 5).length;
      const totalKills = matches.reduce((s, m) => s + m.kills, 0);
      const totalPts = matches.reduce((s, m) => s + m.points, 0);
      const avgPlace = (matches.reduce((s, m) => s + m.placement, 0) / matches.length).toFixed(1);

      const rows = matches.map(m => {
        const date = new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        const tourney = m.tournamentName ? ` · *${m.tournamentName}*` : '';
        return `${formIcon(m.placement)} **#${m.placement}** — ${m.kills} kills · ${m.points} pts · \`${date}\`${tourney}`;
      });

      const formBar = matches.map(m => formIcon(m.placement)).join(' ');
      const winRate = ((wins / matches.length) * 100).toFixed(0);

      let color = 0xFEE75C;
      if (wins >= matches.length * 0.4) color = 0x57F287;
      else if (matches.filter(m => m.placement > 8).length > matches.length * 0.5) color = 0xED4245;

      const embed = new EmbedBuilder()
        .setTitle(`📈 Forme récente — ${team.name}`)
        .setColor(color)
        .setDescription(`${formBar}\n\n${rows.join('\n')}`)
        .addFields(
          { name: '🥇 Victoires', value: `${wins}/${matches.length} (${winRate}%)`, inline: true },
          { name: '🏅 Top 3', value: `${top3}/${matches.length}`, inline: true },
          { name: '🟢 Top 5', value: `${top5}/${matches.length}`, inline: true },
          { name: '💀 Kills tot.', value: `${totalKills}`, inline: true },
          { name: '🏆 Pts tot.', value: `${totalPts}`, inline: true },
          { name: '📍 Place moy.', value: `#${avgPlace}`, inline: true },
        )
        .setFooter({ text: `${matches.length} dernier(s) match(s) · 🥇=1er 🏅=Top3 🟢=Top5 🟡=Top8 🔴=Hors top` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[formrecente]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
