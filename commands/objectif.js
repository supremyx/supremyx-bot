/**
 * !objectif <équipe>          — Voir l'objectif d'une équipe
 * !objectif definir <équipe> <texte>  — (staff) Définir l'objectif
 * !objectif supprimer <équipe>        — (staff) Supprimer l'objectif
 * !objectif liste                     — Voir tous les objectifs du serveur
 */
const { EmbedBuilder } = require('discord.js');
const TeamObjective = require('../database/models/TeamObjective');
const Team          = require('../database/models/Team');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex }    = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      const content = message.content.trim();
      if (!content.startsWith('!objectif')) return;
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const args    = content.split(' ').slice(1);
      const sub     = args[0]?.toLowerCase();
      const isStaff = message.member.permissions.has('Administrator');

      // ─── !objectif liste ────────────────────────────────────────────────────
      if (sub === 'liste') {
        const all = await TeamObjective.find({ guildId: message.guild.id });
        if (!all.length) return message.reply('📋 Aucun objectif d\'équipe défini sur ce serveur.');

        const embed = new EmbedBuilder()
          .setTitle('🎯 Objectifs des équipes')
          .setColor(0xFFA500)
          .setDescription(
            all.map(o => `**${o.teamName}** — ${o.objective}`).join('\n')
          )
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // ─── !objectif definir <équipe> <texte> ─────────────────────────────────
      if (sub === 'definir') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');

        const rest = args.slice(1).join(' ').trim();
        // Find team name by checking against known teams
        const allTeams = await Team.find({ guildId: message.guild.id });

        let matchedTeam = null;
        let objectiveText = '';

        // Try to match a team name from the start of the rest string
        for (const t of allTeams.sort((a, b) => b.name.length - a.name.length)) {
          if (rest.toLowerCase().startsWith(t.name.toLowerCase())) {
            matchedTeam   = t;
            objectiveText = rest.slice(t.name.length).trim();
            break;
          }
        }

        if (!matchedTeam || !objectiveText) {
          return message.reply(
            '**Usage :** `!objectif definir <nom_équipe> <objectif>`\n' +
            '**Exemple :** `!objectif definir TeamAlpha Finir dans le Top 3 de la saison`'
          );
        }

        await TeamObjective.findOneAndUpdate(
          { guildId: message.guild.id, teamName: matchedTeam.name },
          { objective: objectiveText, setBy: message.author.tag, updatedAt: new Date() },
          { upsert: true, new: true }
        );

        logStaffAction(client, `🎯 **Objectif** — **${matchedTeam.name}** : "${objectiveText}" | Par : ${message.author.tag}`);
        return message.reply(`✅ Objectif de **${matchedTeam.name}** mis à jour.`);
      }

      // ─── !objectif supprimer <équipe> ───────────────────────────────────────
      if (sub === 'supprimer') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');

        const teamName = args.slice(1).join(' ').trim();
        if (!teamName) return message.reply('Usage : `!objectif supprimer <nom_équipe>`');

        const deleted = await TeamObjective.findOneAndDelete({
          guildId:  message.guild.id,
          teamName: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') }
        });

        if (!deleted) return message.reply(`❌ Aucun objectif trouvé pour **${teamName}**.`);

        logStaffAction(client, `🗑️ **Objectif supprimé** — **${deleted.teamName}** | Par : ${message.author.tag}`);
        return message.reply(`✅ Objectif de **${deleted.teamName}** supprimé.`);
      }

      // ─── !objectif <équipe> — afficher ──────────────────────────────────────
      const teamName = args.join(' ').trim();

      if (!teamName) {
        return message.reply(
          '**Commandes `!objectif` :**\n' +
          '`!objectif <équipe>` — Voir l\'objectif d\'une équipe\n' +
          '`!objectif liste` — Voir tous les objectifs\n' +
          '`!objectif definir <équipe> <texte>` — Définir *(staff)*\n' +
          '`!objectif supprimer <équipe>` — Supprimer *(staff)*'
        );
      }

      const obj = await TeamObjective.findOne({
        guildId:  message.guild.id,
        teamName: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') }
      });

      const team = await Team.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') }
      });

      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const embed = new EmbedBuilder()
        .setTitle(`🎯 Objectif — ${team.name}`)
        .setColor(0xFFA500)
        .setDescription(
          obj
            ? `> ${obj.objective}`
            : '*Aucun objectif défini pour cette équipe.*'
        )
        .setFooter({
          text: obj
            ? `Défini par ${obj.setBy} · ${new Date(obj.updatedAt).toLocaleDateString('fr-FR')}`
            : 'Utilisez !objectif definir pour en définir un'
        })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[objectif]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
