import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createProfile,
  awardXP,
  recordStreakActivity,
} from "@digitalforgestudios/pavlov-core";
import type { PavlovConfig, PavlovProfile, XPAward } from "@digitalforgestudios/pavlov-core";
import { PavlovContext, type PavlovAdapter } from "./context.js";

export interface PavlovProviderProps {
  config: PavlovConfig;
  adapter: PavlovAdapter;
  children: React.ReactNode;
}

export function PavlovProvider({ config, adapter, children }: PavlovProviderProps) {
  const [profile, setProfile] = useState<PavlovProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastAward, setLastAward] = useState<XPAward | null>(null);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const p = await adapterRef.current.getProfile();
      setProfile(p);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const track = useCallback(
    async (event: string): Promise<XPAward | null> => {
      const current = profile ?? createProfile();
      const now = Date.now();

      // Award XP
      const { profile: afterXP, award } = awardXP(config, current, event, now);

      // Record streak activity
      const afterStreak = recordStreakActivity(config, afterXP, now);

      setProfile(afterStreak);
      setLastAward(award);

      // Persist
      try {
        await adapterRef.current.saveProfile(afterStreak);
        await adapterRef.current.trackEvent?.(event);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }

      return award;
    },
    [config, profile],
  );

  return (
    <PavlovContext.Provider
      value={{ config, profile, loading, error, track, refresh, lastAward }}
    >
      {children}
    </PavlovContext.Provider>
  );
}
