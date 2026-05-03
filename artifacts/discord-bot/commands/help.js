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
          name: '🛠️ Utilitaires',
          value: [
            '`!ping` — Vérifie la latence du bot',
            '`!help` — Affiche cette aide',
          ].join('\n')
        },
        {
          name: '📢 Annonces',
          value: [
            '`!announce <message>` — Envoie une annonce en embed dans le salon dédié *(staff)*',
          ].join('\n')
        },
        {
          name: '🎮 Matchs',
          value: [
            '`!addmatch <nom> <placement> <kills>` — Ajoute un résultat *(staff)*',
            '`!resetmatch` — Remet tous les scores à zéro *(staff)*',
            '`!export` — Exporte le classement en CSV *(staff)*',
            '`!export matchs` — Exporte l\'historique des matchs en CSV *(staff)*',
            '`!backup` — Sauvegarde complète de la base de données en JSON (DM) *(staff)*',
          ].join('\n')
        },
        {
          name: '🏁 Tournois',
          value: [
            '`!newtournoi <nom>` — Lance un nouveau tournoi *(staff)*',
            '`!endtournoi` — Clôture le tournoi en cours + podium final *(staff)*',
            '`!tournois` — Historique de tous les tournois',
            '`!deletetournoi <nom>` — Supprime un tournoi et ses matchs *(staff)*',
          ].join('\n')
        },
        {
          name: '🏆 Classement',
          value: [
            '`!ranking` — Classement général',
            '`!ranking <tournoi>` — Classement d\'un tournoi spécifique',
            '`!top <n>` — Top N équipes (défaut : 3)',
          ].join('\n')
        },
        {
          name: '📊 Statistiques',
          value: [
            '`!search <nom>` — Recherche une équipe par nom partiel',
            '`!compare <équipe1> vs <équipe2>` — Duel côte-à-côte entre deux équipes',
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
