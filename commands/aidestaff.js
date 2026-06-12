const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

// ─── Catalogue complet des commandes staff ────────────────────────────────────
const CMDS = [
  // Matchs & Résultats
  { cmd: '!ajoutermatch <équipe> <placement> <kills>', desc: 'Enregistrer un résultat de match',                      cat: '⚽ Matchs & Résultats' },
  { cmd: '!resultats <eq:place:kills> [...]',          desc: 'Poster les résultats de plusieurs équipes',             cat: '⚽ Matchs & Résultats' },
  { cmd: '!resultats depuis <ID> <eq:place:kills> [...]', desc: 'Lier les résultats à un match planifié',            cat: '⚽ Matchs & Résultats' },
  { cmd: '!reinitialiser',                              desc: 'Remettre tous les scores à zéro',                      cat: '⚽ Matchs & Résultats' },
  { cmd: '!resetjoueur <nom>',                         desc: 'Réinitialiser les stats d\'un joueur',                  cat: '⚽ Matchs & Résultats' },
  { cmd: '!exporter [format]',                         desc: 'Exporter les données (texte / JSON / CSV)',             cat: '⚽ Matchs & Résultats' },
  { cmd: '!sauvegarde',                                desc: 'Créer une sauvegarde JSON complète',                    cat: '⚽ Matchs & Résultats' },
  { cmd: '!restaurer',                                 desc: 'Restaurer depuis une sauvegarde',                       cat: '⚽ Matchs & Résultats' },
  // Tournois
  { cmd: '!nouveautournoi <nom>',                      desc: 'Créer un nouveau tournoi',                              cat: '🏆 Tournois' },
  { cmd: '!finirtournoi',                              desc: 'Terminer le tournoi actif',                             cat: '🏆 Tournois' },
  { cmd: '!supprimertournoi <nom>',                    desc: 'Supprimer un tournoi',                                  cat: '🏆 Tournois' },
  { cmd: '!inscription [ouvrir|fermer|valider|refuser|liste|réinitialiser]', desc: 'Gérer les inscriptions au tournoi', cat: '🏆 Tournois' },
  { cmd: '!tableau',                                   desc: 'Afficher le tableau des phases éliminatoires',          cat: '🏆 Tournois' },
  { cmd: '!trophee <icône> <équipe> <titre> | <desc>', desc: 'Attribuer un trophée à une équipe',                    cat: '🏆 Tournois' },
  // Équipes & Rangs
  { cmd: '!enregistrer <nom>',                         desc: 'Enregistrer une équipe manuellement',                  cat: '👥 Équipes & Rangs' },
  { cmd: '!desenregistrer <nom>',                      desc: 'Supprimer une équipe et son historique',               cat: '👥 Équipes & Rangs' },
  { cmd: '!renommer <ancien> <nouveau>',               desc: 'Renommer une équipe',                                   cat: '👥 Équipes & Rangs' },
  { cmd: '!fusionner <T1> <T2>',                       desc: 'Fusionner deux équipes en une',                        cat: '👥 Équipes & Rangs' },
  { cmd: '!lierequipe <équipe> @role',                 desc: 'Lier une équipe à un rôle Discord',                    cat: '👥 Équipes & Rangs' },
  { cmd: '!syncrangs',                                 desc: 'Synchroniser les rôles selon le classement actuel',    cat: '👥 Équipes & Rangs' },
  { cmd: '!setrecompense <rang> @role',                desc: 'Attribuer un rôle selon le rang',                      cat: '👥 Équipes & Rangs' },
  { cmd: '!supprimerrecompense <rang>',                desc: 'Supprimer une récompense de rang',                     cat: '👥 Équipes & Rangs' },
  // Saisons
  { cmd: '!nouvellesaison <nom>',                      desc: 'Démarrer une nouvelle saison',                         cat: '📅 Saisons' },
  { cmd: '!finersaison',                               desc: 'Clore la saison actuelle et sauvegarder les stats',    cat: '📅 Saisons' },
  { cmd: '!setpoints <type> [valeurs]',                desc: 'Configurer le système de points',                      cat: '📅 Saisons' },
  // Sanctions & Modération
  { cmd: '!punition @user <warn|mute|kick|ban> [durée] [raison]', desc: 'Appliquer une sanction',                   cat: '🛡️ Sanctions & Modération' },
  { cmd: '!avertir @user <raison>',                    desc: 'Avertir un membre (escalade automatique)',             cat: '🛡️ Sanctions & Modération' },
  { cmd: '!supprimerwarn @user [ID]',                  desc: 'Retirer un avertissement',                             cat: '🛡️ Sanctions & Modération' },
  { cmd: '!effaceractions @user',                      desc: 'Effacer toutes les sanctions d\'un membre',            cat: '🛡️ Sanctions & Modération' },
  { cmd: '!escalade [activer|désactiver|configurer|supprimer|réinitialiser]', desc: 'Configuration auto-escalade', cat: '🛡️ Sanctions & Modération' },
  { cmd: '!effacer <1-100>',                           desc: 'Supprimer en masse des messages du canal',             cat: '🛡️ Sanctions & Modération' },
  { cmd: '!lenteur [secondes]',                        desc: 'Activer/modifier le mode lenteur du canal',            cat: '🛡️ Sanctions & Modération' },
  { cmd: '!sourdine @user <durée_min> [raison]',       desc: 'Mettre un membre en sourdine',                         cat: '🛡️ Sanctions & Modération' },
  { cmd: '!retablir @user',                            desc: 'Lever la sourdine d\'un membre',                       cat: '🛡️ Sanctions & Modération' },
  { cmd: '!verrouiller',                               desc: 'Verrouiller le canal pour @everyone',                  cat: '🛡️ Sanctions & Modération' },
  { cmd: '!deverrouiller',                             desc: 'Déverrouiller le canal',                               cat: '🛡️ Sanctions & Modération' },
  { cmd: '!listenoiree [ajouter|retirer|liste] <nom>', desc: 'Gérer la liste noire équipes/joueurs',                 cat: '🛡️ Sanctions & Modération' },
  { cmd: '!mp <@user|@role> <message>',                desc: 'Envoyer un message privé en masse',                    cat: '🛡️ Sanctions & Modération' },
  // Tickets
  { cmd: '!configticket [rolstaff|transcription|categorie]', desc: 'Configurer le système de tickets',              cat: '🎫 Tickets' },
  { cmd: '!ticket panneau',                            desc: 'Poster le panneau d\'ouverture de ticket',             cat: '🎫 Tickets' },
  { cmd: '!tickets',                                   desc: 'Voir tous les tickets ouverts',                        cat: '🎫 Tickets' },
  { cmd: '!prendre [ID]',                              desc: 'Prendre en charge un ticket',                          cat: '🎫 Tickets' },
  { cmd: '!resoudre [raison]',                         desc: 'Marquer un ticket comme résolu',                       cat: '🎫 Tickets' },
  { cmd: '!ajouteruser @user',                         desc: 'Ajouter un membre à un ticket',                        cat: '🎫 Tickets' },
  { cmd: '!fermer',                                    desc: 'Fermer le ticket en cours',                            cat: '🎫 Tickets' },
  // Automod & Filtres
  { cmd: '!automod activer / désactiver',              desc: 'Activer/désactiver le filtre de mots',                 cat: '🚨 Automod & Filtres' },
  { cmd: '!mots',                                      desc: 'Voir la liste des mots interdits',                     cat: '🚨 Automod & Filtres' },
  { cmd: '!mot ajouter <mot>',                         desc: 'Ajouter un mot interdit',                              cat: '🚨 Automod & Filtres' },
  { cmd: '!mot retirer <mot>',                         desc: 'Supprimer un mot interdit',                            cat: '🚨 Automod & Filtres' },
  { cmd: '!mot defaut',                                desc: 'Charger la liste de mots par défaut',                  cat: '🚨 Automod & Filtres' },
  { cmd: '!antispam [activer|désactiver|configurer <msg> <sec>]', desc: 'Configurer la protection anti-spam',       cat: '🚨 Automod & Filtres' },
  // Communication
  { cmd: '!annonce <message>',                         desc: 'Envoyer une annonce dans le salon configuré',          cat: '📢 Communication' },
  { cmd: '!dire <message>',                            desc: 'Faire parler le bot dans le canal courant',            cat: '📢 Communication' },
  { cmd: '!lienbutton',                                desc: 'Envoyer un embed avec des boutons de lien',            cat: '📢 Communication' },
  { cmd: '!lien [ajouter|liste|modifier|supprimer]',   desc: 'Gérer les liens rapides',                              cat: '📢 Communication' },
  { cmd: '!messageembed <config>',                     desc: 'Créer un embed entièrement personnalisé',              cat: '📢 Communication' },
  { cmd: '!planifier',                                 desc: 'Gérer les messages automatiques planifiés',            cat: '📢 Communication' },
  { cmd: '!sondage',                                   desc: 'Gérer les sondages staff avancés',                     cat: '📢 Communication' },
  { cmd: '!vote <question> | <opt1> | <opt2>',         desc: 'Créer un sondage par réaction',                        cat: '📢 Communication' },
  { cmd: '!concours <durée> <prix>',                   desc: 'Lancer un giveaway dans le canal',                     cat: '📢 Communication' },
  { cmd: '!retirer @user',                             desc: 'Retirer un gagnant d\'un giveaway',                    cat: '📢 Communication' },
  { cmd: '!setmessagejour <texte>',                    desc: 'Définir le message du jour automatique',               cat: '📢 Communication' },
  // Suggestions
  { cmd: '!acceptersugg <ID> [commentaire]',           desc: 'Accepter une suggestion',                              cat: '💡 Suggestions' },
  { cmd: '!rejetersugg <ID> [raison]',                 desc: 'Rejeter une suggestion',                               cat: '💡 Suggestions' },
  { cmd: '!configsuggestion [salon|ajouter|retirer]',  desc: 'Configurer le système de suggestions',                 cat: '💡 Suggestions' },
  // Configuration Serveur
  { cmd: '!voirconfig',                                desc: 'Afficher tous les paramètres configurés du serveur',   cat: '⚙️ Configuration Serveur' },
  { cmd: '!config [paramètre]',                        desc: 'Configurer les paramètres généraux du bot',            cat: '⚙️ Configuration Serveur' },
  { cmd: '!salonannonce #salon',                       desc: 'Salon d\'annonces (annonces, rappels, MOTD)',          cat: '⚙️ Configuration Serveur' },
  { cmd: '!salonjournaux #salon',                      desc: 'Salon de journaux staff (modération, automod)',        cat: '⚙️ Configuration Serveur' },
  { cmd: '!rolesauto [activer|désactiver|definir @role]', desc: 'Rôle automatique à l\'arrivée d\'un membre',       cat: '⚙️ Configuration Serveur' },
  { cmd: '!rolereaction [ajouter|retirer|liste]',      desc: 'Gérer les reaction-roles',                             cat: '⚙️ Configuration Serveur' },
  { cmd: '!bienvenue [definir|salon|tester|activer|désactiver]', desc: 'Configurer les messages de bienvenue',      cat: '⚙️ Configuration Serveur' },
  { cmd: '!setanniversaire #salon',                    desc: 'Configurer le salon des anniversaires',                cat: '⚙️ Configuration Serveur' },
  { cmd: '!setchannelniveau #salon',                   desc: 'Configurer le salon des montées de niveau',            cat: '⚙️ Configuration Serveur' },
  { cmd: '!règlement [ajouter|modifier|supprimer|publier|actualiser]', desc: 'Règlement interactif du serveur',     cat: '⚙️ Configuration Serveur' },
  { cmd: '!setregles / !ajouterregle / !modifierregle / !deplacerregle / !supprimerregle / !effacerregles', desc: 'Gérer les règles affichées', cat: '⚙️ Configuration Serveur' },
  { cmd: '!event [creer|annuler|rejoindre|liste]',     desc: 'Gérer les événements RSVP',                            cat: '⚙️ Configuration Serveur' },
  { cmd: '!calendrier [ajouter|supprimer|salon|rappels|statut]', desc: 'Calendrier de matchs et rappels',           cat: '⚙️ Configuration Serveur' },
  { cmd: '!tableaudebord [salon|auto|heure|statut|lien]', desc: 'Dashboard automatique du serveur',                 cat: '⚙️ Configuration Serveur' },
  { cmd: '!setdelai <commande> <secondes>',            desc: 'Modifier le cooldown d\'une commande',                 cat: '⚙️ Configuration Serveur' },
  { cmd: '!delais',                                    desc: 'Voir tous les cooldowns configurés',                   cat: '⚙️ Configuration Serveur' },
  { cmd: '!suppdelai <commande>',                      desc: 'Réinitialiser le cooldown d\'une commande',            cat: '⚙️ Configuration Serveur' },
  // IA Staff
  { cmd: '!ia modele <nom>',                           desc: 'Changer le modèle IA actif du serveur',               cat: '🤖 Intelligence Artificielle' },
  // Système & Logs
  { cmd: '!statsbot',                                  desc: 'Statistiques d\'utilisation du bot par commande',      cat: '🔧 Système & Logs' },
  { cmd: '!logs',                                      desc: 'Historique des actions du staff',                      cat: '🔧 Système & Logs' },
  { cmd: '!journal [N]',                               desc: 'Voir les N derniers commits Git (changelog)',          cat: '🔧 Système & Logs' },
  { cmd: '!note <équipe> <texte>',                     desc: 'Ajouter une note interne sur une équipe',             cat: '🔧 Système & Logs' },
  { cmd: '!notes <équipe>',                            desc: 'Voir les notes internes d\'une équipe',               cat: '🔧 Système & Logs' },
  { cmd: '!delnote <équipe> <ID>',                     desc: 'Supprimer une note interne',                          cat: '🔧 Système & Logs' },
  { cmd: '!gitpush',                                   desc: 'Pousser le code vers GitHub manuellement',             cat: '🔧 Système & Logs' },
  { cmd: '!gitstatus',                                 desc: 'Voir le statut du dépôt Git',                         cat: '🔧 Système & Logs' },
];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (!message.member) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    if (content !== '!aidestaff' && !content.startsWith('!aidestaff ')) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Cette commande est réservée au staff.');

    const cd = checkCooldown(message.author.id, 'aidestaff', 10);
    if (cd) return replyCooldown(message, cd, 'aidestaff');

    const query = content.slice('!aidestaff'.length).trim().toLowerCase();

    // ── Mode recherche ────────────────────────────────────────────────────────
    if (query) {
      const results = CMDS.filter(c =>
        c.cmd.toLowerCase().includes(query) ||
        c.desc.toLowerCase().includes(query) ||
        c.cat.toLowerCase().includes(query)
      );

      if (!results.length) {
        return message.reply(`🔍 Aucune commande staff trouvée pour **"${query}"**.\nTape \`!aidestaff\` pour voir toutes les commandes staff.`);
      }

      const byCategory = {};
      for (const r of results) {
        if (!byCategory[r.cat]) byCategory[r.cat] = [];
        byCategory[r.cat].push(`\`${r.cmd}\` — ${r.desc}`);
      }

      const fields = Object.entries(byCategory).map(([name, lines]) => ({
        name,
        value: lines.join('\n'),
        inline: false,
      }));

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: 'SUPREMYX — Recherche Staff', iconURL: client.user.displayAvatarURL() })
        .setDescription(`🔍 **${results.length}** commande(s) staff trouvée(s) pour **"${query}"** :`)
        .addFields(fields)
        .setFooter({ text: 'SUPREMYX Esports · !aidestaff pour l\'aide staff complète' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── Mode aide complète ────────────────────────────────────────────────────
    const color = 0xED4245;
    const footer = { text: 'SUPREMYX Esports · Commandes réservées au staff · !aidestaff <terme> pour rechercher' };

    const embed1 = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'SUPREMYX — Aide Staff', iconURL: client.user.displayAvatarURL() })
      .setDescription('Inventaire complet des commandes réservées au staff.\n> 🔒 Requiert la permission **Administrateur**. Paramètres `< >` obligatoires, `[ ]` optionnels. Tape `!aidestaff <terme>` pour filtrer.')
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
          name: '📢 Communication',
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
