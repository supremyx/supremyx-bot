
// ─── Levenshtein distance ─────────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Score de similarité entre le terme et un texte ──────────────────────────
// Retourne un score bas = bonne correspondance (0 = parfait)
function scoreText(term, text) {
  const t = text.toLowerCase();
  // Correspondance exacte partielle (sous-chaîne)
  if (t.includes(term)) return 0;

  // Distance de Levenshtein sur chaque mot du texte
  const words = t.split(/\s+|[<>\[\]|!,]/g).filter(w => w.length >= 2);
  let best = Infinity;
  for (const word of words) {
    const dist = levenshtein(term, word);
    // Bonus : on normalise par la longueur pour éviter de favoriser les mots très longs
    const normalised = dist / Math.max(term.length, word.length);
    if (normalised < best) best = normalised;
  }
  return best;
}

// ─── Trouver les commandes similaires ────────────────────────────────────────
// Retourne jusqu'à `limit` commandes triées par proximité (meilleur score en premier)
// threshold : seuil normalisé (0–1), 0.5 = 50% de différence max autorisée
function findSimilar(term, categories, { limit = 5, threshold = 0.5 } = {}) {
  const scored = [];

  for (const cat of categories) {
    for (const cmd of cat.commands) {
      const labelScore = scoreText(term, cmd.label);
      const descScore  = scoreText(term, cmd.description);
      const subsScore  = cmd.subs.length
        ? Math.min(...cmd.subs.map(s => scoreText(term, s)))
        : 1;

      const best = Math.min(labelScore, descScore, subsScore);
      if (best < threshold) {
        scored.push({ cat, cmd, score: best });
      }
    }
  }

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

module.exports = { levenshtein, findSimilar };
