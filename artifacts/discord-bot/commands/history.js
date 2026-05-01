const Match = require('../database/models/Match');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const PAGE_SIZE = 5;

function buildEmbed(teamName, matches, page, totalPages) {
  const start = page * PAGE_SIZE;
  const rows = matches.slice(start, start + PAGE_SIZE).map((m, i) => {
    const date = new Date(m.createdAt).toLocaleDateString('fr-FR');
    return `**${start + i + 1}.** \`#${m.placement}\` — ${m.kills} kills — +${m.points} pts *(${date})*`;
  }).join('\n');

  return new EmbedBuilder()
    .setTitle(`📋 Historique — ${teamName}`)
    .setDescription(rows || 'Aucun match.')
    .setColor(0x57F287)
    .setFooter({ text: `Page ${page + 1}/${totalPages} — ${matches.length} match(s) au total` })
    .setTimestamp();
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!history')) return;

    const name = message.content.split(' ')[1];
    if (!name) return message.reply('Usage : `!history <nom>`');

    const matches = await Match.find({ team: name }).sort({ createdAt: -1 });
    if (!matches.length) return message.reply(`Aucun match enregistré pour **${name}**.`);

    const totalPages = Math.ceil(matches.length / PAGE_SIZE);
    let page = 0;

    const prev = new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const next = new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1);

    const row = new ActionRowBuilder().addComponents(prev, next);

    const reply = await message.channel.send({
      embeds: [buildEmbed(name, matches, page, totalPages)],
      components: totalPages > 1 ? [row] : []
    });

    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
      filter: i => i.user.id === message.author.id
    });

    collector.on('collect', async interaction => {
      if (interaction.customId === 'next') page++;
      if (interaction.customId === 'prev') page--;

      prev.setDisabled(page === 0);
      next.setDisabled(page === totalPages - 1);

      await interaction.update({
        embeds: [buildEmbed(name, matches, page, totalPages)],
        components: [new ActionRowBuilder().addComponents(prev, next)]
      });
    });

    collector.on('end', async () => {
      prev.setDisabled(true);
      next.setDisabled(true);
      await reply.edit({ components: [new ActionRowBuilder().addComponents(prev, next)] }).catch(() => {});
    });
  });
};
