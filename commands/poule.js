const { EmbedBuilder } = require('discord.js');
const Poule   = require('../database/models/Poule');
const Team    = require('../database/models/Team');
const Match   = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!poule')) return;
      if (!message.member) return;

      const content = message.content.trim();
      const args    = content.slice('!poule'.length).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const isStaff = message.member.permissions.has('Administrator');

      // ── !poule creer <Lettre: Eq1, Eq2, Eq3> ─────────────────────────────
      if (sub === 'creer' || sub === 'créer') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');
        const rest = content.slice(content.indexOf(sub) + sub.length).trim();
        const colonIdx = rest.indexOf(':');
        if (colonIdx === -1) return message.reply('Usage : `!poule creer <Lettre>: <Eq1, Eq2, ...>`\nEx : `!poule creer A: TeamAlpha, TeamBeta, TeamGamma`');

        const letter = rest.slice(0, colonIdx).trim().toUpperCase();
        const teamNames = rest.slice(colonIdx + 1).split(',').map(t => t.trim()).filter(Boolean);
        if (!letter || teamNames.length < 2) return message.reply('❌ Il faut au moins 2 équipes et une lettre de groupe (ex: A).');

        const tourn = await Tournament.findOne({ active: true });

        const existing = await Poule.findOne({ guildId: message.guild.id, letter });
        if (existing) {
          existing.teams = teamNames;
          if (tourn) existing.tournamentId = tourn._id.toString();
          await existing.save();
        } else {
          await Poule.create({
            guildId: message.guild.id,
            tournamentId: tourn ? tourn._id.toString() : null,
            letter,
            teams: teamNames,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setTitle(`🏟️ Groupe ${letter} créé`)
          .setDescription(teamNames.map((t, i) => `**${i + 1}.** ${t}`).join('\n'))
          .setFooter({ text: `Tournoi : ${tourn?.name ?? 'Aucun actif'} · !poule classement ${letter}` })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !poule liste ──────────────────────────────────────────────────────
      if (!sub || sub === 'liste') {
        const cd = checkCooldown(message.author.id, 'poule-liste', 5);
        if (cd) return replyCooldown(message, cd, 'poule-liste');

        const poules = await Poule.find({ guildId: message.guild.id }).sort({ letter: 1 });
        if (!poules.length) return message.reply('❌ Aucun groupe créé. Utilise `!poule creer <Lettre>: <Équipes>`.');

        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setTitle('🏟️ Groupes du tournoi')
          .setTimestamp();

        for (const p of poules) {
          embed.addFields({ name: `Groupe ${p.letter}`, value: p.teams.join('\n') || '—', inline: true });
        }
        return message.channel.send({ embeds: [embed] });
      }

      // ── !poule classement <Lettre> ────────────────────────────────────────
      if (sub === 'classement') {
        const cd = checkCooldown(message.author.id, 'poule-class', 5);
        if (cd) return replyCooldown(message, cd, 'poule-class');

        const letter = args[1]?.toUpperCase();
        if (!letter) return message.reply('Usage : `!poule classement <Lettre>`');

        const poule = await Poule.findOne({ guildId: message.guild.id, letter });
        if (!poule) return message.reply(`❌ Groupe **${letter}** introuvable.`);

        const stats = await Promise.all(poule.teams.map(async (teamName) => {
          const team = await Team.findOne({ name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
          const matchs = await Match.find({ team: teamName, ...(poule.tournamentId ? { tournamentId: poule.tournamentId } : {}) });
          const kills  = matchs.reduce((s, m) => s + m.kills, 0);
          const points = matchs.reduce((s, m) => s + m.points, 0);
          return { name: teamName, points, kills, matchs: matchs.length, wins: team?.wins ?? 0, losses: team?.losses ?? 0 };
        }));

        stats.sort((a, b) => b.points - a.points || b.kills - a.kills);

        const lines = stats.map((s, i) => `**#${i + 1}** ${s.name} — ${s.points} pts · ${s.kills} kills · ${s.matchs} matchs`);
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`📊 Classement — Groupe ${letter}`)
          .setDescription(lines.join('\n'))
          .setFooter({ text: '!poule resultat <Lettre> — voir les matchs' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !poule resultat <Lettre> ──────────────────────────────────────────
      if (sub === 'resultat' || sub === 'résultat') {
        const cd = checkCooldown(message.author.id, 'poule-res', 5);
        if (cd) return replyCooldown(message, cd, 'poule-res');

        const letter = args[1]?.toUpperCase();
        if (!letter) return message.reply('Usage : `!poule resultat <Lettre>`');

        const poule = await Poule.findOne({ guildId: message.guild.id, letter });
        if (!poule) return message.reply(`❌ Groupe **${letter}** introuvable.`);

        const matchs = await Match.find({
          team: { $in: poule.teams },
          ...(poule.tournamentId ? { tournamentId: poule.tournamentId } : {}),
        }).sort({ createdAt: -1 }).limit(30);

        if (!matchs.length) return message.reply(`❌ Aucun match enregistré pour le groupe **${letter}**.`);

        const lines = matchs.map(m => `**${m.team}** — #${m.placement} · ${m.kills} kills · ${m.points} pts`);
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`🎯 Résultats — Groupe ${letter}`)
          .setDescription(lines.join('\n'))
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !poule supprimer <Lettre> ─────────────────────────────────────────
      if (sub === 'supprimer') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');
        const letter = args[1]?.toUpperCase();
        if (!letter) return message.reply('Usage : `!poule supprimer <Lettre>`');
        const del = await Poule.findOneAndDelete({ guildId: message.guild.id, letter });
        if (!del) return message.reply(`❌ Groupe **${letter}** introuvable.`);
        return message.reply(`✅ Groupe **${letter}** supprimé.`);
      }

      return message.reply('**Sous-commandes :** `creer` · `liste` · `classement <Lettre>` · `resultat <Lettre>` · `supprimer <Lettre>`');
    } catch (err) {
      console.error('[poule]', err);
    }
  });
};
