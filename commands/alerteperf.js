const { EmbedBuilder } = require('discord.js');
const PerfAlert = require('../database/models/PerfAlert');
const Team      = require('../database/models/Team');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {

  // ── Vérification périodique des alertes (toutes les 5 min) ───────────────
  let alertStarted = false;
  async function checkAlerts() {
    try {
      const alerts = await PerfAlert.find();
      for (const alert of alerts) {
        const team = await Team.findOne({ name: new RegExp(`^${alert.teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        if (!team) continue;

        const channel = client.channels.cache.get(alert.channelId);
        if (!channel) continue;

        if (alert.type === 'points') {
          const crossed = alert.lastValue < alert.seuil && team.points >= alert.seuil;
          const fell    = alert.lastValue >= alert.seuil && team.points < alert.seuil;
          if (crossed) {
            const embed = new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('🚨 Alerte Performance — Seuil atteint !')
              .setDescription(`🎉 **${team.name}** vient de franchir **${alert.seuil} points** !\n📊 Points actuels : **${team.points}** pts`)
              .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => {});
          } else if (fell) {
            const embed = new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('📉 Alerte Performance — Chute sous le seuil')
              .setDescription(`⚠️ **${team.name}** est passée sous **${alert.seuil} points**.\n📊 Points actuels : **${team.points}** pts`)
              .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => {});
          }
          alert.lastValue = team.points;
          await alert.save();
        }

        if (alert.type === 'podium') {
          const allTeams = await Team.find().sort({ points: -1 }).limit(3);
          const inPodium = allTeams.some(t => t.name === team.name);
          const wasIn    = alert.lastValue === 1;
          if (inPodium && !wasIn) {
            const embed = new EmbedBuilder()
              .setColor(0xFEE75C)
              .setTitle('🏆 Alerte Podium — Entrée dans le top 3 !')
              .setDescription(`🎉 **${team.name}** est maintenant dans le **top 3** !`)
              .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => {});
            alert.lastValue = 1;
            await alert.save();
          } else if (!inPodium && wasIn) {
            const embed = new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle('📉 Alerte Podium — Sortie du top 3')
              .setDescription(`⚠️ **${team.name}** est sortie du **top 3**.`)
              .setTimestamp();
            channel.send({ embeds: [embed] }).catch(() => {});
            alert.lastValue = 0;
            await alert.save();
          }
        }
      }
    } catch (err) {
      console.error('[alerteperf check]', err);
    }
  }

  client.once('ready', () => {
    if (alertStarted) return;
    alertStarted = true;
    setInterval(checkAlerts, 5 * 60 * 1000);
  });

  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!alerteperf')) return;
      if (!message.member) return;
      if (!message.member.permissions.has('Administrator')) return message.reply('⛔ Staff uniquement.');

      const content = message.content.trim();
      const args    = content.slice('!alerteperf'.length).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const guildId = message.guild.id;

      // ── !alerteperf liste ─────────────────────────────────────────────────
      if (sub === 'liste') {
        const alerts = await PerfAlert.find({ guildId });
        if (!alerts.length) return message.reply('❌ Aucune alerte configurée.');
        const lines = alerts.map(a =>
          a.type === 'podium'
            ? `📊 **${a.teamName}** — Alerte podium → <#${a.channelId}>`
            : `📊 **${a.teamName}** — Seuil : **${a.seuil} pts** → <#${a.channelId}>`
        );
        const embed = new EmbedBuilder()
          .setColor(0xFF8C00).setTitle('🔔 Alertes de performance').setDescription(lines.join('\n')).setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !alerteperf supprimer <équipe> ────────────────────────────────────
      if (sub === 'supprimer') {
        const teamName = args.slice(1).join(' ').trim();
        if (!teamName) return message.reply('Usage : `!alerteperf supprimer <équipe>`');
        const del = await PerfAlert.findOneAndDelete({ guildId, teamName: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        return del ? message.reply(`✅ Alerte supprimée pour **${teamName}**.`) : message.reply(`❌ Aucune alerte pour **${teamName}**.`);
      }

      // ── !alerteperf podium <équipe> #salon ────────────────────────────────
      if (sub === 'podium') {
        const rest = args.slice(1).join(' ');
        const mentioned = message.mentions.channels.first();
        if (!mentioned) return message.reply('Usage : `!alerteperf podium <équipe> #salon`');
        const teamName = rest.replace(/<#\d+>/, '').trim();
        if (!teamName) return message.reply('Usage : `!alerteperf podium <équipe> #salon`');
        const team = await Team.findOne({ name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);
        await PerfAlert.findOneAndUpdate(
          { guildId, teamName: team.name },
          { type: 'podium', seuil: 0, channelId: mentioned.id, lastValue: 0 },
          { upsert: true }
        );
        return message.reply(`✅ Alerte podium configurée pour **${team.name}** → <#${mentioned.id}>`);
      }

      // ── !alerteperf <équipe> <seuil> #salon ───────────────────────────────
      const channelMention = message.mentions.channels.first();
      if (!channelMention) return message.reply('Usage :\n`!alerteperf <équipe> <seuil_points> #salon`\n`!alerteperf podium <équipe> #salon`\n`!alerteperf liste`\n`!alerteperf supprimer <équipe>`');

      const rest    = content.slice('!alerteperf'.length).replace(/<#\d+>/, '').trim().split(/\s+/);
      const seuil   = parseInt(rest[rest.length - 1]);
      const teamName = rest.slice(0, rest.length - 1).join(' ').trim();

      if (!teamName || isNaN(seuil)) return message.reply('Usage : `!alerteperf <équipe> <seuil_points> #salon`');

      const team = await Team.findOne({ name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      await PerfAlert.findOneAndUpdate(
        { guildId, teamName: team.name },
        { type: 'points', seuil, channelId: channelMention.id, lastValue: team.points },
        { upsert: true }
      );
      return message.reply(`✅ Alerte configurée : **${team.name}** sera notifiée quand elle franchit **${seuil} pts** → <#${channelMention.id}>`);

    } catch (err) {
      console.error('[alerteperf]', err);
    }
  });
};
