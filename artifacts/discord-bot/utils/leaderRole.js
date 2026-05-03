const Team = require('../database/models/Team');

/**
 * Attribue le rôle "leader" au membres de l'équipe en tête du classement.
 * Retire le rôle à tous les autres.
 *
 * Prérequis : chaque équipe doit avoir un rôle Discord portant exactement son nom.
 * LEADER_ROLE_ID = ID du rôle "leader" à attribuer (ex: 👑 Leader du tournoi).
 */
async function updateLeaderRole(client, guildId) {
  const leaderRoleId = process.env.LEADER_ROLE_ID;
  if (!leaderRoleId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  // S'assurer que le cache des membres est à jour
  await guild.members.fetch();

  const leaderRole = guild.roles.cache.get(leaderRoleId);
  if (!leaderRole) return;

  // Trouver l'équipe en tête
  const topTeam = await Team.findOne().sort({ points: -1 });
  if (!topTeam) return;

  // Trouver le rôle Discord qui porte le nom de l'équipe
  const teamRole = guild.roles.cache.find(r => r.name === topTeam.name);

  // Retirer le rôle leader à tous ceux qui l'ont déjà
  const currentHolders = leaderRole.members;
  for (const [, member] of currentHolders) {
    await member.roles.remove(leaderRole).catch(() => {});
  }

  if (!teamRole) return;

  // Donner le rôle leader à tous les membres de l'équipe gagnante
  for (const [, member] of teamRole.members) {
    await member.roles.add(leaderRole).catch(() => {});
  }
}

module.exports = { updateLeaderRole };
