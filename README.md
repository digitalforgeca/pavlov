# 🔔 Pavlov

**Configurable gamification engine for React.**

Ring the bell. Get the response.

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `@digitalforgestudios/pavlov-core` | Pure logic engine — zero deps, works anywhere | [![npm](https://img.shields.io/npm/v/@digitalforgestudios/pavlov-core)](https://www.npmjs.com/package/@digitalforgestudios/pavlov-core) |
| `@digitalforgestudios/pavlov-react` | React hooks + headless components | [![npm](https://img.shields.io/npm/v/@digitalforgestudios/pavlov-react)](https://www.npmjs.com/package/@digitalforgestudios/pavlov-react) |

## Quick Start

```bash
npm install @digitalforgestudios/pavlov-core @digitalforgestudios/pavlov-react
```

### Define your config

```tsx
import type { PavlovConfig } from "@digitalforgestudios/pavlov-core";

const config: PavlovConfig = {
  levels: [
    { xp: 0, name: "Beginner" },
    { xp: 100, name: "Active" },
    { xp: 500, name: "Pro" },
    { xp: 2000, name: "Expert" },
  ],
  xpRules: {
    "task.complete": 10,
    "daily.login": { base: 5, maxPerWindow: 1 },
    "invite.sent": { base: 20, diminishing: 0.5 },
  },
  badges: [
    {
      id: "first_task",
      name: "First Task",
      condition: { event: "task.complete", count: 1 },
    },
    {
      id: "power_user",
      name: "Power User",
      condition: {
        op: "and",
        conditions: [
          { event: "task.complete", count: 50 },
          { event: "daily.login", count: 7 },
        ],
      },
    },
  ],
  streaks: {
    window: "day",
    grace: 1,
  },
};
```

### Wire it up

```tsx
import { PavlovProvider } from "@digitalforgestudios/pavlov-react";
import type { PavlovAdapter } from "@digitalforgestudios/pavlov-react";

const adapter: PavlovAdapter = {
  getProfile: () => fetch("/api/profile").then((r) => r.json()),
  saveProfile: (p) => fetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(p),
  }).then(() => {}),
};

function App() {
  return (
    <PavlovProvider config={config} adapter={adapter}>
      <YourApp />
    </PavlovProvider>
  );
}
```

### Use the hooks

```tsx
import { useXP, useBadges, useStreaks } from "@digitalforgestudios/pavlov-react";

function Dashboard() {
  const { xp, level, track, lastAward } = useXP();
  const badges = useBadges();
  const streak = useStreaks();

  return (
    <div>
      <h2>Level {level?.current.name} — {xp} XP</h2>
      <progress value={level?.progress} max={1} />

      <p>🔥 {streak.current} day streak (best: {streak.best})</p>

      <div>
        {badges.map((b) => (
          <span key={b.definition.id} style={{ opacity: b.earned ? 1 : 0.3 }}>
            {b.definition.name} ({Math.round(b.progress * 100)}%)
          </span>
        ))}
      </div>

      <button onClick={() => track("task.complete")}>
        Complete Task (+10 XP)
      </button>

      {lastAward?.levelUp && <div>🎉 Level Up!</div>}
    </div>
  );
}
```

## Core Engine (Standalone)

Don't use React? The core engine is framework-agnostic:

```ts
import {
  createProfile,
  awardXP,
  getLevelInfo,
  getBadgeStatuses,
  recordStreakActivity,
  computeHealth,
} from "@digitalforgestudios/pavlov-core";

let profile = createProfile();

const { profile: updated, award } = awardXP(config, profile, "task.complete");
console.log(award.effective); // 10
console.log(award.levelUp);   // false

const level = getLevelInfo(config, updated);
console.log(level.current.name); // "Beginner"
console.log(level.progress);     // 0.1
```

## Features

- **XP Engine** — event→XP mapping, multipliers, diminishing returns, rate limiting
- **Levels** — configurable thresholds with custom names and icons
- **Badges** — declarative conditions with AND/OR compound logic
- **Streaks** — daily/weekly/custom windows with grace periods
- **Health Scores** — weighted composite from arbitrary metrics
- **Milestones** — configurable progress tracking
- **Leaderboards** — sorted rankings with position tracking
- **Backend Agnostic** — bring your own persistence via the adapter interface
- **Headless** — zero CSS opinions, theme it however you want
- **Zero Dependencies** — core has 0 deps; React package peers on React 18+

## Philosophy

1. **Config over code** — define behavior declaratively, not procedurally
2. **Pure functions** — core engine has zero side effects, fully testable
3. **Backend agnostic** — works with any database, any API, any auth
4. **Headless first** — hooks return data, you decide how to render
5. **Anti-gaming built in** — diminishing returns, rate limits, window resets

## License

MIT — Digital Forge Studios
