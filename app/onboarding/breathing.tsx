import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "../../constants/colors";

type Phase = "Breathe In" | "Hold" | "Breathe Out";

const CYCLE_MS = 16_000;
const PHASE_MS = 4_000;
const IN_SCALE = 0.7;
const OUT_SCALE = 0.7;
const HOLD_SCALE = 1.0;

function getPhaseAndSecondsLeft(elapsedMs: number): {
  phase: Phase;
  secondsLeft: number;
} {
  const t = ((elapsedMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;

  if (t < PHASE_MS) {
    const phaseMs = t;
    return {
      phase: "Breathe In",
      secondsLeft: 4 - Math.floor(phaseMs / 1000),
    };
  }

  if (t < PHASE_MS * 2) {
    const phaseMs = t - PHASE_MS;
    return {
      phase: "Hold",
      secondsLeft: 4 - Math.floor(phaseMs / 1000),
    };
  }

  if (t < PHASE_MS * 3) {
    const phaseMs = t - PHASE_MS * 2;
    return {
      phase: "Breathe Out",
      secondsLeft: 4 - Math.floor(phaseMs / 1000),
    };
  }

  const phaseMs = t - PHASE_MS * 3;
  return {
    phase: "Hold",
    secondsLeft: 4 - Math.floor(phaseMs / 1000),
  };
}

export default function BreathingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("Breathe In");
  const [secondsLeft, setSecondsLeft] = useState(4);

  const scale = useSharedValue(IN_SCALE);

  const outerCircleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  }, []);

  const startAnimation = useCallback(() => {
    // Reset first so each time the screen is focused the cycle starts cleanly.
    scale.value = IN_SCALE;

    scale.value = withRepeat(
      withSequence(
        // Breathe In (expand)
        withTiming(HOLD_SCALE, {
          duration: PHASE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        // Hold large (no visible motion, but time must pass)
        withDelay(PHASE_MS, withTiming(HOLD_SCALE, { duration: 1 })),
        // Breathe Out (shrink)
        withTiming(OUT_SCALE, {
          duration: PHASE_MS,
          easing: Easing.inOut(Easing.quad),
        }),
        // Hold small (no visible motion, but time must pass)
        withDelay(PHASE_MS, withTiming(OUT_SCALE, { duration: 1 }))
      ),
      -1,
      false
    );
  }, [scale]);

  const stopAnimation = useCallback(() => {
    cancelAnimation(scale);
    scale.value = IN_SCALE;
  }, [scale]);

  useFocusEffect(
    useCallback(() => {
      const startTs = Date.now();

      setPhase("Breathe In");
      setSecondsLeft(4);

      startAnimation();

      let lastPhase: Phase | null = "Breathe In";
      let lastSecondsLeft = 4;

      const interval = setInterval(() => {
        const { phase: nextPhase, secondsLeft: nextSecondsLeft } =
          getPhaseAndSecondsLeft(Date.now() - startTs);

        if (nextPhase !== lastPhase) {
          lastPhase = nextPhase;
          setPhase(nextPhase);
        }

        if (nextSecondsLeft !== lastSecondsLeft) {
          lastSecondsLeft = nextSecondsLeft;
          setSecondsLeft(nextSecondsLeft);
        }
      }, 100);

      return () => {
        clearInterval(interval);
        stopAnimation();
      };
    }, [startAnimation, stopAnimation])
  );

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: Colors.navyDark,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <StatusBar style="light" />

      <View className="flex-1 items-center justify-center">
        <View className="items-center justify-center">
          <View
            style={{
              width: 260,
              height: 260,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View
              style={[
                {
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  backgroundColor: "rgba(100, 170, 255, 0.22)",
                  borderWidth: 1,
                  borderColor: "rgba(142, 184, 232, 0.35)",
                },
                outerCircleStyle,
              ]}
            />

            {/* Inner dot stays steady; only the outer circle breathes */}
            <View
              style={{
                width: 104,
                height: 104,
                borderRadius: 52,
                backgroundColor: "rgba(142, 184, 232, 0.55)",
                position: "absolute",
                top: 78,
                left: 78,
                zIndex: 1,
              }}
            />
          </View>
        </View>

        <Text
          className="mt-8 text-4xl font-extrabold text-white text-center"
          style={{ letterSpacing: 0.2 }}
        >
          {phase}
        </Text>
        <Text
          className="mt-2 text-base font-semibold text-center"
          style={{ color: "#8EB8E8" }}
        >
          {secondsLeft} seconds
        </Text>
      </View>

      {/* End exercise */}
      <View className="px-6 pb-4">
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push("/(tabs)/home");
          }}
          activeOpacity={0.9}
          className="w-full rounded-2xl py-4 items-center justify-center"
          style={{
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <Text className="text-base font-bold text-white">End Exercise</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
