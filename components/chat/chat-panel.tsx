"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ChatLabels = {
  title: string;
  threadsLabel: string;
  noThreads: string;
  selectThread: string;
  loadOlder: string;
  messagePlaceholder: string;
  send: string;
  sending: string;
  loadingThreads: string;
  loadingMessages: string;
  unread: string;
  newConversation: string;
  recipients: string;
  searchUsers: string;
  subjectOptional: string;
  createConversation: string;
  creatingConversation: string;
  noUsersFound: string;
  customerDetails: string;
  lastBooking: string;
  noBooking: string;
  bookingDate: string;
  bookingStatus: string;
  bookingService: string;
  bookingPrice: string;
};

type Props = {
  locale: string;
  labels: ChatLabels;
};

type ApiErrorPayload = {
  error?: { message?: string };
};

type ChatUser = {
  id: string;
  fullName: string | null;
  phone: string;
  role?: string;
};

type MePayload = {
  success: boolean;
  data?: {
    user: {
      id: string;
      fullName: string | null;
      phone: string;
      role: string;
      locale: string;
      isActive: boolean;
    } | null;
  };
  error?: ApiErrorPayload["error"];
};

type ThreadItem = {
  id: string;
  subject: string | null;
  updatedAt: string;
  participants: Array<{
    id: string;
    userId: string;
    user: ChatUser;
  }>;
  latestMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderId: string;
    sender: ChatUser;
  } | null;
  unreadCount: number;
};

type ThreadsPayload = {
  success: boolean;
  data?: { items: ThreadItem[] };
  error?: ApiErrorPayload["error"];
};

type MessageItem = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: ChatUser;
  seenBy: Array<{
    id: string;
    userId: string;
    messageId: string;
    seenAt: string;
  }>;
};

type MessagesPayload = {
  success: boolean;
  data?: {
    messages: MessageItem[];
    nextCursor: string | null;
  };
  error?: ApiErrorPayload["error"];
};

type UsersPayload = {
  success: boolean;
  data?: {
    items: Array<{
      id: string;
      fullName: string | null;
      phone: string;
      role: string;
    }>;
  };
  error?: ApiErrorPayload["error"];
};

type CreateThreadPayload = {
  success: boolean;
  data?: { item: { id: string } };
  error?: ApiErrorPayload["error"];
};

type CustomerProfilePayload = {
  success: boolean;
  data?: {
    customer: {
      id: string;
      fullName: string | null;
      phone: string;
      role: string;
    } | null;
    lastBooking: {
      id: string;
      status: string;
      appointmentAt: string;
      finalPrice: string | number | null;
      serviceNameSnapshotEn: string;
      serviceNameSnapshotAr: string;
    } | null;
  };
  error?: ApiErrorPayload["error"];
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

function displayName(user: ChatUser): string {
  return user.fullName || user.phone;
}

function resolveThreadTitle(
  thread: ThreadItem,
  currentUserId: string | null,
  currentUserRole: string | null
): string {
  const others = thread.participants.filter((participant) => participant.userId !== currentUserId);
  const nonAdminOthers = others.filter((participant) => participant.user.role !== "ADMIN");
  const adminOthers = others.filter((participant) => participant.user.role === "ADMIN");

  if (currentUserRole === "ADMIN" && nonAdminOthers.length) {
    return nonAdminOthers.map((participant) => displayName(participant.user)).join(", ");
  }

  if (currentUserRole !== "ADMIN" && adminOthers.length) {
    return adminOthers.map((participant) => displayName(participant.user)).join(", ");
  }

  if (others.length) {
    return others.map((participant) => displayName(participant.user)).join(", ");
  }

  if (thread.subject) {
    return thread.subject;
  }

  return "Thread";
}

export function ChatPanel({ locale, labels }: Props): React.ReactElement {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [composerSubject, setComposerSubject] = useState("");
  const [userResults, setUserResults] = useState<Array<{ id: string; fullName: string | null; phone: string; role: string }>>(
    []
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfilePayload["data"] | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const activeTitle = useMemo(() => {
    if (!activeThread) {
      return "";
    }
    return resolveThreadTitle(activeThread, currentUserId, currentUserRole);
  }, [activeThread, currentUserId, currentUserRole]);

  const fetchCurrentUser = useCallback(async (): Promise<void> => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const json = (await response.json()) as MePayload;
    if (!response.ok) {
      throw new Error(getErrorMessage(json, "Failed to load user."));
    }
    setCurrentUserId(json.data?.user?.id ?? null);
    setCurrentUserRole(json.data?.user?.role ?? null);
  }, []);

  const fetchThreads = useCallback(
    async (preserveSelection: boolean): Promise<void> => {
      const response = await fetch("/api/chat/threads", { cache: "no-store" });
      const json = (await response.json()) as ThreadsPayload;
      if (!response.ok) {
        throw new Error(getErrorMessage(json, "Failed to load threads."));
      }

      const items = json.data?.items ?? [];
      setThreads(items);

      setActiveThreadId((prev) => {
        if (preserveSelection && prev && items.some((item) => item.id === prev)) {
          return prev;
        }
        return items[0]?.id ?? null;
      });
    },
    []
  );

  const fetchUsers = useCallback(async (q: string): Promise<void> => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) {
        params.set("q", q.trim());
      }
      params.set("take", "20");

      const response = await fetch(`/api/chat/users?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as UsersPayload;
      if (!response.ok) {
        throw new Error(getErrorMessage(json, "Failed to load users."));
      }
      setUserResults(json.data?.items ?? []);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchCustomerProfile = useCallback(async (threadId: string): Promise<void> => {
    setProfileLoading(true);
    try {
      const params = new URLSearchParams({ threadId });
      const response = await fetch(`/api/chat/customer-profile?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as CustomerProfilePayload;
      if (!response.ok) {
        throw new Error(getErrorMessage(json, "Failed to load customer profile."));
      }
      setCustomerProfile(json.data ?? null);
    } catch (profileError) {
      setCustomerProfile(null);
      setError(profileError instanceof Error ? profileError.message : "Failed to load customer profile.");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const markSeen = useCallback(
    async (threadId: string, rows: MessageItem[]): Promise<void> => {
      if (!currentUserId) {
        return;
      }

      const unseenIds = rows
        .filter((item) => item.senderId !== currentUserId && item.seenBy.length === 0)
        .map((item) => item.id);

      if (!unseenIds.length) {
        return;
      }

      const response = await fetch("/api/chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: unseenIds })
      });
      if (!response.ok) {
        return;
      }

      const unseenIdSet = new Set(unseenIds);
      const seenAt = new Date().toISOString();
      setMessages((prev) =>
        prev.map((item) =>
          unseenIdSet.has(item.id)
            ? {
                ...item,
                seenBy:
                  item.seenBy.length > 0
                    ? item.seenBy
                    : [{ id: `local-seen-${item.id}`, userId: currentUserId, messageId: item.id, seenAt }]
              }
            : item
        )
      );
      setThreads((prev) => prev.map((thread) => (thread.id === threadId ? { ...thread, unreadCount: 0 } : thread)));
    },
    [currentUserId]
  );

  const fetchMessages = useCallback(
    async (threadId: string, cursor?: string): Promise<{ messages: MessageItem[]; nextCursor: string | null }> => {
      const params = new URLSearchParams({
        threadId,
        take: "50"
      });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(`/api/chat/messages?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as MessagesPayload;
      if (!response.ok) {
        throw new Error(getErrorMessage(json, "Failed to load messages."));
      }

      return {
        messages: json.data?.messages ?? [],
        nextCursor: json.data?.nextCursor ?? null
      };
    },
    []
  );

  const loadLatestMessages = useCallback(
    async (threadId: string, silent = false): Promise<void> => {
      if (!silent) {
        setMessagesLoading(true);
        setError(null);
      }

      try {
        const result = await fetchMessages(threadId);
        setMessages(result.messages);
        setNextCursor(result.nextCursor);
        await markSeen(threadId, result.messages);
      } catch (loadError) {
        if (!silent) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load messages.");
        }
      } finally {
        if (!silent) {
          setMessagesLoading(false);
        }
      }
    },
    [fetchMessages, markSeen]
  );

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      setThreadsLoading(true);
      setError(null);
      try {
        await fetchCurrentUser();
        await fetchThreads(false);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load chat.");
      } finally {
        setThreadsLoading(false);
      }
    }

    void bootstrap();
  }, [fetchCurrentUser, fetchThreads]);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      setNextCursor(null);
      setCustomerProfile(null);
      return;
    }
    void loadLatestMessages(activeThreadId);
    if (currentUserRole === "ADMIN") {
      void fetchCustomerProfile(activeThreadId);
    } else {
      setCustomerProfile(null);
    }
  }, [activeThreadId, currentUserRole, loadLatestMessages, fetchCustomerProfile]);

  useEffect(() => {
    if (!isComposerOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetchUsers(searchQuery);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [isComposerOpen, searchQuery, fetchUsers]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchThreads(true);
      if (activeThreadId) {
        void loadLatestMessages(activeThreadId, true);
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [fetchThreads, activeThreadId, loadLatestMessages]);

  async function loadOlderMessages(): Promise<void> {
    if (!activeThreadId || !nextCursor || loadingOlder) {
      return;
    }

    setLoadingOlder(true);
    setError(null);

    try {
      const result = await fetchMessages(activeThreadId, nextCursor);
      setMessages((prev) => [...result.messages, ...prev]);
      setNextCursor(result.nextCursor);
      await markSeen(activeThreadId, result.messages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeThreadId) {
      return;
    }

    const body = messageDraft.trim();
    if (!body) {
      return;
    }

    setSending(true);
    setError(null);
    const response = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: activeThreadId, body })
    });
    const json = (await response.json()) as unknown;
    setSending(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to send message."));
      return;
    }

    setMessageDraft("");
    await Promise.all([loadLatestMessages(activeThreadId), fetchThreads(true)]);
  }

  function toggleRecipient(userId: string): void {
    setSelectedUserId((prev) => (prev === userId ? null : userId));
  }

  async function createConversation(): Promise<void> {
    if (!selectedUserId) {
      setError("Please select at least one recipient.");
      return;
    }

    setCreatingThread(true);
    setError(null);

    const response = await fetch("/api/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantUserIds: [selectedUserId],
        subject: composerSubject.trim() || undefined
      })
    });
    const json = (await response.json()) as CreateThreadPayload;
    setCreatingThread(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create conversation."));
      return;
    }

    const threadId = json.data?.item?.id ?? null;
    setComposerOpen(false);
    setSearchQuery("");
    setComposerSubject("");
    setSelectedUserId(null);
    setUserResults([]);

    await fetchThreads(true);
    if (threadId) {
      setActiveThreadId(threadId);
      await loadLatestMessages(threadId);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{labels.title}</h1>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">{labels.threadsLabel}</span>
              <button
                type="button"
                onClick={() => setComposerOpen((prev) => !prev)}
                className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                {labels.newConversation}
              </button>
            </div>
          </div>

          {isComposerOpen ? (
            <div className="border-b border-slate-200 p-3">
              <div className="grid gap-2">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-600">{labels.searchUsers}</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    placeholder={labels.searchUsers}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-slate-600">{labels.subjectOptional}</span>
                  <input
                    value={composerSubject}
                    onChange={(event) => setComposerSubject(event.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    maxLength={160}
                    placeholder={labels.subjectOptional}
                  />
                </label>

                <div className="rounded-md border border-slate-200 p-2">
                  <p className="mb-2 text-xs font-semibold text-slate-600">{labels.recipients}</p>
                  {usersLoading ? <p className="text-xs text-slate-500">{labels.loadingThreads}</p> : null}
                  {!usersLoading && !userResults.length ? <p className="text-xs text-slate-500">{labels.noUsersFound}</p> : null}
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {userResults.map((user) => (
                      <label key={user.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedUserId === user.id}
                          onChange={() => toggleRecipient(user.id)}
                        />
                        <span className="line-clamp-1">{user.fullName || user.phone}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void createConversation();
                  }}
                  disabled={creatingThread || !selectedUserId}
                  className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
                >
                  {creatingThread ? labels.creatingConversation : labels.createConversation}
                </button>
              </div>
            </div>
          ) : null}

          <div className="max-h-[70vh] overflow-y-auto p-2">
            {threadsLoading ? <p className="p-2 text-sm text-slate-500">{labels.loadingThreads}</p> : null}
            {!threadsLoading && !threads.length ? <p className="p-2 text-sm text-slate-500">{labels.noThreads}</p> : null}
            <div className="grid gap-1">
              {threads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                const preview = thread.latestMessage?.body ?? "";
                const previewDate = thread.latestMessage?.createdAt ?? thread.updatedAt;
                const title = resolveThreadTitle(thread, currentUserId, currentUserRole);

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`rounded-lg px-3 py-2 text-left transition ${
                      isActive ? "bg-brand-100 text-brand-900" : "hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold">{title}</p>
                      {thread.unreadCount > 0 ? (
                        <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {labels.unread}: {thread.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="line-clamp-1 text-xs text-slate-600">{preview}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{new Date(previewDate).toLocaleString(locale)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex min-h-[520px] min-w-0 flex-col rounded-xl border border-slate-200 bg-white">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">{labels.selectThread}</div>
          ) : (
            <>
              <header className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">{activeTitle}</h2>
                {currentUserRole === "ADMIN" ? (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-700">{labels.customerDetails}</p>
                    {profileLoading ? <p className="mt-1 text-xs text-slate-500">{labels.loadingMessages}</p> : null}
                    {!profileLoading && customerProfile?.customer ? (
                      <div className="mt-1 grid gap-1 text-xs text-slate-700">
                        <p>{displayName(customerProfile.customer)}</p>
                        <p>{customerProfile.customer.phone}</p>
                        <p>{customerProfile.customer.role}</p>
                        <div className="mt-1 border-t border-slate-200 pt-1">
                          <p className="font-semibold">{labels.lastBooking}</p>
                          {customerProfile.lastBooking ? (
                            <div className="mt-1 grid gap-1">
                              <p>
                                {labels.bookingService}:{" "}
                                {locale === "ar"
                                  ? customerProfile.lastBooking.serviceNameSnapshotAr
                                  : customerProfile.lastBooking.serviceNameSnapshotEn}
                              </p>
                              <p>
                                {labels.bookingStatus}: {customerProfile.lastBooking.status}
                              </p>
                              <p>
                                {labels.bookingDate}: {new Date(customerProfile.lastBooking.appointmentAt).toLocaleString(locale)}
                              </p>
                              <p>
                                {labels.bookingPrice}:{" "}
                                {customerProfile.lastBooking.finalPrice !== null
                                  ? customerProfile.lastBooking.finalPrice.toString()
                                  : "-"}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-1">{labels.noBooking}</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </header>

              <div className="flex-1 overflow-y-auto p-4">
                {nextCursor ? (
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        void loadOlderMessages();
                      }}
                      disabled={loadingOlder}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70"
                    >
                      {loadingOlder ? "..." : labels.loadOlder}
                    </button>
                  </div>
                ) : null}

                {messagesLoading ? <p className="text-sm text-slate-500">{labels.loadingMessages}</p> : null}

                <div className="space-y-2">
                  {messages.map((item) => {
                    const own = item.senderId === currentUserId;
                    return (
                      <div key={item.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <article
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            own ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          <p className="mb-1 text-[11px] opacity-80">{displayName(item.sender)}</p>
                          <p className="whitespace-pre-wrap break-words">{item.body}</p>
                          <p className="mt-1 text-[10px] opacity-80">{new Date(item.createdAt).toLocaleString(locale)}</p>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={sendMessage} className="border-t border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    maxLength={2000}
                    placeholder={labels.messagePlaceholder}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={sending || messageDraft.trim().length === 0}
                    className="rounded-md bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
                  >
                    {sending ? labels.sending : labels.send}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
