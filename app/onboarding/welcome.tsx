import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/colors";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View
      className="flex-1 items-center justify-between"
      style={{ backgroundColor: Colors.background }}
    >
      {/* Centered logo + text area */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center">
          {/* Logo tile – replace with Image later if you have the asset */}
          <View
            className="w-24 h-24 rounded-3xl mb-6 items-center justify-center"
            style={{
              backgroundColor: Colors.lightBlue,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 6,
            }}
          >
            <Text
              className="text-4xl font-extrabold"
              style={{ color: Colors.primary }}
            >
              K
            </Text>
          </View>

          <Text
            className="text-3xl font-bold tracking-wide mb-2"
            style={{ color: Colors.primary }}
          >
            KWIT
          </Text>

          <Text
            className="text-base text-center"
            style={{ color: Colors.midGrey }}
          >
            Your last quit. For good.
          </Text>
          <Text
            className="text-sm text-center mt-3 leading-5"
            style={{ color: Colors.midGrey }}
          >
            Answer a few questions next — we’ll show how much you could set aside
            by your planned quit date.
          </Text>
        </View>
      </View>

      {/* Bottom CTA button */}
      <View className="w-full px-6 pb-10">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/onboarding/questions")}
          className="h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: Colors.primary }}
        >
          <Text className="text-base font-semibold text-white">
            Get Started
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}