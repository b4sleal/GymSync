document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const toggleLink = document.getElementById('toggle-link');
    const toggleText = document.getElementById('toggle-text');
    const toggleContainer = document.querySelector('.toggle-container');

    toggleContainer.addEventListener('click', (e) => {
        if (e.target.id === 'toggle-link') {
            e.preventDefault();

            loginForm.classList.toggle('hidden');
            registerForm.classList.toggle('hidden');

            if (loginForm.classList.contains('hidden')) {
                toggleText.innerHTML = `Have an account? <a href="#" id="toggle-link">Log in</a>`;
            } else {
                toggleText.innerHTML = `Don\'t have an account? <a href="#" id="toggle-link">Sign up</a>`;
            }
        }
    })

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Ensure these IDs match your HTML input tags
        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Save user ID to session so we can load their specific workouts later
                localStorage.setItem('userId', data.userId);
                window.location.href = '/index.html';
            } else {
                // This will show "Username or Email already in use" from your controller
                alert(data.message);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Could not connect to server. Check if Docker is running!');
        }
    });

    // --- 3. LOGIN SUBMIT ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Changed ID from 'login-email' to 'login-identifier' to be more accurate
        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password }) // Send identifier
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('userId', data.userId);
                window.location.href = '/index.html';
            } else {
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Server connection failed.');
        }
    });
});