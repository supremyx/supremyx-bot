const Tournament = require('../database/models/Tournament');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const PAGE_SIZE = 5;

function buildEmbed(tournaments, page, totalPages) {
  const start = page * PAGE_SIZE;
  const rows = tournaments.slice(start, start + PAGE_SIZE).map((t, i) => {
    const status = t.active ? '🟢 En cours' : '🔴 Terminé';
    const date = new Date(t.startedAt).toLocaleDateString('fr-FR');
    const winner = t.winner ? `🥇 **${t.winner}**` : 'Aucun vainqueur';
    const matchInfo = t.active ? '' : ` | ${t.totalMatches} matchs | ${t.totalKills} kills`;
    return [
      `**${start + i + 1}. ${t.name}** ${status}`,
      `${winner} — démarré le ${date}${matchInfo}`
    ].join('\n');
  }).join('\n\n');

  const active = tournaments.filter(t => t.active).length;
  const finished = tournaments.filter(t => !t.active).length;

  return new EmbedBuilder()
    .setTitle('🏁 Historique des tournois')
    .setDescription(rows || 'Aucun tournoi.')
    .setColor(0xEB459E)
    .addFields(
      { name: '🟢 En cours', value: `${active}`, inline: true },
      { name: '🔴 Terminés', value: `${finished}`, inline: true },
      { name: '📊 Total', value: `${tournaments.length}`, inline: true }
    )
    .setFooter({ text: `Page ${page + 1}/${totalPages}` })
    .setTimestamp();
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!tournois') return;

    const tournaments = await Tournament.find().sort({ startedAt: -1 });

    if (!tournaments.length)
      return message.channel.send('Aucun tournoi enregistré. Lance-en un avec `!newtournoi <nom>`.');

    const totalPages = Math.ceil(tournaments.length / PAGE_SIZE);
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
      embeds: [buildEmbed(tournaments, page, totalPages)],
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
        embeds: [buildEmbed(tournaments, page, totalPages)],
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
