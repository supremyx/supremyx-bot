/**
 * !auditactivite [N]  — Rapport d'activité des équipes sur les N derniers jours (défaut : 30)
 *                       Staff uniquement.
 */
const { EmbedBuilder } = require('discord.js');
const Match      = require('../database/models/Match');
const Team       = require('../database/models/Team');
const PlayerStat = require('../database/models/PlayerStat');
const Absence    = require('../database/models/Absence');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!auditactivite')) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const arg = message.content.slice('!auditactivite'.length).trim();
      const N   = parseInt(arg, 10) || 30;
      if (N < 1 || N > 365) return message.reply('Usage : `!auditactivite [jours]` — entre 1 et 365 jours.');

      await message.channel.sendTyping();
      const guildId = message.guild.id;
      const since   = new Date(Date.now() - N * 24 * 60 * 60 * 1000);

      const [teams, recentMatches, absences] = await Promise.all([
        Team.find().lean(),
        Match.find({ createdAt: { $gte: since } }).lean(),
        Absence.find({ guildId, createdAt: { $gte: since } }).lean().catch(() => []),
      ]);

      if (!teams.length) return message.reply('❌ Aucune équipe enregistrée.');

      // Compter matchs par équipe
      const matchByTeam = {};
      const killsByTeam = {};
      for (const m of recentMatches) {
        matchByTeam[m.team]  = (matchByTeam[m.team]  || 0) + 1;
        killsByTeam[m.team]  = (killsByTeam[m.team]  || 0) + m.kills;
      }

      const totalMatchesPeriod = recentMatches.length;
      const activeTeams        = teams.filter(t => matchByTeam[t.name] > 0);
      const inactiveTeams      = teams.filter(t => !matchByTeam[t.name]);

      // Trier par matchs décroissants
      const ranked = teams
        .map(t => ({
          name:    t.name,
          matches: matchByTeam[t.name] || 0,
          kills:   killsByTeam[t.name] || 0,
        }))
        .sort((a, b) => b.matches - a.matches);

      const topTeam   = ranked[0];
      const worstTeam = ranked[ranked.length - 1];

      const lines = ranked.map((t, i) => {
        const bar = '█'.repeat(Math.min(t.matches, 15)) || '░';
        const status = t.matches === 0 ? '🔴 Inactif' : t.matches < 2 ? '🟡 Peu actif' : '🟢 Actif';
        return `\`${String(i + 1).padStart(2, ' ')}.\` **${t.name}** ${status}\n     ${bar} ${t.matches} match(s) · ${t.kills} kills`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`📋 Audit d'Activité — ${N} derniers jours`)
        .setDescription(lines.slice(0, 3800))
        .setColor(activeTeams.length >= teams.length * 0.7 ? 0x57F287 : 0xFEE75C)
        .addFields(
          { name: '📊 Total matchs (période)', value: totalMatchesPeriod.toString(),  inline: true },
          { name: '✅ Équipes actives',        value: activeTeams.length.toString(),   inline: true },
          { name: '❌ Équipes inactives',      value: inactiveTeams.length.toString(), inline: true },
          { name: '🔥 Équipe la + active',    value: topTeam.matches > 0 ? `${topTeam.name} (${topTeam.matches} matchs)` : '—', inline: true },
          { name: '⚠️ Absences déclarées',    value: absences.length.toString(), inline: true },
        )
        .setFooter({ text: `Rapport du ${new Date(since).toLocaleDateString('fr-FR')} au ${new Date().toLocaleDateString('fr-FR')} · Staff uniquement` })
        .setTimestamp();

      if (inactiveTeams.length) {
        embed.addFields({
          name: '🔴 Équipes sans match',
          value: inactiveTeams.map(t => t.name).join(', ') || '—',
          inline: false,
        });
      }

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[auditactivite] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
