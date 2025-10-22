document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const messageDiv = document.getElementById('message');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // --- Tab Switching Logic ---
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('border-blue-500', 'text-blue-600');
        loginTab.classList.remove('border-transparent', 'text-gray-500');
        registerTab.classList.add('border-transparent', 'text-gray-500');
        registerTab.classList.remove('border-blue-500', 'text-blue-600');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });

    registerTab.addEventListener('click', () => {
        registerTab.classList.add('border-blue-500', 'text-blue-600');
        registerTab.classList.remove('border-transparent', 'text-gray-500');
        loginTab.classList.add('border-transparent', 'text-gray-500');
        loginTab.classList.remove('border-blue-500', 'text-blue-600');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    // --- Login Form Submission ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        messageDiv.textContent = '';

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                window.location.href = 'index.html'; // Redirect on success
            } else {
                messageDiv.textContent = data.error || 'Login failed.';
                messageDiv.classList.remove('text-green-600');
                messageDiv.classList.add('text-red-600');
            }
        } catch (error) {
            console.error('Login error:', error);
            messageDiv.textContent = 'An error occurred. Please try again.';
            messageDiv.classList.add('text-red-600');
        }
    });

    // --- Register Form Submission ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.reg_username.value;
        const password = e.target.reg_password.value;
        messageDiv.textContent = '';

        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            const data = await response.json();
            if (response.ok) {
                messageDiv.textContent = 'Registration successful! Please log in.';
                messageDiv.classList.remove('text-red-600');
                messageDiv.classList.add('text-green-600');
                loginTab.click(); // Switch to login tab
            } else {
                messageDiv.textContent = data.error || 'Registration failed.';
                messageDiv.classList.remove('text-green-600');
                messageDiv.classList.add('text-red-600');
            }
        } catch (error) {
            console.error('Registration error:', error);
            messageDiv.textContent = 'An error occurred. Please try again.';
            messageDiv.classList.add('text-red-600');
        }
    });
});

