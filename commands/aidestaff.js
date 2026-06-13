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

    const color  = 0xED4245;
    const footer = { text: 'SUPREMYX CI · Commandes réservées au staff Administrateur' };

    // ── Embed 1 : Gestion compétitive ─────────────────────────────────────────
    const embed1 = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'SUPREMYX — Aide Staff', iconURL: client.user.displayAvatarURL() })
      .setDescription('Inventaire complet des commandes réservées au staff.\n> 🔒 Requiert la permission **Administrateur**. `< >` obligatoire · `[ ]` optionnel.')
      .addFields(
        {
          name: '⚽ Gestion des Matchs',
          value: [
            '`!ajoutermatch <équipe> <placement> <kills>` — Enregistrer un résultat de match',
            '`!reinitialiser` — Remettre tous les scores à zéro',
            '`!resultat` — Finaliser et valider un résultat de match',
            '`!exporter [format]` — Exporter les données (texte / JSON / CSV)',
            '`!sauvegarde` — Créer une sauvegarde JSON complète',
            '`!restaurer` — Restaurer depuis une sauvegarde',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🏆 Tournois',
          value: [
            '`!nouveautournoi <nom>` — Créer un nouveau tournoi',
            '`!finirtournoi` — Terminer le tournoi actif',
            '`!supprimertournoi <nom>` — Supprimer un tournoi',
            '`!inscription [aide|set|open|close]` — Gérer les inscriptions au tournoi',
            '`!bracket` — Afficher le tableau des phases éliminatoires',
            '`!trophee <icône> <équipe> <titre> | <desc>` — Attribuer un trophée à une équipe',
          ].join('\n'),
          inline: false,
        },
        {
          name: '👥 Gestion des Équipes',
          value: [
            '`!enregistrer <nom>` — Enregistrer une équipe manuellement',
            '`!desenregistrer <nom>` — Supprimer une équipe et son historique',
            '`!renommer <ancien> <nouveau>` — Renommer une équipe',
            '`!fusionner <T1> <T2>` — Fusionner deux équipes',
            '`!statsavancees` — Statistiques avancées (KD, tendances, etc.)',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📅 Saisons & Classement',
          value: [
            '`!setsaison <nom>` — Démarrer une nouvelle saison',
            '`!cloresaison` — Clore la saison actuelle et sauvegarder les stats',
            '`!setrecompense <rang> @role` — Attribuer un rôle selon le rang au classement',
          ].join('\n'),
          inline: false,
        }
      );

    // ── Embed 2 : Communication, Embeds & Configuration ───────────────────────
    const embed2 = new EmbedBuilder()
      .setColor(color)
      .addFields(
        {
          name: '📢 Annonces & Communication',
          value: [
            '`!annonce <message>` — Envoyer une annonce dans le canal configuré',
            '`!dire <message>` — Faire parler le bot dans le canal courant',
            '`!planifier` — Gérer les messages automatiques planifiés',
            '`!vote <question> | <opt1> | <opt2> ...` — Créer un sondage par réaction',
            '`!sondage` — Gérer les sondages staff avancés',
            '`!concours <durée> <prix>` — Lancer un giveaway dans le canal',
            '`!motd <texte>` — Définir le message du jour automatique',
            '`!diffuser <message>` — Diffuser une annonce dans plusieurs canaux',
            '`!diffuser ajouter/retirer/liste/aperçu` — Gérer les canaux de diffusion',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔗 Embeds & Liens',
          value: [
            '`!lien #salon | Titre | Description | couleur` — Publier un embed dans un salon',
            '`!lien preview | #salon | Titre | Desc | couleur` — Prévisualiser avant publication',
            '`!lienbutton #salon | Titre | Desc | Texte >> https://... | couleur` — Embed avec boutons',
            '`!lienlist [#salon]` — Lister les embeds du bot dans un salon',
            '`!lienedit #salon | ID | Titre | Desc | couleur` — Modifier un embed existant',
            '`!messageembed <config>` — Constructeur d\'embed avancé et personnalisé',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛡️ Modération',
          value: [
            '`!effacer <1-100>` — Supprimer en masse des messages du canal',
            '`!avertir @membre <raison>` — Avertir un membre (escalade automatique)',
            '`!supprimerwarn @membre [ID]` — Retirer un avertissement',
            '`!verrouiller` — Verrouiller le canal pour @everyone',
            '`!deverrouiller` — Déverrouiller le canal',
            '`!listenoiree [add|remove|list] <nom>` — Gérer la blacklist équipes/joueurs',
            '`!automod [add|remove|list] <mot>` — Configurer le filtre de mots interdits',
            '`!antispam [config]` — Configurer la protection anti-spam',
            '`!ticket [config]` — Configurer le système de tickets support',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚙️ Configuration Serveur',
          value: [
            '`!config` — Configurer les paramètres généraux du bot',
            '`!bienvenue [config]` — Configurer le message de bienvenue automatique',
            '`!rolesauto set @role` — Définir le rôle automatique à l\'arrivée',
            '`!rolereaction [add|remove|list]` — Gérer les reaction-roles',
            '`!setanniversaire #salon` — Configurer le salon des anniversaires',
            '`!setchannelniveau #salon` — Configurer le salon des montées de niveau',
            '`!règlement [config]` — Configurer le règlement interactif du serveur',
            '`!setregles` / `!ajouterregle <texte>` — Gérer les règles affichées',
            '`!event [create|cancel|list]` — Gérer les événements RSVP',
            '`!calendrier config` — Configurer le calendrier automatique de matchs',
            '`!setdelai <commande> <secondes>` — Modifier le cooldown d\'une commande',
            '`!delais` — Voir tous les cooldowns configurés',
            '`!suppdelai <commande>` — Réinitialiser le cooldown d\'une commande',
          ].join('\n'),
          inline: false,
        }
      );

    // ── Embed 3 : Système, Logs & Outils avancés ──────────────────────────────
    const embed3 = new EmbedBuilder()
      .setColor(color)
      .addFields(
        {
          name: '🔧 Système & Logs',
          value: [
            '`!statsbot` — Statistiques d\'utilisation du bot par commande',
            '`!logs` — Historique des actions du staff',
            '`!journal [N]` — Voir les N derniers commits Git (changelog)',
            '`!dashboard` — Tableau de bord : tickets, sanctions, sondages, XP',
            '`!note <équipe> <texte>` — Ajouter une note interne sur une équipe',
            '`!notes <équipe>` — Voir les notes internes d\'une équipe',
            '`!delnote <équipe> <ID>` — Supprimer une note interne',
            '`!gitpush` — Pousser le code vers GitHub',
            '`!gitstatus` — Voir le statut du dépôt Git',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🚨 Erreurs & Débogage',
          value: [
            '`!erreurs` — Dernières erreurs du bot (paginé, 8 par page)',
            '`!erreurs unresolved` — Erreurs non résolues uniquement',
            '`!erreurs command` — Erreurs provenant de commandes',
            '`!erreurs stats` — Statistiques globales des erreurs',
            '`!erreurs resolve <id>` — Marquer une erreur comme résolue',
            '`!erreurs clear` — Effacer tout l\'historique d\'erreurs',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛠️ Mode Maintenance',
          value: [
            '`!maintenance on [message]` — Activer la maintenance (bloque les membres)',
            '`!maintenance off` — Désactiver la maintenance',
            '`!maintenance message <texte>` — Changer le message affiché aux membres',
            '`!maintenance status` — Voir l\'état actuel de la maintenance',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter(footer)
      .setTimestamp();

    await message.channel.send({ embeds: [embed1] });
    await message.channel.send({ embeds: [embed2] });
    await message.channel.send({ embeds: [embed3] });
  });
};
