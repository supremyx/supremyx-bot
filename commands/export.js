const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!export')) return;
    if (!message.guild) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const arg = message.content.split(' ')[1]?.toLowerCase();

    const [teams, matches, activeTournoi] = await Promise.all([
      Team.find().sort({ points: -1 }),
      Match.find().sort({ createdAt: -1 }),
      Tournament.findOne({ active: true })
    ]);

    if (!teams.length) return message.reply('Aucune équipe à exporter.');

    const now = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');

    // --- CSV classement ---
    if (!arg || arg === 'ranking') {
      const matchCounts = {};
      for (const m of matches) {
        matchCounts[m.team] = (matchCounts[m.team] || 0) + 1;
      }

      const header = 'Rang,Equipe,Points,Kills,Matchs,Kills/Match';
      const rows = teams.map((t, i) => {
        const count = matchCounts[t.name] || 0;
        const avg = count > 0 ? (t.kills / count).toFixed(2) : '0.00';
        return `${i + 1},${t.name},${t.points},${t.kills},${count},${avg}`;
      });

      const csv = [header, ...rows].join('\n');
      const buffer = Buffer.from(csv, 'utf-8');
      const file = new AttachmentBuilder(buffer, { name: `classement_${now}.csv` });

      const embed = new EmbedBuilder()
        .setTitle('📤 Export — Classement')
        .setColor(0x57F287)
        .setDescription(`**${teams.length}** équipe(s) exportée(s)${activeTournoi ? ` — Tournoi : **${activeTournoi.name}**` : ''}`)
        .setFooter({ text: `Exporté par ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed], files: [file] });
    }

    // --- CSV historique matchs ---
    if (arg === 'matchs') {
      if (!matches.length) return message.reply('Aucun match à exporter.');

      const header = 'Date,Equipe,Placement,Kills,Points,Tournoi,AjoutePar';
      const rows = matches.map(m => {
        const date = new Date(m.createdAt).toLocaleDateString('fr-FR');
        return `${date},${m.team},${m.placement},${m.kills},${m.points},${m.tournamentName || '-'},${m.addedBy || '-'}`;
      });

      const csv = [header, ...rows].join('\n');
      const buffer = Buffer.from(csv, 'utf-8');
      const file = new AttachmentBuilder(buffer, { name: `matchs_${now}.csv` });

      const embed = new EmbedBuilder()
        .setTitle('📤 Export — Historique des matchs')
        .setColor(0x5865F2)
        .setDescription(`**${matches.length}** match(s) exporté(s)`)
        .setFooter({ text: `Exporté par ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed], files: [file] });
    }

    message.reply('Usage : `!export` — classement\n`!export matchs` — historique des matchs');
  });
};
