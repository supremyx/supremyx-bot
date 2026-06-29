/**
 * !draftequipe [N]  — Répartit les agents libres en N équipes équilibrées
 *                     par draft au serpent (snake draft) selon kills moyens.
 *                     Staff uniquement.
 */
const { EmbedBuilder } = require('discord.js');
const PlayerStat = require('../database/models/PlayerStat');
const Roster     = require('../database/models/Roster');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!draftequipe')) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const guildId = message.guild.id;
      const arg = message.content.slice('!draftequipe'.length).trim();
      const N = parseInt(arg, 10);
      if (isNaN(N) || N < 2 || N > 10)
        return message.reply('Usage : `!draftequipe <N>` — N entre 2 et 10 équipes.');

      await message.channel.sendTyping();

      // Récupérer tous les joueurs enregistrés
      const allStats = await PlayerStat.find({ guildId }).lean();
      if (allStats.length < N)
        return message.reply(`❌ Pas assez de joueurs enregistrés (${allStats.length}) pour former ${N} équipes.`);

      // Trier par kills moyens décroissants
      const players = allStats.map(p => ({
        name: p.displayName,
        avgKills: p.totalMatches > 0 ? p.totalKills / p.totalMatches : 0,
        totalKills: p.totalKills,
        totalMatches: p.totalMatches,
      })).sort((a, b) => b.avgKills - a.avgKills);

      // Snake draft : 1→N puis N→1 puis 1→N…
      const teams = Array.from({ length: N }, (_, i) => ({ id: i + 1, players: [], totalAvg: 0 }));
      let direction = 1;
      let teamIndex = 0;

      for (const player of players) {
        teams[teamIndex].players.push(player);
        teams[teamIndex].totalAvg += player.avgKills;
        teamIndex += direction;
        if (teamIndex >= N) { direction = -1; teamIndex = N - 1; }
        else if (teamIndex < 0) { direction = 1; teamIndex = 0; }
      }

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      const embed = new EmbedBuilder()
        .setTitle(`🎲 Draft Équipes (${N} équipes)`)
        .setDescription(`**${players.length} joueurs** répartis par snake draft basé sur les kills moyens.`)
        .setColor(0x5865F2)
        .setTimestamp();

      for (const team of teams) {
        const avg = team.players.length ? (team.totalAvg / team.players.length).toFixed(1) : '0.0';
        const list = team.players.map((p, i) =>
          `${i + 1}. **${p.name}** — ${p.avgKills.toFixed(1)} avg kills`
        ).join('\n');
        embed.addFields({
          name: `${medals[team.id - 1] || team.id} Équipe ${team.id} — Moy : ${avg} kills`,
          value: list || '—',
          inline: false,
        });
      }

      embed.setFooter({ text: 'Snake Draft · Tri par kills moyens · Résultat non sauvegardé' });
      message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[draft] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
