import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/** Base key; completion is stored per user as `${REVEAL_COMPLETED_KEY}:${userId}`. */
export const REVEAL_COMPLETED_KEY = "kwit_reveal_completed";

function revealCompletedKeyForUser(userId: string): string {
  return `${REVEAL_COMPLETED_KEY}:${userId}`;
}

function isMissingRevealColumnError(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "");
  return (
    code === "42703" ||
    msg.includes("reveal_completed") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

function parseRevealCompletedFromRow(row: Record<string, unknown> | undefined): boolean {
  if (!row) return false;
  const v = row.reveal_completed;
  return v === true || v === "true" || v === 1;
}

export type PostAuthRoute = "/home" | "/onboarding/welcome" | "/onboarding/reveal";

/**
 * Where to send a signed-in user: home only after reveal is done; otherwise
 * welcome (no profile) or reveal (profile saved from questions but reveal not finished).
 *
 * Reveal completion is read from `profiles.reveal_completed` when the column exists,
 * and from AsyncStorage as a fallback / cache.
 */
export async function getPostAuthRouteForSession(): Promise<PostAuthRoute> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return "/onboarding/welcome";
  }

  const userKey = revealCompletedKeyForUser(user.id);
  let asyncRevealDone = (await AsyncStorage.getItem(userKey)) === "true";
  if (!asyncRevealDone) {
    const legacy = await AsyncStorage.getItem(REVEAL_COMPLETED_KEY);
    if (legacy === "true") {
      await AsyncStorage.setItem(userKey, "true");
      await AsyncStorage.removeItem(REVEAL_COMPLETED_KEY);
      asyncRevealDone = true;
    }
  }

  let row: Record<string, unknown> | undefined;
  let dbRevealDone = false;

  const withReveal = await supabase
    .from("profiles")
    .select("first_name, weekly_spend, reveal_completed")
    .eq("id", user.id)
    .limit(1);

  if (withReveal.error && isMissingRevealColumnError(withReveal.error)) {
    const basic = await supabase
      .from("profiles")
      .select("first_name, weekly_spend")
      .eq("id", user.id)
      .limit(1);
    row = basic.data?.[0] as Record<string, unknown> | undefined;
    dbRevealDone = false;
  } else if (withReveal.error) {
    row = undefined;
    dbRevealDone = false;
  } else {
    row = withReveal.data?.[0] as Record<string, unknown> | undefined;
    dbRevealDone = parseRevealCompletedFromRow(row);
  }

  const firstName = String(row?.first_name ?? "").trim();
  const spendRaw = row?.weekly_spend;
  const weeklySpend =
    spendRaw === null || spendRaw === undefined ? NaN : Number(spendRaw);
  const hasCompletedQuestions =
    firstName.length > 0 && Number.isFinite(weeklySpend) && weeklySpend >= 0;

  const revealDone = dbRevealDone || asyncRevealDone;

  if (revealDone) {
    return "/home";
  }
  if (hasCompletedQuestions) {
    return "/onboarding/reveal";
  }
  return "/onboarding/welcome";
}

export async function markRevealCompletedAsync(userId: string): Promise<void> {
  await AsyncStorage.setItem(revealCompletedKeyForUser(userId), "true");
  await AsyncStorage.removeItem(REVEAL_COMPLETED_KEY);

  const { error } = await supabase
    .from("profiles")
    .update({ reveal_completed: true })
    .eq("id", userId);

  if (error && !isMissingRevealColumnError(error)) {
    console.warn("[onboardingRouting] reveal_completed update:", error.message);
  }
}

/** Clears reveal completion for this account (e.g. dev replay). */
export async function clearRevealCompletedForUserAsync(
  userId: string
): Promise<void> {
  await AsyncStorage.removeItem(revealCompletedKeyForUser(userId));
  await AsyncStorage.removeItem(REVEAL_COMPLETED_KEY);

  const { error } = await supabase
    .from("profiles")
    .update({ reveal_completed: false })
    .eq("id", userId);

  if (error && !isMissingRevealColumnError(error)) {
    console.warn("[onboardingRouting] reveal_completed clear:", error.message);
  }
}
