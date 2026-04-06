document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const toggleText = document.getElementById("toggle-text");
    const toggleContainer = document.querySelector(".toggle-container");

    function showError(message) {
        alert(message || "Something went wrong.");
    }

    function saveSession(data) {
        localStorage.setItem("gymsync_user_id", String(data.userId));
        if (data.username) {
            localStorage.setItem("gymsync_username", data.username);
        }
    }

    toggleContainer.addEventListener("click", (e) => {
        if (e.target.id !== "toggle-link") {
            return;
        }

        e.preventDefault();
        loginForm.classList.toggle("hidden");
        registerForm.classList.toggle("hidden");

        if (loginForm.classList.contains("hidden")) {
            toggleText.innerHTML = `Have an account? <a href="#" id="toggle-link">Log in</a>`;
        } else {
            toggleText.innerHTML = `Don't have an account? <a href="#" id="toggle-link">Sign up</a>`;
        }
    });

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("reg-username").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Registration failed.");
            }

            saveSession({
                userId: data.userId,
                username,
            });

            window.location.href = "index.html";
        } catch (error) {
            showError(error.message);
        }
    });

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const identifier = document.getElementById("login-text").value.trim();
        const password = document.getElementById("login-password").value;

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed.");
            }

            saveSession(data);
            window.location.href = "index.html";
        } catch (error) {
            showError(error.message);
        }
    });
});