/**
 * !lineup
 *   !lineup <équipe>                      — voir le lineup
 *   !lineup definir <équipe> <J1,J2,...>  — définir le lineup (staff)
 *   !lineup effacer <équipe>              — effacer (staff)
 *   !lineup liste                         — tous les lineups enregistrés (staff)
 */
const { EmbedBuilder } = require('discord.js');
const Lineup = require('../database/models/Lineup');
const Roster = require('../database/models/Roster');
const Team   = require('../database/models/Team');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex }    = require('../utils/lib');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild)                            return;
      if (message.author.bot)                        return;
      if (!message.content.startsWith('!lineup'))    return;
      if (!message.member)                           return;

      const content  = message.content.trim();
      const args     = content.slice('!lineup'.length).trim().split(/\s+/);
      const sub      = args[0]?.toLowerCase();
      const isStaff  = message.member.permissions.has('Administrator');

      // ── !lineup liste ─────────────────────────────────────────────────────
      if (sub === 'liste') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');

        const all = await Lineup.find({});
        if (!all.length) return message.reply('❌ Aucun lineup enregistré.');

        const embed = new EmbedBuilder()
          .setTitle('📋 Lineups enregistrés')
          .setColor(0x5865F2)
          .setDescription(
            all.map(l => `• **${l.team}** — ${l.players.length} joueur(s) : ${l.players.join(', ') || '—'}`).join('\n')
          )
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // ── !lineup effacer <équipe> ─────────────────────────────────────────
      if (sub === 'effacer') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');

        const teamName = args.slice(1).join(' ').trim();
        if (!teamName) return message.reply('Usage : `!lineup effacer <équipe>`');

        const deleted = await Lineup.findOneAndDelete({
          team: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') }
        });

        if (!deleted) return message.reply(`❌ Aucun lineup pour **${teamName}**.`);

        logStaffAction(client, `📋 **Lineup effacé** — **${deleted.team}** | Par : ${message.author.tag}`);
        return message.reply(`✅ Lineup de **${deleted.team}** effacé.`);
      }

      // ── !lineup definir <équipe> <J1,J2,...> ─────────────────────────────
      if (sub === 'definir' || sub === 'définir') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');

        const rest = args.slice(1).join(' ');
        const lastSpaceBeforeComma = rest.lastIndexOf(' ');
        const playersRaw = rest.split(' ').pop();
        const teamName   = rest.slice(0, rest.length - playersRaw.length).trim();

        if (!teamName || !playersRaw || !playersRaw.includes(',')) {
          return message.reply(
            '**Usage :** `!lineup definir <équipe> <Joueur1,Joueur2,...>`\n' +
            '**Exemple :** `!lineup definir TeamAlpha Kaarl,Yibu,Metz,Solo,Beyz`'
          );
        }

        const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } });
        if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable. Enregistre-la d'abord avec \`!enregistrer\`.`);

        const players = playersRaw.split(',').map(p => p.trim()).filter(Boolean);
        if (!players.length) return message.reply('❌ Indique au moins un joueur.');

        const lineup = await Lineup.findOneAndUpdate(
          { team: team.name },
          { team: team.name, players, updatedBy: message.author.tag },
          { upsert: true, new: true }
        );

        logStaffAction(client, `📋 **Lineup défini** — **${team.name}** : ${players.join(', ')} | Par : ${message.author.tag}`);

        const embed = new EmbedBuilder()
          .setTitle(`📋 Lineup — ${team.name}`)
          .setColor(0x57F287)
          .setDescription(players.map((p, i) => `**${i + 1}.** ${p}`).join('\n'))
          .setFooter({ text: `Défini par ${message.author.tag}` })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // ── !lineup <équipe> — voir ────────────────────────────────────────────
      const teamName = args.join(' ').trim();

      if (!teamName) {
        return message.reply(
          '**Commandes `!lineup` :**\n' +
          '`!lineup <équipe>` — Voir le lineup\n' +
          '`!lineup definir <équipe> <J1,J2,...>` — Définir le lineup *(staff)*\n' +
          '`!lineup effacer <équipe>` — Effacer le lineup *(staff)*\n' +
          '`!lineup liste` — Tous les lineups *(staff)*'
        );
      }

      const cd = checkCooldown(message.author.id, 'lineup', 5);
      if (cd) return replyCooldown(message, cd, 'lineup');

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      const lineup = await Lineup.findOne({ team: { $regex: new RegExp(`^${escapeRegex(team.name)}$`, 'i') } });

      const embed = new EmbedBuilder()
        .setTitle(`📋 Lineup — ${team.name}`)
        .setColor(0x5865F2)
        .setTimestamp();

      if (!lineup || !lineup.players.length) {
        embed.setDescription('*Aucun lineup défini pour cette équipe.*\nUtilise `!lineup definir <équipe> <J1,J2,...>` *(staff)*');
      } else {
        // Croiser avec le roster pour enrichir l'affichage
        const roster = await Roster.findOne({
          guildId: message.guild.id,
          teamName: { $regex: new RegExp(`^${escapeRegex(team.name)}$`, 'i') }
        });

        const lines = lineup.players.map((name, i) => {
          const rosterMember = roster?.members?.find(m =>
            m.displayName?.toLowerCase() === name.toLowerCase() ||
            m.userTag?.toLowerCase().startsWith(name.toLowerCase())
          );
          const mention = rosterMember?.userId ? `<@${rosterMember.userId}>` : `**${name}**`;
          const role    = rosterMember?.role ? ` — *${rosterMember.role}*` : '';
          return `**${i + 1}.** ${mention}${role}`;
        });

        embed.setDescription(lines.join('\n'));
        embed.setFooter({ text: `Mis à jour par ${lineup.updatedBy || '—'}` });
      }

      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[lineup]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
