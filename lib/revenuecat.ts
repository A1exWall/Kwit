import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

export const REVENUECAT_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "";

export const KWIT_PRO_ENTITLEMENT = "Kwit Pro";
export const KWIT_PRODUCTS = {
  monthly: "monthly",
  yearly: "yearly",
  lifetime: "lifetime",
} as const;

let isConfigured = false;

export function isKwitProEntitlementActive(customerInfo: any): boolean {
  const entitlement =
    customerInfo?.entitlements?.active?.[KWIT_PRO_ENTITLEMENT] ?? null;
  return Boolean(entitlement);
}

export async function configureRevenueCat(appUserID?: string): Promise<void> {
  if (isConfigured) {
    return;
  }
  if (!REVENUECAT_API_KEY) {
    throw new Error("Missing EXPO_PUBLIC_REVENUECAT_API_KEY environment variable");
  }

  Purchases.configure({
    apiKey: REVENUECAT_API_KEY,
    appUserID,
  });

  try {
    if (__DEV__) {
      await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    }
  } catch {
    // Ignore log-level failures in production builds.
  }

  isConfigured = true;
}

export async function syncRevenueCatUser(
  appUserID?: string
): Promise<void> {
  if (appUserID) {
    await Purchases.logIn(appUserID);
    return;
  }
  await Purchases.logOut();
}

export async function getCustomerInfo() {
  return Purchases.getCustomerInfo();
}

export async function getOfferings() {
  return Purchases.getOfferings();
}

export async function restoreRevenueCatPurchases() {
  return Purchases.restorePurchases();
}

export async function purchasePackage(selectedPackage: any) {
  return Purchases.purchasePackage(selectedPackage);
}

export async function presentKwitPaywallIfNeeded(): Promise<
  PAYWALL_RESULT | undefined
> {
  try {
    return await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: KWIT_PRO_ENTITLEMENT,
      displayCloseButton: true,
    });
  } catch {
    return undefined;
  }
}

export async function presentCustomerCenter(): Promise<boolean> {
  try {
    await RevenueCatUI.presentCustomerCenter();
    return true;
  } catch {
    return false;
  }
}
