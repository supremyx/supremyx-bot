const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

// ─── Catalogue complet des commandes non-staff ────────────────────────────────
const CMDS = [
  // Stats & Équipes
  { cmd: '!stats <équipe>',                   desc: 'Résumé des performances d\'une équipe',              cat: '📊 Stats & Équipes' },
  { cmd: '!infoequipe <équipe>',              desc: 'Fiche détaillée d\'une équipe',                      cat: '📊 Stats & Équipes' },
  { cmd: '!classement',                        desc: 'Classement général des équipes',                    cat: '📊 Stats & Équipes' },
  { cmd: '!top [N]',                           desc: 'Top N équipes (défaut : 10)',                        cat: '📊 Stats & Équipes' },
  { cmd: '!comparer <T1> vs <T2>',            desc: 'Comparer deux équipes face à face',                  cat: '📊 Stats & Équipes' },
  { cmd: '!historique <équipe>',              desc: 'Historique complet des matchs',                      cat: '📊 Stats & Équipes' },
  { cmd: '!matchs',                            desc: 'Statistiques globales de tous les matchs',           cat: '📊 Stats & Équipes' },
  { cmd: '!liste <équipe>',                   desc: 'Roster / composition d\'une équipe',                 cat: '📊 Stats & Équipes' },
  { cmd: '!composition <équipe>',             desc: 'Voir la composition détaillée d\'une équipe',        cat: '📊 Stats & Équipes' },
  { cmd: '!recherche <nom>',                  desc: 'Rechercher une équipe ou un joueur',                 cat: '📊 Stats & Équipes' },
  // Stats Joueurs
  { cmd: '!statsjoueur <nom>',                desc: 'Stats complètes d\'un joueur',                       cat: '👤 Stats Joueurs' },
  { cmd: '!matchjoueur <nom>',                desc: 'Historique des matchs d\'un joueur',                 cat: '👤 Stats Joueurs' },
  { cmd: '!classjoueurs',                      desc: 'Classement général des joueurs',                    cat: '👤 Stats Joueurs' },
  { cmd: '!classniveau',                       desc: 'Classement par niveau XP',                          cat: '👤 Stats Joueurs' },
  // Stats Avancées
  { cmd: '!serie <équipe>',                   desc: 'Série de victoires/défaites en cours',               cat: '📈 Stats Avancées' },
  { cmd: '!calculer <équipe>',                desc: 'Calcul avancé des performances',                     cat: '📈 Stats Avancées' },
  { cmd: '!regularite <équipe>',              desc: 'Indice de régularité sur les derniers matchs',       cat: '📈 Stats Avancées' },
  { cmd: '!faceatface <T1> <T2>',             desc: 'Bilan historique entre deux équipes',                cat: '📈 Stats Avancées' },
  // Tournois & Saisons
  { cmd: '!tournois',                          desc: 'Liste de tous les tournois',                        cat: '🏆 Tournois & Saisons' },
  { cmd: '!detailtournoi <nom>',              desc: 'Détails et classement d\'un tournoi',                cat: '🏆 Tournois & Saisons' },
  { cmd: '!inscrire <nom_équipe>',            desc: 'Inscrire son équipe à un tournoi',                   cat: '🏆 Tournois & Saisons' },
  { cmd: '!mvp',                               desc: 'MVP actuel (meilleur ratio kills)',                  cat: '🏆 Tournois & Saisons' },
  { cmd: '!mvpsaison',                         desc: 'MVP des saisons passées',                           cat: '🏆 Tournois & Saisons' },
  { cmd: '!saisons',                           desc: 'Historique et vainqueurs des saisons',              cat: '🏆 Tournois & Saisons' },
  { cmd: '!palmares',                          desc: 'Palmarès complet du serveur',                       cat: '🏆 Tournois & Saisons' },
  { cmd: '!trophees',                          desc: 'Tous les trophées décernés',                        cat: '🏆 Tournois & Saisons' },
  { cmd: '!recompenses',                       desc: 'Voir les rôles attribués par rang',                 cat: '🏆 Tournois & Saisons' },
  // Niveau & Profil
  { cmd: '!niveau',                            desc: 'Ton niveau XP et ta progression',                   cat: '📊 Niveau & Profil' },
  { cmd: '!infouser [@user]',                 desc: 'Infos, niveau et avertissements d\'un membre',       cat: '📊 Niveau & Profil' },
  { cmd: '!infoserveur',                       desc: 'Informations sur le serveur Discord',               cat: '📊 Niveau & Profil' },
  { cmd: '!inforole @role',                   desc: 'Détails techniques d\'un rôle',                      cat: '📊 Niveau & Profil' },
  { cmd: '!ping',                              desc: 'Latence du bot et de l\'API Discord',               cat: '📊 Niveau & Profil' },
  { cmd: '!statut',                            desc: 'Statut du bot et aperçu des tournois actifs',       cat: '📊 Niveau & Profil' },
  // IA
  { cmd: '!ia <question>',                    desc: 'Poser une question à l\'IA SUPREMYX',                cat: '🤖 Intelligence Artificielle' },
  { cmd: '!ia réinitialiser',                 desc: 'Effacer son historique de conversation IA',          cat: '🤖 Intelligence Artificielle' },
  { cmd: '!ia modeles',                        desc: 'Voir les modèles IA disponibles et l\'actuel',      cat: '🤖 Intelligence Artificielle' },
  { cmd: '!ia statistiques',                  desc: 'Statistiques d\'utilisation de l\'IA',               cat: '🤖 Intelligence Artificielle' },
  // Outils
  { cmd: '!rappel <durée> <texte>',           desc: 'Créer un rappel (ex : !rappel 2h match ce soir)',    cat: '🛠️ Outils & Utilitaires' },
  { cmd: '!absent [message]',                  desc: 'Passer en mode AFK (les mentions notifient)',        cat: '🛠️ Outils & Utilitaires' },
  { cmd: '!anniversaire définir JJ/MM[/AAAA]',desc: 'Enregistrer sa date d\'anniversaire',               cat: '🛠️ Outils & Utilitaires' },
  { cmd: '!anniversaire liste',                desc: 'Voir les anniversaires du serveur',                  cat: '🛠️ Outils & Utilitaires' },
  { cmd: '!anniversaire vérifier [@user]',    desc: 'Vérifier l\'anniversaire d\'un membre',              cat: '🛠️ Outils & Utilitaires' },
  { cmd: '!pileface',                          desc: 'Lancer une pièce (pile ou face)',                    cat: '🛠️ Outils & Utilitaires' },
  { cmd: '!tirageteam <@u1> <@u2> ...',       desc: 'Tirer des équipes aléatoires',                       cat: '🛠️ Outils & Utilitaires' },
  { cmd: '!messagejour',                       desc: 'Voir le message du jour posté par le bot',          cat: '🛠️ Outils & Utilitaires' },
  // Communauté
  { cmd: '!suggestion <texte>',               desc: 'Envoyer une suggestion au staff',                    cat: '📬 Communauté & Tickets' },
  { cmd: '!signaler <problème>',              desc: 'Signaler un problème anonymement',                   cat: '📬 Communauté & Tickets' },
  { cmd: '!ticket [support|signalement|candidature]', desc: 'Ouvrir un ticket',                          cat: '📬 Communauté & Tickets' },
  { cmd: '!fermer',                            desc: 'Fermer son ticket en cours',                        cat: '📬 Communauté & Tickets' },
  { cmd: '!vote <question> | <opt1> | <opt2>',desc: 'Participer / créer un vote',                        cat: '📬 Communauté & Tickets' },
  { cmd: '!sanctions [@user]',                desc: 'Voir ses sanctions (ou celles d\'un membre)',         cat: '📬 Communauté & Tickets' },
  { cmd: '!avertissements [@user]',           desc: 'Voir l\'historique des avertissements',              cat: '📬 Communauté & Tickets' },
  // Règles
  { cmd: '!regles',                            desc: 'Afficher les règles du serveur',                    cat: '📋 Règles du serveur' },
  { cmd: '!règlement',                         desc: 'Afficher le règlement interactif complet',          cat: '📋 Règles du serveur' },
];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();
    if (content !== '!aide' && !content.startsWith('!aide ')) return;

    const cd = checkCooldown(message.author.id, 'aide', 10);
    if (cd) return replyCooldown(message, cd, 'aide');

    const query = content.slice('!aide'.length).trim().toLowerCase();

    // ── Mode recherche ────────────────────────────────────────────────────────
    if (query) {
      const results = CMDS.filter(c =>
        c.cmd.toLowerCase().includes(query) ||
        c.desc.toLowerCase().includes(query) ||
        c.cat.toLowerCase().includes(query)
      );

      if (!results.length) {
        return message.reply(`🔍 Aucune commande trouvée pour **"${query}"**.\nTape \`!aide\` pour voir toutes les commandes.`);
      }

      // Regrouper par catégorie
      const byCategory = {};
      for (const r of results) {
        if (!byCategory[r.cat]) byCategory[r.cat] = [];
        byCategory[r.cat].push(`\`${r.cmd}\` — ${r.desc}`);
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

    // ── Mode aide complète ────────────────────────────────────────────────────
    const footer = { text: 'SUPREMYX Esports · Tape !aidestaff si tu es staff · !aide <terme> pour rechercher' };
    const color = 0xFF8C00;

    const embed1 = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'SUPREMYX — Aide générale', iconURL: client.user.displayAvatarURL() })
      .setDescription('Toutes les commandes disponibles pour la communauté.\n> 💡 Paramètres `< >` **obligatoires**, `[ ]` **optionnels**. Tape `!aide <terme>` pour filtrer.')
      .addFields(
        {
          name: '📊 Stats & Équipes',
          value: [
            '`!stats <équipe>` — Résumé des performances d\'une équipe',
            '`!infoequipe <équipe>` — Fiche détaillée d\'une équipe',
            '`!classement` — Classement général des équipes',
            '`!top [N]` — Top N équipes (défaut : 10)',
            '`!comparer <T1> vs <T2>` — Comparer deux équipes face à face',
            '`!historique <équipe>` — Historique complet des matchs',
            '`!matchs` — Statistiques globales de tous les matchs',
            '`!liste <équipe>` — Roster / composition d\'une équipe',
            '`!composition <équipe>` — Voir la composition détaillée',
            '`!recherche <nom>` — Rechercher une équipe ou un joueur',
          ].join('\n'),
          inline: false,
        },
        {
          name: '👤 Stats Joueurs',
          value: [
            '`!statsjoueur <nom>` — Stats complètes d\'un joueur',
            '`!matchjoueur <nom>` — Historique des matchs d\'un joueur',
            '`!classjoueurs` — Classement général des joueurs',
            '`!classniveau` — Classement par niveau XP',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📈 Stats Avancées',
          value: [
            '`!serie <équipe>` — Série de victoires/défaites en cours',
            '`!calculer <équipe>` — Calcul avancé des performances',
            '`!regularite <équipe>` — Indice de régularité sur les derniers matchs',
            '`!faceatface <T1> <T2>` — Bilan historique entre deux équipes',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🏆 Tournois & Saisons',
          value: [
            '`!tournois` — Liste de tous les tournois',
            '`!detailtournoi <nom>` — Détails et classement d\'un tournoi',
            '`!inscrire <nom_équipe>` — Inscrire son équipe à un tournoi',
            '`!mvp` — MVP actuel (meilleur ratio kills)',
            '`!mvpsaison` — MVP des saisons passées',
            '`!saisons` — Historique et vainqueurs des saisons',
            '`!palmares` — Palmarès complet du serveur',
            '`!trophees` — Tous les trophées décernés',
            '`!recompenses` — Voir les rôles attribués par rang',
          ].join('\n'),
          inline: false,
        }
      );

    const embed2 = new EmbedBuilder()
      .setColor(color)
      .addFields(
        {
          name: '📊 Niveau & Profil',
          value: [
            '`!niveau` — Ton niveau XP et ta progression',
            '`!infouser [@user]` — Infos, niveau et avertissements d\'un membre',
            '`!infoserveur` — Informations sur le serveur Discord',
            '`!inforole @role` — Détails techniques d\'un rôle',
            '`!ping` — Latence du bot et de l\'API Discord',
            '`!statut` — Statut du bot et aperçu des tournois actifs',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🤖 Intelligence Artificielle',
          value: [
            '`!ia <question>` — Poser une question à l\'IA SUPREMYX',
            '`!ia réinitialiser` — Effacer son historique de conversation IA',
            '`!ia modeles` — Voir les modèles IA disponibles et l\'actuel',
            '`!ia statistiques` — Statistiques d\'utilisation de l\'IA',
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛠️ Outils & Utilitaires',
          value: [
            '`!rappel <durée> <texte>` — Créer un rappel (ex : `!rappel 2h match ce soir`)',
            '`!absent [message]` — Passer en mode AFK (les mentions notifient l\'auteur)',
            '`!anniversaire définir JJ/MM[/AAAA]` — Enregistrer sa date d\'anniversaire',
            '`!anniversaire liste` — Voir les anniversaires du serveur',
            '`!anniversaire vérifier [@user]` — Vérifier l\'anniversaire d\'un membre',
            '`!pileface` — Lancer une pièce (pile ou face)',
            '`!tirageteam <@u1> <@u2> ...` — Tirer des équipes aléatoires',
            '`!messagejour` — Voir le message du jour posté par le bot',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📬 Communauté & Tickets',
          value: [
            '`!suggestion <texte>` — Envoyer une suggestion au staff',
            '`!signaler <problème>` — Signaler un problème anonymement',
            '`!ticket [support|signalement|candidature]` — Ouvrir un ticket',
            '`!fermer` — Fermer son ticket en cours',
            '`!vote <question> | <opt1> | <opt2>` — Participer / créer un vote',
            '`!sanctions [@user]` — Voir ses sanctions (ou celles d\'un membre)',
            '`!avertissements [@user]` — Voir l\'historique des avertissements',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📋 Règles du serveur',
          value: [
            '`!regles` — Afficher les règles du serveur',
            '`!règlement` — Afficher le règlement interactif complet',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter(footer)
      .setTimestamp();

    await message.channel.send({ embeds: [embed1] });
    await message.channel.send({ embeds: [embed2] });
  });
};
