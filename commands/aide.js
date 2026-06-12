const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

// ─── Catalogue par catégorie ──────────────────────────────────────────────────
const CATS = [
  {
    value: 'stats_equipes',
    label: 'Stats & Équipes',
    emoji: '📊',
    description: 'Classement, matchs, rosters, recherche',
    cmds: [
      '`!stats <équipe>` — Résumé des performances d\'une équipe',
      '`!infoequipe <équipe>` — Fiche détaillée d\'une équipe',
      '`!classement` — Classement général des équipes',
      '`!top [N]` — Top N équipes (défaut : 10)',
      '`!comparer <T1> vs <T2>` — Comparer deux équipes face à face',
      '`!historique <équipe>` — Historique complet des matchs',
      '`!matchs` — Statistiques globales de tous les matchs',
      '`!liste <équipe>` — Roster / composition d\'une équipe',
      '`!composition <équipe>` — Voir la composition détaillée d\'une équipe',
      '`!recherche <nom>` — Rechercher une équipe ou un joueur',
    ],
  },
  {
    value: 'stats_joueurs',
    label: 'Stats Joueurs',
    emoji: '👤',
    description: 'Stats individuelles, classements joueurs',
    cmds: [
      '`!statsjoueur <nom>` — Stats complètes d\'un joueur',
      '`!matchjoueur <nom>` — Historique des matchs d\'un joueur',
      '`!classjoueurs` — Classement général des joueurs',
      '`!classniveau` — Classement par niveau XP',
    ],
  },
  {
    value: 'stats_avancees',
    label: 'Stats Avancées',
    emoji: '📈',
    description: 'Séries, régularité, face à face',
    cmds: [
      '`!serie <équipe>` — Série de victoires/défaites en cours',
      '`!calculer <équipe>` — Calcul avancé des performances',
      '`!regularite <équipe>` — Indice de régularité sur les derniers matchs',
      '`!faceatface <T1> <T2>` — Bilan historique entre deux équipes',
    ],
  },
  {
    value: 'tournois',
    label: 'Tournois & Saisons',
    emoji: '🏆',
    description: 'Tournois, MVP, saisons, palmarès',
    cmds: [
      '`!tournois` — Liste de tous les tournois',
      '`!detailtournoi <nom>` — Détails et classement d\'un tournoi',
      '`!inscrire <nom_équipe>` — Inscrire son équipe à un tournoi',
      '`!mvp` — MVP actuel (meilleur ratio kills)',
      '`!mvpsaison` — MVP des saisons passées',
      '`!saisons` — Historique et vainqueurs des saisons',
      '`!palmares` — Palmarès complet du serveur',
      '`!trophees` — Tous les trophées décernés',
      '`!recompenses` — Voir les rôles attribués par rang',
    ],
  },
  {
    value: 'profil',
    label: 'Niveau & Profil',
    emoji: '🪪',
    description: 'Niveau XP, infos serveur et membres',
    cmds: [
      '`!niveau` — Ton niveau XP et ta progression',
      '`!infouser [@user]` — Infos, niveau et avertissements d\'un membre',
      '`!infoserveur` — Informations sur le serveur Discord',
      '`!inforole @role` — Détails techniques d\'un rôle',
      '`!ping` — Latence du bot et de l\'API Discord',
      '`!statut` — Statut du bot et aperçu des tournois actifs',
    ],
  },
  {
    value: 'ia',
    label: 'Intelligence Artificielle',
    emoji: '🤖',
    description: 'Poser des questions à l\'IA SUPREMYX',
    cmds: [
      '`!ia <question>` — Poser une question à l\'IA SUPREMYX',
      '`!ia réinitialiser` — Effacer son historique de conversation IA',
      '`!ia modeles` — Voir les modèles IA disponibles et l\'actuel',
      '`!ia statistiques` — Statistiques d\'utilisation de l\'IA',
    ],
  },
  {
    value: 'outils',
    label: 'Outils & Utilitaires',
    emoji: '🛠️',
    description: 'Rappels, AFK, anniversaires, tirages',
    cmds: [
      '`!rappel <durée> <texte>` — Créer un rappel (ex : `!rappel 2h match ce soir`)',
      '`!absent [message]` — Passer en mode AFK (les mentions notifient l\'auteur)',
      '`!anniversaire définir JJ/MM[/AAAA]` — Enregistrer sa date d\'anniversaire',
      '`!anniversaire liste` — Voir les anniversaires du serveur',
      '`!anniversaire vérifier [@user]` — Vérifier l\'anniversaire d\'un membre',
      '`!pileface` — Lancer une pièce (pile ou face)',
      '`!tirageteam <@u1> <@u2> ...` — Tirer des équipes aléatoires',
      '`!messagejour` — Voir le message du jour posté par le bot',
    ],
  },
  {
    value: 'communaute',
    label: 'Communauté & Tickets',
    emoji: '📬',
    description: 'Suggestions, tickets, votes, sanctions',
    cmds: [
      '`!suggestion <texte>` — Envoyer une suggestion au staff',
      '`!signaler <problème>` — Signaler un problème anonymement',
      '`!ticket [support|signalement|candidature]` — Ouvrir un ticket',
      '`!fermer` — Fermer son ticket en cours',
      '`!vote <question> | <opt1> | <opt2>` — Participer / créer un vote',
      '`!sanctions [@user]` — Voir ses sanctions (ou celles d\'un membre)',
      '`!avertissements [@user]` — Voir l\'historique des avertissements',
    ],
  },
  {
    value: 'regles',
    label: 'Règles du serveur',
    emoji: '📋',
    description: 'Règles et règlement du serveur',
    cmds: [
      '`!regles` — Afficher les règles du serveur',
      '`!règlement` — Afficher le règlement interactif complet',
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
      .setCustomId(`aide_cat:${userId}`)
      .setPlaceholder('📂 Choisir une catégorie...')
      .addOptions([
        {
          label: 'Vue d\'ensemble',
          value: 'overview',
          description: 'Toutes les catégories disponibles',
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
    .setColor(0xFF8C00)
    .setAuthor({ name: 'SUPREMYX — Aide générale', iconURL: client.user.displayAvatarURL() })
    .setDescription(
      '> 💡 Paramètres `< >` **obligatoires**, `[ ]` **optionnels**.\n' +
      '> Utilise le menu déroulant pour naviguer ou `!aide <terme>` pour rechercher.\n\n' +
      lines
    )
    .setFooter({ text: 'SUPREMYX Esports · !aidestaff pour les commandes réservées au staff' })
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
    .setColor(0xFF8C00)
    .setAuthor({ name: 'SUPREMYX — Aide générale', iconURL: client.user.displayAvatarURL() })
    .addFields(fields)
    .setFooter({ text: 'SUPREMYX Esports · Utilise le menu pour changer de catégorie · !aide <terme> pour rechercher' })
    .setTimestamp();
}

// ─── Module ───────────────────────────────────────────────────────────────────
module.exports = (client) => {

  // ── Commande principale ────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    if (content !== '!aide' && !content.startsWith('!aide ')) return;

    const cd = checkCooldown(message.author.id, 'aide', 10);
    if (cd) return replyCooldown(message, cd, 'aide');

    const query = content.slice('!aide'.length).trim().toLowerCase();

    // ── Mode recherche ──────────────────────────────────────────────────────
    if (query) {
      const results = ALL_CMDS.filter(c =>
        c.cmd.toLowerCase().includes(query) ||
        c.cat.toLowerCase().includes(query)
      );

      if (!results.length) {
        return message.reply(
          `🔍 Aucune commande trouvée pour **"${query}"**.\nTape \`!aide\` pour voir toutes les commandes.`
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
        .setColor(0xFF8C00)
        .setAuthor({ name: 'SUPREMYX — Résultats de recherche', iconURL: client.user.displayAvatarURL() })
        .setDescription(`🔍 **${results.length}** commande(s) trouvée(s) pour **"${query}"** :`)
        .addFields(fields)
        .setFooter({ text: 'SUPREMYX Esports · !aide pour l\'aide complète' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── Mode menu ───────────────────────────────────────────────────────────
    await message.channel.send({
      embeds: [buildOverviewEmbed(client)],
      components: [buildRow(message.author.id)],
    });
  });

  // ── Interaction menu ───────────────────────────────────────────────────────
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith('aide_cat:')) return;

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
