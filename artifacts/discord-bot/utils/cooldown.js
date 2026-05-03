const cooldowns = new Map();

// Nettoyage automatique toutes les 5 minutes pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of cooldowns.entries()) {
    if (now >= expiry) cooldowns.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Vérifie si un utilisateur est en cooldown pour une commande.
 * @returns {number} Secondes restantes, ou 0 si pas en cooldown.
 */
function checkCooldown(userId, command, seconds) {
  const key = `${userId}:${command}`;
  const now = Date.now();

  if (cooldowns.has(key)) {
    const expiry = cooldowns.get(key);
    if (now < expiry) return Math.ceil((expiry - now) / 1000);
  }

  cooldowns.set(key, now + seconds * 1000);
  return 0;
}

/**
 * Envoie un message de cooldown et le supprime automatiquement après 4s.
 */
async function replyCooldown(message, remaining, command) {
  const msg = await message.reply(`⏳ Attends encore **${remaining}s** avant de réutiliser \`!${command}\`.`);
  setTimeout(() => msg.delete().catch(() => {}), 4000);
}

module.exports = { checkCooldown, replyCooldown };
