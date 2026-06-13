const Season = require('../database/models/Season');
const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!content.startsWith('!nouvellesaison') && !content.startsWith('!finersaison') && !content.startsWith('!saisons') && !content.startsWith('!palmares')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !newseason <nom> ---
    if (cmd === '!nouvellesaison') {
      if (!isStaff) return message.reply('Staff uniquement');

      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!nouvellesaison <nom de la saison>`\nExemple : `!nouvellesaison Saison 2`');

      const existing = await Season.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (existing) return message.reply(`❌ Une saison nommée **${name}** existe déjà.`);

      const current = await Season.findOne({ active: true });
      if (current) return message.reply(`❌ La saison **${current.name}** est encore active. Ferme-la d'abord avec \`!endseason\`.`);

      try {
        await Season.create({ name, startedBy: message.author.tag });
      } catch (err) {
        if (err.code === 11000) {
          if (err.keyPattern && err.keyPattern.active) {
            return message.reply('❌ Une saison vient d\'être créée simultanément par un autre membre du staff. Vérifie avec `!saisons`.');
          }
          return message.reply(`❌ Une saison nommée **${name}** existe déjà.`);
        }
        throw err;
      }

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
    if (cmd === '!finersaison') {
      if (!isStaff) return message.reply('Staff uniquement');

      const activeSeason = await Season.findOne({ active: true });
      if (!activeSeason) return message.reply('❌ Aucune saison active en ce moment.');

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

      const endedAt = new Date();
      const season = await Season.findOneAndUpdate(
        { _id: activeSeason._id, active: true },
        { $set: { active: false, snapshot, endedBy: message.author.tag, endedAt } },
        { new: true }
      );
      if (!season) return message.reply('❌ La saison vient d\'être clôturée par un autre membre du staff.');

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
    if (cmd === '!palmares') {
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
    } catch (err) {
      console.error('[season] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
