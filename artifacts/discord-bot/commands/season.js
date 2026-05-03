const Season = require('../database/models/Season');
const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!newseason') && !content.startsWith('!endseason') && !content.startsWith('!saisons') && !content.startsWith('!leaderboard')) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !newseason <nom> ---
    if (cmd === '!newseason') {
      if (!isStaff) return message.reply('Staff uniquement');

      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!newseason <nom de la saison>`\nExemple : `!newseason Saison 2`');

      const existing = await Season.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (existing) return message.reply(`❌ Une saison nommée **${name}** existe déjà.`);

      const current = await Season.findOne({ active: true });
      if (current) return message.reply(`❌ La saison **${current.name}** est encore active. Ferme-la d'abord avec \`!endseason\`.`);

      await Season.create({ name, startedBy: message.author.tag });

      const embed = new EmbedBuilder()
        .setTitle('🏁 Nouvelle saison lancée !')
        .setColor(0x57F287)
        .setDescription(`La saison **${name}** a commencé.\nLes matchs ajoutés seront comptabilisés dans cette saison.`)
        .setFooter({ text: `Lancée par ${message.author.tag}` })
        .setTimestamp();

      logStaffAction(client, `🏁 **Nouvelle saison** — "${name}" | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // --- !endseason ---
    if (cmd === '!endseason') {
      if (!isStaff) return message.reply('Staff uniquement');

      const season = await Season.findOne({ active: true });
      if (!season) return message.reply('❌ Aucune saison active en ce moment.');

      // Snapshot current rankings
      const teams = await Team.find().sort({ points: -1 });
      const snapshot = teams.map((t, i) => ({
        rank: i + 1,
        name: t.name,
        points: t.points,
        kills: t.kills,
        wins: t.wins,
        losses: t.losses
      }));

      season.active = false;
      season.snapshot = snapshot;
      season.endedBy = message.author.tag;
      season.endedAt = new Date();
      await season.save();

      const podium = snapshot.slice(0, 3).map((t, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        return `${medals[i]} **${t.name}** — ${t.points} pts`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Saison terminée — ${season.name}`)
        .setColor(0xFEE75C)
        .setDescription(`Le classement final a été sauvegardé.\n\n**Podium :**\n${podium}`)
        .setFooter({ text: `Fermée par ${message.author.tag}` })
        .setTimestamp();

      logStaffAction(client, `🏆 **Saison terminée** — "${season.name}" | ${snapshot.length} équipes sauvegardées | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // --- !saisons ---
    if (cmd === '!saisons') {
      const seasons = await Season.find().sort({ createdAt: -1 });
      if (!seasons.length) return message.reply('Aucune saison enregistrée.');

      const embed = new EmbedBuilder()
        .setTitle('📋 Historique des saisons')
        .setColor(0x5865F2)
        .setTimestamp();

      for (const s of seasons) {
        const status = s.active ? '🟢 En cours' : `🔴 Terminée le ${new Date(s.endedAt).toLocaleDateString('fr-FR')}`;
        const winner = !s.active && s.snapshot.length ? `🥇 ${s.snapshot[0].name}` : '';
        embed.addFields({
          name: s.name,
          value: `${status}${winner ? ` • ${winner}` : ''}\n📅 Démarrée le ${new Date(s.createdAt).toLocaleDateString('fr-FR')}`
        });
      }

      return message.channel.send({ embeds: [embed] });
    }

    // --- !leaderboard [nom de saison] ---
    if (cmd === '!leaderboard') {
      const seasonName = args.slice(1).join(' ').trim();

      // Historical season
      if (seasonName) {
        const season = await Season.findOne({ name: { $regex: new RegExp(seasonName, 'i') } });
        if (!season) return message.reply(`❌ Saison **${seasonName}** introuvable. Utilise \`!saisons\` pour voir la liste.`);
        if (season.active) return message.reply(`⚠️ La saison **${season.name}** est encore en cours. Utilise \`!ranking\` pour le classement actuel.`);
        if (!season.snapshot.length) return message.reply('❌ Aucune donnée sauvegardée pour cette saison.');

        const medals = ['🥇', '🥈', '🥉'];
        const rows = season.snapshot.map((t, i) => {
          const icon = medals[i] ?? `**${t.rank}.**`;
          return `${icon} **${t.name}** — ${t.points} pts • ${t.kills} kills`;
        });

        const embed = new EmbedBuilder()
          .setTitle(`🏆 Classement — ${season.name}`)
          .setColor(0xFEE75C)
          .setDescription(rows.join('\n'))
          .setFooter({ text: `Saison terminée le ${new Date(season.endedAt).toLocaleDateString('fr-FR')} • ${season.snapshot.length} équipes` })
          .setTimestamp(season.endedAt);

        return message.channel.send({ embeds: [embed] });
      }

      // Current live leaderboard
      const teams = await Team.find().sort({ points: -1 });
      if (!teams.length) return message.reply('Aucune équipe enregistrée.');

      const activeSeason = await Season.findOne({ active: true });
      const medals = ['🥇', '🥈', '🥉'];
      const rows = teams.map((t, i) => {
        const icon = medals[i] ?? `**${i + 1}.**`;
        return `${icon} **${t.name}** — ${t.points} pts • ${t.kills} kills`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Leaderboard${activeSeason ? ` — ${activeSeason.name}` : ' — Classement général'}`)
        .setColor(0x5865F2)
        .setDescription(rows.join('\n'))
        .setFooter({ text: `${teams.length} équipe(s) • En direct` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
