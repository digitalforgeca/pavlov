export type {
  PavlovConfig,
  PavlovProfile,
  LevelDefinition,
  LevelInfo,
  BadgeDefinition,
  BadgeCondition,
  CompoundBadgeCondition,
  BadgeStatus,
  StreakConfig,
  StreakInfo,
  HealthScore,
  HealthMetric,
  MilestoneDefinition,
  MilestoneStatus,
  XPRule,
  XPAward,
} from "./types.js";

export {
  createProfile,
  awardXP,
  resetWindow,
  computeLevel,
  getLevelInfo,
  evaluateCondition,
  conditionProgress,
  getBadgeStatuses,
  recordStreakActivity,
  getStreakInfo,
  computeHealth,
  getMilestoneStatuses,
  rankLeaderboard,
} from "./engine.js";

export type { LeaderboardEntry, RankedEntry } from "./engine.js";
