const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const PAGES = [
  {
    title: '📖 Aide SUPREMYX — Page 1 / 3 — Stats & Classements',
    fields: [
      {
        name: '🤖 Bot',
        value: [
          '`!ping` — Latence du bot',
          '`!status` — Tableau de bord (stats, uptime, ping)',
          '`!help` — Cette aide',
          '`!dashboard web` — Lien vers le dashboard classement en ligne',
          '`!ai <texte>` — Poser une question à l\'intelligence artificielle',
          '`!motd` — Message du jour',
        ].join('\n')
      },
      {
        name: '📊 Classements & Équipes',
        value: [
          '`!ranking` — Classement général des équipes',
          '`!ranking <tournoi>` — Classement d\'un tournoi spécifique',
          '`!top <n>` — Top N des équipes',
          '`!search <nom>` — Rechercher une équipe',
          '`!compare <eq1> vs <eq2>` — Comparer deux équipes',
          '`!stats <nom>` — Statistiques détaillées d\'une équipe',
          '`!teaminfo <nom>` — Fiche complète (stats + roster + tournois)',
          '`!history <nom>` — Historique des matchs d\'une équipe',
          '`!matchs` — Dernier match de chaque équipe',
        ].join('\n')
      },
      {
        name: '🎮 Joueurs',
        value: [
          '`!mvp` — MVP du tournoi actif',
          '`!playerstats <pseudo>` — Stats individuelles d\'un joueur',
          '`!playerboard [équipe]` — Top joueurs par kills',
        ].join('\n')
      },
      {
        name: '👥 Rosters',
        value: [
          '`!roster <équipe>` — Afficher le roster d\'une équipe',
          '`!roster list` — Voir tous les rosters',
        ].join('\n')
      },
    ]
  },
  {
    title: '📖 Aide SUPREMYX — Page 2 / 3 — Tournois & Calendrier',
    fields: [
      {
        name: '🏁 Tournois',
        value: [
          '`!tournoi <nom>` — Détails et classement d\'un tournoi',
          '`!tournois` — Historique de tous les tournois',
          '`!bracket` — Bracket depuis les équipes enregistrées',
          '`!bracket TeamA,TeamB,...` — Bracket personnalisé',
        ].join('\n')
      },
      {
        name: '🗓️ Saisons',
        value: [
          '`!saisons` — Historique de toutes les saisons',
          '`!mvpseason` — MVP all-time sur toutes les saisons terminées',
        ].join('\n')
      },
      {
        name: '📅 Calendrier',
        value: [
          '`!schedule` — Afficher les matchs à venir',
        ].join('\n')
      },
      {
        name: '🎫 Tickets & Signalements',
        value: [
          '`!ticket` — Ouvrir un ticket support',
          '`!ticket support / signalement / candidature` — Ouvrir avec une catégorie',
          '`!close` — Fermer et archiver ton ticket',
          '`!report <message>` — Signaler un problème au staff',
        ].join('\n')
      },
      {
        name: '🗳️ Suggestions',
        value: [
          '`!suggestion <texte>` — Soumettre une idée au staff',
        ].join('\n')
      },
      {
        name: '📅 Événements RSVP',
        value: [
          '`!event list` — Voir les événements actifs',
          '`!event participants <id>` — Voir les inscrits à un événement',
        ].join('\n')
      },
      {
        name: '🚫 Blacklist',
        value: [
          '`!blacklist list` — Voir la blacklist',
          '`!blacklist check <cible>` — Vérifier si une équipe est blacklistée',
        ].join('\n')
      },
    ]
  },
  {
    title: '📖 Aide SUPREMYX — Page 3 / 3 — Communauté & Divers',
    fields: [
      {
        name: '📈 Niveaux & XP',
        value: [
          '`!level [@user]` — Voir son niveau et ses XP',
          '`!levelboard` — Classement XP Top 10',
        ].join('\n')
      },
      {
        name: '🎂 Anniversaires',
        value: [
          '`!birthday set DD/MM` — Enregistrer son anniversaire',
          '`!birthday list` — Voir tous les anniversaires du serveur',
          '`!birthday check [@user]` — Vérifier un anniversaire',
          '`!birthday del` — Supprimer son anniversaire',
        ].join('\n')
      },
      {
        name: '🔍 Informations serveur',
        value: [
          '`!userinfo [@user]` — Fiche détaillée d\'un membre',
          '`!serverinfo` — Statistiques du serveur',
          '`!roleinfo @role` — Informations sur un rôle',
        ].join('\n')
      },
      {
        name: '🎖️ Trophées & Rangs',
        value: [
          '`!achievements <équipe>` — Voir les trophées d\'une équipe',
          '`!rankrewards` — Voir les rôles de rang configurés',
        ].join('\n')
      },
      {
        name: '📋 Règlement & Règles',
        value: [
          '`!règlement` — Afficher le règlement du serveur (`!reglement` / `!regl` aussi)',
          '`!rules` — Règles du tournoi',
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
    .setDescription('Commandes disponibles pour tous les membres. Navigue avec les boutons ◀ ▶')
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
    if (!message.guild) return;

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
