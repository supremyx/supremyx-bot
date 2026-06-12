const DashboardConfig = require('../database/models/DashboardConfig');
const Sanction = require('../database/models/Sanction');
const Ticket = require('../database/models/Ticket');
const Sondage = require('../database/models/Sondage');
const XpEntry = require('../database/models/XpEntry');
const GuildEvent = require('../database/models/GuildEvent');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

function xpToLevel(xp) {
  return Math.floor(Math.sqrt(xp / 50));
}

async function buildDashboardEmbed(guild, client) {
  const now = new Date();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // --- Tickets ---
  const openTickets = await Ticket.countDocuments({ closed: false }).catch(() => 0);
  const newTickets24h = await Ticket.countDocuments({ createdAt: { $gte: since24h } }).catch(() => 0);
  const closedTickets24h = await Ticket.countDocuments({ closed: true, updatedAt: { $gte: since24h } }).catch(() => 0);

  // --- Sanctions (last 24h) ---
  const recentSanctions = await Sanction.find({ guildId: guild.id, createdAt: { $gte: since24h } })
    .sort({ createdAt: -1 })
    .limit(5)
    .catch(() => []);
  const sanctionCounts = { warn: 0, mute: 0, kick: 0, ban: 0 };
  for (const s of recentSanctions) sanctionCounts[s.type] = (sanctionCounts[s.type] || 0) + 1;

  // --- Active sondages ---
  const activeSondages = await Sondage.find({ closed: false, endTime: { $gt: now } }).catch(() => []);

  // --- Active events ---
  const activeEvents = await GuildEvent.find({ guildId: guild.id, cancelled: false }).limit(3).catch(() => []);

  // --- Top XP (weekly) ---
  const topXp = await XpEntry.find({ guildId: guild.id }).sort({ xp: -1 }).limit(5).catch(() => []);

  // --- Server members ---
  await guild.members.fetch().catch(() => {});
  const totalMembers = guild.memberCount;
  const onlineMembers = guild.members.cache.filter(m => m.presence?.status && m.presence.status !== 'offline').size;
  const bots = guild.members.cache.filter(m => m.user.bot).size;

  // Build embeds (split into 2 due to Discord field limit)
  const mainEmbed = new EmbedBuilder()
    .setTitle(`📊 Tableau de bord — ${guild.name}`)
    .setColor(0x5865F2)
    .setThumbnail(guild.iconURL())
    .setDescription(`Synthèse générée <t:${Math.floor(now.getTime() / 1000)}:R>`)
    .addFields(
      {
        name: '👥 Membres',
        value: [
          `👤 Total : **${totalMembers}**`,
          `🟢 En ligne : **${onlineMembers}**`,
          `🤖 Bots : **${bots}**`
        ].join('\n'),
        inline: true
      },
      {
        name: '🎫 Tickets',
        value: [
          `📂 Ouverts : **${openTickets}**`,
          `🆕 Nouveaux (24h) : **${newTickets24h}**`,
          `✅ Fermés (24h) : **${closedTickets24h}**`
        ].join('\n'),
        inline: true
      },
      {
        name: '⚠️ Sanctions (24h)',
        value: recentSanctions.length
          ? [
              `⚠️ Warns : **${sanctionCounts.warn}**`,
              `🔇 Mutes : **${sanctionCounts.mute}**`,
              `👢 Kicks : **${sanctionCounts.kick}**`,
              `🔨 Bans : **${sanctionCounts.ban}**`
            ].join('\n')
          : '✅ Aucune sanction',
        inline: true
      }
    )
    .setTimestamp();

  // Top XP section
  if (topXp.length) {
    const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
    const xpRows = topXp.map((e, i) =>
      `${medals[i]} <@${e.userId}> — Niv. **${e.level}** | **${e.xp}** XP`
    ).join('\n');
    mainEmbed.addFields({ name: '📈 Top 5 membres (XP)', value: xpRows });
  }

  // Active sondages
  if (activeSondages.length) {
    const rows = activeSondages.map(s => {
      const end = `<t:${Math.floor(new Date(s.endTime).getTime() / 1000)}:R>`;
      return `• **${s.question.slice(0, 50)}** — se termine ${end}`;
    }).join('\n');
    mainEmbed.addFields({ name: `📊 Sondages actifs (${activeSondages.length})`, value: rows });
  }

  // Active events
  if (activeEvents.length) {
    const rows = activeEvents.map(e =>
      `• **#${e.eventNumber} ${e.title}** — ${e.date || 'Date TBD'} | ✅ ${e.joined.length}`
    ).join('\n');
    mainEmbed.addFields({ name: `📅 Événements actifs (${activeEvents.length})`, value: rows });
  }

  // Recent sanctions detail
  if (recentSanctions.length) {
    const ICONS = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨' };
    const rows = recentSanctions.map(s => {
      const auto = s.autoEscalation ? ' *(auto)*' : '';
      return `${ICONS[s.type]} **${s.userTag}** — ${s.reason.slice(0, 40)}${auto}`;
    }).join('\n');
    mainEmbed.addFields({ name: '🚨 Dernières sanctions', value: rows });
  }

  mainEmbed.setFooter({ text: `SUPREMYX • ${guild.name} • Données en temps réel` });

  return [mainEmbed];
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    const isStaff = message.member?.permissions.has('Administrator');

    // --- !dashboard ---
    if (cmd === '!tableaudebord') {
      const sub = args[1]?.toLowerCase();

      // --- !dashboard (generate now) ---
      if (!sub || sub === 'now') {
        await message.channel.sendTyping();
        const embeds = await buildDashboardEmbed(message.guild, client);
        return message.channel.send({ embeds });
      }

      // --- !tableaudebord web — lien vers le dashboard classement ---
      if (sub === 'web') {
        const domain = (process.env.REPLIT_DOMAINS || '').split(',')[0].trim();
        const url    = domain ? `https://${domain}/dashboard/` : null;
        const embed  = new EmbedBuilder()
          .setTitle('📊 Dashboard Classement — SUPREMYX')
          .setColor(0x5865F2)
          .setDescription(
            url
              ? `Consulte le classement en direct, l'évolution des points par équipe et l'historique des matchs.\n\n🔗 **[Ouvrir le Dashboard](${url})**\n\n> Actualisation automatique toutes les 30 secondes.`
              : '⚠️ URL indisponible (variable `REPLIT_DOMAINS` absente).'
          );
        if (url) {
          embed.addFields({ name: '🌐 Lien direct', value: url });
          embed.setFooter({ text: 'SUPREMYX • Dashboard Classement' });
          embed.setTimestamp();
        }
        return message.channel.send({ embeds: [embed] });
      }

      if (!isStaff) return message.reply('Staff uniquement');

      // --- !tableaudebord channel #salon ---
      if (sub === 'channel') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('Usage : `!tableaudebord channel #salon`');
        await DashboardConfig.findOneAndUpdate(
          { guildId: message.guild.id },
          { channelId: channel.id },
          { upsert: true, new: true }
        );
        logStaffAction(client, `📊 **Dashboard** → salon <#${channel.id}> | Par : ${message.author.tag}`);
        return message.reply(`✅ Dashboard automatique configuré dans <#${channel.id}>.`);
      }

      // --- !tableaudebord auto on/off ---
      if (sub === 'auto') {
        const state = args[2]?.toLowerCase();
        if (!state || !['on', 'off'].includes(state))
          return message.reply('Usage : `!tableaudebord auto on` ou `!tableaudebord auto off`');

        const cfg = await DashboardConfig.findOne({ guildId: message.guild.id });
        if (!cfg || !cfg.channelId)
          return message.reply('❌ Configure d\'abord un salon avec `!tableaudebord channel #salon`.');

        cfg.autoEnabled = state === 'on';
        await cfg.save();

        logStaffAction(client, `📊 **Dashboard auto ${state === 'on' ? 'activé' : 'désactivé'}** | Par : ${message.author.tag}`);
        return message.reply(
          state === 'on'
            ? `✅ Dashboard automatique activé — posté chaque jour à **${cfg.postHour}h UTC** dans <#${cfg.channelId}>.`
            : '⛔ Dashboard automatique désactivé.'
        );
      }

      // --- !tableaudebord hour <0-23> ---
      if (sub === 'hour') {
        const hour = parseInt(args[2]);
        if (isNaN(hour) || hour < 0 || hour > 23)
          return message.reply('Usage : `!tableaudebord hour <0-23>` — heure UTC de publication');

        await DashboardConfig.findOneAndUpdate(
          { guildId: message.guild.id },
          { postHour: hour },
          { upsert: true, new: true }
        );
        logStaffAction(client, `📊 **Dashboard hour** → ${hour}h UTC | Par : ${message.author.tag}`);
        return message.reply(`✅ Publication automatique à **${hour}h UTC** chaque jour.`);
      }

      // --- !tableaudebord status ---
      if (sub === 'status') {
        const cfg = await DashboardConfig.findOne({ guildId: message.guild.id });
        const embed = new EmbedBuilder()
          .setTitle('📊 Configuration du Dashboard')
          .setColor(cfg?.autoEnabled ? 0x57F287 : 0xED4245)
          .addFields(
            { name: '📍 Salon', value: cfg?.channelId ? `<#${cfg.channelId}>` : '*Non configuré*', inline: true },
            { name: '🔘 Auto', value: cfg?.autoEnabled ? '✅ Activé' : '⛔ Désactivé', inline: true },
            { name: '🕐 Heure', value: cfg?.postHour !== undefined ? `**${cfg.postHour}h UTC**` : '*8h UTC*', inline: true }
          )
          .setFooter({ text: '!tableaudebord now — générer immédiatement' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      return message.reply(
        '**Commandes `!tableaudebord` :**\n' +
        '`!tableaudebord` — Générer le dashboard serveur maintenant\n' +
        '`!tableaudebord web` — Lien vers le dashboard classement en ligne\n' +
        '`!tableaudebord channel #salon` — Configurer le salon *(staff)*\n' +
        '`!tableaudebord auto on / off` — Activer / désactiver la publication auto *(staff)*\n' +
        '`!tableaudebord hour <0-23>` — Heure de publication (UTC) *(staff)*\n' +
        '`!tableaudebord status` — Voir la configuration *(staff)*'
      );
    }
  });
};

module.exports.buildDashboardEmbed = buildDashboardEmbed;
