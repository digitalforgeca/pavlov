import { createContext, useContext } from "react";
import type { PavlovConfig, PavlovProfile, XPAward } from "@digitalforgestudios/pavlov-core";

// ─── Backend Adapter ─────────────────────────────────────────────

/** Adapter interface for persisting gamification state. */
export interface PavlovAdapter {
  /** Load the current user's profile. */
  getProfile(): Promise<PavlovProfile>;
  /** Persist updated profile after state changes. */
  saveProfile(profile: PavlovProfile): Promise<void>;
  /** Track an event (server-side recording, optional). */
  trackEvent?(event: string, metadata?: Record<string, unknown>): Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────

export interface PavlovContextValue {
  config: PavlovConfig;
  profile: PavlovProfile | null;
  loading: boolean;
  error: Error | null;
  /** Track an event — awards XP, checks badges, updates streaks. */
  track: (event: string) => Promise<XPAward | null>;
  /** Force reload profile from adapter. */
  refresh: () => Promise<void>;
  /** Last XP award (for animations/toasts). */
  lastAward: XPAward | null;
}

export const PavlovContext = createContext<PavlovContextValue | null>(null);

export function usePavlovContext(): PavlovContextValue {
  const ctx = useContext(PavlovContext);
  if (!ctx) {
    throw new Error("usePavlov* hooks must be used within a <PavlovProvider>");
  }
  return ctx;
}
