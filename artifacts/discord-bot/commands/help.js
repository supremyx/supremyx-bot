const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!help') return;

    const embed = new EmbedBuilder()
      .setTitle('📖 Commandes MoSeTo')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '👥 Équipes',
          value: [
            '`!register <nom>` — Enregistre une équipe',
            '`!unregister <nom>` — Supprime une équipe *(staff)*',
          ].join('\n')
        },
        {
          name: '🎮 Matchs',
          value: [
            '`!addmatch <nom> <placement> <kills>` — Ajoute un résultat *(staff)*',
            '`!resetmatch` — Remet tous les scores à zéro *(staff)*',
          ].join('\n')
        },
        {
          name: '🏆 Classement',
          value: [
            '`!ranking` — Classement complet',
            '`!top <n>` — Top N équipes (défaut : 3)',
          ].join('\n')
        },
        {
          name: '📊 Statistiques',
          value: [
            '`!stats <nom>` — Stats détaillées d\'une équipe',
            '`!history <nom>` — Historique paginé des matchs',
            '`!matchs` — Résumé global et records',
            '`!mvp` — Équipe avec le meilleur ratio kills/match',
          ].join('\n')
        }
      )
      .setFooter({ text: 'Les commandes staff nécessitent le rôle Administrateur' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
