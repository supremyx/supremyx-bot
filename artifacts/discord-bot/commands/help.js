const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!help') return;

    const embed = new EmbedBuilder()
      .setTitle('📖 Aide — MoSeTo')
      .setColor(0x5865F2)
      .setDescription('Voici toutes les commandes disponibles. *(staff)* = réservé aux administrateurs.')
      .addFields(
        {
          name: '🤖 Bot',
          value: [
            '`!ping` — Latence du bot',
            '`!status` — Tableau de bord complet (stats, uptime, ping)',
            '`!config` — Afficher la configuration du bot',
            '`!setpointssystem <p:pts> ... [kill:<pts>]` — Modifier le barème de points *(staff)*',
          ].join('\n')
        },
        {
          name: '📢 Annonces',
          value: [
            '`!announce <message>` — Envoie une annonce en embed *(staff)*',
            '`!motd` — Afficher le message du jour',
            '`!setmotd <texte>` — Définir le message du jour *(staff)*',
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
            '`!restore` — Restaurer depuis un fichier JSON de backup *(staff)*',
          ].join('\n')
        },
        {
          name: '📊 Statistiques',
          value: [
            '`!ranking` — Classement général',
            '`!ranking <tournoi>` — Classement d\'un tournoi',
            '`!top <n>` — Top N des équipes',
            '`!leaderboard` — Classement en direct',
            '`!leaderboard <saison>` — Classement final d\'une saison passée',
            '`!search <nom>` — Rechercher une équipe',
            '`!compare <eq1> <eq2>` — Comparer deux équipes',
            '`!h2h <eq1> vs <eq2>` — Face à face statistique',
            '`!stats <nom>` — Statistiques détaillées',
            '`!history <nom>` — Historique des matchs',
            '`!matchs` — Dernier match de chaque équipe',
            '`!mvp` — MVP du tournoi actif',
            '`!mvpseason` — Classement des kills',
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
            '`!endseason` — Clore la saison et sauvegarder le classement *(staff)*',
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
          name: '🎉 Événements',
          value: [
            '`!giveaway <durée> <prix>` — Lancer un giveaway *(staff)*',
            '`!reroll <messageId>` — Reroll d\'un giveaway *(staff)*',
            '`!poll <question> | <opt1> | <opt2> | ...` — Créer un sondage *(staff)*',
            '`!remind <durée> <message>` — Se rappeler quelque chose par DM',
          ].join('\n')
        },
        {
          name: '🛡️ Modération',
          value: [
            '`!warn @user <raison>` — Avertir un joueur *(staff)*',
            '`!warns @user` — Voir les avertissements',
            '`!delwarn <id>` — Supprimer un avertissement *(staff)*',
            '`!mute @user <minutes> [raison]` — Mettre en sourdine *(staff)*',
            '`!unmute @user` — Lever la sourdine *(staff)*',
            '`!clear <n>` — Supprimer N messages *(staff)*',
            '`!slowmode <secondes>` — Mode lent dans un salon *(staff)*',
            '`!dm @user <message>` — Envoyer un DM via le bot *(staff)*',
            '`!ticket` — Ouvrir un ticket privé avec le staff',
            '`!close` — Fermer un ticket (dans le salon ticket)',
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
          name: '📋 Règles',
          value: [
            '`!rules` — Afficher les règles du tournoi',
            '`!setrules <titre> | <règle1> | <règle2> | ...` — Définir les règles *(staff)*',
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
          ].join('\n')
        },
        {
          name: '📋 Historique staff',
          value: [
            '`!log` — Dernières actions staff (paginé)',
            '`!log <page>` — Page spécifique de l\'historique',
            '`!log <catégorie>` — Filtrer : match, modération, tournoi, données, config…',
            '`!log <mot-clé>` — Recherche dans les logs',
            '`!log today` — Logs du jour uniquement',
            '`!log stats` — Statistiques par catégorie',
            '`!log clear` — Effacer tout l\'historique *(staff)*',
          ].join('\n')
        },
        {
          name: '🚫 Blacklist',
          value: [
            '`!blacklist add <cible> | <raison>` — Bannir une équipe/joueur *(staff)*',
            '`!blacklist remove <cible>` — Retirer de la blacklist *(staff)*',
            '`!blacklist list` — Voir toute la blacklist',
            '`!blacklist check <cible>` — Vérifier si une cible est bannie',
          ].join('\n')
        },
        {
          name: '🎖️ Rôles automatiques',
          value: [
            '`!setrankreward <rang> @role [label]` — Associer un rôle Discord à un rang *(staff)*',
            '`!linkteam <équipe> @role` — Lier une équipe à son rôle Discord *(staff)*',
            '`!rankrewards` — Voir la configuration des récompenses de rang',
            '`!syncranks` — Synchroniser manuellement les rôles de rang *(staff)*',
            '`!delrankreward <rang>` — Supprimer une récompense de rang *(staff)*',
          ].join('\n')
        },
        {
          name: '🎭 Reaction Roles',
          value: [
            '`!reactionrole add <msgId> <emoji> @role [label]` — Configurer un reaction-role *(staff)*',
            '`!reactionrole remove <msgId> <emoji>` — Supprimer un reaction-role *(staff)*',
            '`!reactionrole clear <msgId>` — Supprimer tous les reaction-roles d\'un message *(staff)*',
            '`!reactionrole list` — Voir tous les reaction-roles *(staff)*',
          ].join('\n')
        },
        {
          name: '⏳ Cooldowns',
          value: [
            '`!cooldowns` — Voir tous les cooldowns actifs et leurs valeurs *(staff)*',
            '`!setcooldown <commande> <secondes>` — Modifier le délai d\'une commande *(staff)*',
            '`!delcooldown <commande>` — Réinitialiser au délai par défaut *(staff)*',
          ].join('\n')
        },
        {
          name: '⏱️ Anti-spam',
          value: [
            '`!antispam` — Voir le statut et la configuration',
            '`!antispam on / off` — Activer / désactiver *(staff)*',
            '`!antispam set <messages> <secondes>` — Régler le seuil *(staff)*',
          ].join('\n')
        },
        {
          name: '🤬 Mots interdits',
          value: [
            '`!automod` — Voir le statut de la détection',
            '`!automod on / off` — Activer / désactiver *(staff)*',
            '`!words` — Voir la liste des mots interdits *(staff)*',
            '`!word add <mot>` — Ajouter un mot interdit *(staff)*',
            '`!word del <mot>` — Supprimer un mot *(staff)*',
            '`!word setup` — Charger la liste par défaut *(staff)*',
            '`!word clear` — Vider toute la liste *(staff)*',
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
