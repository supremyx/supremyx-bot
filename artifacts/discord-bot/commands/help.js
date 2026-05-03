const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!help') return;

    const embed = new EmbedBuilder()
      .setTitle('📖 Aide — MoSeTo')
      .setColor(0x5865F2)
      .setDescription('Toutes les commandes disponibles. *(staff)* = réservé aux administrateurs.')
      .addFields(
        {
          name: '🤖 Bot',
          value: [
            '`!ping` — Latence du bot',
            '`!status` — Tableau de bord complet (stats, uptime, ping)',
            '`!config` — Afficher la configuration du bot',
            '`!setpointssystem <p:pts> ... [kill:<pts>]` — Modifier le barème *(staff)*',
          ].join('\n')
        },
        {
          name: '📢 Annonces & Embeds',
          value: [
            '`!announce <message>` — Annonce en embed vers le salon d\'annonce *(staff)*',
            '`!embed <titre> | <desc> | [couleur] | [image] | [footer]` — Embed personnalisé *(staff)*',
            '`!motd` — Message du jour',
            '`!setmotd <texte>` — Définir le message du jour *(staff)*',
          ].join('\n')
        },
        {
          name: '👋 Bienvenue & Autorole',
          value: [
            '`!welcome` — Voir la configuration du message de bienvenue *(staff)*',
            '`!welcome set <message>` — Définir le message (`{user}` `{server}` `{count}`) *(staff)*',
            '`!welcome channel #salon` — Choisir le salon de bienvenue *(staff)*',
            '`!welcome test` — Tester le message *(staff)*',
            '`!welcome on / off` — Activer / désactiver *(staff)*',
            '`!autorole` — Voir la configuration de l\'autorole *(staff)*',
            '`!autorole set @role` — Rôle automatique aux nouveaux membres *(staff)*',
            '`!autorole on / off` — Activer / désactiver *(staff)*',
          ].join('\n')
        },
        {
          name: '👥 Équipes',
          value: [
            '`!register <nom>` — Inscrire une équipe *(staff)*',
            '`!unregister <nom>` — Supprimer une équipe *(staff)*',
            '`!rename <ancien> | <nouveau>` — Renommer une équipe *(staff)*',
            '`!merge <équipe1> | <équipe2>` — Fusionner deux équipes *(staff)*',
            '`!lineup <équipe> <j1,j2,...>` — Définir la composition *(staff)*',
            '`!lineup <équipe>` — Voir la composition',
          ].join('\n')
        },
        {
          name: '🎮 Matchs',
          value: [
            '`!addmatch <nom> <placement> <kills>` — Ajouter un résultat *(staff)*',
            '`!resetmatch` — Remettre tous les scores à zéro *(staff)*',
            '`!export` — Exporter le classement en CSV *(staff)*',
            '`!export matchs` — Exporter l\'historique des matchs en CSV *(staff)*',
            '`!backup` — Sauvegarde complète en JSON (DM) *(staff)*',
            '`!restore` — Restaurer depuis un fichier JSON *(staff)*',
          ].join('\n')
        },
        {
          name: '📊 Statistiques',
          value: [
            '`!ranking` — Classement général',
            '`!ranking <tournoi>` — Classement d\'un tournoi',
            '`!top <n>` — Top N des équipes',
            '`!leaderboard` — Classement en direct',
            '`!search <nom>` — Rechercher une équipe',
            '`!compare <eq1> <eq2>` — Comparer deux équipes',
            '`!h2h <eq1> vs <eq2>` — Face à face statistique',
            '`!stats <nom>` — Statistiques détaillées',
            '`!history <nom>` — Historique des matchs',
            '`!matchs` — Dernier match de chaque équipe',
            '`!mvp` — MVP du tournoi actif',
            '`!streak <équipe>` — Série de victoires/défaites',
            '`!consistency <équipe>` — Score de régularité',
            '`!calc <placement> <kills>` — Simuler un calcul de points',
          ].join('\n')
        },
        {
          name: '🏁 Tournois',
          value: [
            '`!newtournoi <nom>` — Lancer un nouveau tournoi *(staff)*',
            '`!endtournoi` — Clôturer le tournoi en cours *(staff)*',
            '`!tournois` — Historique de tous les tournois',
            '`!deletetournoi <nom>` — Supprimer un tournoi *(staff)*',
            '`!bracket` — Bracket depuis les équipes enregistrées',
            '`!bracket TeamA,TeamB,...` — Bracket personnalisé',
          ].join('\n')
        },
        {
          name: '🗓️ Saisons',
          value: [
            '`!newseason <nom>` — Lancer une nouvelle saison *(staff)*',
            '`!endseason` — Clore la saison *(staff)*',
            '`!saisons` — Historique de toutes les saisons',
          ].join('\n')
        },
        {
          name: '📅 Calendrier',
          value: [
            '`!schedule` — Afficher les matchs à venir',
            '`!schedule add <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note]` — Planifier *(staff)*',
            '`!schedule delete <id>` — Supprimer un match planifié *(staff)*',
            '`!schedule clear` — Supprimer les matchs passés *(staff)*',
          ].join('\n')
        },
        {
          name: '📊 Sondages',
          value: [
            '`!sondage <durée> <question> | <opt1> | <opt2> | ...` — Sondage temporisé avec résultats auto *(staff)*',
            '`!poll <question> | <opt1> | <opt2> | ...` — Sondage simple *(staff)*',
          ].join('\n')
        },
        {
          name: '🗳️ Suggestions',
          value: [
            '`!suggestion <texte>` — Soumettre une idée au staff',
            '`!setsuggestion #salon` — Configurer le salon de suggestions *(staff)*',
            '`!sugaccept <id> [note]` — Accepter une suggestion *(staff)*',
            '`!sugreject <id> [note]` — Refuser une suggestion *(staff)*',
          ].join('\n')
        },
        {
          name: '📅 Événements RSVP',
          value: [
            '`!event create <titre> | [desc] | [date]` — Créer un événement *(staff)*',
            '`!event list` — Voir les événements actifs',
            '`!event participants <id>` — Voir les inscrits',
            '`!event cancel <id>` — Annuler un événement *(staff)*',
          ].join('\n')
        },
        {
          name: '🎉 Giveaways',
          value: [
            '`!giveaway <durée> <prix>` — Lancer un giveaway *(staff)*',
            '`!reroll <messageId>` — Reroll d\'un giveaway *(staff)*',
          ].join('\n')
        },
        {
          name: '📈 Niveaux & XP',
          value: [
            '`!level [@user]` — Voir son niveau et ses XP',
            '`!levelboard` — Classement XP Top 10',
            '`!setlevelchannel #salon` — Salon pour les annonces de level-up *(staff)*',
          ].join('\n')
        },
        {
          name: '💤 AFK',
          value: [
            '`!afk [message]` — Passer en mode AFK',
            '*(Le statut se retire automatiquement à ton prochain message)*',
          ].join('\n')
        },
        {
          name: '🎂 Anniversaires',
          value: [
            '`!birthday set DD/MM` — Enregistrer son anniversaire',
            '`!birthday set DD/MM/YYYY` — Avec l\'année',
            '`!birthday list` — Voir tous les anniversaires',
            '`!birthday check [@user]` — Vérifier un anniversaire',
            '`!birthday del` — Supprimer son anniversaire',
            '`!setbirthday #salon` — Salon pour les annonces *(staff)*',
          ].join('\n')
        },
        {
          name: '📋 Sanctions & Escalade',
          value: [
            '`!sanctions @user` — Historique complet des sanctions d\'un membre',
            '`!punition @user <warn|mute|kick|ban> [durée_min] | <raison>` — Appliquer une sanction *(staff)*',
            '`!clearactions @user` — Effacer tout l\'historique de sanctions *(staff)*',
            '`!escalade` — Voir les règles d\'escalade automatique *(staff)*',
            '`!escalade on / off` — Activer / désactiver *(staff)*',
            '`!escalade set <warns> <action> [durée_min]` — Configurer une règle *(staff)*',
            '`!escalade del <warns>` — Supprimer une règle *(staff)*',
            '`!escalade reset` — Réinitialiser aux valeurs par défaut *(staff)*',
          ].join('\n')
        },
        {
          name: '🛡️ Modération',
          value: [
            '`!warn @user <raison>` — Avertir un membre *(staff)*',
            '`!warns @user` — Voir les avertissements',
            '`!delwarn <id>` — Supprimer un avertissement *(staff)*',
            '`!mute @user <minutes> [raison]` — Timeout *(staff)*',
            '`!unmute @user` — Lever le timeout *(staff)*',
            '`!clear <n>` — Supprimer N messages *(staff)*',
            '`!lock [#salon]` — Verrouiller un salon *(staff)*',
            '`!unlock [#salon]` — Déverrouiller un salon *(staff)*',
            '`!slowmode <secondes> [#salon]` — Mode lent *(staff)*',
            '`!dm @user <message>` — Envoyer un DM via le bot *(staff)*',
          ].join('\n')
        },
        {
          name: '🎫 Tickets',
          value: [
            '`!ticket` — Ouvrir un ticket support',
            '`!ticket support / signalement / candidature` — Ouvrir avec catégorie',
            '`!ticket panel` — Poster le panel de création *(staff)*',
            '`!tickets` — Voir tous les tickets ouverts *(staff)*',
            '`!claim` — Prendre en charge le ticket *(staff, dans le ticket)*',
            '`!resolve` — Marquer comme résolu *(staff, dans le ticket)*',
            '`!adduser @user` — Ajouter un membre au ticket *(staff)*',
            '`!close` — Fermer et archiver le ticket',
            '`!ticketconfig` — Voir / modifier la configuration *(staff)*',
            '`!ticketconfig staffrole @role` — Rôle staff pour les tickets *(staff)*',
            '`!ticketconfig transcript #salon` — Salon des transcripts *(staff)*',
            '`!ticketconfig category <id>` — Catégorie Discord pour les tickets *(staff)*',
          ].join('\n')
        },
        {
          name: '🔍 Informations',
          value: [
            '`!userinfo [@user]` — Fiche détaillée d\'un membre',
            '`!serverinfo` — Statistiques du serveur',
            '`!roleinfo @role` — Informations sur un rôle',
          ].join('\n')
        },
        {
          name: '🏅 Trophées',
          value: [
            '`!achievement [emoji] <équipe> <titre> | [desc]` — Attribuer un trophée *(staff)*',
            '`!achievements <équipe>` — Voir les trophées d\'une équipe',
          ].join('\n')
        },
        {
          name: '📖 Règlement interactif',
          value: [
            '`!règlement` — Afficher le règlement complet',
            '`!règlement list` — Lister les sections | `!règlement list <num>` — Détail',
            '`!règlement add <section> <règle>` — Ajouter une règle *(staff)*',
            '`!règlement edit <section> <num> <texte>` — Modifier une règle *(staff)*',
            '`!règlement del <section> <num>` — Supprimer une règle *(staff)*',
            '`!règlement section add <emoji> <titre>` — Nouvelle section *(staff)*',
            '`!règlement section del/rename/emoji <num>` — Gérer les sections *(staff)*',
            '`!règlement titre <titre>` / `!règlement intro <texte>` *(staff)*',
            '`!règlement post [#salon]` — Poster et épingler *(staff)*',
            '`!règlement update` — Mettre à jour le message épinglé *(staff)*',
          ].join('\n')
        },
        {
          name: '📋 Règles tournoi (simple)',
          value: [
            '`!rules` — Afficher les règles du tournoi',
            '`!setrules <titre> | <règle1> | <règle2> | ...` — Définir *(staff)*',
            '`!addrule <règle>` — Ajouter une règle *(staff)*',
            '`!delrule <numéro>` — Supprimer une règle *(staff)*',
          ].join('\n')
        },
        {
          name: '📝 Notes staff',
          value: [
            '`!note <cible> <texte>` — Ajouter une note privée *(staff)*',
            '`!notes <cible>` — Voir les notes sur une cible *(staff)*',
            '`!delnote <id>` — Supprimer une note *(staff)*',
          ].join('\n')
        },
        {
          name: '🎲 Aléatoire',
          value: [
            '`!coinflip` — Pile ou face',
            '`!randteam` — Tirage au sort des équipes enregistrées',
            '`!randteam TeamA,TeamB,...` — Tirage au sort personnalisé',
            '`!remind <durée> <message>` — Rappel personnel par DM',
          ].join('\n')
        },
        {
          name: '📋 Historique staff',
          value: [
            '`!log` — Dernières actions staff (paginé)',
            '`!log <page>` — Page spécifique',
            '`!log <catégorie>` — Filtrer : match, modération, tournoi...',
            '`!log today` — Logs du jour',
            '`!log stats` — Statistiques par catégorie',
            '`!log clear` — Effacer l\'historique *(staff)*',
          ].join('\n')
        },
        {
          name: '🚫 Blacklist',
          value: [
            '`!blacklist add <cible> | <raison>` — Bannir *(staff)*',
            '`!blacklist remove <cible>` — Retirer *(staff)*',
            '`!blacklist list` — Voir toute la blacklist',
            '`!blacklist check <cible>` — Vérifier',
          ].join('\n')
        },
        {
          name: '🎖️ Rôles automatiques de rang',
          value: [
            '`!setrankreward <rang> @role [label]` — Associer un rôle à un rang *(staff)*',
            '`!linkteam <équipe> @role` — Lier une équipe à son rôle *(staff)*',
            '`!rankrewards` — Voir la configuration',
            '`!syncranks` — Synchroniser manuellement *(staff)*',
            '`!delrankreward <rang>` — Supprimer une récompense *(staff)*',
          ].join('\n')
        },
        {
          name: '🎭 Reaction Roles',
          value: [
            '`!reactionrole add <msgId> <emoji> @role [label]` — Configurer *(staff)*',
            '`!reactionrole remove <msgId> <emoji>` — Supprimer *(staff)*',
            '`!reactionrole clear <msgId>` — Supprimer tous sur un message *(staff)*',
            '`!reactionrole list` — Voir tous les reaction-roles *(staff)*',
          ].join('\n')
        },
        {
          name: '⏳ Cooldowns',
          value: [
            '`!cooldowns` — Voir tous les cooldowns *(staff)*',
            '`!setcooldown <commande> <secondes>` — Modifier le délai *(staff)*',
            '`!delcooldown <commande>` — Réinitialiser au défaut *(staff)*',
          ].join('\n')
        },
        {
          name: '⏱️ Anti-spam & Automod',
          value: [
            '`!antispam` — Voir la configuration anti-spam',
            '`!antispam on / off` — Activer / désactiver *(staff)*',
            '`!antispam set <messages> <secondes>` — Régler le seuil *(staff)*',
            '`!automod` — Voir le statut de détection de mots',
            '`!automod on / off` — Activer / désactiver *(staff)*',
            '`!words` — Voir la liste des mots interdits *(staff)*',
            '`!word add <mot>` / `!word del <mot>` / `!word setup` / `!word clear` *(staff)*',
          ].join('\n')
        },
        {
          name: '📊 Dashboard',
          value: [
            '`!dashboard` — Générer le tableau de bord maintenant',
            '`!dashboard channel #salon` — Configurer le salon de publication *(staff)*',
            '`!dashboard auto on / off` — Publication quotidienne automatique *(staff)*',
            '`!dashboard hour <0-23>` — Heure de publication UTC *(staff)*',
            '`!dashboard status` — Voir la configuration *(staff)*',
          ].join('\n')
        },
        {
          name: '🚨 Signalements',
          value: [
            '`!report <message>` — Signaler un problème anonymement au staff',
          ].join('\n')
        },
      )
      .setFooter({ text: 'MoSeTo • Tapez une commande pour commencer' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
