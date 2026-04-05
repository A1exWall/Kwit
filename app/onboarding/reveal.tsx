import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { markRevealCompletedAsync } from "../../lib/onboardingRouting";
import { Colors } from "../../constants/colors";
import { initializeNotificationsAfterOnboardingAsync } from "../../lib/notifications";
import {
  parseQuitDateToMs,
  projectedSpendUntilQuitDate,
} from "../../lib/planningSavings";

export default function RevealScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [firstName, setFirstName] = useState<string>("User");
  const [weeklySpend, setWeeklySpend] = useState<number>(0);
  const [quitStatus, setQuitStatus] = useState<string | null>(null);
  const [quitDateRaw, setQuitDateRaw] = useState<unknown>(null);
  const [onboardingNotificationsPreference, setOnboardingNotificationsPreference] =
    useState<"enabled" | "maybe_later" | null>(null);

  const annualSavings = useMemo(() => {
    const weekly = Number.isFinite(weeklySpend) ? weeklySpend : 0;
    return Math.max(0, weekly * 52);
  }, [weeklySpend]);

  const planningSnapshot = useMemo(() => {
    const nowMs = Date.now();
    const quitMs = parseQuitDateToMs(quitDateRaw);
    const isPlanningFuture =
      quitStatus === "planning" &&
      quitMs !== null &&
      quitMs > nowMs;
    const projected = isPlanningFuture
      ? projectedSpendUntilQuitDate(weeklySpend, quitMs, nowMs)
      : 0;
    const heroSavings = isPlanningFuture && projected > 0 ? projected : annualSavings;
    const quitLabel =
      quitMs !== null
        ? new Date(quitMs).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "";
    return {
      isPlanningFuture: isPlanningFuture && projected > 0,
      heroSavings,
      quitLabel,
    };
  }, [annualSavings, quitDateRaw, quitStatus, weeklySpend]);

  const flightCount = useMemo(() => {
    const avgFlightCost = 450;
    const amount = planningSnapshot.heroSavings;
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return Math.max(0, Math.round(amount / avgFlightCost));
  }, [planningSnapshot.heroSavings]);

  const savingsText = useMemo(() => {
    const amount = planningSnapshot.heroSavings;
    if (!Number.isFinite(amount)) return "£0";
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `£${Math.round(amount).toLocaleString("en-GB")}`;
    }
  }, [planningSnapshot.heroSavings]);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError || !user) {
          router.replace("/auth/login");
          return;
        }

        const { data: rows } = await supabase
          .from("profiles")
          .select(
            "first_name, weekly_spend, notifications_preference, quit_status, quit_date"
          )
          .eq("id", user.id)
          .limit(1);

        if (cancelled) return;

        const row = rows?.[0] as Record<string, unknown> | undefined;
        const name = String(row?.first_name ?? "User").trim();
        setFirstName(name || "User");

        const spend = Number(row?.weekly_spend ?? 0);
        setWeeklySpend(Number.isFinite(spend) ? spend : 0);

        const statusRaw = row?.quit_status;
        setQuitStatus(typeof statusRaw === "string" ? statusRaw : null);
        setQuitDateRaw(row?.quit_date ?? null);

        const prefRaw = row?.notifications_preference;
        const pref =
          prefRaw === "enabled" || prefRaw === "maybe_later"
            ? (prefRaw as "enabled" | "maybe_later")
            : null;
        setOnboardingNotificationsPreference(pref);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (isLoading) return;
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLoading, opacity, translateY]);

  return (
    <View className="flex-1" style={{ backgroundColor: "#EBF4FB" }}>
      <View
        className="flex-1 px-7"
        style={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View className="items-center">
          <Text
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "#8AA7BF" }}
          >
            Welcome, {firstName}!
          </Text>
        </View>

        <View className="flex-1 items-center justify-center">
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Animated.Text
                className="text-6xl font-extrabold"
                style={{
                  color: "#0B1220",
                  opacity,
                  transform: [{ translateY }],
                }}
              >
                {savingsText}
              </Animated.Text>

              <View className="mt-5 px-5">
                <Text
                  className="text-base font-semibold text-center"
                  style={{ color: "#0B1220" }}
                >
                  {planningSnapshot.isPlanningFuture
                    ? `That's what you could set aside between now and your quit date${
                        planningSnapshot.quitLabel
                          ? ` (${planningSnapshot.quitLabel})`
                          : ""
                      }.`
                    : "That's what you'll save this year by quitting"}
                </Text>
                <Text
                  className="mt-2 text-sm text-center"
                  style={{ color: "#6B7280" }}
                >
                  {`That's ${Math.max(1, flightCount)} return flights to Europe.`}
                </Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={async () => {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            await initializeNotificationsAfterOnboardingAsync({
              onboardingPreference: onboardingNotificationsPreference,
            });
            await markRevealCompletedAsync(user.id);
            router.replace("/home");
          }}
          className="h-14 rounded-full items-center justify-center"
          style={{
            backgroundColor: "#10B981",
          }}
          disabled={isLoading}
        >
          <Text className="text-base font-semibold text-white">
            Start My Journey →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
