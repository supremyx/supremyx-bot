const { logError } = require('./errorHandler');

const WINDOW_MS       = 60 * 1000;
const MAX_PER_WINDOW  = 15;
const FATAL_KEYWORDS  = ['ENOMEM', 'out of memory', 'heap out of memory'];

const state = {
  crashCount:       0,
  lastCrashAt:      null,
  reconnectCount:   0,
  errorWindow:      [],
  safeModeActive:   false,
};

function recordError() {
  const now = Date.now();
  state.errorWindow = state.errorWindow.filter(t => now - t < WINDOW_MS);
  state.errorWindow.push(now);
  state.crashCount++;
  state.lastCrashAt = new Date().toISOString();
  return state.errorWindow.length;
}

function isFatal(error) {
  const msg = error?.message ?? String(error);
  return FATAL_KEYWORDS.some(k => msg.includes(k));
}

function getAntiCrashMetrics() {
  return {
    crashCount:     state.crashCount,
    lastCrashAt:    state.lastCrashAt,
    reconnectCount: state.reconnectCount,
    errorsPerMin:   state.errorWindow.length,
    safeModeActive: state.safeModeActive,
  };
}

function setupAntiCrash(client) {
  client.on('disconnect', (event) => {
    console.warn(`⚠️ [antiCrash] Déconnexion Discord (code: ${event?.code ?? '?'}). Reconnexion dans 5s…`);
    state.reconnectCount++;
    const delay = Math.min(5000 * state.reconnectCount, 60000);
    setTimeout(() => {
      if (!client.isReady()) {
        client.login(process.env.TOKEN).catch(err => {
          console.error('[antiCrash] Reconnexion échouée:', err.message);
        });
      }
    }, delay);
  });

  client.on('error', (err) => {
    console.error('[antiCrash] Erreur client Discord:', err.message);
    logError({ source: 'clientError', error: err }).catch(() => {});
  });

  process.on('unhandledRejection', (reason) => {
    const count = recordError();
    const msg = reason?.message ?? String(reason);
    console.error(`[antiCrash] Rejection non gérée (${count}/min): ${msg}`);
    logError({ source: 'unhandledRejection', error: reason }).catch(() => {});

    if (count >= MAX_PER_WINDOW && !state.safeModeActive) {
      state.safeModeActive = true;
      console.error(`[antiCrash] ⚠️ MODE DÉGRADÉ activé (${count} erreurs en 1 min) — certaines fonctionnalités suspendues.`);
    }
  });

  process.on('uncaughtException', (error) => {
    const count = recordError();
    console.error(`[antiCrash] Exception non capturée (${count}/min): ${error.message}`);
    logError({ source: 'uncaughtException', error }).catch(() => {});

    if (isFatal(error)) {
      console.error('[antiCrash] Erreur fatale — arrêt immédiat.');
      process.exit(1);
    }
  });

  setInterval(() => {
    if (state.safeModeActive && state.errorWindow.length < 3) {
      state.safeModeActive = false;
      console.log('[antiCrash] ✅ Mode dégradé désactivé — activité normale rétablie.');
    }
  }, 30000);

  console.log('🛡️ Système anti-crash activé');
}

module.exports = { setupAntiCrash, getAntiCrashMetrics };
