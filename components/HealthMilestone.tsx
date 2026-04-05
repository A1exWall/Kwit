import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { Colors } from "../constants/colors";
import { healthTimelineMilestones } from "../constants/healthTimeline";

type HealthMilestoneProps = {
  elapsedMs: number;
};

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

const minuteMs = 60 * 1000;

function formatThreshold(ms: number) {
  if (ms < hourMs) return `${Math.floor(ms / minuteMs)}m`;
  if (ms < dayMs) return `${Math.floor(ms / hourMs)}h`;
  const days = Math.floor(ms / dayMs);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export default function HealthMilestone({ elapsedMs }: HealthMilestoneProps) {
  const { next, progress01 } = useMemo(() => {
    const milestones = [...healthTimelineMilestones].sort((a, b) => a.timeMs - b.timeMs);
    if (!milestones.length) {
      return { next: null as any, progress01: 0 };
    }

    // Next milestone is the first one not yet reached.
    let nextMilestone = milestones[milestones.length - 1];
    for (const m of milestones) {
      if (elapsedMs < m.timeMs) {
        nextMilestone = m;
        break;
      }
    }

    const threshold = nextMilestone.timeMs || 1;
    const progress01 = clamp01(elapsedMs / threshold);
    return { next: nextMilestone, progress01 };
  }, [elapsedMs]);

  const progressPercent = Math.round(progress01 * 100);

  return (
    <View>
      <View
        className="w-full rounded-2xl px-4 py-4"
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
        <Text className="text-xs font-semibold" style={{ color: Colors.midGrey }}>
          Next Health Milestone
        </Text>

        <Text className="mt-3 text-xl font-extrabold" style={{ color: Colors.darkText }}>
          {next?.name ?? "-"}
        </Text>

        {/* Progress bar */}
        <View className="mt-4" style={{ width: "100%" }}>
          <View className="w-full h-3 rounded-full" style={{ backgroundColor: Colors.lightGrey }} />
          <View
            className="h-3 rounded-full mt-[-12px]"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: Colors.primary,
            }}
          />
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs font-semibold" style={{ color: Colors.midGrey }}>
            {`${formatThreshold(elapsedMs)} - ${progressPercent}% complete`}
          </Text>
          <Text className="text-xs font-semibold" style={{ color: Colors.midGrey }}>
            {formatThreshold(next?.timeMs ?? 0)}
          </Text>
        </View>
      </View>
    </View>
  );
}
