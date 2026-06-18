const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (!message.member) return;
    if (message.author.bot) return;
    if (message.content.trim() !== '!aidestaff') return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Cette commande est réservée au staff.');

    const cd = checkCooldown(message.author.id, 'aidestaff', 10);
    if (cd) return replyCooldown(message, cd, 'aidestaff');

    const COLOR  = 0xED4245;
    const FOOTER = { text: 'SUPREMYX CI · Toutes ces commandes requièrent la permission Administrateur · < > obligatoire · [ ] optionnel' };

    // ── Embed 1 : Gestion compétitive ─────────────────────────────────────────
    const embed1 = new EmbedBuilder()
      .setColor(COLOR)
      .setAuthor({ name: 'SUPREMYX — Aide Staff', iconURL: client.user.displayAvatarURL() })
      .setDescription('Inventaire complet des commandes réservées au staff.')
      .addFields(
        {
          name: '⚽ Gestion des Matchs',
          value: [
            '`!ajoutermatch <équipe> <placement> <kills>` — Enregistrer un résultat de match',
            '`!reinitialiser` — Remettre tous les scores à zéro',
            '`!resultats salon #salon` — Configurer le salon des résultats automatiques',
            '`!resultats statut <activer|desactiver>` — Activer/désactiver les annonces auto',
            '`!resultats depuis <jours>` — Voir les résultats des N derniers jours',
            '`!exporter [json|csv|texte]` — Exporter toutes les données',
            '`!sauvegarde` — Créer une sauvegarde JSON complète',
            '`!restaurer` — Restaurer depuis une sauvegarde',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🏆 Tournois',
          value: [
            '`!nouveautournoi <nom>` — Créer un nouveau tournoi',
            '`!finertournoi` — Terminer le tournoi actif',
            '`!supprimertournoi <nom>` — Supprimer un tournoi',
            '`!tableau` — Générer le bracket du tournoi (jusqu\'à 32 équipes)',
            '`!trophee <icône> <équipe> <titre> | <desc>` — Attribuer un trophée',
            '`!trophees <équipe>` — Voir tous les trophées d\'une équipe',
            '`!inscription ouvrir` — Ouvrir les inscriptions au tournoi',
            '`!inscription fermer` — Fermer les inscriptions',
            '`!inscription liste` — Voir les équipes inscrites',
            '`!inscription valider <équipe>` — Valider l\'inscription d\'une équipe',
            '`!inscription refuser <équipe>` — Refuser l\'inscription d\'une équipe',
            '`!inscription max <N>` — Définir le nombre max d\'équipes',
            '`!inscription salon #salon` — Salon de dépôt des inscriptions',
            '`!inscription annonces #salon` — Salon des annonces d\'inscription',
          ].join('\n'),
          inline: false,
        },
        {
          name: '👥 Gestion des Équipes & Joueurs',
          value: [
            '`!enregistrer <nom>` — Enregistrer une équipe manuellement',
            '`!desenregistrer <nom>` — Supprimer une équipe et son historique',
            '`!renommer <ancien> <nouveau>` — Renommer une équipe',
            '`!fusionner <T1> <T2>` — Fusionner deux équipes',
            '`!composition <équipe> <J1,J2,...>` — Définir la composition d\'une équipe',
            '`!liste ajouter <équipe> @user <rôle> [note]` — Ajouter au roster',
            '`!liste retirer <équipe> @user` — Retirer du roster',
            '`!liste role <équipe> @user <rôle>` — Changer le rôle dans le roster',
            '`!liste note <équipe> @user <note>` — Ajouter une note sur un joueur',
            '`!liste vider <équipe>` — Vider le roster d\'une équipe',
            '`!objectif definir <équipe> <texte>` — Définir l\'objectif de saison',
            '`!objectif supprimer <équipe>` — Supprimer l\'objectif',
            '`!resetjoueur <nom>` — Remettre les stats d\'un joueur à zéro',
            '`!donnerxp @membre <quantité>` — Donner de l\'XP à un membre',
            '`!retirerxp @membre <quantité>` — Retirer de l\'XP à un membre',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📅 Saisons',
          value: [
            '`!nouvellesaison <nom>` — Démarrer une nouvelle saison',
            '`!finersaison` — Clore la saison actuelle et archiver les stats',
            '`!setrecompense <rang> @role` — Rôle Discord selon le rang au classement',
            '`!lierequipe <équipe> @role` — Associer un rôle Discord à une équipe',
            '`!syncrangs` — Synchroniser tous les rôles de rang',
            '`!recompenses` — Voir toutes les récompenses configurées',
            '`!supprimerrecompense <rang>` — Supprimer une récompense de rang',
          ].join('\n'),
          inline: false,
        }
      );

    // ── Embed 2 : Communication & Config ──────────────────────────────────────
    const embed2 = new EmbedBuilder()
      .setColor(COLOR)
      .addFields(
        {
          name: '📢 Annonces & Communication',
          value: [
            '`!annonce <message>` — Envoyer une annonce dans le salon configuré',
            '`!dire <message>` — Faire parler le bot dans le salon courant',
            '`!vote <question> | <opt1> | <opt2>` — Sondage rapide par réactions',
            '`!sondage` — Sondage staff avancé (multiples options, timed)',
            '`!concours <durée> <prix>` — Lancer un giveaway',
            '`!diffuser <message>` — Diffuser dans plusieurs salons',
            '`!diffuser ajouter #salon` — Ajouter un salon de diffusion',
            '`!diffuser retirer #salon` — Retirer un salon de diffusion',
            '`!diffuser liste` — Voir les salons de diffusion',
            '`!diffuser aperçu` — Prévisualiser la diffusion',
            '`!setmessagejour <texte>` — Définir le message du jour automatique',
            '`!messagejour` — Afficher le message du jour actuel',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔗 Embeds & Liens',
          value: [
            '`!lien #salon | Titre | Desc | couleur` — Publier un embed',
            '`!lien preview | #salon | Titre | Desc | couleur` — Prévisualiser',
            '`!lien panneau | #salon | Titre | Desc | couleur` — Embed avec boutons',
            '`!lienlist [#salon]` — Lister les embeds du bot dans un salon',
            '`!lienedit #salon | ID | Titre | Desc | couleur` — Modifier un embed',
            '`!messageembed <config>` — Constructeur d\'embed avancé',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📅 Calendrier & Événements',
          value: [
            '`!calendrier ajouter <DD/MM/YYYY> <HH:MM> <eq1,eq2> [note]` — Planifier un match',
            '`!calendrier modifier <id> <DD/MM/YYYY> <HH:MM>` — Modifier un match',
            '`!calendrier supprimer <id>` — Supprimer un match',
            '`!calendrier vider` — Supprimer tous les matchs passés',
            '`!calendrier salon #salon` — Salon des rappels automatiques',
            '`!calendrier rappel <activer|desactiver> [24h|1h|15m]` — Gérer les rappels',
            '`!calendrier statut` — Voir la configuration',
            '`!event creer <titre> | <desc> | <date>` — Créer un événement RSVP',
            '`!event annuler <id>` — Annuler un événement',
            '`!planifier creer` — Créer un message planifié',
            '`!planifier liste` — Voir les messages planifiés',
            '`!planifier supprimer <id>` — Supprimer un message planifié',
            '`!planifier modifier <id>` — Modifier un message planifié',
            '`!planifier tester <id>` — Tester un message planifié',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚙️ Configuration Serveur',
          value: [
            '`!config` — Voir/modifier la configuration générale du bot',
            '`!setpoints <placement> <pts> <kill> <bonus>` — Configurer le système de points',
            '`!bienvenue definir <message>` — Définir le message de bienvenue',
            '`!bienvenue salon #salon` — Salon des messages de bienvenue',
            '`!bienvenue tester` — Tester le message de bienvenue',
            '`!bienvenue activer / desactiver` — Activer/désactiver',
            '`!rolesauto definir @role` — Rôle automatique à l\'arrivée',
            '`!rolesauto activer / desactiver` — Activer/désactiver l\'auto-rôle',
            '`!rolereaction ajouter #salon <msgId> <emoji> @role` — Configurer un reaction-role',
            '`!rolereaction retirer <msgId> <emoji>` — Supprimer un reaction-role',
            '`!rolereaction liste` — Voir tous les reaction-roles',
            '`!rolereaction vider <msgId>` — Supprimer tous les reaction-roles d\'un message',
            '`!setanniversaire #salon` — Salon des annonces d\'anniversaire',
            '`!setchannelniveau #salon` — Salon des montées de niveau XP',
            '`!salonannonce #salon` — Salon des annonces bot',
            '`!salonjournaux #salon` — Salon des logs staff',
          ].join('\n'),
          inline: false,
        }
      );

    // ── Embed 3 : Modération, Système & Logs ──────────────────────────────────
    const embed3 = new EmbedBuilder()
      .setColor(COLOR)
      .addFields(
        {
          name: '🛡️ Modération',
          value: [
            '`!effacer <1-100>` — Supprimer en masse des messages',
            '`!lenteur <0-21600>` — Activer le mode lent (secondes)',
            '`!sourdine @membre <durée_min> [raison]` — Mettre en sourdine',
            '`!retablir @membre` — Retirer la sourdine',
            '`!verrouiller` — Verrouiller le salon pour @everyone',
            '`!deverrouiller` — Déverrouiller le salon',
            '`!avertir @membre <raison>` — Avertir (escalade automatique)',
            '`!supprimerwarn @membre [id]` — Retirer un avertissement',
            '`!avertissements @membre` — Voir l\'historique des warns',
            '`!punition @membre <warn|mute|kick|ban> [durée] | <raison>` — Sanction directe',
            '`!sanctions @membre` — Voir le casier d\'un membre',
            '`!effaceractions @membre` — Effacer toutes les sanctions',
            '`!casier @membre` — Casier judiciaire complet d\'un membre',
            '`!rapport` — Rapport hebdomadaire de modération',
            '`!topwarn` — Top 10 des membres les plus sanctionnés',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚖️ Escalade & Blacklist',
          value: [
            '`!escalade` — Voir les règles d\'escalade automatique',
            '`!escalade activer / desactiver` — Activer/désactiver l\'escalade',
            '`!escalade configurer <warns> <action> [durée]` — Configurer une règle',
            '`!escalade supprimer <warns>` — Supprimer une règle',
            '`!escalade reinitialiser` — Réinitialiser aux règles par défaut',
            '`!listenoiree ajouter <nom>` — Ajouter à la blacklist',
            '`!listenoiree retirer <nom>` — Retirer de la blacklist',
            '`!listenoiree liste` — Voir la blacklist',
            '`!listenoiree verifier <nom>` — Vérifier si un nom est blacklisté',
            '`!automod activer / desactiver` — Activer/désactiver le filtre',
            '`!automod statut` — Voir le statut du filtre',
            '`!automod test <texte>` — Tester le filtre sur un texte',
            '`!mots ajouter <mot>` — Ajouter un mot interdit',
            '`!mots retirer <mot>` — Retirer un mot interdit',
            '`!mots defaut` — Restaurer la liste par défaut',
            '`!mots vider` — Vider tous les mots interdits',
            '`!antispam activer / desactiver` — Activer/désactiver l\'anti-spam',
            '`!antispam configurer <msgs> <secondes>` — Configurer les seuils',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🎫 Tickets & Règlement',
          value: [
            '`!configticket rolstaff @role` — Rôle staff pour les tickets',
            '`!configticket transcription #salon` — Salon des transcriptions',
            '`!configticket categorie <nom>` — Catégorie des tickets',
            '`!ticket panneau` — Afficher le panneau d\'ouverture de ticket',
            '`!tickets` — Voir tous les tickets ouverts',
            '`!prendre` — Prendre en charge le ticket actuel',
            '`!resoudre` — Résoudre et fermer le ticket',
            '`!fermer` — Fermer le ticket (sans résolution)',
            '`!ajouteruser @membre` — Ajouter un membre au ticket',
            '`!reglement titre <texte>` — Définir le titre du règlement',
            '`!reglement intro <texte>` — Définir l\'introduction',
            '`!reglement section <nom>` — Ajouter une section',
            '`!reglement ajouter <section> <texte>` — Ajouter une règle',
            '`!reglement modifier <section> <num> <texte>` — Modifier une règle',
            '`!reglement supprimer <section> <num>` — Supprimer une règle',
            '`!reglement publier` — Publier le règlement dans le salon configuré',
            '`!setregles` — Configurer le salon et l\'auteur du règlement',
            '`!ajouterregle <texte>` — Ajouter une règle simple',
            '`!modifierregle <num> <texte>` — Modifier une règle',
            '`!supprimerregle <num>` — Supprimer une règle',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔧 Système & Logs',
          value: [
            '`!statsbot` — Statistiques d\'utilisation du bot',
            '`!commandes` — Classement des commandes les plus utilisées',
            '`!logs` — Historique des actions staff (paginé)',
            '`!logs vider` — Effacer l\'historique des logs',
            '`!logs stats` — Statistiques des logs par catégorie',
            '`!logs aujourdhui` — Logs de la journée',
            '`!journal [N]` — N derniers commits Git (changelog)',
            '`!tableaudebord` — Tableau de bord web',
            '`!note <équipe> <texte>` — Note interne sur une équipe',
            '`!notes <équipe>` — Voir les notes internes',
            '`!delnote <équipe> <id>` — Supprimer une note interne',
            '`!mp @membre <message>` — Envoyer un DM via le bot',
            '`!setdelai <commande> <secondes>` — Modifier le cooldown d\'une commande',
            '`!delais` — Voir tous les cooldowns configurés',
            '`!suppdelai <commande>` — Réinitialiser un cooldown',
            '`!gitpush` — Pousser le code vers GitHub',
            '`!gitstatus` — Voir le statut du dépôt Git',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🚨 Erreurs & Maintenance',
          value: [
            '`!erreurs` — Dernières erreurs du bot (paginé)',
            '`!erreurs nonresolues` — Erreurs non résolues',
            '`!erreurs stats` — Statistiques globales des erreurs',
            '`!erreurs resoudre <id>` — Marquer une erreur comme résolue',
            '`!erreurs vider` — Effacer tout l\'historique d\'erreurs',
            '`!maintenance activer [message]` — Activer la maintenance',
            '`!maintenance desactiver` — Désactiver la maintenance',
            '`!maintenance message <texte>` — Changer le message de maintenance',
            '`!maintenance statut` — Voir l\'état actuel de la maintenance',
            '`!memoire` — Voir l\'utilisation mémoire du bot',
            '`!uptime` — Voir le temps de fonctionnement',
            '`!lienbot` — Lien d\'invitation du bot',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter(FOOTER)
      .setTimestamp();

    await message.channel.send({ embeds: [embed1] });
    await message.channel.send({ embeds: [embed2] });
    await message.channel.send({ embeds: [embed3] });
  });
};
