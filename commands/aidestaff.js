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

    const color = 0xED4245;
    const footer = { text: 'SUPREMYX Esports · Commandes réservées au staff Administrateur' };

    const embed1 = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'SUPREMYX — Aide Staff', iconURL: client.user.displayAvatarURL() })
      .setDescription('Inventaire complet des commandes réservées au staff.\n> 🔒 Requiert la permission **Administrateur**. Paramètres `< >` obligatoires, `[ ]` optionnels.')
      .addFields(
        {
          name: '⚽ Matchs & Résultats',
          value: [
            '`!ajoutermatch <équipe> <placement> <kills>` — Enregistrer un résultat de match',
            '`!resultats <eq:place:kills> [...]` — Poster les résultats de plusieurs équipes',
            '`!resultats depuis <ID> <eq:place:kills> [...]` — Lier à un match planifié',
            '`!reinitialiser` — Remettre tous les scores à zéro',
            '`!resetjoueur <nom>` — Réinitialiser les stats d\'un joueur',
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
            '`!inscription [ouvrir|fermer|valider|refuser|liste|réinitialiser]` — Gérer les inscriptions',
            '`!tableau` — Afficher le tableau des phases éliminatoires',
            '`!trophee <icône> <équipe> <titre> | <desc>` — Attribuer un trophée à une équipe',
          ].join('\n'),
          inline: false,
        },
        {
          name: '👥 Équipes & Rangs',
          value: [
            '`!enregistrer <nom>` — Enregistrer une équipe manuellement',
            '`!desenregistrer <nom>` — Supprimer une équipe et son historique',
            '`!renommer <ancien> <nouveau>` — Renommer une équipe',
            '`!fusionner <T1> <T2>` — Fusionner deux équipes en une',
            '`!lierequipe <équipe> @role` — Lier une équipe à un rôle Discord',
            '`!syncrangs` — Synchroniser les rôles selon le classement actuel',
            '`!setrecompense <rang> @role` — Attribuer un rôle selon le rang',
            '`!supprimerrecompense <rang>` — Supprimer une récompense de rang',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📅 Saisons',
          value: [
            '`!nouvellesaison <nom>` — Démarrer une nouvelle saison',
            '`!finersaison` — Clore la saison actuelle et sauvegarder les stats',
            '`!setpoints <type> [valeurs]` — Configurer le système de points',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛡️ Sanctions & Modération',
          value: [
            '`!punition @user <warn|mute|kick|ban> [durée] [raison]` — Appliquer une sanction',
            '`!avertir @user <raison>` — Avertir un membre (escalade automatique)',
            '`!supprimerwarn @user [ID]` — Retirer un avertissement',
            '`!effaceractions @user` — Effacer toutes les sanctions d\'un membre',
            '`!escalade [activer|désactiver|configurer|supprimer|réinitialiser]` — Config auto-escalade',
            '`!effacer <1-100>` — Supprimer en masse des messages du canal',
            '`!lenteur [secondes]` — Activer/modifier le mode lenteur du canal',
            '`!sourdine @user <durée_min> [raison]` — Mettre un membre en sourdine',
            '`!retablir @user` — Lever la sourdine d\'un membre',
            '`!verrouiller` / `!deverrouiller` — Verrouiller / déverrouiller le canal',
            '`!listenoiree [ajouter|retirer|liste] <nom>` — Gérer la liste noire',
            '`!mp <@user|@role> <message>` — Envoyer un message privé en masse',
          ].join('\n'),
          inline: false,
        }
      );

    const embed2 = new EmbedBuilder()
      .setColor(color)
      .addFields(
        {
          name: '🎫 Tickets',
          value: [
            '`!configticket [rolstaff|transcription|categorie]` — Configurer le système de tickets',
            '`!ticket panneau` — Poster le panneau d\'ouverture de ticket',
            '`!tickets` — Voir tous les tickets ouverts',
            '`!prendre [ID]` — Prendre en charge un ticket',
            '`!resoudre [raison]` — Marquer un ticket comme résolu',
            '`!ajouteruser @user` — Ajouter un membre à un ticket',
            '`!fermer` — Fermer le ticket en cours',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🚨 Automod & Filtres',
          value: [
            '`!automod activer / désactiver` — Activer/désactiver le filtre de mots',
            '`!mots` — Voir la liste des mots interdits',
            '`!mot ajouter <mot>` — Ajouter un mot interdit',
            '`!mot retirer <mot>` — Supprimer un mot interdit',
            '`!mot defaut` — Charger la liste de mots par défaut',
            '`!antispam [activer|désactiver|configurer <msg> <sec>]` — Anti-spam',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📢 Annonces & Communication',
          value: [
            '`!annonce <message>` — Envoyer une annonce dans le salon configuré',
            '`!dire <message>` — Faire parler le bot dans le canal courant',
            '`!lienbutton` — Envoyer un embed avec des boutons de lien',
            '`!lien [ajouter|liste|modifier|supprimer]` — Gérer les liens rapides',
            '`!messageembed <config>` — Créer un embed entièrement personnalisé',
            '`!planifier` — Gérer les messages automatiques planifiés',
            '`!sondage` — Gérer les sondages staff avancés',
            '`!vote <question> | <opt1> | <opt2>` — Créer un sondage par réaction',
            '`!concours <durée> <prix>` — Lancer un giveaway dans le canal',
            '`!retirer @user` — Retirer un gagnant d\'un giveaway',
            '`!setmessagejour <texte>` — Définir le message du jour automatique',
          ].join('\n'),
          inline: false,
        },
        {
          name: '💡 Suggestions',
          value: [
            '`!acceptersugg <ID> [commentaire]` — Accepter une suggestion',
            '`!rejetersugg <ID> [raison]` — Rejeter une suggestion',
            '`!configsuggestion [salon|ajouter|retirer]` — Configurer le système de suggestions',
          ].join('\n'),
          inline: false,
        }
      );

    const embed3 = new EmbedBuilder()
      .setColor(color)
      .addFields(
        {
          name: '⚙️ Configuration Serveur',
          value: [
            '`!voirconfig` — Afficher tous les paramètres configurés du serveur',
            '`!config [paramètre]` — Configurer les paramètres généraux du bot',
            '`!salonannonce #salon` — Salon d\'annonces (annonces, rappels, MOTD)',
            '`!salonjournaux #salon` — Salon de journaux staff (modération, automod)',
            '`!rolesauto [activer|désactiver|definir @role]` — Rôle automatique à l\'arrivée',
            '`!rolereaction [ajouter|retirer|liste]` — Gérer les reaction-roles',
            '`!bienvenue [definir|salon|tester|activer|désactiver]` — Messages de bienvenue',
            '`!setanniversaire #salon` — Configurer le salon des anniversaires',
            '`!setchannelniveau #salon` — Configurer le salon des montées de niveau',
            '`!règlement [ajouter|modifier|supprimer|publier|actualiser]` — Règlement interactif',
            '`!setregles` / `!ajouterregle` / `!modifierregle` / `!deplacerregle` / `!supprimerregle` / `!effacerregles`',
            '`!event [creer|annuler|rejoindre|liste]` — Gérer les événements RSVP',
            '`!calendrier [ajouter|supprimer|salon|rappels|statut]` — Calendrier de matchs',
            '`!tableaudebord [salon|auto|heure|statut|lien]` — Dashboard automatique',
            '`!setdelai <commande> <secondes>` — Modifier le cooldown d\'une commande',
            '`!delais` — Voir tous les cooldowns configurés',
            '`!suppdelai <commande>` — Réinitialiser le cooldown d\'une commande',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🤖 Intelligence Artificielle (Staff)',
          value: [
            '`!ia modele <nom>` — Changer le modèle IA actif du serveur',
            '> Modèles : `gpt-4o-mini` `gpt-4o` `claude-haiku` `claude-sonnet` `gemini-flash` `mistral` `llama`',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🔧 Système & Logs',
          value: [
            '`!statsbot` — Statistiques d\'utilisation du bot par commande',
            '`!logs` — Historique des actions du staff',
            '`!journal [N]` — Voir les N derniers commits Git (changelog)',
            '`!note <équipe> <texte>` — Ajouter une note interne sur une équipe',
            '`!notes <équipe>` — Voir les notes internes d\'une équipe',
            '`!delnote <équipe> <ID>` — Supprimer une note interne',
            '`!gitpush` — Pousser le code vers GitHub manuellement',
            '`!gitstatus` — Voir le statut du dépôt Git',
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
