# SUPREMYX Bot API — Documentation de connexion

## URL de base

En **développement local** : `http://localhost:3000`
En **production** (bot déployé sur Replit) : `https://<ton-repl>.replit.app/bot-api`

> Remplace `<ton-repl>` par le sous-domaine Replit une fois le bot déployé.

---

## Authentification

Les routes de **lecture** (GET) sont publiques.
Les routes d'**écriture** (POST) nécessitent un header :

```
x-api-key: <BOT_API_KEY>
```

La clé est stockée dans les secrets Replit sous le nom `BOT_API_KEY`.
Sur Vercel, ajoute-la dans **Settings → Environment Variables** :
```
BOT_API_KEY=<valeur>
```

---

## Routes disponibles

### Classement

#### `GET /ranking`
Retourne le classement complet trié par points.

```json
{
  "success": true,
  "total": 8,
  "ranking": [
    { "rank": 1, "team": "TeamA", "points": 120, "kills": 45, "wins": 5, "losses": 1 }
  ]
}
```

#### `GET /ranking/:team`
Retourne les stats détaillées d'une équipe + historique + timeline.

```json
{
  "success": true,
  "rank": 1,
  "team": "TeamA",
  "points": 120,
  "kills": 45,
  "wins": 5,
  "losses": 1,
  "matchCount": 6,
  "timeline": [{ "date": "...", "pts": 20, "match_pts": 20, "kills": 8, "placement": 1 }],
  "recentMatches": [{ "matchId": "...", "points": 20, "kills": 8, "placement": 1, "date": "..." }]
}
```

---

### Calendrier

#### `GET /schedule`
Retourne les matchs à venir (non terminés).

Query params :
- `past=true` → inclure aussi les matchs passés

```json
{
  "success": true,
  "total": 3,
  "schedule": [
    {
      "id": "...",
      "date": "2025-06-20T18:00:00.000Z",
      "teams": ["TeamA", "TeamB"],
      "note": "Finale",
      "tournamentName": "Summer Cup",
      "completed": false,
      "resultPostedAt": null
    }
  ]
}
```

---

### Résultats

#### `GET /results`
Retourne les matchs terminés et l'historique des résultats récents.

Query params :
- `limit` → nombre de résultats (max 50, défaut 20)

```json
{
  "success": true,
  "completedMatches": [
    { "id": "...", "date": "...", "teams": ["TeamA","TeamB"], "tournamentName": "...", "resultPostedAt": "..." }
  ],
  "recentMatchEntries": [
    { "id": "...", "team": "TeamA", "placement": 1, "kills": 8, "points": 18, "date": "..." }
  ]
}
```

---

### Statistiques joueurs

#### `GET /players`
Classement de tous les joueurs par kills.

Query params :
- `limit` → nombre de joueurs (max 100, défaut 50)
- `team` → filtrer par équipe

```json
{
  "success": true,
  "total": 12,
  "players": [
    {
      "rank": 1,
      "displayName": "Pseudo",
      "teamName": "TeamA",
      "totalKills": 80,
      "totalMatches": 6,
      "bestKills": 18,
      "avgKills": 13.33,
      "recentHistory": [{ "kills": 18, "teamPlacement": 1, "tournamentName": "...", "date": "..." }]
    }
  ]
}
```

#### `GET /players/:name`
Stats détaillées d'un joueur par pseudo.

---

### Rosters

#### `GET /rosters`
Tous les rosters de toutes les équipes.

#### `GET /rosters/:team`
Roster d'une équipe spécifique.

```json
{
  "success": true,
  "teamName": "TeamA",
  "members": [
    { "displayName": "Pseudo", "role": "IGL", "userId": "...", "joinedAt": "..." }
  ],
  "updatedAt": "..."
}
```

---

### Tournois

#### `GET /tournaments`
Historique de tous les tournois.

```json
{
  "success": true,
  "tournaments": [
    { "id": "...", "name": "Summer Cup", "active": true, "createdAt": "..." }
  ]
}
```

---

### Écriture (protégées par clé API)

#### `POST /addpoints`
Header requis : `x-api-key: <clé>`

```json
{ "team": "TeamA", "points": 10, "kills": 5 }
```

#### `POST /removematch`
Header requis : `x-api-key: <clé>`

```json
{ "matchId": "..." }
```

---

## Intégration Vercel (Next.js)

Crée un fichier `lib/api.ts` dans ton projet Vercel :

```ts
const BOT_API = process.env.NEXT_PUBLIC_BOT_API_URL;
// ex: https://<ton-repl>.replit.app/bot-api

export async function getRanking() {
  const res = await fetch(`${BOT_API}/ranking`, { next: { revalidate: 30 } });
  return res.json();
}

export async function getTeam(name: string) {
  const res = await fetch(`${BOT_API}/ranking/${encodeURIComponent(name)}`, { next: { revalidate: 30 } });
  return res.json();
}

export async function getSchedule() {
  const res = await fetch(`${BOT_API}/schedule`, { next: { revalidate: 60 } });
  return res.json();
}

export async function getResults(limit = 20) {
  const res = await fetch(`${BOT_API}/results?limit=${limit}`, { next: { revalidate: 30 } });
  return res.json();
}

export async function getPlayers(team?: string) {
  const url = team ? `${BOT_API}/players?team=${encodeURIComponent(team)}` : `${BOT_API}/players`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  return res.json();
}

export async function getRosters() {
  const res = await fetch(`${BOT_API}/rosters`, { next: { revalidate: 60 } });
  return res.json();
}

export async function getRoster(team: string) {
  const res = await fetch(`${BOT_API}/rosters/${encodeURIComponent(team)}`, { next: { revalidate: 60 } });
  return res.json();
}
```

### Variables d'environnement Vercel à configurer :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_BOT_API_URL` | `https://<ton-repl>.replit.app/bot-api` |
| `BOT_API_KEY` | `<valeur du secret Replit BOT_API_KEY>` |

---

## Santé de l'API

```
GET /health → { "status": "ok", "bot": "SUPREMYX" }
```
