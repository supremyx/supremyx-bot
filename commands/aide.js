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
      .setDescription('Toutes les commandes disponibles pour la communauté.\n> 💡 Paramètres `< >` **obligatoires**, `[ ]` **optionnels**.')
      .addFields(
        {
          name: '📊 Stats & Équipes',
          value: [
            '`!stats <équipe>` — Résumé des performances d\'une équipe',
            '`!infoequipe <équipe>` — Fiche détaillée d\'une équipe',
            '`!classement` — Classement général des équipes',
            '`!top [N]` — Top N équipes (défaut : 10)',
            '`!comparer <T1> vs <T2>` — Comparer deux équipes face à face',
            '`!historique <équipe>` — Historique complet des matchs',
            '`!matchs` — Statistiques globales de tous les matchs',
            '`!liste <équipe>` — Roster / composition d\'une équipe',
            '`!composition <équipe>` — Voir la composition détaillée',
            '`!recherche <nom>` — Rechercher une équipe ou un joueur',
          ].join('\n'),
          inline: false,
        },
        {
          name: '👤 Stats Joueurs',
          value: [
            '`!statsjoueur <nom>` — Stats complètes d\'un joueur',
            '`!matchjoueur <nom>` — Historique des matchs d\'un joueur',
            '`!classjoueurs` — Classement général des joueurs',
            '`!classniveau` — Classement par niveau XP',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📈 Stats Avancées',
          value: [
            '`!serie <équipe>` — Série de victoires/défaites en cours',
            '`!calculer <équipe>` — Calcul avancé des performances',
            '`!regularite <équipe>` — Indice de régularité sur les derniers matchs',
            '`!faceatface <T1> <T2>` — Bilan historique entre deux équipes',
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
            '`!palmares` — Palmarès complet du serveur',
            '`!trophees` — Tous les trophées décernés',
            '`!recompenses` — Voir les rôles attribués par rang',
          ].join('\n'),
          inline: false,
        }
      );

    const embed2 = new EmbedBuilder()
      .setColor(color)
      .addFields(
        {
          name: '📊 Niveau & Profil',
          value: [
            '`!niveau` — Ton niveau XP et ta progression',
            '`!infouser [@user]` — Infos, niveau et avertissements d\'un membre',
            '`!infoserveur` — Informations sur le serveur Discord',
            '`!inforole @role` — Détails techniques d\'un rôle',
            '`!ping` — Latence du bot et de l\'API Discord',
            '`!statut` — Statut du bot et aperçu des tournois actifs',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🤖 Intelligence Artificielle',
          value: [
            '`!ia <question>` — Poser une question à l\'IA SUPREMYX',
            '`!ia réinitialiser` — Effacer son historique de conversation IA',
            '`!ia modeles` — Voir les modèles IA disponibles et l\'actuel',
            '`!ia statistiques` — Statistiques d\'utilisation de l\'IA',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛠️ Outils & Utilitaires',
          value: [
            '`!rappel <durée> <texte>` — Créer un rappel (ex : `!rappel 2h match ce soir`)',
            '`!absent [message]` — Passer en mode AFK (les mentions notifient l\'auteur)',
            '`!anniversaire définir JJ/MM[/AAAA]` — Enregistrer sa date d\'anniversaire',
            '`!anniversaire liste` — Voir les anniversaires du serveur',
            '`!anniversaire vérifier [@user]` — Vérifier l\'anniversaire d\'un membre',
            '`!pileface` — Lancer une pièce (pile ou face)',
            '`!tirageteam <@u1> <@u2> ...` — Tirer des équipes aléatoires',
            '`!messagejour` — Voir le message du jour posté par le bot',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📬 Communauté & Tickets',
          value: [
            '`!suggestion <texte>` — Envoyer une suggestion au staff',
            '`!signaler <problème>` — Signaler un problème anonymement',
            '`!ticket [support|signalement|candidature]` — Ouvrir un ticket',
            '`!fermer` — Fermer son ticket en cours',
            '`!vote <question> | <opt1> | <opt2>` — Participer / créer un vote',
            '`!sanctions [@user]` — Voir ses sanctions (ou celles d\'un membre)',
            '`!avertissements [@user]` — Voir l\'historique des avertissements',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📋 Règles du serveur',
          value: [
            '`!regles` — Afficher les règles du serveur',
            '`!règlement` — Afficher le règlement interactif complet',
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
