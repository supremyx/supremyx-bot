const eventBus = require('./eventBus');

const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

// Charge les modèles de secours depuis la DB pour un guild donné.
// Si aucun n'est configuré, utilise les défauts hardcodés ci-dessus.
async function getFallbackModels(guildId) {
  if (guildId) {
    try {
      const IaConfig = require('../database/models/IaConfig');
      const cfg = await IaConfig.findOne({ guildId }).lean();
      if (cfg?.fallbackModels?.length) return cfg.fallbackModels;
    } catch (e) {
      console.warn('[OpenRouter] Impossible de charger les fallbacks depuis DB:', e.message);
    }
  }
  return FALLBACK_MODELS;
}

const FALLBACK_ON_STATUS = new Set([429, 500, 502, 503, 504]);

let _client = null;

async function saveLatency(model, latencyMs, success, isFallback, status, guildId) {
  try {
    const IaLatency = require('../database/models/IaLatency');
    await IaLatency.create({ model, latencyMs, success, isFallback, status, guildId });
  } catch (e) {
    console.warn('[OpenRouter] Impossible de sauvegarder la latence:', e.message);
  }
}

async function callOpenRouter(apiKey, model, messages, max_tokens, guildId, isFallback = false) {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://discord.com',
      'X-Title': 'SUPREMYX Bot',
    },
    body: JSON.stringify({ model, messages, max_tokens }),
  });

  const latencyMs = Date.now() - t0;

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    await saveLatency(model, latencyMs, false, isFallback, res.status, guildId);
    const err = new Error(`OpenRouter ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  await saveLatency(model, latencyMs, true, isFallback, res.status, guildId);
  return res.json();
}

async function logFallback(primaryModel, fallbackModel, reason) {
  try {
    const StaffLogEntry = require('../database/models/StaffLogEntry');
    await StaffLogEntry.create({
      message: `⚡ Fallback IA : "${primaryModel}" indisponible (${reason}) → basculement sur "${fallbackModel}"`,
      category: 'ia-fallback',
    });
  } catch (e) {
    console.warn('[OpenRouter] Impossible de logger le fallback:', e.message);
  }

  eventBus.emit('iaFallback', {
    primaryModel,
    fallbackModel,
    reason,
    date: new Date().toISOString(),
  });
}

function getOpenRouterClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  _client = {
    chat: {
      completions: {
        async create({ model, messages, max_tokens, guildId }) {
          let primaryErr;
          try {
            return await callOpenRouter(apiKey, model, messages, max_tokens, guildId, false);
          } catch (err) {
            primaryErr = err;
            const shouldFallback = FALLBACK_ON_STATUS.has(err.status);
            if (!shouldFallback) throw err;
            console.warn(`[OpenRouter] Modèle "${model}" indisponible (${err.status}) — tentative avec fallback gratuit…`);
          }

          const fallbackList = await getFallbackModels(guildId);
          for (const fallback of fallbackList) {
            if (fallback === model) continue;
            try {
              const result = await callOpenRouter(apiKey, fallback, messages, max_tokens, guildId, true);
              console.log(`[OpenRouter] Fallback réussi avec "${fallback}"`);
              result._fallbackModel = fallback;
              await logFallback(model, fallback, primaryErr.status ?? primaryErr.message);
              return result;
            } catch (fallbackErr) {
              console.warn(`[OpenRouter] Fallback "${fallback}" échoué (${fallbackErr.status ?? fallbackErr.message})`);
            }
          }

          throw new Error(`[OpenRouter] Tous les modèles ont échoué (principal + ${fallbackList.length} fallbacks)`);
        },
      },
    },
  };

  return _client;
}

module.exports = { getOpenRouterClient, FALLBACK_MODELS, getFallbackModels };
