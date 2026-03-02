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
    return `<audio controls src="${message.fileUrl}" class="max-w-full"></audio>`;
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
    const mediaBtn = document.getElementById("send-media-btn");
    const mediaInput = document.getElementById("chat-media-input");
    const adminPill = document.getElementById("admin-chat-pill");

    const state = {
      me: store.state.user,
      threads: [],
      currentConversationId: null,
      messages: [],
      currentConversation: null,
      isSending: false
    };

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
          const canDelete = !message.deletedAt && (isMine || isAdminRole(state.me?.role));
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
                  ${canDelete ? `<button class="text-[10px] text-danger hover:underline" onclick="window.deleteChatMessage('${message.id}')">Delete</button>` : ""}
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
      }
    }

    async function sendTextMessage() {
      const body = chatInput.value.trim();
      if (!body || state.isSending) return;
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

    window.deleteChatMessage = async (messageId) => {
      try {
        await apiFetch(`/chat/messages/${messageId}`, { method: "DELETE" });
        await loadMessages(state.currentConversationId);
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

    await loadThreads();
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
