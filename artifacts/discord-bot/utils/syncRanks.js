const Team = require('../database/models/Team');
const RankReward = require('../database/models/RankReward');

/**
 * Syncs Discord rank reward roles based on current standings.
 * Requires teams to have a roleId (set via !linkteam).
 * @param {import('discord.js').Guild} guild
 */
async function syncRanks(guild) {
  try {
    const [teams, rewards] = await Promise.all([
      Team.find().sort({ points: -1 }),
      RankReward.find().sort({ rank: 1 })
    ]);

    if (!rewards.length) return;

    // Collect all reward role IDs to strip them cleanly
    const allRewardRoleIds = rewards.map(r => r.roleId);

    // Fetch all members (requires GuildMembers intent)
    await guild.members.fetch();

    // Strip all rank reward roles from everyone first
    for (const roleId of allRewardRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;
      for (const [, member] of role.members) {
        await member.roles.remove(role).catch(() => {});
      }
    }

    // Assign rank reward roles to team members based on current standings
    for (const reward of rewards) {
      const teamAtRank = teams[reward.rank - 1];
      if (!teamAtRank?.roleId) continue;

      const rewardRole = guild.roles.cache.get(reward.roleId);
      const teamRole = guild.roles.cache.get(teamAtRank.roleId);
      if (!rewardRole || !teamRole) continue;

      for (const [, member] of teamRole.members) {
        await member.roles.add(rewardRole).catch(() => {});
      }
    }
  } catch (err) {
    // Silent fail — rank sync is non-critical
  }
}

module.exports = { syncRanks };
