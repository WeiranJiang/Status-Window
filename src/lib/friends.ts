import { supabase } from "./supabaseClient";

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: string;
}

export interface FriendProfile {
  userId: string;
  displayName: string;
  todaySeconds: number; // seconds studied today
  isOnline: boolean;    // true if a timer is currently active
}

// ── Helpers ────────────────────────────────────────────────────────────────

const todayUtcStart = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

const formatFriendName = (displayName: string | null | undefined) => {
  const trimmed = displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Unknown user";
};

// ── Friend requests ────────────────────────────────────────────────────────

/** Send a friend request from the current user to another user by their ID. */
export const sendFriendRequest = async (fromUserId: string, toUserId: string): Promise<void> => {
  if (fromUserId === toUserId) {
    throw new Error("You can't add yourself.");
  }

  // Check if a relationship already exists in either direction.
  const { data: existing, error: existingError } = await supabase
    .from("friend_requests")
    .select("id, status")
    .or(
      `and(from_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${fromUserId})`,
    )
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    if (existing.status === "accepted") throw new Error("You're already friends.");
    if (existing.status === "pending") throw new Error("A request is already pending.");
    // declined → allow re-sending by updating
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "pending", from_user_id: fromUserId, to_user_id: toUserId })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("friend_requests")
    .insert({ from_user_id: fromUserId, to_user_id: toUserId, status: "pending" });

  if (error) throw new Error(error.message);
};

/** Accept a pending request. */
export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);

  if (error) throw new Error(error.message);
};

/** Decline (or remove) a request. */
export const declineFriendRequest = async (requestId: string): Promise<void> => {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "declined" })
    .eq("id", requestId);

  if (error) throw new Error(error.message);
};

/** Remove an accepted friendship. */
export const removeFriend = async (requestId: string): Promise<void> => {
  const { error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId);

  if (error) throw new Error(error.message);
};

/** Withdraw a pending friend request. */
export const withdrawFriendRequest = async (requestId: string): Promise<void> => {
  await removeFriend(requestId);
};

// ── Loading ────────────────────────────────────────────────────────────────

export interface IncomingRequest {
  id: string;
  fromUserId: string;
  displayName: string;
}

export interface OutgoingRequest {
  id: string;
  toUserId: string;
  displayName: string;
}

/** Load pending requests directed at the current user. */
export const loadIncomingRequests = async (userId: string): Promise<IncomingRequest[]> => {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, from_user_id")
    .eq("to_user_id", userId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  const rows = (data as Array<{
    id: string;
    from_user_id: string;
  }>) ?? [];

  const requesterIds = Array.from(new Set(rows.map((row) => row.from_user_id)));
  const profileMap: Record<string, string> = {};

  if (requesterIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", requesterIds);

    if (profilesError) throw new Error(profilesError.message);

    ((profiles as Array<{ id: string; display_name: string | null }>) ?? []).forEach((profile) => {
      profileMap[profile.id] = formatFriendName(profile.display_name);
    });
  }

  return rows.map((row) => ({
    id: row.id,
    fromUserId: row.from_user_id,
    displayName: profileMap[row.from_user_id] ?? "Unknown user",
  }));
};

/** Load pending requests sent by the current user. */
export const loadOutgoingRequests = async (userId: string): Promise<OutgoingRequest[]> => {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, to_user_id")
    .eq("from_user_id", userId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  const rows = (data as Array<{
    id: string;
    to_user_id: string;
  }>) ?? [];

  const recipientIds = Array.from(new Set(rows.map((row) => row.to_user_id)));
  const profileMap: Record<string, string> = {};

  if (recipientIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", recipientIds);

    if (profilesError) throw new Error(profilesError.message);

    ((profiles as Array<{ id: string; display_name: string | null }>) ?? []).forEach((profile) => {
      profileMap[profile.id] = formatFriendName(profile.display_name);
    });
  }

  return rows.map((row) => ({
    id: row.id,
    toUserId: row.to_user_id,
    displayName: profileMap[row.to_user_id] ?? "Unknown user",
  }));
};

/** Load accepted friends with today's study hours and online status. */
export const loadFriends = async (userId: string): Promise<{ list: FriendProfile[]; requestId: (friendId: string) => string }> => {
  // Step 1: accepted friendships
  const { data: reqs, error: reqErr } = await supabase
    .from("friend_requests")
    .select("id, from_user_id, to_user_id")
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .eq("status", "accepted");

  if (reqErr) throw new Error(reqErr.message);
  const rows = (reqs ?? []) as Array<{ id: string; from_user_id: string; to_user_id: string }>;

  const friendIds = rows.map((r) => (r.from_user_id === userId ? r.to_user_id : r.from_user_id));
  const reqIdMap: Record<string, string> = {};
  rows.forEach((r) => {
    const friendId = r.from_user_id === userId ? r.to_user_id : r.from_user_id;
    reqIdMap[friendId] = r.id;
  });

  if (friendIds.length === 0) {
    return { list: [], requestId: () => "" };
  }

  // Step 2: profiles
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", friendIds);

  if (profErr) throw new Error(profErr.message);
  const profileMap: Record<string, string> = {};
  ((profiles as Array<{ id: string; display_name: string | null }>) ?? []).forEach((p) => {
    profileMap[p.id] = formatFriendName(p.display_name);
  });

  // Step 3: today's study seconds per friend
  const { data: sessions, error: sessErr } = await supabase
    .from("study_sessions")
    .select("user_id, duration_seconds")
    .in("user_id", friendIds)
    .gte("start_time", todayUtcStart());

  if (sessErr) throw new Error(sessErr.message);
  const secondsMap: Record<string, number> = {};
  ((sessions as Array<{ user_id: string; duration_seconds: number }>) ?? []).forEach((s) => {
    secondsMap[s.user_id] = (secondsMap[s.user_id] ?? 0) + s.duration_seconds;
  });

  // Step 4: online status (active timer visible from background timer_state key)
  // We store per-user online status in a lightweight presence table.
  // Fall back gracefully if the table doesn't exist.
  const onlineSet = new Set<string>();
  try {
    const { data: presence } = await supabase
      .from("user_presence")
      .select("user_id")
      .in("user_id", friendIds)
      .eq("is_online", true);
    ((presence as Array<{ user_id: string }>) ?? []).forEach((p) => onlineSet.add(p.user_id));
  } catch {
    // table may not exist yet; ignore
  }

  const list: FriendProfile[] = friendIds.map((id) => ({
    userId: id,
    displayName: profileMap[id] ?? "Unknown user",
    todaySeconds: secondsMap[id] ?? 0,
    isOnline: onlineSet.has(id),
  }));

  return {
    list,
    requestId: (friendId: string) => reqIdMap[friendId] ?? "",
  };
};
