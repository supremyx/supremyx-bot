const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const PAGES = [
  {
    title: '🛡️ Staff — Page 1 / 3 — Équipes, Matchs & Tournois',
    fields: [
      {
        name: '🤖 Bot',
        value: [
          '`!gitpush` — Pousser les derniers commits vers GitHub',
          '`!changelog [n]` — Voir les N derniers commits du bot',
          '`!status` — Tableau de bord (stats, uptime, ping)',
          '`!log` — Historique des actions staff',
        ].join('\n')
      },
      {
        name: '👥 Équipes',
        value: [
          '`!register <nom>` — Inscrire une équipe',
          '`!unregister <nom>` — Supprimer une équipe',
          '`!rename <ancien> | <nouveau>` — Renommer',
          '`!merge <équipe1> | <équipe2>` — Fusionner',
          '`!lineup <équipe> <j1,j2,...>` — Définir la composition',
          '`!roster add/del/role/note/clear <équipe>` — Gérer le roster',
        ].join('\n')
      },
      {
        name: '🎮 Matchs & Exports',
        value: [
          '`!addmatch <nom> <placement> <kills>` — Ajouter un résultat',
          '`!resetmatch` — Remettre tous les scores à zéro',
          '`!export` — Classement en CSV',
          '`!export matchs` — Historique des matchs en CSV',
          '`!backup` — Sauvegarde complète JSON (DM)',
          '`!restore` — Restaurer depuis un fichier JSON',
        ].join('\n')
      },
      {
        name: '🏁 Tournois & Saisons',
        value: [
          '`!newtournoi <nom>` — Lancer un tournoi',
          '`!endtournoi` — Clôturer le tournoi en cours',
          '`!deletetournoi <nom>` — Supprimer un tournoi',
          '`!newseason <nom>` — Lancer une saison',
          '`!endseason` — Clore la saison',
        ].join('\n')
      },
      {
        name: '📅 Calendrier & Config',
        value: [
          '`!schedule add <DD/MM/YYYY> <HH:MM> <eq1,eq2,...> [note]` — Planifier un match',
          '`!schedule delete <id>` — Supprimer un match planifié',
          '`!schedule clear` — Supprimer les matchs passés',
          '`!setpointssystem <p:pts> ... [kill:<pts>]` — Modifier le barème',
        ].join('\n')
      },
      {
        name: '🎖️ Rôles & Reaction Roles',
        value: [
          '`!setrankreward <rang> @role [label]` — Associer un rôle à un rang',
          '`!linkteam <équipe> @role` — Lier une équipe à son rôle',
          '`!syncranks` — Synchroniser les rôles manuellement',
          '`!delrankreward <rang>` — Supprimer une récompense',
          '`!reactionrole add <msgId> <emoji> @role [label]` — Configurer',
          '`!reactionrole remove <msgId> <emoji>` — Supprimer',
          '`!reactionrole clear <msgId>` — Tout supprimer sur un message',
        ].join('\n')
      },
    ]
  },
  {
    title: '🛡️ Staff — Page 2 / 3 — Modération & Sanctions',
    fields: [
      {
        name: '🛡️ Modération',
        value: [
          '`!warn @user <raison>` — Avertir un membre',
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
          '`!punition @user <warn|mute|kick|ban> [durée_min] | <raison>` — Sanctionner',
          '`!clearactions @user` — Effacer tout l\'historique de sanctions',
          '`!escalade on / off` — Activer / désactiver l\'auto-escalade',
          '`!escalade set <warns> <action> [durée_min]` — Configurer une règle',
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
          '`!word add <mot>` — Ajouter un mot interdit',
          '`!word del <mot>` — Retirer un mot',
          '`!word clear` — Vider la liste',
          '`!word setup` — Réinitialiser avec la liste par défaut',
        ].join('\n')
      },
      {
        name: '🚫 Blacklist & Logs',
        value: [
          '`!blacklist add <cible> | <raison>` — Blacklister',
          '`!blacklist remove <cible>` — Retirer de la blacklist',
          '`!log [page/category/today/stats]` — Historique des actions staff',
          '`!log clear` — Effacer l\'historique',
          '`!cooldowns` — Voir les cooldowns configurés',
          '`!setcooldown <commande> <secondes>` — Modifier un cooldown',
          '`!delcooldown <commande>` — Réinitialiser au défaut',
        ].join('\n')
      },
    ]
  },
  {
    title: '🛡️ Staff — Page 3 / 3 — Communauté & Serveur',
    fields: [
      {
        name: '🎫 Tickets',
        value: [
          '`!ticket panel` — Poster le panel de création',
          '`!tickets` — Voir tous les tickets ouverts',
          '`!claim` — Prendre en charge le ticket *(dans le salon ticket)*',
          '`!resolve` — Marquer comme résolu *(dans le salon ticket)*',
          '`!adduser @user` — Ajouter un membre au ticket *(dans le salon ticket)*',
          '`!ticketconfig staffrole @role` — Rôle staff',
          '`!ticketconfig transcript #salon` — Salon des transcripts',
          '`!ticketconfig category <id>` — Catégorie Discord',
        ].join('\n')
      },
      {
        name: '📢 Annonces & Communauté',
        value: [
          '`!announce <message>` — Annonce en embed',
          '`!setmotd <texte>` — Définir le message du jour',
          '`!embed <titre> | <desc> | [couleur] | [image] | [footer]` — Embed custom',
          '`!sondage <durée> <question> | <opt1> | <opt2>` — Sondage temporisé',
          '`!poll <question> | <opt1> | <opt2>` — Sondage simple',
          '`!giveaway <durée> <prix>` — Lancer un giveaway',
          '`!reroll <messageId>` — Reroll d\'un giveaway',
          '`!event create <titre> | [desc] | [date]` — Créer un événement RSVP',
          '`!event cancel <id>` — Annuler un événement',
        ].join('\n')
      },
      {
        name: '👋 Serveur & Membres',
        value: [
          '`!welcome set/channel/test/on/off` — Configuration bienvenue',
          '`!autorole set @role` — Rôle automatique',
          '`!autorole on / off` — Activer / désactiver',
          '`!setbirthday #salon` — Salon des anniversaires',
          '`!setsuggestion #salon` — Salon des suggestions',
          '`!sugaccept <id> [note]` — Accepter une suggestion',
          '`!sugreject <id> [note]` — Refuser une suggestion',
          '`!setlevelchannel #salon` — Salon des annonces de niveau',
        ].join('\n')
      },
      {
        name: '📝 Notes, Trophées & Règlement',
        value: [
          '`!note <cible> <texte>` — Ajouter une note privée',
          '`!notes <cible>` — Voir les notes sur une cible',
          '`!delnote <id>` — Supprimer une note',
          '`!achievement [emoji] <équipe> <titre> | [desc]` — Attribuer un trophée',
          '`!setrules <titre> | <règle1> | <règle2>` — Définir les règles',
          '`!addrule <règle>` — Ajouter une règle',
          '`!delrule <numéro>` — Supprimer une règle',
          '`!règlement post/update/section/add/edit/del` — Gérer le règlement',
          '`!dashboard channel/auto/hour` — Configurer le dashboard',
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
    .setDescription('Toutes les commandes réservées aux administrateurs. Navigue avec les boutons ◀ ▶')
    .setFooter({ text: `MoSeTo Staff • Page ${page + 1} sur ${PAGES.length}` })
    .setTimestamp();

  for (const field of p.fields) {
    embed.addFields({ name: field.name, value: field.value });
  }
  return embed;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!helpstaff') return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Cette commande est réservée au staff.');

    let page = 0;

    const prev = new ButtonBuilder()
      .setCustomId('helpstaff_prev')
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true);

    const next = new ButtonBuilder()
      .setCustomId('helpstaff_next')
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Danger)
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
      if (interaction.customId === 'helpstaff_next') page++;
      if (interaction.customId === 'helpstaff_prev') page--;

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
