const { EmbedBuilder } = require('discord.js');
const Match      = require('../database/models/Match');
const Team       = require('../database/models/Team');
const Tournament = require('../database/models/Tournament');
const Season     = require('../database/models/Season');
const Schedule   = require('../database/models/Schedule');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const MEDALS = ['🥇', '🥈', '🥉'];

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    const args    = content.split(/\s+/);
    const cmd     = args[0].toLowerCase();

    // ── !vainqueurs ────────────────────────────────────────────────────────────
    if (cmd === '!vainqueurs') {
      const cd = checkCooldown(message.author.id, 'vainqueurs', 10);
      if (cd) return replyCooldown(message, cd, 'vainqueurs');

      const [tournaments, seasons] = await Promise.all([
        Tournament.find({ winner: { $ne: null } }).sort({ endedAt: -1 }),
        Season.find({ active: false, 'snapshot.0': { $exists: true } }).sort({ endedAt: -1 }),
      ]);

      const tournLines = tournaments.length
        ? tournaments.map((t, i) => `${MEDALS[i] ?? `**${i + 1}.**`} 🏆 **${t.winner}** — *${t.name}* (${fmtDate(t.endedAt)})`)
        : ['*Aucun tournoi terminé avec un vainqueur.*'];

      const seasonLines = seasons.length
        ? seasons.map((s, i) => {
            const top = s.snapshot[0];
            return `${MEDALS[i] ?? `**${i + 1}.**`} 🌟 **${top?.name ?? '?'}** — *${s.name}* (${fmtDate(s.endedAt)})`;
          })
        : ['*Aucune saison archivée.*'];

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({ name: '🏆 Historique des vainqueurs', iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '🏟️ Tournois', value: tournLines.join('\n'), inline: false },
          { name: '📅 Saisons', value: seasonLines.join('\n'), inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · Palmarès complet' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !prochainmatch ─────────────────────────────────────────────────────────
    if (cmd === '!prochainmatch') {
      const cd = checkCooldown(message.author.id, 'prochainmatch', 10);
      if (cd) return replyCooldown(message, cd, 'prochainmatch');

      const next = await Schedule.findOne({ date: { $gt: new Date() }, completed: false }).sort({ date: 1 });
      if (!next) return message.reply('📅 Aucun match planifié à venir. Utilise `!calendrier ajouter` pour en créer un.');

      const diff  = next.date - Date.now();
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000) / 60000);
      const countdown = days > 0 ? `${days}j ${hours}h ${mins}min` : hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: '📅 Prochain match planifié', iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '⚔️ Équipes', value: next.teams.join(' **vs** '), inline: false },
          { name: '📅 Date', value: fmtDate(next.date), inline: true },
          { name: '⏱️ Dans', value: countdown, inline: true },
          ...(next.tournamentName ? [{ name: '🏆 Tournoi', value: next.tournamentName, inline: true }] : []),
          ...(next.note ? [{ name: '📝 Note', value: next.note, inline: false }] : []),
        )
        .setFooter({ text: 'SUPREMYX Esports · !calendrier pour voir tous les matchs' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !annulermatch <id> ─────────────────────────────────────────────────────
    if (cmd === '!annulermatch') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const id = args[1];
      if (!id) return message.reply('Usage : `!annulermatch <id_du_match>`\nTrouve l\'ID avec `!historique <équipe>`.');

      let match;
      try {
        match = await Match.findById(id);
      } catch {
        return message.reply('❌ ID invalide. L\'ID doit être un identifiant MongoDB valide.');
      }
      if (!match) return message.reply(`❌ Match \`${id}\` introuvable.`);

      // Retirer les points/kills de l'équipe
      const team = await Team.findOne({ name: match.team });
      if (team) {
        team.points = Math.max(0, team.points - match.points);
        team.kills  = Math.max(0, team.kills  - match.kills);
        if (match.placement === 1) team.wins  = Math.max(0, team.wins - 1);
        else                       team.losses = Math.max(0, team.losses - 1);
        await team.save();
      }

      await Match.findByIdAndDelete(id);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: '🗑️ Match annulé', iconURL: client.user.displayAvatarURL() })
        .setDescription(`Le match \`${id}\` de **${match.team}** a été supprimé.`)
        .addFields(
          { name: 'Données retirées', value: `${match.points} pts · ${match.kills} kills · Placement #${match.placement}`, inline: false },
          { name: 'Stats équipe recalculées', value: team ? `${team.points} pts · ${team.kills} kills` : 'Équipe introuvable', inline: false },
        )
        .setFooter({ text: `Annulé par ${message.author.username}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !saisoncourante ────────────────────────────────────────────────────────
    if (cmd === '!saisoncourante') {
      const cd = checkCooldown(message.author.id, 'saisoncourante', 10);
      if (cd) return replyCooldown(message, cd, 'saisoncourante');

      const [season, topTeams, matchCount] = await Promise.all([
        Season.findOne({ active: true }),
        Team.find().sort({ points: -1 }).limit(3),
        Match.countDocuments(),
      ]);

      if (!season) return message.reply('📅 Aucune saison en cours. Utilise `!nouvellesaison <nom>` pour en démarrer une.');

      const rankLines = topTeams.length
        ? topTeams.map((t, i) => `${MEDALS[i] ?? `#${i + 1}`} **${t.name}** — ${t.points} pts | ${t.kills} kills`).join('\n')
        : '*Aucune équipe classée.*';

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `🌟 Saison en cours — ${season.name}`, iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '📅 Démarrée le', value: fmtDate(season.createdAt), inline: true },
          { name: '⚽ Matchs joués', value: `**${matchCount}**`, inline: true },
          { name: '🏆 Top 3 actuel', value: rankLines, inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · !classementsaison <nom> pour les saisons archivées' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !classementsaison <nom> ────────────────────────────────────────────────
    if (cmd === '!classementsaison') {
      const cd = checkCooldown(message.author.id, 'classementsaison', 10);
      if (cd) return replyCooldown(message, cd, 'classementsaison');

      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!classementsaison <nom_de_la_saison>`');

      const season = await Season.findOne({ name: new RegExp(`^${escRe(name)}$`, 'i') });
      if (!season) return message.reply(`❌ Saison **${name}** introuvable. Utilise \`!saisons\` pour voir la liste.`);

      if (!season.snapshot?.length) {
        return message.reply(`❌ La saison **${season.name}** n'a pas de classement archivé.`);
      }

      const lines = season.snapshot.map((s, i) =>
        `${MEDALS[i] ?? `**#${s.rank}**`} **${s.name}** — ${s.points} pts | ${s.kills} kills | ${s.wins}V/${s.losses}D`
      );

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({ name: `📋 Classement — ${season.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(lines.join('\n'))
        .addFields(
          { name: '🏆 Vainqueur', value: `**${season.snapshot[0]?.name ?? '—'}**`, inline: true },
          { name: '📅 Clôturée le', value: fmtDate(season.endedAt), inline: true },
        )
        .setFooter({ text: `SUPREMYX Esports · Saison archivée · ${season.snapshot.length} équipe(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // !matchs est géré par commands/matchs.js
  });
};
