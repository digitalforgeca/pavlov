// ─── Configuration ───────────────────────────────────────────────

/** XP curve function: given a level index, returns XP required. */
export type XPCurve = (level: number) => number;

export interface LevelDefinition {
  /** XP threshold to reach this level. */
  xp: number;
  /** Display name. */
  name: string;
  /** Optional icon/emoji. */
  icon?: string;
}

export interface BadgeCondition {
  /** Event name to track. */
  event: string;
  /** Number of times event must fire. */
  count: number;
}

export interface CompoundBadgeCondition {
  /** Logical operator. */
  op: "and" | "or";
  /** Sub-conditions. */
  conditions: Array<BadgeCondition | CompoundBadgeCondition>;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  /** Simple or compound condition. */
  condition: BadgeCondition | CompoundBadgeCondition;
}

export interface StreakConfig {
  /** Time window for streak tracking. */
  window: "day" | "week" | "hour" | "custom";
  /** Grace periods allowed (e.g., 1 = one missed window keeps streak). */
  grace?: number;
  /** Custom window duration in ms (only used when window="custom"). */
  customWindowMs?: number;
}

export interface XPRule {
  /** Base XP awarded. */
  base: number;
  /** Optional multiplier (default 1). */
  multiplier?: number;
  /** Max times per window this event awards XP (anti-gaming). 0 = unlimited. */
  maxPerWindow?: number;
  /** Diminishing returns: factor applied each subsequent award in the same window. */
  diminishing?: number;
}

export interface HealthMetric {
  /** Unique metric key. */
  key: string;
  /** Weight in composite score (0-1). */
  weight: number;
  /** Minimum value for scaling. */
  min?: number;
  /** Maximum value for scaling. */
  max?: number;
}

export interface MilestoneDefinition {
  id: string;
  name: string;
  description?: string;
  /** Target value. */
  target: number;
  /** Current value getter key (matches a metric or custom key). */
  metric: string;
  icon?: string;
}

export interface PavlovConfig {
  /** Level definitions, ordered by ascending XP. */
  levels: LevelDefinition[];
  /** Event-to-XP rules. Key is event name. */
  xpRules: Record<string, number | XPRule>;
  /** Badge definitions. */
  badges?: BadgeDefinition[];
  /** Streak configuration. */
  streaks?: StreakConfig;
  /** Health score metrics. */
  health?: HealthMetric[];
  /** Progress milestones. */
  milestones?: MilestoneDefinition[];
}

// ─── State ───────────────────────────────────────────────────────

export interface PavlovProfile {
  /** Total XP earned. */
  xp: number;
  /** Current level index. */
  level: number;
  /** Event counts: event name → total count. */
  eventCounts: Record<string, number>;
  /** Event counts within current window (for rate limiting). */
  windowCounts: Record<string, number>;
  /** IDs of earned badges. */
  earnedBadges: string[];
  /** Current streak count. */
  streak: number;
  /** Best streak ever. */
  bestStreak: number;
  /** Timestamp of last activity (ms since epoch). */
  lastActivity: number;
  /** Timestamp of last streak-qualifying activity. */
  lastStreakActivity: number;
}

export interface LevelInfo {
  /** Current level index. */
  index: number;
  /** Current level definition. */
  current: LevelDefinition;
  /** Next level definition (null if max). */
  next: LevelDefinition | null;
  /** XP progress toward next level (0-1). */
  progress: number;
  /** XP needed for next level. */
  xpToNext: number;
}

export interface BadgeStatus {
  definition: BadgeDefinition;
  earned: boolean;
  /** Progress toward earning (0-1). */
  progress: number;
}

export interface StreakInfo {
  current: number;
  best: number;
  /** Whether the streak is still active (within grace window). */
  active: boolean;
}

export interface HealthScore {
  /** Composite score (0-1). */
  composite: number;
  /** Per-metric breakdown. */
  breakdown: Record<string, number>;
}

export interface MilestoneStatus {
  definition: MilestoneDefinition;
  current: number;
  progress: number;
  complete: boolean;
}

export interface XPAward {
  event: string;
  amount: number;
  /** XP after diminishing returns. */
  effective: number;
  newTotal: number;
  levelUp: boolean;
  badgesEarned: string[];
}
