const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');

function buildBracket(teams) {
  // Pad to nearest power of 2
  const size = Math.pow(2, Math.ceil(Math.log2(teams.length)));
  const padded = [...teams];
  while (padded.length < size) padded.push('BYE');

  const rounds = [];
  let current = padded;

  while (current.length > 1) {
    const pairs = [];
    for (let i = 0; i < current.length; i += 2) {
      pairs.push([current[i], current[i + 1]]);
    }
    rounds.push(pairs);
    current = pairs.map(() => '?');
  }

  return rounds;
}

function roundName(index, total) {
  if (index === total - 1) return '🏆 Finale';
  if (index === total - 2) return '🥊 Demi-finales';
  if (index === total - 3) return '⚔️ Quarts de finale';
  return `📌 Tour ${index + 1}`;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!content.startsWith('!bracket')) return;

    const raw = content.slice('!bracket'.length).trim();
    let teams = [];

    if (raw) {
      teams = raw.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      const dbTeams = await Team.find().select('name');
      teams = dbTeams.map(t => t.name);
    }

    if (teams.length < 2) {
      return message.reply(
        '❌ Il faut au moins 2 équipes.\n' +
        'Usage : `!bracket` (équipes enregistrées) ou `!bracket TeamA,TeamB,TeamC,TeamD`'
      );
    }

    if (teams.length > 32) return message.reply('❌ Maximum 32 équipes par bracket.');

    // Shuffle
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const rounds = buildBracket(shuffled);

    const embed = new EmbedBuilder()
      .setTitle('🏆 Bracket du tournoi')
      .setColor(0xFEE75C)
      .setFooter({ text: `${shuffled.length} équipe(s) • Tirage aléatoire` })
      .setTimestamp();

    rounds.forEach((pairs, i) => {
      const name = roundName(i, rounds.length);
      const value = pairs.map(([a, b]) => `**${a}** ⚔️ **${b}**`).join('\n');
      embed.addFields({ name, value: value || '—' });
    });

    return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[bracket] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
