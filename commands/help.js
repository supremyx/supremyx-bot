const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const PAGES = [
  {
    title: '📖 Aide SUPREMYX — Page 1 / 6 — Bot & Annonces',
    fields: [
      {
        name: '🤖 Bot',
        value: [
          '`!ping` — Latence du bot',
          '`!status` — Tableau de bord (stats, uptime, ping)',
          '`!config` — Configuration du bot',
          '`!setpointssystem <p:pts> ... [kill:<pts>]` — Modifier le barème *(staff)*',
          '`!help` — Cette aide (toutes les commandes)',
          '`!helpstaff` — Aide rapide staff uniquement *(staff)*',
          '`!gitpush` — Pousser les derniers commits vers GitHub *(staff)*',
          '`!changelog [n]` — Voir les N derniers commits du bot *(staff)*',
          '`!botstats` — Statistiques d\'utilisation du bot *(staff)*',
          '`!dashboard web` — Lien vers le dashboard classement en ligne',
          '`!ai <text>` — Utilisation de l’intelligence artificielle',
        ].join('\n')
      },
      {
        name: '📢 Annonces & Embeds',
        value: [
          '`!announce <message>` — Annonce en embed *(staff)*',
          '`!say [#salon] <texte>` — Envoyer du texte simple (+ médias joints) *(staff)*',
          '`!embed <titre> | <desc> | [couleur] | [image] | [footer]` — Embed personnalisé *(staff)*',
          '`!motd` — Message du jour',
          '`!setmotd <texte>` — Définir le message du jour *(staff)*',
        ].join('\n')
      },
      {
        name: '👋 Bienvenue & Autorole',
        value: [
          '`!welcome` — Voir la configuration *(staff)*',
          '`!welcome set <message>` — Définir le message (`{user}` `{server}` `{count}`) *(staff)*',
          '`!welcome channel #salon` — Choisir le salon *(staff)*',
          '`!welcome test` — Tester le message *(staff)*',
          '`!welcome on / off` — Activer / désactiver *(staff)*',
          '`!autorole set @role` — Rôle automatique aux nouveaux membres *(staff)*',
          '`!autorole on / off` — Activer / désactiver *(staff)*',
        ].join('\n')
      },
      {
        name: '📊 Dashboard',
        value: [
          '`!dashboard` — Générer le tableau de bord maintenant',
          '`!dashboard channel #salon` — Configurer le salon *(staff)*',
          '`!dashboard auto on / off` — Publication quotidienne *(staff)*',
          '`!dashboard hour <0-23>` — Heure de publication UTC *(staff)*',
          '`!dashboard status` — Voir la configuration *(staff)*',
        ].join('\n')
      },
    ]
  },
  {
    title: '📖 Aide SUPREMYX — Page 2 / 6 — Équipes & Matchs',
    fields: [
      {
        name: '👥 Équipes',
        value: [
          '`!register <nom>` — Inscrire une équipe *(staff)*',
          '`!unregister <nom>` — Supprimer une équipe *(staff)*',
          '`!rename <ancien> | <nouveau>` — Renommer *(staff)*',
          '`!merge <équipe1> | <équipe2>` — Fusionner *(staff)*',
          '`!lineup <équipe> <j1,j2,...>` — Définir la composition *(staff)*',
          '`!lineup <équipe>` — Voir la composition',
        ].join('\n')
      },
      {
        name: '👥 Roster équipes',
        value: [
          '`!roster <équipe>` — Afficher le roster',
          '`!roster list` — Tous les rosters',
          '`!roster add <équipe> @user <rôle> [note]` — Ajouter *(staff)*',
          '`!roster del <équipe> @user` — Retirer *(staff)*',
          '`!roster role <équipe> @user <rôle>` — Changer le rôle *(staff)*',
          '`!roster note <équipe> @user <note>` — Ajouter une note *(staff)*',
          '`!roster clear <équipe>` — Vider le roster *(staff)*',
          '*Rôles : IGL, Fragger, Support, Sniper, Entry, Flex, Coach, Remplaçant*',
        ].join('\n')
      },
      {
        name: '🎮 Matchs',
        value: [
          '`!addmatch <nom> <placement> <kills>` — Ajouter un résultat *(staff)*',
          '`!result <eq:place:kills> [eq:place:kills ...]` — Résultats multi-équipes en direct *(staff)*',
          '`!result from <scheduleId> <eq:place:kills> [...]` — Résultats liés à un match planifié *(staff)*',
          '`!result channel #salon` — Salon pour les résultats *(staff)*',
          '`!resetmatch` — Remettre tous les scores à zéro *(staff)*',
          '`!export` — Exporter le classement en CSV *(staff)*',
          '`!export matchs` — Exporter l\'historique des matchs *(staff)*',
          '`!backup` — Sauvegarde complète en JSON (DM) *(staff)*',
          '`!restore` — Restaurer depuis un fichier JSON *(staff)*',
        ].join('\n')
      },
    ]
  },
  {
    title: '📖 Aide SUPREMYX — Page 3 / 6 — Statistiques & Tournois',
    fields: [
      {
        name: '📊 Statistiques',
        value: [
          '`!ranking` — Classement général',
          '`!ranking <tournoi>` — Classement d\'un tournoi',
          '`!top <n>` — Top N des équipes',
          '`!leaderboard` — Classement en direct',
          '`!search <nom>` — Rechercher une équipe',
          '`!compare <eq1> vs <eq2>` — Comparer deux équipes (stats en direct)',
          '`!compare season <eq1> vs <eq2>` — Comparaison sur l\'historique des saisons',
          '`!h2h <eq1> vs <eq2>` — Face à face statistique (matchs)',
          '`!stats <nom>` — Statistiques détaillées',
          '`!teaminfo <nom>` — Fiche complète (stats + roster + tournois)',
          '`!history <nom>` — Historique des matchs',
          '`!matchs` — Dernier match de chaque équipe',
          '`!mvp` — MVP du tournoi actif',
          '`!streak <équipe>` — Série de victoires/défaites',
          '`!consistency <équipe>` — Score de régularité',
          '`!calc <placement> <kills>` — Simuler un calcul de points',
          '`!playerstats <pseudo>` — Stats individuelles d\'un joueur',
          '`!playerboard [équipe]` — Top joueurs par kills',
          '`!playermatch <équipe> <joueur> <kills>` — Enregistrer kills d\'un joueur *(staff)*',
          '`!playerreset <équipe> <joueur>` — Remettre stats d\'un joueur à zéro *(staff)*',
        ].join('\n')
      },
      {
        name: '🏁 Tournois',
        value: [
          '`!newtournoi <nom>` — Lancer un tournoi *(staff)*',
          '`!endtournoi` — Clôturer le tournoi en cours *(staff)*',
          '`!tournoi <nom>` — Détails et classement d\'un tournoi spécifique',
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
          '`!mvpseason` — MVP all-time sur toutes les saisons terminées',
        ].join('\n')
      },
      {
        name: '📅 Calendrier',
        value: [
          '`!schedule` — Afficher les matchs à venir',
          '`!schedule add <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note]` — Planifier *(staff)*',
          '`!schedule edit <id> <DD/MM/YYYY> <HH:MM> [équipes] [note]` — Modifier *(staff)*',
          '`!schedule delete <id>` — Supprimer *(staff)*',
          '`!schedule clear` — Supprimer les matchs passés *(staff)*',
          '`!schedule channel #salon` — Salon pour les rappels *(staff)*',
          '`!schedule remind <on|off> [24h|1h|15m]` — Gérer les rappels *(staff)*',
          '`!schedule status` — Voir la configuration *(staff)*',
        ].join('\n')
      },
    ]
  },
  {
    title: '📖 Aide SUPREMYX — Page 4 / 6 — Modération & Sanctions',
    fields: [
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
        name: '📋 Sanctions & Escalade',
        value: [
          '`!sanctions @user` — Historique des sanctions',
          '`!punition @user <warn|mute|kick|ban> [durée_min] | <raison>` — Sanctionner *(staff)*',
          '`!clearactions @user` — Effacer l\'historique de sanctions *(staff)*',
          '`!escalade` — Voir les règles d\'escalade *(staff)*',
          '`!escalade on / off` — Activer / désactiver *(staff)*',
          '`!escalade set <warns> <action> [durée_min]` — Configurer *(staff)*',
          '`!escalade del <warns>` — Supprimer une règle *(staff)*',
          '`!escalade reset` — Réinitialiser aux valeurs par défaut *(staff)*',
        ].join('\n')
      },
      {
        name: '⏱️ Anti-spam & Automod',
        value: [
          '`!antispam on / off` — Activer / désactiver *(staff)*',
          '`!antispam set <messages> <secondes>` — Régler le seuil *(staff)*',
          '`!automod on / off` — Détection de mots interdits *(staff)*',
          '`!words` — Voir la liste des mots interdits *(staff)*',
          '`!word add <mot>` / `!word del <mot>` / `!word clear` *(staff)*',
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
    ]
  },
  {
    title: '📖 Aide SUPREMYX — Page 5 / 6 — Tickets & Communauté',
    fields: [
      {
        name: '🎫 Tickets',
        value: [
          '`!ticket` — Ouvrir un ticket support',
          '`!ticket support / signalement / candidature` — Ouvrir avec catégorie',
          '`!ticket panel` — Poster le panel de création *(staff)*',
          '`!tickets` — Voir tous les tickets ouverts *(staff)*',
          '`!claim` — Prendre en charge le ticket *(staff)*',
          '`!resolve` — Marquer comme résolu *(staff)*',
          '`!adduser @user` — Ajouter un membre au ticket *(staff)*',
          '`!close` — Fermer et archiver le ticket',
          '`!ticketconfig staffrole / transcript / category` — Configurer *(staff)*',
        ].join('\n')
      },
      {
        name: '📊 Sondages',
        value: [
          '`!sondage <durée> <question> | <opt1> | <opt2> | ...` — Sondage temporisé *(staff)*',
          '`!poll <question> | <opt1> | <opt2> | ...` — Sondage simple *(staff)*',
        ].join('\n')
      },
      {
        name: '🗳️ Suggestions',
        value: [
          '`!suggestion <texte>` — Soumettre une idée au staff',
          '`!setsuggestion #salon` — Configurer le salon *(staff)*',
          '`!sugaccept <id> [note]` — Accepter *(staff)*',
          '`!sugreject <id> [note]` — Refuser *(staff)*',
        ].join('\n')
      },
      {
        name: '📅 Événements RSVP',
        value: [
          '`!event create <titre> | [desc] | [date]` — Créer *(staff)*',
          '`!event list` — Voir les événements actifs',
          '`!event participants <id>` — Voir les inscrits',
          '`!event cancel <id>` — Annuler *(staff)*',
        ].join('\n')
      },
      {
        name: '🎉 Giveaways',
        value: [
          '`!giveaway <durée> <prix>` — Lancer un giveaway *(staff)*',
          '`!reroll <messageId>` — Reroll d\'un giveaway *(staff)*',
        ].join('\n')
      },
    ]
  },
  {
    title: '📖 Aide SUPREMYX — Page 6 / 6 — Infos & Divers',
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
          '`!setlevelchannel #salon` — Salon pour les level-up *(staff)*',
        ].join('\n')
      },
      {
        name: '🎂 Anniversaires',
        value: [
          '`!birthday set DD/MM` — Enregistrer son anniversaire',
          '`!birthday list` — Voir tous les anniversaires',
          '`!birthday check [@user]` — Vérifier',
          '`!birthday del` — Supprimer son anniversaire',
          '`!setbirthday #salon` — Salon pour les annonces *(staff)*',
        ].join('\n')
      },
      {
        name: '💤 AFK & Divers',
        value: [
          '`!afk [message]` — Passer en mode AFK (se retire automatiquement)',
          '`!coinflip` — Pile ou face',
          '`!randteam` — Tirage au sort des équipes enregistrées',
          '`!randteam TeamA,TeamB,...` — Tirage au sort personnalisé',
          '`!remind <durée> <message>` — Rappel personnel par DM',
          '`!report <message>` — Signaler un problème au staff',
        ].join('\n')
      },
      {
        name: '🎖️ Rôles de rang & Reaction Roles',
        value: [
          '`!setrankreward <rang> @role [label]` — Associer un rôle à un rang *(staff)*',
          '`!linkteam <équipe> @role` — Lier une équipe à son rôle *(staff)*',
          '`!rankrewards` — Voir la configuration',
          '`!syncranks` — Synchroniser manuellement *(staff)*',
          '`!reactionrole add <msgId> <emoji> @role` — Configurer *(staff)*',
          '`!reactionrole list` — Voir tous les reaction-roles *(staff)*',
        ].join('\n')
      },
      {
        name: '📝 Notes & Trophées',
        value: [
          '`!note <cible> <texte>` — Note privée *(staff)*',
          '`!notes <cible>` — Voir les notes *(staff)*',
          '`!achievement [emoji] <équipe> <titre>` — Attribuer un trophée *(staff)*',
          '`!achievements <équipe>` — Voir les trophées',
        ].join('\n')
      },
      {
        name: '📋 Règlement serveur',
        value: [
          '`!règlement` — Afficher le règlement serveur',
          '`!règlement add <section> <règle>` — Ajouter une règle *(staff)*',
          '`!règlement edit <section> <num> <texte>` — Modifier une règle *(staff)*',
          '`!règlement del <section> <num>` — Supprimer une règle *(staff)*',
          '`!règlement section add/del/rename` — Gérer les sections *(staff)*',
          '`!règlement post [#salon]` — Poster et épingler *(staff)*',
        ].join('\n')
      },
      {
        name: '🔧 Règles tournoi & Logs',
        value: [
          '`!rules` — Règles du tournoi',
          '`!setrules <titre> | règle1 | ...` — Définir les règles tournoi *(staff)*',
          '`!addrule <règle>` — Ajouter une règle tournoi *(staff)*',
          '`!editrule <num> <texte>` — Modifier une règle tournoi *(staff)*',
          '`!moverule <de> <vers>` — Réordonner une règle *(staff)*',
          '`!delrule <num>` — Supprimer une règle tournoi *(staff)*',
          '`!clearrules` — Effacer toutes les règles tournoi *(staff)*',
          '`!log` — Historique des actions staff (paginé)',
          '`!cooldowns` — Voir / modifier les cooldowns *(staff)*',
        ].join('\n')
      },
    ]
  },
];

function buildEmbed(page) {
  const p = PAGES[page];
  const embed = new EmbedBuilder()
    .setTitle(p.title)
    .setColor(0x5865F2)
    .setDescription('*(staff)* = réservé aux administrateurs. Navigue avec les boutons ◀ ▶')
    .setFooter({ text: `SUPREMYX • Page ${page + 1} sur ${PAGES.length}` })
    .setTimestamp();

  for (const field of p.fields) {
    embed.addFields({ name: field.name, value: field.value });
  }
  return embed;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!help') return;

    if (!message.member?.permissions.has('Administrator'))
      return message.reply('⛔ Cette commande est réservée au staff.');

    let page = 0;

    const prev = new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const next = new ButtonBuilder()
      .setCustomId('help_next')
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
      if (interaction.customId === 'help_next') page++;
      if (interaction.customId === 'help_prev') page--;

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
