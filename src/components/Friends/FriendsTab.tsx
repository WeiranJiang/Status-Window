import { Check, Copy, Loader, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  acceptFriendRequest,
  declineFriendRequest,
  loadFriends,
  loadIncomingRequests,
  loadOutgoingRequests,
  removeFriend,
  sendFriendRequest,
  withdrawFriendRequest,
  type FriendProfile,
  type IncomingRequest,
  type OutgoingRequest,
} from "../../lib/friends";
import { formatDurationShort } from "../../lib/stats";

// ── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
      {children}
    </span>
  );
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${online ? "bg-[var(--leaf)]" : "bg-[var(--border)]"}`}
      title={online ? "Studying now" : "Offline"}
    />
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function FriendsTab({
  userId,
  onError,
}: {
  userId: string;
  onError: (msg: string) => void;
}) {
  const [inviteInput, setInviteInput] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [reqIdMap, setReqIdMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [dbIssueMessage, setDbIssueMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = async () => {
    try {
      const [incomingData, outgoingData, { list, requestId }] = await Promise.all([
        loadIncomingRequests(userId),
        loadOutgoingRequests(userId),
        loadFriends(userId),
      ]);
      if (!mountedRef.current) return;
      setIncoming(incomingData);
      setOutgoing(outgoingData);
      setFriends(list);
      const map: Record<string, string> = {};
      list.forEach((f) => { map[f.userId] = requestId(f.userId); });
      setReqIdMap(map);
      setDbIssueMessage(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("table") || msg.toLowerCase().includes("schema")) {
        setDbIssueMessage(msg);
      } else {
        onError(msg);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [userId]);

  const handleSend = async () => {
    const target = inviteInput.trim();
    if (!target) return;
    setSendBusy(true);
    try {
      await sendFriendRequest(userId, target);
      setInviteInput("");
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not send request.");
    } finally {
      setSendBusy(false);
    }
  };

  const handleAccept = async (req: IncomingRequest) => {
    try {
      await acceptFriendRequest(req.id);
      setIncoming((c) => c.filter((r) => r.id !== req.id));
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not accept.");
    }
  };

  const handleDecline = async (req: IncomingRequest) => {
    try {
      await declineFriendRequest(req.id);
      setIncoming((c) => c.filter((r) => r.id !== req.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not decline.");
    }
  };

  const handleRemove = async (friend: FriendProfile) => {
    const rid = reqIdMap[friend.userId];
    if (!rid) return;
    try {
      await removeFriend(rid);
      setFriends((c) => c.filter((f) => f.userId !== friend.userId));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove.");
    }
  };

  const handleWithdraw = async (req: OutgoingRequest) => {
    try {
      await withdrawFriendRequest(req.id);
      setOutgoing((current) => current.filter((item) => item.id !== req.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not withdraw invite.");
    }
  };

  const copyId = () => {
    void navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (dbIssueMessage) {
    return (
      <div className="flex flex-col gap-4 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5 text-center">
          <p className="text-xs font-bold text-[var(--ink)]">Friends needs DB setup</p>
          <p className="mt-2 text-[10px] font-bold text-[var(--muted)] leading-5">
            {dbIssueMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-4 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* MY ID */}
      <section>
        <SectionLabel>My User ID</SectionLabel>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3">
          <span className="flex-1 truncate text-[10px] font-bold text-[var(--muted)] font-mono">
            {userId}
          </span>
          <button
            onClick={copyId}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:bg-[var(--sky-soft)] hover:text-[var(--sky-dark)] active:scale-95"
            title="Copy ID"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[var(--leaf)]" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-[9px] font-bold text-[var(--muted)] uppercase tracking-wide">
          Share this with friends so they can add you
        </p>
      </section>

      {/* ADD FRIEND */}
      <section>
        <SectionLabel>Add Friend (Send Invite)</SectionLabel>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
            placeholder="Paste a friend's user ID…"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-2.5 text-xs font-bold text-[var(--ink)] focus:border-[var(--sky)] focus:ring-1 focus:ring-[var(--sky)] outline-none font-mono"
          />
          <button
            disabled={sendBusy || !inviteInput.trim()}
            onClick={() => void handleSend()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sky)] text-white shadow-md transition-all active:scale-95 disabled:opacity-40"
          >
            {sendBusy ? <Loader className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          </button>
        </div>
      </section>

      {/* INCOMING REQUESTS */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader className="h-5 w-5 animate-spin text-[var(--muted)]" />
        </div>
      ) : (
        <>
          {outgoing.length > 0 && (
            <section>
              <SectionLabel>Pending Invites</SectionLabel>
              <div className="mt-3 flex flex-col gap-2">
                {outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3"
                  >
                    <div className="flex flex-1 flex-col">
                      <span className="text-xs font-bold text-[var(--ink)]">{req.displayName}</span>
                      <span className="text-[9px] font-black uppercase tracking-wide text-[var(--muted)]">
                        Pending
                      </span>
                    </div>
                    <button
                      onClick={() => void handleWithdraw(req)}
                      className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-[var(--muted)] transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500 active:scale-95"
                      title="Withdraw invite"
                    >
                      Withdraw
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {incoming.length > 0 && (
            <section>
              <SectionLabel>Incoming Requests</SectionLabel>
              <div className="mt-3 flex flex-col gap-2">
                {incoming.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3"
                  >
                    <span className="flex-1 text-xs font-bold text-[var(--ink)]">{req.displayName}</span>
                    <button
                      onClick={() => void handleAccept(req)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sky)] text-white shadow-sm transition-all active:scale-95"
                      title="Accept"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void handleDecline(req)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:bg-red-50 hover:text-red-500 active:scale-95"
                      title="Decline"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FRIEND LIST */}
          <section className="mb-12">
            <SectionLabel>Friends ({friends.length})</SectionLabel>
            {friends.length === 0 ? (
              <p className="mt-3 text-xs font-bold text-[var(--muted)]">
                No friends yet.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {friends.map((friend) => (
                  <div
                    key={friend.userId}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3"
                  >
                    <OnlineDot online={friend.isOnline} />
                    <div className="flex flex-1 flex-col">
                      <span className="text-xs font-bold text-[var(--ink)]">{friend.displayName}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        {friend.isOnline ? "Studying now · " : ""}
                        {friend.todaySeconds >= 60
                          ? `${formatDurationShort(friend.todaySeconds)} today`
                          : "No sessions today"}
                      </span>
                    </div>
                    <button
                      onClick={() => void handleRemove(friend)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-all hover:bg-red-50 hover:text-red-500 active:scale-95"
                      title="Remove friend"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
