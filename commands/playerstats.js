const PlayerStat = require('../database/models/PlayerStat');
const Roster     = require('../database/models/Roster');
const Team       = require('../database/models/Team');
const Match      = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex } = require('../utils/lib');

const ROLE_EMOJI = {
  IGL: '🎯', Fragger: '💥', Support: '🛡️', Sniper: '🔭',
  Entry: '🚪', Flex: '⚡', Coach: '📋', 'Remplaçant': '🔄'
};

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (
      !content.startsWith('!matchjoueur') &&
      !content.startsWith('!statsjoueur') &&
      !content.startsWith('!classjoueurs') &&
      !content.startsWith('!resetjoueur') &&
      !content.startsWith('!reinitjoueur')
    ) return;
    if (!message.guild) return;
    if (!message.member) return;
    if (message.author.bot) return;

    const args    = content.split(' ').slice(1);
    const cmd     = content.split(' ')[0].toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // ─── !playermatch <équipe> <joueur> <kills> ───────────────────
    if (cmd === '!matchjoueur') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const teamName   = args[0];
      const playerName = args[1];
      const kills      = parseInt(args[2]);

      if (!teamName || !playerName || isNaN(kills) || kills < 0)
        return message.reply(
          '**Usage :** `!matchjoueur <équipe> <joueur> <kills>`\n' +
          '**Exemple :** `!matchjoueur TeamA Pseudo 12`'
        );

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe inconnue : **${teamName}**`);

      // Verify the player is in the team's roster
      const roster = await Roster.findOne({ teamName: team.name });
      const inRoster = roster?.members?.some(m =>
        m.displayName.toLowerCase() === playerName.toLowerCase()
      );
      if (!inRoster) {
        return message.reply(
          `❌ **${playerName}** n'est pas dans le roster de **${team.name}**.\n` +
          `Vérifie avec \`!liste ${team.name}\` ou ajoute-le d'abord avec \`!ajouterplayer\`.`
        );
      }

      const lastMatch = await Match.findOne({ team: team.name }).sort({ createdAt: -1 });
      const placement      = lastMatch?.placement      ?? 0;
      const tournamentName = lastMatch?.tournamentName ?? '';
      const matchId        = lastMatch?._id?.toString() ?? '';

      const stat = await PlayerStat.findOneAndUpdate(
        { guildId: message.guild.id, teamName: team.name, displayName: playerName },
        {
          $inc:  { totalKills: kills, totalMatches: 1 },
          $push: { history: { kills, teamPlacement: placement, tournamentName, matchId, date: new Date() } },
          $setOnInsert: { userId: '' }
        },
        { upsert: true, new: true }
      );

      if (kills > stat.bestKills) {
        stat.bestKills = kills;
        await stat.save();
      }

      const avg = (stat.totalKills / stat.totalMatches).toFixed(1);
      logStaffAction(client, `🎮 **Perf joueur** — ${playerName} (${team.name}) : ${kills} kills | Total : ${stat.totalKills} | Moy : ${avg} | Par : ${message.author.tag}`);
      return message.reply(
        `✅ **${kills} kills** enregistrés pour **${playerName}** (${team.name}).\n` +
        `📊 Total : **${stat.totalKills}** kills en **${stat.totalMatches}** match(s) — moy. **${avg}** kills/match.`
      );
    }

    // ─── !playerstats <nom ou @mention> ──────────────────────────
    if (cmd === '!statsjoueur') {
      const mention = message.mentions.members.first();
      let stats = [];

      if (mention) {
        stats = await PlayerStat.find({ guildId: message.guild.id, userId: mention.id });
        if (!stats.length) {
          stats = await PlayerStat.find({
            guildId: message.guild.id,
            displayName: { $regex: new RegExp(escapeRegex(mention.displayName), 'i') }
          });
        }
      } else {
        const name = args.join(' ').trim();
        if (!name) return message.reply('Usage : `!statsjoueur <pseudo>` ou `!statsjoueur @mention`');
        stats = await PlayerStat.find({
          guildId: message.guild.id,
          displayName: { $regex: new RegExp(escapeRegex(name), 'i') }
        });
      }

      if (!stats.length)
        return message.reply('❌ Aucune statistique trouvée pour ce joueur. Utilise `!matchjoueur` pour en enregistrer.');

      const totalKills   = stats.reduce((s, p) => s + p.totalKills,   0);
      const totalMatches = stats.reduce((s, p) => s + p.totalMatches, 0);
      const bestKills    = Math.max(...stats.map(p => p.bestKills));
      const avg          = totalMatches > 0 ? (totalKills / totalMatches).toFixed(1) : '0.0';

      const primaryStat = stats.sort((a, b) => b.totalKills - a.totalKills)[0];

      const roster = await Roster.findOne({ guildId: message.guild.id, teamName: primaryStat.teamName });
      const member = roster?.members.find(m =>
        m.displayName.toLowerCase() === primaryStat.displayName.toLowerCase()
      );
      const roleLabel = member ? `${ROLE_EMOJI[member.role] ?? '🎮'} ${member.role}` : '';

      const allHistory = stats.flatMap(p => p.history)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      const formLine = allHistory.length
        ? allHistory.map(h => {
            const k = h.kills;
            return k >= 10 ? `🔥${k}` : k >= 5 ? `✅${k}` : `⬜${k}`;
          }).join(' ')
        : '*Aucun historique*';

      const embed = new EmbedBuilder()
        .setTitle(`👤 ${primaryStat.displayName}`)
        .setColor(0x5865F2)
        .addFields(
          { name: '🏷️ Équipe',        value: stats.map(s => s.teamName).join(', '), inline: true },
          ...(roleLabel ? [{ name: '🎮 Rôle', value: roleLabel, inline: true }] : []),
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '💥 Kills totaux',   value: `**${totalKills}**`,      inline: true },
          { name: '🎯 Matchs joués',   value: `**${totalMatches}**`,    inline: true },
          { name: '📈 Moy. kills',     value: `**${avg}** /match`,      inline: true },
          { name: '🏆 Record kills',   value: `**${bestKills}** kills`, inline: true },
          { name: '📊 5 derniers matchs', value: formLine, inline: false }
        )
        .setFooter({ text: 'SUPREMYX Stats — !playermatch pour enregistrer les perfs' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ─── !playerboard [équipe] ────────────────────────────────────
    if (cmd === '!classjoueurs') {
      const teamFilter = args[0] ? args.join(' ') : null;
      const query      = { guildId: message.guild.id, totalMatches: { $gt: 0 } };
      if (teamFilter) query.teamName = { $regex: new RegExp(escapeRegex(teamFilter), 'i') };

      const players = await PlayerStat.find(query).sort({ totalKills: -1 }).limit(15);

      if (!players.length)
        return message.reply('❌ Aucune statistique joueur enregistrée pour le moment.');

      const MEDALS = ['🥇', '🥈', '🥉'];
      const rows = players.map((p, i) => {
        const avg = (p.totalKills / p.totalMatches).toFixed(1);
        return `${MEDALS[i] ?? `**${i + 1}.**`} **${p.displayName}** *(${p.teamName})* — ${p.totalKills} kills | moy. ${avg} | best ${p.bestKills}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(teamFilter ? `💥 Top joueurs — ${teamFilter}` : '💥 Top joueurs — Classement kills')
        .setColor(0xED4245)
        .setDescription(rows.join('\n'))
        .setFooter({ text: `${players.length} joueur(s) • SUPREMYX` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ─── !playerreset <équipe> <joueur> ──────────────────────────
    if (cmd === '!reinitjoueur' || cmd === '!resetjoueur') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const teamName   = args[0];
      const playerName = args.slice(1).join(' ').trim();
      if (!teamName || !playerName)
        return message.reply('Usage : `!reinitjoueur <équipe> <joueur>`');

      const deleted = await PlayerStat.findOneAndDelete({
        guildId: message.guild.id,
        teamName,
        displayName: { $regex: new RegExp(`^${escapeRegex(playerName)}$`, 'i') }
      });

      if (!deleted) return message.reply('❌ Joueur introuvable.');

      logStaffAction(client, `🗑️ **Stats joueur réinitialisées** — ${playerName} (${teamName}) | Par : ${message.author.tag}`);
      return message.reply(`✅ Stats de **${playerName}** (${teamName}) réinitialisées.`);
    }
    } catch (err) {
      console.error('[playerstats] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
