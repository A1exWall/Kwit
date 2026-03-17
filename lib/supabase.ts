import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env
  .EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseUrl = rawSupabaseUrl?.replace(/\/+$/, "") ?? "";
const supabaseAnonKey = process.env
  .EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

