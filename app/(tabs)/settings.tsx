import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { upsertProfile } from "../../lib/profileUpsert";
import { supabase } from "../../lib/supabase";
import { useRevenueCat } from "../../providers/RevenueCatProvider";
import { applyNotificationPreferencesAsync } from "../../lib/notifications";
import { clearRevealCompletedForUserAsync } from "../../lib/onboardingRouting";

const NOTIFICATION_PREFS_KEY = "kwit_notification_preferences";

type NotificationPreferences = {
  dailyMotivation: boolean;
  milestoneAlerts: boolean;
  cravingCheckIns: boolean;
};

const defaultNotificationPreferences: NotificationPreferences = {
  dailyMotivation: true,
  milestoneAlerts: true,
  cravingCheckIns: false,
};

function parseQuitDateToLocalDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatQuitDateLabel(date: Date | null): string {
  if (!date) return "Select date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoading, isPro, openCustomerCenter, restorePurchases } =
    useRevenueCat();
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [name, setName] = useState("");
  const [quitDate, setQuitDate] = useState<Date | null>(null);
  const [weeklySpend, setWeeklySpend] = useState("");
  const [nicotineTypeLabel, setNicotineTypeLabel] = useState("Select types");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    defaultNotificationPreferences
  );

  const loadProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: rows } = await supabase
        .from("profiles")
        .select("first_name, quit_date, weekly_spend, nicotine_types")
        .eq("id", user.id)
        .limit(1);

      const row = rows?.[0] as Record<string, unknown> | undefined;
      if (!row) return;

      setName(String(row.first_name ?? ""));
      setQuitDate(parseQuitDateToLocalDate(row.quit_date));

      const spend = Number(row.weekly_spend ?? 0);
      setWeeklySpend(Number.isFinite(spend) ? spend.toFixed(2) : "");

      const types = Array.isArray(row.nicotine_types)
        ? row.nicotine_types.map((t) => String(t))
        : [];
      setNicotineTypeLabel(types.length ? types.join(", ") : "Select types");
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const loadNotificationPreferences = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
      setNotificationPrefs({
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
      });
    } catch {
      // Ignore corrupted local settings and use defaults.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
      void loadNotificationPreferences();
    }, [loadProfile, loadNotificationPreferences])
  );

  const saveDetails = useCallback(async () => {
    const parsedWeekly = Number(weeklySpend.replace(/[^0-9.]/g, ""));
    setIsSavingDetails(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        Alert.alert("Sign in required", "Please sign in again.");
        return;
      }

      const payload = {
        first_name: name.trim(),
        quit_date: quitDate ? quitDate.toISOString().slice(0, 10) : null,
        weekly_spend: Number.isFinite(parsedWeekly) ? parsedWeekly : null,
      };

      const { data: savedRows, error } = await upsertProfile(user.id, payload);

      if (error) {
        Alert.alert("Could not save", error.message);
        return;
      }

      if (!savedRows || savedRows.length === 0) {
        Alert.alert("Could not save", "Profile could not be saved.");
        return;
      }

      Alert.alert("Saved", "Your details were updated.");
    } finally {
      setIsSavingDetails(false);
    }
  }, [name, quitDate, weeklySpend]);

  const updateNotificationPref = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      const next = { ...notificationPrefs, [key]: value };
      setNotificationPrefs(next);
      await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next));
      await applyNotificationPreferencesAsync({
        prefs: next,
        quitMs: quitDate?.getTime() ?? null,
      });
    },
    [notificationPrefs, quitDate]
  );

  const onRateKwit = useCallback(async () => {
    const iosUrl = "itms-apps://itunes.apple.com/app/id000000000?action=write-review";
    const androidUrl = "market://details?id=com.kwit.app";
    const fallbackWeb = "https://apps.apple.com";
    const target = Platform.OS === "ios" ? iosUrl : androidUrl;
    try {
      const supported = await (await import("react-native")).Linking.canOpenURL(target);
      if (supported) {
        await (await import("react-native")).Linking.openURL(target);
        return;
      }
      await (await import("react-native")).Linking.openURL(fallbackWeb);
    } catch {
      Alert.alert("Could not open", "Please try again later.");
    }
  }, []);

  const onHelpAndSupport = useCallback(async () => {
    try {
      await (await import("react-native")).Linking.openURL(
        "mailto:support@kwit.app?subject=Kwit%20Support"
      );
    } catch {
      Alert.alert("Could not open mail app", "Please email support@kwit.app");
    }
  }, []);

  const onManageSubscription = useCallback(async () => {
    if (isPro) {
      const iosUrl = "itms-apps://apps.apple.com/account/subscriptions";
      const androidUrl = "https://play.google.com/store/account/subscriptions";
      const target = Platform.OS === "ios" ? iosUrl : androidUrl;
      try {
        await (await import("react-native")).Linking.openURL(target);
      } catch {
        await openCustomerCenter();
      }
      return;
    }
    router.push("/onboarding/premium");
  }, [isPro, openCustomerCenter, router]);

  const onLogOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }, [router]);

  const sectionCardStyle = useMemo(
    () => ({
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#EEF1F4",
      overflow: "hidden" as const,
    }),
    []
  );

  const rowDividerStyle = useMemo(() => ({ borderBottomWidth: 1, borderBottomColor: "#EEF1F4" }), []);

  return (
    <View className="flex-1" style={{ backgroundColor: "#FFFFFF" }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-4xl font-bold" style={{ color: Colors.darkText }}>
          Settings
        </Text>

        <Text className="mt-7 mb-2 px-1 text-xs font-bold tracking-wide" style={{ color: "#98A2B3" }}>
          MY DETAILS
        </Text>
        <View style={sectionCardStyle}>
          <View className="px-4 py-3" style={rowDividerStyle}>
            <Text className="mb-1 text-sm font-semibold" style={{ color: Colors.darkText }}>
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.midGrey}
              className="text-base"
              style={{ color: Colors.darkText }}
            />
          </View>

          <TouchableOpacity
            className="px-4 py-3"
            style={rowDividerStyle}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text className="mb-1 text-sm font-semibold" style={{ color: Colors.darkText }}>
              Quit Date
            </Text>
            <Text className="text-base" style={{ color: Colors.midGrey }}>
              {formatQuitDateLabel(quitDate)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="px-4 py-3"
            style={rowDividerStyle}
            activeOpacity={0.8}
            onPress={() => router.push("/settings/nicotine-type")}
          >
            <Text className="mb-1 text-sm font-semibold" style={{ color: Colors.darkText }}>
              Nicotine Type
            </Text>
            <Text className="text-base" style={{ color: Colors.midGrey }}>
              {nicotineTypeLabel}
            </Text>
          </TouchableOpacity>

          <View className="px-4 py-3">
            <Text className="mb-1 text-sm font-semibold" style={{ color: Colors.darkText }}>
              Weekly Spend
            </Text>
            <TextInput
              value={weeklySpend}
              onChangeText={setWeeklySpend}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.midGrey}
              className="text-base"
              style={{ color: Colors.darkText }}
            />
          </View>
        </View>

        <TouchableOpacity
          className="mt-3 h-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: Colors.primary, opacity: isSavingDetails || isLoadingProfile ? 0.7 : 1 }}
          onPress={saveDetails}
          disabled={isSavingDetails || isLoadingProfile}
        >
          {isSavingDetails ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">Save Changes</Text>
          )}
        </TouchableOpacity>

        <Text className="mt-7 mb-2 px-1 text-xs font-bold tracking-wide" style={{ color: "#98A2B3" }}>
          NOTIFICATIONS
        </Text>
        <View style={sectionCardStyle}>
          <View className="flex-row items-center justify-between px-4 py-4" style={rowDividerStyle}>
            <Text className="text-base" style={{ color: Colors.darkText }}>
              Daily motivation
            </Text>
            <Switch
              value={notificationPrefs.dailyMotivation}
              onValueChange={(v) => updateNotificationPref("dailyMotivation", v)}
            />
          </View>
          <View className="flex-row items-center justify-between px-4 py-4" style={rowDividerStyle}>
            <Text className="text-base" style={{ color: Colors.darkText }}>
              Milestone alerts
            </Text>
            <Switch
              value={notificationPrefs.milestoneAlerts}
              onValueChange={(v) => updateNotificationPref("milestoneAlerts", v)}
            />
          </View>
          <View className="flex-row items-center justify-between px-4 py-4">
            <Text className="text-base" style={{ color: Colors.darkText }}>
              Craving check-ins
            </Text>
            <Switch
              value={notificationPrefs.cravingCheckIns}
              onValueChange={(v) => updateNotificationPref("cravingCheckIns", v)}
            />
          </View>
        </View>

        <Text className="mt-7 mb-2 px-1 text-xs font-bold tracking-wide" style={{ color: "#98A2B3" }}>
          SUBSCRIPTION
        </Text>
        <View style={sectionCardStyle}>
          <View className="px-4 py-4" style={rowDividerStyle}>
            <Text className="text-sm font-semibold" style={{ color: Colors.midGrey }}>
              Current plan
            </Text>
            <Text className="mt-1 text-xl font-bold" style={{ color: Colors.darkText }}>
              {isPro ? "Premium" : "Free"}
            </Text>
          </View>
          <View className="px-4 py-4">
            <TouchableOpacity
              className="h-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: Colors.primary, opacity: isLoading ? 0.7 : 1 }}
              onPress={onManageSubscription}
              disabled={isLoading}
            >
              <Text className="text-base font-semibold text-white">
                {isPro ? "Manage Subscription" : "Upgrade to Premium"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-3 h-10 items-center justify-center rounded-xl"
              style={{ borderWidth: 1, borderColor: Colors.primary }}
              onPress={() => restorePurchases()}
              disabled={isLoading}
            >
              <Text className="text-sm font-semibold" style={{ color: Colors.primary }}>
                Restore Purchases
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text className="mt-7 mb-2 px-1 text-xs font-bold tracking-wide" style={{ color: "#98A2B3" }}>
          APP
        </Text>
        <View style={sectionCardStyle}>
          <TouchableOpacity className="px-4 py-4" style={rowDividerStyle} onPress={onRateKwit}>
            <Text className="text-base" style={{ color: Colors.darkText }}>
              Rate Kwit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="px-4 py-4" style={rowDividerStyle} onPress={onHelpAndSupport}>
            <Text className="text-base" style={{ color: Colors.darkText }}>
              Help & Support
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="px-4 py-4"
            onPress={() => Alert.alert("Privacy Policy", "Privacy Policy link coming soon.")}
          >
            <Text className="text-base" style={{ color: Colors.primary }}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="mt-7 mb-2 px-1 text-xs font-bold tracking-wide" style={{ color: "#98A2B3" }}>
          ACCOUNT
        </Text>
        <View style={sectionCardStyle}>
          <TouchableOpacity className="px-4 py-4" onPress={onLogOut}>
            <Text className="text-base font-semibold" style={{ color: "#DC2626" }}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>

        {__DEV__ ? (
          <>
            <Text
              className="mt-7 mb-2 px-1 text-xs font-bold tracking-wide"
              style={{ color: "#98A2B3" }}
            >
              DEVELOPMENT
            </Text>
            <View style={sectionCardStyle}>
              <TouchableOpacity
                className="px-4 py-4"
                onPress={async () => {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (!user) return;
                  await clearRevealCompletedForUserAsync(user.id);
                  router.replace("/onboarding/reveal");
                }}
              >
                <Text className="text-base" style={{ color: Colors.darkText }}>
                  Replay onboarding reveal
                </Text>
                <Text className="mt-1 text-xs" style={{ color: Colors.midGrey }}>
                  Clears the per-account reveal flag for this device.
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>

      {showDatePicker ? (
        <DateTimePicker
          value={quitDate ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event, selected) => {
            if (Platform.OS === "android") {
              setShowDatePicker(false);
            }
            if (selected) {
              setQuitDate(selected);
            }
          }}
        />
      ) : null}
    </View>
  );
}
