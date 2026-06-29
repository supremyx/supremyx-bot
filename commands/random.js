const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();

    // --- !coinflip ---
    if (content === '!pileface') {
      const result = Math.random() < 0.5 ? '🪙 **Pile !**' : '🪙 **Face !**';
      const embed = new EmbedBuilder()
        .setTitle('Pile ou Face')
        .setDescription(result)
        .setColor(0xFEE75C)
        .setFooter({ text: `Lancé par ${message.author.tag}` })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    // --- !randteam [équipe1,équipe2,...] ---
    if (content.startsWith('!tirageequipe') || content.startsWith('!tirageteam')) {
      const raw = content.startsWith('!tirageequipe')
        ? content.slice('!tirageequipe'.length).trim()
        : content.slice('!tirageteam'.length).trim();
      let teams = [];

      if (raw) {
        // Teams passed manually
        teams = raw.split(',').map(t => t.trim()).filter(Boolean);
        if (teams.length < 2) {
          return message.reply('❌ Il faut au moins 2 équipes. Sépare-les par des virgules.\nExemple : `!tirageequipe TeamA,TeamB,TeamC,TeamD`');
        }
      } else {
        // Pull registered teams from DB
        const dbTeams = await Team.find().select('name');
        teams = dbTeams.map(t => t.name);
        if (teams.length < 2) {
          return message.reply('❌ Il faut au moins 2 équipes enregistrées, ou passe-les manuellement : `!tirageequipe TeamA,TeamB,TeamC`');
        }
      }

      const shuffled = shuffle(teams);

      // Build match-ups in pairs
      const pairs = [];
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        pairs.push(`⚔️ **${shuffled[i]}** vs **${shuffled[i + 1]}**`);
      }
      // If odd number, last team gets a bye
      if (shuffled.length % 2 !== 0) {
        pairs.push(`🎯 **${shuffled[shuffled.length - 1]}** — exempt (bye)`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🎲 Tirage au sort des équipes')
        .setColor(0xEB459E)
        .setDescription(pairs.join('\n\n'))
        .addFields({ name: '📋 Ordre de passage', value: shuffled.map((t, i) => `**${i + 1}.** ${t}`).join('\n') })
        .setFooter({ text: `Tirage par ${message.author.tag} • ${teams.length} équipe(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
    } catch (err) {
      console.error('[random] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
