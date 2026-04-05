import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { upsertProfile } from "../../lib/profileUpsert";
import { supabase } from "../../lib/supabase";

const NICOTINE_OPTIONS = [
  "Cigarettes",
  "Vapes",
  "Cigars",
  "Patches",
  "Gum",
  "Pouches",
  "Other",
] as const;

export default function NicotineTypeSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user || cancelled) return;

        const { data: rows } = await supabase
          .from("profiles")
          .select("nicotine_types")
          .eq("id", user.id)
          .limit(1);

        if (cancelled) return;
        const raw = rows?.[0]?.nicotine_types;
        const current = Array.isArray(raw) ? raw.map((v: unknown) => String(v)) : [];
        setSelected(current);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((value: string) => {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value]
    );
  }, []);

  const sortedSelected = useMemo(
    () => NICOTINE_OPTIONS.filter((option) => selected.includes(option)),
    [selected]
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        Alert.alert("Sign in required", "Please sign in again.");
        return;
      }

      const { data: savedRows, error } = await upsertProfile(user.id, {
        nicotine_types: sortedSelected,
      });

      if (error) {
        Alert.alert("Could not save", error.message);
        return;
      }
      if (!savedRows || savedRows.length === 0) {
        Alert.alert("Could not save", "Profile could not be saved.");
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }, [router, sortedSelected]);

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 8 }}>
      <View className="px-4 pb-3">
        <TouchableOpacity onPress={() => router.back()} className="py-2" activeOpacity={0.7}>
          <Text className="text-base" style={{ color: Colors.primary }}>
            Back
          </Text>
        </TouchableOpacity>
        <Text className="mt-1 text-3xl font-bold" style={{ color: Colors.darkText }}>
          Nicotine Type
        </Text>
        <Text className="mt-1 text-sm" style={{ color: Colors.midGrey }}>
          Select all that apply.
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {NICOTINE_OPTIONS.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.85}
                onPress={() => toggle(option)}
                className="mb-3 rounded-2xl px-4 py-4 flex-row items-center justify-between"
                style={{
                  borderWidth: 1.5,
                  borderColor: isSelected ? Colors.primary : "#E6EAF0",
                  backgroundColor: isSelected ? "#EAF3FF" : "#FFFFFF",
                }}
              >
                <Text className="text-base font-medium" style={{ color: Colors.darkText }}>
                  {option}
                </Text>
                <View
                  className="h-5 w-5 rounded-full"
                  style={{
                    borderWidth: 1.5,
                    borderColor: isSelected ? Colors.primary : Colors.midGrey,
                    backgroundColor: isSelected ? Colors.primary : "transparent",
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3" style={{ backgroundColor: "white" }}>
        <TouchableOpacity
          className="h-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: Colors.primary, opacity: saving ? 0.7 : 1 }}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
