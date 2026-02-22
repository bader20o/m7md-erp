import { apiFetch } from '../../lib/api.js';
import { store } from '../../lib/store.js';

export function Chat() {

    window.onMount = async () => {
        const threadListContainer = document.getElementById('thread-list');
        const messagesContainer = document.getElementById('messages-container');
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-msg-btn');

        let currentThreadId = null;

        async function loadThreads() {
            try {
                const res = await apiFetch('/chat/threads');
                if (res && res.items && res.items.length > 0) {
                    // just auto-select the first thread for demo simplicity
                    currentThreadId = res.items[0].id;
                    renderThreads(res.items);
                    loadMessages(currentThreadId);
                } else {
                    // If no thread exists, create a general support thread
                    // We need an admin participant id, but backend allows sending null or specific to create thread?
                    // Fallback UI for no threads:
                    threadListContainer.innerHTML = `<div class="p-4 text-center text-sm text-muted">No threads yet</div>`;
                    messagesContainer.innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center text-muted">
              <svg class="w-12 h-12 mb-4 text-border" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              <p>Type a message to start conversing with support</p>
            </div>
          `;
                }
            } catch (e) {
                console.error(e);
            }
        }

        function renderThreads(threads) {
            threadListContainer.innerHTML = threads.map(th => `
        <div class="p-4 border-b border-border cursor-pointer transition-colors ${th.id === currentThreadId ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-surface'}" onclick="window.switchThread('${th.id}')">
          <div class="font-bold text-text uppercase tracking-wider text-xs mb-1">Support Thread</div>
          <div class="text-sm text-muted truncate">${th.lastMessage?.body || 'No messages'}</div>
        </div>
      `).join('');
        }

        window.switchThread = (id) => {
            currentThreadId = id;
            loadThreads(); // re-render list with selection
            loadMessages(id);
        };

        async function loadMessages(threadId) {
            if (!threadId) return;
            messagesContainer.innerHTML = `<div class="p-10 text-center"><div class="skeleton w-8 h-8 rounded-full border-4 border-muted border-t-primary animate-spin inline-block"></div></div>`;
            try {
                const res = await apiFetch(`/chat/messages?threadId=${threadId}&take=50`);
                if (res && res.messages) {
                    renderMessages(res.messages.reverse()); // Bottom up
                }
            } catch (e) {
                messagesContainer.innerHTML = `<div class="p-4 text-center text-danger">Failed to load messages</div>`;
            }
        }

        function renderMessages(messages) {
            const myId = store.state.user.id;
            if (messages.length === 0) {
                messagesContainer.innerHTML = `<div class="p-4 text-center text-muted text-sm mt-auto">Send a message to start</div>`;
                return;
            }

            messagesContainer.innerHTML = messages.map(m => {
                const isMe = m.senderId === myId;
                const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return `
          <div class="flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[80%] md:max-w-[60%] flex flex-col gap-1">
              <div class="px-4 py-3 rounded-2xl text-sm ${isMe ? 'bg-primary text-white rounded-tr-sm shadow-md' : 'bg-surface border border-border text-text rounded-tl-sm shadow-sm whitespace-pre-wrap'}">
                ${m.body}
              </div>
              <div class="text-[10px] text-muted px-1 ${isMe ? 'text-right' : 'text-left'}">${time}</div>
            </div>
          </div>
        `;
            }).join('');

            // scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        async function sendMessage() {
            const body = chatInput.value.trim();
            if (!body) return;

            chatInput.disabled = true;
            sendBtn.disabled = true;

            try {
                if (!currentThreadId) {
                    // we must POST threads with participants to create a new thread
                    // But from PRD, support threads usually involve Reception/Manager
                    // For simplicity in this UI, if no thread exists, the backend should ideally autogenerate or allow a generic post.
                    // Let's assume hitting standard endpoint works.
                    const thRes = await apiFetch('/chat/threads', {
                        method: 'POST',
                        body: { participantUserIds: [store.state.user.id], subject: 'Support' }
                    });
                    if (thRes && thRes.item) currentThreadId = thRes.item.id;
                }

                if (currentThreadId) {
                    await apiFetch('/chat/messages', {
                        method: 'POST',
                        body: { threadId: currentThreadId, body }
                    });
                    chatInput.value = '';
                    loadMessages(currentThreadId);
                }
            } catch (e) {
                window.toast('Failed to send message', 'error');
            } finally {
                chatInput.disabled = false;
                sendBtn.disabled = false;
                chatInput.focus();
            }
        }

        loadThreads();
    };

    return `
    <div class="bg-bg border border-border flex flex-col md:flex-row h-[calc(100vh-140px)] rounded-2xl overflow-hidden shadow-sm">
      
      <!-- Thread List (Sidebar) -->
      <div class="w-full md:w-80 border-r border-border bg-surface flex flex-col h-1/3 md:h-full shrink-0">
        <div class="p-4 border-b border-border bg-black/5 dark:bg-white/5">
          <h2 class="font-heading font-bold text-lg text-text">Live Support</h2>
        </div>
        <div id="thread-list" class="flex-1 overflow-y-auto">
          <!-- loader -->
          <div class="p-4"><div class="skeleton h-12 w-full rounded-lg mb-2"></div><div class="skeleton h-12 w-full rounded-lg"></div></div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="flex-1 flex flex-col bg-bg h-2/3 md:h-full relative">
        <!-- Header -->
        <div class="h-16 border-b border-border bg-surface flex items-center px-6 shrink-0">
           <div class="flex items-center gap-3">
             <div class="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center relative">
               <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
               <span class="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-surface"></span>
             </div>
             <div>
               <h3 class="font-bold text-sm text-text leading-tight">Customer Support</h3>
               <p class="text-xs text-muted">Usually replies in a few minutes</p>
             </div>
           </div>
        </div>
        
        <!-- Messages -->
        <div id="messages-container" class="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col scroll-smooth">
          <!-- loaded via JS -->
        </div>

        <!-- Input Area -->
        <div class="p-4 bg-surface border-t border-border shrink-0">
           <div class="bg-bg border border-border rounded-xl flex items-end p-2 transition-colors focus-within:border-primary">
             <textarea id="chat-input" rows="1" class="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none px-3 py-2 text-sm text-text max-h-32" placeholder="Write a message..."></textarea>
             <button id="send-msg-btn" class="w-10 h-10 bg-primary hover:bg-primary-hover text-white rounded-lg flex items-center justify-center shrink-0 transition-transform active:scale-95 ml-2">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
             </button>
           </div>
        </div>
      </div>

    </div>
  `;
}
