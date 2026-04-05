import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { motivationalQuotes } from "../constants/motivationalQuotes";
import { RECOVERY_MILESTONES } from "../constants/recoveryTimeline";
import { upsertProfile } from "./profileUpsert";
import { supabase } from "./supabase";

const NOTIFICATION_PREFS_KEY = "kwit_notification_preferences";
const NOTIFICATION_INIT_KEY = "kwit_notifications_initialized_v1";
const NOTIFICATION_PERMISSION_ASKED_KEY = "kwit_notifications_permission_asked_v1";
const LAST_APP_OPEN_MS_KEY = "kwit_last_app_open_ms_v1";

const DAILY_IDS_KEY = "kwit_notifications_daily_ids_v1";
const MILESTONE_IDS_KEY = "kwit_notifications_milestone_ids_v1";
const CRAVING_ID_KEY = "kwit_notifications_craving_id_v1";

export type NotificationPreferences = {
  dailyMotivation: boolean;
  milestoneAlerts: boolean;
  cravingCheckIns: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  dailyMotivation: true,
  milestoneAlerts: true,
  cravingCheckIns: false,
};

function pickRandomQuote(): string {
  if (!motivationalQuotes.length) return "Keep going. You're already doing it.";
  const idx = Math.floor(Math.random() * motivationalQuotes.length);
  return motivationalQuotes[idx] ?? motivationalQuotes[0]!;
}

function parseQuitDateToLocalMs(quitDate: unknown): number | null {
  if (!quitDate) return null;
  if (quitDate instanceof Date) return quitDate.getTime();
  if (typeof quitDate === "number" && Number.isFinite(quitDate)) return quitDate;
  if (typeof quitDate !== "string") return null;
  const match = quitDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
  }
  const parsed = new Date(quitDate).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

async function getCurrentUserProfileBasics(): Promise<{
  userId: string;
  quitMs: number | null;
} | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data: rows } = await supabase
    .from("profiles")
    .select("quit_date")
    .eq("id", userId)
    .limit(1);

  const row = rows?.[0] as Record<string, unknown> | undefined;
  return { userId, quitMs: parseQuitDateToLocalMs(row?.quit_date) };
}

async function readIds(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => String(v)).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeIds(key: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(ids));
}

export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3B82F6",
    });
  }
}

export async function ensureNotificationPermissionsAsync(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, "1");
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
}

export async function saveExpoPushTokenToProfileAsync(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  // Requires a physical device. On simulators this often throws; ignore gracefully.
  try {
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants.easConfig as any)?.projectId;

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const expoPushToken = token.data;
    if (!expoPushToken) return null;
    await upsertProfile(userId, { expo_push_token: expoPushToken });
    return expoPushToken;
  } catch {
    return null;
  }
}

export async function cancelDailyMotivationAsync(): Promise<void> {
  const ids = await readIds(DAILY_IDS_KEY);
  await Promise.allSettled(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await writeIds(DAILY_IDS_KEY, []);
}

export async function cancelMilestoneAlertsAsync(): Promise<void> {
  const ids = await readIds(MILESTONE_IDS_KEY);
  await Promise.allSettled(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await writeIds(MILESTONE_IDS_KEY, []);
}

export async function cancelCravingCheckInAsync(): Promise<void> {
  const existing = await AsyncStorage.getItem(CRAVING_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => undefined);
  }
  await AsyncStorage.removeItem(CRAVING_ID_KEY);
}

export async function scheduleDailyMotivationAsync(opts?: {
  quitMs?: number | null;
  daysToSchedule?: number;
}): Promise<void> {
  const basics = await getCurrentUserProfileBasics();
  const quitMs = typeof opts?.quitMs === "number" ? opts?.quitMs : basics?.quitMs ?? null;
  if (!quitMs) return;

  const daysToSchedule = Math.max(1, Math.min(90, opts?.daysToSchedule ?? 30));

  await cancelDailyMotivationAsync();

  const now = new Date();
  const base = new Date(now);
  base.setHours(9, 0, 0, 0);
  if (base.getTime() <= now.getTime()) {
    base.setDate(base.getDate() + 1);
  }

  const createdIds: string[] = [];
  for (let i = 0; i < daysToSchedule; i += 1) {
    const triggerDate = new Date(base);
    triggerDate.setDate(base.getDate() + i);

    const dayX = Math.max(1, Math.floor((triggerDate.getTime() - quitMs) / (24 * 60 * 60 * 1000)) + 1);
    const quote = pickRandomQuote();
    const body = `Day ${dayX} — keep going! ${quote}`;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Kwit",
        body,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    createdIds.push(id);
  }

  await writeIds(DAILY_IDS_KEY, createdIds);
}

export async function scheduleMilestoneAlertsAsync(opts?: {
  quitMs?: number | null;
}): Promise<void> {
  const basics = await getCurrentUserProfileBasics();
  const quitMs = typeof opts?.quitMs === "number" ? opts?.quitMs : basics?.quitMs ?? null;
  if (!quitMs) return;

  await cancelMilestoneAlertsAsync();

  const nowMs = Date.now();
  const createdIds: string[] = [];

  for (const milestone of RECOVERY_MILESTONES) {
    const reachMs = quitMs + milestone.timeMs;
    const alertMs = reachMs - 30 * 60 * 1000;
    if (alertMs <= nowMs) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Milestone coming up",
        body: `${milestone.title} in about 30 minutes.`,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(alertMs),
      },
    });
    createdIds.push(id);
  }

  await writeIds(MILESTONE_IDS_KEY, createdIds);
}

export async function recordAppOpenAsync(): Promise<void> {
  await AsyncStorage.setItem(LAST_APP_OPEN_MS_KEY, String(Date.now()));
}

export async function scheduleCravingCheckInAsync(opts?: { hours?: number }): Promise<void> {
  const hours = Math.max(1, Math.min(240, opts?.hours ?? 48));

  await cancelCravingCheckInAsync();

  const lastRaw = await AsyncStorage.getItem(LAST_APP_OPEN_MS_KEY);
  const lastMs = lastRaw ? Number(lastRaw) : Date.now();
  const triggerMs = lastMs + hours * 60 * 60 * 1000;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Kwit",
      body: "How are you holding up? We're here if you need us.",
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerMs),
    },
  });

  await AsyncStorage.setItem(CRAVING_ID_KEY, id);
}

let appStateSub: { remove: () => void } | null = null;

export function startInactivityTracker(opts: { cravingCheckInsEnabled: () => Promise<boolean> }): void {
  if (appStateSub) return;

  let lastState: AppStateStatus = AppState.currentState;

  appStateSub = AppState.addEventListener("change", (nextState) => {
    const wasBackground = lastState === "inactive" || lastState === "background";
    const isActive = nextState === "active";
    lastState = nextState;

    if (wasBackground && isActive) {
      void recordAppOpenAsync();
      void (async () => {
        const enabled = await opts.cravingCheckInsEnabled();
        if (enabled) {
          await scheduleCravingCheckInAsync({ hours: 48 });
        }
      })();
    }
  });
}

export function stopInactivityTracker(): void {
  appStateSub?.remove();
  appStateSub = null;
}

export async function getStoredNotificationPreferencesAsync(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return defaultNotificationPreferences;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      dailyMotivation:
        typeof parsed.dailyMotivation === "boolean"
          ? parsed.dailyMotivation
          : defaultNotificationPreferences.dailyMotivation,
      milestoneAlerts:
        typeof parsed.milestoneAlerts === "boolean"
          ? parsed.milestoneAlerts
          : defaultNotificationPreferences.milestoneAlerts,
      cravingCheckIns:
        typeof parsed.cravingCheckIns === "boolean"
          ? parsed.cravingCheckIns
          : defaultNotificationPreferences.cravingCheckIns,
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

export async function applyNotificationPreferencesAsync(opts: {
  prefs: NotificationPreferences;
  quitMs?: number | null;
}): Promise<void> {
  const anyEnabled = opts.prefs.dailyMotivation || opts.prefs.milestoneAlerts || opts.prefs.cravingCheckIns;
  if (!anyEnabled) {
    await Promise.all([
      cancelDailyMotivationAsync(),
      cancelMilestoneAlertsAsync(),
      cancelCravingCheckInAsync(),
    ]);
    return;
  }

  const granted = await ensureNotificationPermissionsAsync();
  if (!granted) {
    await Promise.all([
      cancelDailyMotivationAsync(),
      cancelMilestoneAlertsAsync(),
      cancelCravingCheckInAsync(),
    ]);
    return;
  }

  await saveExpoPushTokenToProfileAsync();

  if (opts.prefs.dailyMotivation) await scheduleDailyMotivationAsync({ quitMs: opts.quitMs });
  else await cancelDailyMotivationAsync();

  if (opts.prefs.milestoneAlerts) await scheduleMilestoneAlertsAsync({ quitMs: opts.quitMs });
  else await cancelMilestoneAlertsAsync();

  if (opts.prefs.cravingCheckIns) {
    await recordAppOpenAsync();
    await scheduleCravingCheckInAsync({ hours: 48 });
  } else {
    await cancelCravingCheckInAsync();
  }
}

export async function initializeNotificationsAfterOnboardingAsync(opts: {
  onboardingPreference: "enabled" | "maybe_later" | null;
}): Promise<void> {
  const already = await AsyncStorage.getItem(NOTIFICATION_INIT_KEY);
  if (already) return;

  const initialPrefs: NotificationPreferences =
    opts.onboardingPreference === "enabled"
      ? defaultNotificationPreferences
      : { dailyMotivation: false, milestoneAlerts: false, cravingCheckIns: false };

  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(initialPrefs));
  await AsyncStorage.setItem(NOTIFICATION_INIT_KEY, "1");

  const basics = await getCurrentUserProfileBasics();
  await applyNotificationPreferencesAsync({ prefs: initialPrefs, quitMs: basics?.quitMs ?? null });
}

export async function wasNotificationPermissionAskedAsync(): Promise<boolean> {
  const v = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY);
  return v === "1";
}

