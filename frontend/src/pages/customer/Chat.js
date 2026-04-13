import { apiFetch } from "../../lib/api.js";
import { store } from "../../lib/store.js";
import { isAdminRole, isCustomerRole, isEmployeeRole } from "../../lib/roles.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function displayName(user) {
  if (!user) return "Support";
  return user.fullName ? String(user.fullName).trim() : String(user.phone || "Support");
}

function initials(user) {
  const name = displayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  return (letters || name.slice(0, 2) || "U").toUpperCase();
}

function conversationTitle(conversation, me) {
  if (!conversation) return "Chat";
  if (conversation.type === "CENTER") return "Management Chat";
  if (isCustomerRole(me?.role)) return "Support";
  const customer = conversation.participants.find((item) => item.user?.role === "CUSTOMER")?.user;
  return customer ? displayName(customer) : "Support";
}

function avatar(user, size = "w-10 h-10") {
  if (user?.avatarUrl) {
    return `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(displayName(user))}" class="${size} rounded-full object-cover border border-border shrink-0">`;
  }
  return `<div class="${size} rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center border border-border shrink-0">${escapeHtml(initials(user))}</div>`;
}

function messagePreview(message) {
  if (!message) return "No messages yet.";
  if (message.deletedAt) return "Message deleted";
  if (message.type === "IMAGE") return "Image";
  if (message.type === "VIDEO") return "Video";
  if (message.type === "VOICE") return "Voice message";
  return message.content || "No messages yet.";
}

function messageBody(message) {
  if (message.deletedAt) {
    return `<div class="italic opacity-70">Message deleted</div>`;
  }

  if (message.type === "IMAGE" && message.fileUrl) {
    return `<img src="${message.fileUrl}" class="max-w-full rounded-lg border border-border" alt="chat-image">`;
  }

  if (message.type === "VIDEO" && message.fileUrl) {
    return `<video src="${message.fileUrl}" controls class="max-w-full rounded-lg border border-border"></video>`;
  }

  if (message.type === "VOICE" && message.fileUrl) {
    return `<audio controls src="${message.fileUrl}" class="max-w-full rounded-lg border border-border bg-bg/30"></audio>`;
  }

  if (message.type === "LINK") {
    return `<a href="${escapeHtml(message.content || "#")}" target="_blank" rel="noreferrer" class="underline">${escapeHtml(message.content || "")}</a>`;
  }

  return `<div>${escapeHtml(message.content || "")}</div>`;
}

function senderName(message) {
  return displayName(message?.sender);
}

function detectMessageType(file) {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "VOICE";
  return null;
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function detectRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const preferred = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg"
  ];
  return preferred.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
}

async function uploadMedia(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/chat/uploads", {
    method: "POST",
    credentials: "include",
    body: formData
  });
  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || "Upload failed.");
  }
  return json.data.fileUrl;
}

export function Chat() {
  window.onMount = async () => {
    const threadListContainer = document.getElementById("thread-list");
    const messagesContainer = document.getElementById("messages-container");
    const chatHeaderTitle = document.getElementById("chat-header-title");
    const chatHeaderSubtitle = document.getElementById("chat-header-subtitle");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-msg-btn");
    const imageBtn = document.getElementById("send-image-btn");
    const voiceBtn = document.getElementById("voice-record-btn");
    const mediaInput = document.getElementById("chat-media-input");
    const recordingBanner = document.getElementById("chat-recording-banner");
    const recordingTimer = document.getElementById("chat-recording-timer");
    const stopRecordingBtn = document.getElementById("chat-recording-stop");
    const cancelRecordingBtn = document.getElementById("chat-recording-cancel");
    const voicePreviewCard = document.getElementById("chat-voice-preview");
    const voicePreviewAudio = document.getElementById("chat-voice-preview-audio");
    const voicePreviewDuration = document.getElementById("chat-voice-preview-duration");
    const sendVoiceBtn = document.getElementById("chat-voice-send");
    const deleteVoiceBtn = document.getElementById("chat-voice-delete");
    const adminPill = document.getElementById("admin-chat-pill");

    const state = {
      me: store.state.user,
      threads: [],
      currentConversationId: null,
      messages: [],
      currentConversation: null,
      isSending: false,
      recordingState: "idle",
      recordingSeconds: 0,
      recordedVoice: null
    };

    let mediaRecorder = null;
    let mediaStream = null;
    let recordingTimerInterval = null;
    let recordingStartedAt = null;
    let recordedChunks = [];
    let previewObjectUrl = null;
    let discardRecording = false;

    async function loadThreads() {
      try {
        const res = await apiFetch("/chat/threads");
        state.threads = res.items || [];
        if (!state.currentConversationId || !state.threads.some((thread) => thread.id === state.currentConversationId)) {
          if (isEmployeeRole(state.me?.role)) {
            state.currentConversationId = state.threads.find((thread) => thread.type === "CENTER")?.id || state.threads[0]?.id || null;
          } else if (isCustomerRole(state.me?.role)) {
            state.currentConversationId = state.threads.find((thread) => thread.type === "SUPPORT")?.id || null;
          } else {
            state.currentConversationId = state.threads.find((thread) => thread.type === "SUPPORT")?.id || state.threads[0]?.id || null;
          }
        }

        state.currentConversation = state.threads.find((thread) => thread.id === state.currentConversationId) || null;
        renderThreads();

        if (state.currentConversationId) {
          await loadMessages(state.currentConversationId);
        } else {
          renderEmptyState();
        }
      } catch (error) {
        threadListContainer.innerHTML = `<div class="p-4 text-center text-sm text-danger">${escapeHtml(error.message)}</div>`;
        renderEmptyState("Unable to load conversations.");
      }
    }

    async function ensureSupportConversationForCustomer() {
      if (!isCustomerRole(state.me?.role)) {
        throw new Error("Conversation is required.");
      }
      const created = await apiFetch("/chat/threads", {
        method: "POST",
        body: { type: "SUPPORT" }
      });
      state.currentConversationId = created.item.id;
      return created.item.id;
    }

    function renderEmptyState(message = "Start your first message.") {
      state.messages = [];
      state.currentConversation = null;
      chatHeaderTitle.textContent = isEmployeeRole(state.me?.role) ? "Management Chat" : "Support";
      chatHeaderSubtitle.textContent = isEmployeeRole(state.me?.role)
        ? "Direct internal conversation with admins."
        : "Direct support conversation.";
      if (adminPill) adminPill.innerHTML = "";
      messagesContainer.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center text-muted">
          <svg class="w-12 h-12 mb-4 text-border" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          <p>${escapeHtml(message)}</p>
        </div>
      `;
    }

    function renderThreads() {
      if (!state.threads.length) {
        const emptyLabel = isEmployeeRole(state.me?.role)
          ? "No internal admin conversation yet."
          : "No conversations yet.";
        threadListContainer.innerHTML = `<div class="p-4 text-center text-sm text-muted">${emptyLabel}</div>`;
        return;
      }

      threadListContainer.innerHTML = state.threads
        .map((thread) => {
          const contact =
            thread.type === "CENTER"
              ? { fullName: "Management Chat", phone: "Admin + employee channel", avatarUrl: null }
              : thread.participants.find((p) => p.userId !== state.me?.id)?.user ||
                thread.participants.find((p) => p.user?.role === "CUSTOMER")?.user ||
                null;

          return `
            <button class="w-full text-left p-4 border-b border-border transition-colors ${
              thread.id === state.currentConversationId ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-bg"
            }" onclick="window.switchConversation('${thread.id}')">
              <div class="flex items-start gap-3">
                ${avatar(contact)}
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <div class="text-sm font-semibold text-text truncate">${escapeHtml(conversationTitle(thread, state.me))}</div>
                    ${thread.unreadCount > 0 ? `<span class="inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">${thread.unreadCount}</span>` : ""}
                  </div>
                  <div class="text-xs text-muted truncate">${escapeHtml(thread.type === "CENTER" ? "Internal admin channel" : displayName(contact))}</div>
                  <div class="text-xs text-muted truncate mt-1">${escapeHtml(messagePreview(thread.latestMessage))}</div>
                </div>
              </div>
            </button>
          `;
        })
        .join("");
    }

    async function loadMessages(conversationId) {
      if (!conversationId) return;
      messagesContainer.innerHTML = `<div class="p-10 text-center text-muted">Loading messages...</div>`;

      try {
        const res = await apiFetch(`/chat/messages?conversationId=${conversationId}&take=50`);
        state.messages = res.messages || [];
        state.currentConversation = state.threads.find((thread) => thread.id === conversationId) || null;
        renderMessages();
        await apiFetch("/chat/messages", {
          method: "PATCH",
          body: { conversationId }
        });
        state.threads = state.threads.map((thread) =>
          thread.id === conversationId ? { ...thread, unreadCount: 0 } : thread
        );
        renderThreads();
      } catch (error) {
        messagesContainer.innerHTML = `<div class="p-4 text-center text-danger text-sm">${escapeHtml(error.message)}</div>`;
      }
    }

    function renderMessages() {
      const conversation = state.currentConversation;
      chatHeaderTitle.textContent = conversationTitle(conversation, state.me);
      chatHeaderSubtitle.textContent =
        conversation?.type === "CENTER"
          ? "Internal employee <-> admin conversation"
          : isCustomerRole(state.me?.role)
            ? "Talk directly with management"
            : "Customer support conversation";

      if (adminPill) {
        adminPill.innerHTML =
          isAdminRole(state.me?.role) && conversation?.type === "SUPPORT"
            ? `<span class="inline-flex items-center rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text">${escapeHtml(conversationTitle(conversation, state.me))}</span>`
            : "";
      }

      if (!state.messages.length) {
        messagesContainer.innerHTML = `<div class="p-4 text-center text-muted text-sm mt-auto">Send a message to start.</div>`;
        return;
      }

      const myId = state.me?.id;
      messagesContainer.innerHTML = state.messages
        .map((message) => {
          const isMine = message.senderId === myId;
          const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          return `
            <div class="flex w-full mb-4 ${isMine ? "justify-end" : "justify-start"}">
              <div class="max-w-[85%] md:max-w-[65%] flex flex-col gap-1">
                <div class="px-4 py-3 rounded-2xl text-sm ${
                  isMine ? "bg-primary text-white rounded-tr-sm shadow-md" : "bg-surface border border-border text-text rounded-tl-sm shadow-sm"
                }">
                  ${!isMine ? `<div class="text-[11px] font-semibold mb-1 text-primary">${escapeHtml(senderName(message))}</div>` : ""}
                  ${messageBody(message)}
                </div>
                <div class="flex items-center ${isMine ? "justify-end" : "justify-start"} gap-2">
                  <div class="text-[10px] text-muted">${time}</div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function clearRecordingTimer() {
      if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
      }
    }

    function stopMediaTracks() {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      mediaStream = null;
    }

    function clearVoicePreviewUrl() {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
      previewObjectUrl = null;
    }

    function setRecordingState(nextState) {
      state.recordingState = nextState;
      const isRecording = nextState === "recording";
      const isPreview = nextState === "preview";
      if (recordingBanner) {
        recordingBanner.classList.toggle("hidden", !isRecording);
      }
      if (voicePreviewCard) {
        voicePreviewCard.classList.toggle("hidden", !isPreview);
      }
      if (chatInput) {
        chatInput.disabled = isRecording;
        chatInput.classList.toggle("opacity-60", isRecording);
      }
      if (voiceBtn) {
        voiceBtn.disabled = isRecording || state.isSending || nextState === "requesting";
        voiceBtn.classList.toggle("opacity-60", voiceBtn.disabled);
      }
      if (sendVoiceBtn) {
        sendVoiceBtn.disabled = !isPreview || state.isSending || !state.recordedVoice;
      }
    }

    function resetRecorderToIdle() {
      clearRecordingTimer();
      stopMediaTracks();
      mediaRecorder = null;
      recordingStartedAt = null;
      recordedChunks = [];
      state.recordingSeconds = 0;
      if (recordingTimer) recordingTimer.textContent = "0:00";
      setRecordingState("idle");
    }

    function clearRecordedVoice() {
      clearVoicePreviewUrl();
      state.recordedVoice = null;
      if (voicePreviewAudio) voicePreviewAudio.removeAttribute("src");
      if (voicePreviewDuration) voicePreviewDuration.textContent = "";
      setRecordingState("idle");
    }

    async function startVoiceRecording() {
      if (state.recordingState === "recording" || state.recordingState === "requesting") return;
      if (!navigator.mediaDevices?.getUserMedia) {
        window.toast("Microphone recording is not supported in this browser.", "error");
        return;
      }
      if (typeof MediaRecorder === "undefined") {
        window.toast("MediaRecorder is not available in this browser.", "error");
        return;
      }

      try {
        setRecordingState("requesting");
        discardRecording = false;
        if (state.recordedVoice) clearRecordedVoice();
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mediaStream.getAudioTracks().length) {
          throw new Error("No microphone device was found.");
        }

        const mimeType = detectRecorderMimeType();
        mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
        recordedChunks = [];
        recordingStartedAt = Date.now();
        state.recordingSeconds = 0;
        if (recordingTimer) recordingTimer.textContent = "0:00";

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          clearRecordingTimer();
          stopMediaTracks();
          if (discardRecording || !recordedChunks.length) {
            resetRecorderToIdle();
            return;
          }

          const durationSec = Math.max(1, Math.round((Date.now() - (recordingStartedAt || Date.now())) / 1000));
          const finalType = mediaRecorder?.mimeType || mimeType || "audio/webm";
          const blob = new Blob(recordedChunks, { type: finalType });
          clearVoicePreviewUrl();
          previewObjectUrl = URL.createObjectURL(blob);

          state.recordedVoice = {
            blob,
            mimeType: finalType,
            durationSec
          };

          if (voicePreviewAudio) {
            voicePreviewAudio.src = previewObjectUrl;
            voicePreviewAudio.load();
          }
          if (voicePreviewDuration) {
            voicePreviewDuration.textContent = formatDuration(durationSec);
          }
          setRecordingState("preview");
        };

        mediaRecorder.start(250);
        setRecordingState("recording");
        recordingTimerInterval = setInterval(() => {
          state.recordingSeconds = Math.max(0, Math.floor((Date.now() - (recordingStartedAt || Date.now())) / 1000));
          if (recordingTimer) recordingTimer.textContent = formatDuration(state.recordingSeconds);
        }, 250);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          window.toast("Microphone access is required to record a voice message.", "error");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          window.toast("No microphone device found.", "error");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          window.toast("Microphone is currently unavailable.", "error");
        } else {
          window.toast(error?.message || "Voice recording failed to start.", "error");
        }
        resetRecorderToIdle();
      }
    }

    function stopVoiceRecording() {
      if (!mediaRecorder || mediaRecorder.state !== "recording") return;
      mediaRecorder.stop();
    }

    function cancelVoiceRecording() {
      discardRecording = true;
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      } else {
        resetRecorderToIdle();
      }
      if (state.recordedVoice) {
        clearRecordedVoice();
      }
    }

    async function sendRecordedVoiceMessage() {
      if (!state.recordedVoice || state.isSending) return;
      const voice = state.recordedVoice;
      const ext = voice.mimeType.includes("mpeg") ? "mp3" : voice.mimeType.includes("ogg") ? "ogg" : voice.mimeType.includes("mp4") ? "m4a" : "webm";
      const file = new File([voice.blob], `voice-${Date.now()}.${ext}`, { type: voice.mimeType });
      try {
        const fileUrl = await uploadMedia(file);
        await sendPayload({
          type: "VOICE",
          fileUrl,
          content: `Voice message (${formatDuration(voice.durationSec)})`
        });
        clearRecordedVoice();
      } catch (error) {
        window.toast(error.message || "Failed to send voice message.", "error");
      }
    }

    async function sendPayload(payload) {
      state.isSending = true;
      sendBtn.disabled = true;
      sendBtn.classList.add("opacity-60");
      setRecordingState(state.recordingState);

      try {
        let conversationId = state.currentConversationId;
        if (!conversationId && isCustomerRole(state.me?.role)) {
          conversationId = await ensureSupportConversationForCustomer();
        }

        await apiFetch("/chat/messages", {
          method: "POST",
          body: {
            ...(conversationId ? { conversationId } : {}),
            ...payload
          }
        });
        chatInput.value = "";
        await loadThreads();
      } finally {
        state.isSending = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove("opacity-60");
        setRecordingState(state.recordingState);
      }
    }

    async function sendTextMessage() {
      const body = chatInput.value.trim();
      if (!body || state.isSending || state.recordingState === "recording") return;
      try {
        await sendPayload({ type: /^https?:\/\/\S+$/i.test(body) ? "LINK" : "TEXT", content: body });
      } catch (error) {
        window.toast(error.message, "error");
      }
    }

    async function sendMedia(file) {
      if (!file) return;
      const messageType = detectMessageType(file);
      if (!messageType) {
        window.toast("Unsupported media type", "error");
        return;
      }

      try {
        const fileUrl = await uploadMedia(file);
        await sendPayload({
          type: messageType,
          fileUrl,
          content: messageType === "VOICE" ? "Voice message" : ""
        });
      } catch (error) {
        window.toast(error.message, "error");
      }
    }

    window.switchConversation = (conversationId) => {
      state.currentConversationId = conversationId;
      state.currentConversation = state.threads.find((thread) => thread.id === conversationId) || null;
      renderThreads();
      void loadMessages(conversationId);
    };

    sendBtn.addEventListener("click", sendTextMessage);
    chatInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (state.recordingState === "recording") return;
        sendTextMessage();
      }
    });

    imageBtn.addEventListener("click", () => {
      mediaInput.accept = "image/*";
      mediaInput.click();
    });

    voiceBtn.addEventListener("click", () => {
      void startVoiceRecording();
    });

    stopRecordingBtn.addEventListener("click", stopVoiceRecording);
    cancelRecordingBtn.addEventListener("click", cancelVoiceRecording);
    deleteVoiceBtn.addEventListener("click", clearRecordedVoice);
    sendVoiceBtn.addEventListener("click", () => {
      void sendRecordedVoiceMessage();
    });

    mediaInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      await sendMedia(file);
    });

    const onEscape = (event) => {
      if (event.key === "Escape" && state.recordingState === "recording") {
        cancelVoiceRecording();
      }
    };
    document.addEventListener("keydown", onEscape);

    setRecordingState("idle");

    await loadThreads();

    window.__pageCleanup = () => {
      document.removeEventListener("keydown", onEscape);
      cancelVoiceRecording();
      clearVoicePreviewUrl();
      clearRecordingTimer();
    };
  };

  return `
    <div class="bg-bg border border-border flex flex-col md:flex-row h-[calc(100vh-140px)] rounded-2xl overflow-hidden shadow-sm">
      <div class="w-full md:w-80 border-r border-border bg-surface flex flex-col h-1/3 md:h-full shrink-0">
        <div class="p-4 border-b border-border bg-black/5 dark:bg-white/5">
          <h2 class="font-heading font-bold text-lg text-text">Live Chat</h2>
          <p class="text-xs text-muted mt-1">Employees talk to admins. Customers talk to support.</p>
        </div>
        <div id="thread-list" class="flex-1 overflow-y-auto">
          <div class="p-4"><div class="skeleton h-12 w-full rounded-lg mb-2"></div><div class="skeleton h-12 w-full rounded-lg"></div></div>
        </div>
      </div>

      <div class="flex-1 flex flex-col bg-bg h-2/3 md:h-full relative">
        <div class="h-16 border-b border-border bg-surface flex items-center justify-between px-6 shrink-0">
          <div>
            <h3 id="chat-header-title" class="font-bold text-sm text-text leading-tight">Chat</h3>
            <p id="chat-header-subtitle" class="text-xs text-muted">Conversation</p>
          </div>
          <div id="admin-chat-pill"></div>
        </div>

        <div id="messages-container" class="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col scroll-smooth"></div>

        <div class="p-4 bg-surface border-t border-border shrink-0">
          <div id="chat-recording-banner" class="hidden mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full bg-danger animate-pulse"></span>
                <span class="text-xs font-semibold text-danger">Recording...</span>
                <span id="chat-recording-timer" class="text-xs font-semibold text-text">0:00</span>
              </div>
              <div class="flex items-center gap-2">
                <button id="chat-recording-stop" class="px-3 py-1.5 rounded-lg border border-white/10 bg-bg text-xs font-semibold text-text hover:bg-slate-800/50">Stop</button>
                <button id="chat-recording-cancel" class="px-3 py-1.5 rounded-lg border border-danger/40 bg-danger/10 text-xs font-semibold text-danger hover:bg-danger/20">Cancel</button>
              </div>
            </div>
          </div>

          <div id="chat-voice-preview" class="hidden mb-3 rounded-xl border border-white/10 bg-bg/40 p-3">
            <div class="flex items-center justify-between gap-3 mb-2">
              <p class="text-xs font-semibold text-text">Voice preview <span id="chat-voice-preview-duration" class="text-muted"></span></p>
              <button id="chat-voice-delete" class="px-3 py-1.5 rounded-lg border border-danger/40 bg-danger/10 text-xs font-semibold text-danger hover:bg-danger/20">Delete recording</button>
            </div>
            <audio id="chat-voice-preview-audio" controls class="w-full"></audio>
            <div class="mt-3 flex justify-end">
              <button id="chat-voice-send" class="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold">Send audio</button>
            </div>
          </div>

          <div class="bg-bg border border-border rounded-xl p-2">
            <div class="flex items-end gap-2">
              <textarea id="chat-input" rows="1" class="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none px-3 py-2 text-sm text-text max-h-32" placeholder="Write a message..."></textarea>
              <button id="send-image-btn" class="w-10 h-10 rounded-lg border border-border text-muted hover:text-primary hover:border-primary" title="Send image">
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-10h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </button>
              <button id="voice-record-btn" class="w-10 h-10 rounded-lg border border-border text-muted hover:text-primary hover:border-primary" title="Record voice message">
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4a3 3 0 00-3 3v4a3 3 0 106 0V7a3 3 0 00-3-3z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-14 0M12 18v3"></path></svg>
              </button>
              <button id="send-msg-btn" class="w-10 h-10 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <input id="chat-media-input" type="file" class="hidden">
    </div>
  `;
}
