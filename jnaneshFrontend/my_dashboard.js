// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Employee Dashboard (my_dashboard.html) ---
function runPageLogic() {
    console.log("my_dashboard.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    // Profile Elements
    const employeeNameEl = document.getElementById('employee-name');
    const employeeIdEl = document.getElementById('employee-id');
    const departmentEl = document.getElementById('employee-department');
    const positionEl = document.getElementById('employee-position');
    
    // === FIX: Use correct IDs from new my_dashboard.html ===
    const joiningDateEl = document.getElementById('employee-joining'); 
    const baseSalaryEl = document.getElementById('employee-salary');
    // === END FIX ===

    // History Table Bodies
    const salaryHistoryBody = document.getElementById('salary-history-body');
    const attendanceHistoryBody = document.getElementById('attendance-history-body');

    // Logout Button
    const logoutButton = document.getElementById('logout-button');
    const usernameDisplay = document.getElementById('username-display');

    // Leave Request Elements
    const leaveRequestForm = document.getElementById('leave-request-form');
    const leaveFormMessage = document.getElementById('leave-form-message');
    const leaveHistoryBody = document.getElementById('leave-history-body');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // --- HELPER: Set Username ---
    async function setUsername() {
        if (!usernameDisplay) {
            console.warn("my_dashboard.js: Username display element not found in header.");
            return;
        }
         // auth.js sets the username, but if it's still '...' try fetching.
        if (usernameDisplay.textContent === '...') {
            try {
                const response = await fetch(`${API_BASE_URL}/check-auth`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    if (data.logged_in && data.username) {
                        usernameDisplay.textContent = data.username;
                        console.log("my_dashboard.js: Username set in header:", data.username);
                    } else {
                         usernameDisplay.textContent = 'User'; // Fallback
                    }
                } else {
                     usernameDisplay.textContent = 'Error'; // Indicate auth check failed
                }
            } catch (error) {
                console.error("my_dashboard.js: Error fetching username for header:", error);
                usernameDisplay.textContent = 'Error';
            }
        }
    }


    // --- HELPER FUNCTIONS ---
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : 'N/A';
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString.split(' ')[0].replace(/-/g, '/')); // Handle YYYY-MM-DD
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); // DD/MM/YYYY
        } catch (e) { return 'N/A'; }
    };
     const formatMonthYear = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Robust parsing for 'YYYY-MM-DD'
            const parts = dateString.split('-');
            if (parts.length < 2) return 'Invalid Date';
            const date = new Date(parts[0], parts[1] - 1, 1); // Use 1st day

            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Invalid Date';
        }
    };

    // --- NEW: Helper for status badge ---
    const getStatusBadge = (status) => {
        status = (status || 'pending').toLowerCase();
        if (status === 'approved') {
            return `<span class="px-2 py-0.5 text-xs font-semibold text-green-800 bg-green-100 rounded-full">${status}</span>`;
        } else if (status === 'denied') {
            return `<span class="px-2 py-0.5 text-xs font-semibold text-red-800 bg-red-100 rounded-full">${status}</span>`;
        } else {
            return `<span class"px-2 py-0.5 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">${status}</span>`;
        }
    };


    // --- DATA FETCHING & RENDERING ---

    // Fetch Employee Profile Data
    async function fetchMyProfile() {
        console.log("my_dashboard.js: fetchMyProfile() called."); // Add log
        
        // --- FIX: Check for the corrected IDs ---
        if (!employeeNameEl || !employeeIdEl || !departmentEl || !positionEl || !joiningDateEl || !baseSalaryEl) {
             console.error("my_dashboard.js: One or more profile elements are missing!");
             if (employeeNameEl) employeeNameEl.innerHTML = `<span class="text-red-500">Page Error: Profile elements missing.</span>`;
             return;
        }
        // --- END FIX ---

        try {
            const response = await fetch(`${API_BASE_URL}/my-profile`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) {
                    console.error("fetchMyProfile: Unauthorized (401).");
                    return;
                }
                 let errorMsg = `Failed to fetch profile (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore if response isn't JSON */ }
                 throw new Error(errorMsg);
            }
            const profile = await response.json();
            console.log("my_dashboard.js: Profile data received:", profile); // Add log

            // Populate profile section
            employeeNameEl.textContent = profile.name ?? 'N/A';
            employeeIdEl.textContent = profile.employee_id ?? 'N/A';
            departmentEl.textContent = profile.department ?? 'N/A';
            positionEl.textContent = profile.position ?? 'N/A';
            joiningDateEl.textContent = formatDate(profile.joining_date); // Use corrected ID
            baseSalaryEl.textContent = formatCurrency(profile.base_salary); // Use corrected ID

        } catch (error) {
            console.error('Error fetching profile data:', error);
             employeeNameEl.innerHTML = `<span class="text-red-500">${error.message}</span>`;
             employeeIdEl.textContent = 'N/A';
             departmentEl.textContent = 'N/A';
             positionEl.textContent = 'N/A';
             joiningDateEl.textContent = 'N/A';
             baseSalaryEl.textContent = 'N/A';
        }
    }

    // Fetch Salary History
    async function fetchMySalaries() {
        console.log("my_dashboard.js: fetchMySalaries() called.");
        if (!salaryHistoryBody) {
            console.error("Salary history table body not found!");
            return;
        }
        salaryHistoryBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">Loading salary history...</td></tr>`;
        try {
            const response = await fetch(`${API_BASE_URL}/my-salaries`, { credentials: 'include' });
            if (!response.ok) {
                if(response.status === 401) return;
                 let errorMsg = `Failed to fetch salaries (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const salaries = await response.json();
            console.log("my_dashboard.js: Salaries data received:", salaries);

            salaryHistoryBody.innerHTML = ''; // Clear existing rows
            if (!salaries || salaries.length === 0) {
                salaryHistoryBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">No salary records found.</td></tr>`;
            } else {
                salaries.forEach(salary => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${formatMonthYear(salary.month)}</td>
                        <td class="py-2 px-4 border-b text-right font-semibold">${formatCurrency(salary.total_salary)}</td>
                        <td class="py-2 px-4 border-b text-center">
                            <a href="slip.html?salary_id=${salary.salary_id}" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded">
                                View Slip
                            </a>
                        </td>
                    `;
                    salaryHistoryBody.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error fetching salary history:', error);
            salaryHistoryBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">Error loading salary history.</td></tr>`;
        }
    }

    // Fetch Attendance History
    async function fetchMyAttendance() {
         console.log("my_dashboard.js: fetchMyAttendance() called.");
         if (!attendanceHistoryBody) {
             console.error("Attendance history table body not found!");
             return;
         }
         attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Loading attendance history...</td></tr>`;
        try {
            const response = await fetch(`${API_BASE_URL}/my-attendance`, { credentials: 'include' });
             if (!response.ok) {
                if(response.status === 401) return;
                 let errorMsg = `Failed to fetch attendance (${response.status})`;
                  try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const attendance = await response.json();
            console.log("my_dashboard.js: Attendance data received:", attendance);

            attendanceHistoryBody.innerHTML = ''; // Clear existing rows
            if (!attendance || attendance.length === 0) {
                attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No attendance records found.</td></tr>`;
            } else {
                attendance.forEach(record => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${formatMonthYear(record.month)}</td>
                        <td class="py-2 px-4 border-b text-center">${record.days_present ?? 0}</td>
                        <td class="py-2 px-4 border-b text-center">${record.leaves_taken ?? 0}</td>
                        <td class="py-2 px-4 border-b text-right">${(record.overtime_hours ?? 0).toFixed(1)}</td>
                    `;
                    attendanceHistoryBody.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error fetching attendance history:', error);
            attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading attendance history.</td></tr>`;
        }
    }

    // --- Fetch Leave Request History ---
    async function fetchMyLeaveRequests() {
        console.log("my_dashboard.js: fetchMyLeaveRequests() called.");
        if (!leaveHistoryBody) {
            console.error("Leave history table body not found!");
            return;
        }
        leaveHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-gray-500">Loading...</td></tr>`;
        try {
            const response = await fetch(`${API_BASE_URL}/my-leave-requests`, { credentials: 'include' });
            if (!response.ok) {
                if(response.status === 404) {
                     const errorData = await response.json();
                     throw new Error(errorData.error || 'Profile not found.');
                }
                throw new Error(`Failed to fetch leave history (${response.status})`);
            }
            const requests = await response.json();
            console.log("my_dashboard.js: Leave requests received:", requests);

            leaveHistoryBody.innerHTML = ''; // Clear loading
            if (!requests || requests.length === 0) {
                leaveHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-gray-500">No requests found.</td></tr>`;
            } else {
                requests.forEach(req => {
                    const row = document.createElement('tr');
                    const dates = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;
                    row.innerHTML = `
                        <td class="py-2 px-3 border-b">${dates}</td>
                        <td class="py-2 px-3 border-b">${getStatusBadge(req.status)}</td>
                    `;
                    leaveHistoryBody.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error fetching leave history:', error);
            leaveHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-red-500">${error.message}</td></tr>`;
            if (leaveRequestForm && error.message.includes('No employee profile')) {
                leaveRequestForm.innerHTML = `<p class="text-red-500 text-sm">Cannot submit requests: ${error.message}</p>`;
            }
        }
    }


    // --- EVENT LISTENERS ---

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("my_dashboard.js: Logout button clicked.");
             logoutButton.textContent = 'Logging out...';
             logoutButton.disabled = true;
            try {
                 await fetch(`${API_BASE_URL}/logout`, { method: 'POST', credentials: 'include' });
                 window.location.href = 'login.html';
            } catch (logoutError) {
                 console.error("Logout failed:", logoutError);
                 alert("Logout failed. Please try again or close the tab.");
                 logoutButton.textContent = 'Logout';
                 logoutButton.disabled = false;
            }
        });
    } else {
         console.warn("my_dashboard.js: Logout button not found.");
    }

    // --- Leave Request Form Submission ---
    if (leaveRequestForm) {
        leaveRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("my_dashboard.js: Submitting leave request.");
            if (!leaveFormMessage) return;

            const formData = new FormData(leaveRequestForm);
            const requestData = Object.fromEntries(formData.entries());

            if (requestData.end_date < requestData.start_date) {
                leaveFormMessage.textContent = 'End date cannot be before start date.';
                leaveFormMessage.className = 'mt-2 text-center text-sm text-red-600';
                return;
            }

            const startMonth = requestData.start_date.substring(0, 7);
            const endMonth = requestData.end_date.substring(0, 7);
            if (startMonth !== endMonth) {
                 leaveFormMessage.textContent = 'Leave requests must be within the same month.';
                 leaveFormMessage.className = 'mt-2 text-center text-sm text-red-600';
                 return;
            }

            leaveFormMessage.textContent = 'Submitting...';
            leaveFormMessage.className = 'mt-2 text-center text-sm text-gray-600';

            try {
                const response = await fetch(`${API_BASE_URL}/my-leave-requests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData),
                    credentials: 'include'
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to submit request.');
                }

                leaveFormMessage.textContent = 'Request submitted!';
                leaveFormMessage.className = 'mt-2 text-center text-sm text-green-600';
                leaveRequestForm.reset();
                fetchMyLeaveRequests(); // Refresh history

            } catch (error) {
                 console.error("Leave request error:", error);
                 leaveFormMessage.textContent = `Error: ${error.message}`;
                 leaveFormMessage.className = 'mt-2 text-center text-sm text-red-600';
            }
        });
    } else {
         console.warn("my_dashboard.js: Leave request form not found.");
    }


    // --- INITIAL DATA LOAD ---
    console.log("my_dashboard.js: Calling initial fetch functions inside runPageLogic.");
    setUsername(); // Set the username in the header first
    fetchMyProfile();
    fetchMySalaries();
    fetchMyAttendance();
    fetchMyLeaveRequests();

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);