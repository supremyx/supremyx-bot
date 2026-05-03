import { Router } from "express";

const router = Router();
const BOT_API = "http://localhost:3000";

// GET /api/ranking
router.get("/ranking", async (req, res) => {
  try {
    const r = await fetch(`${BOT_API}/ranking`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch {
    res.status(502).json({ error: "Bot API indisponible" });
  }
});

// GET /api/ranking/:team
router.get("/ranking/:team", async (req, res) => {
  try {
    const r = await fetch(`${BOT_API}/ranking/${encodeURIComponent(req.params.team)}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch {
    res.status(502).json({ error: "Bot API indisponible" });
  }
});

export default router;
