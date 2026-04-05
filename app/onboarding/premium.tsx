import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Colors } from "../../constants/colors";
import { KWIT_PRODUCT_IDS, useRevenueCat } from "../../providers/RevenueCatProvider";

type ComparisonRow = {
  feature: string;
  free: string;
  premium: string;
};

type PlanIdentifier =
  | typeof KWIT_PRODUCT_IDS.monthly
  | typeof KWIT_PRODUCT_IDS.yearly
  | typeof KWIT_PRODUCT_IDS.lifetime;

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Streak counter",
    free: "Days only",
    premium: "Live seconds counter",
  },
  {
    feature: "Health timeline",
    free: "5 milestones",
    premium: "Full 12 milestones",
  },
  {
    feature: "Craving tools",
    free: "Basic",
    premium: "Trigger tracking + insights",
  },
  {
    feature: "Community",
    free: "Read only",
    premium: "Full access + Quit Buddy",
  },
  {
    feature: "Meditation",
    free: "2 sessions",
    premium: "Full library",
  },
  {
    feature: "Widgets",
    free: "Basic",
    premium: "All designs + live counter",
  },
  {
    feature: "Ads",
    free: "Yes",
    premium: "No ads",
  },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanIdentifier>(KWIT_PRODUCT_IDS.yearly);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const {
    isLoading,
    isPro,
    productsByIdentifier,
    purchaseByProductIdentifier,
    restorePurchases,
  } = useRevenueCat();

  const onPurchaseSelected = async () => {
    if (isPurchasing || isLoading) return;
    setIsPurchasing(true);
    try {
      await purchaseByProductIdentifier(selectedPlan);
    } finally {
      setIsPurchasing(false);
    }
  };

  const monthlyPrice =
    productsByIdentifier[KWIT_PRODUCT_IDS.monthly]?.product?.priceString ?? "£9.99/month";
  const yearlyPrice =
    productsByIdentifier[KWIT_PRODUCT_IDS.yearly]?.product?.priceString ?? "£59.99/year";
  const lifetimePrice =
    productsByIdentifier[KWIT_PRODUCT_IDS.lifetime]?.product?.priceString ?? "£199.99 once";

  const isBusy = isPurchasing || isLoading;
  const ctaText = isPro
    ? "You are on Kwit Pro"
    : selectedPlan === KWIT_PRODUCT_IDS.yearly
      ? "Start 7-Day Free Trial"
      : selectedPlan === KWIT_PRODUCT_IDS.monthly
        ? "Go Premium (Monthly)"
        : "Go Premium (Lifetime)";

  return (
    <View className="flex-1">
      <Svg
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
      >
        <Defs>
          <LinearGradient id="premiumBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={Colors.lightBlue} />
            <Stop offset="100%" stopColor={Colors.background} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#premiumBg)" />
      </Svg>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          position: "relative",
          zIndex: 1,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-center text-[36px] font-extrabold leading-[42px]" style={{ color: Colors.navyDark }}>
          Cut relapses by 45% - Upgrade to Premium.
        </Text>

        <Text className="mt-3 text-center text-base" style={{ color: Colors.midGrey }}>
          Unlock every tool you need to stay smoke-free
        </Text>

        <View
          className="mt-6 overflow-hidden rounded-2xl"
          style={{
            borderWidth: 1,
            borderColor: "#DCE8F6",
            backgroundColor: "rgba(255,255,255,0.9)",
          }}
        >
          <View className="flex-row border-b px-4 py-3" style={{ borderColor: "#E5EDF7" }}>
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: Colors.midGrey }}>
                Feature
              </Text>
            </View>
            <View className="w-[26%] pr-2">
              <Text className="text-right text-sm font-bold" style={{ color: Colors.midGrey }}>
                Free
              </Text>
            </View>
            <View className="w-[36%]">
              <Text className="text-right text-sm font-bold" style={{ color: Colors.primaryDark }}>
                Premium
              </Text>
            </View>
          </View>

          {COMPARISON_ROWS.map((row, index) => (
            <View
              key={row.feature}
              className="flex-row px-4 py-3"
              style={{
                borderBottomWidth: index === COMPARISON_ROWS.length - 1 ? 0 : 1,
                borderColor: "#E5EDF7",
              }}
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-semibold" style={{ color: Colors.darkText }}>
                  {row.feature}
                </Text>
              </View>
              <View className="w-[26%] pr-2">
                <Text className="text-right text-sm" style={{ color: Colors.midGrey }}>
                  {row.free}
                </Text>
              </View>
              <View className="w-[36%]">
                <Text className="text-right text-sm font-semibold" style={{ color: Colors.darkText }}>
                  {row.premium}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-7 gap-4">
          <View
            className="rounded-2xl px-5 py-4"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              borderWidth: selectedPlan === KWIT_PRODUCT_IDS.monthly ? 2 : 1,
              borderColor: selectedPlan === KWIT_PRODUCT_IDS.monthly ? Colors.primary : "#DCE8F6",
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedPlan(KWIT_PRODUCT_IDS.monthly)}
              disabled={isBusy}
            >
              <View className="flex-row items-end justify-between">
                <Text className="text-2xl font-bold" style={{ color: Colors.darkText }}>
                  Monthly
                </Text>
                <Text className="text-2xl font-bold" style={{ color: Colors.darkText }}>
                  {monthlyPrice}
                </Text>
              </View>
              <Text className="mt-2 text-sm" style={{ color: Colors.midGrey }}>
                Renews every month
              </Text>
            </TouchableOpacity>
          </View>

          <View
            className="rounded-2xl px-5 pb-4 pt-5"
            style={{
              backgroundColor: "rgba(255,255,255,0.98)",
              borderWidth: 2,
              borderColor: Colors.primary,
            }}
          >
            <View className="absolute left-0 right-0 top-[-12px] items-center">
              <View className="rounded-full px-4 py-1" style={{ backgroundColor: Colors.primary }}>
                <Text className="text-xs font-bold tracking-wide text-white">Best Value - Save 50%</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedPlan(KWIT_PRODUCT_IDS.yearly)}
              disabled={isBusy}
            >
              <View className="flex-row items-end justify-between">
                <Text className="text-2xl font-bold" style={{ color: Colors.darkText }}>
                  Annual
                </Text>
                <Text className="text-2xl font-bold" style={{ color: Colors.darkText }}>
                  {yearlyPrice}
                </Text>
              </View>
              <Text className="mt-2 text-sm" style={{ color: Colors.midGrey }}>
                Renews every year
              </Text>
              <Text className="mt-1 text-sm font-semibold" style={{ color: Colors.primaryDark }}>
                Includes 7-day free trial
              </Text>
            </TouchableOpacity>
          </View>

          <View
            className="rounded-2xl px-5 py-4"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              borderWidth: selectedPlan === KWIT_PRODUCT_IDS.lifetime ? 2 : 1,
              borderColor: selectedPlan === KWIT_PRODUCT_IDS.lifetime ? Colors.primary : "#DCE8F6",
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setSelectedPlan(KWIT_PRODUCT_IDS.lifetime)}
              disabled={isBusy}
            >
              <View className="flex-row items-end justify-between">
                <Text className="text-2xl font-bold" style={{ color: Colors.darkText }}>
                  Lifetime
                </Text>
                <Text className="text-2xl font-bold" style={{ color: Colors.darkText }}>
                  {lifetimePrice}
                </Text>
              </View>
              <Text className="mt-2 text-sm" style={{ color: Colors.midGrey }}>
                One-time purchase
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPurchaseSelected}
          disabled={isBusy}
          className="mt-8 h-14 items-center justify-center rounded-full"
          style={{ backgroundColor: Colors.primary, opacity: isBusy ? 0.7 : 1 }}
        >
          {isBusy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-lg font-bold text-white">
              {ctaText}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => restorePurchases()}
          className="mt-3 h-12 items-center justify-center rounded-full"
          style={{ borderWidth: 1, borderColor: Colors.primary }}
          disabled={isLoading}
        >
          <Text className="text-base font-semibold" style={{ color: Colors.primary }}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        <Text className="mt-3 text-center text-sm" style={{ color: Colors.midGrey }}>
          Cancel anytime. Billed via App Store.
        </Text>
      </ScrollView>
    </View>
  );
}
