const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const PAGES = [
  {
    title: '🛡️ Aide Admin SUPREMYX — Page 1 / 6 — Bot & Annonces',
    fields: [
      {
        name: '🤖 Bot',
        value: [
          '`!ping` — Latence du bot',
          '`!status` — Tableau de bord (stats, uptime, ping)',
          '`!config` — Configuration du bot',
          '`!setpointssystem <p:pts> ... [kill:<pts>]` — Modifier le barème',
          '`!helpadmin` — Cette aide staff complète',
          '`!helpstaff` — Aide rapide staff',
          '`!gitpush` — Pousser les derniers commits vers GitHub',
          '`!changelog [n]` — Voir les N derniers commits du bot',
          '`!botstats` — Statistiques d\'utilisation du bot',
          '`!dashboard web` — Lien vers le dashboard classement en ligne',
          '`!ai <texte>` / `!ia <texte>` — Utilisation de l\'intelligence artificielle',
        ].join('\n')
      },
      {
        name: '📢 Annonces & Embeds',
        value: [
          '`!announce <message>` — Annonce en embed',
          '`!say [#salon] <texte>` — Envoyer du texte simple (+ médias joints)',
          '`!embed <titre> | <desc> | [couleur] | [image] | [footer]` — Embed personnalisé',
          '`!motd` — Message du jour',
          '`!setmotd <texte>` — Définir le message du jour',
        ].join('\n')
      },
      {
        name: '👋 Bienvenue & Autorole',
        value: [
          '`!welcome` — Voir la configuration',
          '`!welcome set <message>` — Définir le message (`{user}` `{server}` `{count}`)',
          '`!welcome channel #salon` — Choisir le salon',
          '`!welcome test` — Tester le message',
          '`!welcome on / off` — Activer / désactiver',
          '`!autorole set @role` — Rôle automatique aux nouveaux membres',
          '`!autorole on / off` — Activer / désactiver',
        ].join('\n')
      },
      {
        name: '📊 Dashboard',
        value: [
          '`!dashboard` — Générer le tableau de bord maintenant',
          '`!dashboard channel #salon` — Configurer le salon',
          '`!dashboard auto on / off` — Publication quotidienne',
          '`!dashboard hour <0-23>` — Heure de publication UTC',
          '`!dashboard status` — Voir la configuration',
        ].join('\n')
      },
    ]
  },
  {
    title: '🛡️ Aide Admin SUPREMYX — Page 2 / 6 — Équipes & Matchs',
    fields: [
      {
        name: '👥 Équipes',
        value: [
          '`!register <nom>` — Inscrire une équipe',
          '`!unregister <nom>` — Supprimer une équipe',
          '`!rename <ancien> | <nouveau>` — Renommer',
          '`!merge <équipe1> | <équipe2>` — Fusionner',
          '`!lineup <équipe> <j1,j2,...>` — Définir la composition',
          '`!lineup <équipe>` — Voir la composition',
        ].join('\n')
      },
      {
        name: '👥 Roster équipes',
        value: [
          '`!roster <équipe>` — Afficher le roster',
          '`!roster list` — Tous les rosters',
          '`!roster add <équipe> @user <rôle> [note]` — Ajouter',
          '`!roster del <équipe> @user` — Retirer',
          '`!roster role <équipe> @user <rôle>` — Changer le rôle',
          '`!roster note <équipe> @user <note>` — Ajouter une note',
          '`!roster clear <équipe>` — Vider le roster',
          '*Rôles : IGL, Fragger, Support, Sniper, Entry, Flex, Coach, Remplaçant*',
        ].join('\n')
      },
      {
        name: '🎮 Matchs',
        value: [
          '`!addmatch <nom> <placement> <kills>` — Ajouter un résultat',
          '`!result <eq:place:kills> [eq:place:kills ...]` — Résultats multi-équipes en direct',
          '`!result from <scheduleId> <eq:place:kills> [...]` — Résultats liés à un match planifié',
          '`!result channel #salon` — Salon pour les résultats',
          '`!resetmatch` — Remettre tous les scores à zéro',
          '`!export` — Exporter le classement en CSV',
          '`!export matchs` — Exporter l\'historique des matchs',
          '`!backup` — Sauvegarde complète en JSON (DM)',
          '`!restore` — Restaurer depuis un fichier JSON',
        ].join('\n')
      },
    ]
  },
  {
    title: '🛡️ Aide Admin SUPREMYX — Page 3 / 6 — Statistiques & Tournois',
    fields: [
      {
        name: '📊 Statistiques — Équipes',
        value: [
          '`!ranking` — Classement général',
          '`!ranking <tournoi>` — Classement d\'un tournoi',
          '`!top <n>` — Top N des équipes',
          '`!search <nom>` — Rechercher une équipe',
          '`!compare <eq1> vs <eq2>` — Comparer deux équipes',
          '`!stats <nom>` — Statistiques détaillées',
          '`!teaminfo <nom>` — Fiche complète (stats + roster + tournois)',
          '`!history <nom>` — Historique des matchs',
          '`!matchs` — Dernier match de chaque équipe',
        ].join('\n')
      },
      {
        name: '📊 Statistiques — Joueurs',
        value: [
          '`!mvp` — MVP du tournoi actif',
          '`!playerstats <pseudo>` — Stats individuelles d\'un joueur',
          '`!playerboard [équipe]` — Top joueurs par kills',
          '`!playermatch <équipe> <joueur> <kills>` — Enregistrer kills',
          '`!playerreset <équipe> <joueur>` — Reset stats joueur',
        ].join('\n')
      },
      {
        name: '🏁 Tournois',
        value: [
          '`!newtournoi <nom>` — Lancer un tournoi',
          '`!endtournoi` — Clôturer le tournoi en cours',
          '`!tournoi <nom>` — Détails et classement d\'un tournoi spécifique',
          '`!tournois` — Historique de tous les tournois',
          '`!deletetournoi <nom>` — Supprimer un tournoi',
          '`!bracket` — Bracket depuis les équipes enregistrées',
          '`!bracket TeamA,TeamB,...` — Bracket personnalisé',
        ].join('\n')
      },
      {
        name: '🗓️ Saisons',
        value: [
          '`!newseason <nom>` — Lancer une nouvelle saison',
          '`!endseason` — Clore la saison',
          '`!saisons` — Historique de toutes les saisons',
          '`!mvpseason` — MVP all-time sur toutes les saisons terminées',
        ].join('\n')
      },
      {
        name: '📅 Calendrier',
        value: [
          '`!schedule` — Afficher les matchs à venir',
          '`!schedule add <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note]` — Planifier',
          '`!schedule edit <id> <DD/MM/YYYY> <HH:MM> [équipes] [note]` — Modifier',
          '`!schedule delete <id>` — Supprimer',
          '`!schedule clear` — Supprimer les matchs passés',
          '`!schedule channel #salon` — Salon pour les rappels',
          '`!schedule remind <on|off> [24h|1h|15m]` — Gérer les rappels',
          '`!schedule status` — Voir la configuration',
        ].join('\n')
      },
    ]
  },
  {
    title: '🛡️ Aide Admin SUPREMYX — Page 4 / 6 — Modération & Sanctions',
    fields: [
      {
        name: '🛡️ Modération',
        value: [
          '`!warn @user <raison>` — Avertir un membre',
          '`!warns @user` — Voir les avertissements',
          '`!delwarn <id>` — Supprimer un avertissement',
          '`!mute @user <minutes> [raison]` — Timeout',
          '`!unmute @user` — Lever le timeout',
          '`!clear <n>` — Supprimer N messages',
          '`!lock [#salon]` — Verrouiller un salon',
          '`!unlock [#salon]` — Déverrouiller un salon',
          '`!slowmode <secondes> [#salon]` — Mode lent',
          '`!dm @user <message>` — Envoyer un DM via le bot',
        ].join('\n')
      },
      {
        name: '📋 Sanctions & Escalade',
        value: [
          '`!sanctions @user` — Historique des sanctions',
          '`!punition @user <warn|mute|kick|ban> [durée_min] | <raison>` — Sanctionner',
          '`!clearactions @user` — Effacer l\'historique de sanctions',
          '`!escalade` — Voir les règles d\'escalade',
          '`!escalade on / off` — Activer / désactiver',
          '`!escalade set <warns> <action> [durée_min]` — Configurer',
          '`!escalade del <warns>` — Supprimer une règle',
          '`!escalade reset` — Réinitialiser aux valeurs par défaut',
        ].join('\n')
      },
      {
        name: '⏱️ Anti-spam & Automod',
        value: [
          '`!antispam on / off` — Activer / désactiver',
          '`!antispam set <messages> <secondes>` — Régler le seuil',
          '`!automod on / off` — Détection de mots interdits',
          '`!words` — Voir la liste des mots interdits',
          '`!word add <mot>` / `!word del <mot>` / `!word clear`',
          '`!word setup` — Charger la liste de mots par défaut',
        ].join('\n')
      },
      {
        name: '🚫 Blacklist',
        value: [
          '`!blacklist add <cible> | <raison>` — Bannir',
          '`!blacklist remove <cible>` — Retirer',
          '`!blacklist list` — Voir toute la blacklist',
          '`!blacklist check <cible>` — Vérifier',
        ].join('\n')
      },
    ]
  },
  {
    title: '🛡️ Aide Admin SUPREMYX — Page 5 / 6 — Tickets & Communauté',
    fields: [
      {
        name: '🎫 Tickets',
        value: [
          '`!ticket` — Ouvrir un ticket support',
          '`!ticket support / signalement / candidature` — Ouvrir avec catégorie',
          '`!ticket panel` — Poster le panel de création',
          '`!tickets` — Voir tous les tickets ouverts',
          '`!claim` — Prendre en charge le ticket',
          '`!resolve` — Marquer comme résolu',
          '`!adduser @user` — Ajouter un membre au ticket',
          '`!close` — Fermer et archiver le ticket',
          '`!ticketconfig staffrole / transcript / category` — Configurer',
        ].join('\n')
      },
      {
        name: '📊 Sondages & Giveaways',
        value: [
          '`!sondage <durée> <question> | <opt1> | <opt2> | ...` — Sondage temporisé',
          '`!poll <question> | <opt1> | <opt2> | ...` — Sondage simple',
          '`!giveaway <durée> <prix>` — Lancer un giveaway',
          '`!reroll <messageId>` — Reroll d\'un giveaway',
        ].join('\n')
      },
      {
        name: '🗳️ Suggestions',
        value: [
          '`!suggestion <texte>` — Soumettre une idée au staff',
          '`!setsuggestion #salon` — Configurer le salon',
          '`!sugaccept <id> [note]` — Accepter',
          '`!sugreject <id> [note]` — Refuser',
        ].join('\n')
      },
      {
        name: '📅 Événements RSVP',
        value: [
          '`!event create <titre> | [desc] | [date]` — Créer',
          '`!event list` — Voir les événements actifs',
          '`!event participants <id>` — Voir les inscrits',
          '`!event cancel <id>` — Annuler',
        ].join('\n')
      },
    ]
  },
  {
    title: '🛡️ Aide Admin SUPREMYX — Page 6 / 6 — Infos & Configuration',
    fields: [
      {
        name: '🔍 Informations',
        value: [
          '`!userinfo [@user]` — Fiche détaillée d\'un membre',
          '`!serverinfo` — Statistiques du serveur',
          '`!roleinfo @role` — Informations sur un rôle',
        ].join('\n')
      },
      {
        name: '📈 Niveaux & XP',
        value: [
          '`!level [@user]` — Voir son niveau et ses XP',
          '`!levelboard` — Classement XP Top 10',
          '`!setlevelchannel #salon` — Salon pour les level-up',
        ].join('\n')
      },
      {
        name: '🎂 Anniversaires',
        value: [
          '`!birthday set DD/MM` — Enregistrer son anniversaire',
          '`!birthday list` — Voir tous les anniversaires',
          '`!birthday check [@user]` — Vérifier',
          '`!birthday del` — Supprimer son anniversaire',
          '`!setbirthday #salon` — Salon pour les annonces',
        ].join('\n')
      },
      {
        name: '🎖️ Rôles de rang & Reaction Roles',
        value: [
          '`!setrankreward <rang> @role [label]` — Associer un rôle à un rang',
          '`!delrankreward <rang>` — Supprimer un rôle de rang',
          '`!linkteam <équipe> @role` — Lier une équipe à son rôle',
          '`!rankrewards` — Voir la configuration',
          '`!syncranks` — Synchroniser manuellement',
          '`!reactionrole add <msgId> <emoji> @role` — Configurer',
          '`!reactionrole list` — Voir tous les reaction-roles',
        ].join('\n')
      },
      {
        name: '🔧 Configuration avancée & Logs',
        value: [
          '`!note <cible> <texte>` — Note privée',
          '`!notes <cible>` — Voir les notes',
          '`!delnote <id>` — Supprimer une note',
          '`!achievement [emoji] <équipe> <titre>` — Attribuer un trophée',
          '`!setrules <titre> | règle1 | ...` — Définir les règles tournoi',
          '`!log` — Historique des actions staff',
          '`!cooldowns` — Voir tous les cooldowns actifs',
          '`!setcooldown <cmd> <secondes>` — Modifier un cooldown',
          '`!delcooldown <cmd>` — Réinitialiser un cooldown',
          '`!règlement titre/intro/add/edit/del/post ...` — Gérer le règlement',
        ].join('\n')
      },
    ]
  },
];

function buildEmbed(page) {
  const p = PAGES[page];
  const embed = new EmbedBuilder()
    .setTitle(p.title)
    .setColor(0xED4245)
    .setDescription('Toutes les commandes administrateur. Navigue avec les boutons ◀ ▶')
    .setFooter({ text: `SUPREMYX Staff • Page ${page + 1} sur ${PAGES.length}` })
    .setTimestamp();

  for (const field of p.fields) {
    embed.addFields({ name: field.name, value: field.value });
  }
  return embed;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!helpadmin') return;
    if (!message.guild) return;
    if (!message.member?.permissions.has('Administrator'))
      return message.reply('⛔ La commande `!helpadmin` est réservée aux administrateurs.');

    let page = 0;

    const prev = new ButtonBuilder()
      .setCustomId('helpadmin_prev')
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const next = new ButtonBuilder()
      .setCustomId('helpadmin_next')
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(PAGES.length <= 1);

    const row = new ActionRowBuilder().addComponents(prev, next);

    const reply = await message.channel.send({
      embeds: [buildEmbed(page)],
      components: [row]
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000,
      filter: i => i.user.id === message.author.id
    });

    collector.on('collect', async interaction => {
      if (interaction.customId === 'helpadmin_next') page++;
      if (interaction.customId === 'helpadmin_prev') page--;

      prev.setDisabled(page === 0);
      next.setDisabled(page === PAGES.length - 1);

      await interaction.update({
        embeds: [buildEmbed(page)],
        components: [new ActionRowBuilder().addComponents(prev, next)]
      });
    });

    collector.on('end', async () => {
      prev.setDisabled(true);
      next.setDisabled(true);
      await reply.edit({ components: [new ActionRowBuilder().addComponents(prev, next)] }).catch(() => {});
    });
  });
};
