import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { Colors } from "../constants/colors";

const TOTAL_SECONDS = 5 * 60;
const RING_SIZE = 220;
const STROKE = 8;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CravingPanicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [remainingSec, setRemainingSec] = useState(TOTAL_SECONDS);

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const progress = useMemo(
    () => (TOTAL_SECONDS > 0 ? remainingSec / TOTAL_SECONDS : 0),
    [remainingSec]
  );

  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const timeLabel = `${mm}:${String(ss).padStart(2, "0")}`;

  const trackColor = "#243556";
  const accent = Colors.primary;

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
      <View className="flex-row items-center px-4 pt-2 pb-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
        >
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </Pressable>
        <View className="flex-1 items-center pr-11">
          <Text className="text-2xl font-bold text-white">Ride it out.</Text>
          <Text
            className="mt-1 text-center text-sm"
            style={{ color: "#8EB8E8" }}
          >
            This craving will pass.
          </Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center justify-center">
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              stroke={trackColor}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={R}
              stroke={accent}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - progress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View
            className="absolute items-center justify-center"
            style={{ width: RING_SIZE, height: RING_SIZE }}
          >
            <Text className="text-5xl font-bold text-white">{timeLabel}</Text>
            <Text
              className="mt-1 text-xs font-semibold tracking-widest"
              style={{ color: "#8EB8E8" }}
            >
              MINUTES LEFT
            </Text>
          </View>
        </View>
      </View>

      <View className="px-5 pb-2">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/onboarding/breathing")}
          className="mb-3 flex-row items-center rounded-2xl bg-white px-4 py-4"
        >
          <View
            className="mr-3 h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: Colors.lightBlue }}
          >
            <Ionicons name="leaf-outline" size={24} color={Colors.primary} />
          </View>
          <Text className="flex-1 text-lg font-bold" style={{ color: Colors.navyDark }}>
            Breathe
          </Text>
          <Ionicons name="chevron-forward" size={22} color={Colors.midGrey} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(tabs)/health")}
          className="mb-6 flex-row items-center rounded-2xl bg-white px-4 py-4"
        >
          <View
            className="mr-3 h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: "#E8F8EE" }}
          >
            <Ionicons name="trending-up" size={24} color={Colors.successGreen} />
          </View>
          <Text className="flex-1 text-lg font-bold" style={{ color: Colors.navyDark }}>
            My Progress
          </Text>
          <Ionicons name="chevron-forward" size={22} color={Colors.midGrey} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            Alert.alert("Nice work", "You resisted this craving. Keep going.");
            router.back();
          }}
          className="mb-2 flex-row items-center justify-center rounded-2xl py-4"
          style={{ backgroundColor: Colors.successGreen }}
        >
          <View className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-white">
            <Ionicons name="checkmark" size={26} color={Colors.successGreen} />
          </View>
          <Text className="text-lg font-bold text-white">I Resisted!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
