const { EmbedBuilder } = require('discord.js');
const Team       = require('../database/models/Team');
const PlayerStat = require('../database/models/PlayerStat');
const Roster     = require('../database/models/Roster');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const content = message.content.trim();
    const args    = content.split(/\s+/);
    const cmd     = args[0].toLowerCase();

    // ── !equipes ───────────────────────────────────────────────────────────────
    if (cmd === '!equipes') {
      const cd = checkCooldown(message.author.id, 'equipes', 10);
      if (cd) return replyCooldown(message, cd, 'equipes');

      const teams = await Team.find().sort({ points: -1 });
      if (!teams.length) return message.reply('❌ Aucune équipe enregistrée sur ce serveur.');

      const lines = teams.map((t, i) => {
        const matchCount = t.wins + t.losses;
        const wr = matchCount > 0 ? `${Math.round((t.wins / matchCount) * 100)}%` : '—';
        return `**${i + 1}.** **${t.name}** — ${t.points} pts | ${t.kills} kills | ${t.wins}V/${t.losses}D | WR ${wr}`;
      });

      const chunks = [];
      let current = '';
      for (const line of lines) {
        if ((current + '\n' + line).length > 3800) { chunks.push(current); current = line; }
        else { current = current ? current + '\n' + line : line; }
      }
      if (current) chunks.push(current);

      for (let i = 0; i < chunks.length; i++) {
        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setAuthor({ name: `👥 Toutes les équipes (${teams.length})`, iconURL: client.user.displayAvatarURL() })
          .setDescription(chunks[i])
          .setFooter({ text: `SUPREMYX Esports · Page ${i + 1}/${chunks.length}` })
          .setTimestamp();
        await message.channel.send({ embeds: [embed] });
      }
      return;
    }

    // ── !freeagents ────────────────────────────────────────────────────────────
    if (cmd === '!freeagents') {
      const cd = checkCooldown(message.author.id, 'freeagents', 15);
      if (cd) return replyCooldown(message, cd, 'freeagents');

      const guildId = message.guild.id;
      const [players, rosters, teams] = await Promise.all([
        PlayerStat.find({ guildId }),
        Roster.find({ guildId }),
        Team.find(),
      ]);

      const teamNames = new Set(teams.map(t => t.name.toLowerCase()));
      const rosterMembers = new Set(
        rosters.flatMap(r => r.members.map(m => m.displayName.toLowerCase()))
      );

      // Free agents = dans PlayerStat mais pas dans un roster d'équipe active
      const freeAgents = players.filter(p =>
        !rosterMembers.has(p.displayName.toLowerCase()) ||
        !teamNames.has(p.teamName.toLowerCase())
      );

      if (!freeAgents.length) return message.reply('✅ Aucun free agent détecté — tous les joueurs sont dans une équipe active.');

      const lines = freeAgents.map(p =>
        `• **${p.displayName}** _(ex-${p.teamName})_ — ${p.totalKills} kills · ${p.totalMatches} matchs`
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: `🔓 Free Agents (${freeAgents.length})`, iconURL: client.user.displayAvatarURL() })
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'SUPREMYX Esports · Joueurs non rattachés à une équipe active' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !transfert <joueur> | <ancienne> | <nouvelle> ─────────────────────────
    if (cmd === '!transfert') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const rest  = content.slice('!transfert'.length).trim();
      const parts = rest.split('|').map(s => s.trim());
      if (parts.length < 3) return message.reply('Usage : `!transfert <joueur> | <ancienne équipe> | <nouvelle équipe>`');

      const [playerName, oldTeamName, newTeamName] = parts;

      const [oldTeam, newTeam] = await Promise.all([
        Team.findOne({ name: new RegExp(`^${escRe(oldTeamName)}$`, 'i') }),
        Team.findOne({ name: new RegExp(`^${escRe(newTeamName)}$`, 'i') }),
      ]);

      if (!oldTeam) return message.reply(`❌ Équipe source **${oldTeamName}** introuvable.`);
      if (!newTeam) return message.reply(`❌ Équipe destination **${newTeamName}** introuvable.`);

      const guildId = message.guild.id;

      // Mettre à jour PlayerStat
      const stat = await PlayerStat.findOneAndUpdate(
        { guildId, displayName: new RegExp(`^${escRe(playerName)}$`, 'i'), teamName: new RegExp(`^${escRe(oldTeamName)}$`, 'i') },
        { teamName: newTeam.name },
        { new: true }
      );
      if (!stat) return message.reply(`❌ Joueur **${playerName}** introuvable dans l'équipe **${oldTeam.name}**.`);

      // Roster : retirer de l'ancienne, ajouter dans la nouvelle
      const oldRoster = await Roster.findOne({ guildId, teamName: new RegExp(`^${escRe(oldTeam.name)}$`, 'i') });
      if (oldRoster) {
        const idx = oldRoster.members.findIndex(m => m.displayName.toLowerCase() === playerName.toLowerCase());
        if (idx !== -1) {
          const [member] = oldRoster.members.splice(idx, 1);
          await oldRoster.save();

          // Ajouter dans le nouveau roster
          await Roster.findOneAndUpdate(
            { guildId, teamName: newTeam.name },
            { $push: { members: member }, updatedAt: new Date() },
            { upsert: true }
          );
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: '🔄 Transfert effectué', iconURL: client.user.displayAvatarURL() })
        .setDescription(`**${stat.displayName}** a été transféré de **${oldTeam.name}** vers **${newTeam.name}**.`)
        .addFields(
          { name: 'Stats conservées', value: `${stat.totalKills} kills · ${stat.totalMatches} matchs`, inline: true },
        )
        .setFooter({ text: `Effectué par ${message.author.username}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !capitaine <équipe> [joueur] ───────────────────────────────────────────
    if (cmd === '!capitaine') {
      const cd = checkCooldown(message.author.id, 'capitaine', 10);
      if (cd) return replyCooldown(message, cd, 'capitaine');

      const rest = content.slice('!capitaine'.length).trim();
      const pipeIdx = rest.indexOf('|');
      let teamName, playerName;

      if (pipeIdx !== -1) {
        teamName   = rest.slice(0, pipeIdx).trim();
        playerName = rest.slice(pipeIdx + 1).trim();
      } else {
        teamName = rest;
      }

      if (!teamName) return message.reply('Usage : `!capitaine <équipe>` ou `!capitaine <équipe> | <joueur>` (staff)');

      const guildId = message.guild.id;
      const roster  = await Roster.findOne({ guildId, teamName: new RegExp(`^${escRe(teamName)}$`, 'i') });
      if (!roster) return message.reply(`❌ Aucun roster trouvé pour **${teamName}**.`);

      // Setter (staff seulement)
      if (playerName) {
        if (!message.member.permissions.has('Administrator'))
          return message.reply('⛔ Seul le staff peut définir un capitaine.');

        const member = roster.members.find(m => m.displayName.toLowerCase() === playerName.toLowerCase());
        if (!member) return message.reply(`❌ **${playerName}** n'est pas dans le roster de **${roster.teamName}**.`);

        // Retirer l'ancien capitaine
        roster.members.forEach(m => { if (m.note === '⭐ Capitaine') m.note = ''; });
        member.note = '⭐ Capitaine';
        roster.updatedAt = new Date();
        await roster.save();

        return message.reply(`✅ **${member.displayName}** est maintenant le capitaine de **${roster.teamName}**.`);
      }

      // Affichage
      const captain = roster.members.find(m => m.note === '⭐ Capitaine' || m.role === 'IGL');
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setAuthor({ name: `⭐ Capitaine — ${roster.teamName}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(captain
          ? `Le capitaine de **${roster.teamName}** est **${captain.displayName}** (${captain.role})`
          : `Aucun capitaine défini pour **${roster.teamName}**.\nUtilise \`!capitaine ${roster.teamName} | <joueur>\` pour en définir un.`)
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !comparerjoueur <J1> | <J2> ───────────────────────────────────────────
    if (cmd === '!comparerjoueur') {
      const cd = checkCooldown(message.author.id, 'comparerjoueur', 10);
      if (cd) return replyCooldown(message, cd, 'comparerjoueur');

      const rest  = content.slice('!comparerjoueur'.length).trim();
      const parts = rest.split('|').map(s => s.trim());
      if (parts.length < 2) return message.reply('Usage : `!comparerjoueur <joueur1> | <joueur2>`');

      const [n1, n2] = parts;
      const guildId  = message.guild.id;

      const [p1, p2] = await Promise.all([
        PlayerStat.findOne({ guildId, displayName: new RegExp(`^${escRe(n1)}$`, 'i') }),
        PlayerStat.findOne({ guildId, displayName: new RegExp(`^${escRe(n2)}$`, 'i') }),
      ]);

      if (!p1) return message.reply(`❌ Joueur **${n1}** introuvable.`);
      if (!p2) return message.reply(`❌ Joueur **${n2}** introuvable.`);

      const avg1 = p1.totalMatches > 0 ? (p1.totalKills / p1.totalMatches).toFixed(2) : '0.00';
      const avg2 = p2.totalMatches > 0 ? (p2.totalKills / p2.totalMatches).toFixed(2) : '0.00';

      const winner = (stat1, stat2) => stat1 > stat2 ? '✅' : stat1 < stat2 ? '❌' : '🟰';

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: `⚔️ Comparaison — ${p1.displayName} vs ${p2.displayName}`, iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '📊 Stats', value: '**Total Kills**\n**Kills/Match**\n**Best match**\n**Matchs joués**\n**Équipe**', inline: true },
          { name: `🟧 ${p1.displayName}`, value: [`${winner(p1.totalKills, p2.totalKills)} **${p1.totalKills}**`, `${winner(+avg1, +avg2)} **${avg1}**`, `${winner(p1.bestKills, p2.bestKills)} **${p1.bestKills}**`, `**${p1.totalMatches}**`, `*${p1.teamName}*`].join('\n'), inline: true },
          { name: `🟦 ${p2.displayName}`, value: [`${winner(p2.totalKills, p1.totalKills)} **${p2.totalKills}**`, `${winner(+avg2, +avg1)} **${avg2}**`, `${winner(p2.bestKills, p1.bestKills)} **${p2.bestKills}**`, `**${p2.totalMatches}**`, `*${p2.teamName}*`].join('\n'), inline: true },
        )
        .setFooter({ text: '✅ = meilleur sur ce critère' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
