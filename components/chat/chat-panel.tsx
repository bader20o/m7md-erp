"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type Props = { locale: string; labels: ChatLabels };
type Role = "ADMIN" | "EMPLOYEE" | "CUSTOMER";
type ChatUser = { id: string; fullName: string | null; phone: string; role: Role; avatarUrl?: string | null };
type ConversationItem = {
  id: string;
  type: "SUPPORT" | "CENTER";
  updatedAt: string;
  participants: Array<{ userId: string; user: ChatUser; lastReadAt: string | null }>;
  latestMessage: MessageItem | null;
  unreadCount: number;
};
type MessageItem = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "VOICE" | "LINK";
  fileUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
  sender: ChatUser;
};
type EmployeeItem = { id: string; fullName: string | null; phone: string; role: "EMPLOYEE"; avatarUrl?: string | null };
type CustomerProfile = {
  customer: ChatUser | null;
  lastBooking: {
    id: string;
    status: string;
    appointmentAt: string;
    finalPrice: string | number | null;
    serviceNameSnapshotEn: string;
    serviceNameSnapshotAr: string;
  } | null;
};
type RecordedVoice = { blob: Blob; url: string; durationSec: number; waveform: number[]; mimeType: string };
type RecorderStatus = "idle" | "requesting" | "recording" | "preview";

function err(payload: unknown, fallback: string): string {
  return (payload as { error?: { message?: string } })?.error?.message ?? fallback;
}
function displayName(user: ChatUser | null): string {
  return user ? user.fullName || user.phone : "Support";
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function customerOf(conversation: ConversationItem): ChatUser | null {
  return conversation.participants.find((p) => p.user.role === "CUSTOMER")?.user ?? null;
}
function adminOf(conversation: ConversationItem): ChatUser | null {
  return conversation.participants.find((p) => p.user.role === "ADMIN")?.user ?? null;
}

function Avatar({ user, large = false }: { user: ChatUser | null; large?: boolean }): React.ReactElement {
  const size = large ? "h-12 w-12" : "h-10 w-10";
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt={displayName(user)} className={`${size} rounded-full object-cover`} />;
  }
  return (
    <div className={`${size} flex items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-sm font-semibold text-white`}>
      {initials(displayName(user))}
    </div>
  );
}

function VoicePlayer({ url }: { url: string }): React.ReactElement {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const load = (): void => setDuration(Math.round(audio.duration || 0));
    const update = (): void => setTime(audio.currentTime);
    const end = (): void => {
      setPlaying(false);
      setTime(0);
    };
    audio.addEventListener("loadedmetadata", load);
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("ended", end);
    return () => {
      audio.removeEventListener("loadedmetadata", load);
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("ended", end);
    };
  }, []);
  const ratio = duration > 0 ? (time / duration) * 100 : 0;
  return (
    <div className="min-w-[220px]">
      <audio ref={ref} src={url} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const audio = ref.current;
            if (!audio) return;
            if (playing) {
              audio.pause();
              setPlaying(false);
            } else {
              void audio.play();
              setPlaying(true);
            }
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
        >
          {playing ? "||" : ">"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-current/80" style={{ width: `${ratio}%` }} />
          </div>
          <p className="mt-1 text-[11px] opacity-80">{fmtDuration(Math.max(duration, Math.round(time)))}</p>
        </div>
      </div>
    </div>
  );
}

export function ChatPanel({ locale, labels }: Props): React.ReactElement {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [threads, setThreads] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [participants, setParticipants] = useState<Array<{ userId: string; user: ChatUser }>>([]);
  const [employeeCandidates, setEmployeeCandidates] = useState<EmployeeItem[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [voice, setVoice] = useState<RecordedVoice | null>(null);
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>("idle");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const waveformRef = useRef<number[]>([]);
  const discardVoiceRef = useRef(false);

  const supportConversations = useMemo(() => threads.filter((t) => t.type === "SUPPORT"), [threads]);
  const centerConversation = useMemo(() => threads.find((t) => t.type === "CENTER") ?? null, [threads]);
  const activeConversation = useMemo(() => threads.find((t) => t.id === activeConversationId) ?? null, [threads, activeConversationId]);

  const fetchMe = useCallback(async (): Promise<ChatUser | null> => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const json = (await response.json()) as { data?: { user: ChatUser | null } };
    if (!response.ok) throw new Error(err(json, "Failed to load user"));
    return json.data?.user ?? null;
  }, []);

  const fetchThreads = useCallback(async (preserve = true): Promise<void> => {
    const response = await fetch("/api/chat/threads", { cache: "no-store" });
    const json = (await response.json()) as { data?: { items: ConversationItem[] } };
    if (!response.ok) throw new Error(err(json, "Failed to load conversations"));
    const items = json.data?.items ?? [];
    setThreads(items);
    setActiveConversationId((prev) => {
      if (preserve && prev && items.some((item) => item.id === prev)) return prev;
      if (currentUser?.role === "CUSTOMER") return items.find((item) => item.type === "SUPPORT")?.id ?? null;
      if (currentUser?.role === "EMPLOYEE") return items.find((item) => item.type === "CENTER")?.id ?? null;
      return items.find((item) => item.type === "SUPPORT")?.id ?? items[0]?.id ?? null;
    });
  }, [currentUser?.role]);

  const fetchMessages = useCallback(async (conversationId: string, cursor?: string): Promise<void> => {
    const params = new URLSearchParams({ conversationId, take: "20" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/chat/messages?${params.toString()}`, { cache: "no-store" });
    const json = (await response.json()) as { data?: { messages: MessageItem[]; nextCursor: string | null } };
    if (!response.ok) throw new Error(err(json, "Failed to load messages"));
    setMessages((prev) => (cursor ? [...(json.data?.messages ?? []), ...prev] : (json.data?.messages ?? [])));
    setNextCursor(json.data?.nextCursor ?? null);
    await fetch("/api/chat/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId }) });
  }, []);

  const fetchCenterParticipants = useCallback(async (): Promise<void> => {
    if (currentUser?.role !== "ADMIN") return;
    const response = await fetch("/api/chat/center/participants", { cache: "no-store" });
    const json = (await response.json()) as { data?: { participants: Array<{ userId: string; user: ChatUser }> } };
    if (response.ok) setParticipants(json.data?.participants ?? []);
  }, [currentUser?.role]);

  const fetchEmployeeCandidates = useCallback(async (): Promise<void> => {
    if (currentUser?.role !== "ADMIN") return;
    const response = await fetch("/api/chat/users?role=EMPLOYEE&take=50", { cache: "no-store" });
    const json = (await response.json()) as { data?: { items: EmployeeItem[] } };
    if (response.ok) setEmployeeCandidates(json.data?.items ?? []);
  }, [currentUser?.role]);

  const fetchCustomerProfile = useCallback(async (conversationId: string): Promise<void> => {
    if (currentUser?.role !== "ADMIN") return setCustomerProfile(null);
    const response = await fetch(`/api/chat/customer-profile?conversationId=${conversationId}`, { cache: "no-store" });
    const json = (await response.json()) as { data?: CustomerProfile };
    setCustomerProfile(response.ok ? (json.data ?? null) : null);
  }, [currentUser?.role]);

  useEffect(() => {
    void (async () => {
      setThreadsLoading(true);
      try {
        setCurrentUser(await fetchMe());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load chat.");
      } finally {
        setThreadsLoading(false);
      }
    })();
  }, [fetchMe]);

  useEffect(() => {
    if (!currentUser) return;
    void fetchThreads(false);
    void fetchCenterParticipants();
    void fetchEmployeeCandidates();
  }, [currentUser, fetchThreads, fetchCenterParticipants, fetchEmployeeCandidates]);

  useEffect(() => {
    if (!activeConversationId) return;
    setMessagesLoading(true);
    void fetchMessages(activeConversationId)
      .then(() => fetchThreads(true))
      .finally(() => setMessagesLoading(false));
    const c = threads.find((item) => item.id === activeConversationId);
    if (c?.type === "SUPPORT") void fetchCustomerProfile(activeConversationId);
  }, [activeConversationId, fetchMessages, fetchThreads, threads, fetchCustomerProfile]);

  useEffect(() => {
    if (!currentUser) return;
    const source = new EventSource("/api/chat/events");
    const refresh = (): void => {
      void fetchThreads(true);
      if (activeConversationId) void fetchMessages(activeConversationId);
      void fetchCenterParticipants();
    };
    source.addEventListener("message:new", refresh);
    source.addEventListener("message:deleted", refresh);
    source.addEventListener("conversation:read", refresh);
    source.addEventListener("participant:added", refresh);
    source.addEventListener("participant:removed", refresh);
    return () => source.close();
  }, [activeConversationId, currentUser, fetchMessages, fetchThreads, fetchCenterParticipants]);

  useEffect(() => {
    return () => {
      discardVoiceRef.current = true;
      try {
        if (mediaRef.current?.state === "recording") {
          mediaRef.current.stop();
        }
      } catch {
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (voice?.url) URL.revokeObjectURL(voice.url);
    };
  }, [voice?.url]);

  const stopTracks = useCallback((): void => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearRecorder = useCallback((): void => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    mediaRef.current = null;
    startRef.current = null;
    chunksRef.current = [];
    waveformRef.current = [];
    setRecording(false);
    setRecordingSeconds(0);
    setWaveform([]);
  }, []);

  const recorderMimeType = useCallback((): string => {
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return "";
    const preferred = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/mpeg"
    ];
    const found = preferred.find((mime) => MediaRecorder.isTypeSupported(mime));
    return found ?? "";
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (recorderStatus === "recording" || recorderStatus === "requesting") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone recording is not supported in this browser.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("MediaRecorder is not available in this browser.");
      return;
    }

    setRecorderStatus("requesting");
    setError(null);
    try {
      if (voice?.url) URL.revokeObjectURL(voice.url);
      setVoice(null);
      setFile(null);
      discardVoiceRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!stream.getAudioTracks().length) {
        throw new Error("No microphone input device was found.");
      }
      streamRef.current = stream;
      const mimeType = recorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRef.current = recorder;
      startRef.current = Date.now();
      setRecording(true);
      setRecorderStatus("recording");
      setWaveform([]);
      setRecordingSeconds(0);
      chunksRef.current = [];
      waveformRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const durationSec = startRef.current ? Math.max(1, Math.round((Date.now() - startRef.current) / 1000)) : 1;
        if (!discardVoiceRef.current && chunksRef.current.length) {
          const finalMime = recorder.mimeType || mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: finalMime });
          const url = URL.createObjectURL(blob);
          const graph = waveformRef.current.length ? waveformRef.current : [30, 45, 55, 35, 60];
          setVoice({ blob, url, durationSec, waveform: graph, mimeType: finalMime });
          setRecorderStatus("preview");
        } else {
          setRecorderStatus("idle");
        }
        stopTracks();
        clearRecorder();
      };
      timerRef.current = window.setInterval(() => {
        if (!startRef.current) return;
        setRecordingSeconds(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
      }, 250);
      const tick = (): void => {
        const next = [...waveformRef.current.slice(-31), Math.floor(Math.random() * 65) + 20];
        waveformRef.current = next;
        setWaveform(next);
        rafRef.current = window.requestAnimationFrame(tick);
      };
      tick();
      recorder.start(250);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Microphone access is required to record a voice message.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("No microphone device was found.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError("Microphone is unavailable right now. Please try again.");
      } else {
        setError(e instanceof Error ? e.message : "Voice recording is not available on this device.");
      }
      stopTracks();
      clearRecorder();
      setRecorderStatus("idle");
    }
  }, [clearRecorder, recorderMimeType, recorderStatus, stopTracks, voice?.url]);

  const stopRecording = useCallback((): void => {
    const recorder = mediaRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
  }, []);

  const cancelVoice = useCallback((): void => {
    discardVoiceRef.current = true;
    const recorder = mediaRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else {
      stopTracks();
      clearRecorder();
      setRecorderStatus("idle");
    }
    if (voice?.url) URL.revokeObjectURL(voice.url);
    setVoice(null);
  }, [clearRecorder, stopTracks, voice]);

  const uploadFile = useCallback(async (upload: File): Promise<string> => {
    const form = new FormData();
    form.append("file", upload);
    const response = await fetch("/api/chat/uploads", { method: "POST", body: form });
    const json = (await response.json()) as { data?: { fileUrl: string } };
    if (!response.ok || !json.data?.fileUrl) throw new Error(err(json, "Upload failed."));
    return json.data.fileUrl;
  }, []);

  const sendMessage = useCallback(async (): Promise<void> => {
    setSending(true);
    setError(null);
    try {
      let payload: { conversationId?: string; type?: string; content?: string; fileUrl?: string } = { conversationId: activeConversationId ?? undefined };
      const content = draft.trim();
      if (voice) {
        const ext = voice.mimeType.includes("mpeg") ? "mp3" : voice.mimeType.includes("ogg") ? "ogg" : voice.mimeType.includes("mp4") ? "m4a" : "webm";
        const fileUrl = await uploadFile(new File([voice.blob], `voice.${ext}`, { type: voice.mimeType }));
        payload = { ...payload, type: "VOICE", fileUrl, content: content || `Voice message (${fmtDuration(voice.durationSec)})` };
      } else if (file) {
        const fileUrl = await uploadFile(file);
        payload = { ...payload, type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE", fileUrl, content };
      } else if (/^https?:\/\/\S+$/i.test(content)) {
        payload = { ...payload, type: "LINK", content };
      } else {
        payload = { ...payload, type: "TEXT", content };
      }
      const response = await fetch("/api/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await response.json();
      if (!response.ok) throw new Error(err(json, "Failed to send message"));
      setDraft("");
      setFile(null);
      if (voice?.url) URL.revokeObjectURL(voice.url);
      setVoice(null);
      setWaveform([]);
      setRecorderStatus("idle");
      await fetchThreads(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }, [activeConversationId, draft, fetchThreads, file, uploadFile, voice]);

  const canSend = Boolean(draft.trim() || file || voice);
  const isAdmin = currentUser?.role === "ADMIN";
  const headerUser =
    currentUser?.role === "CUSTOMER"
      ? adminOf(activeConversation as ConversationItem)
      : currentUser?.role === "ADMIN"
        ? customerOf(activeConversation as ConversationItem)
        : null;

  return (
    <section className="space-y-4">
      <div className="rounded-[28px] border border-sky-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(226,240,255,0.92))] p-6 shadow-[0_24px_90px_-44px_rgba(17,94,169,0.42)]">
        <h1 className="text-2xl font-semibold text-slate-950">{labels.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isAdmin ? "Manage support and internal conversations from one workspace." : "Direct support conversation with management."}
        </p>
      </div>

      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className={isAdmin ? "grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]" : "grid gap-4"}>
        {isAdmin ? (
          <aside className="overflow-hidden rounded-[24px] border border-sky-100 bg-white shadow-[0_20px_70px_-46px_rgba(17,94,169,0.45)]">
            <div className="border-b border-sky-100 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">{labels.threadsLabel}</p>
            </div>
            <div className="max-h-[72vh] space-y-3 overflow-y-auto p-3">
              {threadsLoading ? <p className="p-2 text-sm text-slate-500">{labels.loadingThreads}</p> : null}
              <div className="space-y-2">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Support</p>
                {supportConversations.map((conversation) => {
                  const customer = customerOf(conversation);
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-200 ${activeConversationId === conversation.id ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-50"}`}
                    >
                      <Avatar user={customer} large />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{displayName(customer)}</p>
                          {conversation.unreadCount > 0 ? <span className="rounded-full bg-sky-700 px-2 py-0.5 text-[10px] font-semibold text-white">{conversation.unreadCount}</span> : null}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Customer</span>
                          <p className="truncate text-xs text-slate-500">{conversation.latestMessage?.content ?? "No messages yet"}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {centerConversation ? (
                <div className="space-y-2">
                  <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Internal</p>
                  <button
                    type="button"
                    onClick={() => setActiveConversationId(centerConversation.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-200 ${activeConversationId === centerConversation.id ? "bg-sky-50 ring-1 ring-sky-200" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-600 to-blue-800 text-sm font-semibold text-white">HQ</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">Center Chat</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Employee</span>
                        <p className="truncate text-xs text-slate-500">{centerConversation.latestMessage?.content ?? "No messages yet"}</p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}

        <div className="flex min-h-[640px] min-w-0 flex-col overflow-hidden rounded-[24px] border border-sky-100 bg-white shadow-[0_20px_70px_-46px_rgba(17,94,169,0.45)]">
          {!activeConversation ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">{labels.selectThread}</div>
          ) : (
            <>
              <header className="border-b border-sky-100 bg-sky-50/70 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar user={headerUser} large={false} />
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {currentUser?.role === "EMPLOYEE" || currentUser?.role === "CUSTOMER"
                          ? "Management Support"
                          : activeConversation.type === "CENTER"
                            ? "Center Chat"
                            : displayName(headerUser)}
                      </h2>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span>Online</span>
                      </div>
                    </div>
                  </div>
                  {isAdmin && activeConversation.type === "CENTER" ? (
                    <div className="flex items-center gap-2">
                      <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
                        <option value="">Add employee</option>
                        {employeeCandidates.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName || employee.phone}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => { void (async () => {
                          if (!selectedEmployeeId) return;
                          await fetch("/api/chat/center/participants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedEmployeeId }) });
                          setSelectedEmployeeId("");
                          await fetchCenterParticipants();
                          await fetchThreads(true);
                        })(); }}
                        className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Add
                      </button>
                    </div>
                  ) : null}
                </div>
                {isAdmin && activeConversation.type === "SUPPORT" && customerProfile?.customer ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-sky-100 bg-white p-4 md:grid-cols-[auto_minmax(0,1fr)]">
                    <Avatar user={customerProfile.customer} large />
                    <div className="grid gap-1 text-sm text-slate-600">
                      <p className="font-semibold text-slate-900">{displayName(customerProfile.customer)}</p>
                      <p>{customerProfile.customer.phone}</p>
                      {customerProfile.lastBooking ? (
                        <div className="mt-2 grid gap-1 rounded-xl bg-sky-50 p-3 text-xs">
                          <p className="font-semibold text-slate-900">{labels.lastBooking}</p>
                          <p>{labels.bookingDate}: {new Date(customerProfile.lastBooking.appointmentAt).toLocaleString(locale)}</p>
                          <p>{labels.bookingStatus}: {customerProfile.lastBooking.status}</p>
                          <p>{labels.bookingPrice}: {customerProfile.lastBooking.finalPrice ?? "-"} JOD</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {isAdmin && activeConversation.type === "CENTER" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {participants.map((participant) => (
                      <button
                        key={participant.userId}
                        type="button"
                        onClick={() => { void (async () => {
                          if (participant.user.role !== "EMPLOYEE") return;
                          await fetch("/api/chat/center/participants", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: participant.userId }) });
                          await fetchCenterParticipants();
                          await fetchThreads(true);
                        })(); }}
                        className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-slate-700"
                      >
                        {displayName(participant.user)}{participant.user.role === "EMPLOYEE" ? " x" : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
              </header>

              <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,251,255,0.7),rgba(255,255,255,1))] p-4">
                {nextCursor ? (
                  <button
                    type="button"
                    disabled={loadingOlder}
                    onClick={() => {
                      if (!activeConversationId || !nextCursor) return;
                      setLoadingOlder(true);
                      void fetchMessages(activeConversationId, nextCursor).finally(() => setLoadingOlder(false));
                    }}
                    className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {labels.loadOlder}
                  </button>
                ) : null}
                {messagesLoading ? <p className="text-sm text-slate-500">{labels.loadingMessages}</p> : null}
                <div className="space-y-3">
                  {messages.map((message) => {
                    const own = message.senderId === currentUser?.id;
                    return (
                      <div key={message.id} className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
                        {!own ? <Avatar user={message.sender} /> : null}
                        <article className={`max-w-[85%] rounded-[22px] px-4 py-3 text-sm shadow-[0_18px_40px_-34px_rgba(17,94,169,0.45)] ${own ? "bg-sky-700 text-white" : "bg-white text-slate-800"}`}>
                          <p className="mb-1 text-[11px] opacity-75">{displayName(message.sender)}</p>
                          {message.deletedAt ? <p className="italic opacity-70">Message deleted</p> : null}
                          {!message.deletedAt && message.type === "TEXT" ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}
                          {!message.deletedAt && message.type === "LINK" ? <a href={message.content} target="_blank" rel="noreferrer" className="underline">{message.content}</a> : null}
                          {!message.deletedAt && message.type === "IMAGE" && message.fileUrl ? <img src={message.fileUrl} alt="chat upload" className="max-h-72 rounded-2xl object-cover" /> : null}
                          {!message.deletedAt && message.type === "VIDEO" && message.fileUrl ? <div className="relative overflow-hidden rounded-2xl"><video src={message.fileUrl} controls preload="metadata" className="max-h-72 rounded-2xl" /><span className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-950/60 px-2 py-1 text-[10px] font-semibold text-white">Play</span></div> : null}
                          {!message.deletedAt && message.type === "VOICE" && message.fileUrl ? <VoicePlayer url={message.fileUrl} /> : null}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] opacity-80">{new Date(message.createdAt).toLocaleString(locale)}</p>
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form
                className="border-t border-sky-100 bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!canSend || sending) return;
                  void sendMessage();
                }}
              >
                {file ? <div className="mb-3 flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-sm text-slate-700"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFile(null)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Remove</button></div> : null}
                {voice ? (
                  <div className="mb-3 grid gap-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                    <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">Voice preview ({fmtDuration(voice.durationSec)})</p><button type="button" onClick={cancelVoice} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Delete recording</button></div>
                    <div className="flex h-12 items-end gap-1 rounded-xl bg-white px-3 py-2">{voice.waveform.map((point, index) => <span key={`${point}-${index}`} className="w-1 rounded-full bg-sky-500" style={{ height: `${Math.max(10, point)}%` }} />)}</div>
                    <VoicePlayer url={voice.url} />
                    <div className="flex justify-end">
                      <button type="button" disabled={sending} onClick={() => { if (!sending) void sendMessage(); }} className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-700 px-4 text-xs font-semibold text-white transition duration-200 hover:bg-sky-800 disabled:opacity-70">Send audio</button>
                    </div>
                  </div>
                ) : null}
                {recording ? <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 p-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="h-3 w-3 animate-pulse rounded-full bg-red-500" /><p className="text-sm font-semibold text-red-700">Recording... {fmtDuration(recordingSeconds)}</p></div><div className="flex items-center gap-2"><button type="button" onClick={stopRecording} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs text-red-700">Stop</button><button type="button" onClick={cancelVoice} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs text-red-700">Cancel</button></div></div><div className="mt-3 flex h-12 items-end gap-1 rounded-xl bg-white px-3 py-2">{(waveform.length ? waveform : [24, 35, 18, 42, 28]).map((point, index) => <span key={`${point}-${index}`} className="w-1 rounded-full bg-red-400" style={{ height: `${Math.max(10, point)}%` }} />)}</div></div> : null}
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input disabled={recording} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={labels.messagePlaceholder} maxLength={2000} className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition duration-200 focus:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60" />
                  <div className="flex items-center justify-end gap-2">
                    <label className="inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-700 transition duration-200 hover:bg-slate-100">Media<input type="file" accept="image/*,video/*" onChange={(e) => { if (voice?.url) URL.revokeObjectURL(voice.url); setVoice(null); setRecorderStatus("idle"); setFile(e.target.files?.[0] ?? null); }} className="hidden" /></label>
                    {!recording ? <button type="button" disabled={sending || recorderStatus === "requesting"} onClick={() => { void startRecording(); }} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-700 transition duration-200 hover:bg-slate-100 disabled:opacity-60">{recorderStatus === "requesting" ? "Starting..." : "Voice"}</button> : null}
                    <button type="submit" disabled={!canSend || sending || recording} className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-700 px-5 text-xs font-semibold text-white transition duration-200 hover:bg-sky-800 disabled:opacity-70">{sending ? labels.sending : labels.send}</button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
