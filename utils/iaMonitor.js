const { EmbedBuilder } = require('discord.js');

let _interval = null;
const _cooldowns = new Map(); // guildId -> lastAlertAt per model

const WINDOW_MINUTES = 10;
const COOLDOWN_MS = 30 * 60 * 1000; // 30 min entre 2 alertes pour le même modèle

async function checkModelPerf(client) {
  try {
    const IaConfig  = require('../database/models/IaConfig');
    const IaLatency = require('../database/models/IaLatency');

    const configs = await IaConfig.find({
      perfAlertChannelId: { $ne: null },
    }).lean();

    if (!configs.length) return;

    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
    const recentRecords = await IaLatency.find({ measuredAt: { $gte: since } }).lean();
    if (!recentRecords.length) return;

    // Agrégation par modèle
    const modelMap = new Map();
    for (const r of recentRecords) {
      if (!modelMap.has(r.model)) modelMap.set(r.model, []);
      modelMap.get(r.model).push(r);
    }

    for (const config of configs) {
      const channelId   = config.perfAlertChannelId;
      const latencyTh   = config.latencyThresholdMs   ?? 5000;
      const failureTh   = config.failureRateThreshold ?? 50;

      const ch = client.channels.cache.get(channelId);
      if (!ch) continue;

      for (const [model, records] of modelMap.entries()) {
        if (records.length < 3) continue; // pas assez de données

        const successes  = records.filter(r => r.success);
        const failures   = records.filter(r => !r.success);
        const failureRate = Math.round((failures.length / records.length) * 100);
        const avgLatency = successes.length
          ? Math.round(successes.reduce((s, r) => s + r.latencyMs, 0) / successes.length)
          : null;

        const alerts = [];
        if (avgLatency !== null && avgLatency > latencyTh) {
          alerts.push({
            type: 'latency',
            label: `⏱️ Latence élevée`,
            value: `${avgLatency}ms (seuil : ${latencyTh}ms)`,
            color: 0xFEE75C,
          });
        }
        if (failureRate >= failureTh) {
          alerts.push({
            type: 'failure',
            label: `❌ Taux d'échec`,
            value: `${failureRate}% (seuil : ${failureTh}%)`,
            color: 0xED4245,
          });
        }

        if (!alerts.length) continue;

        // Cooldown par (guildId + model + alertType)
        const cdKey = `${config.guildId}:${model}`;
        const lastAlert = _cooldowns.get(cdKey) ?? 0;
        if (Date.now() - lastAlert < COOLDOWN_MS) continue;
        _cooldowns.set(cdKey, Date.now());

        const shortModel = model.split('/').pop().replace(':free', '').slice(0, 30);
        const worstColor = alerts.some(a => a.type === 'failure') ? 0xED4245 : 0xFEE75C;

        const embed = new EmbedBuilder()
          .setTitle(`🚨 Alerte performance IA`)
          .setColor(worstColor)
          .setDescription(
            `Le modèle **${shortModel}** présente des problèmes de performance détectés sur les **${WINDOW_MINUTES} dernières minutes**.`
          )
          .addFields(
            { name: '🤖 Modèle',        value: `\`${model}\``,                            inline: false },
            { name: '📊 Appels testés', value: `${records.length} appels`,                 inline: true },
            { name: '✅ Succès',         value: `${successes.length}`,                     inline: true },
            { name: '❌ Échecs',         value: `${failures.length}`,                      inline: true },
            ...alerts.map(a => ({ name: a.label, value: a.value, inline: true })),
          )
          .setFooter({ text: `SUPREMYX IA Monitor · !ia alerte pour reconfigurer` })
          .setTimestamp();

        await ch.send({ embeds: [embed] }).catch(err =>
          console.warn(`[iaMonitor] Impossible d'envoyer l'alerte dans ${channelId}:`, err.message)
        );

        console.log(`[iaMonitor] Alerte envoyée pour "${model}" dans guild ${config.guildId}`);
      }
    }
  } catch (err) {
    console.error('[iaMonitor] Erreur lors de la vérification:', err.message);
  }
}

function startIaMonitor(client, intervalMs = 5 * 60 * 1000) {
  if (_interval) return;
  console.log('📡 Moniteur IA performances activé');
  _interval = setInterval(() => checkModelPerf(client), intervalMs);
}

module.exports = { startIaMonitor };
