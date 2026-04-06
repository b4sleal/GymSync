document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname.toLowerCase();
    const userId = Number(localStorage.getItem("userId"));
    const isLoggedIn = Number.isInteger(userId) && userId > 0;
    const storageKey = "gymSyncHelperMessagesV2";
    const helperName = "GymSync Assistant";
    const suggestions = [
        {
            icon: "PL",
            title: "Plan my week",
            prompt: "How do I use the planner?",
        },
        {
            icon: "WK",
            title: "Build a workout",
            prompt: "How do I create a workout?",
        },
        {
            icon: "DB",
            title: "Use the dashboard",
            prompt: "What is on the dashboard?",
        },
        {
            icon: "GC",
            title: "Open group chat",
            prompt: "Where is the group chat page?",
        },
    ];

    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "chat-helper-launcher";
    launcher.innerHTML = `
        <span class="chat-helper-launcher-ring" aria-hidden="true"></span>
        <span class="chat-helper-launcher-icon-wrap" aria-hidden="true">
            <svg class="chat-helper-launcher-icon" viewBox="0 0 24 24" focusable="false">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5Z" />
            </svg>
        </span>
        <span class="chat-helper-launcher-label">Ask GymSync Assistant</span>
    `;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open GymSync Assistant");
    launcher.setAttribute("title", "Open GymSync Assistant");

    const panel = document.createElement("section");
    panel.className = "chat-helper-panel hidden";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
        <header class="chat-helper-header">
            <div class="chat-helper-brand">
                <div class="chat-helper-avatar">GS</div>
                <div>
                    <h3 class="chat-helper-title">${helperName}</h3>
                    <span class="chat-helper-subtitle">Quick help for GymSync pages and features</span>
                </div>
            </div>
            <div class="chat-helper-tools">
                <button type="button" class="chat-helper-reset" aria-label="Start a new chat">New</button>
                <button type="button" class="chat-helper-close" aria-label="Close chat helper">&times;</button>
            </div>
        </header>
        <div class="chat-helper-body">
            <div class="chat-helper-messages" aria-live="polite"></div>
            <form class="chat-helper-form">
                <div class="chat-helper-composer">
                    <textarea
                        class="chat-helper-input"
                        rows="1"
                        maxlength="500"
                        placeholder="Message GymSync Assistant..."
                    ></textarea>
                    <button type="submit" class="chat-helper-send" aria-label="Send message">
                        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                            <path d="M3 20 21 12 3 4l3.8 6.2L14 12l-7.2 1.8Z" />
                        </svg>
                    </button>
                </div>
                <div class="chat-helper-form-meta">
                    <span class="chat-helper-status"></span>
                    <span class="chat-helper-hint">Enter to send, Shift+Enter for a new line</span>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    const closeButton = panel.querySelector(".chat-helper-close");
    const resetButton = panel.querySelector(".chat-helper-reset");
    const messagesEl = panel.querySelector(".chat-helper-messages");
    const form = panel.querySelector(".chat-helper-form");
    const input = panel.querySelector(".chat-helper-input");
    const statusEl = panel.querySelector(".chat-helper-status");
    const sendButton = panel.querySelector(".chat-helper-send");

    let messages = loadStoredMessages();

    function loadStoredMessages() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                return [];
            }

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter((message) =>
                message &&
                typeof message === "object" &&
                (message.role === "assistant" || message.role === "user") &&
                typeof message.text === "string" &&
                typeof message.createdAt === "string"
            ).slice(-20);
        } catch (error) {
            return [];
        }
    }

    function saveMessages() {
        localStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    }

    function setStatus(message, isError = false) {
        statusEl.textContent = message;
        statusEl.classList.toggle("error", isError);
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

        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    function autoSizeInput() {
        input.style.height = "0px";
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    }

    function getCurrentPageLabel() {
        if (path === "/" || path.endsWith("/landing.html")) {
            return "landing";
        }

        if (path.endsWith("/planner.html")) {
            return "planner";
        }

        if (path.endsWith("/workout.html")) {
            return "workout";
        }

        if (path.endsWith("/chat.html")) {
            return "group-chat";
        }

        if (path.endsWith("/index.html")) {
            return "dashboard";
        }

        return "app";
    }

    function getPageTip() {
        const currentPage = getCurrentPageLabel();

        if (currentPage === "landing") {
            return isLoggedIn
                ? "You are already logged in. Use the nav to move back into the app."
                : "Use this page to sign up or log in with your username or email.";
        }

        if (currentPage === "planner") {
            return "Add a workout description, select days, then submit to plan your week.";
        }

        if (currentPage === "workout") {
            return "Add exercise blocks, set reps and sets, then save the routine.";
        }

        if (currentPage === "group-chat") {
            return "This page is the shared group chat. The floating assistant is just for app help.";
        }

        if (currentPage === "dashboard") {
            return "Use the side menu to move between your dashboard, planner, workout builder, and chat.";
        }

        return "Use the side menu to move through the main GymSync pages.";
    }

    function getIntroMarkup() {
        return `
            <div class="chat-helper-intro">
                <p class="chat-helper-kicker">GymSync Helper</p>
                <h4 class="chat-helper-hero-title">Hello, athlete</h4>
                <p class="chat-helper-hero-copy">
                    Ask about planning workouts, building routines, navigation, or how each page works.
                </p>
                <p class="chat-helper-page-tip">${escapeHtml(getPageTip())}</p>
            </div>
            <div class="chat-helper-suggestions">
                ${suggestions.map((suggestion) => `
                    <button
                        type="button"
                        class="chat-helper-suggestion"
                        data-prompt="${escapeHtml(suggestion.prompt)}"
                    >
                        <span class="chat-helper-suggestion-icon">${escapeHtml(suggestion.icon)}</span>
                        <span class="chat-helper-suggestion-text">
                            <strong>${escapeHtml(suggestion.title)}</strong>
                            <span>${escapeHtml(suggestion.prompt)}</span>
                        </span>
                    </button>
                `).join("")}
            </div>
            <p class="chat-helper-note">
                Need the shared feed instead? Open the full Chat page from the side menu.
            </p>
        `;
    }

    function renderMessages() {
        const wasNearBottom =
            messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;

        if (messages.length === 0) {
            messagesEl.innerHTML = getIntroMarkup();
            return;
        }

        messagesEl.innerHTML = `
            <div class="chat-helper-conversation">
                ${messages.map((message) => {
                    const isUser = message.role === "user";
                    const author = isUser ? "You" : helperName;

                    return `
                        <article class="chat-helper-message ${isUser ? "self" : "assistant"}">
                            <div class="chat-helper-meta">
                                <span class="chat-helper-author">${escapeHtml(author)}</span>
                                <span>${escapeHtml(formatTimestamp(message.createdAt))}</span>
                            </div>
                            <div class="chat-helper-text">${escapeHtml(message.text)}</div>
                        </article>
                    `;
                }).join("")}
            </div>
        `;

        if (wasNearBottom) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    function addMessage(role, text) {
        messages.push({
            role,
            text,
            createdAt: new Date().toISOString(),
        });
        messages = messages.slice(-20);
        saveMessages();
        renderMessages();
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function startNewChat() {
        messages = [];
        localStorage.removeItem(storageKey);
        renderMessages();
        setStatus("");
        input.focus();
    }

    async function sendPrompt(message) {
        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            setStatus("Write a message first.", true);
            return;
        }

        if (
            trimmedMessage.toLowerCase().includes("clear") ||
            trimmedMessage.toLowerCase().includes("reset") ||
            trimmedMessage.toLowerCase().includes("new chat")
        ) {
            startNewChat();
            addMessage("assistant", "Started a fresh helper chat.");
            return;
        }

        addMessage("user", trimmedMessage);
        input.value = "";
        autoSizeInput();
        input.disabled = true;
        sendButton.disabled = true;
        setStatus("Assistant is typing...");

        try {
            const response = await fetch("/api/assistant", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: trimmedMessage,
                    history: messages.slice(0, -1),
                    page: getCurrentPageLabel(),
                    pageTip: getPageTip(),
                    isLoggedIn,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Assistant request failed.");
            }

            addMessage("assistant", data.reply || "No response received.");
            setStatus(data.model ? `Using ${data.model}` : "");
        } catch (error) {
            setStatus(error.message || "Could not reach the assistant.", true);
        } finally {
            input.disabled = false;
            sendButton.disabled = false;
            input.focus();
        }
    }

    function openPanel() {
        panel.classList.remove("hidden");
        panel.setAttribute("aria-hidden", "false");
        launcher.setAttribute("aria-expanded", "true");
        renderMessages();
        autoSizeInput();
        window.setTimeout(() => input.focus(), 40);
    }

    function closePanel() {
        panel.classList.add("hidden");
        panel.setAttribute("aria-hidden", "true");
        launcher.setAttribute("aria-expanded", "false");
        setStatus("");
    }

    launcher.addEventListener("click", () => {
        if (panel.classList.contains("hidden")) {
            openPanel();
            return;
        }

        closePanel();
    });

    closeButton.addEventListener("click", closePanel);
    resetButton.addEventListener("click", startNewChat);

    input.addEventListener("input", autoSizeInput);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    messagesEl.addEventListener("click", (event) => {
        const suggestionButton = event.target.closest(".chat-helper-suggestion");
        if (!suggestionButton) {
            return;
        }

        const prompt = suggestionButton.dataset.prompt || "";
        void sendPrompt(prompt);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.classList.contains("hidden")) {
            closePanel();
        }
    });

    document.addEventListener("click", (event) => {
        if (panel.classList.contains("hidden")) {
            return;
        }

        if (!panel.contains(event.target) && !launcher.contains(event.target)) {
            closePanel();
        }
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        void sendPrompt(input.value);
    });

    autoSizeInput();
    renderMessages();
});
