const { EmbedBuilder } = require('discord.js');
const Transfer = require('../database/models/Transfer');
const Roster = require('../database/models/Roster');
const Team = require('../database/models/Team');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    const content = message.content.trim();
    if (!content.toLowerCase().startsWith('!transfert')) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.slice('!transfert'.length).trim();
    const sub = args.split(' ')[0]?.toLowerCase();

    // --- !transfert history [joueur] ---
    if (sub === 'history' || sub === 'historique') {
      const playerName = args.slice(sub.length).trim();
      const query = { guildId: message.guild.id };
      if (playerName) query.playerName = { $regex: new RegExp(playerName, 'i') };

      const transfers = await Transfer.find(query).sort({ createdAt: -1 }).limit(20);
      if (!transfers.length) return message.reply('Aucun transfert enregistré.');

      const embed = new EmbedBuilder()
        .setTitle(`📋 Historique des transferts${playerName ? ` — ${playerName}` : ''}`)
        .setColor(0x5865F2)
        .setTimestamp();

      const lines = transfers.map(t => {
        const d = new Date(t.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `🔄 **${t.playerName}** · \`${t.fromTeam}\` → \`${t.toTeam}\`${t.reason ? ` *(${t.reason})*` : ''} — ${d}`;
      });

      embed.setDescription(lines.join('\n'));
      return message.channel.send({ embeds: [embed] });
    }

    // --- !transfert <joueur> de <équipeA> vers <équipeB> [| raison] ---
    if (!isStaff) return message.reply('⛔ Staff uniquement.');

    const pipeIdx = args.indexOf('|');
    const mainPart = pipeIdx >= 0 ? args.slice(0, pipeIdx).trim() : args;
    const reason = pipeIdx >= 0 ? args.slice(pipeIdx + 1).trim() : '';

    const deIdx = mainPart.toLowerCase().indexOf(' de ');
    const versIdx = mainPart.toLowerCase().indexOf(' vers ');

    if (deIdx === -1 || versIdx === -1 || versIdx < deIdx)
      return message.reply('Usage : `!transfert <joueur> de <équipeA> vers <équipeB> [| raison]`\nOu : `!transfert history [joueur]`');

    const playerName = mainPart.slice(0, deIdx).trim();
    const fromTeamName = mainPart.slice(deIdx + 4, versIdx).trim();
    const toTeamName = mainPart.slice(versIdx + 6).trim();

    const [fromTeam, toTeam] = await Promise.all([
      Team.findOne({ name: { $regex: new RegExp(`^${fromTeamName}$`, 'i') } }),
      Team.findOne({ name: { $regex: new RegExp(`^${toTeamName}$`, 'i') } }),
    ]);

    if (!fromTeam) return message.reply(`❌ Équipe **${fromTeamName}** introuvable.`);
    if (!toTeam) return message.reply(`❌ Équipe **${toTeamName}** introuvable.`);

    // Move player in rosters
    const fromRoster = await Roster.findOne({ guildId: message.guild.id, teamName: fromTeam.name });
    const mention = message.mentions.members.first();
    let userId = mention?.id || '';
    let displayName = playerName;

    if (fromRoster) {
      const memberIdx = fromRoster.members.findIndex(m =>
        (mention && m.userId === mention.id) ||
        m.displayName.toLowerCase() === playerName.toLowerCase()
      );

      if (memberIdx !== -1) {
        const member = fromRoster.members[memberIdx];
        userId = member.userId || userId;
        displayName = member.displayName;

        // Remove from old roster
        fromRoster.members.splice(memberIdx, 1);
        fromRoster.updatedAt = new Date();
        await fromRoster.save();

        // Add to new roster
        const toRoster = await Roster.findOneAndUpdate(
          { guildId: message.guild.id, teamName: toTeam.name },
          { $setOnInsert: { guildId: message.guild.id, teamName: toTeam.name } },
          { upsert: true, new: true }
        );
        toRoster.members.push({ userId: member.userId, userTag: member.userTag, displayName: member.displayName, role: member.role, note: member.note, joinedAt: new Date() });
        toRoster.updatedAt = new Date();
        await toRoster.save();
      }
    }

    // Save transfer history
    await Transfer.create({
      guildId: message.guild.id,
      playerName: displayName,
      userId,
      fromTeam: fromTeam.name,
      toTeam: toTeam.name,
      reason,
      transferredBy: message.author.tag
    });

    const embed = new EmbedBuilder()
      .setTitle('🔄 Transfert enregistré')
      .setColor(0xFEE75C)
      .addFields(
        { name: '👤 Joueur', value: displayName, inline: true },
        { name: '📤 Équipe quittée', value: fromTeam.name, inline: true },
        { name: '📥 Nouvelle équipe', value: toTeam.name, inline: true },
      )
      .setTimestamp();

    if (reason) embed.addFields({ name: '📝 Raison', value: reason, inline: false });
    embed.setFooter({ text: `Transféré par ${message.author.tag}` });

    logStaffAction(client, `🔄 **Transfert** — **${displayName}** : \`${fromTeam.name}\` → \`${toTeam.name}\`${reason ? ` *(${reason})*` : ''} | Par : ${message.author.tag}`);
    return message.channel.send({ embeds: [embed] });
  });
};
