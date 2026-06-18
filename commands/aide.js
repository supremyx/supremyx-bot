const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.content.trim() !== '!aide') return;

    const cd = checkCooldown(message.author.id, 'aide', 10);
    if (cd) return replyCooldown(message, cd, 'aide');

    const COLOR  = 0xFF8C00;
    const FOOTER = { text: 'SUPREMYX CI · Tape !aidestaff si tu es staff · < > obligatoire · [ ] optionnel' };

    // ── Embed 1 : Compétitif ──────────────────────────────────────────────────
    const embed1 = new EmbedBuilder()
      .setColor(COLOR)
      .setAuthor({ name: 'SUPREMYX — Aide générale', iconURL: client.user.displayAvatarURL() })
      .setDescription('Toutes les commandes disponibles pour la communauté.')
      .addFields(
        {
          name: '📊 Statistiques & Équipes',
          value: [
            '`!stats <équipe>` — Résumé complet des performances d\'une équipe',
            '`!equipe <nom>` — Fiche détaillée d\'une équipe',
            '`!equipes` — Liste de toutes les équipes enregistrées',
            '`!classement` — Classement général des équipes',
            '`!top [N]` — Top N équipes (défaut : 10)',
            '`!comparer <T1> vs <T2>` — Comparer deux équipes',
            '`!historique <équipe>` — Historique de tous les matchs d\'une équipe',
            '`!matchs` — Statistiques globales (total matchs, kills, records)',
            '`!recherche <nom>` — Rechercher une équipe ou un joueur',
            '`!freeagents` — Liste des joueurs sans équipe disponibles',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎮 Joueurs & Roster',
          value: [
            '`!profil [@membre]` — Fiche complète d\'un joueur (XP, équipe, stats, warns)',
            '`!statsjoueur <nom>` — Stats détaillées d\'un joueur (kills, matchs)',
            '`!classjoueurs` — Classement des meilleurs joueurs par kills',
            '`!matchjoueur <nom>` — Détail des matchs d\'un joueur',
            '`!liste <équipe>` — Roster / composition d\'une équipe',
            '`!objectif <équipe>` — Voir l\'objectif de saison d\'une équipe',
            '`!transfert <joueur> <équipe>` — Voir les transferts d\'un joueur',
            '`!capitaine <équipe>` — Voir le capitaine d\'une équipe',
            '`!comparerjoueur <J1> vs <J2>` — Comparer deux joueurs',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🏆 Tournois & Saisons',
          value: [
            '`!tournois` — Liste de tous les tournois',
            '`!detailtournoi <nom>` — Classement et détails d\'un tournoi',
            '`!inscrire <équipe>` — Inscrire son équipe à un tournoi ouvert',
            '`!tableau` — Tableau des phases éliminatoires du tournoi en cours',
            '`!saisons` — Historique des saisons et vainqueurs',
            '`!palmares` — Palmarès général',
            '`!mvp` — MVP actuel (meilleur ratio kills/match)',
            '`!mvpsaison` — MVP de toutes les saisons passées',
          ].join('\n'),
          inline: false,
        }
      );

    // ── Embed 2 : Profil, IA, Utilitaires ─────────────────────────────────────
    const embed2 = new EmbedBuilder()
      .setColor(COLOR)
      .addFields(
        {
          name: '📈 Profil & Progression',
          value: [
            '`!niveau [@membre]` — Niveau XP et barre de progression',
            '`!classniveau` · `!classxp` — Classement XP Top 10 du serveur',
            '`!infouser [@membre]` — Infos Discord, niveau, sanctions d\'un membre',
            '`!inforole @role` — Détails d\'un rôle Discord',
            '`!serveur` — Informations sur le serveur',
            '`!ping` — Latence du bot',
            '`!status` — Statut du bot et aperçu des tournois',
            '`!uptime` — Temps de fonctionnement du bot',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🤖 Intelligence Artificielle',
          value: [
            '`!ia <question>` — Poser une question à l\'IA SUPREMYX',
            '`!ia analyser <équipe>` — Analyse IA d\'une équipe',
            '`!ia predire <T1> <T2>` — Prédiction IA pour un affrontement',
            '`!ia conseil` — Conseil coaching personnalisé',
            '`!ia resume <équipe>` — Résumé IA des performances',
            '`!ia rapport <équipe>` — Rapport IA complet',
            '`!ia reinitialiser` — Réinitialiser la conversation IA',
            '`!ia modeles` — Liste des modèles IA disponibles',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📅 Calendrier & Événements',
          value: [
            '`!calendrier` — Voir les prochains matchs planifiés',
            '`!event creer <titre> | <desc> | <date>` — Créer un événement RSVP',
            '`!event liste` — Liste des événements en cours',
            '`!event participants <id>` — Voir les participants d\'un événement',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛠️ Outils & Utilitaires',
          value: [
            '`!rappel <durée> <texte>` — Se créer un rappel (ex : `!rappel 2h match ce soir`)',
            '`!absent [message]` — Passer en mode AFK',
            '`!anniversaire definir <JJ/MM/AAAA>` — Enregistrer sa date d\'anniversaire',
            '`!anniversaire supprimer` — Supprimer sa date d\'anniversaire',
            '`!pileface` — Lancer une pièce',
            '`!dés` — Lancer un dé à 6 faces',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📬 Communauté & Signalements',
          value: [
            '`!suggestion <texte>` — Envoyer une suggestion au staff',
            '`!signaler <problème>` — Signaler un problème au staff',
            '`!ticket` — Ouvrir un ticket de support',
            '`!vote <question> | <opt1> | <opt2>` — Créer un sondage rapide',
            '`!sanctions [@membre]` — Voir ses sanctions (ou celles d\'un membre)',
            '`!avertissements [@membre]` — Voir l\'historique des avertissements',
            '`!regles` — Afficher les règles du serveur',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔢 Statistiques avancées',
          value: [
            '`!serie <équipe>` — Série de victoires/défaites en cours',
            '`!regularite <équipe>` — Régularité sur les derniers matchs',
            '`!faceatface <T1> <T2>` — Historique face à face entre deux équipes',
            '`!calculer <équipe>` — Points moyens par match',
            '`!moyenne <équipe>` — Moyenne détaillée sur N matchs',
            '`!tendance <équipe>` — Tendance (hausse/baisse) des performances',
            '`!podium` — Top 3 toutes statistiques confondues',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter(FOOTER)
      .setTimestamp();

    await message.channel.send({ embeds: [embed1] });
    await message.channel.send({ embeds: [embed2] });
  });
};
