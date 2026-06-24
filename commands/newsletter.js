const { EmbedBuilder } = require('discord.js');
const NewsletterConfig = require('../database/models/NewsletterConfig');
const Match      = require('../database/models/Match');
const Team       = require('../database/models/Team');
const Tournament = require('../database/models/Tournament');
const XpEntry    = require('../database/models/XpEntry');

let nlStarted = false;

async function buildWeeklyEmbed(client, guildId) {
  const now   = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [tourn, recentMatches, topTeams] = await Promise.all([
    Tournament.findOne({ active: true }),
    Match.find({ createdAt: { $gte: weekAgo } }).sort({ createdAt: -1 }).limit(10),
    Team.find().sort({ points: -1 }).limit(5),
  ]);

  const matchCount = recentMatches.length;
  const killsSum   = recentMatches.reduce((s, m) => s + m.kills, 0);
  const podium     = topTeams.slice(0, 3).map((t, i) => `${['🥇','🥈','🥉'][i]} **${t.name}** — ${t.points} pts`).join('\n');

  const lastMatch  = recentMatches[0];

  return new EmbedBuilder()
    .setColor(0xFF8C00)
    .setTitle(`📰 Newsletter SUPREMYX — Semaine du ${weekAgo.toLocaleDateString('fr-FR')}`)
    .setDescription(`Voici le résumé de la semaine pour **${tourn?.name ?? 'la compétition'}**.`)
    .addFields(
      { name: '🏆 Top 3 actuel',       value: podium || '—',                                                 inline: false },
      { name: '🎮 Matchs cette semaine', value: `**${matchCount}** match(s) joué(s) · **${killsSum}** kills`, inline: true },
      { name: '⚡ Dernier match',        value: lastMatch ? `**${lastMatch.team}** — #${lastMatch.placement} · ${lastMatch.kills}k` : '—', inline: true },
    )
    .setFooter({ text: 'SUPREMYX Esports · Newsletter hebdomadaire automatique' })
    .setTimestamp();
}

module.exports = (client) => {

  // ── Envoi automatique le dimanche ~20h ───────────────────────────────────
  client.once('ready', () => {
    if (nlStarted) return;
    nlStarted = true;

    setInterval(async () => {
      const now = new Date();
      if (now.getDay() !== 0 || now.getHours() !== 20) return;

      const configs = await NewsletterConfig.find({ active: true, channelId: { $ne: null } });
      for (const cfg of configs) {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(cfg.channelId);
        if (!channel) continue;

        const lastSent = cfg.lastSentAt;
        if (lastSent && (now - lastSent) < 6 * 24 * 60 * 60 * 1000) continue;

        try {
          const embed = await buildWeeklyEmbed(client, cfg.guildId);
          await channel.send({ embeds: [embed] });
          cfg.lastSentAt = now;
          await cfg.save();
        } catch (err) {
          console.error('[newsletter auto]', err);
        }
      }
    }, 60 * 60 * 1000); // vérification toutes les heures
  });

  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!infolettre') && !message.content.startsWith('!newsletter')) return;
      if (!message.member) return;
      if (!message.member.permissions.has('Administrator')) return message.reply('⛔ Staff uniquement.');

      const content = message.content.trim();
      const _nlLen  = content.startsWith('!infolettre') ? '!infolettre'.length : '!newsletter'.length;
      const args    = content.slice(_nlLen).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const guildId = message.guild.id;

      // ── !newsletter salon #salon ──────────────────────────────────────────
      if (sub === 'salon') {
        const chan = message.mentions.channels.first();
        if (!chan) return message.reply('Usage : `!infolettre salon #salon`');
        await NewsletterConfig.findOneAndUpdate({ guildId }, { channelId: chan.id }, { upsert: true });
        return message.reply(`✅ Salon newsletter défini : <#${chan.id}>\nPublication automatique chaque **dimanche à 20h**.`);
      }

      // ── !newsletter activer / desactiver ──────────────────────────────────
      if (sub === 'activer' || sub === 'desactiver' || sub === 'désactiver') {
        const active = sub === 'activer';
        await NewsletterConfig.findOneAndUpdate({ guildId }, { active }, { upsert: true });
        return message.reply(`✅ Newsletter **${active ? 'activée' : 'désactivée'}**.`);
      }

      // ── !newsletter tester ────────────────────────────────────────────────
      if (sub === 'tester') {
        const cfg = await NewsletterConfig.findOne({ guildId });
        if (!cfg?.channelId) return message.reply('❌ Configure d\'abord le salon avec `!infolettre salon #salon`.');
        const chan = message.guild.channels.cache.get(cfg.channelId);
        if (!chan) return message.reply('❌ Salon introuvable.');
        const embed = await buildWeeklyEmbed(client, guildId);
        await chan.send({ embeds: [embed] });
        return message.reply(`✅ Newsletter de test envoyée dans <#${cfg.channelId}>.`);
      }

      // ── !newsletter statut ────────────────────────────────────────────────
      if (sub === 'statut') {
        const cfg = await NewsletterConfig.findOne({ guildId });
        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setTitle('📰 Newsletter — Configuration')
          .addFields(
            { name: '📌 Salon',      value: cfg?.channelId ? `<#${cfg.channelId}>` : '❌ Non configuré', inline: true },
            { name: '⚡ Statut',     value: cfg?.active ? '✅ Activée' : '❌ Désactivée',                 inline: true },
            { name: '🕐 Dernier envoi', value: cfg?.lastSentAt ? new Date(cfg.lastSentAt).toLocaleDateString('fr-FR') : '—', inline: true },
          )
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      return message.reply('**Usage `!infolettre` :** `salon #salon` · `activer` · `desactiver` · `tester` · `statut`');
    } catch (err) {
      console.error('[newsletter]', err);
    }
  });
};
