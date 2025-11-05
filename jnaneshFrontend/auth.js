// 🌐 Full API endpoint
const API_AUTH_URL = 'http://127.0.0.1:5000/api/check-auth';

// 🚀 Immediately check auth status and redirect if needed
(async () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isLoginPage = currentPage === 'login.html';

  console.log(`[auth.js] Checking auth for page: ${currentPage}`);

  // 🔒 Page access definitions
  const adminPages = ['index.html', 'payroll.html', 'reports.html', 'attendance.html', 'salary.html'];
  const employeePages = ['my_dashboard.html'];
  const sharedPages = ['slip.html'];

  try {
    const response = await fetch(API_AUTH_URL, { credentials: 'include' });

    if (!response.ok) {
      console.warn(`[auth.js] Server responded with ${response.status}.`);
      if (!isLoginPage) {
        console.log('[auth.js] Redirecting to login due to failed response.');
        window.location.href = 'login.html';
      }
      return;
    }

    const data = await response.json();
    console.log('[auth.js] Auth response:', data);

    if (!data.logged_in) {
      console.log('[auth.js] User not logged in.');
      if (!isLoginPage) {
        window.location.href = 'login.html';
      }
      return;
    }

    // ✅ User is logged in
    const { role, username } = data;
    const isAdmin = role === 'admin';
    const isEmployee = role === 'employee';

    if (!isAdmin && !isEmployee) {
      console.warn(`[auth.js] Unknown role "${role}". Redirecting to login.`);
      window.location.href = 'login.html';
      return;
    }

    // 🧭 Redirect logic
    if (isLoginPage) {
      console.log('[auth.js] Logged in user on login page. Redirecting...');
      window.location.href = isAdmin ? 'index.html' : 'my_dashboard.html';
      return;
    }

    if (isAdmin && employeePages.includes(currentPage)) {
      console.log('[auth.js] Admin on employee page. Redirecting to index.');
      window.location.href = 'index.html';
      return;
    }

    if (isEmployee && adminPages.includes(currentPage)) {
      console.log('[auth.js] Employee on admin page. Redirecting to dashboard.');
      window.location.href = 'my_dashboard.html';
      return;
    }

    // 🎯 Correct page — update UI
    console.log('[auth.js] User is on correct page.');
    document.addEventListener('DOMContentLoaded', () => {
      const usernameDisplay = document.getElementById('username-display');
      if (usernameDisplay) {
        usernameDisplay.textContent = username;
        console.log('[auth.js] Username displayed.');
      } else {
        console.log('[auth.js] No username display element found.');
      }
    });

  } catch (error) {
    console.error('[auth.js] Fetch failed:', error);
    if (!isLoginPage) {
      console.log('[auth.js] Redirecting to login due to fetch error.');
      window.location.href = 'login.html';
    }
  }
})();
