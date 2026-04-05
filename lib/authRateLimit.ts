import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

type RateLimitState = {
  attempts: number;
  windowStartMs: number;
  lockUntilMs: number;
};

function getStorageKey(action: "login" | "signup", identifier: string): string {
  return `kwit_rate_limit:${action}:${identifier.toLowerCase()}`;
}

function newState(now: number): RateLimitState {
  return { attempts: 0, windowStartMs: now, lockUntilMs: 0 };
}

export async function canAttemptAuth(
  action: "login" | "signup",
  identifier: string
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const id = identifier.trim().toLowerCase();
  if (!id) return { allowed: true, retryAfterSeconds: 0 };

  const now = Date.now();
  const key = getStorageKey(action, id);
  const raw = await AsyncStorage.getItem(key);
  let state: RateLimitState = raw ? (JSON.parse(raw) as RateLimitState) : newState(now);

  if (state.lockUntilMs > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.lockUntilMs - now) / 1000),
    };
  }

  if (now - state.windowStartMs > WINDOW_MS) {
    state = newState(now);
    await AsyncStorage.setItem(key, JSON.stringify(state));
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordAuthFailure(
  action: "login" | "signup",
  identifier: string
): Promise<void> {
  const id = identifier.trim().toLowerCase();
  if (!id) return;

  const now = Date.now();
  const key = getStorageKey(action, id);
  const raw = await AsyncStorage.getItem(key);
  let state: RateLimitState = raw ? (JSON.parse(raw) as RateLimitState) : newState(now);

  if (now - state.windowStartMs > WINDOW_MS) {
    state = newState(now);
  }

  state.attempts += 1;
  if (state.attempts >= MAX_ATTEMPTS) {
    state.lockUntilMs = now + LOCK_MS;
    state.attempts = 0;
    state.windowStartMs = now;
  }

  await AsyncStorage.setItem(key, JSON.stringify(state));
}

export async function resetAuthRateLimit(
  action: "login" | "signup",
  identifier: string
): Promise<void> {
  const id = identifier.trim().toLowerCase();
  if (!id) return;
  await AsyncStorage.removeItem(getStorageKey(action, id));
}
