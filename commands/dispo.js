const { EmbedBuilder } = require('discord.js');
const Disponibilite = require('../database/models/Disponibilite');
const Roster        = require('../database/models/Roster');
const Schedule      = require('../database/models/Schedule');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const STATUS_EMOJI = { oui: '✅', non: '❌', incertain: '⚠️' };
const STATUS_LABEL = { oui: 'Disponible', non: 'Indisponible', incertain: 'Incertain' };

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!dispo')) return;
      if (!message.member) return;

      const content = message.content.trim();
      const args    = content.slice('!dispo'.length).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const guildId = message.guild.id;
      const isStaff = message.member.permissions.has('Administrator');

      // ── !dispo oui|non|incertain [raison] ────────────────────────────────
      if (['oui', 'non', 'incertain'].includes(sub)) {
        const cd = checkCooldown(message.author.id, 'dispo', 10, message.guild?.id);
        if (cd) return replyCooldown(message, cd, 'dispo');

        const raison = args.slice(1).join(' ').trim();

        const rosterEntry = await Roster.findOne({ guildId, 'players.discordId': message.author.id });
        const teamName = rosterEntry?.team ?? null;

        await Disponibilite.findOneAndUpdate(
          { guildId, userId: message.author.id, scheduleId: null },
          { username: message.author.username, teamName, status: sub, raison, createdAt: new Date() },
          { upsert: true }
        );

        const emoji = STATUS_EMOJI[sub];
        return message.reply(`${emoji} Disponibilité enregistrée : **${STATUS_LABEL[sub]}**${raison ? ` — *${raison}*` : ''}\n> Équipe : **${teamName ?? 'Non assignée'}**`);
      }

      // ── !dispo match <scheduleId> <oui|non|incertain> ────────────────────
      if (sub === 'match') {
        const schedId = args[1];
        const status  = args[2]?.toLowerCase();
        if (!schedId || !['oui', 'non', 'incertain'].includes(status))
          return message.reply('Usage : `!dispo match <id_du_match> <oui|non|incertain>`\nTrouve l\'ID avec `!calendrier`.');

        const cd = checkCooldown(message.author.id, 'dispo-match', 10, message.guild?.id);
        if (cd) return replyCooldown(message, cd, 'dispo-match');

        const schedule = await Schedule.findById(schedId).catch(() => null);
        if (!schedule) return message.reply('❌ Match introuvable. Vérifie l\'ID avec `!calendrier`.');

        const rosterEntry = await Roster.findOne({ guildId, 'players.discordId': message.author.id });

        await Disponibilite.findOneAndUpdate(
          { guildId, userId: message.author.id, scheduleId: schedId },
          { username: message.author.username, teamName: rosterEntry?.team ?? null, status, raison: '', createdAt: new Date() },
          { upsert: true }
        );

        const teams = [schedule.team1, schedule.team2].filter(Boolean).join(' vs ');
        return message.reply(`${STATUS_EMOJI[status]} Disponibilité enregistrée pour **${teams}** : **${STATUS_LABEL[status]}**`);
      }

      // ── !dispo liste <équipe> ─────────────────────────────────────────────
      if (sub === 'liste') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');
        const teamName = args.slice(1).join(' ').trim();
        if (!teamName) return message.reply('Usage : `!dispo liste <équipe>`');

        const dispos = await Disponibilite.find({ guildId, teamName: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
          .sort({ createdAt: -1 });

        if (!dispos.length) return message.reply(`❌ Aucune disponibilité déclarée pour **${teamName}**.`);

        const byStatus = { oui: [], non: [], incertain: [] };
        for (const d of dispos) byStatus[d.status]?.push(d.username);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`📋 Disponibilités — ${teamName}`)
          .addFields(
            { name: '✅ Disponibles',  value: byStatus.oui.join(', ')       || '—', inline: false },
            { name: '❌ Indisponibles', value: byStatus.non.join(', ')       || '—', inline: false },
            { name: '⚠️ Incertains',   value: byStatus.incertain.join(', ')  || '—', inline: false },
          )
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !dispo voir ───────────────────────────────────────────────────────
      if (sub === 'voir' || !sub) {
        const dispo = await Disponibilite.findOne({ guildId, userId: message.author.id, scheduleId: null });
        if (!dispo) return message.reply('❌ Tu n\'as pas déclaré ta disponibilité. Utilise `!dispo oui|non|incertain [raison]`.');
        return message.reply(`${STATUS_EMOJI[dispo.status]} Ta disponibilité actuelle : **${STATUS_LABEL[dispo.status]}**${dispo.raison ? ` — *${dispo.raison}*` : ''}`);
      }

      // ── !dispo effacer (staff) ────────────────────────────────────────────
      if (sub === 'effacer') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');
        const mentioned = message.mentions.users.first();
        if (!mentioned) return message.reply('Usage : `!dispo effacer @membre`');
        await Disponibilite.deleteMany({ guildId, userId: mentioned.id });
        return message.reply(`✅ Disponibilités de **${mentioned.username}** effacées.`);
      }

      // ── !dispo résumé — vue globale serveur ───────────────────────────────
      if (sub === 'résumé' || sub === 'resume' || sub === 'résume') {
        if (!isStaff) return message.reply('⛔ Staff uniquement.');
        const allDispos = await Disponibilite.find({ guildId, scheduleId: null }).lean();
        if (!allDispos.length) return message.reply('📭 Aucune disponibilité déclarée pour le prochain match.');
        const groups = { oui: [], non: [], incertain: [] };
        for (const d of allDispos) {
          if (groups[d.status]) groups[d.status].push(`${d.username}${d.raison ? ` _(${d.raison})_` : ''}`);
        }
        const embed = new EmbedBuilder()
          .setTitle('📋 Résumé des disponibilités (prochain match)')
          .setColor(0x57F287)
          .addFields(
            { name: `✅ Disponibles (${groups.oui.length})`,      value: groups.oui.join('\n')       || '—', inline: false },
            { name: `❌ Indisponibles (${groups.non.length})`,     value: groups.non.join('\n')       || '—', inline: false },
            { name: `❓ Incertains (${groups.incertain.length})`,  value: groups.incertain.join('\n') || '—', inline: false },
          )
          .setFooter({ text: `${allDispos.length} déclaration(s) · Serveur complet` })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      return message.reply('**Sous-commandes :** `oui` · `non` · `incertain [raison]` · `match <id> <oui|non|incertain>` · `liste <équipe>` *(staff)* · `résumé` *(staff)* · `voir`');
    } catch (err) {
      console.error('[dispo]', err);
    }
  });
};
