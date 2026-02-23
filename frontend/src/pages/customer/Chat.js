import { apiFetch } from "../../lib/api.js";
import { ConfirmModal } from "../../components/ui/Modal.js";
import { store } from "../../lib/store.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function uploadMedia(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", "chat");

  const response = await fetch("/api/uploads/local", {
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

function detectMessageType(file) {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "VOICE";
  return null;
}

export function Chat() {
  window.onMount = async () => {
    const threadListContainer = document.getElementById("thread-list");
    const messagesContainer = document.getElementById("messages-container");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-msg-btn");
    const imageBtn = document.getElementById("send-image-btn");
    const mediaBtn = document.getElementById("send-media-btn");
    const mediaInput = document.getElementById("chat-media-input");

    const state = {
      threads: [],
      currentThreadId: null,
      isSending: false
    };

    async function ensureThread() {
      if (state.currentThreadId) return state.currentThreadId;
      const created = await apiFetch("/chat/threads", {
        method: "POST",
        body: { subject: "Support" }
      });
      state.currentThreadId = created.item.id;
      return state.currentThreadId;
    }

    async function loadThreads() {
      try {
        const res = await apiFetch("/chat/threads");
        state.threads = res.items || [];
        if (!state.currentThreadId && state.threads.length) {
          state.currentThreadId = state.threads[0].id;
        }

        renderThreads();
        if (state.currentThreadId) {
          loadMessages(state.currentThreadId);
        } else {
          messagesContainer.innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center text-muted">
              <svg class="w-12 h-12 mb-4 text-border" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              <p>Start your first support message.</p>
            </div>
          `;
        }
      } catch (error) {
        threadListContainer.innerHTML = `<div class="p-4 text-center text-sm text-danger">${error.message}</div>`;
      }
    }

    function renderThreads() {
      if (!state.threads.length) {
        threadListContainer.innerHTML = `<div class="p-4 text-center text-sm text-muted">No conversations yet.</div>`;
        return;
      }

      threadListContainer.innerHTML = state.threads
        .map(
          (thread) => `
          <button class="w-full text-left p-4 border-b border-border transition-colors ${
            thread.id === state.currentThreadId ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-bg"
          }" onclick="window.switchThread('${thread.id}')">
            <div class="text-xs font-bold uppercase tracking-wider text-text mb-1">Support</div>
            <div class="text-xs text-muted truncate">${escapeHtml(thread.latestMessage?.body || "No messages yet")}</div>
          </button>
        `
        )
        .join("");
    }

    async function loadMessages(threadId) {
      if (!threadId) return;
      messagesContainer.innerHTML = `<div class="p-10 text-center text-muted">Loading messages...</div>`;

      try {
        const res = await apiFetch(`/chat/messages?threadId=${threadId}&take=60`);
        renderMessages(res.messages || []);
      } catch (error) {
        messagesContainer.innerHTML = `<div class="p-4 text-center text-danger text-sm">${error.message}</div>`;
      }
    }

    function renderMessageBody(message) {
      if (message.deletedAt) {
        return `<div class="italic opacity-70">Message deleted</div>`;
      }

      if (message.messageType === "IMAGE" && message.mediaUrl) {
        return `<img src="${message.mediaUrl}" class="max-w-full rounded-lg border border-border" alt="chat-image">`;
      }

      if (message.messageType === "VIDEO" && message.mediaUrl) {
        return `<video src="${message.mediaUrl}" controls class="max-w-full rounded-lg border border-border"></video>`;
      }

      if (message.messageType === "VOICE" && message.mediaUrl) {
        return `<audio src="${message.mediaUrl}" controls class="w-full"></audio>`;
      }

      return `<div>${escapeHtml(message.body || "")}</div>`;
    }

    function renderMessages(messages) {
      const myId = store.state.user.id;
      if (!messages.length) {
        messagesContainer.innerHTML = `<div class="p-4 text-center text-muted text-sm mt-auto">Send a message to start.</div>`;
        return;
      }

      messagesContainer.innerHTML = messages
        .map((message) => {
          const isMine = message.senderId === myId;
          const canDelete = !message.deletedAt && (isMine || store.state.user.role === "ADMIN");
          const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          return `
            <div class="flex w-full mb-4 ${isMine ? "justify-end" : "justify-start"}">
              <div class="max-w-[85%] md:max-w-[65%] flex flex-col gap-1">
                <div class="px-4 py-3 rounded-2xl text-sm ${
                  isMine ? "bg-primary text-white rounded-tr-sm shadow-md" : "bg-surface border border-border text-text rounded-tl-sm shadow-sm"
                }">
                  ${renderMessageBody(message)}
                </div>
                <div class="flex items-center ${isMine ? "justify-end" : "justify-start"} gap-2">
                  <div class="text-[10px] text-muted">${time}</div>
                  ${
                    canDelete
                      ? `<button class="text-[10px] text-danger hover:underline" onclick="window.deleteChatMessage('${message.id}')">Delete</button>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendPayload(payload) {
      state.isSending = true;
      sendBtn.disabled = true;
      sendBtn.classList.add("opacity-60");

      try {
        const threadId = await ensureThread();
        await apiFetch("/chat/messages", {
          method: "POST",
          body: {
            threadId,
            ...payload
          }
        });
        chatInput.value = "";
        await loadThreads();
      } finally {
        state.isSending = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove("opacity-60");
      }
    }

    async function sendTextMessage() {
      const body = chatInput.value.trim();
      if (!body || state.isSending) return;
      try {
        await sendPayload({ messageType: "TEXT", body });
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

      const confirmed = await ConfirmModal({
        title: "Send media?",
        message: `Are you sure you want to send ${file.name}?`,
        confirmText: "Send",
        cancelText: "Cancel",
        intent: "primary"
      });
      if (!confirmed) return;

      try {
        const mediaUrl = await uploadMedia(file);
        await sendPayload({
          messageType,
          mediaUrl,
          mediaMimeType: file.type
        });
      } catch (error) {
        window.toast(error.message, "error");
      }
    }

    window.switchThread = (threadId) => {
      state.currentThreadId = threadId;
      renderThreads();
      loadMessages(threadId);
    };

    window.deleteChatMessage = async (messageId) => {
      try {
        await apiFetch(`/chat/messages/${messageId}`, { method: "DELETE" });
        await loadMessages(state.currentThreadId);
      } catch (error) {
        window.toast(error.message, "error");
      }
    };

    sendBtn.addEventListener("click", sendTextMessage);
    chatInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendTextMessage();
      }
    });

    imageBtn.addEventListener("click", () => {
      mediaInput.accept = "image/*";
      mediaInput.click();
    });

    mediaBtn.addEventListener("click", () => {
      mediaInput.accept = "image/*,video/*,audio/*";
      mediaInput.click();
    });

    mediaInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      await sendMedia(file);
    });

    loadThreads();
  };

  return `
    <div class="bg-bg border border-border flex flex-col md:flex-row h-[calc(100vh-140px)] rounded-2xl overflow-hidden shadow-sm">
      <div class="w-full md:w-80 border-r border-border bg-surface flex flex-col h-1/3 md:h-full shrink-0">
        <div class="p-4 border-b border-border bg-black/5 dark:bg-white/5">
          <h2 class="font-heading font-bold text-lg text-text">Live Support</h2>
          <p class="text-xs text-muted mt-1">Text, image, video, and voice notes.</p>
        </div>
        <div id="thread-list" class="flex-1 overflow-y-auto">
          <div class="p-4"><div class="skeleton h-12 w-full rounded-lg mb-2"></div><div class="skeleton h-12 w-full rounded-lg"></div></div>
        </div>
      </div>

      <div class="flex-1 flex flex-col bg-bg h-2/3 md:h-full relative">
        <div class="h-16 border-b border-border bg-surface flex items-center px-6 shrink-0">
          <div>
            <h3 class="font-bold text-sm text-text leading-tight">Customer Support</h3>
            <p class="text-xs text-muted">No seen/sent indicators</p>
          </div>
        </div>

        <div id="messages-container" class="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col scroll-smooth"></div>

        <div class="p-4 bg-surface border-t border-border shrink-0">
          <div class="bg-bg border border-border rounded-xl p-2">
            <div class="flex items-end gap-2">
              <textarea id="chat-input" rows="1" class="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none px-3 py-2 text-sm text-text max-h-32" placeholder="Write a message..."></textarea>
              <button id="send-image-btn" class="w-10 h-10 rounded-lg border border-border text-muted hover:text-primary hover:border-primary" title="Send image">
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-10h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </button>
              <button id="send-media-btn" class="w-10 h-10 rounded-lg border border-border text-muted hover:text-primary hover:border-primary" title="Send media">
                <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-6 2h2a2 2 0 002-2V10a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"></path></svg>
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
