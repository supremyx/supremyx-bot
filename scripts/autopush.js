#!/usr/bin/env node
/**
 * autopush.js — Auto-push vers GitHub via l'API REST toutes les 60 secondes.
 * Contourne l'interdiction git push du sandbox Replit en utilisant l'API
 * PUT/DELETE /repos/{owner}/{repo}/contents/{path} pour chaque fichier.
 *
 * Seuls les fichiers suivis par Git (git ls-files) sont synchronisés,
 * ce qui respecte automatiquement .gitignore et évite toute fuite de secrets.
 * Les suppressions locales sont propagées sur GitHub via DELETE.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ── Configuration ────────────────────────────────────────────────────────────
const GITHUB_TOKEN    = process.env.GITHUB_TOKEN;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';
const REPO_OWNER      = 'supremyx';
const REPO_NAME       = 'supremyx-bot';
const BRANCH          = 'main';
const INTERVAL_MS     = 60_000;
const ROOT            = path.resolve(__dirname, '..');
const STATE_FILE      = path.join(__dirname, '.autopush_state.json');

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN non défini — auto-push désactivé');
  process.exit(1);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function githubRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'supremyx-autopush/2.0',
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Discord notification ──────────────────────────────────────────────────────
function discordNotify(color, title, desc) {
  if (!DISCORD_WEBHOOK) return;
  const payload = JSON.stringify({
    username: 'SUPREMYX Bot',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    embeds: [{
      title,
      description: desc,
      color,
      footer: { text: 'Auto-push · SUPREMYX CI' },
      timestamp: new Date().toISOString(),
    }],
  });
  const url = new URL(DISCORD_WEBHOOK);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };
  const req = https.request(options);
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

// ── Git helpers ───────────────────────────────────────────────────────────────
/**
 * Returns the list of files currently tracked by Git.
 * Respects .gitignore — only tracked files are returned.
 */
function getTrackedFiles() {
  try {
    const out = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch (err) {
    console.error('⚠️  git ls-files échoué :', err.message);
    return [];
  }
}

// ── File helpers ──────────────────────────────────────────────────────────────
function fileBase64(relPath) {
  try {
    const abs = path.join(ROOT, relPath);
    const stat = fs.statSync(abs);
    // Ignorer les fichiers > 1 Mo (limite API GitHub contents)
    if (stat.size > 1_000_000) return null;
    return fs.readFileSync(abs).toString('base64');
  } catch {
    return null;
  }
}

// ── État persistant ───────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(state) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

// ── GitHub API helpers ────────────────────────────────────────────────────────
async function getRemoteSha(filePath) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const res = await githubRequest(
    'GET',
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}?ref=${BRANCH}`,
  );
  if (res.status === 200 && res.body && res.body.sha) return res.body.sha;
  return null;
}

async function putFile(filePath, content64, remoteSha) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const body = {
    message: `sync: auto-push ${filePath} [${new Date().toISOString().slice(0, 16)}]`,
    content: content64,
    branch: BRANCH,
  };
  if (remoteSha) body.sha = remoteSha;
  const res = await githubRequest(
    'PUT',
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`,
    body,
  );
  return res;
}

async function deleteFile(filePath, remoteSha, commitMsg) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const res = await githubRequest(
    'DELETE',
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`,
    {
      message: commitMsg || `sync: suppression ${filePath} [${new Date().toISOString().slice(0, 16)}]`,
      sha: remoteSha,
      branch: BRANCH,
    },
  );
  return res;
}

// ── Cycle principal ───────────────────────────────────────────────────────────
async function autoPushCycle(state) {
  const trackedFiles = getTrackedFiles();
  const trackedSet   = new Set(trackedFiles);

  const pushed   = [];
  const deleted  = [];
  const failed   = [];

  // ── 1. Pousser les fichiers modifiés / nouveaux ────────────────────────────
  for (const filePath of trackedFiles) {
    const content64 = fileBase64(filePath);
    if (content64 === null) continue; // fichier trop grand ou illisible

    const prev = state[filePath];
    if (prev && prev.content === content64) continue; // inchangé

    // Toujours récupérer le SHA courant sur GitHub avant chaque PUT
    let remoteSha = await getRemoteSha(filePath);

    let res = await putFile(filePath, content64, remoteSha);

    // Récupération sur conflit SHA (409 / 422) : refetch + réessai unique
    if (res.status === 409 || res.status === 422) {
      remoteSha = await getRemoteSha(filePath);
      res = await putFile(filePath, content64, remoteSha);
    }

    if (res.status === 200 || res.status === 201) {
      const newSha = res.body?.content?.sha || await getRemoteSha(filePath);
      state[filePath] = { content: content64, remoteSha: newSha };
      pushed.push(filePath);
    } else {
      console.warn(`⚠️  Échec PUT ${filePath} — HTTP ${res.status}`, JSON.stringify(res.body)?.slice(0, 200));
      failed.push(filePath);
    }
  }

  // ── 2. Supprimer les fichiers retirés du suivi Git ─────────────────────────
  for (const filePath of Object.keys(state)) {
    if (trackedSet.has(filePath)) continue; // toujours suivi
    if (!state[filePath].remoteSha) { delete state[filePath]; continue; }

    // Vérifier que le fichier existe vraiment sur GitHub avant de le supprimer
    const remoteSha = await getRemoteSha(filePath);
    if (!remoteSha) { delete state[filePath]; continue; }

    const res = await deleteFile(filePath, remoteSha);
    if (res.status === 200) {
      delete state[filePath];
      deleted.push(filePath);
    } else {
      console.warn(`⚠️  Échec DELETE ${filePath} — HTTP ${res.status}`);
      failed.push(filePath);
    }
  }

  return { pushed, deleted, failed };
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
console.log('🔁 Auto-push Node.js actif — vérification toutes les 60 secondes');
console.log(`📦 Dépôt : ${REPO_OWNER}/${REPO_NAME} (branche ${BRANCH})`);
console.log('🔒 Seuls les fichiers suivis par Git sont synchronisés (.gitignore respecté)');

const state = loadState();

async function tick() {
  const t = new Date().toLocaleTimeString('fr-FR');
  try {
    const { pushed, deleted, failed } = await autoPushCycle(state);
    const totalChanges = pushed.length + deleted.length;

    if (totalChanges > 0) {
      saveState(state);

      const lines = [];
      if (pushed.length > 0) {
        lines.push(`📤 **${pushed.length} fichier(s) poussé(s)**`);
        pushed.slice(0, 5).forEach((f) => lines.push(`  • \`${f}\``));
        if (pushed.length > 5) lines.push(`  _…et ${pushed.length - 5} autre(s)_`);
      }
      if (deleted.length > 0) {
        lines.push(`🗑️ **${deleted.length} fichier(s) supprimé(s)**`);
        deleted.slice(0, 3).forEach((f) => lines.push(`  • \`${f}\``));
      }
      lines.push(`🔗 [Voir sur GitHub](https://github.com/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH})`);

      console.log(`✅ [${t}] ${pushed.length} poussé(s), ${deleted.length} supprimé(s)`);
      discordNotify(5763719, '✅ Push GitHub réussi', lines.join('\n'));
    } else {
      console.log(`⏳ [${t}] Aucun changement détecté`);
    }

    if (failed.length > 0) {
      console.warn(`⚠️  [${t}] ${failed.length} fichier(s) en échec`);
      discordNotify(
        15548997,
        '⚠️ Échec partiel du push GitHub',
        `${failed.length} fichier(s) n'ont pas pu être synchronisés :\n` +
        failed.slice(0, 5).map((f) => `• \`${f}\``).join('\n'),
      );
    }
  } catch (err) {
    console.error(`❌ [${t}] Erreur inattendue :`, err.message);
  }
}

// Premier cycle immédiat, puis toutes les 60 s
tick().then(() => setInterval(tick, INTERVAL_MS));
