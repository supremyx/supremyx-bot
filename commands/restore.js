const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const { EmbedBuilder } = require('discord.js');
const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!restaurer') return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const attachment = message.attachments.first();
    if (!attachment || !attachment.name.endsWith('.json'))
      return message.reply('Attache un fichier `.json` de sauvegarde à ton message.\nExemple : `!restaurer` + fichier `backup_moseto_XX-XX-XXXX.json`');

    const waiting = await message.reply('⏳ Restauration en cours...');

    let backup;
    try {
      const raw = await fetchUrl(attachment.url);
      backup = JSON.parse(raw);
    } catch {
      return waiting.edit('❌ Fichier JSON invalide ou illisible.');
    }

    const { teams = [], matches = [], tournaments = [] } = backup.data ?? {};

    if (!teams.length && !matches.length && !tournaments.length)
      return waiting.edit('❌ Le fichier de backup ne contient aucune donnée.');

    // Confirmation step — ask before wiping
    await waiting.edit(
      `⚠️ **Confirmation requise**\n` +
      `Cette action va **effacer** toutes les données actuelles et les remplacer par :\n` +
      `> 👥 **${teams.length}** équipe(s)\n` +
      `> 🎮 **${matches.length}** match(s)\n` +
      `> 🏁 **${tournaments.length}** tournoi(s)\n\n` +
      `Réponds \`CONFIRMER\` dans les 30 secondes pour valider.`
    );

    const filter = m => m.author.id === message.author.id && m.content === 'CONFIRMER';
    let confirmed = false;
    try {
      await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
      confirmed = true;
    } catch {
      return waiting.edit('❌ Restauration annulée (délai dépassé).');
    }

    if (!confirmed) return;

    // Wipe and restore
    await Promise.all([
      Team.deleteMany({}),
      Match.deleteMany({}),
      Tournament.deleteMany({})
    ]);

    const clean = docs => docs.map(d => {
      const copy = { ...d };
      delete copy._id;
      delete copy.__v;
      return copy;
    });

    const results = { teams: 0, matches: 0, tournaments: 0 };

    if (teams.length) {
      const inserted = await Team.insertMany(clean(teams), { ordered: false }).catch(() => []);
      results.teams = inserted.length;
    }
    if (matches.length) {
      const inserted = await Match.insertMany(clean(matches), { ordered: false }).catch(() => []);
      results.matches = inserted.length;
    }
    if (tournaments.length) {
      const inserted = await Tournament.insertMany(clean(tournaments), { ordered: false }).catch(() => []);
      results.tournaments = inserted.length;
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Restauration terminée')
      .setColor(0x57F287)
      .addFields(
        { name: '👥 Équipes', value: `${results.teams}`, inline: true },
        { name: '🎮 Matchs', value: `${results.matches}`, inline: true },
        { name: '🏁 Tournois', value: `${results.tournaments}`, inline: true }
      )
      .setDescription(`Backup du **${backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('fr-FR') : 'date inconnue'}** restauré avec succès.`)
      .setFooter({ text: `Restauré par ${message.author.tag}` })
      .setTimestamp();

    waiting.edit({ content: '', embeds: [embed] });
  });
};
