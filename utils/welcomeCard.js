const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'supremyx_logo_no_bg.png');
let cachedLogo = null;
async function getLogo() {
  if (cachedLogo) return cachedLogo;
  try {
    cachedLogo = await loadImage(LOGO_PATH);
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = v => Math.max(0, Math.min(255, v));
  const nr = clamp(r + amount).toString(16).padStart(2, '0');
  const ng = clamp(g + amount).toString(16).padStart(2, '0');
  const nb = clamp(b + amount).toString(16).padStart(2, '0');
  return `#${nr}${ng}${nb}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function generateWelcomeCard({ member, title, subtitle, color, accentColor }) {
  const W = 1000, H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Thème SUPREMYX : fond noir profond, accents or/argent
  const base = color || '#0A0A0A';
  const gold = accentColor || '#F5C518';
  const silver = '#C7CDD4';

  // Fond dégradé noir (façon "SUPREMYX"), légèrement éclairci
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, shade(base, 28));
  bgGrad.addColorStop(0.5, shade(base, 14));
  bgGrad.addColorStop(1, shade(base, 32));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Rayons dorés en éventail (rappel de l'étoile du logo)
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.translate(W - 260, H / 2 - 10);
  for (let i = 0; i < 10; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 5);
    ctx.fillStyle = i % 2 === 0 ? gold : silver;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(600, -22);
    ctx.lineTo(600, 22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Diagonales argentées, assombries de 50%
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffffff';
  for (let i = -4; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 90, 0);
    ctx.lineTo(i * 90 + 50, 0);
    ctx.lineTo(i * 90 - 120, H);
    ctx.lineTo(i * 90 - 170, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Fine bordure dorée
  ctx.strokeStyle = gold;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Barre d'accent dorée en bas
  const barH = 22;
  const barGrad = ctx.createLinearGradient(0, 0, W, 0);
  barGrad.addColorStop(0, shade(gold, -30));
  barGrad.addColorStop(0.5, gold);
  barGrad.addColorStop(1, shade(gold, -30));
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, H - barH, W, barH);

  // Logo SUPREMYX en filigrane (haut droit)
  const logo = await getLogo();
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    const logoSize = 90;
    ctx.drawImage(logo, W - logoSize - 28, 24, logoSize, logoSize);
    ctx.restore();
  }

  // Titre (haut-gauche) en argent avec liseré or
  const titleText = (title || 'BIENVENUE').toUpperCase();
  ctx.textBaseline = 'top';
  ctx.font = 'bold 48px sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(gold, -20);
  ctx.strokeText(titleText, 48, 94);
  ctx.fillStyle = silver;
  ctx.fillText(titleText, 48, 94);

  // Petit soulignement doré
  const underlineGrad = ctx.createLinearGradient(50, 0, 160, 0);
  underlineGrad.addColorStop(0, gold);
  underlineGrad.addColorStop(1, 'rgba(245,197,24,0)');
  ctx.fillStyle = underlineGrad;
  ctx.fillRect(50, 152, 220, 5);

  // Pseudo Discord de l'utilisateur (mis en avant, doré, sans "@")
  const username = member.user ? member.user.username : member.username;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = gold;
  ctx.fillText(username, 48, 170);

  // Bannière du sous-titre (translucide, liseré doré)
  const subText = (subtitle || 'RALLIER • DOMINER • INSPIRER — BIENVENUE');
  const bannerX = 48, bannerY = 220, bannerW = 560, bannerH = 100;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245,197,24,0.4)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 14);
  ctx.stroke();

  ctx.fillStyle = '#f2f2f2';
  ctx.font = '19px sans-serif';
  const lines = wrapText(ctx, subText, bannerW - 40);
  lines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, bannerX + 24, bannerY + 20 + i * 26);
  });

  // Avatar circulaire (côté droit) avec anneau doré
  const avatarSize = 200;
  const avatarX = W - 300;
  const avatarY = H / 2 - avatarSize / 2 + 10;

  try {
    const avatarUrl = member.user
      ? member.user.displayAvatarURL({ extension: 'png', size: 256 })
      : member.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarUrl);

    // Anneau doré extérieur
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
    const ringGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    ringGrad.addColorStop(0, gold);
    ringGrad.addColorStop(1, silver);
    ctx.fillStyle = ringGrad;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch {
    // Repli : cercle doré uni
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = gold;
    ctx.fill();
  }

  return canvas.encode('png');
}

module.exports = { generateWelcomeCard };
