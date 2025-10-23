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
    const joiningDateEl = document.getElementById('employee-joining-date');
    const baseSalaryEl = document.getElementById('employee-base-salary');

    // History Table Bodies
    const salaryHistoryBody = document.getElementById('salary-history-body');
    const attendanceHistoryBody = document.getElementById('attendance-history-body');

    // Logout Button
    const logoutButton = document.getElementById('logout-button');

    // --- FIX: Add selector for the username display in the header ---
    const usernameDisplay = document.getElementById('username-display');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // --- FIX: Function to set username ---
    async function setUsername() {
        if (!usernameDisplay) {
            console.warn("Username display element not found in header.");
            return;
        }
        try {
            // Fetch auth details again to get username reliably
            const response = await fetch(`${API_BASE_URL}/check-auth`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.logged_in && data.username) {
                    usernameDisplay.textContent = data.username;
                    console.log("Username set in header:", data.username);
                } else {
                     usernameDisplay.textContent = 'User'; // Fallback
                }
            } else {
                 usernameDisplay.textContent = 'Error'; // Indicate auth check failed
            }
        } catch (error) {
            console.error("Error fetching username for header:", error);
            usernameDisplay.textContent = 'Error';
        }
    }


    // --- HELPER FUNCTIONS ---
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : 'N/A';
    const formatDate = (dateString) => dateString ? new Date(dateString.split(' ')[0]).toLocaleDateString('en-GB') : 'N/A'; // Simple DD/MM/YYYY
     const formatMonthYear = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Add 'T00:00:00' to hint local time interpretation
            const date = new Date(dateString + 'T00:00:00');
            // Check if the date is valid before formatting
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Invalid Date';
        }
    };


    // --- DATA FETCHING & RENDERING ---

    // Fetch Employee Profile Data
    async function fetchMyProfile() {
        console.log("my_dashboard.js: fetchMyProfile() called."); // Add log
        try {
            const response = await fetch(`${API_BASE_URL}/my-profile`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) {
                    console.error("fetchMyProfile: Unauthorized (401). Should have been redirected by auth.js.");
                    // window.location.href = 'login.html'; // Fallback redirect
                    return;
                }
                 // --- FIX: Try to get error message from backend ---
                 let errorMsg = `Failed to fetch profile (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore if response isn't JSON */ }
                 throw new Error(errorMsg);
            }
            const profile = await response.json();
            console.log("my_dashboard.js: Profile data received:", profile); // Add log

            // Populate profile section (check if elements exist)
            if (employeeNameEl) employeeNameEl.textContent = profile.name ?? 'N/A';
            if (employeeIdEl) employeeIdEl.textContent = profile.employee_id ?? 'N/A';
            if (departmentEl) departmentEl.textContent = profile.department ?? 'N/A';
            if (positionEl) positionEl.textContent = profile.position ?? 'N/A';
            if (joiningDateEl) joiningDateEl.textContent = formatDate(profile.joining_date);
            if (baseSalaryEl) baseSalaryEl.textContent = formatCurrency(profile.base_salary);

        } catch (error) {
            console.error('Error fetching profile data:', error);
            // Display error in profile section
             if (employeeNameEl) employeeNameEl.textContent = 'Error loading';
             // Set other fields to loading or error state
             if (employeeIdEl) employeeIdEl.textContent = 'Loading...';
             if (departmentEl) departmentEl.textContent = 'Loading...';
             if (positionEl) positionEl.textContent = 'Loading...';
             if (joiningDateEl) joiningDateEl.textContent = 'Loading...';
             if (baseSalaryEl) baseSalaryEl.textContent = 'Loading...';
             // Optionally display the error message somewhere specific
             // e.g., create a dedicated error div for the profile section
        }
    }

    // Fetch Salary History
    async function fetchMySalaries() {
        console.log("my_dashboard.js: fetchMySalaries() called."); // Add log
        if (!salaryHistoryBody) {
            console.error("Salary history table body not found!");
            return;
        }
        // --- FIX: Add loading indicator ---
        salaryHistoryBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">Loading salary history...</td></tr>`;
        try {
            const response = await fetch(`${API_BASE_URL}/my-salaries`, { credentials: 'include' });
            if (!response.ok) {
                if(response.status === 401) return; // Handled by auth.js
                 // --- FIX: Try to get error message from backend ---
                 let errorMsg = `Failed to fetch salaries (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const salaries = await response.json();
            console.log("my_dashboard.js: Salaries data received:", salaries); // Add log

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
         console.log("my_dashboard.js: fetchMyAttendance() called."); // Add log
         if (!attendanceHistoryBody) {
             console.error("Attendance history table body not found!");
             return;
         }
         // --- FIX: Add loading indicator ---
         attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Loading attendance history...</td></tr>`;
        try {
            const response = await fetch(`${API_BASE_URL}/my-attendance`, { credentials: 'include' });
             if (!response.ok) {
                if(response.status === 401) return; // Handled by auth.js
                 // --- FIX: Try to get error message from backend ---
                 let errorMsg = `Failed to fetch attendance (${response.status})`;
                  try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const attendance = await response.json();
            console.log("my_dashboard.js: Attendance data received:", attendance); // Add log

            attendanceHistoryBody.innerHTML = ''; // Clear existing rows
            if (!attendance || attendance.length === 0) {
                attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No attendance records found.</td></tr>`;
            } else {
                attendance.forEach(record => {
                    const row = document.createElement('tr');
                    // Add null checks for safety
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

    // --- EVENT LISTENERS ---

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("my_dashboard.js: Logout button clicked."); // Add log
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
         console.warn("my_dashboard.js: Logout button not found."); // Add log
    }

    // --- INITIAL DATA LOAD ---
    console.log("my_dashboard.js: Calling initial fetch functions inside runPageLogic."); // Add log
    // --- FIX: Call setUsername at the start ---
    setUsername(); // Set the username in the header first
    fetchMyProfile();
    fetchMySalaries();
    fetchMyAttendance();

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);

