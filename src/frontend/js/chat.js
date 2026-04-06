const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const messagesEl = document.getElementById("chat-messages");
const statusEl = document.getElementById("chat-status");

const userId = Number(localStorage.getItem("userId"));
let latestMessageId = 0;

if (!Number.isInteger(userId) || userId <= 0) {
    window.location.href = "/landing.html";
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
}

function renderMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        messagesEl.innerHTML = `<div class="chat-empty">No messages yet. Start the chat.</div>`;
        latestMessageId = 0;
        return;
    }

    const wasNearBottom =
        messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

    messagesEl.innerHTML = messages.map((message) => {
        const isSelf = Number(message.user_id) === userId;

        return `
            <article class="chat-message${isSelf ? " self" : ""}">
                <div class="chat-meta">
                    <span class="chat-author">${escapeHtml(message.username)}</span>
                    <span>${escapeHtml(formatTimestamp(message.created_at))}</span>
                </div>
                <div class="chat-text">${escapeHtml(message.message_text)}</div>
            </article>
        `;
    }).join("");

    const newestMessage = messages[messages.length - 1];
    const hasNewMessage = newestMessage && newestMessage.message_id !== latestMessageId;
    latestMessageId = newestMessage ? newestMessage.message_id : 0;

    if (wasNearBottom || hasNewMessage) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
}

async function loadMessages({ silent = false } = {}) {
    try {
        const response = await fetch("/api/chat?limit=60");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load chat messages.");
        }

        renderMessages(data.messages);

        if (!silent) {
            setStatus("");
        }
    } catch (error) {
        setStatus(error.message || "Could not load chat messages.", true);
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();
    if (!message) {
        setStatus("Enter a message first.", true);
        return;
    }

    try {
        setStatus("Sending...");

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                user_id: userId,
                message,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not send the message.");
        }

        input.value = "";
        setStatus("Message sent.");
        await loadMessages({ silent: true });
    } catch (error) {
        setStatus(error.message || "Could not send the message.", true);
    }
});

loadMessages();
window.setInterval(() => loadMessages({ silent: true }), 5000);
window.addEventListener("focus", () => loadMessages({ silent: true }));
