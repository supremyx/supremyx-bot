const PlayerStat = require('../database/models/PlayerStat');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const MEDALS = ['🥇', '🥈', '🥉'];
const COLORS = [0xFFD700, 0xC0C0C0, 0xCD7F32];
const LABELS = ['1er', '2ème', '3ème'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!top3')) return;

      const cd = checkCooldown(message.author.id, 'top3', 10);
      if (cd) return replyCooldown(message, cd, 'top3');

      const args = message.content.trim().split(/\s+/).slice(1);

      // Période : !top3 [7|30|saison] — défaut 7 jours
      let days = 7;
      let label = '7 derniers jours';
      let saisonMode = false;

      if (args[0] === '30') { days = 30; label = '30 derniers jours'; }
      else if (args[0] === 'mois') { days = 30; label = '30 derniers jours'; }
      else if (args[0] === 'saison') { saisonMode = true; label = 'toute la saison'; }

      const players = await PlayerStat.find({ guildId: message.guild.id });

      if (!players.length)
        return message.reply('❌ Aucun joueur enregistré sur ce serveur.');

      const cutoff = saisonMode ? new Date(0) : new Date(Date.now() - days * 86_400_000);

      const ranked = players
        .map(p => {
          const weekKills = p.history
            .filter(h => new Date(h.date) >= cutoff)
            .reduce((s, h) => s + h.kills, 0);
          const weekMatches = p.history.filter(h => new Date(h.date) >= cutoff).length;
          return { name: p.displayName, team: p.teamName, weekKills, weekMatches };
        })
        .filter(p => p.weekKills > 0)
        .sort((a, b) => b.weekKills - a.weekKills)
        .slice(0, 3);

      if (!ranked.length)
        return message.reply(`❌ Aucun kill enregistré sur les ${saisonMode ? 'cette saison' : label}.`);

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Top 3 joueurs — ${label}`)
        .setColor(COLORS[0])
        .setTimestamp()
        .setFooter({ text: `SUPREMYX CI · Utilisez !top3 30 ou !top3 saison pour d'autres périodes` });

      // Champ podium principal
      const podiumLines = ranked.map((p, i) => {
        const avg = p.weekMatches > 0 ? (p.weekKills / p.weekMatches).toFixed(1) : '—';
        return [
          `${MEDALS[i]} **${LABELS[i]} — ${p.name}**`,
          `> 💀 **${p.weekKills}** kills · 🎮 ${p.weekMatches} match${p.weekMatches > 1 ? 's' : ''} · ⚡ ${avg} moy.`,
          `> 🏠 ${p.team}`,
        ].join('\n');
      }).join('\n\n');

      embed.setDescription(podiumLines);

      // Champs inline détaillés pour chaque joueur
      ranked.forEach((p, i) => {
        const avg = p.weekMatches > 0 ? (p.weekKills / p.weekMatches).toFixed(1) : '—';
        embed.addFields({
          name: `${MEDALS[i]} ${p.name}`,
          value: [
            `💀 **Kills :** ${p.weekKills}`,
            `⚡ **Moy. :** ${avg}`,
            `🎮 **Matchs :** ${p.weekMatches}`,
          ].join('\n'),
          inline: true,
        });
      });

      // Remplir la ligne pour aligner les champs (Discord affiche 3 par ligne)
      if (ranked.length === 2) {
        embed.addFields({ name: '\u200b', value: '\u200b', inline: true });
      }

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[top3] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
