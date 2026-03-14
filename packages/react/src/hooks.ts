import { useMemo } from "react";
import {
  getLevelInfo,
  getBadgeStatuses,
  getStreakInfo,
  computeHealth,
  getMilestoneStatuses,
  rankLeaderboard,
} from "@digitalforgestudios/pavlov-core";
import type {
  LevelInfo,
  BadgeStatus,
  StreakInfo,
  HealthScore,
  HealthMetric,
  MilestoneStatus,
  LeaderboardEntry,
  RankedEntry,
  XPAward,
} from "@digitalforgestudios/pavlov-core";
import { usePavlovContext } from "./context.js";

// ─── Master Hook ─────────────────────────────────────────────────

/** Master hook — returns everything. For convenience. */
export function usePavlov() {
  return usePavlovContext();
}

// ─── XP ──────────────────────────────────────────────────────────

export interface UseXPResult {
  xp: number;
  level: LevelInfo | null;
  track: (event: string) => Promise<XPAward | null>;
  lastAward: XPAward | null;
}

export function useXP(): UseXPResult {
  const { config, profile, track, lastAward } = usePavlovContext();

  const level = useMemo(() => {
    if (!profile) return null;
    return getLevelInfo(config, profile);
  }, [config, profile]);

  return {
    xp: profile?.xp ?? 0,
    level,
    track,
    lastAward,
  };
}

// ─── Badges ──────────────────────────────────────────────────────

export function useBadges(): BadgeStatus[] {
  const { config, profile } = usePavlovContext();

  return useMemo(() => {
    if (!profile) return [];
    return getBadgeStatuses(config, profile);
  }, [config, profile]);
}

// ─── Streaks ─────────────────────────────────────────────────────

export function useStreaks(): StreakInfo {
  const { config, profile } = usePavlovContext();

  return useMemo(() => {
    if (!profile) return { current: 0, best: 0, active: false };
    return getStreakInfo(config, profile);
  }, [config, profile]);
}

// ─── Health ──────────────────────────────────────────────────────

export function useHealth(values: Record<string, number>): HealthScore {
  const { config } = usePavlovContext();

  return useMemo(() => {
    if (!config.health) return { composite: 0, breakdown: {} };
    return computeHealth(config.health, values);
  }, [config.health, values]);
}

// ─── Milestones ──────────────────────────────────────────────────

export function useMilestones(values: Record<string, number>): MilestoneStatus[] {
  const { config } = usePavlovContext();

  return useMemo(() => {
    return getMilestoneStatuses(config, values);
  }, [config, values]);
}

// ─── Leaderboard ─────────────────────────────────────────────────

export function useLeaderboard(entries: LeaderboardEntry[]): RankedEntry[] {
  return useMemo(() => rankLeaderboard(entries), [entries]);
}

// ─── Activity Feed ───────────────────────────────────────────────

export interface ActivityEvent {
  event: string;
  timestamp: number;
  xp?: number;
  metadata?: Record<string, unknown>;
}

export interface UseActivityOptions {
  /** Maximum events to display. */
  limit?: number;
}

/**
 * Simple activity feed hook.
 * Feed events externally — this hook just sorts and limits.
 */
export function useActivity(
  events: ActivityEvent[],
  options: UseActivityOptions = {},
): ActivityEvent[] {
  const { limit = 50 } = options;

  return useMemo(() => {
    return [...events]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }, [events, limit]);
}
