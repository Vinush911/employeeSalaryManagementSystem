// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Leave Admin page (leave_admin.html) ---
function runPageLogic() {
    console.log("leave_admin.js: runPageLogic() started.");

    // --- ELEMENT SELECTORS ---
    const leaveTableBody = document.getElementById('leave-table-body');
    const tableMessage = document.getElementById('table-message');
    const filterButtonContainer = document.getElementById('filter-buttons');
    const logoutButton = document.getElementById('logout-button');
    const usernameDisplay = document.getElementById('username-display'); // Selector for username
    const notificationToast = document.getElementById('notification-toast');
    const notificationMessage = document.getElementById('notification-message');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let currentFilter = 'pending'; // Default to pending

    // --- HELPER FUNCTIONS ---
    // --- FIX: Added setUsername function (similar to other pages) ---
    async function setUsername() {
        if (!usernameDisplay) {
             console.warn("leave_admin.js: Username display element not found.");
             return;
        }
        try {
            // Fetch auth details again to get username reliably
            const response = await fetch(`${API_BASE_URL}/check-auth`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.logged_in && data.username) {
                    usernameDisplay.textContent = data.username;
                     console.log("leave_admin.js: Username set:", data.username);
                } else {
                     usernameDisplay.textContent = 'Admin'; // Fallback
                }
            } else {
                 usernameDisplay.textContent = 'Error';
            }
        } catch (error) {
            console.error("leave_admin.js: Error fetching username:", error);
            usernameDisplay.textContent = 'Error';
        }
    }
    // --- END FIX ---

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Robust parsing for 'YYYY-MM-DD'
            const parts = dateString.split('-');
             if (parts.length !== 3) return 'N/A';
             const date = new Date(parts[0], parts[1] - 1, parts[2]); // Month is 0-indexed
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return 'N/A'; }
    };

    const getStatusBadge = (status) => {
        status = (status || 'pending').toLowerCase();
        if (status === 'approved') {
            return `<span class="px-2 py-0.5 text-xs font-semibold text-green-800 bg-green-100 rounded-full">${status}</span>`;
        } else if (status === 'denied') {
            return `<span class="px-2 py-0.5 text-xs font-semibold text-red-800 bg-red-100 rounded-full">${status}</span>`;
        } else {
            return `<span class="px-2 py-0.5 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">${status}</span>`;
        }
    };

    const showNotification = (message, isError = false) => {
        if (!notificationToast || !notificationMessage) {
            alert(message); // Fallback
            return;
        }
        notificationMessage.textContent = message;
        notificationToast.classList.remove('hidden', 'bg-red-500', 'bg-green-500');
        notificationToast.classList.add(isError ? 'bg-red-500' : 'bg-green-500');
        notificationToast.style.opacity = 1;
        setTimeout(() => {
            notificationToast.style.opacity = 0;
            setTimeout(() => notificationToast.classList.add('hidden'), 500);
        }, 3000);
    };


    // --- DATA FETCHING & RENDERING ---
    async function fetchLeaveRequests(status = 'pending') {
        console.log(`Fetching leave requests with status: ${status}`);
        if (!leaveTableBody || !tableMessage) {
            console.error("leave_admin.js: Table body or message element not found.");
            return;
        }

        leaveTableBody.innerHTML = ''; // Clear previous results
        tableMessage.textContent = 'Loading requests...';
        tableMessage.className = 'text-center py-4 text-gray-500'; // Reset message style

        try {
            const response = await fetch(`${API_BASE_URL}/leave-requests?status=${status}`, { credentials: 'include' });
            if (!response.ok) {
                 if (response.status === 401 || response.status === 403){
                     console.error("leave_admin.js: Unauthorized fetch."); // Should be caught by auth.js but log anyway
                     // window.location.href = 'login.html'; // Optional redirect
                     return;
                 }
                 // Try to get error message from backend
                 let errorMsg = `Failed to fetch requests (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore if not JSON */ }
                 throw new Error(errorMsg);
            }
            const requests = await response.json();
            console.log("leave_admin.js: Leave requests received:", requests);

            if (!requests || requests.length === 0) {
                tableMessage.textContent = 'No requests found for this filter.';
            } else {
                tableMessage.textContent = ''; // Clear loading/error message
                renderLeaveTable(requests);
            }
        } catch (error) {
            console.error('leave_admin.js: Error fetching leave requests:', error);
            tableMessage.textContent = `Error loading requests: ${error.message}`;
            tableMessage.className = 'text-center py-4 text-red-500'; // Style as error
        }
    }

    function renderLeaveTable(requests) {
        if (!leaveTableBody) return;
        leaveTableBody.innerHTML = ''; // Clear previous content
        requests.forEach(req => {
            const row = document.createElement('tr');
            const dates = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;

            let actionButtons = '';
            // Only show buttons if the status is 'pending'
            if (req.status && req.status.toLowerCase() === 'pending') {
                actionButtons = `
                    <button data-action="approved" data-id="${req.request_id}" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-2 rounded transition-colors duration-200">Approve</button>
                    <button data-action="denied" data-id="${req.request_id}" class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded transition-colors duration-200">Deny</button>
                `;
            } else {
                 actionButtons = '-'; // Show dash if already actioned
            }

            row.innerHTML = `
                <td class="py-2 px-4 border-b">${req.employee_name || 'N/A'} (ID: ${req.employee_id})</td>
                <td class="py-2 px-4 border-b">${dates}</td>
                <td class="py-2 px-4 border-b">${req.reason || 'N/A'}</td>
                <td class="py-2 px-4 border-b">${getStatusBadge(req.status)}</td>
                <td class="py-2 px-4 border-b text-center space-x-1">${actionButtons}</td>
            `;
            leaveTableBody.appendChild(row);
        });
    }

    // --- EVENT LISTENERS ---

    // Filter Button Clicks
    if (filterButtonContainer) {
        filterButtonContainer.addEventListener('click', (e) => {
            const button = e.target.closest('button.filter-btn');
            if (!button) return;

             console.log("leave_admin.js: Filter button clicked:", button.dataset.status);

            // Update active state visuals
            filterButtonContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700');
            });
            button.classList.add('bg-blue-600', 'text-white');
            button.classList.remove('bg-gray-200', 'text-gray-700');

            currentFilter = button.dataset.status;
            fetchLeaveRequests(currentFilter); // Fetch data for the new filter
        });
    } else {
        console.error("leave_admin.js: Filter button container not found.");
    }

    // Approve/Deny Button Clicks (Event Delegation on Table Body)
    if (leaveTableBody) {
        leaveTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return; // Exit if click wasn't on an action button

            const action = button.dataset.action; // 'approved' or 'denied'
            const id = button.dataset.id;
            console.log(`leave_admin.js: Action "${action}" clicked for request ID ${id}`);


            button.textContent = '...';
            button.disabled = true;
            // Optionally disable the other button too
            const otherAction = action === 'approved' ? 'denied' : 'approved';
            const otherButton = button.parentElement.querySelector(`button[data-action="${otherAction}"]`);
            if (otherButton) otherButton.disabled = true;


            try {
                const response = await fetch(`${API_BASE_URL}/leave-requests/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: action }), // Send 'approved' or 'denied'
                    credentials: 'include'
                });

                 // Try parsing JSON even for errors
                 let data;
                 try {
                     data = await response.json();
                     console.log("leave_admin.js: Update response:", data);
                 } catch (jsonError) {
                      throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }


                if (!response.ok) {
                    throw new Error(data.error || `Failed to ${action} request.`);
                }

                showNotification(`Request ${action}. Attendance table updated if approved.`);
                fetchLeaveRequests(currentFilter); // Refresh the list with the current filter

            } catch (error) {
                console.error(`leave_admin.js: Error ${action}ing request:`, error);
                showNotification(`Error: ${error.message}`, true);
                // Restore button states on error
                button.textContent = action.charAt(0).toUpperCase() + action.slice(1);
                button.disabled = false;
                 if (otherButton) otherButton.disabled = false;
            }
        });
    } else {
        console.error("leave_admin.js: Leave table body not found for event delegation.");
    }

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("leave_admin.js: Logout clicked.");
             logoutButton.textContent = 'Logging out...';
             logoutButton.disabled = true;
            try {
                 await fetch(`${API_BASE_URL}/logout`, { method: 'POST', credentials: 'include' });
                 window.location.href = 'login.html';
            } catch (logoutError) {
                 console.error("Logout failed:", logoutError);
                 alert("Logout failed. Please try again.");
                 logoutButton.textContent = 'Logout';
                 logoutButton.disabled = false;
            }
        });
    } else {
         console.warn("leave_admin.js: Logout button not found.");
    }

    // --- INITIAL DATA LOAD ---
    console.log("leave_admin.js: Setting username and fetching initial data.");
    setUsername(); // --- FIX: Call setUsername ---
    fetchLeaveRequests(currentFilter); // Load pending requests by default

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);
