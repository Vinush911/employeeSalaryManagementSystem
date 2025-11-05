// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Attendance page (attendance.html) ---
function runPageLogic() {
    console.log("attendance.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    const employeeNameHeader = document.getElementById('employee-name-header');
    const attendanceHistoryBody = document.getElementById('attendance-history-body');
    const addAttendanceForm = document.getElementById('add-attendance-form');
    const attendanceFormMessage = document.getElementById('attendance-form-message');
    const logoutButton = document.getElementById('logout-button');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // Get employee ID from the URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const employeeId = urlParams.get('employee_id');

    if (!employeeId) {
        console.error("attendance.js: No employee_id found in URL. Redirecting."); // Add log
        // Redirect if employee_id is missing
        window.location.href = 'index.html';
        return; // Stop further execution
    }
     console.log(`attendance.js: Managing attendance for employee_id: ${employeeId}`); // Add log


    // --- HELPER FUNCTIONS ---
    // Updated formatMonthYear to handle potential errors
    const formatMonthYear = (dateString) => {
        if (!dateString) return 'Invalid Date';
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
    async function fetchEmployeeDetails() {
         console.log("attendance.js: fetchEmployeeDetails() called."); // Add log
         if (!employeeNameHeader) {
            console.error("Employee name header element not found!");
            return;
         }
         employeeNameHeader.textContent = 'Loading employee details...'; // Set loading state
        try {
            const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) {
                    console.error("fetchEmployeeDetails: Unauthorized (401). Should have been redirected by auth.js.");
                    // window.location.href = 'login.html'; // Fallback redirect
                    return; // Stop execution
                }
                 // Try to get error message from backend
                let errorMsg = `Failed to fetch employee details (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) { /* Ignore if response isn't JSON */ }
                throw new Error(errorMsg);
            }
            const employee = await response.json();
             console.log("attendance.js: Employee details received:", employee); // Add log
            employeeNameHeader.textContent = `Attendance for ${employee.name ?? 'Unknown Employee'}`;
        } catch (error) {
            console.error('Error fetching employee details:', error);
            employeeNameHeader.textContent = 'Error loading employee data';
        }
    }

    async function fetchAttendanceHistory() {
        console.log("attendance.js: fetchAttendanceHistory() called."); // Add log
        if (!attendanceHistoryBody) {
             console.error("Attendance history table body not found!");
             return;
        }
        attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Loading attendance history...</td></tr>`; // Show loading state

        try {
            const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/attendance`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) return; // Handled by auth.js
                 // Try to get error message from backend
                let errorMsg = `Failed to fetch attendance history (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) { /* Ignore if response isn't JSON */ }
                throw new Error(errorMsg);
            }
            const attendance = await response.json();
            console.log("attendance.js: Attendance history received:", attendance); // Add log

            attendanceHistoryBody.innerHTML = ''; // Clear loading message
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
            attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Failed to load attendance history.</td></tr>`;
        }
    }

    // --- EVENT LISTENERS ---
    if (addAttendanceForm) {
        addAttendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
             console.log("attendance.js: Add attendance form submitted."); // Add log

            // Ensure message element exists
            if (!attendanceFormMessage) {
                console.error("Attendance form message element not found!");
                return;
            }

            const formData = new FormData(addAttendanceForm);
            const attendanceData = {
                employee_id: employeeId,
                month: formData.get('month') + '-01', // Append day for backend
                days_present: formData.get('days_present'),
                leaves_taken: formData.get('leaves_taken'),
                overtime_hours: formData.get('overtime_hours')
            };
            console.log("attendance.js: Sending attendance data:", attendanceData); // Add log


            attendanceFormMessage.textContent = 'Adding record...'; // Indicate processing
            attendanceFormMessage.classList.remove('text-red-600', 'text-green-600');
            attendanceFormMessage.classList.add('text-gray-600'); // Use neutral color for processing

            try {
                const response = await fetch(`${API_BASE_URL}/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(attendanceData),
                    credentials: 'include'
                });

                 // Try parsing JSON even for errors
                 let data;
                 try {
                     data = await response.json();
                     console.log("attendance.js: Add attendance response data:", data); // Add log
                 } catch (jsonError) {
                     console.error("attendance.js: Failed to parse JSON response:", jsonError);
                     throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }


                if (!response.ok) {
                    throw new Error(data.error || `Failed to add attendance (Status: ${response.status})`);
                }

                attendanceFormMessage.textContent = 'Record added successfully!';
                attendanceFormMessage.classList.remove('text-red-600', 'text-gray-600');
                attendanceFormMessage.classList.add('text-green-600');
                addAttendanceForm.reset(); // Clear form on success
                fetchAttendanceHistory(); // Refresh the list

            } catch (error) {
                console.error('Error adding attendance:', error);
                attendanceFormMessage.textContent = `Error: ${error.message}`;
                attendanceFormMessage.classList.remove('text-green-600', 'text-gray-600');
                attendanceFormMessage.classList.add('text-red-600');
            }
        });
    } else {
         console.warn("attendance.js: Add attendance form not found."); // Add log
    }

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("attendance.js: Logout button clicked."); // Add log
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
        console.warn("attendance.js: Logout button not found."); // Add log
    }

    // --- INITIAL DATA LOAD ---
    console.log("attendance.js: Calling initial fetch functions inside runPageLogic."); // Add log
    fetchEmployeeDetails();
    fetchAttendanceHistory();

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);

