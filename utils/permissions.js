const LEVELS = {
  ALL:    0,
  PLAYER: 1,
  MOD:    2,
  STAFF:  3,
  ADMIN:  4,
  OWNER:  5,
};

const LEVEL_LABELS = {
  [LEVELS.ALL]:    'Tout le monde',
  [LEVELS.PLAYER]: 'Joueur',
  [LEVELS.MOD]:    'Modérateur',
  [LEVELS.STAFF]:  'Staff',
  [LEVELS.ADMIN]:  'Administrateur',
  [LEVELS.OWNER]:  'Propriétaire',
};

const _guildRoles = new Map();

function setGuildRoles(guildId, { staffRoleId, modRoleId, playerRoleId } = {}) {
  _guildRoles.set(guildId, { staffRoleId, modRoleId, playerRoleId });
}

function getGuildRoles(guildId) {
  return _guildRoles.get(guildId) || {};
}

async function checkPerm(message, level) {
  if (!message.guild || !message.member) return false;
  if (level === LEVELS.ALL) return true;

  const OWNER_ID = process.env.OWNER_ID;
  if (OWNER_ID && message.author.id === OWNER_ID) return true;

  const isAdmin = message.member.permissions.has('Administrator');

  if (level <= LEVELS.ADMIN && isAdmin) return true;

  const roles = getGuildRoles(message.guild.id);

  if (level === LEVELS.MOD) {
    if (roles.modRoleId   && message.member.roles.cache.has(roles.modRoleId))   return true;
    if (roles.staffRoleId && message.member.roles.cache.has(roles.staffRoleId)) return true;
    return message.member.permissions.has('ManageMessages');
  }

  if (level === LEVELS.STAFF) {
    if (roles.staffRoleId && message.member.roles.cache.has(roles.staffRoleId)) return true;
    return message.member.permissions.has('ManageGuild');
  }

  if (level === LEVELS.PLAYER) {
    if (roles.playerRoleId && message.member.roles.cache.has(roles.playerRoleId)) return true;
    return true;
  }

  return false;
}

function permDenied(message, level = LEVELS.STAFF) {
  const label = LEVEL_LABELS[level] ?? 'Staff';
  return message.reply(`🔒 Accès refusé — niveau requis : **${label}**.`);
}

module.exports = { LEVELS, LEVEL_LABELS, checkPerm, permDenied, setGuildRoles, getGuildRoles };
