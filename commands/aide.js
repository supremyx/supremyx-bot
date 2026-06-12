const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.content.trim() !== '!aide') return;

    const cd = checkCooldown(message.author.id, 'aide', 10);
    if (cd) return replyCooldown(message, cd, 'aide');

    const footer = { text: 'SUPREMYX Esports · Tape !aidestaff si tu es staff' };
    const color = 0xFF8C00;

    const embed1 = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'SUPREMYX — Aide générale', iconURL: client.user.displayAvatarURL() })
      .setDescription('Voici toutes les commandes disponibles pour la communauté.\n> 💡 Les paramètres entre `< >` sont **obligatoires**, entre `[ ]` sont **optionnels**.')
      .addFields(
        {
          name: '📊 Stats & Équipes',
          value: [
            '`!stats <équipe>` — Résumé des performances d\'une équipe',
            '`!equipe <nom>` — Fiche détaillée d\'une équipe',
            '`!classement` — Classement général des équipes',
            '`!top [N]` — Top N équipes (défaut : 10)',
            '`!comparer <T1> vs <T2>` — Comparer deux équipes',
            '`!historique <équipe>` — Historique de tous les matchs',
            '`!matchs` — Statistiques globales des matchs',
            '`!roster <équipe>` — Roster / composition d\'une équipe',
            '`!recherche <nom>` — Rechercher une équipe ou un joueur',
            '`!statsjoueur <nom>` — Stats d\'un joueur spécifique',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🏆 Tournois & Saisons',
          value: [
            '`!tournois` — Liste de tous les tournois',
            '`!detailtournoi <nom>` — Détails et classement d\'un tournoi',
            '`!inscrire <nom_équipe>` — Inscrire son équipe à un tournoi',
            '`!mvp` — MVP actuel (meilleur ratio kills)',
            '`!mvpsaison` — MVP des saisons passées',
            '`!saisons` — Historique et vainqueurs des saisons',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📈 Niveau & Profil',
          value: [
            '`!niveau` / `!rank` — Ton niveau XP et ta progression',
            '`!infouser [@user]` — Infos, niveau et avertissements d\'un membre',
            '`!serveur` — Informations sur le serveur Discord',
            '`!inforole @role` — Détails techniques d\'un rôle',
            '`!ping` — Latence du bot et de l\'API Discord',
            '`!status` — Statut du bot et aperçu des tournois',
          ].join('\n'),
          inline: false,
        }
      );

    const embed2 = new EmbedBuilder()
      .setColor(color)
      .addFields(
        {
          name: '🤖 Intelligence Artificielle',
          value: [
            '`!ia <question>` — Poser une question à l\'IA SUPREMYX',
            '`!ia reset` — Effacer l\'historique de conversation IA',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛠️ Outils & Utilitaires',
          value: [
            '`!rappel <durée> <texte>` — Se créer un rappel (ex: `!rappel 2h match ce soir`)',
            '`!afk [message]` — Passer en mode AFK (les mentions notifient l\'auteur)',
            '`!anniversaire <JJ/MM/AAAA>` — Enregistrer sa date d\'anniversaire',
            '`!pileface` — Lancer une pièce (pile ou face)',
            '`!dés` — Lancer un dé à 6 faces',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📬 Communauté & Signalements',
          value: [
            '`!suggestion <texte>` — Envoyer une suggestion au staff',
            '`!signaler <problème>` — Signaler un problème anonymement',
            '`!ticket` — Ouvrir un ticket de support',
            '`!sanctions [@user]` — Voir ses propres sanctions (ou celles d\'un membre)',
            '`!avertissements [@user]` — Voir l\'historique des avertissements',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📋 Règles & Infos Serveur',
          value: [
            '`!regles` — Afficher les règles du serveur',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter(footer)
      .setTimestamp();

    await message.channel.send({ embeds: [embed1] });
    await message.channel.send({ embeds: [embed2] });
  });
};
