/**
 * Returns the correct URL for an API call.
 *
 * - In development (Replit dev server) the Vite proxy rewrites /api/* → localhost:3000/*
 *   so we keep the path as-is.
 * - In production (GitHub Pages) VITE_API_URL is set to the Replit public URL
 *   (e.g. https://xxx.replit.dev) and we strip the /api prefix.
 */
const BASE = import.meta.env.VITE_API_URL as string | undefined;

export function apiUrl(path: string): string {
  if (BASE) {
    // Strip the /api proxy prefix — the real server exposes routes at /
    return `${BASE}${path.replace(/^\/api/, '')}`;
  }
  return path; // dev: Vite proxy handles /api/*
}
