// Free fallback models tried in order when the primary model fails
const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

// HTTP status codes that warrant a fallback retry
const FALLBACK_ON_STATUS = new Set([429, 500, 502, 503, 504]);

let _client = null;

async function callOpenRouter(apiKey, model, messages, max_tokens) {
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

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    const err = new Error(`OpenRouter ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function getOpenRouterClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  _client = {
    chat: {
      completions: {
        async create({ model, messages, max_tokens }) {
          // Try primary model first
          try {
            return await callOpenRouter(apiKey, model, messages, max_tokens);
          } catch (primaryErr) {
            const shouldFallback = FALLBACK_ON_STATUS.has(primaryErr.status);
            if (!shouldFallback) throw primaryErr;

            console.warn(`[OpenRouter] Modèle "${model}" indisponible (${primaryErr.status}) — tentative avec fallback gratuit…`);
          }

          // Try each free fallback model in order
          for (const fallback of FALLBACK_MODELS) {
            if (fallback === model) continue; // skip if already the same
            try {
              const result = await callOpenRouter(apiKey, fallback, messages, max_tokens);
              console.log(`[OpenRouter] Fallback réussi avec "${fallback}"`);
              // Tag the response so callers know a fallback was used
              result._fallbackModel = fallback;
              return result;
            } catch (fallbackErr) {
              console.warn(`[OpenRouter] Fallback "${fallback}" échoué (${fallbackErr.status ?? fallbackErr.message})`);
            }
          }

          throw new Error(`[OpenRouter] Tous les modèles ont échoué (principal + ${FALLBACK_MODELS.length} fallbacks)`);
        },
      },
    },
  };

  return _client;
}

module.exports = { getOpenRouterClient, FALLBACK_MODELS };
