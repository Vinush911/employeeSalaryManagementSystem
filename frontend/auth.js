// This script runs on every protected page.
// Its job is to check if the user is logged in. If not, it redirects to the login page.

const API_BASE_URL = 'http://127.0.0.1:5000/api';

async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/check-auth`, {
            credentials: 'include' // This is crucial for sending the session cookie
        });

        // If the server says we are unauthorized, it means the session is invalid or expired.
        if (response.status === 401) {
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();
        
        if (!data.logged_in) {
            window.location.href = 'login.html';
        } else {
            // If logged in, display the username in the header
            const usernameElement = document.getElementById('username-display');
            if (usernameElement) {
                usernameElement.textContent = data.username || 'user';
            }
        }
    } catch (error) {
        // If we can't even connect to the auth endpoint, redirect to login.
        console.error('Authentication check failed:', error);
        window.location.href = 'login.html';
    }
}

// Run the check as soon as the script loads.
checkLoginStatus();

