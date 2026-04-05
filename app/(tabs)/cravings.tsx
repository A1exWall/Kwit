import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/colors";

const CRAVING_CONTEXTS = [
  "After meal",
  "Stress",
  "Social",
  "Boredom",
  "Alcohol",
  "Other",
] as const;

type CravingContext = (typeof CRAVING_CONTEXTS)[number];

type CravingRow = {
  id: string;
  user_id: string;
  context: string;
  resisted: boolean;
  created_at: string;
};

function detectPremium(profileRow: Record<string, unknown> | null): boolean {
  if (!profileRow) return false;
  const v =
    profileRow.subscription ??
    profileRow.plan ??
    profileRow.entitlement ??
    profileRow.premium ??
    profileRow.is_premium;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "true" || s === "1" || s.includes("premium") || s.includes("pro");
  }
  return false;
}

function formatCravingTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CravingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPremium, setIsPremium] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingCravings, setLoadingCravings] = useState(false);
  const [cravings, setCravings] = useState<CravingRow[]>([]);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [context, setContext] = useState<CravingContext>("Stress");
  const [resisted, setResisted] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setIsPremium(false);
        return;
      }
      const { data: rows, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .limit(1);

      if (profileError || !rows?.length) {
        setIsPremium(false);
        return;
      }
      setIsPremium(detectPremium(rows[0] as Record<string, unknown>));
    } catch {
      setIsPremium(false);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const loadCravings = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      setCravings([]);
      return;
    }
    setLoadingCravings(true);
    try {
      const { data, error } = await supabase
        .from("cravings")
        .select("id,user_id,context,resisted,created_at")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        setCravings([]);
        return;
      }
      setCravings((data ?? []) as CravingRow[]);
    } catch {
      setCravings([]);
    } finally {
      setLoadingCravings(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isPremium) return;
    loadCravings();
  }, [isPremium, loadCravings]);

  useFocusEffect(
    useCallback(() => {
      if (isPremium) {
        loadCravings();
      }
    }, [isPremium, loadCravings])
  );

  const onRefresh = useCallback(async () => {
    if (!isPremium) return;
    setRefreshing(true);
    await loadCravings();
    setRefreshing(false);
  }, [isPremium, loadCravings]);

  const openLogModal = () => {
    setContext("Stress");
    setResisted(true);
    setLogModalOpen(true);
  };

  const saveCraving = async () => {
    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        Alert.alert("Sign in required", "Log in to save cravings.");
        return;
      }
      const { error } = await supabase.from("cravings").insert({
        user_id: authData.user.id,
        context,
        resisted,
      });
      if (error) {
        Alert.alert("Could not save", error.message);
        return;
      }
      setLogModalOpen(false);
      await loadCravings();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="pt-4 text-3xl font-bold" style={{ color: Colors.darkText }}>
          Cravings
        </Text>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push("/craving-panic")}
          className="mt-6 items-center justify-center rounded-2xl py-5 px-4"
          style={{ backgroundColor: "#DC2626" }}
        >
          <Text className="text-center text-lg font-bold text-white">
            I&apos;m Craving Right Now
          </Text>
        </TouchableOpacity>

        <Text
          className="mt-10 text-lg font-bold"
          style={{ color: Colors.darkText }}
        >
          My Trigger Log
        </Text>

        {loadingProfile ? (
          <View className="mt-6 items-center py-8">
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : !isPremium ? (
          <View
            className="mt-4 items-center rounded-2xl border border-dashed px-5 py-10"
            style={{ borderColor: Colors.lightGrey, backgroundColor: Colors.lightGrey }}
          >
            <View
              className="mb-4 h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(74, 144, 217, 0.15)" }}
            >
              <Ionicons name="lock-closed" size={28} color={Colors.primary} />
            </View>
            <Text
              className="text-center text-base font-semibold"
              style={{ color: Colors.darkText }}
            >
              Upgrade to track your triggers
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/onboarding/premium")}
              className="mt-5 rounded-full px-6 py-3"
              style={{ backgroundColor: Colors.primary }}
            >
              <Text className="text-base font-semibold text-white">Upgrade</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={openLogModal}
              activeOpacity={0.88}
              className="mt-4 flex-row items-center justify-center rounded-2xl border-2 py-3.5 px-4"
              style={{ borderColor: Colors.primary }}
            >
              <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
              <Text className="ml-2 text-base font-bold" style={{ color: Colors.primary }}>
                Log a Craving
              </Text>
            </TouchableOpacity>

            {loadingCravings && cravings.length === 0 ? (
              <View className="mt-8 items-center py-6">
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : cravings.length === 0 ? (
              <Text className="mt-6 text-center text-base" style={{ color: Colors.midGrey }}>
                No cravings logged yet. Tap &quot;Log a Craving&quot; when you have one.
              </Text>
            ) : (
              <View className="mt-4">
                {cravings.map((c) => (
                  <View
                    key={c.id}
                    className="mb-3 rounded-2xl border px-4 py-4"
                    style={{
                      borderColor: Colors.lightGrey,
                      backgroundColor: Colors.background,
                    }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: Colors.midGrey }}>
                      {formatCravingTime(c.created_at)}
                    </Text>
                    <Text
                      className="mt-2 text-base font-bold"
                      style={{ color: Colors.darkText }}
                    >
                      {c.context}
                    </Text>
                    <View className="mt-2 flex-row items-center">
                      <Text className="text-sm font-medium" style={{ color: Colors.midGrey }}>
                        Resisted:{" "}
                      </Text>
                      <Text
                        className="text-sm font-bold"
                        style={{
                          color: c.resisted ? Colors.successGreen : "#DC2626",
                        }}
                      >
                        {c.resisted ? "Yes" : "No"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={logModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setLogModalOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => !saving && setLogModalOpen(false)}
        >
          <Pressable
            className="rounded-t-3xl bg-white px-5 pt-6"
            style={{ paddingBottom: insets.bottom + 20 }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold" style={{ color: Colors.darkText }}>
                Log a craving
              </Text>
              <TouchableOpacity
                onPress={() => !saving && setLogModalOpen(false)}
                hitSlop={12}
              >
                <Ionicons name="close" size={28} color={Colors.midGrey} />
              </TouchableOpacity>
            </View>

            <Text className="mb-2 text-sm font-semibold" style={{ color: Colors.midGrey }}>
              Context
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CRAVING_CONTEXTS.map((opt) => {
                const selected = context === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setContext(opt)}
                    className="rounded-full px-3 py-2"
                    style={{
                      backgroundColor: selected ? Colors.lightBlue : Colors.lightGrey,
                      borderWidth: selected ? 2 : 0,
                      borderColor: Colors.primary,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: selected ? Colors.primaryDark : Colors.darkText }}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="mb-3 mt-6 text-sm font-semibold" style={{ color: Colors.midGrey }}>
              Did you resist?
            </Text>
            <View className="flex-row rounded-2xl p-1" style={{ backgroundColor: Colors.lightGrey }}>
              <TouchableOpacity
                onPress={() => setResisted(true)}
                className="flex-1 items-center rounded-xl py-3"
                style={{
                  backgroundColor: resisted ? Colors.successGreen : "transparent",
                }}
              >
                <Text
                  className="text-base font-bold"
                  style={{ color: resisted ? "#fff" : Colors.darkText }}
                >
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setResisted(false)}
                className="flex-1 items-center rounded-xl py-3"
                style={{
                  backgroundColor: !resisted ? "#DC2626" : "transparent",
                }}
              >
                <Text
                  className="text-base font-bold"
                  style={{ color: !resisted ? "#fff" : Colors.darkText }}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              disabled={saving}
              onPress={saveCraving}
              className="mt-8 items-center rounded-2xl py-4"
              style={{ backgroundColor: Colors.primary, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-bold text-white">Save</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
