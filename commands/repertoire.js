const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const COLOR = 0xFF8C00;

const PAGES = [
  {
    title: '📋 Répertoire des commandes — Vue d\'ensemble',
    description: [
      'Utilise les boutons ◀ ▶ pour naviguer entre les catégories.',
      '> 💡 `< >` = paramètre **obligatoire** · `[ ]` = paramètre **optionnel**',
      '',
      '**Catégories disponibles :**',
      '`1` 🏆 Stats & Classement',
      '`2` 🎯 Tournois & Saisons',
      '`3` 📅 Matchs & Calendrier',
      '`4` 👥 Équipes & Rosters',
      '`5` 🤖 Intelligence Artificielle',
      '`6` 🛡️ Modération',
      '`7` 🎉 Communauté',
      '`8` 📢 Annonces & Communication',
      '`9` 📈 Niveaux & XP',
      '`10` ⚙️ Configuration (Admin)',
      '`11` 🔧 Dev & Système',
    ].join('\n'),
    fields: [],
  },
  {
    title: '🏆 Stats & Classement',
    description: null,
    fields: [
      {
        name: 'Commandes',
        value: [
          '`!classement` / `!ranking` — Classement général des équipes par points',
          '`!stats <équipe>` — Stats détaillées (points, kills, winrate)',
          '`!infoequipe <équipe>` — Fiche complète + roster + 5 derniers matchs',
          '`!recherche <nom>` — Recherche une équipe par nom partiel',
          '`!historique <équipe>` — Historique complet des matchs',
          '`!compare <eq1> vs <eq2>` — Comparaison directe entre deux équipes',
          '`!top [N]` — Top N équipes du classement',
          '`!mvp` — MVP du tournoi en cours (meilleur ratio kills)',
          '`!mvpsaison` — MVP de la saison',
          '`!serie <équipe>` — Série actuelle de victoires/défaites',
          '`!regularite <équipe>` — Analyse de stabilité des perfs',
          '`!faceatface <eq1> vs <eq2>` — Stats face à face',
          '`!calculer <place> <kills>` — Simulation de gain de points',
          '`!statsjoueur <nom>` — Stats individuelles d\'un joueur',
        ].join('\n'),
      },
    ],
  },
  {
    title: '🎯 Tournois & Saisons',
    description: null,
    fields: [
      {
        name: 'Consultation',
        value: [
          '`!tournois` — Liste tous les tournois (en cours + terminés)',
          '`!detailtournoi <nom>` — Détails et classement d\'un tournoi',
          '`!bracket` — Bracket du tournoi actif',
          '`!vainqueurs` — Palmarès historique tournois/saisons',
          '`!inscrire <équipe>` — Inscrire une équipe à un tournoi ouvert',
          '`!inscription` — Voir les équipes inscrites',
        ].join('\n'),
      },
      {
        name: 'Gestion (Admin)',
        value: [
          '`!nouveautournoi <nom>` — Démarre un nouveau tournoi',
          '`!fintournoi [gagnant]` — Clôture le tournoi actif',
          '`!supprimertournoi <nom>` — Supprime un tournoi',
          '`!nouvellesaison <nom>` — Lance une nouvelle saison',
          '`!finersaison` — Clôture la saison et archive le classement',
        ].join('\n'),
      },
    ],
  },
  {
    title: '📅 Matchs & Calendrier',
    description: null,
    fields: [
      {
        name: 'Consultation',
        value: [
          '`!matchs [tournoi]` — Liste les derniers matchs enregistrés',
          '`!calendrier` — Prochains matchs planifiés',
          '`!prochainmatch` — Le match le plus proche dans le temps',
        ].join('\n'),
      },
      {
        name: 'Gestion (Admin)',
        value: [
          '`!ajoutermatch <équipe>:<place>:<kills>` — Enregistre un résultat',
          '`!resultats <eq:place:k> [...]` — Résultats de plusieurs équipes en une fois',
          '`!resultats salon #salon` — Définit le salon de publication des résultats',
          '`!annulermatch <id>` — Supprime un match et retire les points',
          '`!reinitialiser` — Remet à zéro tous les scores',
          '`!calendrier add <date> <heure> <équipes>` — Planifie un match',
          '`!calendrier channel #salon` — Salon des rappels automatiques',
          '`!planifier` — Planification avancée d\'événements',
          '`!backup` — Sauvegarde la base de données',
          '`!restaurer` — Restaure une sauvegarde',
          '`!export` — Exporte les données en JSON/CSV',
        ].join('\n'),
      },
    ],
  },
  {
    title: '👥 Équipes & Rosters',
    description: null,
    fields: [
      {
        name: 'Consultation',
        value: [
          '`!composition <équipe>` — Joueurs (lineup) d\'une équipe',
          '`!liste <équipe>` — Roster détaillé d\'une équipe',
        ].join('\n'),
      },
      {
        name: 'Gestion (Admin)',
        value: [
          '`!enregistrer <équipe>` — Crée une nouvelle équipe',
          '`!desenregistrer <équipe>` — Supprime une équipe et son historique',
          '`!renommer <ancien> | <nouveau>` — Renomme une équipe',
          '`!fusionner <eq1> | <eq2>` — Fusionne deux équipes',
          '`!composition <équipe> <joueurs>` — Définit les joueurs',
          '`!liste add <équipe> @user <rôle>` — Ajoute un membre au roster',
          '`!liste role / !liste note` — Modifie les détails d\'un membre',
          '`!liste clear <équipe>` — Vide le roster d\'une équipe',
        ].join('\n'),
      },
    ],
  },
  {
    title: '🤖 Intelligence Artificielle (`!ia`)',
    description: null,
    fields: [
      {
        name: 'Conversation & Modèles',
        value: [
          '`!ia <question>` — Pose une question à l\'IA',
          '`!ia modeles` — Liste les modèles IA disponibles',
          '`!ia modele <alias>` — Change le modèle IA (Admin)',
          '`!ia reinitialiser` — Efface ton historique de conversation',
          '`!ia statistiques` — Stats d\'utilisation de l\'IA sur le serveur',
        ].join('\n'),
      },
      {
        name: 'Analyse & Coaching',
        value: [
          '`!ia analyser <équipe>` — Analyse IA des stats d\'une équipe',
          '`!ia predire <eq1> vs <eq2>` — Prédiction IA d\'un match',
          '`!ia conseil <équipe>` — Conseils de coaching personnalisés',
          '`!ia resume` — Résumé narratif du tournoi en cours',
          '`!ia rapport <joueur>` — Rapport de performance détaillé d\'un joueur',
          '`!ia historique <joueur>` — Historique de matchs paginé d\'un joueur',
        ].join('\n'),
      },
    ],
  },
  {
    title: '🛡️ Modération',
    description: null,
    fields: [
      {
        name: 'Sanctions',
        value: [
          '`!warn @user <raison>` — Avertissement',
          '`!punition @user <type> | <raison>` — Sanction (warn/mute/kick/ban)',
          '`!sanctions [@user]` — Historique disciplinaire d\'un membre',
          '`!escalade` — Configure les sanctions automatiques',
        ].join('\n'),
      },
      {
        name: 'Outils',
        value: [
          '`!moderation` — Commandes de modération (mute, kick, ban...)',
          '`!lockdown [#salon]` — Verrouille un salon ou le serveur',
          '`!blacklist` — Gestion de la liste noire',
          '`!automod` — Configure l\'automodération',
          '`!antispam` — Configure l\'anti-spam',
          '`!loghistory` — Historique des logs de modération',
          '`!configticket` — Configure le système de tickets',
          '`!ticket panneau` — Panneau d\'ouverture de tickets',
        ].join('\n'),
      },
    ],
  },
  {
    title: '🎉 Communauté',
    description: null,
    fields: [
      {
        name: 'Événements & Jeux',
        value: [
          '`!giveaway` — Crée un giveaway',
          '`!sondage <durée> <question> | <opt1> | <opt2>` — Sondage temporisé',
          '`!poll <question>` — Sondage rapide 👍/👎',
          '`!eventcmd` — Crée un événement RSVP (rejoindre/décliner)',
          '`!random` — Commandes aléatoires (pièce, dé...)',
        ].join('\n'),
      },
      {
        name: 'Profil & Social',
        value: [
          '`!suggestion <idée>` — Envoie une suggestion au staff',
          '`!signaler <texte>` — Signalement anonyme au staff',
          '`!anniversaire <JJ/MM/AAAA>` — Enregistre ta date d\'anniversaire',
          '`!afk [message]` — Active le mode AFK',
          '`!rappel <durée> <message>` — Rappel personnel en DM',
          '`!note` — Prises de notes partagées',
          '`!achievement` — Système de succès/achievements',
        ].join('\n'),
      },
    ],
  },
  {
    title: '📢 Annonces & Communication',
    description: null,
    fields: [
      {
        name: 'Commandes',
        value: [
          '`!announce <message>` — Envoie une annonce officielle',
          '`!diffuser <message>` — Diffuse un message sur plusieurs salons',
          '`!dire [#salon] <texte>` — Fait parler le bot dans un salon',
          '`!motd` — Message du jour automatique',
          '`!liens` — Affiche les liens importants du serveur',
          '`!embedbuilder` — Constructeur d\'embeds personnalisés',
          '`!reglement` — Affiche le règlement du serveur',
          '`!reglement section ajouter <emoji> <titre>` — Ajoute une section',
          '`!reglement ajouter <section> <texte>` — Ajoute une règle',
          '`!reglement publier [#salon]` — Publie et épingle le règlement',
        ].join('\n'),
      },
    ],
  },
  {
    title: '📈 Niveaux & XP',
    description: null,
    fields: [
      {
        name: 'Membres',
        value: [
          '`!niveau [@user]` — Affiche le niveau XP et la progression',
          '`!rank [@user]` — Carte de rang du membre',
        ].join('\n'),
      },
      {
        name: 'Administration',
        value: [
          '`!xpmanage add @user <montant>` — Ajoute de l\'XP à un membre',
          '`!xpmanage remove @user <montant>` — Retire de l\'XP',
          '`!xpmanage set @user <montant>` — Définit l\'XP d\'un membre',
          '`!xpmanage reset @user` — Remet l\'XP à zéro',
          '`!rankroles` — Configure les rôles automatiques selon le rang',
        ].join('\n'),
      },
    ],
  },
  {
    title: '⚙️ Configuration (Admin)',
    description: null,
    fields: [
      {
        name: 'Paramètres',
        value: [
          '`!configbot` — Configuration générale du bot',
          '`!voirconfig` — Affiche la configuration actuelle',
          '`!welcome` — Configure le message de bienvenue',
          '`!autorole` — Rôle donné automatiquement à l\'arrivée',
          '`!rolereaction` — Rôles par réactions',
          '`!cooldowncmd` — Gère les cooldowns par commande',
          '`!dashboard` — Configure le dashboard automatique Discord',
          '`!maintenance` — Active/désactive le mode maintenance',
          '`!salonannonce` / `!salonjournaux` — Configure les salons système',
        ].join('\n'),
      },
    ],
  },
  {
    title: '🔧 Dev & Système',
    description: null,
    fields: [
      {
        name: 'Commandes',
        value: [
          '`!ping` — Latence du bot et de l\'API Discord',
          '`!status` — État du bot et des services',
          '`!botstats` — Statistiques d\'utilisation des commandes',
          '`!commandes` — Stats détaillées d\'utilisation par commande',
          '`!repertoire` — Ce répertoire de toutes les commandes',
          '`!changelog` — Changelog du bot SUPREMYX',
          '`!gitpush` — Pousse les changements sur GitHub',
          '`!gitstatus` — Statut du dépôt Git',
          '`!aide` — Menu d\'aide simplifié pour la communauté',
          '`!aidestaff` — Aide réservée au staff',
          '`!userinfo [@user]` — Infos sur un membre',
          '`!serverinfo` — Infos sur le serveur',
          '`!inforole @role` — Informations sur un rôle',
        ].join('\n'),
      },
    ],
  },
];

function buildEmbed(page) {
  const data = PAGES[page];
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: `SUPREMYX · Répertoire des commandes (${page + 1}/${PAGES.length})` })
    .setTitle(data.title)
    .setFooter({ text: `Page ${page + 1} sur ${PAGES.length} · Boutons actifs 2 minutes` })
    .setTimestamp();

  if (data.description) embed.setDescription(data.description);
  if (data.fields.length) embed.addFields(data.fields);

  return embed;
}

function buildRow(page, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rep_prev')
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId('rep_page')
      .setLabel(`${page + 1} / ${PAGES.length}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('rep_next')
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === PAGES.length - 1),
  );
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.content.trim().toLowerCase() !== '!repertoire') return;

    const cd = checkCooldown(message.author.id, 'repertoire', 10);
    if (cd) return replyCooldown(message, cd, 'repertoire');

    let page = 0;

    const reply = await message.channel.send({
      embeds: [buildEmbed(page)],
      components: [buildRow(page)],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
      filter: i => {
        if (i.user.id !== message.author.id) {
          i.reply({ content: '⚠️ Seul l\'auteur de la commande peut naviguer.', ephemeral: true });
          return false;
        }
        return true;
      },
    });

    collector.on('collect', async interaction => {
      if (interaction.customId === 'rep_next' && page < PAGES.length - 1) page++;
      if (interaction.customId === 'rep_prev' && page > 0) page--;

      await interaction.update({
        embeds: [buildEmbed(page)],
        components: [buildRow(page)],
      });
    });

    collector.on('end', async () => {
      await reply.edit({ components: [buildRow(page, true)] }).catch(() => {});
    });
  });
};
