/**
 * !mvpmatch <id_match> <nom_joueur>  — Désigner le MVP d'un match spécifique (Staff)
 * !mvpmatch liste                    — Voir les MVPs récents
 * !mvpmatch joueur <nom>             — MVPs d'un joueur
 */
const { EmbedBuilder } = require('discord.js');
const { escapeRegex } = require('../utils/lib');
const MatchMVP   = require('../database/models/MatchMVP');
const Match      = require('../database/models/Match');
const PlayerStat = require('../database/models/PlayerStat');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!mvpmatch')) return;

      const guildId = message.guild.id;
      const content = message.content.trim();
      const parts   = content.split(/\s+/);
      const sub     = parts[1];

      // !mvpmatch liste
      if (sub === 'liste') {
        const mvps = await MatchMVP.find({ guildId }).sort({ awardedAt: -1 }).limit(15).lean();
        if (!mvps.length) return message.reply('📭 Aucun MVP désigné pour le moment.');

        const lines = mvps.map((m, i) => {
          const date = new Date(m.awardedAt).toLocaleDateString('fr-FR');
          return `${i + 1}. 🏆 **${m.displayName}** _(${m.teamName})_ — ${m.kills} kills · ${date}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('🏆 MVPs récents')
          .setDescription(lines)
          .setColor(0xF1C40F)
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // !mvpmatch joueur <nom>
      if (sub === 'joueur') {
        const playerName = parts.slice(2).join(' ');
        if (!playerName) return message.reply('Usage : `!mvpmatch joueur <nom>`');

        const mvps = await MatchMVP.find({ guildId, displayName: { $regex: new RegExp(escapeRegex(playerName), 'i') } })
          .sort({ awardedAt: -1 }).lean();

        if (!mvps.length) return message.reply(`📭 **${playerName}** n'a pas encore de titre MVP.`);

        const lines = mvps.map((m, i) => {
          const date = new Date(m.awardedAt).toLocaleDateString('fr-FR');
          return `${i + 1}. 🏆 Match \`${m.matchId.slice(-6)}\` — ${m.kills} kills · ${date}${m.tournamentName ? ` · ${m.tournamentName}` : ''}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle(`🏆 MVPs — ${mvps[0].displayName}`)
          .setDescription(`**${mvps.length}** titre(s) MVP\n\n${lines}`)
          .setColor(0xF1C40F)
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // !mvpmatch <id_match> <nom_joueur>
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Désigner un MVP est réservé au staff.');

      const matchIdShort = parts[1];
      const playerName   = parts.slice(2).join(' ');

      if (!matchIdShort || !playerName)
        return message.reply('Usage : `!mvpmatch <id_match> <nom_joueur>` — ou `!mvpmatch liste` / `!mvpmatch joueur <nom>`');

      // Retrouver le match
      // Search by suffix of ObjectId (hex, no special regex chars needed but escape for safety)
      let match;
      try {
        match = await Match.findOne({ _id: { $regex: new RegExp(escapeRegex(matchIdShort), 'i') } }).lean();
      } catch {
        const all = await Match.find().sort({ createdAt: -1 }).limit(100).lean();
        match = all.find(m => m._id.toString().endsWith(matchIdShort));
      }

      if (!match) return message.reply(`❌ Match \`${matchIdShort}\` introuvable. Utilise les 6 derniers caractères de l'ID.`);

      // Trouver le joueur
      const stat = await PlayerStat.findOne({
        guildId,
        displayName: { $regex: new RegExp(escapeRegex(playerName), 'i') },
      }).lean();

      const displayName = stat?.displayName || playerName;
      const teamName    = stat?.teamName    || match.team;
      const kills       = stat ? Math.max(...(stat.history?.slice(-1).map(h => h.kills) || [0])) : 0;

      await MatchMVP.findOneAndUpdate(
        { guildId, matchId: match._id.toString() },
        { guildId, matchId: match._id.toString(), displayName, teamName, kills, tournamentName: match.tournamentName || '', awardedBy: message.author.username, awardedAt: new Date() },
        { upsert: true, new: true }
      );

      const embed = new EmbedBuilder()
        .setTitle('🏆 MVP désigné !')
        .setDescription(`**${displayName}** est le MVP du match \`${match._id.toString().slice(-6)}\``)
        .setColor(0xF1C40F)
        .addFields(
          { name: '🎮 Équipe',           value: teamName,              inline: true },
          { name: '🏟️ Match (tournoi)', value: match.tournamentName || 'Général', inline: true },
          { name: '📅 Désigné par',     value: message.author.username, inline: true },
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[mvpmatch] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
