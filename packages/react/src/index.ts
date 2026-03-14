// Provider
export { PavlovProvider } from "./provider.js";
export type { PavlovProviderProps } from "./provider.js";

// Context
export { usePavlovContext, PavlovContext } from "./context.js";
export type { PavlovAdapter, PavlovContextValue } from "./context.js";

// Hooks
export {
  usePavlov,
  useXP,
  useBadges,
  useStreaks,
  useHealth,
  useMilestones,
  useLeaderboard,
  useActivity,
} from "./hooks.js";

export type { UseXPResult, ActivityEvent, UseActivityOptions } from "./hooks.js";

// Re-export core types consumers will need
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
  LeaderboardEntry,
  RankedEntry,
} from "@digitalforgestudios/pavlov-core";
