const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

// ─── Données par catégorie ────────────────────────────────────────────────────
const STAFF_CATEGORIES = [
  {
    id: 'matchs',
    label: 'Gestion des Matchs',
    emoji: '⚽',
    color: 0x57F287,
    commands: [
      { label: '!ajoutermatch <équipe> <placement> <kills>', description: 'Enregistrer un résultat de match',          subs: [] },
      { label: '!reinitialiser',                             description: 'Remettre tous les scores à zéro',           subs: [] },
      { label: '!resultats salon #salon',                    description: 'Configurer le salon des résultats auto',    subs: ['salon #salon — Config salon', 'statut <activer|desactiver> — Toggle', 'depuis <jours> — Résultats des N derniers jours'] },
      { label: '!exporter [json|csv|texte]',                 description: 'Exporter toutes les données',               subs: [] },
      { label: '!sauvegarde',                                description: 'Créer une sauvegarde JSON complète',        subs: [] },
      { label: '!restaurer',                                 description: 'Restaurer depuis une sauvegarde',           subs: [] },
      { label: '!annulermatch <id>',                         description: 'Annuler un match enregistré',               subs: [] },
    ],
  },
  {
    id: 'tournois',
    label: 'Tournois',
    emoji: '🏆',
    color: 0xFEE75C,
    commands: [
      { label: '!nouveautournoi <nom>',       description: 'Créer un nouveau tournoi',                  subs: [] },
      { label: '!finertournoi',               description: 'Terminer le tournoi actif',                 subs: [] },
      { label: '!supprimertournoi <nom>',     description: 'Supprimer un tournoi',                      subs: [] },
      { label: '!tableau',                    description: 'Générer le bracket (jusqu\'à 32 équipes)',  subs: [] },
      { label: '!trophee <icône> <équipe>',   description: 'Attribuer un trophée à une équipe',         subs: [] },
      { label: '!trophees <équipe>',          description: 'Voir tous les trophées d\'une équipe',      subs: [] },
      { label: '!inscription ouvrir',         description: 'Ouvrir les inscriptions au tournoi',        subs: ['ouvrir — Ouvrir', 'fermer — Fermer', 'liste — Équipes inscrites', 'valider <équipe> — Valider', 'refuser <équipe> — Refuser', 'max <N> — Nombre max', 'salon #salon — Salon dépôt', 'annonces #salon — Salon annonces', 'reinitialiser — Réinitialiser'] },
      { label: '!event creer <titre> | [desc] | [date]', description: 'Créer un événement RSVP avec réactions ✅/❌', subs: ['creer <titre> | [desc] | [date] — Créer', 'annuler <id> — Annuler un événement'] },
    ],
  },
  {
    id: 'equipes',
    label: 'Équipes & Joueurs',
    emoji: '👥',
    color: 0x5865F2,
    commands: [
      { label: '!enregistrer <nom>',           description: 'Enregistrer une équipe',                            subs: [] },
      { label: '!desenregistrer <nom>',        description: 'Supprimer une équipe et son historique',            subs: [] },
      { label: '!renommer <ancien> | <nouveau>', description: 'Renommer une équipe',                             subs: [] },
      { label: '!fusionner <T1> <T2>',         description: 'Fusionner deux équipes',                            subs: [] },
      { label: '!composition <équipe> <J1,…>', description: 'Définir la composition d\'une équipe',              subs: [] },
      { label: '!liste ajouter',               description: 'Ajouter un joueur au roster',                       subs: ['ajouter <équipe> @user <rôle> [note] — Ajouter', 'retirer <équipe> @user — Retirer', 'role <équipe> @user <rôle> — Changer rôle', 'note <équipe> @user <note> — Ajouter note', 'vider <équipe> — Vider roster', 'capitaine <équipe> @user — Désigner IGL'] },
      { label: '!composition definir',          description: 'Définir la composition de match d\'une équipe',      subs: ['definir <équipe> <J1,J2,...> — Définir', 'effacer <équipe> — Effacer', 'liste — Toutes les compositions'] },
      { label: '!objectif definir',            description: 'Définir l\'objectif de saison d\'une équipe',       subs: ['definir <équipe> <texte> — Définir', 'supprimer <équipe> — Supprimer', 'liste — Tous les objectifs'] },
      { label: '!absence effacer @membre',     description: 'Gérer les absences des joueurs',                    subs: ['effacer @membre — Effacer une absence', 'toutes — Voir toutes les absences'] },
      { label: '!setlogo <équipe> | <url>',    description: 'Définir le logo/thumbnail d\'une équipe (URL image)', subs: ['<équipe> | supprimer — Retirer le logo'] },
      { label: '!transfert <joueur> | <ancienne> | <nouvelle>', description: 'Déplacer un joueur d\'une équipe à une autre', subs: [] },
      { label: '!resetjoueur <nom>',           description: 'Remettre les stats d\'un joueur à zéro',           subs: [] },
      { label: '!donnerxp @membre <quantité>', description: 'Donner de l\'XP à un membre',                      subs: [] },
      { label: '!retirerxp @membre <qté>',     description: 'Retirer de l\'XP à un membre',                     subs: [] },
      { label: '!niveau reinitialiser @membre',description: 'Remettre XP et niveau d\'un membre à zéro',        subs: [] },
    ],
  },
  {
    id: 'saisons',
    label: 'Saisons',
    emoji: '📅',
    color: 0xEB459E,
    commands: [
      { label: '!nouvellesaison <nom>',          description: 'Démarrer une nouvelle saison',                      subs: [] },
      { label: '!finersaison',                   description: 'Clore la saison et archiver les stats',             subs: [] },
      { label: '!setrecompense <rang> @role',    description: 'Rôle Discord selon le rang au classement',          subs: [] },
      { label: '!lierequipe <équipe> @role',     description: 'Associer un rôle Discord à une équipe',            subs: [] },
      { label: '!gelerclassement',               description: 'Geler le classement (positions figées — playoffs)', subs: [] },
      { label: '!degerlerclassement',            description: 'Dégeler le classement et reprendre les mises à jour', subs: [] },
      { label: '!syncrangs',                     description: 'Synchroniser tous les rôles de rang',               subs: [] },
      { label: '!recompenses',                   description: 'Voir toutes les récompenses configurées',           subs: [] },
      { label: '!supprimerrecompense <rang>',    description: 'Supprimer une récompense de rang',                  subs: [] },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    emoji: '📢',
    color: 0xFEE75C,
    commands: [
      { label: '!annonce <message>',          description: 'Envoyer une annonce dans le salon configuré',  subs: [] },
      { label: '!dire <message>',             description: 'Faire parler le bot dans le salon courant',    subs: [] },
      { label: '!vote <question>',            description: 'Sondage rapide par réactions',                 subs: [] },
      { label: '!sondage',                    description: 'Sondage avancé (multiples options, timed)',    subs: [] },
      { label: '!concours <durée> <prix>',    description: 'Lancer un giveaway',                          subs: [] },
      { label: '!diffuser <message>',         description: 'Diffuser dans plusieurs salons',               subs: ['ajouter #salon — Ajouter salon', 'retirer #salon — Retirer salon', 'liste — Voir salons', 'aperçu — Prévisualiser'] },
      { label: '!setmessagejour <texte>',     description: 'Définir le message du jour automatique',      subs: [] },
      { label: '!messagejour',                description: 'Afficher le message du jour actuel',           subs: [] },
      { label: '!planifier creer',            description: 'Créer un message planifié',                    subs: ['creer — Créer', 'liste — Voir messages', 'supprimer <id> — Supprimer', 'modifier <id> — Modifier', 'dupliquer <id> — Dupliquer', 'pause <id> — Mettre en pause', 'tester <id> — Tester'] },
      { label: '!lien #salon | Titre | Desc | couleur',        description: 'Publier un embed texte dans un salon',          subs: ['preview | #salon | Titre | Desc | couleur — Prévisualiser avant publication', 'ici | Titre | Desc | couleur — Publier dans le salon courant'] },
      { label: '!lienbutton #salon | Titre | Desc | Texte >> https://... | couleur', description: 'Publier un embed avec boutons URL cliquables (max 5)', subs: ['preview | … — Prévisualiser avant publication'] },
      { label: '!lienlist [#salon]',                          description: 'Lister les embeds publiés par le bot dans un salon', subs: [] },
      { label: '!lienedit #salon | ID | Titre | Desc | couleur', description: 'Modifier un embed déjà publié par le bot',       subs: ['ici | ID | Titre | Desc | couleur — Modifier dans le salon courant'] },
      { label: '!liensupprimer #salon | ID_message',         description: 'Supprimer un embed publié par le bot (confirmation requise)', subs: ['ici | ID_message — Supprimer dans le salon courant'] },
      { label: '!messageembed <titre> | <desc> | [couleur] | [image_url] | [footer]', description: 'Poster un embed entièrement personnalisé dans le salon', subs: [] },
      { label: '!retirer <messageId>',                         description: 'Relancer un giveaway (reroll du gagnant)',          subs: [] },
      { label: '!notifequipe <équipe> | <message>',           description: 'Envoyer un DM à tous les membres Discord du roster', subs: [] },
    ],
  },
  {
    id: 'config',
    label: 'Config Serveur',
    emoji: '⚙️',
    color: 0x5865F2,
    commands: [
      { label: '!config',                      description: 'Voir/modifier la configuration du bot',              subs: [] },
      { label: '!setpoints <placement>',        description: 'Configurer le barème de points',                    subs: [] },
      { label: '!bienvenue definir',            description: 'Configurer le message de bienvenue',                subs: ['definir <message> — Définir message', 'salon #salon — Salon', 'tester — Tester', 'activer / desactiver — Toggle'] },
      { label: '!rolesauto definir @role',      description: 'Configurer le rôle automatique à l\'arrivée',      subs: ['definir @role — Définir rôle', 'activer / desactiver — Toggle'] },
      { label: '!rolereaction ajouter',         description: 'Configurer les reaction-roles',                     subs: ['ajouter #salon <msgId> <emoji> @role — Ajouter', 'retirer <msgId> <emoji> — Supprimer', 'liste — Voir tout', 'vider <msgId> — Vider message'] },
      { label: '!setanniversaire #salon',       description: 'Salon des annonces d\'anniversaire',                subs: [] },
      { label: '!setchannelniveau #salon',      description: 'Salon des montées de niveau XP',                    subs: [] },
      { label: '!calendrier salon #salon',      description: 'Config des rappels de matchs',                      subs: ['salon #salon — Salon rappels', 'rappel <activer|desactiver> [24h|1h|15m] — Toggle rappels', 'statut — Voir config', 'ajouter <DD/MM/YYYY> <HH:MM> <eq1,eq2> [note] — Ajouter', 'modifier <id> <DD/MM/YYYY> <HH:MM> — Modifier', 'supprimer <id> — Supprimer', 'vider — Supprimer passés'] },
      { label: '!salonannonce #salon',           description: 'Définir le salon d\'annonces du bot',               subs: [] },
      { label: '!salonjournaux #salon',          description: 'Définir le salon de journaux staff',                subs: [] },
      { label: '!voirconfig',                    description: 'Vue d\'ensemble de toute la configuration serveur',  subs: [] },
      { label: '!setdelai <commande> <sec>',    description: 'Modifier le cooldown d\'une commande',              subs: ['delais — Voir tous les cooldowns', 'suppdelai <commande> — Réinitialiser'] },
    ],
  },
  {
    id: 'moderation',
    label: 'Modération',
    emoji: '🛡️',
    color: 0xED4245,
    commands: [
      { label: '!effacer <1-100>',             description: 'Supprimer en masse des messages',                 subs: [] },
      { label: '!lenteur <0-21600>',           description: 'Activer le mode lent (secondes)',                 subs: [] },
      { label: '!sourdine @membre <durée>',    description: 'Mettre un membre en sourdine',                    subs: [] },
      { label: '!retablir @membre',            description: 'Retirer la sourdine',                             subs: [] },
      { label: '!verrouiller',                 description: 'Verrouiller le salon pour @everyone',             subs: [] },
      { label: '!deverrouiller',               description: 'Déverrouiller le salon',                          subs: [] },
      { label: '!avertir @membre <raison>',    description: 'Avertir un membre (escalade automatique)',        subs: [] },
      { label: '!supprimerwarn @membre [id]',  description: 'Retirer un avertissement',                        subs: [] },
      { label: '!avertissements @membre',      description: 'Voir l\'historique des warns',                    subs: [] },
      { label: '!punition @membre <type>',     description: 'Sanction directe (warn/mute/kick/ban)',           subs: [] },
      { label: '!sanctions @membre',           description: 'Voir le casier d\'un membre',                     subs: [] },
      { label: '!effaceractions @membre',      description: 'Effacer toutes les sanctions',                    subs: [] },
      { label: '!casier @membre',              description: 'Casier judiciaire complet',                       subs: [] },
      { label: '!rapport',                     description: 'Rapport hebdomadaire de modération',              subs: [] },
      { label: '!topwarn',                     description: 'Top 10 membres les plus sanctionnés',             subs: [] },
    ],
  },
  {
    id: 'escalade',
    label: 'Escalade & Filtres',
    emoji: '⚖️',
    color: 0xED4245,
    commands: [
      { label: '!escalade',                       description: 'Voir les règles d\'escalade automatique',      subs: ['activer / desactiver — Toggle', 'configurer <warns> <action> [durée] — Configurer règle', 'supprimer <warns> — Supprimer règle', 'reinitialiser — Réinitialiser'] },
      { label: '!listenoiree ajouter <nom>',      description: 'Gérer la blacklist des pseudos',               subs: ['ajouter <nom> — Ajouter', 'retirer <nom> — Retirer', 'liste — Voir', 'verifier <nom> — Vérifier'] },
      { label: '!automod activer',                description: 'Activer/désactiver le filtre de mots',         subs: ['activer / desactiver — Toggle', 'statut — Voir statut', 'test <texte> — Tester'] },
      { label: '!mots ajouter <mot>',             description: 'Gérer les mots interdits',                     subs: ['ajouter <mot> — Ajouter', 'retirer <mot> — Retirer', 'defaut — Restaurer défaut', 'vider — Tout supprimer'] },
      { label: '!antispam activer',               description: 'Configurer l\'anti-spam',                      subs: ['activer / desactiver — Toggle', 'configurer <msgs> <secondes> — Configurer seuils'] },
    ],
  },
  {
    id: 'tickets',
    label: 'Tickets & Règlement',
    emoji: '🎫',
    color: 0x57F287,
    commands: [
      { label: '!configticket rolstaff',        description: 'Configurer le système de tickets',          subs: ['rolstaff @role — Rôle staff', 'transcription #salon — Salon transcriptions', 'categorie <id> — Catégorie Discord'] },
      { label: '!ticket panneau',               description: 'Afficher le panneau d\'ouverture',           subs: [] },
      { label: '!tickets',                      description: 'Voir tous les tickets ouverts',              subs: [] },
      { label: '!prendre',                      description: 'Prendre en charge le ticket actuel',         subs: [] },
      { label: '!resoudre',                     description: 'Marquer le ticket comme résolu',             subs: [] },
      { label: '!fermer',                       description: 'Fermer le ticket actuel',                    subs: [] },
      { label: '!ajouteruser @membre',          description: 'Ajouter un membre au ticket',               subs: [] },
      { label: '!retireruser @membre',          description: 'Retirer un membre du ticket',               subs: [] },
      { label: '!renommerticket <titre>',       description: 'Renommer le salon du ticket',               subs: [] },
      { label: '!reglement titre <texte>',      description: 'Configurer le règlement avancé',            subs: ['titre <texte> — Titre', 'intro <texte> — Introduction', 'section <nom> — Ajouter section', 'ajouter <section> <texte> — Règle', 'modifier <section> <num> <texte> — Modifier', 'supprimer <section> <num> — Supprimer', 'publier — Publier', 'actualiser — Mettre à jour', 'reinitialiser — Réinitialiser'] },
      { label: '!ajouterregle <texte>',         description: 'Ajouter une règle simple',                  subs: ['ajouterregle <texte> — Ajouter', 'modifierregle <num> <texte> — Modifier', 'supprimerregle <num> — Supprimer', 'deplacerregle <de> <vers> — Déplacer', 'effacerregles — Tout supprimer', 'setregles — Config salon+auteur'] },
    ],
  },
  {
    id: 'systeme',
    label: 'Système & Logs',
    emoji: '🔧',
    color: 0x5865F2,
    commands: [
      { label: '!chercher staff <terme>',  description: 'Rechercher une commande staff par mot-clé',       subs: [] },
      { label: '!statsbot',                description: 'Statistiques d\'utilisation du bot',              subs: [] },
      { label: '!commandes',              description: 'Classement des commandes les plus utilisées',      subs: [] },
      { label: '!logs',                    description: 'Historique des actions staff',                    subs: ['vider — Effacer tout', 'stats — Statistiques par catégorie', 'aujourdhui — Logs du jour', '<catégorie> [page] — Filtrer par catégorie', '<mot-clé> — Recherche plein texte'] },
      { label: '!journal [N]',             description: 'N derniers commits Git (alias : !misesajour)',    subs: [] },
      { label: '!tableaudebord',           description: 'Tableau de bord web',                             subs: [] },
      { label: '!note <équipe> <texte>',   description: 'Note interne sur une équipe',                    subs: ['note <équipe> <texte> — Ajouter', 'notes <équipe> — Voir', 'supprimenote <id> — Supprimer'] },
      { label: '!mp @membre <message>',    description: 'Envoyer un DM via le bot',                       subs: [] },
      { label: '!gitpush',                 description: 'Pousser le code vers GitHub',                    subs: [] },
      { label: '!gitstatus',               description: 'Voir le statut du dépôt Git',                    subs: [] },
      { label: '!memoire',                 description: 'Voir l\'utilisation mémoire du bot',              subs: [] },
      { label: '!tempsenligne',            description: 'Voir le temps de fonctionnement',                 subs: [] },
      { label: '!ia modele <alias>',       description: 'Changer le modèle IA actif (admin)',              subs: ['modele <alias> — Changer de modèle', 'modeles — Voir tous les modèles disponibles'] },
      { label: '!ia quota <valeur>',       description: 'Gérer le quota d\'utilisations IA journalier',   subs: ['quota — Voir le quota actuel', 'quota <nombre> — Fixer la limite', 'quota off — Désactiver (illimité)', 'quota reset — Remettre le compteur à zéro', 'quota salon #salon — Salon d\'alerte'] },
    ],
  },
  {
    id: 'erreurs',
    label: 'Erreurs & Maintenance',
    emoji: '🚨',
    color: 0xED4245,
    commands: [
      { label: '!erreurs',                        description: 'Dernières erreurs du bot (paginé)',         subs: ['nonresolues — Erreurs non résolues', 'stats — Statistiques globales', 'resoudre <id> — Marquer résolue', 'vider — Effacer tout'] },
      { label: '!maintenance activer [message]', description: 'Activer le mode maintenance',               subs: ['activer [message] — Activer', 'desactiver — Désactiver', 'message <texte> — Changer message', 'statut — Voir état'] },
      { label: '!lienbot',                        description: 'Lien d\'invitation du bot',                subs: [] },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildMainEmbed() {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({ name: 'SUPREMYX — Aide Staff' })
    .setDescription(
      '🔐 Toutes les commandes ci-dessous **requièrent la permission Administrateur**.\n' +
      'Choisis une catégorie pour voir les commandes et sous-commandes disponibles.\n' +
      '> `< >` paramètre obligatoire · `[ ]` paramètre optionnel'
    )
    .addFields(
      STAFF_CATEGORIES.map(cat => ({
        name: `${cat.emoji} ${cat.label}`,
        value: `${cat.commands.length} commande(s)`,
        inline: true,
      }))
    )
    .setFooter({ text: 'SUPREMYX Esports · Staff uniquement' })
    .setTimestamp();
}

function buildButtonRows() {
  const rows = [];
  for (let i = 0; i < STAFF_CATEGORIES.length; i += 5) {
    const chunk = STAFF_CATEGORIES.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(
      chunk.map(cat =>
        new ButtonBuilder()
          .setCustomId(`staff_btn_${cat.id}`)
          .setLabel(cat.label)
          .setEmoji(cat.emoji)
          .setStyle(ButtonStyle.Danger)
      )
    );
    rows.push(row);
  }
  return rows;
}

function buildSelectMenu(cat) {
  const options = cat.commands.slice(0, 25).map((cmd, idx) => ({
    label: cmd.label.slice(0, 100),
    description: cmd.description.slice(0, 100),
    value: `${cat.id}_${idx}`,
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`staff_sel_${cat.id}`)
    .setPlaceholder(`Sélectionne une commande — ${cat.label}`)
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

function buildCategoryEmbed(cat) {
  const lines = cat.commands.map(cmd => `\`${cmd.label}\` — ${cmd.description}`);
  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(`${cat.emoji} ${cat.label}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Sélectionne une commande dans le menu pour les sous-commandes · Staff uniquement' });
}

function buildCommandEmbed(cat, cmdIdx) {
  const cmd = cat.commands[cmdIdx];
  if (!cmd) return null;

  const embed = new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(`\`${cmd.label}\``)
    .setDescription(cmd.description);

  if (cmd.subs && cmd.subs.length) {
    embed.addFields({
      name: '🔹 Sous-commandes',
      value: cmd.subs.map(s => `\`${s}\``).join('\n'),
    });
  }

  embed.setFooter({ text: `${cat.emoji} ${cat.label} · Staff uniquement · < > obligatoire · [ ] optionnel` });
  return embed;
}

// ─── Module ───────────────────────────────────────────────────────────────────
module.exports = (client) => {

  // !aidestaff → message principal avec boutons
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (!message.member) return;
      if (message.author.bot) return;
      if (message.content.trim() !== '!aidestaff') return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Cette commande est réservée au staff.');

      const cd = checkCooldown(message.author.id, 'aidestaff', 10);
      if (cd) return replyCooldown(message, cd, 'aidestaff');

      const sent = await message.channel.send({
        embeds: [buildMainEmbed()],
        components: buildButtonRows(),
      });

      setTimeout(async () => {
        try {
          await sent.edit({
            embeds: [
              buildMainEmbed().setFooter({ text: 'SUPREMYX Esports · Staff uniquement · ⏱️ Menu expiré — relance !aidestaff pour un nouveau menu.' }),
            ],
            components: [],
          });
        } catch (_) {}
      }, 5 * 60 * 1000);
    } catch (err) {
      console.error('[aidestaff messageCreate]', err);
    }
  });

  // ─── !chercher staff <terme> ──────────────────────────────────────────────
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      const content = message.content.trim();
      if (!content.startsWith('!chercher staff')) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Commande réservée au staff.');

      const term = content.slice('!chercher staff'.length).trim().toLowerCase();
      if (!term) {
        return message.reply('**Usage :** `!chercher staff <terme>`\nExemple : `!chercher staff inscription`');
      }
      if (term.length < 2) {
        return message.reply('❌ Le terme doit contenir au moins 2 caractères.');
      }

      const cd = checkCooldown(message.author.id, 'chercher_staff', 5);
      if (cd) return replyCooldown(message, cd, 'chercher staff');

      const results = [];
      for (const cat of STAFF_CATEGORIES) {
        const matches = cat.commands.filter(cmd =>
          cmd.label.toLowerCase().includes(term) ||
          cmd.description.toLowerCase().includes(term) ||
          cmd.subs.some(s => s.toLowerCase().includes(term))
        );
        if (matches.length) results.push({ cat, matches });
      }

      const total = results.reduce((n, r) => n + r.matches.length, 0);

      if (!total) {
        return message.reply(`🔍 Aucune commande staff trouvée pour \`${term}\`.\nEssaie un autre mot-clé ou consulte \`!aidestaff\` pour naviguer par catégorie.`);
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: `🔍 Recherche staff : "${term}"`, iconURL: client.user.displayAvatarURL() })
        .setDescription(`**${total}** résultat(s) dans ${results.length} catégorie(s) · 🔐 Staff uniquement`)
        .setFooter({ text: 'SUPREMYX Esports · Staff · < > obligatoire · [ ] optionnel · !aidestaff pour le menu complet' })
        .setTimestamp();

      for (const { cat, matches } of results) {
        embed.addFields({
          name: `${cat.emoji} ${cat.label}`,
          value: matches.map(cmd => `\`${cmd.label}\` — ${cmd.description}`).join('\n'),
          inline: false,
        });
      }

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[chercher staff]', err);
    }
  });

  // Interactions : boutons + menus déroulants
  client.on('interactionCreate', async interaction => {
    try {
      // ── Clic bouton catégorie ────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId.startsWith('staff_btn_')) {
        if (!interaction.member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '⛔ Staff uniquement.', ephemeral: true });
        }
        const catId = interaction.customId.replace('staff_btn_', '');
        const cat = STAFF_CATEGORIES.find(c => c.id === catId);
        if (!cat) return;

        await interaction.reply({
          ephemeral: true,
          embeds: [buildCategoryEmbed(cat)],
          components: [buildSelectMenu(cat)],
        });

        setTimeout(async () => {
          try {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x99AAB5)
                  .setDescription('⏱️ Ce menu a expiré. Clique à nouveau sur un bouton de catégorie.'),
              ],
              components: [],
            });
          } catch (_) {}
        }, 5 * 60 * 1000);
        return;
      }

      // ── Sélection commande dans le menu ───────────────────────────────────
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('staff_sel_')) {
        const catId = interaction.customId.replace('staff_sel_', '');
        const cat = STAFF_CATEGORIES.find(c => c.id === catId);
        if (!cat) return;

        const value = interaction.values[0]; // e.g. "matchs_2"
        const idx = parseInt(value.split('_').pop());
        const embed = buildCommandEmbed(cat, idx);
        if (!embed) return;

        await interaction.update({
          embeds: [embed],
          components: [buildSelectMenu(cat)],
        });
        return;
      }
    } catch (err) {
      console.error('[aidestaff interactionCreate]', err);
    }
  });
};
