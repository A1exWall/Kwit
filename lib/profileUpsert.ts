import { supabase } from "./supabase";

/**
 * Insert or update a row in `public.profiles` for the given user.
 *
 * Plain `.update()` returns 0 rows when no profile exists yet (e.g. no DB trigger
 * on signup). Upsert fixes that by creating the row on first save.
 */
export async function upsertProfile(
  userId: string,
  payload: Record<string, unknown>
) {
  return supabase
    .from("profiles")
    .upsert({ id: userId, ...payload }, { onConflict: "id" })
    .select("id");
}
