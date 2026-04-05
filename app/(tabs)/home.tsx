import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { upsertProfile } from "../../lib/profileUpsert";
import { Colors } from "../../constants/colors";
import HealthMilestone from "../../components/HealthMilestone";
import { motivationalQuotes } from "../../constants/motivationalQuotes";

function parseQuitDateToLocalMs(quitDate: unknown): number | null {
  if (!quitDate) return null;
  if (quitDate instanceof Date) return quitDate.getTime();
  if (typeof quitDate === "number" && Number.isFinite(quitDate)) {
    return quitDate;
  }
  if (typeof quitDate !== "string") return null;

  // Supabase `date` columns typically come back as `YYYY-MM-DD`.
  const match = quitDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, monthIndex, day).getTime(); // local midnight
  }

  const parsed = new Date(quitDate).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function detectPremium(profileRow: any): boolean {
  // We don't currently know the exact premium column name, so we check common fields.
  const v =
    profileRow?.subscription ??
    profileRow?.plan ??
    profileRow?.entitlement ??
    profileRow?.premium ??
    profileRow?.is_premium;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "true" || s === "1" || s.includes("premium") || s.includes("pro");
  }
  return false;
}

const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const minuteMs = 60 * 1000;

function formatPremiumCounter(elapsedMs: number) {
  const days = Math.floor(elapsedMs / dayMs);
  const hours = Math.floor((elapsedMs % dayMs) / hourMs);
  const minutes = Math.floor((elapsedMs % hourMs) / minuteMs);
  const seconds = Math.floor((elapsedMs % minuteMs) / 1000);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatCurrencyGBP(amount: number) {
  if (!Number.isFinite(amount)) return "-";
  return `£${amount.toFixed(2)}`;
}

function formatLocalDateYyyyMmDd(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HomeScreen() {
  const [profile, setProfile] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [streakBusy, setStreakBusy] = useState<"start" | "stop" | null>(null);

  const [quote] = useState(() => {
    const idx = Math.floor(Math.random() * motivationalQuotes.length);
    return motivationalQuotes[idx];
  });

  const loadProfile = useCallback(async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData?.user) {
        setUserId(null);
        setProfile(null);
        setIsPremium(false);
        return;
      }

      const uid = authData.user.id;
      setUserId(uid);

      const { data: rows, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .limit(1);

      if (profileError || !rows?.length) {
        setProfile(null);
        setIsPremium(false);
        return;
      }

      const row = rows[0];
      setProfile(row);
      setIsPremium(detectPremium(row));
    } catch {
      setUserId(null);
      setProfile(null);
      setIsPremium(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        await loadProfile();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const persistQuitDate = useCallback(
    async (quitDate: string | null) => {
      if (!userId) {
        Alert.alert("Sign in required", "Please sign in again.");
        return false;
      }

      const { data: savedRows, error } = await upsertProfile(userId, {
        quit_date: quitDate,
      });

      if (error) {
        Alert.alert("Could not save", error.message);
        return false;
      }

      if (!savedRows || savedRows.length === 0) {
        Alert.alert("Could not save", "Profile could not be saved.");
        return false;
      }

      await loadProfile();
      return true;
    },
    [userId, loadProfile]
  );

  const onStartStreak = useCallback(async () => {
    if (streakBusy) return;
    setStreakBusy("start");
    try {
      await persistQuitDate(formatLocalDateYyyyMmDd());
    } finally {
      setStreakBusy(null);
    }
  }, [streakBusy, persistQuitDate]);

  const onStopStreak = useCallback(() => {
    if (streakBusy) return;
    Alert.alert(
      "End streak?",
      "Your streak will reset. You can start again anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End streak",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setStreakBusy("stop");
              try {
                await persistQuitDate(null);
              } finally {
                setStreakBusy(null);
              }
            })();
          },
        },
      ]
    );
  }, [streakBusy, persistQuitDate]);

  const quitMs = useMemo(() => parseQuitDateToLocalMs(profile?.quit_date), [profile]);

  useEffect(() => {
    // Premium streak counter must update every second.
    if (!isPremium || !quitMs) return;

    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, [isPremium, quitMs]);

  const elapsedMs = useMemo(() => {
    if (!quitMs) return 0;
    return Math.max(0, nowMs - quitMs);
  }, [nowMs, quitMs]);

  const dayNumber = Math.floor(elapsedMs / dayMs);

  const streakText = isPremium
    ? formatPremiumCounter(elapsedMs)
    : `${dayNumber} Days Smoke-Free`;

  // Card 1: Money Saved
  const weeklySpend = Number(profile?.weekly_spend ?? 0);
  const savedMoney = useMemo(() => {
    if (!quitMs) return 0;
    const elapsedDaysExact = elapsedMs / dayMs;
    const weeklyRate = Number.isFinite(weeklySpend) ? weeklySpend : 0;
    return weeklyRate * (elapsedDaysExact / 7);
  }, [elapsedMs, quitMs, weeklySpend]);

  // Card 2: Not Used
  const usesPerDayMap: Record<string, number> = {
    // These are estimates based on your onboarding frequency values.
    // If your app stores different semantics, adjust this map.
    multiple_times_day: 20,
    once_day: 10,
    few_times_week: 4,
    socially: 3,
  };
  const usesPerDay = usesPerDayMap[String(profile?.usage_frequency ?? "")] ?? 0;
  const avoidedUses = useMemo(() => {
    if (!quitMs) return 0;
    const elapsedDaysExact = elapsedMs / dayMs;
    return usesPerDay * elapsedDaysExact;
  }, [elapsedMs, quitMs, usesPerDay]);

  const name = String(profile?.first_name ?? "James").trim();
  const savedMoneyText = formatCurrencyGBP(savedMoney);
  const avoidedText = Number.isFinite(avoidedUses) ? String(Math.round(avoidedUses)) : "-";

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: Colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top greeting */}
        <View className="pt-10">
          <Text className="text-lg font-medium" style={{ color: Colors.darkText }}>
            Good morning, {name}
          </Text>
          <View className="mt-2 self-start rounded-full px-4 py-2" style={{ backgroundColor: Colors.lightBlue }}>
            <Text className="text-sm font-medium" style={{ color: Colors.primary }}>
              Day {dayNumber}
            </Text>
          </View>
        </View>

        {/* Main streak counter */}
        <View className="items-center mt-10">
          <Text
            className="text-5xl font-extrabold text-center"
            style={{ color: Colors.primary }}
          >
            {streakText}
          </Text>
          {!isPremium ? (
            <Text className="mt-2 text-xs font-semibold" style={{ color: Colors.midGrey, letterSpacing: 1.1 }}>
              NICOTINE-FREE
            </Text>
          ) : null}
        </View>

        {userId ? (
          <View className="flex-row mt-8 gap-3">
            <Pressable
              accessibilityRole="button"
              disabled={streakBusy !== null || !!quitMs}
              onPress={onStartStreak}
              className="flex-1 rounded-2xl py-3.5 px-3 items-center justify-center"
              style={{
                backgroundColor: Colors.primary,
                opacity: streakBusy !== null || !!quitMs ? 0.45 : 1,
              }}
            >
              {streakBusy === "start" ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold" style={{ color: "#FFFFFF" }}>
                  Start streak
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={streakBusy !== null || !quitMs}
              onPress={onStopStreak}
              className="flex-1 rounded-2xl py-3.5 px-3 items-center justify-center"
              style={{
                backgroundColor: Colors.background,
                borderWidth: 1,
                borderColor: Colors.lightGrey,
                opacity: streakBusy !== null || !quitMs ? 0.45 : 1,
              }}
            >
              {streakBusy === "stop" ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text className="text-sm font-semibold" style={{ color: Colors.darkText }}>
                  End streak
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Two stat cards */}
        <View className="flex-row mt-10">
          <View
            className="flex-1 mr-2 rounded-2xl px-4 py-4"
            style={{
              backgroundColor: Colors.background,
              borderWidth: 1,
              borderColor: Colors.lightGrey,
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: Colors.darkText }}>
              Money Saved
            </Text>
            <Text className="mt-3 text-3xl font-extrabold" style={{ color: Colors.primary }}>
              {savedMoneyText}
            </Text>
          </View>

          <View
            className="flex-1 ml-2 rounded-2xl px-4 py-4"
            style={{
              backgroundColor: Colors.background,
              borderWidth: 1,
              borderColor: Colors.lightGrey,
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: Colors.darkText }}>
              Not Used
            </Text>
            <Text className="mt-3 text-3xl font-extrabold" style={{ color: Colors.primary }}>
              {avoidedText}
            </Text>
            <Text className="mt-1 text-xs" style={{ color: Colors.midGrey }}>
              Not used
            </Text>
          </View>
        </View>

        {/* Next Health Milestone */}
        <View className="mt-8">
          <HealthMilestone elapsedMs={elapsedMs} />
        </View>

        {/* Motivational quote */}
        <View className="mt-8 rounded-2xl px-5 py-4" style={{ backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.lightGrey }}>
          <Text className="text-xs font-semibold" style={{ color: Colors.midGrey }}>
            Motivation
          </Text>
          <Text className="mt-2 text-base leading-6" style={{ color: Colors.darkText }}>
            "{quote}"
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

