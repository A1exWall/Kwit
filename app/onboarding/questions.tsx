import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/colors";
import { supabase } from "../../lib/supabase";

const TOTAL_STEPS = 7;

type QuitStatus = "already_quit" | "planning" | null;
type NotificationsPreference = "enabled" | "maybe_later" | null;

const nicotineOptions = [
  "Cigarettes",
  "Vapes",
  "Cigars",
  "Patches",
  "Gum",
  "Pouches",
  "Other",
] as const;

const frequencyOptions = [
  { id: "multiple_times_day", label: "Multiple times a day" },
  { id: "once_day", label: "Once a day" },
  { id: "few_times_week", label: "A few times a week" },
  { id: "socially", label: "Socially" },
] as const;

const quitReasonOptions = [
  { id: "health", label: "Health" },
  { id: "money", label: "Money" },
  { id: "family", label: "Family" },
  { id: "fitness", label: "Fitness" },
  { id: "pregnancy", label: "Pregnancy" },
  { id: "appearance", label: "Appearance" },
  { id: "doctor", label: "Doctor's advice" },
  { id: "other", label: "Other" },
] as const;

export default function OnboardingQuestionsScreen() {
  const router = useRouter();

  const [step, setStep] = useState(1);

  const [nicotineTypes, setNicotineTypes] = useState<string[]>([]);
  const [usageFrequency, setUsageFrequency] = useState<string | null>(null);
  const [weeklySpend, setWeeklySpend] = useState<string>("");
  const [quitReasons, setQuitReasons] = useState<string[]>([]);
  const [otherQuitReason, setOtherQuitReason] = useState("");
  const [quitStatus, setQuitStatus] = useState<QuitStatus>(null);
  const [quitDate, setQuitDate] = useState<Date | null>(null);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [notificationsPreference, setNotificationsPreference] =
    useState<NotificationsPreference>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (cancelled) return;
      setSessionChecked(true);
      if (error || !user) {
        router.replace("/onboarding/sign-up");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleNicotineType = useCallback((label: string) => {
    setNicotineTypes((current) =>
    current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    );
  }, []);

  const toggleQuitReason = useCallback((id: string) => {
    setQuitReasons((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }, []);

  const isValidForStep = useMemo(() => {
    switch (step) {
      case 1:
        return nicotineTypes.length > 0;
      case 2:
        return !!usageFrequency;
      case 3: {
        if (!weeklySpend) return false;
        const value = Number(weeklySpend.replace(/[^0-9.]/g, ""));
        return !Number.isNaN(value) && value >= 0;
      }
      case 4: {
        if (!quitReasons.length) return false;
        if (
          quitReasons.length === 1 &&
          quitReasons[0] === "other" &&
          !otherQuitReason.trim()
        ) {
          return false;
        }
        if (quitReasons.includes("other") && !otherQuitReason.trim()) {
          return false;
        }
        return true;
      }
      case 5:
        return !!quitStatus && !!quitDate;
      case 6:
        return !!firstName.trim();
      case 7:
        return !!notificationsPreference;
      default:
        return false;
    }
  }, [
    step,
    nicotineTypes,
    usageFrequency,
    weeklySpend,
    quitReasons,
    otherQuitReason,
    quitStatus,
    quitDate,
    firstName,
    notificationsPreference,
  ]);

  const handleContinue = useCallback(async () => {
    if (!isValidForStep || isSubmitting) return;

    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("No authenticated user");
      }

      const numericWeeklySpend = Number(
        weeklySpend.replace(/[^0-9.]/g, "")
      );

      const payload = {
        nicotine_types: nicotineTypes,
        usage_frequency: usageFrequency,
        weekly_spend: Number.isNaN(numericWeeklySpend)
          ? null
          : numericWeeklySpend,
        quit_reasons: quitReasons,
        other_quit_reason: otherQuitReason.trim() || null,
        quit_status: quitStatus,
        quit_date: quitDate ? quitDate.toISOString().slice(0, 10) : null,
        first_name: firstName.trim(),
        notifications_preference: notificationsPreference,
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      router.replace("/onboarding/reveal");
    } catch (error: any) {
      const msg = error?.message ?? "";
      const isSessionError =
        msg.toLowerCase().includes("session") ||
        msg.toLowerCase().includes("auth");
      if (isSessionError) {
        setSubmitError("Please sign in to continue.");
        setTimeout(() => {
          router.replace("/onboarding/sign-up");
        }, 1500);
      } else {
        setSubmitError(
          msg || "Something went wrong. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValidForStep,
    isSubmitting,
    step,
    nicotineTypes,
    usageFrequency,
    weeklySpend,
    quitReasons,
    otherQuitReason,
    quitStatus,
    quitDate,
    firstName,
    notificationsPreference,
    router,
  ]);

  const handleBack = useCallback(() => {
    if (step === 1 || isSubmitting) {
      router.back();
      return;
    }
    setStep((prev) => Math.max(1, prev - 1));
  }, [step, isSubmitting, router]);

  const onChangeDate = useCallback(
    (_event: any, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setIsDatePickerVisible(false);
      }
      if (selectedDate) {
        setQuitDate(selectedDate);
      }
    },
    []
  );

  const formattedQuitDate = useMemo(() => {
    if (!quitDate) return "";
    return quitDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [quitDate]);

  const renderDots = () => {
    return (
      <View className="flex-row items-center justify-center mt-6 mb-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
          const currentIndex = index + 1;
          const isActive = currentIndex === step;
          return (
            <View
              key={currentIndex}
              className={`mx-1 rounded-full ${
                isActive ? "w-4 h-2" : "w-2 h-2"
              }`}
              style={{
                backgroundColor: isActive ? Colors.primary : Colors.lightGrey,
              }}
            />
          );
        })}
      </View>
    );
  };

  const renderCard = (
    label: string,
    selected: boolean,
    onPress: () => void
  ) => {
    return (
      <TouchableOpacity
        key={label}
        activeOpacity={0.9}
        onPress={onPress}
        className="w-full mb-3 rounded-2xl px-4 py-4 flex-row items-center justify-between bg-white"
        style={{
          borderWidth: selected ? 1.5 : 0,
          borderColor: selected ? Colors.primary : "transparent",
          backgroundColor: selected ? "#E5F1FF" : Colors.background,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
        }}
      >
        <Text
          className="text-base"
          style={{ color: Colors.darkText, fontWeight: "500" }}
        >
          {label}
        </Text>
        <View
          className="w-5 h-5 rounded-full border items-center justify-center"
          style={{
            borderColor: selected ? Colors.primary : Colors.midGrey,
            backgroundColor: selected ? Colors.primary : "transparent",
          }}
        >
          {selected ? (
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "white" }}
            />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderQuestionTitle = (text: string) => (
    <Text
      className="text-2xl font-semibold text-center mb-6 px-6"
      style={{ color: Colors.darkText }}
    >
      {text}
    </Text>
  );

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            {renderQuestionTitle("What type of nicotine do you use?")}
            <View className="w-full mt-2">
              {nicotineOptions.map((label) =>
                renderCard(label, nicotineTypes.includes(label), () =>
                  toggleNicotineType(label)
                )
              )}
            </View>
          </>
        );
      case 2:
        return (
          <>
            {renderQuestionTitle("How often do you use nicotine?")}
            <View className="w-full mt-2">
              {frequencyOptions.map((option) =>
                renderCard(
                  option.label,
                  usageFrequency === option.id,
                  () => setUsageFrequency(option.id)
                )
              )}
            </View>
          </>
        );
      case 3:
        return (
          <>
            {renderQuestionTitle("How much do you spend per week?")}
            <View className="w-full mt-4">
              <View
                className="flex-row items-center rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: Colors.lightGrey,
                }}
              >
                <Text
                  className="text-lg mr-2"
                  style={{ color: Colors.midGrey }}
                >
                  £
                </Text>
                <TextInput
                  value={weeklySpend}
                  onChangeText={setWeeklySpend}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.midGrey}
                  className="flex-1 text-lg"
                  style={{ color: Colors.darkText }}
                />
              </View>
            </View>
          </>
        );
      case 4:
        return (
          <>
            {renderQuestionTitle("Why do you want to quit?")}
            <View className="w-full mt-2">
              {quitReasonOptions.map((option) => (
                <View key={option.id}>
                  {renderCard(
                    option.label,
                    quitReasons.includes(option.id),
                    () => toggleQuitReason(option.id)
                  )}
                  {option.id === "other" && quitReasons.includes("other") && (
                    <View className="w-full mb-3">
                      <TextInput
                        value={otherQuitReason}
                        onChangeText={setOtherQuitReason}
                        placeholder="Tell us more..."
                        placeholderTextColor={Colors.midGrey}
                        className="w-full rounded-2xl px-4 py-3 text-base"
                        style={{
                          backgroundColor: Colors.lightGrey,
                          color: Colors.darkText,
                        }}
                        multiline
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        );
      case 5:
        return (
          <>
            {renderQuestionTitle(
              "Have you already quit or are you planning to?"
            )}
            <View className="w-full mt-2">
              {renderCard(
                "I’ve already quit",
                quitStatus === "already_quit",
                () => setQuitStatus("already_quit")
              )}
              {renderCard(
                "I’m planning to quit",
                quitStatus === "planning",
                () => setQuitStatus("planning")
              )}
            </View>
            <View className="w-full mt-4">
              <Text
                className="mb-2 text-sm"
                style={{ color: Colors.midGrey }}
              >
                {quitStatus === "already_quit"
                  ? "When did you quit?"
                  : quitStatus === "planning"
                  ? "When are you planning to quit?"
                  : "Select a quit date"}
              </Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setIsDatePickerVisible(true)}
                className="rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: Colors.lightGrey,
                }}
              >
                <Text
                  className="text-base"
                  style={{
                    color: quitDate ? Colors.darkText : Colors.midGrey,
                  }}
                >
                  {formattedQuitDate || "Select date"}
                </Text>
              </TouchableOpacity>
            </View>
            {isDatePickerVisible && (
              <DateTimePicker
                mode="date"
                value={quitDate || new Date()}
                onChange={onChangeDate}
                display={Platform.OS === "ios" ? "spinner" : "default"}
              />
            )}
          </>
        );
      case 6:
        return (
          <>
            {renderQuestionTitle("What should we call you?")}
            <View className="w-full mt-4">
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={Colors.midGrey}
                className="w-full rounded-2xl px-4 py-3 text-base"
                style={{
                  backgroundColor: Colors.lightGrey,
                  color: Colors.darkText,
                }}
              />
            </View>
          </>
        );
      case 7:
        return (
          <>
            {renderQuestionTitle("Enable notifications?")}
            <View className="w-full mt-2">
              {renderCard(
                "Yes, keep me on track",
                notificationsPreference === "enabled",
                () => setNotificationsPreference("enabled")
              )}
              {renderCard(
                "Maybe later",
                notificationsPreference === "maybe_later",
                () => setNotificationsPreference("maybe_later")
              )}
            </View>
          </>
        );
      default:
        return null;
    }
  };

  if (!sessionChecked) {
    return null;
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: Colors.background }}
    >
      <View className="flex-row items-center justify-between px-6 pt-10">
        <TouchableOpacity onPress={handleBack} hitSlop={8}>
          <Text style={{ color: Colors.primary, fontWeight: "500" }}>
            Back
          </Text>
        </TouchableOpacity>
        <Text
          className="text-sm"
          style={{ color: Colors.midGrey }}
        >
          {step} / {TOTAL_STEPS}
        </Text>
      </View>

      {renderDots()}

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepContent()}
      </ScrollView>

      {submitError ? (
        <View className="px-6 mb-2">
          <Text
            className="text-xs"
            style={{ color: "red" }}
          >
            {submitError}
          </Text>
        </View>
      ) : null}

      <View className="w-full px-6 pb-8">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleContinue}
          disabled={!isValidForStep || isSubmitting}
          className="h-14 rounded-full items-center justify-center"
          style={{
            backgroundColor: Colors.primary,
            opacity: !isValidForStep || isSubmitting ? 0.6 : 1,
          }}
        >
          <Text className="text-base font-semibold text-white">
            {step === TOTAL_STEPS ? (isSubmitting ? "Saving..." : "Continue") : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
