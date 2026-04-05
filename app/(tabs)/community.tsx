import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { Colors } from "../../constants/colors";
import { clampLength, MAX_COMMUNITY_POST_LENGTH, sanitizeMultilineText } from "../../lib/inputValidation";

function parseQuitDateToLocalMs(quitDate: unknown): number | null {
  if (!quitDate) return null;
  if (quitDate instanceof Date) return quitDate.getTime();
  if (typeof quitDate === "number" && Number.isFinite(quitDate)) {
    return quitDate;
  }
  if (typeof quitDate !== "string") return null;

  // Supabase `date` columns typically come back as `YYYY-MM-DD`.
  const match = quitDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, monthIndex, day).getTime(); // local midnight
  }

  const parsed = new Date(quitDate).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function detectPremium(profileRow: any): boolean {
  const v =
    profileRow?.subscription ??
    profileRow?.plan ??
    profileRow?.entitlement ??
    profileRow?.premium ??
    profileRow?.is_premium;

  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "true" || s === "1" || s.includes("premium") || s.includes("pro");
  }
  return false;
}

function formatTimeAgo(iso: unknown): string {
  if (!iso) return "";
  const t = new Date(String(iso)).getTime();
  if (!Number.isFinite(t)) return "";

  const diffMs = Date.now() - t;
  if (diffMs < 0) return "";

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  const mins = Math.floor(diffMs / minuteMs);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;

  const hours = Math.floor(diffMs / hourMs);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(diffMs / dayMs);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function toInitial(firstName: unknown): string {
  const s = String(firstName ?? "").trim();
  if (!s) return "?";
  return s[0]?.toUpperCase() ?? "?";
}

function computeStreakLabel(post: any, profile: any): string | null {
  const raw =
    post?.streak_day ??
    post?.streakDay ??
    post?.streak_at_post ??
    post?.streak ??
    post?.day_number;

  if (raw !== undefined && raw !== null) {
    if (typeof raw === "number" && Number.isFinite(raw)) return `Day ${Math.max(0, Math.floor(raw))}`;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      if (/^day\s+\d+/i.test(trimmed)) return trimmed.replace(/^day\s+/i, "Day ");
      if (/^\d+$/.test(trimmed)) return `Day ${trimmed}`;
      return trimmed;
    }
  }

  // Fallback: compute from profile `quit_date` at the time of the post.
  const createdMs = new Date(post?.created_at ? String(post.created_at) : "").getTime();
  const quitMs = parseQuitDateToLocalMs(profile?.quit_date);
  if (!Number.isFinite(createdMs) || quitMs === null) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const dayNumberAtPost = Math.floor(Math.max(0, (createdMs - quitMs) / dayMs));
  return Number.isFinite(dayNumberAtPost) ? `Day ${dayNumberAtPost}` : null;
}

type CommunityPost = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes?: number | string | null;
  like_count?: number | string | null;
  streak_day?: number | null;
  profiles?: any;
};

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [premium, setPremium] = useState<boolean | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const [postModalOpen, setPostModalOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPremium = useCallback(async () => {
    // Start unknown to prevent banner/button flicker.
    setPremium(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setPremium(false);
        return;
      }

      const { data: rows, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .limit(1);

      if (profileError || !rows?.length) {
        setPremium(false);
        return;
      }

      setPremium(detectPremium(rows[0]));
    } catch {
      setPremium(false);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      // Attempt a Supabase join to get poster name (and optional quit_date for streak calc).
      // If your foreign key relationship name doesn't match, we'll fall back to a 2-step join.
      const { data, error } = await supabase
        .from("community_posts")
        .select(
          "*,profiles(first_name,quit_date)"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const normalized = (data ?? []).map((p: any) => {
        const profile = Array.isArray(p?.profiles) ? p.profiles[0] : p?.profiles;
        return { ...(p as CommunityPost), profiles: profile };
      });

      setPosts(normalized);
      return;
    } catch {
      // Fallback: fetch posts and profiles separately, then merge by `user_id`.
      try {
        const { data: postData, error: postError } = await supabase
          .from("community_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (postError) throw postError;

        const list = (postData ?? []) as CommunityPost[];
        const userIds = Array.from(
          new Set(list.map((p) => String(p.user_id)).filter((id) => !!id && id !== "null"))
        );

        if (userIds.length === 0) {
          setPosts(list);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id,first_name,quit_date")
          .in("id", userIds);
        if (profileError) throw profileError;

        const byId = new Map<string, any>((profileData ?? []).map((r: any) => [String(r.id), r]));
        setPosts(
          list.map((p) => ({
            ...p,
            profiles: byId.get(String(p.user_id)) ?? null,
          }))
        );
      } catch {
        setPosts([]);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    loadPremium();
    loadPosts();
  }, [loadPremium, loadPosts]);

  const canPost = premium === true;

  const onSubmitPost = useCallback(async () => {
    const trimmed = clampLength(
      sanitizeMultilineText(draft),
      MAX_COMMUNITY_POST_LENGTH
    );
    if (!trimmed) return;

    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("community_posts").insert({
        user_id: authData.user.id,
        content: trimmed,
      });

      if (error) {
        setSaving(false);
        return;
      }

      setPostModalOpen(false);
      setDraft("");
      await loadPosts();
    } finally {
      setSaving(false);
    }
  }, [draft, loadPosts]);

  const renderPost = useCallback(({ item }: { item: CommunityPost }) => {
    const profile = item.profiles ?? null;
    const firstName = String(profile?.first_name ?? "User").trim();
    const streakLabel = computeStreakLabel(item, profile);
    const likeCountRaw = item.like_count ?? item.likes ?? 0;
    const likeCount = Number(likeCountRaw ?? 0);
    const likeCountText = Number.isFinite(likeCount) ? String(likeCount) : "0";

    const avatarBg = "rgba(74, 144, 217, 0.15)";
    const initialColor = Colors.primaryDark;

    return (
      <View
        className="mb-4 rounded-2xl px-5 py-4"
        style={{ backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.lightGrey }}
      >
        <View className="flex-row items-start">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: avatarBg }}
          >
            <Text className="text-lg font-extrabold" style={{ color: initialColor }}>
              {toInitial(firstName)}
            </Text>
          </View>

          <View className="ml-4 flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold" style={{ color: Colors.darkText }}>
                {firstName}
              </Text>

              {streakLabel ? (
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: Colors.lightBlue }}>
                  <Text className="text-xs font-semibold" style={{ color: Colors.primaryDark }}>
                    {streakLabel}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text className="mt-1 text-xs font-semibold" style={{ color: Colors.midGrey }}>
              {formatTimeAgo(item.created_at)}
            </Text>

            <Text className="mt-2 text-base leading-6" style={{ color: Colors.darkText }}>
              {String(item.content ?? "").trim()}
            </Text>

            <View className="mt-4 flex-row items-center">
              <Ionicons name="heart" size={18} color="#DC2626" />
              <Text className="ml-2 text-sm font-bold" style={{ color: "#DC2626" }}>
                {likeCountText}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }, []);

  const bannerVisible = premium === false;

  const contentTopPadding = useMemo(() => {
    // Header + spacing. This avoids awkward overlap because FlatList content padding is separate.
    return 8 + (insets.top ? Math.min(insets.top, 24) : 0);
  }, [insets.top]);

  return (
    <View className="flex-1 bg-white" style={{ backgroundColor: Colors.background, paddingTop: insets.top }}>
      <View className="px-5" style={{ paddingTop: contentTopPadding }}>
        <Text className="text-3xl font-bold" style={{ color: Colors.darkText }}>
          Community
        </Text>
      </View>

      {bannerVisible ? (
        <View className="mx-5 mt-4 rounded-2xl px-4 py-4" style={{ backgroundColor: Colors.lightGrey }}>
          <Text className="text-sm font-semibold" style={{ color: Colors.midGrey }}>
            Upgrade to Premium to post and join the conversation
          </Text>
        </View>
      ) : null}

      {loadingPosts ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderPost}
          contentContainerStyle={{
            paddingHorizontal: 0,
            paddingTop: bannerVisible ? 10 : 6,
            paddingBottom: 140,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="mt-10 items-center px-10">
              <Text className="text-base font-semibold" style={{ color: Colors.midGrey }}>
                No posts yet. Be the first to share.
              </Text>
            </View>
          }
        />
      )}

      {canPost ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setPostModalOpen(true)}
          className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: Colors.primary }}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={postModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) setPostModalOpen(false);
        }}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => !saving && setPostModalOpen(false)}
        >
          <Pressable
            className="rounded-t-3xl bg-white px-5 pt-5"
            style={{ paddingBottom: 26 + insets.bottom }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold" style={{ color: Colors.darkText }}>
                Write a post
              </Text>
              <TouchableOpacity onPress={() => !saving && setPostModalOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={28} color={Colors.midGrey} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={draft}
              onChangeText={(text) =>
                setDraft(clampLength(text, MAX_COMMUNITY_POST_LENGTH))
              }
              placeholder="Share what's on your mind..."
              placeholderTextColor={Colors.midGrey}
              multiline
              className="mt-4 min-h-[110px] rounded-2xl px-4 py-3"
              style={{ backgroundColor: Colors.lightGrey, borderWidth: 1, borderColor: Colors.lightGrey, color: Colors.darkText }}
            />

            <TouchableOpacity
              disabled={saving || draft.trim().length === 0}
              onPress={onSubmitPost}
              className="mt-5 items-center rounded-2xl py-4"
              style={{ backgroundColor: Colors.primary, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-bold text-white">Post</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
