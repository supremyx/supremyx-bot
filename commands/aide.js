const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');
const { findSimilar } = require('../utils/fuzzySearch');
const SearchHistory = require('../database/models/SearchHistory');
const fs = require('fs');
const path = require('path');
const COMMAND_META = require('../utils/commandMeta');

// ─── Nouveautés : fichiers de commandes triés par date de modification ────────
function buildNouveautesEmbed(client) {
  const cmdDir = path.join(__dirname);
  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));

  const entries = files
    .map(f => {
      const meta = COMMAND_META[f];
      if (!meta || meta.staff === true) return null; // ignorer les staff-only
      try {
        const stat = fs.statSync(path.join(cmdDir, f));
        return { file: f, mtime: stat.mtimeMs, meta };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 10);

  const embed = new EmbedBuilder()
    .setColor(0xFF8C00)
    .setAuthor({ name: '🆕 Nouveautés — Commandes récemment modifiées', iconURL: client.user.displayAvatarURL() })
    .setDescription('Les **10 fichiers de commandes** modifiés le plus récemment.\n`[P]` Public · `[M]` Mixte (public + staff)')
    .setFooter({ text: 'SUPREMYX Esports · !aide pour le menu complet · !aidestaff pour les commandes staff' })
    .setTimestamp();

  for (const entry of entries) {
    const tag = entry.meta.staff === 'mixed' ? '[M]' : '[P]';
    const ts = Math.floor(entry.mtime / 1000);
    const cmds = entry.meta.commands.slice(0, 3).map(c => `\`${c}\``).join(', ');
    const more = entry.meta.commands.length > 3 ? ` +${entry.meta.commands.length - 3}` : '';
    embed.addFields({
      name: `${tag} ${entry.file.replace('.js', '')} — <t:${ts}:R>`,
      value: cmds + more,
      inline: false,
    });
  }

  return embed;
}

// ─── Données par catégorie ────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'stats',
    label: 'Stats & Équipes',
    emoji: '📊',
    color: 0x5865F2,
    commands: [
      { label: '!statistiques <équipe>',          description: 'Résumé complet des performances d\'une équipe',       subs: [] },
      { label: '!infoequipe <nom>',            description: 'Fiche détaillée d\'une équipe',                       subs: [] },
      { label: '!equipes',                     description: 'Liste de toutes les équipes enregistrées',            subs: [] },
      { label: '!classement',                  description: 'Classement général des équipes',                      subs: ['eliminations (alias : kills) — Classement par total d\'éliminations', 'ratio (alias : moyenne) — Classement par kills/match', 'elo — Classement ELO (placement + kills pondérés)', 'semaine — Classement sur les 7 derniers jours', '<tournoi> — Classement filtré sur un tournoi'] },
      { label: '!top [N]',                     description: 'Top N équipes par points (défaut : 3, max 25)',        subs: [] },
      { label: '!comparer <T1> vs <T2>',       description: 'Comparer deux équipes ou deux joueurs côte à côte',   subs: ['<T1> vs <T2> — Stats équipes en direct', 'saison <T1> vs <T2> — Comparaison sur l\'historique des saisons', 'joueur <J1> vs <J2> — Comparer deux joueurs (kills, matchs, ratio)'] },
      { label: '!historique <équipe>',         description: 'Historique de tous les matchs d\'une équipe',         subs: [] },
      { label: '!matchs',                      description: 'Statistiques globales (matchs, kills, records)',      subs: [] },
      { label: '!recherche <nom>',             description: 'Rechercher une équipe ou un joueur par nom',          subs: [] },
      { label: '!formrecente <équipe> [N]',    description: 'Forme récente : N derniers matchs avec résultats et moyennes', subs: [] },
      { label: '!top3 [30|saison]',            description: 'Top 3 joueurs par kills sur la période choisie',     subs: ['— 7 derniers jours (défaut)', '30 — 30 derniers jours', 'saison — Toute la saison archivée'] },
      { label: '!elo <équipe>',                description: 'Score ELO d\'une équipe (placement + kills pondérés)', subs: [] },
      { label: '!classementelo',               description: 'Classement ELO de toutes les équipes avec tendance', subs: [] },
      { label: '!statsserveur',                description: 'Statistiques globales du serveur : matchs, kills, records, équipes les plus actives', subs: [] },
      { label: '!rivaux <équipe>',             description: 'Équipes rencontrées le plus souvent et comparaison directe kills/points', subs: [] },
      { label: '!record <équipe>',             description: 'Records d\'une équipe : max kills, meilleure place, séries, meilleur tournoi', subs: ['<équipe> — Records de l\'équipe', 'joueur <nom> — Records personnels d\'un joueur'] },
    ],
  },
  {
    id: 'joueurs',
    label: 'Joueurs & Roster',
    emoji: '🎮',
    color: 0x57F287,
    commands: [
      { label: '!profil [@membre]',          description: 'Fiche complète : XP, équipe, stats, warns',            subs: [] },
      { label: '!statsjoueur <nom>',         description: 'Stats détaillées d\'un joueur (kills, matchs, ratio)', subs: [] },
      { label: '!classjoueurs',              description: 'Classement de tous les joueurs par kills',             subs: [] },
      { label: '!liste <équipe>',            description: 'Afficher le roster complet d\'une équipe',             subs: [] },
      { label: '!composition <équipe>',      description: 'Voir la composition de match d\'une équipe',           subs: ['<équipe> — Voir le lineup', 'historique <équipe> — Historique des compositions'] },
      { label: '!absence declarer [raison]', description: 'Déclarer son absence au prochain match',              subs: ['declarer [raison] — Déclarer son absence', 'annuler — Annuler son absence', 'liste <équipe> — Absences d\'une équipe'] },
      { label: '!objectif <équipe>',         description: 'Voir l\'objectif de saison d\'une équipe',             subs: ['<équipe> — Voir l\'objectif', 'liste — Tous les objectifs du serveur'] },
      { label: '!depistage <joueur>',         description: 'Fiche de dépistage complète d\'un joueur',             subs: ['<joueur> — Fiche complète', 'comparer <J1> vs <J2> — Comparer deux joueurs'] },
      { label: '!agentslibres',             description: 'Liste des joueurs enregistrés sans équipe active',      subs: [] },
      { label: '!capitaine <équipe>',       description: 'Voir le capitaine (IGL) d\'une équipe',                 subs: [] },
      { label: '!comparerjoueur <J1> | <J2>', description: 'Comparer les stats détaillées de deux joueurs',       subs: [] },
      { label: '!capitaines',               description: 'Liste de tous les capitaines (IGL) de toutes les équipes du serveur', subs: [] },
      { label: '!badges',                   description: 'Galerie de tous les badges distribués sur le serveur',  subs: [] },
      { label: '!badge liste [@membre]',    description: 'Voir les badges d\'un joueur ou tous les badges du serveur', subs: ['liste — Tous les badges', 'liste @membre — Badges d\'un joueur', 'liste <nom> — Badges par nom'] },
      { label: '!mvpmatch liste',           description: 'Voir les derniers MVPs désignés sur le serveur',        subs: ['liste — 15 derniers MVPs', 'joueur <nom> — Tous les MVPs d\'un joueur'] },
    ],
  },
  {
    id: 'tournois',
    label: 'Tournois & Saisons',
    emoji: '🏆',
    color: 0xFEE75C,
    commands: [
      { label: '!tournois',                            description: 'Liste de tous les tournois',                              subs: [] },
      { label: '!detailtournoi <nom>',                 description: 'Classement et détails d\'un tournoi',                    subs: [] },
      { label: '!inscrire <équipe> | <J1, J2, …>',    description: 'Inscrire son équipe à un tournoi ouvert',                subs: [] },
      { label: '!tableau [T1,T2,T3,…]',               description: 'Bracket éliminatoire (équipes en base ou personnalisé)', subs: [] },
      { label: '!saisons',                             description: 'Historique de toutes les saisons et vainqueurs',         subs: [] },
      { label: '!saisoncourante',                      description: 'Détails de la saison en cours + top 3',                  subs: [] },
      { label: '!classementsaison <nom>',              description: 'Classement archivé d\'une saison terminée',              subs: [] },
      { label: '!palmares',                            description: 'Palmarès général de tous les vainqueurs',                subs: [] },
      { label: '!mvp',                                 description: 'MVP actuel (meilleur ratio kills/match)',                 subs: [] },
      { label: '!mvpsaison',                           description: 'MVP All-Time : meilleure équipe toutes saisons confondues', subs: [] },
      { label: '!trophees <équipe>',                   description: 'Voir tous les trophées obtenus par une équipe',          subs: [] },
      { label: '!poule <Lettre>: <Eq1, Eq2, …>',      description: 'Créer/gérer un groupe de tournoi (poule A, B, C…)',      subs: ['creer <Lettre>: <Eq1,Eq2> — Créer', 'classement <Lettre> — Classement du groupe', 'resultat <Lettre> — Résultats du groupe', 'liste — Voir tous les groupes'] },
      { label: '!recapitulatif [nom_tournoi]',          description: 'Récapitulatif automatique complet d\'un tournoi (alias : !recap)',        subs: [] },
      { label: '!pronostic <T1> vs <T2>',              description: 'Faire un pronostic sur un match à venir',               subs: ['<T1> vs <T2> — Faire un pronostic', 'resultats — Voir ses pronostics', 'classement — Top pronostiqueurs'] },
      { label: '!dispo <oui|non|incertain>',           description: 'Déclarer sa disponibilité pour le prochain match',      subs: ['<oui|non|incertain> [raison] — Déclaration générale', 'match <id> <oui|non|incertain> — Dispo pour un match précis (ID via !calendrier)', 'voir — Voir sa déclaration actuelle', 'liste <équipe> — Voir les dispos déclarées de toute une équipe'] },
      { label: '!listedattente',                       description: 'Voir la liste d\'attente du tournoi actif (places limitées)', subs: [] },
      { label: '%inscrire <équipe>',                   description: 'S\'inscrire sur la liste d\'attente dans le salon dédié', subs: [] },
      { label: '!recompenses',                         description: 'Voir les récompenses de rang configurées (rôles Discord par classement)', subs: [] },
      { label: '!rappelsmatch',                        description: 'Voir les prochains matchs planifiés avec date et heure', subs: [] },
    ],
  },
  {
    id: 'profil',
    label: 'Profil & XP',
    emoji: '📈',
    color: 0xEB459E,
    commands: [
      { label: '!niveau [@membre]',      description: 'Niveau XP et barre de progression',                           subs: [] },
      { label: '!progression [@membre]', description: 'Progression XP détaillée : barre, XP restant, activité',     subs: [] },
      { label: '!topactivite [N]',       description: 'Top N membres les plus actifs par XP (activité récente)',     subs: [] },
      { label: '!classniveau',           description: 'Classement XP Top 10 du serveur',                            subs: [] },
      { label: '!classxp',               description: 'Alias de !classniveau',                                       subs: [] },
      { label: '!infoutilisateur [@membre]', description: 'Infos Discord d\'un membre : niveau, rôles, sanctions',   subs: [] },
      { label: '!inforole @role',        description: 'Détails d\'un rôle Discord (membres, permissions, couleur)', subs: [] },
      { label: '!infoserveur',            description: 'Informations générales sur le serveur (membres, salons, boosts)', subs: [] },
      { label: '!latence / !ping',        description: 'Latence du bot et de l\'API Discord (temps de réponse en ms)', subs: [] },
      { label: '!statut',                description: 'Statut du bot et aperçu des tournois en cours',              subs: [] },
      { label: '!tempsenligne',          description: 'Temps de fonctionnement du bot depuis le dernier démarrage', subs: [] },
      { label: '!commandes',             description: 'Classement des commandes les plus utilisées sur le serveur', subs: [] },
      { label: '!tableaudebord',         description: 'Afficher le résumé en direct du serveur ou accéder au tableau de bord web', subs: ['(sans arg) — Résumé : tickets, sanctions, XP, tournoi', 'lien — Lien vers le tableau de bord web'] },
    ],
  },
  {
    id: 'ia',
    label: 'Intelligence Artificielle',
    emoji: '🤖',
    color: 0x5865F2,
    commands: [
      { label: '!ia <question>',       description: 'Poser une question à l\'IA SUPREMYX',      subs: [] },
      { label: '!ia analyser',           description: 'Analyse IA d\'une équipe',                  subs: ['analyser <équipe> — Analyse complète'] },
      { label: '!ia predire',            description: 'Prédiction IA pour un affrontement',        subs: ['predire <T1> vs <T2> — Prédiction de match'] },
      { label: '!ia conseil',            description: 'Conseil coaching personnalisé',             subs: [] },
      { label: '!ia resume',             description: 'Résumé IA des performances d\'une équipe', subs: ['resume <équipe> — Résumé'] },
      { label: '!ia rapport',            description: 'Rapport IA complet d\'un joueur',           subs: ['rapport <joueur> — Rapport détaillé'] },
      { label: '!ia entrainement',       description: 'Plan d\'entraînement IA pour une équipe',   subs: ['entrainement <équipe> — Programme 1 semaine adapté aux stats'] },
      { label: '!ia strategie',          description: 'Stratégie IA pour battre une équipe',       subs: ['strategie <mon équipe> vs <adversaire> — Plan tactique'] },
      { label: '!ia bilan',              description: 'Bilan hebdomadaire automatique (stats + analyse IA envoyé chaque dimanche à 20h30)', subs: ['(sans arg) — Afficher le statut (salon configuré, dernier envoi)', 'salon #salon — Configurer le salon de réception *(staff)*', 'maintenant — Envoyer le bilan immédiatement *(staff)*', 'désactiver — Désactiver l\'envoi automatique *(staff)*'] },
      { label: '!ia depistage',           description: 'Fiche de dépistage IA d\'un joueur',        subs: ['depistage <joueur> — Rapport recrutement IA'] },
      { label: '!ia debrief <équipe>',    description: 'Débrief post-match IA : résultat, forces, faiblesses, objectifs', subs: ['debrief <équipe> — Analyse du dernier match', 'debrief statut — Voir le canal auto configuré', 'debrief salon #salon — Configurer le canal de débrief auto *(staff)*', 'debrief desactiver — Désactiver le débrief automatique *(staff)*'] },
      { label: '!ia coach <équipe>',     description: 'Plan tactique IA : positionnement, rotations, stratégie', subs: ['coach <équipe> — Plan tactique complet'] },
      { label: '!ia rotation <équipe>',  description: 'Plan de rotation IA : drop, zones, cercles finals',      subs: ['rotation <équipe> — Stratégie de rotation optimisée'] },
      { label: '!ia riposte <équipe> contre <adversaire>', description: 'Contre-stratégie IA face à un adversaire spécifique', subs: ['riposte <mon équipe> contre <adversaire> — Plan de riposte'] },
      { label: '!ia historique',         description: 'Historique de la conversation IA',          subs: [] },
      { label: '!ia reinitialiser',      description: 'Réinitialiser la conversation IA',          subs: [] },
      { label: '!ia modeles',            description: 'Liste des modèles IA disponibles',          subs: [] },
      { label: '!ia modele <alias>',     description: 'Changer de modèle IA',                     subs: [] },
      { label: '!ia statistiques',       description: 'Statistiques d\'utilisation de l\'IA',      subs: [] },
      { label: '!ia quota',              description: 'Consulter le quota IA journalier restant',   subs: [] },
      { label: '!ia basculement',         description: 'Tester tous les modèles en temps réel (latence + disponibilité)', subs: [] },
    ],
  },
  {
    id: 'calendrier',
    label: 'Calendrier & Événements',
    emoji: '📅',
    color: 0xFEE75C,
    commands: [
      { label: '!calendrier',              description: 'Liste les prochains matchs planifiés',        subs: ['prochain — Affiche uniquement le prochain match', 'equipe <nom> — Matchs à venir d\'une équipe spécifique'] },
      { label: '!calendrier equipe <nom>', description: 'Matchs à venir d\'une équipe spécifique',   subs: [] },
      { label: '!evenement [sous-commande]', description: 'Gérer les événements RSVP du serveur',         subs: ['liste — Voir les événements en cours', 'joindre <id> — S\'inscrire à un événement', 'quitter <id> — Se désinscrire d\'un événement', 'participants <id> — Voir les participants', 'creer <titre> | <desc> | <date> — Créer un événement *(staff)*', 'annuler <id> — Annuler un événement *(staff)*'] },
      { label: '!rappel <durée> <texte>',  description: 'Se créer un rappel personnel (ex : 1h Match ce soir)', subs: [] },
      { label: '!messagejour',              description: 'Afficher le message du jour configuré par le staff', subs: [] },
    ],
  },
  {
    id: 'outils',
    label: 'Outils & Utilitaires',
    emoji: '🛠️',
    color: 0x57F287,
    commands: [
      { label: '!aide nouveautes',              description: 'Voir les 10 fichiers de commandes modifiés le plus récemment', subs: [] },
      { label: '!aide historique',              description: 'Voir l\'historique de tes 5 dernières recherches dans l\'aide', subs: [] },
      { label: '!chercher <terme>',             description: 'Rechercher une commande par mot-clé',                        subs: [] },
      { label: '!repertoire',                   description: 'Répertoire paginé de toutes les commandes du bot (vue compacte)', subs: [] },
      { label: '!absent [message]',             description: 'Passer en mode AFK (bot répond à ta place)',                 subs: [] },
      { label: '!anniversaire definir <JJ/MM>', description: 'Enregistrer sa date d\'anniversaire',                       subs: ['definir <JJ/MM[/AAAA]> — Enregistrer', 'supprimer — Supprimer', 'liste — Voir tous les anniversaires', 'prochains [N] — Anniversaires dans les N prochains jours', 'verifier [@user] — Vérifier la date'] },
      { label: '!rebours <date> [événement]',   description: 'Compte à rebours jusqu\'à une date (ex : 25/12/2026 Noël)', subs: [] },
      { label: '!tirageequipe [T1,T2,...]',      description: 'Tirage au sort aléatoire d\'équipes 2 par 2',                subs: [] },
      { label: '!pileface',                     description: 'Lancer une pièce (pile ou face)',                            subs: [] },
      { label: '!lienbot',                      description: 'Obtenir le lien d\'invitation du bot',                      subs: [] },
      { label: '%logo <équipe>',                description: 'Soumettre le logo de ton équipe (image en pièce jointe) dans le salon dédié', subs: [] },
    ],
  },
  {
    id: 'communaute',
    label: 'Communauté',
    emoji: '📬',
    color: 0xEB459E,
    commands: [
      { label: '!suggestion <texte>',       description: 'Envoyer une suggestion anonyme au staff',                   subs: [] },
      { label: '!signaler <problème>',      description: 'Signaler un problème au staff',                             subs: [] },
      { label: '!ticket [type]',            description: 'Ouvrir un ticket de support',                               subs: ['support — Ticket technique', 'signalement — Signaler un membre', 'candidature — Postuler au staff'] },
      { label: '!sanctions [@membre]',      description: 'Voir ses propres sanctions actives',                        subs: [] },
      { label: '!avertissements',           description: 'Voir l\'historique complet de ses avertissements',          subs: [] },
      { label: '!regles',                   description: 'Afficher les règles simples du serveur',                    subs: [] },
      { label: '!reglement',               description: 'Afficher le règlement avancé du serveur (sections détaillées)', subs: [] },

      { label: '!listenoiree liste',        description: 'Consulter la liste noire des équipes et joueurs bannis',       subs: ['liste — Voir toutes les entrées', 'verifier <nom> — Vérifier si un nom est blacklisté'] },
    ],
  },
  {
    id: 'avance',
    label: 'Stats Avancées',
    emoji: '🔢',
    color: 0x5865F2,
    commands: [
      { label: '!serie <équipe>',                   description: 'Série de victoires/défaites en cours',             subs: [] },
      { label: '!regularite <équipe>',              description: 'Régularité sur les derniers matchs',               subs: [] },
      { label: '!faceatface <T1> <T2>',             description: 'Historique face à face entre 2 équipes',           subs: [] },
      { label: '!calculer <placement> <kills>',     description: 'Simuler les points gagnés sur un match donné',     subs: [] },
      { label: '!moyenne <équipe>',                 description: 'Moyenne kills, points et placement sur tous les matchs', subs: [] },
      { label: '!tendance <équipe>',                description: 'Tendance hausse/baisse des performances',          subs: [] },
      { label: '!meilleurmatch <équipe>',           description: 'Meilleur match (kills, points, placement)',        subs: [] },
      { label: '!pirematch <équipe>',               description: 'Pire match enregistré pour une équipe',           subs: [] },
      { label: '!resume',                           description: 'Résumé rapide du tournoi en cours (top 3 + derniers matchs)', subs: [] },
      { label: '!prediction <T1> vs <T2>',          description: 'Prédiction statistique de victoire entre deux équipes', subs: [] },
      { label: '!podium',                           description: 'Top 3 équipes au classement général de points',   subs: [] },
      { label: '!vainqueurs',                       description: 'Historique des vainqueurs : tournois et saisons passées', subs: [] },
      { label: '!prochainmatch',                    description: 'Prochain match du tournoi actif',                 subs: [] },
    ],
  },
];



// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildMainEmbed() {
  return new EmbedBuilder()
    .setColor(0xFF8C00)
    .setAuthor({ name: 'SUPREMYX — Aide Communauté' })
    .setDescription(
      'Choisis une **catégorie** ci-dessous pour voir les commandes disponibles.\n' +
      '> `< >` paramètre obligatoire · `[ ]` paramètre optionnel\n> Tape `!aidestaff` si tu fais partie du staff.'
    )
    .addFields(
      CATEGORIES.map(cat => ({
        name: `${cat.emoji} ${cat.label}`,
        value: `${cat.commands.length} commande(s)`,
        inline: true,
      }))
    )
    .setFooter({ text: 'SUPREMYX Esports'})
    .setTimestamp();
}

function buildButtonRows() {
  const rows = [];
  for (let i = 0; i < CATEGORIES.length; i += 5) {
    const chunk = CATEGORIES.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(
      chunk.map(cat =>
        new ButtonBuilder()
          .setCustomId(`aide_btn_${cat.id}`)
          .setLabel(cat.label)
          .setEmoji(cat.emoji)
          .setStyle(ButtonStyle.Secondary)
      )
    );
    rows.push(row);
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('aide_search')
        .setLabel('Rechercher')
        .setEmoji('🔍')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('aide_nouveautes')
        .setLabel('Nouveautés')
        .setEmoji('🆕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('aide_history')
        .setLabel('Historique')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary)
    )
  );
  return rows;
}

function buildSearchModal(modalId) {
  return new ModalBuilder()
    .setCustomId(modalId)
    .setTitle('🔍 Rechercher une commande')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('search_term')
          .setLabel('Mot-clé (ex : tournoi, stats, kill…)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Tape un mot-clé et appuie sur Envoyer')
          .setMinLength(2)
          .setMaxLength(50)
          .setRequired(true)
      )
    );
}

function buildSearchResultEmbed(term, categories, client, isStaff = false) {
  const results = [];
  for (const cat of categories) {
    const matches = cat.commands.filter(cmd =>
      cmd.label.toLowerCase().includes(term) ||
      cmd.description.toLowerCase().includes(term) ||
      cmd.subs.some(s => s.toLowerCase().includes(term))
    );
    if (matches.length) results.push({ cat, matches });
  }
  const total = results.reduce((n, r) => n + r.matches.length, 0);

  if (!total) return null;

  const embed = new EmbedBuilder()
    .setColor(isStaff ? 0xED4245 : 0xFF8C00)
    .setAuthor({ name: `🔍 Résultats pour "${term}"${isStaff ? ' · Staff' : ''}`, iconURL: client.user.displayAvatarURL() })
    .setDescription(`**${total}** résultat(s) dans ${results.length} catégorie(s)`)
    .setFooter({ text: `SUPREMYX Esports · < > obligatoire · [ ] optionnel · ${isStaff ? '!aidestaff' : '!aide'} pour le menu complet` })
    .setTimestamp();

  for (const { cat, matches } of results) {
    const value = matches.map(cmd => `\`${cmd.label}\` — ${cmd.description}`).join('\n');
    embed.addFields({ name: `${cat.emoji} ${cat.label}`, value: value.slice(0, 1024), inline: false });
  }

  return embed;
}

function buildSelectMenu(cat) {
  const options = cat.commands.map((cmd, idx) => ({
    label: cmd.label.slice(0, 100),
    description: cmd.description.slice(0, 100),
    value: `${cat.id}_${idx}`,
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`aide_sel_${cat.id}`)
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
    .setFooter({ text: 'Sélectionne une commande dans le menu pour plus de détails' });
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

  embed.setFooter({ text: `${cat.emoji} ${cat.label} · < > obligatoire · [ ] optionnel` });
  return embed;
}

// ─── Persistance historique de recherche ─────────────────────────────────────
async function saveSearchTerm(userId, guildId, term, type) {
  await SearchHistory.findOneAndUpdate(
    { userId, guildId, type },
    { $push: { terms: { $each: [{ term, at: new Date() }], $slice: -5 } } },
    { upsert: true, new: true }
  );
}

// ─── Module ───────────────────────────────────────────────────────────────────
module.exports = (client) => {

  // !aide → message principal avec boutons
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (message.content.trim() !== '!aide') return;

      message.delete().catch(() => {});

      const cd = checkCooldown(message.author.id, 'aide', 10, message.guild?.id);
      if (cd) return replyCooldown(message, cd, 'aide');

      const sent = await message.channel.send({
        embeds: [buildMainEmbed()],
        components: buildButtonRows(),
      });

      setTimeout(async () => {
        try {
          await sent.edit({
            embeds: [
              buildMainEmbed().setFooter({ text: 'SUPREMYX Esports · ⏱️ Menu expiré — relance !aide pour un nouveau menu.' }),
            ],
            components: [],
          });
        } catch (_) {}
      }, 5 * 60 * 1000);

      setTimeout(() => sent.delete().catch(() => {}), 30 * 60 * 1000);
    } catch (err) {
      console.error('[aide messageCreate]', err);
    }
  });

  // ─── !aide nouveautes ─────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (message.content.trim() !== '!aide nouveautes') return;

      message.delete().catch(() => {});

      const cd = checkCooldown(message.author.id, 'aide_nouveautes', 15, message.guild?.id);
      if (cd) return replyCooldown(message, cd, 'aide nouveautes');

      const sent = await message.channel.send({ embeds: [buildNouveautesEmbed(client)] });
      setTimeout(() => sent.delete().catch(() => {}), 30 * 60 * 1000);
    } catch (err) {
      console.error('[aide nouveautes]', err);
    }
  });

  // ─── !aide historique ─────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (message.content.trim() !== '!aide historique') return;

      message.delete().catch(() => {});

      const doc = await SearchHistory.findOne({
        userId: message.author.id,
        guildId: message.guild.id,
        type: 'aide',
      });
      const terms = doc?.terms?.slice().reverse() ?? [];

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `📋 Historique · ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setFooter({ text: 'SUPREMYX Esports · !aide pour le menu complet' })
        .setTimestamp();

      if (!terms.length) {
        embed.setDescription('Aucune recherche enregistrée.\nUtilise `!chercher <terme>` ou le bouton 🔍 dans `!aide`.');
      } else {
        embed.setDescription('Tes **5 dernières recherches** (la plus récente en premier) :');
        terms.forEach((t, i) => {
          const ts = Math.floor(new Date(t.at).getTime() / 1000);
          embed.addFields({ name: `#${i + 1} — ${t.term}`, value: `<t:${ts}:R>`, inline: true });
        });
      }

      const sent = await message.channel.send({ embeds: [embed] });
      setTimeout(() => sent.delete().catch(() => {}), 30 * 60 * 1000);
    } catch (err) {
      console.error('[aide historique]', err);
    }
  });

  // ─── !chercher <terme> ────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      const content = message.content.trim();
      if (!content.startsWith('!chercher')) return;
      if (content.startsWith('!chercher staff')) return; // réservé à aidestaff

      message.delete().catch(() => {});

      const term = content.slice('!chercher'.length).trim().toLowerCase();
      if (!term) {
        message.reply('**Usage :** `!chercher <terme>`\nExemple : `!chercher tournoi`').then(m => setTimeout(() => m.delete().catch(() => {}), 30 * 60 * 1000)).catch(() => {});
        return;
      }
      if (term.length < 2) {
        message.reply('❌ Le terme doit contenir au moins 2 caractères.').then(m => setTimeout(() => m.delete().catch(() => {}), 30 * 60 * 1000)).catch(() => {});
        return;
      }

      const cd = checkCooldown(message.author.id, 'chercher', 5, message.guild?.id);
      if (cd) return replyCooldown(message, cd, 'chercher');

      saveSearchTerm(message.author.id, message.guild.id, term, 'aide').catch(() => {});

      const results = [];
      for (const cat of CATEGORIES) {
        const matches = cat.commands.filter(cmd =>
          cmd.label.toLowerCase().includes(term) ||
          cmd.description.toLowerCase().includes(term) ||
          cmd.subs.some(s => s.toLowerCase().includes(term))
        );
        if (matches.length) results.push({ cat, matches });
      }

      const total = results.reduce((n, r) => n + r.matches.length, 0);

      if (!total) {
        const suggestions = findSimilar(term, CATEGORIES);
        if (suggestions.length) {
          const suggestText = suggestions
            .map(({ cat, cmd }) => `• \`${cmd.label}\` *(${cat.emoji} ${cat.label})* — ${cmd.description}`)
            .join('\n');
          message.reply(`🔍 Aucun résultat exact pour \`${term}\`.\n\n💡 **Peut-être voulais-tu dire :**\n${suggestText}`).then(m => setTimeout(() => m.delete().catch(() => {}), 30 * 60 * 1000)).catch(() => {});
          return;
        }
        message.reply(`🔍 Aucune commande trouvée pour \`${term}\`.\nEssaie un autre mot-clé ou consulte \`!aide\` pour naviguer par catégorie.`).then(m => setTimeout(() => m.delete().catch(() => {}), 30 * 60 * 1000)).catch(() => {});
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `🔍 Recherche : "${term}"`, iconURL: client.user.displayAvatarURL() })
        .setDescription(`**${total}** résultat(s) dans ${results.length} catégorie(s)`)
        .setFooter({ text: 'SUPREMYX Esports · < > obligatoire · [ ] optionnel · !aide pour le menu complet' })
        .setTimestamp();

      for (const { cat, matches } of results) {
        embed.addFields({
          name: `${cat.emoji} ${cat.label}`,
          value: matches.map(cmd => `\`${cmd.label}\` — ${cmd.description}`).join('\n').slice(0, 1024),
          inline: false,
        });
      }

      const sent = await message.channel.send({ embeds: [embed] });
      setTimeout(() => sent.delete().catch(() => {}), 30 * 60 * 1000);
    } catch (err) {
      console.error('[chercher]', err);
    }
  });

  // Interactions : boutons + menus déroulants
  client.on('interactionCreate', async interaction => {
    try {
      // ── Bouton nouveautés → embed éphémère ───────────────────────────────
      if (interaction.isButton() && interaction.customId === 'aide_nouveautes') {
        return interaction.reply({ ephemeral: true, embeds: [buildNouveautesEmbed(client)] });
      }

      // ── Bouton historique → embed éphémère ───────────────────────────────
      if (interaction.isButton() && interaction.customId === 'aide_history') {
        const doc = await SearchHistory.findOne({
          userId: interaction.user.id,
          guildId: interaction.guildId,
          type: 'aide',
        });
        const terms = doc?.terms?.slice().reverse() ?? [];

        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setAuthor({ name: `📋 Historique · ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setFooter({ text: 'SUPREMYX Esports · !aide pour le menu complet' })
          .setTimestamp();

        if (!terms.length) {
          embed.setDescription('Aucune recherche enregistrée.\nClique sur 🔍 **Rechercher** pour commencer.');
        } else {
          embed.setDescription('Tes **5 dernières recherches** (la plus récente en premier) :');
          terms.forEach((t, i) => {
            const ts = Math.floor(new Date(t.at).getTime() / 1000);
            embed.addFields({ name: `#${i + 1} — ${t.term}`, value: `<t:${ts}:R>`, inline: true });
          });
        }

        return interaction.reply({ ephemeral: true, embeds: [embed] });
      }

      // ── Bouton recherche → ouvre la modal ────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'aide_search') {
        return interaction.showModal(buildSearchModal('aide_modal_search'));
      }

      // ── Soumission de la modal de recherche ───────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId === 'aide_modal_search') {
        const term = interaction.fields.getTextInputValue('search_term').trim().toLowerCase();
        saveSearchTerm(interaction.user.id, interaction.guildId, term, 'aide').catch(() => {});
        const embed = buildSearchResultEmbed(term, CATEGORIES, client, false);
        if (!embed) {
          const suggestions = findSimilar(term, CATEGORIES);
          if (suggestions.length) {
            const suggestText = suggestions
              .map(({ cat, cmd }) => `• \`${cmd.label}\` *(${cat.emoji} ${cat.label})* — ${cmd.description}`)
              .join('\n');
            return interaction.reply({
              ephemeral: true,
              content: `🔍 Aucun résultat exact pour **"${term}"**.\n\n💡 **Peut-être voulais-tu dire :**\n${suggestText}`,
            });
          }
          return interaction.reply({
            ephemeral: true,
            content: `🔍 Aucune commande trouvée pour **"${term}"**.\nEssaie un autre mot-clé ou consulte les catégories via \`!aide\`.`,
          });
        }
        return interaction.reply({ ephemeral: true, embeds: [embed] });
      }

      // ── Clic bouton catégorie ────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId.startsWith('aide_btn_')) {
        const catId = interaction.customId.replace('aide_btn_', '');
        const cat = CATEGORIES.find(c => c.id === catId);
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
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('aide_sel_')) {
        const catId = interaction.customId.replace('aide_sel_', '');
        const cat = CATEGORIES.find(c => c.id === catId);
        if (!cat) return;

        const value = interaction.values[0]; // e.g. "stats_2"
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
      console.error('[aide interactionCreate]', err);
    }
  });
};
