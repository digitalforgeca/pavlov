import { describe, it, expect } from "vitest";
import {
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
import type { PavlovConfig, PavlovProfile } from "./types.js";

const testConfig: PavlovConfig = {
  levels: [
    { xp: 0, name: "Bronze" },
    { xp: 100, name: "Silver" },
    { xp: 500, name: "Gold" },
    { xp: 2000, name: "Platinum" },
  ],
  xpRules: {
    "task.complete": 10,
    "login": { base: 5, maxPerWindow: 1 },
    "spam.action": { base: 10, diminishing: 0.5 },
    "boosted": { base: 10, multiplier: 2 },
  },
  badges: [
    {
      id: "first_task",
      name: "First Task",
      condition: { event: "task.complete", count: 1 },
    },
    {
      id: "ten_tasks",
      name: "Ten Tasks",
      condition: { event: "task.complete", count: 10 },
    },
    {
      id: "all_rounder",
      name: "All Rounder",
      condition: {
        op: "and",
        conditions: [
          { event: "task.complete", count: 5 },
          { event: "login", count: 3 },
        ],
      },
    },
  ],
  streaks: {
    window: "day",
    grace: 1,
  },
  health: [
    { key: "tasks", weight: 0.6, min: 0, max: 100 },
    { key: "engagement", weight: 0.4, min: 0, max: 10 },
  ],
  milestones: [
    { id: "m1", name: "First 50", target: 50, metric: "tasks" },
    { id: "m2", name: "Century", target: 100, metric: "tasks" },
  ],
};

// ─── Profile ─────────────────────────────────────────────────────

describe("createProfile", () => {
  it("creates a zeroed profile", () => {
    const p = createProfile();
    expect(p.xp).toBe(0);
    expect(p.level).toBe(0);
    expect(p.streak).toBe(0);
    expect(p.earnedBadges).toEqual([]);
    expect(p.eventCounts).toEqual({});
  });
});

// ─── XP ──────────────────────────────────────────────────────────

describe("awardXP", () => {
  it("awards base XP for a simple rule", () => {
    const p = createProfile();
    const { profile, award } = awardXP(testConfig, p, "task.complete");
    expect(award.effective).toBe(10);
    expect(profile.xp).toBe(10);
    expect(profile.eventCounts["task.complete"]).toBe(1);
  });

  it("awards 0 XP for unknown events", () => {
    const p = createProfile();
    const { profile, award } = awardXP(testConfig, p, "unknown.event");
    expect(award.effective).toBe(0);
    expect(profile.xp).toBe(0);
  });

  it("applies multiplier", () => {
    const p = createProfile();
    const { award } = awardXP(testConfig, p, "boosted");
    expect(award.effective).toBe(20);
  });

  it("respects maxPerWindow", () => {
    let p = createProfile();
    const r1 = awardXP(testConfig, p, "login");
    expect(r1.award.effective).toBe(5);
    p = r1.profile;

    const r2 = awardXP(testConfig, p, "login");
    expect(r2.award.effective).toBe(0);
    expect(r2.profile.xp).toBe(5); // no additional XP
  });

  it("resets window counts", () => {
    let p = createProfile();
    p = awardXP(testConfig, p, "login").profile;
    expect(awardXP(testConfig, p, "login").award.effective).toBe(0);

    p = resetWindow(p);
    expect(awardXP(testConfig, p, "login").award.effective).toBe(5);
  });

  it("applies diminishing returns", () => {
    let p = createProfile();
    const r1 = awardXP(testConfig, p, "spam.action");
    expect(r1.award.effective).toBe(10); // first: full

    const r2 = awardXP(testConfig, r1.profile, "spam.action");
    expect(r2.award.effective).toBe(5); // second: 10 * 0.5

    const r3 = awardXP(testConfig, r2.profile, "spam.action");
    expect(r3.award.effective).toBe(3); // third: 10 * 0.25 ≈ 3 (rounded)
  });

  it("detects level ups", () => {
    let p = createProfile();
    // Award enough for level 1 (100 XP)
    for (let i = 0; i < 9; i++) {
      p = awardXP(testConfig, p, "task.complete").profile;
    }
    expect(p.level).toBe(0);
    expect(p.xp).toBe(90);

    const result = awardXP(testConfig, p, "task.complete");
    expect(result.award.levelUp).toBe(true);
    expect(result.profile.level).toBe(1);
  });

  it("awards badges when conditions met", () => {
    const p = createProfile();
    const { award } = awardXP(testConfig, p, "task.complete");
    expect(award.badgesEarned).toContain("first_task");
  });

  it("does not re-award earned badges", () => {
    let p = createProfile();
    p = awardXP(testConfig, p, "task.complete").profile;
    expect(p.earnedBadges).toContain("first_task");

    const r2 = awardXP(testConfig, p, "task.complete");
    expect(r2.award.badgesEarned).not.toContain("first_task");
  });
});

// ─── Levels ──────────────────────────────────────────────────────

describe("computeLevel", () => {
  it("returns 0 for 0 XP", () => {
    expect(computeLevel(testConfig, 0)).toBe(0);
  });

  it("returns correct level for exact threshold", () => {
    expect(computeLevel(testConfig, 100)).toBe(1);
    expect(computeLevel(testConfig, 500)).toBe(2);
  });

  it("returns correct level for between thresholds", () => {
    expect(computeLevel(testConfig, 250)).toBe(1);
  });

  it("returns max level for high XP", () => {
    expect(computeLevel(testConfig, 99999)).toBe(3);
  });
});

describe("getLevelInfo", () => {
  it("computes progress correctly", () => {
    const p: PavlovProfile = { ...createProfile(), xp: 300, level: 1 };
    const info = getLevelInfo(testConfig, p);
    expect(info.current.name).toBe("Silver");
    expect(info.next?.name).toBe("Gold");
    expect(info.progress).toBeCloseTo(0.5);
    expect(info.xpToNext).toBe(200);
  });

  it("handles max level", () => {
    const p: PavlovProfile = { ...createProfile(), xp: 5000, level: 3 };
    const info = getLevelInfo(testConfig, p);
    expect(info.next).toBeNull();
    expect(info.progress).toBe(1);
    expect(info.xpToNext).toBe(0);
  });
});

// ─── Badges ──────────────────────────────────────────────────────

describe("evaluateCondition", () => {
  it("evaluates simple conditions", () => {
    expect(evaluateCondition({ event: "x", count: 5 }, { x: 5 })).toBe(true);
    expect(evaluateCondition({ event: "x", count: 5 }, { x: 4 })).toBe(false);
  });

  it("evaluates AND compound conditions", () => {
    const cond = {
      op: "and" as const,
      conditions: [
        { event: "a", count: 3 },
        { event: "b", count: 2 },
      ],
    };
    expect(evaluateCondition(cond, { a: 3, b: 2 })).toBe(true);
    expect(evaluateCondition(cond, { a: 3, b: 1 })).toBe(false);
  });

  it("evaluates OR compound conditions", () => {
    const cond = {
      op: "or" as const,
      conditions: [
        { event: "a", count: 10 },
        { event: "b", count: 1 },
      ],
    };
    expect(evaluateCondition(cond, { a: 0, b: 1 })).toBe(true);
    expect(evaluateCondition(cond, { a: 0, b: 0 })).toBe(false);
  });
});

describe("conditionProgress", () => {
  it("returns partial progress", () => {
    expect(conditionProgress({ event: "x", count: 10 }, { x: 3 })).toBeCloseTo(0.3);
  });

  it("caps at 1.0", () => {
    expect(conditionProgress({ event: "x", count: 5 }, { x: 10 })).toBe(1);
  });
});

describe("getBadgeStatuses", () => {
  it("returns all badge statuses", () => {
    const p: PavlovProfile = {
      ...createProfile(),
      eventCounts: { "task.complete": 7, login: 3 },
      earnedBadges: ["first_task"],
    };
    const statuses = getBadgeStatuses(testConfig, p);
    expect(statuses).toHaveLength(3);

    const first = statuses.find((s) => s.definition.id === "first_task");
    expect(first?.earned).toBe(true);

    const ten = statuses.find((s) => s.definition.id === "ten_tasks");
    expect(ten?.earned).toBe(false);
    expect(ten?.progress).toBeCloseTo(0.7);

    const allRound = statuses.find((s) => s.definition.id === "all_rounder");
    expect(allRound?.earned).toBe(false);
    // AND: avg of (7/5=1, 3/3=1) = 1
    expect(allRound?.progress).toBe(1);
  });
});

// ─── Streaks ─────────────────────────────────────────────────────

describe("streaks", () => {
  const DAY = 86_400_000;

  it("starts streak at 1 on first activity", () => {
    const p = createProfile();
    const updated = recordStreakActivity(testConfig, p, 1000);
    expect(updated.streak).toBe(1);
  });

  it("increments streak for next-day activity", () => {
    let p = createProfile();
    p = recordStreakActivity(testConfig, p, 1000);
    p = recordStreakActivity(testConfig, p, 1000 + DAY);
    expect(p.streak).toBe(2);
  });

  it("maintains streak within grace period", () => {
    let p = createProfile();
    p = recordStreakActivity(testConfig, p, 1000);
    // Skip one day (grace = 1), activity on day 3
    p = recordStreakActivity(testConfig, p, 1000 + DAY * 2);
    expect(p.streak).toBe(2);
  });

  it("breaks streak beyond grace period", () => {
    let p = createProfile();
    p = recordStreakActivity(testConfig, p, 1000);
    p = recordStreakActivity(testConfig, p, 1000 + DAY);
    expect(p.streak).toBe(2);
    // Skip 2 days (grace = 1), activity on day 4
    p = recordStreakActivity(testConfig, p, 1000 + DAY * 4);
    expect(p.streak).toBe(1);
  });

  it("tracks best streak", () => {
    let p = createProfile();
    p = recordStreakActivity(testConfig, p, 1000);
    p = recordStreakActivity(testConfig, p, 1000 + DAY);
    p = recordStreakActivity(testConfig, p, 1000 + DAY * 2);
    expect(p.bestStreak).toBe(3);

    // Break and start new
    p = recordStreakActivity(testConfig, p, 1000 + DAY * 10);
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(3); // preserved
  });

  it("getStreakInfo reports active status", () => {
    let p = createProfile();
    p = recordStreakActivity(testConfig, p, 1000);
    p = recordStreakActivity(testConfig, p, 1000 + DAY);

    const active = getStreakInfo(testConfig, p, 1000 + DAY + 1000);
    expect(active.active).toBe(true);
    expect(active.current).toBe(2);

    const broken = getStreakInfo(testConfig, p, 1000 + DAY * 5);
    expect(broken.active).toBe(false);
    expect(broken.current).toBe(0);
  });

  it("same-window activity does not increment streak", () => {
    let p = createProfile();
    p = recordStreakActivity(testConfig, p, 1000);
    p = recordStreakActivity(testConfig, p, 2000); // same day
    expect(p.streak).toBe(1);
  });
});

// ─── Health ──────────────────────────────────────────────────────

describe("computeHealth", () => {
  it("computes weighted composite", () => {
    const result = computeHealth(testConfig.health!, {
      tasks: 50, // 0.5 normalized
      engagement: 10, // 1.0 normalized
    });
    // (0.5 * 0.6 + 1.0 * 0.4) / (0.6 + 0.4) = 0.7
    expect(result.composite).toBeCloseTo(0.7);
    expect(result.breakdown.tasks).toBeCloseTo(0.5);
    expect(result.breakdown.engagement).toBeCloseTo(1.0);
  });

  it("clamps values to 0-1", () => {
    const result = computeHealth(testConfig.health!, {
      tasks: 200,
      engagement: -5,
    });
    expect(result.breakdown.tasks).toBe(1);
    expect(result.breakdown.engagement).toBe(0);
  });
});

// ─── Milestones ──────────────────────────────────────────────────

describe("getMilestoneStatuses", () => {
  it("computes milestone progress", () => {
    const statuses = getMilestoneStatuses(testConfig, { tasks: 75 });
    expect(statuses).toHaveLength(2);

    expect(statuses[0].complete).toBe(true);
    expect(statuses[0].progress).toBe(1);

    expect(statuses[1].complete).toBe(false);
    expect(statuses[1].progress).toBeCloseTo(0.75);
  });
});

// ─── Leaderboard ─────────────────────────────────────────────────

describe("rankLeaderboard", () => {
  it("sorts by XP descending and assigns ranks", () => {
    const entries = [
      { id: "a", name: "Alice", xp: 100, level: 1 },
      { id: "b", name: "Bob", xp: 500, level: 2 },
      { id: "c", name: "Carol", xp: 250, level: 1 },
    ];
    const ranked = rankLeaderboard(entries);
    expect(ranked[0].name).toBe("Bob");
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].name).toBe("Carol");
    expect(ranked[1].rank).toBe(2);
    expect(ranked[2].name).toBe("Alice");
    expect(ranked[2].rank).toBe(3);
  });

  it("handles empty array", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });
});
