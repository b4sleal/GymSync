const userId = Number(localStorage.getItem("gymsync_user_id"));

const followersListEl = document.getElementById("followers-list");
const followersStatusEl = document.getElementById("followers-status");
const searchInputEl = document.getElementById("user-search-input");
const searchBtnEl = document.getElementById("user-search-btn");
const searchResultsEl = document.getElementById("search-results");
const searchStatusEl = document.getElementById("search-status");

const chatTitleEl = document.getElementById("chat-title");
const chatSubtitleEl = document.getElementById("chat-subtitle");
const messageThreadEl = document.getElementById("message-thread");
const dmForm = document.getElementById("dm-form");
const dmInputEl = document.getElementById("dm-input");
const dmStatusEl = document.getElementById("dm-status");
const dmSendBtnEl = document.getElementById("dm-send-btn");

let followedUsers = [];
let selectedUser = null;
let selectedUserId = null;
let currentMessages = [];

function requireAuth() {
    if (!Number.isInteger(userId) || userId <= 0) {
        alert("Please log in first.");
        window.location.href = "landing.html";
        throw new Error("Missing user session");
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setStatus(el, text = "", isError = false) {
    el.textContent = text;
    el.classList.toggle("error", Boolean(isError));
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

async function loadFollowers() {
    setStatus(followersStatusEl, "");
    const data = await fetchJson(`/api/social/followers?user_id=${encodeURIComponent(userId)}`);
    followedUsers = Array.isArray(data.followers) ? data.followers : [];
    renderFollowers();
}

function renderFollowers() {
    if (!followedUsers.length) {
        followersListEl.innerHTML = `<div class="panel-muted">You are not following anyone yet.</div>`;
        return;
    }

    followersListEl.innerHTML = followedUsers.map((user) => `
        <div
            class="user-card clickable ${selectedUser?.user_id === user.user_id ? "active" : ""}"
            data-user-id="${user.user_id}"
            data-role="followed-user"
        >
            <div class="user-meta">
                <div class="avatar">${escapeHtml(user.avatar)}</div>
                <div class="username">${escapeHtml(user.username)}</div>
            </div>
        </div>
    `).join("");
}

async function searchUsers() {
    const q = searchInputEl.value.trim();
    setStatus(searchStatusEl, "");

    const data = await fetchJson(
        `/api/social/users?user_id=${encodeURIComponent(userId)}&q=${encodeURIComponent(q)}`
    );

    const users = Array.isArray(data.users) ? data.users : [];

    if (!users.length) {
        searchResultsEl.innerHTML = `<div class="panel-muted">No users found.</div>`;
        return;
    }

    searchResultsEl.innerHTML = users.map((user) => `
        <div class="user-card">
            <div class="user-meta">
                <div class="avatar">${escapeHtml(user.avatar)}</div>
                <div class="username">${escapeHtml(user.username)}</div>
            </div>
            <button
                type="button"
                class="${user.is_following ? "following-btn" : "follow-btn"}"                data-role="follow-toggle"
                data-user-id="${user.user_id}"
                data-following="${user.is_following ? "true" : "false"}"
            >
                ${user.is_following ? "Following" : "Follow"}
            </button>
        </div>
    `).join("");
}

async function followUser(otherUserId) {
    await fetchJson(`/api/social/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: userId,
            following_id: otherUserId,
        }),
    });
}

async function unfollowUser(otherUserId) {
    await fetchJson(`/api/social/follow?user_id=${encodeURIComponent(userId)}&following_id=${encodeURIComponent(otherUserId)}`, {
        method: "DELETE",
    });
}

async function loadConversation(otherUserId) {
    const data = await fetchJson(
        `/api/social/messages/${encodeURIComponent(otherUserId)}?user_id=${encodeURIComponent(userId)}`
    );

    selectedUser = data.other_user;
    selectedUserId = selectedUser?.user_id ?? null;
    currentMessages = Array.isArray(data.messages) ? data.messages : [];

    chatTitleEl.textContent = selectedUser.username;
    chatSubtitleEl.textContent = "Direct messages";
    dmInputEl.disabled = false;
    dmSendBtnEl.disabled = false;

    renderFollowers();
    renderMessages();
}

function renderMessages() {
    if (!selectedUser) {
        messageThreadEl.innerHTML = `<div class="panel-muted">No conversation selected.</div>`;
        return;
    }

    if (!currentMessages.length) {
        messageThreadEl.innerHTML = `<div class="panel-muted">No messages yet. Start the conversation.</div>`;
        return;
    }

    messageThreadEl.innerHTML = currentMessages.map((message) => `
        <div class="message-bubble ${message.sender_id === userId ? "mine" : "theirs"}">
            <div>${escapeHtml(message.message_text)}</div>
            <div class="message-time">${escapeHtml(formatTime(message.created_at))}</div>
        </div>
    `).join("");

    messageThreadEl.scrollTop = messageThreadEl.scrollHeight;
}

async function sendMessage(text) {
    if (!selectedUser) {
        throw new Error("Pick a user first.");
    }

    await fetchJson(`/api/social/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: userId,
            recipient_id: selectedUser.user_id,
            message: text,
        }),
    });

    await loadConversation(selectedUser.user_id);
}

document.addEventListener("click", async (event) => {
    const followedCard = event.target.closest('[data-role="followed-user"]');
    if (followedCard) {
        const otherUserId = Number(followedCard.dataset.userId);
        await loadConversation(otherUserId);
        return;
    }

    const followBtn = event.target.closest('[data-role="follow-toggle"]');
    if (followBtn) {
        const otherUserId = Number(followBtn.dataset.userId);
        const isFollowing = followBtn.dataset.following === "true";

        try {
            if (isFollowing) {
                await unfollowUser(otherUserId);

                if (selectedUserId === otherUserId) {
                    selectedUserId = null;
                    selectedUser = null;

                    chatTitleEl.textContent = "Chat";
                    chatSubtitleEl.textContent = "Pick a user from the left or search on the right.";
                    messageThreadEl.innerHTML = `<div class="panel-muted">No conversation selected.</div>`;

                    dmInputEl.value = "";
                    dmInputEl.disabled = true;
                    dmSendBtnEl.disabled = true;
                    dmStatusEl.textContent = "";
                }
            } else {
                await followUser(otherUserId);
            }

            await Promise.all([loadFollowers(), searchUsers()]);
        } catch (error) {
            setStatus(searchStatusEl, error.message || "Could not update follow state.", true);
        }
    }
});

searchBtnEl.addEventListener("click", () => {
    searchUsers().catch((error) => {
        setStatus(searchStatusEl, error.message || "Search failed.", true);
    });
});

searchInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        searchBtnEl.click();
    }
});

dmForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = dmInputEl.value.trim();
    if (!text) return;

    setStatus(dmStatusEl, "");

    try {
        await sendMessage(text);
        dmInputEl.value = "";
    } catch (error) {
        setStatus(dmStatusEl, error.message || "Could not send message.", true);
    }
});

requireAuth();
Promise.all([loadFollowers(), searchUsers()]).catch((error) => {
    console.error(error);
});