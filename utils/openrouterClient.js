let _client = null;

function getOpenRouterClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  _client = {
    chat: {
      completions: {
        async create({ model, messages, max_tokens }) {
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
            const err = await res.text().catch(() => res.statusText);
            throw new Error(`OpenRouter ${res.status}: ${err}`);
          }

          return res.json();
        },
      },
    },
  };

  return _client;
}

module.exports = { getOpenRouterClient };
