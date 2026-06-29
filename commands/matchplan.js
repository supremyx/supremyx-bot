/**
 * !planifiermatch <équipe1> vs <équipe2> <date> [note]  — Planifier un match (Staff)
 * !planifiermatch liste                                  — Voir les matchs planifiés
 * !planifiermatch annuler <id>                           — Annuler un match planifié (Staff)
 * !rappelsmatch                                          — Voir les prochains matchs planifiés (public)
 */
const { EmbedBuilder } = require('discord.js');
const MatchPlan = require('../database/models/MatchPlan');

function parseDate(str) {
  // Formats : "25/06" "25/06/2026" "25/06 20:00" "25/06/2026 20:00"
  const now = new Date();
  const year = now.getFullYear();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const day   = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const yr    = m[3] ? parseInt(m[3], 10) : year;
  const hours = m[4] ? parseInt(m[4], 10) : 18;
  const mins  = m[5] ? parseInt(m[5], 10) : 0;
  const d = new Date(yr, month, day, hours, mins, 0);
  return isNaN(d.getTime()) ? null : d;
}

// Vérification des rappels — tourne toutes les minutes
function startReminderLoop(client) {
  setInterval(async () => {
    try {
      const now  = new Date();
      const in60 = new Date(now.getTime() + 61 * 60000);
      const in15 = new Date(now.getTime() + 16 * 60000);

      // Rappels 60 min
      const plans60 = await MatchPlan.find({
        status:    'pending',
        reminder60: false,
        scheduledAt: { $gte: now, $lte: in60 },
      }).lean();

      for (const p of plans60) {
        if (!p.channelId) continue;
        const ch = client.channels.cache.get(p.channelId);
        if (!ch) continue;
        const opponent = p.team2 || 'TBD';
        await ch.send(`⏰ **Rappel 60 min** — **${p.team1}** vs **${opponent}** commence dans ~1 heure !\n📋 Note : ${p.note || '—'}`).catch(() => {});
        await MatchPlan.updateOne({ _id: p._id }, { reminder60: true });
      }

      // Rappels 15 min
      const plans15 = await MatchPlan.find({
        status:    'pending',
        reminder15: false,
        scheduledAt: { $gte: now, $lte: in15 },
      }).lean();

      for (const p of plans15) {
        if (!p.channelId) continue;
        const ch = client.channels.cache.get(p.channelId);
        if (!ch) continue;
        const opponent = p.team2 || 'TBD';
        await ch.send(`🚨 **Rappel 15 min** — **${p.team1}** vs **${opponent}** dans 15 minutes ! Rejoignez le lobby.`).catch(() => {});
        await MatchPlan.updateOne({ _id: p._id }, { reminder15: true });
      }

      // Marquer passés comme "done"
      await MatchPlan.updateMany({
        status: 'pending',
        scheduledAt: { $lt: now },
      }, { status: 'done' });

    } catch (err) {
      console.error('[matchplan reminder]', err);
    }
  }, 60 * 1000);
}

let started = false;
module.exports = (client) => {
  if (!started) { started = true; startReminderLoop(client); }

  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const content = message.content.trim();
      const guildId = message.guild.id;

      // !rappelsmatch — public
      if (content === '!rappelsmatch') {
        const upcoming = await MatchPlan.find({
          guildId,
          status: 'pending',
          scheduledAt: { $gte: new Date() },
        }).sort({ scheduledAt: 1 }).limit(10).lean();

        if (!upcoming.length) return message.reply('📭 Aucun match planifié à venir.');

        const lines = upcoming.map((p, i) => {
          const dt = new Date(p.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          const opponent = p.team2 || 'TBD';
          const note = p.note ? ` — _${p.note}_` : '';
          return `**${i + 1}.** ⚔️ **${p.team1}** vs **${opponent}** — 📅 ${dt}${note}`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('📅 Prochains matchs planifiés')
          .setDescription(lines)
          .setColor(0x5865F2)
          .setFooter({ text: 'Rappels automatiques 60 min et 15 min avant le match' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (!content.startsWith('!planifiermatch')) return;

      const rest  = content.slice('!planifiermatch'.length).trim();
      const parts = rest.split(/\s+/);

      // !planifiermatch liste
      if (parts[0] === 'liste') {
        const plans = await MatchPlan.find({ guildId }).sort({ scheduledAt: -1 }).limit(15).lean();
        if (!plans.length) return message.reply('📭 Aucun match planifié.');

        const lines = plans.map((p, i) => {
          const dt = new Date(p.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          const stEmoji = p.status === 'pending' ? '🟢' : p.status === 'done' ? '✅' : '🔴';
          return `${stEmoji} **${p.team1}** vs **${p.team2 || 'TBD'}** · ${dt} · \`${p._id.toString().slice(-6)}\``;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('📋 Matchs planifiés')
          .setDescription(lines)
          .setColor(0x5865F2)
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // Staff only below
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      // !planifiermatch annuler <id>
      if (parts[0] === 'annuler') {
        const id = parts[1];
        if (!id) return message.reply('Usage : `!planifiermatch annuler <id>`');
        const plans = await MatchPlan.find({ guildId }).lean();
        const plan  = plans.find(p => p._id.toString().endsWith(id));
        if (!plan) return message.reply(`❌ Match \`${id}\` introuvable.`);
        await MatchPlan.updateOne({ _id: plan._id }, { status: 'cancelled' });
        return message.reply(`✅ Match \`${id}\` (**${plan.team1}** vs **${plan.team2 || 'TBD'}**) annulé.`);
      }

      // !planifiermatch <T1> vs <T2> <date> [note...]
      // Format: équipe1 vs équipe2 25/06 20:00 note optionnelle
      const vsIdx = parts.findIndex(p => p.toLowerCase() === 'vs');
      if (vsIdx === -1) return message.reply('Usage : `!planifiermatch <équipe1> vs <équipe2> <JJ/MM HH:MM> [note]`');

      const team1    = parts.slice(0, vsIdx).join(' ');
      const afterVs  = parts.slice(vsIdx + 1);

      // Détecter la date (dernier élément qui ressemble à JJ/MM)
      let dateStr = '', team2 = '', note = '';
      // Chercher un pattern date
      const dateIdx = afterVs.findIndex(p => /^\d{1,2}\/\d{1,2}/.test(p));
      if (dateIdx !== -1) {
        team2   = afterVs.slice(0, dateIdx).join(' ');
        // Date = dateIdx et dateIdx+1 si HH:MM
        const dateParts = [afterVs[dateIdx]];
        let noteStart = dateIdx + 1;
        if (afterVs[dateIdx + 1] && /^\d{1,2}:\d{2}$/.test(afterVs[dateIdx + 1])) {
          dateParts.push(afterVs[dateIdx + 1]);
          noteStart = dateIdx + 2;
        }
        dateStr = dateParts.join(' ');
        note    = afterVs.slice(noteStart).join(' ');
      } else {
        return message.reply('Précise une date : `JJ/MM` ou `JJ/MM HH:MM` ou `JJ/MM/AAAA HH:MM`');
      }

      const scheduledAt = parseDate(dateStr);
      if (!scheduledAt) return message.reply(`❌ Date invalide : \`${dateStr}\`. Format : \`JJ/MM\` ou \`JJ/MM HH:MM\``);
      if (scheduledAt < new Date()) return message.reply('❌ La date doit être dans le futur.');

      const plan = await MatchPlan.create({
        guildId,
        team1:       team1 || 'TBD',
        team2:       team2 || 'TBD',
        scheduledAt,
        note,
        createdBy:   message.author.username,
        channelId:   message.channel.id,
        status:      'pending',
      });

      const dt = scheduledAt.toLocaleString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

      const embed = new EmbedBuilder()
        .setTitle('📅 Match planifié !')
        .setColor(0x57F287)
        .addFields(
          { name: '⚔️ Match',      value: `**${team1 || 'TBD'}** vs **${team2 || 'TBD'}**`, inline: false },
          { name: '📅 Date',       value: dt,                     inline: true },
          { name: '📋 Note',       value: note || '—',             inline: true },
          { name: '🆔 ID',         value: `\`${plan._id.toString().slice(-6)}\``, inline: true },
        )
        .setFooter({ text: 'Rappels automatiques 60 min et 15 min avant le match · !rappelsmatch pour voir tous les matchs' })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[matchplan] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
