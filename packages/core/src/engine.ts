import type {
  PavlovConfig,
  PavlovProfile,
  LevelInfo,
  BadgeStatus,
  BadgeCondition,
  CompoundBadgeCondition,
  BadgeDefinition,
  StreakInfo,
  StreakConfig,
  HealthScore,
  HealthMetric,
  MilestoneStatus,
  MilestoneDefinition,
  XPAward,
  XPRule,
} from "./types.js";

// ─── Profile ─────────────────────────────────────────────────────

/** Create a fresh profile with zero state. */
export function createProfile(): PavlovProfile {
  return {
    xp: 0,
    level: 0,
    eventCounts: {},
    windowCounts: {},
    earnedBadges: [],
    streak: 0,
    bestStreak: 0,
    lastActivity: 0,
    lastStreakActivity: 0,
  };
}

// ─── XP ──────────────────────────────────────────────────────────

function resolveRule(rule: number | XPRule): XPRule {
  if (typeof rule === "number") {
    return { base: rule };
  }
  return rule;
}

/**
 * Award XP for an event. Returns the award details and a new profile.
 * Pure function — does not mutate the input profile.
 */
export function awardXP(
  config: PavlovConfig,
  profile: PavlovProfile,
  event: string,
  now: number = Date.now(),
): { profile: PavlovProfile; award: XPAward } {
  const ruleEntry = config.xpRules[event];
  if (ruleEntry === undefined) {
    return {
      profile,
      award: {
        event,
        amount: 0,
        effective: 0,
        newTotal: profile.xp,
        levelUp: false,
        badgesEarned: [],
      },
    };
  }

  const rule = resolveRule(ruleEntry);
  const multiplier = rule.multiplier ?? 1;
  const baseAmount = rule.base * multiplier;

  // Window count for rate limiting
  const windowCount = (profile.windowCounts[event] ?? 0) + 1;

  // Check max per window
  if (rule.maxPerWindow && rule.maxPerWindow > 0 && windowCount > rule.maxPerWindow) {
    return {
      profile: {
        ...profile,
        eventCounts: {
          ...profile.eventCounts,
          [event]: (profile.eventCounts[event] ?? 0) + 1,
        },
        windowCounts: {
          ...profile.windowCounts,
          [event]: windowCount,
        },
        lastActivity: now,
      },
      award: {
        event,
        amount: baseAmount,
        effective: 0,
        newTotal: profile.xp,
        levelUp: false,
        badgesEarned: [],
      },
    };
  }

  // Diminishing returns
  let effective = baseAmount;
  if (rule.diminishing !== undefined && rule.diminishing < 1 && windowCount > 1) {
    effective = Math.round(baseAmount * Math.pow(rule.diminishing, windowCount - 1));
  }

  const newXP = profile.xp + effective;
  const oldLevel = profile.level;
  const newLevel = computeLevel(config, newXP);

  // Update event counts
  const newEventCounts = {
    ...profile.eventCounts,
    [event]: (profile.eventCounts[event] ?? 0) + 1,
  };

  // Check newly earned badges
  const newBadges: string[] = [];
  if (config.badges) {
    for (const badge of config.badges) {
      if (profile.earnedBadges.includes(badge.id)) continue;
      if (evaluateCondition(badge.condition, newEventCounts)) {
        newBadges.push(badge.id);
      }
    }
  }

  const newProfile: PavlovProfile = {
    ...profile,
    xp: newXP,
    level: newLevel,
    eventCounts: newEventCounts,
    windowCounts: {
      ...profile.windowCounts,
      [event]: windowCount,
    },
    earnedBadges: [...profile.earnedBadges, ...newBadges],
    lastActivity: now,
  };

  return {
    profile: newProfile,
    award: {
      event,
      amount: baseAmount,
      effective,
      newTotal: newXP,
      levelUp: newLevel > oldLevel,
      badgesEarned: newBadges,
    },
  };
}

/** Reset window counts (call at the start of each time window). */
export function resetWindow(profile: PavlovProfile): PavlovProfile {
  return { ...profile, windowCounts: {} };
}

// ─── Levels ──────────────────────────────────────────────────────

/** Compute level index from XP. */
export function computeLevel(config: PavlovConfig, xp: number): number {
  let level = 0;
  for (let i = config.levels.length - 1; i >= 0; i--) {
    if (xp >= config.levels[i].xp) {
      level = i;
      break;
    }
  }
  return level;
}

/** Get detailed level info for a profile. */
export function getLevelInfo(config: PavlovConfig, profile: PavlovProfile): LevelInfo {
  const index = profile.level;
  const current = config.levels[index];
  const next = index + 1 < config.levels.length ? config.levels[index + 1] : null;

  let progress = 1;
  let xpToNext = 0;

  if (next) {
    const range = next.xp - current.xp;
    const earned = profile.xp - current.xp;
    progress = range > 0 ? Math.min(1, earned / range) : 1;
    xpToNext = Math.max(0, next.xp - profile.xp);
  }

  return { index, current, next, progress, xpToNext };
}

// ─── Badges ──────────────────────────────────────────────────────

function isCompound(
  cond: BadgeCondition | CompoundBadgeCondition,
): cond is CompoundBadgeCondition {
  return "op" in cond;
}

/** Evaluate whether a badge condition is met. */
export function evaluateCondition(
  condition: BadgeCondition | CompoundBadgeCondition,
  eventCounts: Record<string, number>,
): boolean {
  if (isCompound(condition)) {
    const results = condition.conditions.map((c) =>
      evaluateCondition(c, eventCounts),
    );
    return condition.op === "and"
      ? results.every(Boolean)
      : results.some(Boolean);
  }
  return (eventCounts[condition.event] ?? 0) >= condition.count;
}

/** Get progress toward a badge condition (0-1). */
export function conditionProgress(
  condition: BadgeCondition | CompoundBadgeCondition,
  eventCounts: Record<string, number>,
): number {
  if (isCompound(condition)) {
    const progresses = condition.conditions.map((c) =>
      conditionProgress(c, eventCounts),
    );
    if (condition.op === "and") {
      // AND: average of all sub-conditions
      return progresses.reduce((a, b) => a + b, 0) / progresses.length;
    }
    // OR: max of sub-conditions
    return Math.max(...progresses);
  }
  const count = eventCounts[condition.event] ?? 0;
  return Math.min(1, condition.count > 0 ? count / condition.count : 1);
}

/** Get status of all badges. */
export function getBadgeStatuses(
  config: PavlovConfig,
  profile: PavlovProfile,
): BadgeStatus[] {
  return (config.badges ?? []).map((badge) => ({
    definition: badge,
    earned: profile.earnedBadges.includes(badge.id),
    progress: conditionProgress(badge.condition, profile.eventCounts),
  }));
}

// ─── Streaks ─────────────────────────────────────────────────────

function getWindowMs(streakConfig: StreakConfig): number {
  switch (streakConfig.window) {
    case "hour":
      return 3_600_000;
    case "day":
      return 86_400_000;
    case "week":
      return 604_800_000;
    case "custom":
      return streakConfig.customWindowMs ?? 86_400_000;
  }
}

/** Record a streak-qualifying activity. Returns updated profile. */
export function recordStreakActivity(
  config: PavlovConfig,
  profile: PavlovProfile,
  now: number = Date.now(),
): PavlovProfile {
  const streakConfig = config.streaks;
  if (!streakConfig) return { ...profile, lastStreakActivity: now };

  const windowMs = getWindowMs(streakConfig);
  const grace = streakConfig.grace ?? 0;
  const elapsed = now - profile.lastStreakActivity;
  const windowsElapsed = profile.lastStreakActivity > 0
    ? Math.floor(elapsed / windowMs)
    : 0;

  let newStreak: number;

  if (profile.lastStreakActivity === 0) {
    // First activity ever
    newStreak = 1;
  } else if (windowsElapsed <= 0) {
    // Same window — no streak change
    newStreak = profile.streak;
  } else if (windowsElapsed <= 1 + grace) {
    // Within grace — streak continues
    newStreak = profile.streak + 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  return {
    ...profile,
    streak: newStreak,
    bestStreak: Math.max(profile.bestStreak, newStreak),
    lastStreakActivity: now,
  };
}

/** Get streak info without modifying state. */
export function getStreakInfo(
  config: PavlovConfig,
  profile: PavlovProfile,
  now: number = Date.now(),
): StreakInfo {
  const streakConfig = config.streaks;
  if (!streakConfig) {
    return { current: profile.streak, best: profile.bestStreak, active: false };
  }

  const windowMs = getWindowMs(streakConfig);
  const grace = streakConfig.grace ?? 0;
  const elapsed = now - profile.lastStreakActivity;
  const windowsElapsed = profile.lastStreakActivity > 0
    ? Math.floor(elapsed / windowMs)
    : 0;

  const active = profile.lastStreakActivity > 0 && windowsElapsed <= 1 + grace;

  return {
    current: active ? profile.streak : 0,
    best: profile.bestStreak,
    active,
  };
}

// ─── Health Score ────────────────────────────────────────────────

/** Compute a weighted health score from metric values. */
export function computeHealth(
  metrics: HealthMetric[],
  values: Record<string, number>,
): HealthScore {
  const breakdown: Record<string, number> = {};
  let totalWeight = 0;
  let weightedSum = 0;

  for (const metric of metrics) {
    const raw = values[metric.key] ?? 0;
    const min = metric.min ?? 0;
    const max = metric.max ?? 100;
    const range = max - min;
    const normalized = range > 0 ? Math.min(1, Math.max(0, (raw - min) / range)) : 0;

    breakdown[metric.key] = normalized;
    weightedSum += normalized * metric.weight;
    totalWeight += metric.weight;
  }

  const composite = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return { composite, breakdown };
}

// ─── Milestones ──────────────────────────────────────────────────

/** Get status of all milestones. */
export function getMilestoneStatuses(
  config: PavlovConfig,
  values: Record<string, number>,
): MilestoneStatus[] {
  return (config.milestones ?? []).map((milestone) => {
    const current = values[milestone.metric] ?? 0;
    const progress = milestone.target > 0
      ? Math.min(1, current / milestone.target)
      : 1;
    return {
      definition: milestone,
      current,
      progress,
      complete: current >= milestone.target,
    };
  });
}

// ─── Leaderboard ─────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  name: string;
  xp: number;
  level: number;
  [key: string]: unknown;
}

export interface RankedEntry extends LeaderboardEntry {
  rank: number;
}

/** Sort and rank leaderboard entries. */
export function rankLeaderboard(entries: LeaderboardEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => b.xp - a.xp);
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}
