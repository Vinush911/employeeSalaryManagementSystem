// --- THIS IS THE CORRECTED SCRIPT ---
// Use the full, absolute URL for the API
const API_AUTH_URL = 'http://127.0.0.1:5000/api/check-auth';

// This script runs *before* other deferred scripts.
// It checks login status AND role, redirecting immediately if needed.
(async () => {
    // Get current page filename BEFORE making the async call
    const currentPage = window.location.pathname.split('/').pop() || 'index.html'; // Default to index if path is '/'
    const isLoginPage = currentPage === 'login.html';

    console.log(`auth.js: Running check on page: ${currentPage}`);

    try {
        const response = await fetch(API_AUTH_URL, {
            credentials: 'include' // This sends the session cookie
        });

        // --- Handle Fetch Errors ---
        if (!response.ok) {
            console.log(`auth.js: Response not OK (${response.status}). Is user on login page? ${isLoginPage}`);
            // If server sends error (401, 500) and we are NOT on login page, redirect
            if (!isLoginPage) {
                console.log('auth.js: Redirecting to login.html due to fetch error.');
                window.location.href = 'login.html';
            }
            // If already on login page, do nothing and let login page load
            return; // Stop execution
        }

        // --- Handle Success Response ---
        const data = await response.json();
        console.log('auth.js: Received auth data:', data);

        if (!data.logged_in) {
            console.log(`auth.js: User not logged in. Is user on login page? ${isLoginPage}`);
            // If not logged in and NOT on login page, redirect
            if (!isLoginPage) {
                console.log('auth.js: Redirecting to login.html because user is not logged in.');
                window.location.href = 'login.html';
            }
            // If already on login page, do nothing
            return; // Stop execution
        }

        // --- User IS Logged In ---
        console.log(`auth.js: User logged in with role: ${data.role}`);
        const userRole = data.role;
        const isAdmin = userRole === 'admin';
        const isEmployee = userRole === 'employee';

        const isAdminPage = ['index.html', 'payroll.html', 'reports.html', 'attendance.html', 'salary.html'].includes(currentPage);
        const isEmployeePage = currentPage === 'my_dashboard.html';
        const isSlipPage = currentPage === 'slip.html'; // Slips are accessible to both

        // --- Redirection Logic ---
        // 1. If user is on the login page but IS logged in: Redirect to correct dashboard
        if (isLoginPage) {
            console.log('auth.js: User is logged in but on login page. Redirecting...');
            if (isAdmin) {
                window.location.href = 'index.html';
            } else { // Must be employee
                window.location.href = 'my_dashboard.html';
            }
            return; // Stop execution
        }

        // 2. If Admin is on an Employee-only page: Redirect to admin index
        if (isAdmin && isEmployeePage) {
            console.log('auth.js: Admin detected on employee page. Redirecting to index.html.');
            window.location.href = 'index.html';
            return; // Stop execution
        }

        // 3. If Employee is on an Admin-only page: Redirect to employee dashboard
        if (isEmployee && isAdminPage) {
            console.log('auth.js: Employee detected on admin page. Redirecting to my_dashboard.html.');
            window.location.href = 'my_dashboard.html';
            return; // Stop execution
        }

        // --- If NO Redirect Occurred: User is on the correct page ---
        console.log('auth.js: User is on the correct page. Proceeding to load content.');
        // Set username display using DOMContentLoaded to ensure element exists
        document.addEventListener('DOMContentLoaded', () => {
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) {
                console.log('auth.js: Setting username display.');
                usernameDisplay.textContent = data.username;
            } else {
                 console.log('auth.js: Username display element not found on this page.');
            }
        });


    } catch (error) {
        // --- Handle Fetch Failure ---
        console.error('auth.js: Auth check fetch failed:', error);
        if (!isLoginPage) {
            console.log('auth.js: Redirecting to login.html due to fetch failure.');
            window.location.href = 'login.html'; // Redirect to login as safety measure
        }
    }
})(); // Immediately invoke the async function

