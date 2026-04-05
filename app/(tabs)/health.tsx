import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/colors";
import {
  RECOVERY_MILESTONES,
  formatRecoveryTimeLabel,
  type RecoveryMilestone,
} from "../../constants/recoveryTimeline";

function parseQuitDateToLocalMs(quitDate: unknown): number | null {
  if (!quitDate) return null;
  if (quitDate instanceof Date) return quitDate.getTime();
  if (typeof quitDate === "number" && Number.isFinite(quitDate)) {
    return quitDate;
  }
  if (typeof quitDate !== "string") return null;

  const match = quitDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, monthIndex, day).getTime();
  }

  const parsed = new Date(quitDate).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function detectPremium(profileRow: any): boolean {
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

type MilestoneStatus = "passed" | "current" | "upcoming";

function getStatuses(
  milestones: RecoveryMilestone[],
  elapsedMs: number
): MilestoneStatus[] {
  const currentIndex = milestones.findIndex((m) => elapsedMs < m.timeMs);
  if (currentIndex === -1) {
    return milestones.map(() => "passed" as const);
  }
  return milestones.map((_, i) => {
    if (i < currentIndex) return "passed";
    if (i === currentIndex) return "current";
    return "upcoming";
  });
}

export default function HealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<any | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;

        if (authError || !authData?.user) {
          setProfile(null);
          setIsPremium(false);
          return;
        }

        const { data: rows, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .limit(1);

        if (cancelled) return;
        if (profileError || !rows?.length) {
          setProfile(null);
          setIsPremium(false);
          return;
        }

        const row = rows[0];
        setProfile(row);
        setIsPremium(detectPremium(row));
      } catch {
        if (!cancelled) {
          setProfile(null);
          setIsPremium(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const quitMs = useMemo(
    () => parseQuitDateToLocalMs(profile?.quit_date),
    [profile]
  );

  const elapsedMs = useMemo(() => {
    if (!quitMs) return 0;
    return Math.max(0, nowMs - quitMs);
  }, [nowMs, quitMs]);

  const statuses = useMemo(
    () => getStatuses(RECOVERY_MILESTONES, elapsedMs),
    [elapsedMs]
  );

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: Colors.background }}
      >
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: Colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(12, insets.top),
          paddingBottom: 120,
        }}
        style={{ backgroundColor: Colors.background }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.push("/(tabs)/home");
            }}
            hitSlop={12}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full"
            style={{ borderWidth: 1, borderColor: Colors.lightGrey }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.darkText} />
          </TouchableOpacity>
          <Text
            className="flex-1 text-2xl font-bold"
            style={{ color: Colors.navyDark }}
          >
            Your Recovery
          </Text>
        </View>

        {!quitMs ? (
          <View
            className="rounded-2xl px-4 py-6"
            style={{ backgroundColor: Colors.lightGrey }}
          >
            <Text className="text-center text-base" style={{ color: Colors.midGrey }}>
              Add your quit date in onboarding to see your recovery timeline.
            </Text>
          </View>
        ) : (
          <View>
            {RECOVERY_MILESTONES.map((milestone, index) => {
              const status = statuses[index];
              const isLast = index === RECOVERY_MILESTONES.length - 1;

              return (
                <TimelineRow
                  key={`${milestone.time}-${milestone.title}`}
                  milestone={milestone}
                  status={status}
                  isLast={isLast}
                  isPremium={isPremium}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TimelineRow({
  milestone,
  status,
  isLast,
  isPremium,
}: {
  milestone: RecoveryMilestone;
  status: MilestoneStatus;
  isLast: boolean;
  isPremium: boolean;
}) {
  const timeUpper = formatRecoveryTimeLabel(milestone.time);

  const iconBg =
    status === "passed"
      ? Colors.successGreen
      : status === "current"
        ? Colors.primary
        : "#E8E8E8";

  return (
    <View className="flex-row">
      {/* Timeline rail */}
      <View className="w-[44px] items-center">
        {!isLast ? (
          <View
            className="absolute w-[2px]"
            style={{
              top: 22,
              bottom: -8,
              backgroundColor: "#E5E5E5",
            }}
          />
        ) : null}

        <View
          className="z-10 h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBg }}
        >
          {status === "passed" ? (
            <Ionicons name="checkmark" size={22} color="#FFFFFF" />
          ) : status === "current" ? (
            <Ionicons name="sync" size={20} color="#FFFFFF" />
          ) : (
            <Ionicons name="lock-closed" size={18} color={Colors.midGrey} />
          )}
        </View>
      </View>

      {/* Card / content */}
      <View className="flex-1 pb-8 pl-1">
        <View
          className="rounded-2xl px-4 py-4"
          style={
            status === "current"
              ? {
                  backgroundColor: Colors.lightBlue,
                  borderWidth: 1,
                  borderColor: "#C9DFF5",
                }
              : {
                  backgroundColor: Colors.background,
                  borderWidth: 0,
                }
          }
        >
          {status === "current" ? (
            <View className="mb-2 flex-row justify-end">
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: "#D6E8FA" }}
              >
                <Text
                  className="text-[10px] font-bold"
                  style={{ color: Colors.primaryDark }}
                >
                  CURRENT
                </Text>
              </View>
            </View>
          ) : null}

          <Text
            className="text-xs font-bold"
            style={{
              color:
                status === "passed"
                  ? Colors.successGreen
                  : status === "current"
                    ? Colors.primary
                    : Colors.midGrey,
              letterSpacing: 0.5,
            }}
          >
            {timeUpper}
          </Text>

          <Text
            className="mt-1 text-lg font-bold"
            style={{
              color:
                status === "upcoming" ? Colors.midGrey : Colors.darkText,
            }}
          >
            {milestone.title}
          </Text>

          {isPremium ? (
            <Text
              className="mt-2 text-sm leading-5"
              style={{
                color: status === "upcoming" ? "#AAAAAA" : Colors.midGrey,
              }}
            >
              {milestone.detail}
            </Text>
          ) : (
            <View className="mt-3 flex-row items-start">
              <Ionicons
                name="lock-closed"
                size={16}
                color={Colors.primary}
                style={{ marginTop: 2, marginRight: 8 }}
              />
              <Text
                className="flex-1 text-sm leading-5"
                style={{ color: Colors.midGrey }}
              >
                Upgrade to Premium to unlock full details
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
