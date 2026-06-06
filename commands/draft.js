const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Draft = require('../database/models/Draft');
const { logStaffAction } = require('../utils/staffLog');

function buildDraftEmbed(draft) {
  const currentTeam = draft.teams[draft.currentTeamIndex];
  const remaining = draft.pool.filter(p => !draft.picks.some(pk => pk.player === p));

  const embed = new EmbedBuilder()
    .setTitle(`🎲 Draft — Round ${draft.currentRound}`)
    .setColor(draft.active ? 0x5865F2 : 0x808080)
    .setTimestamp();

  // Show picks per team
  for (const team of draft.teams) {
    const teamPicks = draft.picks.filter(p => p.team === team).map(p => `• ${p.player}`);
    embed.addFields({
      name: `👥 ${team}`,
      value: teamPicks.length ? teamPicks.join('\n') : '*Aucun pick*',
      inline: true
    });
  }

  if (draft.active) {
    embed.addFields(
      { name: '🎯 C\'est au tour de', value: `**${currentTeam}**`, inline: false },
      { name: `🏊 Pool disponible (${remaining.length})`, value: remaining.length ? remaining.join(', ') : '*Pool vide — draft terminé !*', inline: false }
    );
    embed.setFooter({ text: `Round ${draft.currentRound} · Ordre snake · ${remaining.length} joueur(s) restant(s)` });
  } else {
    embed.setDescription('✅ Draft terminé !');
  }

  return embed;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    const content = message.content.trim();
    const lower = content.toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // --- !draft create <team1,team2,...> | <joueur1,joueur2,...> ---
    if (lower.startsWith('!draft create') || lower.startsWith('!draft new')) {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');

      const raw = content.slice(content.indexOf(' ', 6)).trim();
      const pipeIdx = raw.indexOf('|');
      if (pipeIdx === -1) return message.reply('Usage : `!draft create <team1,team2,...> | <joueur1,joueur2,...>`');

      const teams = raw.slice(0, pipeIdx).split(',').map(t => t.trim()).filter(Boolean);
      const pool = raw.slice(pipeIdx + 1).split(',').map(p => p.trim()).filter(Boolean);

      if (teams.length < 2) return message.reply('Minimum 2 équipes.');
      if (pool.length < teams.length) return message.reply('Il faut au moins autant de joueurs que d\'équipes.');

      // Close any existing active draft
      await Draft.updateMany({ guildId: message.guild.id, active: true }, { active: false });

      const draft = await Draft.create({
        guildId: message.guild.id,
        teams, pool,
        picks: [],
        currentTeamIndex: 0,
        currentRound: 1,
        snakeReversed: false,
        active: true,
        createdBy: message.author.tag
      });

      const remaining = pool.filter(p => !draft.picks.some(pk => pk.player === p));
      const buttons = remaining.slice(0, 5).map(p =>
        new ButtonBuilder().setCustomId(`draft_pick_${draft._id}_${encodeURIComponent(p)}`).setLabel(p).setStyle(ButtonStyle.Primary)
      );
      const row = new ActionRowBuilder().addComponents(...buttons);

      const sent = await message.channel.send({ embeds: [buildDraftEmbed(draft)], components: buttons.length ? [row] : [] });
      await Draft.findByIdAndUpdate(draft._id, { messageId: sent.id, channelId: message.channel.id });

      logStaffAction(client, `🎲 **Draft** créé : ${teams.join(', ')} | ${pool.length} joueur(s) | Par : ${message.author.tag}`);
      return;
    }

    // --- !draft pick <joueur> ---
    if (lower.startsWith('!draft pick')) {
      const playerName = content.slice('!draft pick'.length).trim();
      if (!playerName) return message.reply('Usage : `!draft pick <joueur>`');

      const draft = await Draft.findOne({ guildId: message.guild.id, active: true });
      if (!draft) return message.reply('❌ Aucune draft active. Lance-en une avec `!draft create`.');

      const currentTeam = draft.teams[draft.currentTeamIndex];
      const alreadyPicked = draft.picks.some(p => p.player.toLowerCase() === playerName.toLowerCase());
      if (alreadyPicked) return message.reply(`❌ **${playerName}** a déjà été drafté.`);

      const inPool = draft.pool.some(p => p.toLowerCase() === playerName.toLowerCase());
      if (!inPool) return message.reply(`❌ **${playerName}** n'est pas dans le pool.`);

      const actualName = draft.pool.find(p => p.toLowerCase() === playerName.toLowerCase());
      draft.picks.push({ team: currentTeam, player: actualName, round: draft.currentRound });

      // Snake draft: advance index
      const totalPicks = draft.picks.length;
      const teamsCount = draft.teams.length;
      const posInRound = totalPicks % teamsCount;

      if (posInRound === 0) {
        // New round
        draft.currentRound++;
        draft.snakeReversed = !draft.snakeReversed;
        draft.currentTeamIndex = draft.snakeReversed ? teamsCount - 1 : 0;
      } else {
        draft.currentTeamIndex = draft.snakeReversed ? draft.currentTeamIndex - 1 : draft.currentTeamIndex + 1;
      }

      const remaining = draft.pool.filter(p => !draft.picks.some(pk => pk.player === p));
      if (!remaining.length) draft.active = false;

      await draft.save();

      const buttons = remaining.slice(0, 5).map(p =>
        new ButtonBuilder().setCustomId(`draft_pick_${draft._id}_${encodeURIComponent(p)}`).setLabel(p).setStyle(ButtonStyle.Primary)
      );
      const row = buttons.length ? new ActionRowBuilder().addComponents(...buttons) : null;

      return message.channel.send({ embeds: [buildDraftEmbed(draft)], components: row ? [row] : [] });
    }

    // --- !draft status ---
    if (lower === '!draft status' || lower === '!draft') {
      const draft = await Draft.findOne({ guildId: message.guild.id, active: true });
      if (!draft) return message.reply('Aucune draft active.');
      return message.channel.send({ embeds: [buildDraftEmbed(draft)] });
    }

    // --- !draft cancel ---
    if (lower === '!draft cancel' || lower === '!draft stop') {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');
      const result = await Draft.updateMany({ guildId: message.guild.id, active: true }, { active: false });
      return message.reply(result.modifiedCount ? '✅ Draft annulée.' : '❌ Aucune draft active.');
    }
  });

  // Button interactions for draft
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('draft_pick_')) return;

    const parts = interaction.customId.split('_');
    const draftId = parts[2];
    const playerName = decodeURIComponent(parts.slice(3).join('_'));

    const draft = await Draft.findById(draftId);
    if (!draft || !draft.active) return interaction.reply({ content: '❌ Draft terminée.', ephemeral: true });

    const currentTeam = draft.teams[draft.currentTeamIndex];
    const alreadyPicked = draft.picks.some(p => p.player === playerName);
    if (alreadyPicked) return interaction.reply({ content: `❌ **${playerName}** déjà drafté.`, ephemeral: true });

    draft.picks.push({ team: currentTeam, player: playerName, round: draft.currentRound });

    const totalPicks = draft.picks.length;
    const teamsCount = draft.teams.length;
    const posInRound = totalPicks % teamsCount;

    if (posInRound === 0) {
      draft.currentRound++;
      draft.snakeReversed = !draft.snakeReversed;
      draft.currentTeamIndex = draft.snakeReversed ? teamsCount - 1 : 0;
    } else {
      draft.currentTeamIndex = draft.snakeReversed ? draft.currentTeamIndex - 1 : draft.currentTeamIndex + 1;
    }

    const remaining = draft.pool.filter(p => !draft.picks.some(pk => pk.player === p));
    if (!remaining.length) draft.active = false;
    await draft.save();

    const buttons = remaining.slice(0, 5).map(p =>
      new ButtonBuilder().setCustomId(`draft_pick_${draft._id}_${encodeURIComponent(p)}`).setLabel(p).setStyle(ButtonStyle.Primary)
    );
    const row = buttons.length ? new ActionRowBuilder().addComponents(...buttons) : null;

    await interaction.update({ embeds: [buildDraftEmbed(draft)], components: row ? [row] : [] });
  });
};
