const { createCanvas, loadImage } = require('@napi-rs/canvas');

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

  const base = color || '#5B2A86';
  const accent = accentColor || '#F5C518';

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, shade(base, -20));
  bgGrad.addColorStop(1, shade(base, 25));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Diagonal geometric pattern overlay
  ctx.save();
  ctx.globalAlpha = 0.08;
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

  // Bottom accent bar
  const barH = 26;
  ctx.fillStyle = accent;
  ctx.fillRect(0, H - barH, W, barH);

  // Title (top-left) "WELCOME"
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText((title || 'WELCOME').toUpperCase(), 48, 44);

  // Small accent underline below title
  ctx.fillStyle = accent;
  ctx.fillRect(50, 100, 90, 6);

  // Subtitle banner (translucent rounded rect)
  const subText = (subtitle || 'HELLO AND WELCOME TO {server}');
  ctx.font = '24px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  const bannerX = 48, bannerY = 150, bannerW = 560, bannerH = 110;
  roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 14);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  const lines = wrapText(ctx, subText, bannerW - 40);
  lines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, bannerX + 24, bannerY + 24 + i * 28);
  });

  // Avatar circle (right side)
  const avatarSize = 220;
  const avatarX = W - 300;
  const avatarY = H / 2 - avatarSize / 2 - 10;

  try {
    const avatarUrl = member.user
      ? member.user.displayAvatarURL({ extension: 'png', size: 256 })
      : member.displayAvatarURL({ extension: 'png', size: 256 });
    const avatarImg = await loadImage(avatarUrl);

    // Outer glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
    ctx.fillStyle = accent;
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
    // Fallback: colored circle with initial
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
  }

  return canvas.encode('png');
}

module.exports = { generateWelcomeCard };
