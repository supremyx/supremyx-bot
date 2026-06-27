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

// ─── Nouveautés staff : fichiers triés par date de modification ───────────────
function buildNouveautesStaffEmbed(client) {
  const cmdDir = path.join(__dirname);
  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));

  const entries = files
    .map(f => {
      const meta = COMMAND_META[f];
      if (!meta) return null;
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
    .setColor(0xED4245)
    .setAuthor({ name: '🆕 Nouveautés Staff — Fichiers récemment modifiés', iconURL: client.user.displayAvatarURL() })
    .setDescription('Les **10 fichiers de commandes** modifiés le plus récemment.\n`[S]` Staff · `[P]` Public · `[M]` Mixte')
    .setFooter({ text: 'SUPREMYX Esports · Staff · !aidestaff pour le menu complet' })
    .setTimestamp();

  for (const entry of entries) {
    const tag = entry.meta.staff === true ? '[S]' : entry.meta.staff === 'mixed' ? '[M]' : '[P]';
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
const STAFF_CATEGORIES = [
  // ══ COMMANDES PUBLIQUES ════════════════════════════════════════════════════
  {
    id: 'stats',
    label: 'Stats & Équipes',
    emoji: '📊',
    color: 0x5865F2,
    commands: [
      { label: '!statistiques <équipe>',       description: 'Résumé complet des performances d\'une équipe',                     subs: [] },
      { label: '!infoequipe <nom>',           description: 'Fiche détaillée d\'une équipe',                                     subs: [] },
      { label: '!equipes',                    description: 'Liste de toutes les équipes enregistrées',                          subs: [] },
      { label: '!classement',                 description: 'Classement général des équipes',                                    subs: ['eliminations — Classement par total d\'éliminations', 'ratio — Classement par kills/match', '<tournoi> — Classement filtré sur un tournoi'] },
      { label: '!top [N]',                    description: 'Top N équipes (défaut : 10)',                                       subs: [] },
      { label: '!comparer <T1> vs <T2>',      description: 'Comparer deux équipes ou deux joueurs côte à côte',                subs: ['<T1> vs <T2> — Stats équipes en direct', 'saison <T1> vs <T2> — Comparaison historique des saisons', 'joueur <J1> vs <J2> — Comparer deux joueurs'] },
      { label: '!historique <équipe>',        description: 'Historique de tous les matchs d\'une équipe',                      subs: [] },
      { label: '!matchs',                     description: 'Statistiques globales (matchs, kills, records)',                   subs: [] },
      { label: '!recherche <nom>',            description: 'Rechercher une équipe ou un joueur par nom',                       subs: [] },
      { label: '!formrecente <équipe> [N]',   description: 'Forme récente : N derniers matchs avec résultats et moyennes',     subs: [] },
      { label: '!top3 [30|saison]',           description: 'Top 3 joueurs par kills sur la période choisie',                   subs: ['(sans arg) — 7 derniers jours', '30 — 30 derniers jours', 'saison — Toute la saison archivée'] },
      { label: '!ajoutermatch <équipe> <placement> <kills>', description: 'Enregistrer un résultat de match (Staff)',           subs: [] },
      { label: '!annulermatch <id>',          description: 'Annuler un match enregistré (Staff)',                               subs: [] },
      { label: '!reinitialiser',              description: 'Remettre tous les scores à zéro (Staff)',                          subs: [] },
      { label: '!resultats salon #salon',     description: 'Configurer le salon des résultats automatiques (Staff)',            subs: ['salon #salon — Config salon', 'statut <activer|desactiver> — Toggle', 'depuis <jours> — Résultats des N derniers jours'] },
      { label: '!exporter [json|csv|texte]',  description: 'Exporter toutes les données du bot (Staff)',                       subs: [] },
      { label: '!sauvegarde',                 description: 'Créer et gérer les sauvegardes JSON complètes (Staff)',             subs: ['creer — Créer une nouvelle sauvegarde', 'liste — Voir toutes les sauvegardes', 'info <id> — Détails d\'une sauvegarde', 'supprimer <id> — Supprimer une sauvegarde'] },
      { label: '!restaurer',                  description: 'Restaurer les données depuis une sauvegarde (Staff)',               subs: [] },
    ],
  },
  {
    id: 'joueurs',
    label: 'Joueurs & Roster',
    emoji: '🎮',
    color: 0x57F287,
    commands: [
      { label: '!profil [@membre]',                            description: 'Fiche complète : XP, équipe, stats, warns',            subs: [] },
      { label: '!statsjoueur <nom>',                           description: 'Stats détaillées d\'un joueur (kills, matchs, ratio)', subs: [] },
      { label: '!classjoueurs',                                description: 'Classement de tous les joueurs par kills',             subs: [] },
      { label: '!matchjoueur <nom>',                           description: 'Détail de tous les matchs d\'un joueur',              subs: [] },
      { label: '!liste <équipe>',                              description: 'Afficher le roster complet d\'une équipe',             subs: [] },
      { label: '!composition <équipe>',                        description: 'Voir la composition de match d\'une équipe',           subs: [] },
      { label: '!absence declarer [raison]',                   description: 'Déclarer son absence au prochain match',              subs: ['declarer [raison] — Déclarer', 'annuler — Annuler son absence', 'liste <équipe> — Absences d\'une équipe'] },
      { label: '!objectif <équipe>',                           description: 'Voir l\'objectif de saison d\'une équipe',             subs: ['voir <équipe> — Voir l\'objectif', 'progression <équipe> — Avancement'] },
      { label: '!depistage <joueur>',                          description: 'Fiche de dépistage complète d\'un joueur',             subs: ['<joueur> — Fiche complète', 'comparer <J1> vs <J2> — Comparer deux joueurs'] },
      { label: '!capitaine <équipe>',                          description: 'Voir le capitaine (IGL) d\'une équipe',                 subs: ['<équipe> — Voir le capitaine', '<équipe> | @user — Définir le capitaine (Staff)'] },
      { label: '!comparerjoueur <J1> | <J2>',                 description: 'Comparer les stats détaillées de deux joueurs',         subs: [] },
      { label: '!agentslibres',                                description: 'Liste des joueurs enregistrés sans équipe active',     subs: [] },
      { label: '!enregistrer <nom>',                           description: 'Enregistrer une nouvelle équipe (Staff)',               subs: [] },
      { label: '!desenregistrer <nom>',                        description: 'Supprimer une équipe et son historique (Staff)',        subs: [] },
      { label: '!renommer <ancien> | <nouveau>',               description: 'Renommer une équipe (Staff)',                          subs: [] },
      { label: '!fusionner <T1> <T2>',                         description: 'Fusionner deux équipes en une (Staff)',                subs: [] },
      { label: '!liste ajouter',                               description: 'Gérer le roster d\'une équipe (Staff)',                subs: ['ajouter <équipe> @user <rôle> [note] — Ajouter', 'retirer <équipe> @user — Retirer', 'role <équipe> @user <rôle> — Changer rôle', 'note <équipe> @user <note> — Ajouter note', 'vider <équipe> — Vider roster', 'capitaine <équipe> @user — Désigner IGL'] },
      { label: '!composition definir',                         description: 'Définir la composition de match d\'une équipe (Staff)', subs: ['definir <équipe> <J1,J2,...> — Définir', 'effacer <équipe> — Effacer', 'liste — Toutes les compositions'] },
      { label: '!objectif definir',                            description: 'Définir l\'objectif de saison d\'une équipe (Staff)',   subs: ['definir <équipe> <texte> — Définir', 'supprimer <équipe> — Supprimer', 'liste — Tous les objectifs'] },
      { label: '!absence effacer @membre',                     description: 'Effacer l\'absence d\'un joueur (Staff)',               subs: ['effacer @membre — Effacer', 'toutes — Voir toutes les absences'] },
      { label: '!configlogo <équipe> | <url>',                 description: 'Définir le logo/thumbnail d\'une équipe (Staff)',       subs: ['<équipe> | supprimer — Retirer le logo'] },
      { label: '!transfert <joueur> | <ancienne> | <nouvelle>', description: 'Déplacer un joueur d\'une équipe à une autre (Staff)', subs: [] },
      { label: '!reinitjoueur <équipe> <nom>',                 description: 'Remettre les stats d\'un joueur à zéro (Staff)',        subs: [] },
    ],
  },
  {
    id: 'tournois',
    label: 'Tournois & Saisons',
    emoji: '🏆',
    color: 0xFEE75C,
    commands: [
      { label: '!tournois',                             description: 'Liste de tous les tournois',                                   subs: [] },
      { label: '!detailtournoi <nom>',                  description: 'Classement et détails d\'un tournoi',                         subs: [] },
      { label: '!inscrire <équipe> | <J1,J2,…>',       description: 'Inscrire son équipe à un tournoi ouvert',                      subs: [] },
      { label: '!tableau [T1,T2,T3,…]',                description: 'Bracket éliminatoire (équipes en base ou liste personnalisée)', subs: [] },
      { label: '!saisons',                              description: 'Historique de toutes les saisons et vainqueurs',               subs: [] },
      { label: '!saisoncourante',                       description: 'Détails de la saison en cours + top 3',                       subs: [] },
      { label: '!classementsaison <nom>',               description: 'Classement archivé d\'une saison terminée',                   subs: [] },
      { label: '!palmares',                             description: 'Palmarès général de tous les vainqueurs',                     subs: [] },
      { label: '!mvp',                                  description: 'MVP actuel (meilleur ratio kills/match)',                      subs: [] },
      { label: '!mvpsaison',                            description: 'MVP All-Time : meilleure équipe toutes saisons confondues',    subs: [] },
      { label: '!trophees <équipe>',                    description: 'Voir tous les trophées obtenus par une équipe',               subs: [] },
      { label: '!poule <Lettre>: <Eq1,Eq2,…>',         description: 'Gérer un groupe de tournoi (poule A, B, C…)',                  subs: ['creer <Lettre>: <Eq1,Eq2> — Créer', 'classement <Lettre> — Classement du groupe', 'resultat <Lettre> — Résultats du groupe', 'liste — Voir tous les groupes'] },
      { label: '!recap [nom_tournoi]',                  description: 'Récapitulatif automatique complet d\'un tournoi',              subs: [] },
      { label: '!pronostic <T1> vs <T2>',               description: 'Faire un pronostic sur un match à venir',                     subs: ['<T1> vs <T2> — Faire un pronostic', 'resultats — Voir ses pronostics', 'classement — Top pronostiqueurs'] },
      { label: '!dispo oui|non|incertain',              description: 'Déclarer sa disponibilité pour le prochain match',            subs: ['oui|non|incertain [raison] — Déclaration générale', 'match <id> <statut> — Pour un match précis', 'voir — Voir sa dispo actuelle'] },
      { label: '!listedattente',                        description: 'Voir la liste d\'attente du tournoi actif',                   subs: [] },
      { label: '!recompenses',                          description: 'Voir les récompenses de rang configurées',                    subs: [] },
      { label: '!nouveautournoi <nom>',                 description: 'Créer un nouveau tournoi (Staff)',                             subs: [] },
      { label: '!finirtournoi',                         description: 'Terminer le tournoi actif (Staff)',                            subs: [] },
      { label: '!supprimertournoi <nom>',               description: 'Supprimer un tournoi (Staff)',                                subs: [] },
      { label: '!trophee <icône> <équipe>',             description: 'Attribuer un trophée à une équipe (Staff)',                   subs: [] },
      { label: '!inscription ouvrir',                   description: 'Gérer les inscriptions au tournoi (Staff)',                   subs: ['ouvrir — Ouvrir', 'fermer — Fermer', 'liste — Équipes inscrites', 'valider <équipe> — Valider', 'refuser <équipe> — Refuser', 'max <N> — Nombre max', 'salon #salon — Salon dépôt', 'annonces #salon — Salon annonces', 'reinitialiser — Réinitialiser'] },
      { label: '!listedattente configurer',             description: 'Gérer la liste d\'attente d\'inscription (Staff)',            subs: ['configurer #salon <max> <roleId> — Configurer', 'initialiser — Réinitialiser', 'liste — Voir inscriptions', 'confirmer <équipe> — Confirmer', 'retirer <équipe> — Retirer', 'vip <équipe> — Priorité VIP', 'places <N> — Modifier places disponibles', 'réinitialiser — Vider liste', 'infos — Config et stats'] },
      { label: '!alerteperf <équipe> <seuil> #salon',   description: 'Alerte auto quand une équipe franchit un seuil de points (Staff)', subs: ['<équipe> <seuil_points> #salon — Par points', 'podium <équipe> #salon — Entrée/sortie podium', 'liste — Voir toutes les alertes', 'supprimer <équipe> — Supprimer'] },
      { label: '!pronostic valider <T1> vs <T2> <vainqueur>', description: 'Valider les pronostics d\'un match joué (Staff)',      subs: [] },
      { label: '!poule supprimer <Lettre>',             description: 'Supprimer un groupe de tournoi (Staff)',                      subs: [] },
      { label: '!nouvellesaison <nom>',                 description: 'Démarrer une nouvelle saison (Staff)',                        subs: [] },
      { label: '!finersaison',                          description: 'Clore la saison et archiver les stats (Staff)',               subs: [] },
      { label: '!definitrecompense <rang> @role',       description: 'Attribuer un rôle Discord selon le rang au classement (Staff)', subs: [] },
      { label: '!lierequipe <équipe> @role',            description: 'Associer un rôle Discord à une équipe (Staff)',              subs: [] },
      { label: '!gelerclassement',                      description: 'Geler le classement (positions figées pour playoffs) (Staff)', subs: [] },
      { label: '!degerlerclassement',                   description: 'Dégeler le classement et reprendre les mises à jour (Staff)', subs: [] },
      { label: '!synchroniserrangs',                    description: 'Synchroniser tous les rôles de rang en une fois (Staff)',     subs: [] },
      { label: '!supprimerrecompense <rang>',           description: 'Supprimer une récompense de rang (Staff)',                    subs: [] },
      { label: '!dispo effacer @membre',                description: 'Effacer les disponibilités d\'un membre (Staff)',             subs: ['effacer @membre — Effacer', 'liste <équipe> — Vue équipe'] },
      { label: '!xp multiplicateur #salon <val>',       description: 'Multiplicateur XP par salon 0-10 (Staff)',                   subs: ['multiplicateur #salon <0-10> — Définir', 'multiplicateurs — Voir tous'] },
    ],
  },
  {
    id: 'profil',
    label: 'Profil & XP',
    emoji: '📈',
    color: 0xEB459E,
    commands: [
      { label: '!niveau [@membre]',              description: 'Niveau XP et barre de progression',                               subs: [] },
      { label: '!progression [@membre]',         description: 'Progression XP détaillée : barre, XP restant, activité',         subs: [] },
      { label: '!topactivite [N]',               description: 'Top N membres les plus actifs par XP (activité récente)',         subs: [] },
      { label: '!classniveau',                   description: 'Classement XP Top 10 du serveur',                                subs: [] },
      { label: '!classxp',                       description: 'Alias de !classniveau — classement XP',                          subs: [] },
      { label: '!infoutilisateur [@membre]',     description: 'Infos Discord d\'un membre : niveau, rôles, sanctions',          subs: [] },
      { label: '!inforole @role',                description: 'Détails d\'un rôle Discord (membres, permissions, couleur)',     subs: [] },
      { label: '!infoserveur',                   description: 'Informations générales sur le serveur (membres, salons, boosts)', subs: [] },
      { label: '!ping',                          description: 'Latence du bot et de l\'API',                                     subs: [] },
      { label: '!statut',                        description: 'Statut du bot et aperçu des tournois en cours',                  subs: [] },
      { label: '!tempsenligne',                  description: 'Temps de fonctionnement du bot depuis le dernier démarrage',     subs: [] },
      { label: '!commandes',                     description: 'Classement des commandes les plus utilisées sur le serveur',     subs: [] },
      { label: '!memoire',                       description: 'Utilisation mémoire (RAM) du bot en temps réel (Staff)',        subs: [] },
      { label: '!donnerxp @membre <quantité>',   description: 'Donner de l\'XP à un membre (Staff)',                            subs: [] },
      { label: '!retirerxp @membre <qté>',       description: 'Retirer de l\'XP à un membre (Staff)',                           subs: [] },
      { label: '!niveau reinitialiser @membre',  description: 'Remettre XP et niveau d\'un membre à zéro (Staff)',              subs: [] },
    ],
  },
  {
    id: 'ia',
    label: 'Intelligence Artificielle',
    emoji: '🤖',
    color: 0x5865F2,
    commands: [
      { label: '!ia <question>',                  description: 'Poser une question libre à l\'IA SUPREMYX',                    subs: [] },
      { label: '!ia analyser <équipe>',           description: 'Analyse IA complète d\'une équipe',                            subs: ['analyser <équipe> — Analyse complète'] },
      { label: '!ia predire <T1> vs <T2>',        description: 'Prédiction IA pour un affrontement',                          subs: ['predire <T1> vs <T2> — Prédiction de match'] },
      { label: '!ia conseil',                     description: 'Conseil coaching personnalisé par l\'IA',                     subs: [] },
      { label: '!ia resume <équipe>',             description: 'Résumé IA des performances d\'une équipe',                    subs: ['resume <équipe> — Résumé'] },
      { label: '!ia rapport <joueur>',            description: 'Rapport IA complet d\'un joueur',                             subs: ['rapport <joueur> — Rapport détaillé'] },
      { label: '!ia entrainement <équipe>',       description: 'Plan d\'entraînement IA pour une équipe (1 semaine)',         subs: ['entrainement <équipe> — Programme adapté aux stats'] },
      { label: '!ia strategie <monEq> vs <adv>',  description: 'Stratégie IA pour battre une équipe adverse',                subs: ['strategie <mon équipe> vs <adversaire> — Plan tactique'] },
      { label: '!ia bilan',                       description: 'Bilan hebdomadaire automatique (stats + analyse IA, chaque dimanche 20h30)', subs: ['(sans arg) — Afficher le statut (salon configuré, dernier envoi)', 'salon #salon — Configurer le salon de réception (Admin)', 'maintenant — Envoyer le bilan immédiatement (Admin)', 'désactiver — Désactiver l\'envoi automatique (Admin)'] },
      { label: '!ia depistage <joueur>',           description: 'Fiche de dépistage IA d\'un joueur',                          subs: ['depistage <joueur> — Rapport recrutement IA'] },
      { label: '!ia debrief <équipe>',             description: 'Débrief post-match IA : résultat, forces, faiblesses, objectifs', subs: ['debrief <équipe> — Analyse du dernier match', 'debrief salon #salon — Configurer le canal auto *(Admin)*', 'debrief desactiver — Désactiver le débrief auto *(Admin)*', 'debrief statut — Voir la configuration'] },
      { label: '!ia historique',                  description: 'Historique de la conversation IA personnelle',                subs: [] },
      { label: '!ia reinitialiser',               description: 'Réinitialiser sa conversation IA',                            subs: [] },
      { label: '!ia modeles',                     description: 'Liste des modèles IA disponibles',                            subs: [] },
      { label: '!ia statistiques',                description: 'Statistiques d\'utilisation de l\'IA sur le serveur',         subs: [] },
      { label: '!ia quota',                       description: 'Consulter le quota IA journalier restant',                    subs: [] },
      { label: '!ia modele <alias>',              description: 'Changer le modèle IA actif (Staff)',                          subs: ['modele <alias> — Changer de modèle', 'modeles — Voir tous les modèles disponibles'] },
      { label: '!ia quota <valeur>',              description: 'Gérer le quota d\'utilisations IA journalier (Staff)',        subs: ['quota <nombre> — Fixer la limite', 'quota off — Désactiver (illimité)', 'quota reset — Remettre le compteur à zéro', 'quota salon #salon — Salon d\'alerte'] },
      { label: '!ia basculement',                 description: 'Tester tous les modèles en temps réel (latence + disponibilité)', subs: [] },
    ],
  },
  {
    id: 'calendrier',
    label: 'Calendrier & Événements',
    emoji: '📅',
    color: 0xFEE75C,
    commands: [
      { label: '!calendrier',                description: 'Liste les prochains matchs planifiés',                                subs: ['prochain — Voir le prochain match', 'equipe <nom> — Matchs d\'une équipe'] },
      { label: '!calendrier prochain',       description: 'Affiche uniquement le prochain match',                               subs: [] },
      { label: '!calendrier equipe <nom>',   description: 'Matchs à venir d\'une équipe spécifique',                          subs: [] },
      { label: '!evenement liste',           description: 'Voir et rejoindre les événements en cours',                          subs: ['liste — Voir les événements', 'joindre <id> — S\'inscrire', 'quitter <id> — Décliner', 'participants <id> — Voir participants'] },
      { label: '!rappel <durée> <texte>',    description: 'Se créer un rappel personnel (ex : 1h Match ce soir)',               subs: [] },
      { label: '!messagejour',               description: 'Afficher le message du jour configuré par le staff',                subs: [] },
      { label: '!evenement creer',           description: 'Créer un événement RSVP avec réactions ✅/❌ (Staff)',               subs: ['creer <titre> | <desc> | <date> — Créer', 'annuler <id> — Annuler un événement'] },
      { label: '!configmdj <texte>',         description: 'Définir le message du jour automatique (Staff)',                     subs: [] },
      { label: '!infolettre salon #salon',   description: 'Infolettre hebdo automatique chaque dimanche 20h (Staff)',          subs: ['salon #salon — Configurer', 'activer|desactiver — Toggle', 'tester — Envoyer maintenant', 'statut — Voir config'] },
      { label: '!calendrier salon #salon',   description: 'Configurer les rappels de matchs (Staff)',                           subs: ['salon #salon — Salon rappels', 'rappel <activer|desactiver> [24h|1h|15m] — Toggle', 'statut — Voir config', 'ajouter <DD/MM/YYYY> <HH:MM> <eq1,eq2> — Ajouter match', 'modifier <id> <DD/MM/YYYY> <HH:MM> — Modifier', 'supprimer <id> — Supprimer', 'vider — Supprimer passés'] },
    ],
  },
  {
    id: 'outils',
    label: 'Outils & Utilitaires',
    emoji: '🛠️',
    color: 0x57F287,
    commands: [
      { label: '!chercher <terme>',              description: 'Rechercher une commande par mot-clé',                             subs: [] },
      { label: '!repertoire',                    description: 'Répertoire paginé de toutes les commandes du bot (vue compacte)',  subs: [] },
      { label: '!absent [message]',              description: 'Passer en mode AFK (bot répond à ta place)',                      subs: [] },
      { label: '!anniversaire definir <JJ/MM>',  description: 'Enregistrer sa date d\'anniversaire',                            subs: ['definir <JJ/MM[/AAAA]> — Enregistrer', 'supprimer — Supprimer', 'liste — Voir tous les anniversaires', 'prochains [N] — Anniversaires dans les N prochains jours', 'verifier [@user] — Vérifier la date'] },
      { label: '!rebours <date> [événement]',    description: 'Compte à rebours jusqu\'à une date (ex : 25/12/2026 Noël)',      subs: [] },
      { label: '!tirageteam [T1,T2,...]',        description: 'Tirage au sort aléatoire d\'équipes 2 par 2',                     subs: [] },
      { label: '!pileface',                      description: 'Lancer une pièce (pile ou face)',                                 subs: [] },
      { label: '!lienbot',                       description: 'Obtenir le lien d\'invitation du bot',                           subs: [] },
    ],
  },
  {
    id: 'communaute',
    label: 'Communauté',
    emoji: '📬',
    color: 0xEB459E,
    commands: [
      { label: '!suggestion <texte>',       description: 'Envoyer une suggestion anonyme au staff',                             subs: [] },
      { label: '!signaler <problème>',      description: 'Signaler un problème ou un membre au staff',                          subs: [] },
      { label: '!ticket [type]',            description: 'Ouvrir un ticket de support',                                         subs: ['support — Ticket technique', 'signalement — Signaler un membre', 'candidature — Postuler au staff'] },
      { label: '!sanctions [@membre]',      description: 'Voir ses propres sanctions actives',                                  subs: [] },
      { label: '!avertissements',           description: 'Voir l\'historique complet de ses avertissements',                   subs: [] },
      { label: '!regles',                   description: 'Afficher les règles simples du serveur',                              subs: [] },
      { label: '!reglement',               description: 'Afficher le règlement avancé du serveur (sections détaillées)',        subs: [] },
      { label: '!sondage historique',       description: 'Voir l\'historique des sondages terminés sur le serveur',             subs: ['historique — Lister les sondages passés', 'stats — Statistiques globales des sondages'] },
      { label: '!listenoiree liste',        description: 'Consulter la liste noire des équipes et joueurs bannis',                  subs: ['liste — Voir toutes les entrées', 'verifier <nom> — Vérifier si un nom est blacklisté'] },
    ],
  },
  {
    id: 'avance',
    label: 'Stats Avancées',
    emoji: '🔢',
    color: 0x5865F2,
    commands: [
      { label: '!serie <équipe>',               description: 'Série de victoires/défaites en cours d\'une équipe',             subs: [] },
      { label: '!regularite <équipe>',          description: 'Régularité des performances sur les derniers matchs',            subs: [] },
      { label: '!faceatface <T1> <T2>',         description: 'Historique face à face complet entre 2 équipes',                 subs: [] },
      { label: '!calculer <placement> <kills>', description: 'Simuler les points gagnés pour un placement et kills donnés',    subs: [] },
      { label: '!moyenne <équipe>',             description: 'Moyenne kills, points et placement sur tous les matchs',         subs: [] },
      { label: '!tendance <équipe>',            description: 'Tendance hausse/baisse des performances récentes',               subs: [] },
      { label: '!meilleurmatch <équipe>',       description: 'Meilleur match enregistré (kills, points, placement)',           subs: [] },
      { label: '!pirematch <équipe>',           description: 'Pire match enregistré pour une équipe',                         subs: [] },
      { label: '!resume',                       description: 'Résumé rapide du tournoi en cours (top 3 + derniers matchs)',    subs: [] },
      { label: '!prediction <T1> vs <T2>',      description: 'Prédiction statistique de victoire entre deux équipes',         subs: [] },
      { label: '!podium',                       description: 'Top 3 équipes au classement général de points',                  subs: [] },
      { label: '!vainqueurs',                   description: 'Historique des vainqueurs : tournois et saisons passées',         subs: [] },
      { label: '!prochainmatch',                description: 'Prochain match du tournoi actif',                               subs: [] },
    ],
  },
  // ══ COMMANDES STAFF ════════════════════════════════════════════════════════
  {
    id: 'communication',
    label: 'Communication',
    emoji: '📢',
    color: 0xFEE75C,
    commands: [
      { label: '!annonce <message>',          description: 'Envoyer une annonce dans le salon configuré (Staff)',                subs: [] },
      { label: '!dire <message>',             description: 'Faire parler le bot dans le salon courant (Staff)',                 subs: [] },
      { label: '!vote <question>',            description: 'Sondage rapide oui/non par réactions (Staff)',                      subs: [] },
      { label: '!sondage <durée> <question> | <opt1> | <opt2>', description: 'Sondage immédiat avec options multiples et résultats auto (Staff)', subs: [
        'programmer <question> | <opt1> | ... | <durée> | <JJ/MM HH:MM> — Programmer',
        'planifie liste — Voir tous les sondages programmés',
        'planifie annuler <n°> — Annuler un sondage programmé',
      ] },
      { label: '!concours <durée> <prix>',    description: 'Lancer un giveaway avec réaction 🎉 (Staff)',                       subs: [] },
      { label: '!retirer <messageId>',        description: 'Reroll d\'un giveaway — tirer un nouveau gagnant (Staff)',          subs: [] },
      { label: '!configsuggestion #salon',    description: 'Configurer le salon de réception des suggestions (Staff)',          subs: [] },
      { label: '!acceptersugg <id> [note]',   description: 'Accepter une suggestion et notifier l\'auteur (Staff)',             subs: [] },
      { label: '!rejetersugg <id> [note]',    description: 'Rejeter une suggestion avec note facultative (Staff)',              subs: [] },
      { label: '!diffuser <message>',         description: 'Diffuser un message dans plusieurs salons configurés (Staff)',      subs: ['ajouter #salon — Ajouter un salon', 'retirer #salon — Retirer un salon', 'liste — Voir les salons', 'aperçu — Prévisualiser le message'] },
      { label: '!planifier creer',            description: 'Créer un message planifié récurrent ou ponctuel (Staff)',           subs: ['creer — Créer', 'liste — Voir messages', 'supprimer <id> — Supprimer', 'modifier <id> — Modifier', 'dupliquer <id> — Dupliquer', 'pause <id> — Mettre en pause', 'tester <id> — Tester maintenant'] },
      { label: '!notifequipe <équipe> | <message>', description: 'Envoyer un DM à tous les membres Discord du roster (Staff)', subs: [] },
      { label: '!mp @membre <message>',       description: 'Envoyer un DM privé via le bot à un membre (Staff)',               subs: [] },
      { label: '!embed envoyer [aperçu] #salon | Titre | Desc | couleur', description: 'Publier un embed dans un salon (Staff)', subs: ['envoyer ici | Titre | Desc | couleur — Dans le salon courant'] },
      { label: '!embed boutons [aperçu] #salon | Titre | Desc | Texte >> https://...', description: 'Embed avec boutons URL cliquables max 5 (Staff)', subs: ['boutons aperçu | … — Prévisualiser avant publication'] },
      { label: '!embed avancé Titre | Desc | couleur | image | footer', description: 'Embed riche avec image et footer dans le salon courant (Staff)', subs: [] },
      { label: '!embed riche #salon | Titre | Desc | couleur | image | thumbnail | auteur', description: 'Embed complet : thumbnail, auteur, image, liens hypertextes (Staff)', subs: ['riche aperçu | #salon | ... — Prévisualiser avant publication', 'riche modifier #salon | ID | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer — Éditer un embed riche existant (`-` pour garder un champ)'] },
      { label: '!embed liste [#salon]',       description: 'Lister les embeds publiés par le bot dans un salon (Staff)',        subs: [] },
      { label: '!embed modifier #salon | ID | Titre | Desc', description: 'Modifier un embed simple déjà publié par le bot (Staff)',   subs: ['modifier ici | ID | Titre | Desc | couleur — Dans le salon courant'] },
      { label: '!embed supprimer #salon | ID_message', description: 'Supprimer un embed publié (confirmation requise) (Staff)', subs: ['supprimer ici | ID_message — Dans le salon courant'] },
      { label: '!embed cloner #salon | ID | #salon_dest', description: 'Dupliquer un embed existant vers un autre salon (Staff)', subs: [] },
      { label: '!embed programmer #salon | Titre | Desc | couleur | YYYY-MM-DD HH:MM', description: 'Programmer la publication d\'un embed à une date précise (Staff)', subs: [] },
      { label: '!embed programmes',           description: 'Voir tous les embeds programmés en attente (Staff)',                subs: [] },
      { label: '!embed déprogrammer <id>',    description: 'Annuler un embed programmé avant sa publication (Staff)',           subs: [] },
      { label: '!embedplus',                  description: 'Constructeur d\'embed interactif étape par étape via boutons (Staff)',  subs: [] },
    ],
  },
  {
    id: 'config',
    label: 'Config Serveur',
    emoji: '⚙️',
    color: 0x5865F2,
    commands: [
      { label: '!config',                       description: 'Voir/modifier la configuration générale du bot (Staff)',          subs: [] },
      { label: '!voirconfig',                   description: 'Vue d\'ensemble de toute la configuration serveur (Staff)',       subs: [] },
      { label: '!definitpoints <placement>',    description: 'Configurer le barème de points par placement (Staff)',            subs: [] },
      { label: '!bienvenue definir',            description: 'Configurer le message de bienvenue automatique (Staff)',          subs: ['definir <message> — Définir message', 'salon #salon — Salon', 'tester — Tester', 'activer / desactiver — Toggle'] },
      { label: '!rolesauto definir @role',      description: 'Configurer le rôle automatique donné à l\'arrivée (Staff)',      subs: ['definir @role — Définir rôle', 'activer / desactiver — Toggle'] },
      { label: '!rolereaction ajouter',         description: 'Configurer les reaction-roles (Staff)',                           subs: ['ajouter #salon <msgId> <emoji> @role — Ajouter', 'retirer <msgId> <emoji> — Supprimer', 'liste — Voir tout', 'vider <msgId> — Vider message'] },
      { label: '!salonanniversaires #salon',    description: 'Définir le salon des annonces d\'anniversaire (Staff)',           subs: [] },
      { label: '!salonniveaux #salon',          description: 'Définir le salon des montées de niveau XP (Staff)',               subs: [] },
      { label: '!salonannonce #salon',          description: 'Définir le salon d\'annonces du bot (Staff)',                     subs: [] },
      { label: '!salonjournaux #salon',         description: 'Définir le salon de journaux staff (Staff)',                      subs: [] },
      { label: '!salonsoumissionlogos #salon',  description: 'Définir le salon où les équipes déposent leur logo via %logo (Staff)', subs: [] },
      { label: '!salonaffichagelogos [#salon]', description: 'Voir les logos soumis dans un salon (Staff)',                    subs: [] },
      { label: '%logo <équipe>',               description: 'Commande publique — les membres soumettent leur logo dans le salon configuré (image requise)', subs: [] },
      { label: '!configdelai <commande> <sec>', description: 'Modifier le cooldown d\'une commande (Staff)',                   subs: ['delais — Voir tous les cooldowns', 'supprimerdelai <commande> — Réinitialiser'] },
      { label: '!note <équipe> <texte>',        description: 'Note interne sur une équipe visible seulement par le staff (Staff)', subs: ['note <équipe> <texte> — Ajouter', 'notes <équipe> — Voir', 'supprimenote <id> — Supprimer'] },
    ],
  },
  {
    id: 'moderation',
    label: 'Modération',
    emoji: '🛡️',
    color: 0xED4245,
    commands: [
      { label: '!effacer <1-100>',             description: 'Supprimer en masse des messages (Staff)',                          subs: [] },
      { label: '!lenteur <0-21600>',           description: 'Activer le mode lent en secondes (Staff)',                        subs: [] },
      { label: '!sourdine @membre <durée>',    description: 'Mettre un membre en sourdine (Staff)',                             subs: [] },
      { label: '!retablir @membre',            description: 'Retirer la sourdine d\'un membre (Staff)',                        subs: [] },
      { label: '!verrouiller',                 description: 'Verrouiller le salon pour @everyone (Staff)',                      subs: [] },
      { label: '!deverrouiller',               description: 'Déverrouiller le salon (Staff)',                                   subs: [] },
      { label: '!avertir @membre <raison>',    description: 'Avertir un membre avec escalade automatique (Staff)',              subs: [] },
      { label: '!supprimerwarn @membre [id]',  description: 'Retirer un avertissement précis ou le dernier (Staff)',            subs: [] },
      { label: '!avertissements @membre',      description: 'Voir l\'historique complet des warns d\'un membre (Staff)',        subs: [] },
      { label: '!punition @membre <type>',     description: 'Sanction directe : warn / mute / kick / ban (Staff)',             subs: [] },
      { label: '!sanctions @membre',           description: 'Voir le casier complet d\'un membre (Staff)',                      subs: [] },
      { label: '!casier @membre',              description: 'Casier judiciaire détaillé avec historique complet (Staff)',       subs: [] },
      { label: '!effaceractions @membre',      description: 'Effacer toutes les sanctions d\'un membre (Staff)',                subs: [] },
      { label: '!rapport',                     description: 'Rapport hebdomadaire de modération (Staff)',                       subs: [] },
      { label: '!topavertissements',           description: 'Top 10 membres les plus sanctionnés (Staff)',                      subs: [] },
    ],
  },
  {
    id: 'escalade',
    label: 'Escalade & Filtres',
    emoji: '⚖️',
    color: 0xED4245,
    commands: [
      { label: '!escalade',                    description: 'Voir/configurer les règles d\'escalade automatique (Staff)',       subs: ['activer / desactiver — Toggle', 'configurer <warns> <action> [durée] — Configurer règle', 'supprimer <warns> — Supprimer règle', 'reinitialiser — Réinitialiser'] },
      { label: '!listenoiree ajouter <nom>',   description: 'Gérer la blacklist des pseudos interdits (Staff)',                subs: ['ajouter <nom> — Ajouter', 'retirer <nom> — Retirer', 'liste — Voir', 'verifier <nom> — Vérifier'] },
      { label: '!automod activer',             description: 'Activer/désactiver le filtre automatique de mots (Staff)',        subs: ['activer / desactiver — Toggle', 'statut — Voir statut', 'test <texte> — Tester'] },
      { label: '!mots ajouter <mot>',          description: 'Gérer les mots interdits dans le filtre (Staff)',                 subs: ['ajouter <mot> — Ajouter', 'retirer <mot> — Retirer', 'defaut — Restaurer défaut', 'vider — Tout supprimer'] },
      { label: '!antispam activer',            description: 'Configurer l\'anti-spam contre le flood (Staff)',                  subs: ['activer / desactiver — Toggle', 'configurer <msgs> <secondes> — Configurer seuils'] },
    ],
  },
  {
    id: 'tickets',
    label: 'Tickets & Règlement',
    emoji: '🎫',
    color: 0x57F287,
    commands: [
      { label: '!ticket panneau',               description: 'Afficher le panneau d\'ouverture des tickets (Staff)',           subs: [] },
      { label: '!tickets',                      description: 'Voir tous les tickets ouverts (Staff)',                           subs: [] },
      { label: '!prendre',                      description: 'Prendre en charge le ticket actuel (Staff)',                      subs: [] },
      { label: '!resoudre',                     description: 'Marquer le ticket actuel comme résolu (Staff)',                   subs: [] },
      { label: '!fermer',                       description: 'Fermer le ticket actuel (Staff)',                                 subs: [] },
      { label: '!ajouteruser @membre',          description: 'Ajouter un membre au ticket courant (Staff)',                     subs: [] },
      { label: '!retireruser @membre',          description: 'Retirer un membre du ticket courant (Staff)',                     subs: [] },
      { label: '!renommerticket <titre>',       description: 'Renommer le salon du ticket (Staff)',                             subs: [] },
      { label: '!configticket rolstaff',        description: 'Configurer le système de tickets (Staff)',                        subs: ['rolstaff @role — Rôle staff', 'transcription #salon — Salon transcriptions', 'categorie <id> — Catégorie Discord'] },
      { label: '!reglement titre <texte>',      description: 'Configurer le règlement avancé par sections (Staff)',             subs: ['titre <texte> — Titre', 'intro <texte> — Introduction', 'section <nom> — Ajouter section', 'ajouter <section> <texte> — Règle', 'modifier <section> <num> <texte> — Modifier', 'supprimer <section> <num> — Supprimer', 'publier — Publier', 'actualiser — Mettre à jour', 'reinitialiser — Réinitialiser'] },
      { label: '!ajouterregle <texte>',         description: 'Ajouter une règle simple au règlement du serveur (Staff)',        subs: ['ajouterregle <texte> — Ajouter', 'modifierregle <num> <texte> — Modifier', 'supprimerregle <num> — Supprimer', 'deplacerregle <de> <vers> — Déplacer', 'effacerregles — Tout supprimer', 'setregles — Config salon+auteur'] },
    ],
  },
  {
    id: 'systeme',
    label: 'Système & Logs',
    emoji: '🔧',
    color: 0x5865F2,
    commands: [
      { label: '!rapporthebdo salon #salon',  description: 'Configurer et gérer le rapport hebdomadaire automatique (Staff)',  subs: ['salon #salon — Configurer le salon', 'activer — Activer l\'envoi chaque dimanche 20h', 'desactiver — Désactiver', 'tester — Envoyer un aperçu maintenant', 'statut — Voir la configuration'] },
      { label: '!aidestaff nouveautes',      description: 'Voir les 10 fichiers de commandes modifiés le plus récemment (Staff)', subs: [] },
      { label: '!chercher staff <terme>',     description: 'Rechercher une commande staff par mot-clé (Staff)',                subs: [] },
      { label: '!statsbot',                   description: 'Statistiques globales d\'utilisation du bot (Staff)',              subs: [] },
      { label: '!journaux',                   description: 'Historique des actions staff avec filtres (Staff)',                subs: ['vider — Effacer tout', 'stats — Statistiques par catégorie', 'aujourdhui — Logs du jour', '<catégorie> [page] — Filtrer par catégorie', '<mot-clé> — Recherche plein texte'] },
      { label: '!journal [N]',                description: 'N derniers commits Git du dépôt (Staff)',                         subs: [] },
      { label: '!misesajour [N]',             description: 'N dernières mises à jour du bot sous forme de changelog (Staff)',   subs: [] },
      { label: '!tableaudebord',              description: 'Résumé en direct ou accès au tableau de bord web (Staff)',         subs: ['(sans arg) / maintenant — Poster le résumé en direct', 'lien — Lien vers le tableau de bord web', 'salon #salon — Configurer le salon d\'envoi automatique', 'auto activer / desactiver — Toggle de l\'envoi automatique', 'heure <0-23> — Heure UTC d\'envoi automatique', 'statut — Voir la configuration actuelle'] },
      { label: '!journauxadmin',              description: 'Journaux d\'administration avancés : modifications de config, suppressions critiques (Staff)', subs: ['(sans arg) / [page] — Parcourir tous les logs', 'statistiques — Stats par sévérité et catégorie', 'critique — 15 derniers logs critiques', 'utilisateur <id> — Logs d\'un utilisateur spécifique', 'vider — Effacer tous les logs admin (confirmation requise)', '<categorie> [page] — Filtrer : données / config / modération'] },
      { label: '!envoyergit',                 description: 'Pousser le code vers GitHub (Staff)',                              subs: [] },
      { label: '!statutgit',                  description: 'Voir le statut du dépôt Git (Staff)',                               subs: [] },
    ],
  },
  {
    id: 'erreurs',
    label: 'Erreurs & Maintenance',
    emoji: '🚨',
    color: 0xED4245,
    commands: [
      { label: '!erreurs',                       description: 'Consulter les dernières erreurs du bot (Staff)',                 subs: ['nonresolues — Erreurs non résolues', 'stats — Statistiques globales', 'resoudre <id> — Marquer résolue', 'vider — Effacer tout'] },
      { label: '!maintenance activer [message]', description: 'Activer le mode maintenance (bloque toutes les commandes) (Staff)', subs: ['activer [message] — Activer', 'desactiver — Désactiver', 'message <texte> — Changer message', 'statut — Voir état'] },
      { label: '!lienbot',                       description: 'Obtenir le lien d\'invitation du bot',                         subs: [] },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildMainEmbed() {
  return new EmbedBuilder()
    .setColor(0xED4245)
    .setAuthor({ name: 'SUPREMYX — Aide Staff' })
    .setDescription(
      '📖 Référence complète de **toutes** les commandes du bot — publiques et staff.\n' +
      'Les commandes marquées **(Staff)** requièrent la permission Administrateur.\n' +
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
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('staff_search')
        .setLabel('Rechercher')
        .setEmoji('🔍')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('staff_nouveautes')
        .setLabel('Nouveautés')
        .setEmoji('🆕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('staff_history')
        .setLabel('Historique')
        .setEmoji('📋')
        .setStyle(ButtonStyle.Secondary)
    )
  );
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

  // ─── !aidestaff historique ────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (!message.member) return;
      if (message.author.bot) return;
      if (message.content.trim() !== '!aidestaff historique') return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Commande réservée au staff.');

      const doc = await SearchHistory.findOne({
        userId: message.author.id,
        guildId: message.guild.id,
        type: 'staff',
      });
      const terms = doc?.terms?.slice().reverse() ?? [];

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: `📋 Historique staff · ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
        .setFooter({ text: 'SUPREMYX Esports · Staff · !aidestaff pour le menu complet' })
        .setTimestamp();

      if (!terms.length) {
        embed.setDescription('Aucune recherche staff enregistrée.\nUtilise `!chercher staff <terme>` ou le bouton 🔍 dans `!aidestaff`.');
      } else {
        embed.setDescription('Tes **5 dernières recherches staff** (la plus récente en premier) :');
        terms.forEach((t, i) => {
          const ts = Math.floor(new Date(t.at).getTime() / 1000);
          embed.addFields({ name: `#${i + 1} — ${t.term}`, value: `<t:${ts}:R>`, inline: true });
        });
      }

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[aidestaff historique]', err);
    }
  });

  // ─── !aidestaff nouveautes ────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (message.content.trim() !== '!aidestaff nouveautes') return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Commande réservée au staff.');

      const cd = checkCooldown(message.author.id, 'aidestaff_nouveautes', 15);
      if (cd) return replyCooldown(message, cd, 'aidestaff nouveautes');

      return message.channel.send({ embeds: [buildNouveautesStaffEmbed(client)] });
    } catch (err) {
      console.error('[aidestaff nouveautes]', err);
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

      saveSearchTerm(message.author.id, message.guild.id, term, 'staff').catch(() => {});

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
        const suggestions = findSimilar(term, STAFF_CATEGORIES);
        if (suggestions.length) {
          const suggestText = suggestions
            .map(({ cat, cmd }) => `• \`${cmd.label}\` *(${cat.emoji} ${cat.label})* — ${cmd.description}`)
            .join('\n');
          return message.reply(`🔍 Aucun résultat exact pour \`${term}\`.\n\n💡 **Peut-être voulais-tu dire :**\n${suggestText}`);
        }
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
      // ── Bouton nouveautés → embed éphémère ───────────────────────────────
      if (interaction.isButton() && interaction.customId === 'staff_nouveautes') {
        if (!interaction.member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '⛔ Staff uniquement.', ephemeral: true });
        }
        return interaction.reply({ ephemeral: true, embeds: [buildNouveautesStaffEmbed(client)] });
      }

      // ── Bouton historique → embed éphémère ───────────────────────────────
      if (interaction.isButton() && interaction.customId === 'staff_history') {
        if (!interaction.member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '⛔ Staff uniquement.', ephemeral: true });
        }
        const doc = await SearchHistory.findOne({
          userId: interaction.user.id,
          guildId: interaction.guildId,
          type: 'staff',
        });
        const terms = doc?.terms?.slice().reverse() ?? [];

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setAuthor({ name: `📋 Historique staff · ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setFooter({ text: 'SUPREMYX Esports · Staff · !aidestaff pour le menu complet' })
          .setTimestamp();

        if (!terms.length) {
          embed.setDescription('Aucune recherche staff enregistrée.\nClique sur 🔍 **Rechercher** pour commencer.');
        } else {
          embed.setDescription('Tes **5 dernières recherches staff** (la plus récente en premier) :');
          terms.forEach((t, i) => {
            const ts = Math.floor(new Date(t.at).getTime() / 1000);
            embed.addFields({ name: `#${i + 1} — ${t.term}`, value: `<t:${ts}:R>`, inline: true });
          });
        }

        return interaction.reply({ ephemeral: true, embeds: [embed] });
      }

      // ── Bouton recherche → ouvre la modal ────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'staff_search') {
        if (!interaction.member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '⛔ Staff uniquement.', ephemeral: true });
        }
        return interaction.showModal(
          new ModalBuilder()
            .setCustomId('staff_modal_search')
            .setTitle('🔍 Rechercher une commande staff')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('search_term')
                  .setLabel('Mot-clé (ex : inscription, sondage…)')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('Tape un mot-clé et appuie sur Envoyer')
                  .setMinLength(2)
                  .setMaxLength(50)
                  .setRequired(true)
              )
            )
        );
      }

      // ── Soumission de la modal de recherche ───────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId === 'staff_modal_search') {
        if (!interaction.member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '⛔ Staff uniquement.', ephemeral: true });
        }
        const term = interaction.fields.getTextInputValue('search_term').trim().toLowerCase();
        saveSearchTerm(interaction.user.id, interaction.guildId, term, 'staff').catch(() => {});

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
          const suggestions = findSimilar(term, STAFF_CATEGORIES);
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
            content: `🔍 Aucune commande staff trouvée pour **"${term}"**.\nEssaie un autre mot-clé ou consulte les catégories via \`!aidestaff\`.`,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setAuthor({ name: `🔍 Résultats pour "${term}" · Staff`, iconURL: client.user.displayAvatarURL() })
          .setDescription(`**${total}** résultat(s) dans ${results.length} catégorie(s) · 🔐 Staff uniquement`)
          .setFooter({ text: 'SUPREMYX Esports · < > obligatoire · [ ] optionnel · !aidestaff pour le menu complet' })
          .setTimestamp();

        for (const { cat, matches } of results) {
          const value = matches.map(cmd => `\`${cmd.label}\` — ${cmd.description}`).join('\n');
          embed.addFields({ name: `${cat.emoji} ${cat.label}`, value: value.slice(0, 1024), inline: false });
        }

        return interaction.reply({ ephemeral: true, embeds: [embed] });
      }

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
