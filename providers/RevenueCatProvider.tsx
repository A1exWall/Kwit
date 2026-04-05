import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import type { PAYWALL_RESULT } from "react-native-purchases-ui";
import Purchases from "react-native-purchases";
import {
  configureRevenueCat,
  getCustomerInfo,
  getOfferings,
  isKwitProEntitlementActive,
  KWIT_PRO_ENTITLEMENT,
  KWIT_PRODUCTS,
  presentCustomerCenter,
  presentKwitPaywallIfNeeded,
  purchasePackage,
  restoreRevenueCatPurchases,
  syncRevenueCatUser,
} from "../lib/revenuecat";
import { supabase } from "../lib/supabase";

type RevenueCatContextValue = {
  isReady: boolean;
  isLoading: boolean;
  isPro: boolean;
  customerInfo: any | null;
  currentOffering: any | null;
  productsByIdentifier: Record<string, any>;
  refreshCustomerInfo: () => Promise<void>;
  purchaseByProductIdentifier: (identifier: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT | undefined>;
  openCustomerCenter: () => Promise<boolean>;
};

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

type RevenueCatProviderProps = {
  children: ReactNode;
};

function getProductsByIdentifier(offering: any): Record<string, any> {
  const packages: any[] = offering?.availablePackages ?? [];
  const entries = packages
    .map((pkg) => [pkg?.identifier, pkg] as const)
    .filter(([identifier]) => typeof identifier === "string" && !!identifier);
  return Object.fromEntries(entries);
}

function parsePurchaseError(error: unknown): { title: string; message: string } {
  const maybe = error as { userCancelled?: boolean; message?: string };
  if (maybe?.userCancelled) {
    return {
      title: "Purchase cancelled",
      message: "No worries, you can upgrade any time.",
    };
  }
  return {
    title: "Purchase failed",
    message:
      maybe?.message ??
      "Something went wrong while processing your purchase. Please try again.",
  };
}

export function RevenueCatProvider({ children }: RevenueCatProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [currentOffering, setCurrentOffering] = useState<any | null>(null);

  const isPro = useMemo(
    () => isKwitProEntitlementActive(customerInfo),
    [customerInfo]
  );

  const productsByIdentifier = useMemo(
    () => getProductsByIdentifier(currentOffering),
    [currentOffering]
  );

  const refreshCustomerInfo = useCallback(async () => {
    const info = await getCustomerInfo();
    setCustomerInfo(info);
  }, []);

  const refreshOfferings = useCallback(async () => {
    const offerings = await getOfferings();
    setCurrentOffering(offerings?.current ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    const listener = (updatedInfo: any) => {
      if (!mounted) return;
      setCustomerInfo(updatedInfo);
    };

    const bootstrap = async () => {
      setIsLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        await configureRevenueCat(user?.id);
        await syncRevenueCatUser(user?.id);

        const [info, offerings] = await Promise.all([
          getCustomerInfo(),
          getOfferings(),
        ]);
        if (!mounted) return;

        setCustomerInfo(info);
        setCurrentOffering(offerings?.current ?? null);
        Purchases.addCustomerInfoUpdateListener(listener);
      } catch (error) {
        if (__DEV__) {
          console.warn("[RevenueCat] bootstrap failed", error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsReady(true);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        await syncRevenueCatUser(session?.user?.id);
        await refreshCustomerInfo();
      } catch (error) {
        if (__DEV__) {
          console.warn("[RevenueCat] auth sync failed", error);
        }
      }
    });

    void bootstrap();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [refreshCustomerInfo]);

  const purchaseByProductIdentifier = useCallback(
    async (identifier: string) => {
      const selectedPackage = productsByIdentifier[identifier];
      if (!selectedPackage) {
        Alert.alert(
          "Product unavailable",
          "This package is not available right now. Please try again in a moment."
        );
        return false;
      }

      setIsLoading(true);
      try {
        const result = await purchasePackage(selectedPackage);
        setCustomerInfo(result.customerInfo);
        return isKwitProEntitlementActive(result.customerInfo);
      } catch (error) {
        const parsed = parsePurchaseError(error);
        Alert.alert(parsed.title, parsed.message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [productsByIdentifier]
  );

  const restorePurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      const restored = await restoreRevenueCatPurchases();
      setCustomerInfo(restored);
      const hasEntitlement = isKwitProEntitlementActive(restored);
      Alert.alert(
        hasEntitlement ? "Restored" : "No purchases found",
        hasEntitlement
          ? `Your ${KWIT_PRO_ENTITLEMENT} access has been restored.`
          : "No active purchases were found for this account."
      );
      return hasEntitlement;
    } catch (error) {
      const parsed = parsePurchaseError(error);
      Alert.alert("Restore failed", parsed.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const presentPaywallIfNeeded = useCallback(async () => {
    if (isKwitProEntitlementActive(customerInfo)) {
      return undefined;
    }

    const result = await presentKwitPaywallIfNeeded();
    await refreshCustomerInfo();
    await refreshOfferings();
    return result;
  }, [customerInfo, refreshCustomerInfo, refreshOfferings]);

  const openCustomerCenter = useCallback(async () => {
    return presentCustomerCenter();
  }, []);

  const value: RevenueCatContextValue = {
    isReady,
    isLoading,
    isPro,
    customerInfo,
    currentOffering,
    productsByIdentifier,
    refreshCustomerInfo,
    purchaseByProductIdentifier,
    restorePurchases,
    presentPaywallIfNeeded,
    openCustomerCenter,
  };

  return (
    <RevenueCatContext.Provider value={value}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error("useRevenueCat must be used inside RevenueCatProvider");
  }
  return ctx;
}

export const KWIT_PRODUCT_IDS = KWIT_PRODUCTS;
