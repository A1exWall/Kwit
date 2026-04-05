import "../global.css";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RevenueCatProvider } from "../providers/RevenueCatProvider";
import { supabase } from "../lib/supabase";
import { getPostAuthRouteForSession } from "../lib/onboardingRouting";
import { Colors } from "../constants/colors";
import {
  configureNotifications,
  getStoredNotificationPreferencesAsync,
  recordAppOpenAsync,
  scheduleCravingCheckInAsync,
  startInactivityTracker,
} from "../lib/notifications";

export default function RootLayout() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  // Mount-only: re-running when `router` identity changes was replacing reveal with home
  // after questions (see getPostAuthRouteForSession + REVEAL_COMPLETED_KEY).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time session bootstrap
  useEffect(() => {
    let cancelled = false;

    configureNotifications();

    void recordAppOpenAsync();
    startInactivityTracker({
      cravingCheckInsEnabled: async () => {
        const prefs = await getStoredNotificationPreferencesAsync();
        return prefs.cravingCheckIns;
      },
    });

    void (async () => {
      const prefs = await getStoredNotificationPreferencesAsync();
      if (prefs.cravingCheckIns) {
        await scheduleCravingCheckInAsync({ hours: 48 });
      }
    })();

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/auth/login");
      } else {
        // Do not send every signed-in user to Home — that skips onboarding/reveal.
        const next = await getPostAuthRouteForSession();
        router.replace(next);
      }
      if (!cancelled) setAuthReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/auth/login");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <RevenueCatProvider>
        <View style={styles.root}>
          <Stack screenOptions={{ headerShown: false }} />
          {!authReady ? (
            <View
              style={[StyleSheet.absoluteFillObject, styles.loadingOverlay]}
              pointerEvents="auto"
            >
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : null}
        </View>
      </RevenueCatProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingOverlay: {
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
});
