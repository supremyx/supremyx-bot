const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

// ─── Catalogue par catégorie (staff) ─────────────────────────────────────────
const CATS = [
  {
    value: 'matchs',
    label: 'Matchs & Résultats',
    emoji: '⚽',
    description: 'Enregistrer résultats, exports, sauvegardes',
    cmds: [
      '`!ajoutermatch <équipe> <placement> <kills>` — Enregistrer un résultat de match',
      '`!resultats <eq:place:kills> [...]` — Poster les résultats de plusieurs équipes',
      '`!resultats depuis <ID> <eq:place:kills> [...]` — Lier les résultats à un match planifié',
      '`!reinitialiser` — Remettre tous les scores à zéro',
      '`!resetjoueur <nom>` — Réinitialiser les stats d\'un joueur',
      '`!exporter [format]` — Exporter les données (texte / JSON / CSV)',
      '`!sauvegarde` — Créer une sauvegarde JSON complète',
      '`!restaurer` — Restaurer depuis une sauvegarde',
    ],
  },
  {
    value: 'tournois',
    label: 'Tournois',
    emoji: '🏆',
    description: 'Créer tournois, inscriptions, tableaux, trophées',
    cmds: [
      '`!nouveautournoi <nom>` — Créer un nouveau tournoi',
      '`!finirtournoi` — Terminer le tournoi actif',
      '`!supprimertournoi <nom>` — Supprimer un tournoi',
      '`!inscription [ouvrir|fermer|valider|refuser|liste|réinitialiser]` — Gérer les inscriptions',
      '`!tableau` — Afficher le tableau des phases éliminatoires',
      '`!trophee <icône> <équipe> <titre> | <desc>` — Attribuer un trophée à une équipe',
    ],
  },
  {
    value: 'equipes',
    label: 'Équipes & Rangs',
    emoji: '👥',
    description: 'Enregistrer, renommer, fusionner équipes et rangs',
    cmds: [
      '`!enregistrer <nom>` — Enregistrer une équipe manuellement',
      '`!desenregistrer <nom>` — Supprimer une équipe et son historique',
      '`!renommer <ancien> <nouveau>` — Renommer une équipe',
      '`!fusionner <T1> <T2>` — Fusionner deux équipes en une',
      '`!lierequipe <équipe> @role` — Lier une équipe à un rôle Discord',
      '`!syncrangs` — Synchroniser les rôles selon le classement actuel',
      '`!setrecompense <rang> @role` — Attribuer un rôle selon le rang',
      '`!supprimerrecompense <rang>` — Supprimer une récompense de rang',
    ],
  },
  {
    value: 'saisons',
    label: 'Saisons',
    emoji: '📅',
    description: 'Démarrer, clore une saison, configurer les points',
    cmds: [
      '`!nouvellesaison <nom>` — Démarrer une nouvelle saison',
      '`!finersaison` — Clore la saison actuelle et sauvegarder les stats',
      '`!setpoints <type> [valeurs]` — Configurer le système de points',
    ],
  },
  {
    value: 'moderation',
    label: 'Sanctions & Modération',
    emoji: '🛡️',
    description: 'Punitions, avertissements, suppression de messages',
    cmds: [
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
    ],
  },
  {
    value: 'tickets',
    label: 'Tickets',
    emoji: '🎫',
    description: 'Configurer, gérer et clore les tickets',
    cmds: [
      '`!configticket [rolstaff|transcription|categorie]` — Configurer le système de tickets',
      '`!ticket panneau` — Poster le panneau d\'ouverture de ticket',
      '`!tickets` — Voir tous les tickets ouverts',
      '`!prendre [ID]` — Prendre en charge un ticket',
      '`!resoudre [raison]` — Marquer un ticket comme résolu',
      '`!ajouteruser @user` — Ajouter un membre à un ticket',
      '`!fermer` — Fermer le ticket en cours',
    ],
  },
  {
    value: 'automod',
    label: 'Automod & Filtres',
    emoji: '🚨',
    description: 'Filtre de mots interdits, anti-spam',
    cmds: [
      '`!automod activer / désactiver` — Activer/désactiver le filtre de mots',
      '`!mots` — Voir la liste des mots interdits',
      '`!mot ajouter <mot>` — Ajouter un mot interdit',
      '`!mot retirer <mot>` — Supprimer un mot interdit',
      '`!mot defaut` — Charger la liste de mots par défaut',
      '`!antispam [activer|désactiver|configurer <msg> <sec>]` — Configurer l\'anti-spam',
    ],
  },
  {
    value: 'communication',
    label: 'Communication',
    emoji: '📢',
    description: 'Annonces, embeds, sondages, giveaways, planifier',
    cmds: [
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
    ],
  },
  {
    value: 'suggestions',
    label: 'Suggestions',
    emoji: '💡',
    description: 'Accepter, rejeter et configurer les suggestions',
    cmds: [
      '`!acceptersugg <ID> [commentaire]` — Accepter une suggestion',
      '`!rejetersugg <ID> [raison]` — Rejeter une suggestion',
      '`!configsuggestion [salon|ajouter|retirer]` — Configurer le système de suggestions',
    ],
  },
  {
    value: 'config',
    label: 'Configuration Serveur',
    emoji: '⚙️',
    description: 'Salons, rôles, bienvenue, règlement, calendrier',
    cmds: [
      '`!voirconfig` — Afficher tous les paramètres configurés du serveur',
      '`!config [paramètre]` — Configurer les paramètres généraux du bot',
      '`!salonannonce #salon` — Salon d\'annonces (annonces, rappels, MOTD)',
      '`!salonjournaux #salon` — Salon de journaux staff (modération, automod)',
      '`!rolesauto [activer|désactiver|definir @role]` — Rôle automatique à l\'arrivée d\'un membre',
      '`!rolereaction [ajouter|retirer|liste]` — Gérer les reaction-roles',
      '`!bienvenue [definir|salon|tester|activer|désactiver]` — Messages de bienvenue',
      '`!setanniversaire #salon` — Configurer le salon des anniversaires',
      '`!setchannelniveau #salon` — Configurer le salon des montées de niveau',
      '`!règlement [ajouter|modifier|supprimer|publier|actualiser]` — Règlement interactif',
      '`!setregles` / `!ajouterregle` / `!modifierregle` / `!deplacerregle` / `!supprimerregle` / `!effacerregles`',
      '`!event [creer|annuler|rejoindre|liste]` — Gérer les événements RSVP',
      '`!calendrier [ajouter|supprimer|salon|rappels|statut]` — Calendrier de matchs et rappels',
      '`!tableaudebord [salon|auto|heure|statut|lien]` — Dashboard automatique du serveur',
      '`!setdelai <commande> <secondes>` — Modifier le cooldown d\'une commande',
      '`!delais` — Voir tous les cooldowns configurés',
      '`!suppdelai <commande>` — Réinitialiser le cooldown d\'une commande',
    ],
  },
  {
    value: 'ia',
    label: 'Intelligence Artificielle',
    emoji: '🤖',
    description: 'Changer le modèle IA actif du serveur',
    cmds: [
      '`!ia modele <nom>` — Changer le modèle IA actif du serveur',
      '> Modèles disponibles : `gpt-4o-mini` `gpt-4o` `claude-haiku` `claude-sonnet` `gemini-flash` `mistral` `llama`',
    ],
  },
  {
    value: 'systeme',
    label: 'Système & Logs',
    emoji: '🔧',
    description: 'Stats bot, logs, notes internes, Git',
    cmds: [
      '`!statsbot` — Statistiques d\'utilisation du bot par commande',
      '`!logs` — Historique des actions du staff',
      '`!journal [N]` — Voir les N derniers commits Git (changelog)',
      '`!note <équipe> <texte>` — Ajouter une note interne sur une équipe',
      '`!notes <équipe>` — Voir les notes internes d\'une équipe',
      '`!delnote <équipe> <ID>` — Supprimer une note interne',
      '`!gitpush` — Pousser le code vers GitHub manuellement',
      '`!gitstatus` — Voir le statut du dépôt Git',
    ],
  },
];

// Catalogue à plat pour la recherche
const ALL_CMDS = CATS.flatMap(c =>
  c.cmds.map(cmd => ({ cmd, cat: `${c.emoji} ${c.label}`, catValue: c.value }))
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildRow(userId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`aidestaff_cat:${userId}`)
      .setPlaceholder('📂 Choisir une catégorie staff...')
      .addOptions([
        {
          label: 'Vue d\'ensemble',
          value: 'overview',
          description: 'Toutes les catégories staff disponibles',
          emoji: '🏠',
        },
        ...CATS.map(c => ({
          label: c.label,
          value: c.value,
          description: c.description,
          emoji: c.emoji,
        })),
      ])
  );
}

function buildOverviewEmbed(client) {
  const lines = CATS.map(c => `${c.emoji} **${c.label}** — ${c.description}`).join('\n');
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({ name: 'SUPREMYX — Aide Staff', iconURL: client.user.displayAvatarURL() })
    .setDescription(
      '> 🔒 Toutes ces commandes requièrent la permission **Administrateur**.\n' +
      '> Paramètres `< >` obligatoires, `[ ]` optionnels.\n' +
      '> Utilise le menu déroulant pour naviguer ou `!aidestaff <terme>` pour rechercher.\n\n' +
      lines
    )
    .setFooter({ text: 'SUPREMYX Esports · !aide pour les commandes accessibles à tous' })
    .setTimestamp();
}

function buildCatEmbed(client, cat) {
  const fields = [];
  let chunk = [];
  let len = 0;
  let first = true;

  for (const line of cat.cmds) {
    const lineLen = line.length + 1;
    if (len + lineLen > 1020 && chunk.length) {
      fields.push({ name: first ? `${cat.emoji} ${cat.label}` : '\u200b', value: chunk.join('\n'), inline: false });
      first = false;
      chunk = [line];
      len = lineLen;
    } else {
      chunk.push(line);
      len += lineLen;
    }
  }
  if (chunk.length) {
    fields.push({ name: first ? `${cat.emoji} ${cat.label}` : '\u200b', value: chunk.join('\n'), inline: false });
  }

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({ name: 'SUPREMYX — Aide Staff', iconURL: client.user.displayAvatarURL() })
    .addFields(fields)
    .setFooter({ text: 'SUPREMYX Esports · Utilise le menu pour changer de catégorie · !aidestaff <terme> pour rechercher' })
    .setTimestamp();
}

// ─── Module ───────────────────────────────────────────────────────────────────
module.exports = (client) => {

  // ── Commande principale ────────────────────────────────────────────────────
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

    // ── Mode recherche ──────────────────────────────────────────────────────
    if (query) {
      const results = ALL_CMDS.filter(c =>
        c.cmd.toLowerCase().includes(query) ||
        c.cat.toLowerCase().includes(query)
      );

      if (!results.length) {
        return message.reply(
          `🔍 Aucune commande staff trouvée pour **"${query}"**.\nTape \`!aidestaff\` pour voir toutes les commandes staff.`
        );
      }

      const byCategory = {};
      for (const r of results) {
        if (!byCategory[r.cat]) byCategory[r.cat] = [];
        byCategory[r.cat].push(r.cmd);
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

    // ── Mode menu ───────────────────────────────────────────────────────────
    const sent = await message.channel.send({
      embeds: [buildOverviewEmbed(client)],
      components: [buildRow(message.author.id)],
    });

    setTimeout(async () => {
      try {
        const expiredRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`aidestaff_cat:${message.author.id}`)
            .setPlaceholder('⏱️ Menu expiré — retape !aidestaff pour en ouvrir un nouveau')
            .setDisabled(true)
            .addOptions([{ label: 'Expiré', value: 'expired' }])
        );
        await sent.edit({ components: [expiredRow] });
      } catch {}
    }, 5 * 60 * 1000);
  });

  // ── Interaction menu ───────────────────────────────────────────────────────
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('aidestaff_cat:')) return;

    const ownerId = interaction.customId.split(':')[1];
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: '⚠️ Seul l\'auteur de la commande peut utiliser ce menu.',
        ephemeral: true,
      });
    }

    const selected = interaction.values[0];
    const row = buildRow(ownerId);

    if (selected === 'overview') {
      return interaction.update({
        embeds: [buildOverviewEmbed(client)],
        components: [row],
      });
    }

    const cat = CATS.find(c => c.value === selected);
    if (!cat) return interaction.update({ components: [row] });

    return interaction.update({
      embeds: [buildCatEmbed(client, cat)],
      components: [row],
    });
  });
};
