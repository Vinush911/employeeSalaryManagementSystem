// This ensures the page is protected and logic runs AFTER auth check
document.addEventListener('DOMContentLoaded', () => {
    // Check auth status first
    // Use the full URL for the auth check, just in case
    fetch('/api/check-auth', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (!data.logged_in) {
                // If not logged in, redirect to login page
                window.location.href = 'login.html';
            } else {
                // If logged in, set username and run the page logic
                const usernameDisplay = document.getElementById('username-display');
                if(usernameDisplay) usernameDisplay.textContent = data.username;
                runPageLogic(); // Run the main functions for this page
            }
        })
        .catch(err => {
            console.error('Auth check failed', err);
            window.location.href = 'login.html';
        });
});

// Main function to encapsulate all page logic
function runPageLogic() {
    // Get all necessary elements from the page
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
        // If no ID is found, redirect back to the main dashboard
        window.location.href = 'index.html'; 
        return;
    }

    // --- HELPER FUNCTIONS ---
    const formatMonthYear = (dateString) => {
        if (!dateString) return 'Invalid Date';
        // Add 'T00:00:00' to ensure the date is parsed in local time, not UTC
        const date = new Date(dateString + 'T00:00:00'); 
        return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    };

    // --- DATA FETCHING ---
    // Fetches the employee's name to display in the header
    async function fetchEmployeeDetails() {
        try {
            const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch employee details');
            const employee = await response.json();
            employeeNameHeader.textContent = `Attendance for ${employee.name}`;
        } catch (error) {
            console.error('Error fetching employee details:', error);
            employeeNameHeader.textContent = 'Error loading employee data';
        }
    }

    // Fetches all past attendance records for this employee
    async function fetchAttendanceHistory() {
        try {
            const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/attendance`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch attendance history');
            const attendance = await response.json();
            
            attendanceHistoryBody.innerHTML = ''; // Clear existing rows
            if (attendance.length === 0) {
                attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center py-4">No attendance records found.</td></tr>`;
            } else {
                // Populate the table with attendance records
                attendance.forEach(record => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${formatMonthYear(record.month)}</td>
                        <td class="py-2 px-4 border-b text-center">${record.days_present}</td>
                        <td class="py-2 px-4 border-b text-center">${record.leaves_taken}</td>
                        <td class="py-2 px-4 border-b text-right">${record.overtime_hours.toFixed(1)}</td>
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
    
    // Add event listener for the new attendance form
    if (addAttendanceForm) {
        addAttendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Stop the default form submission (page reload)
            
            const formData = new FormData(addAttendanceForm);
            // Construct the data object to send to the backend
            const attendanceData = {
                employee_id: employeeId,
                month: formData.get('month') + '-01', // Append '-01' to make it a valid date
                days_present: formData.get('days_present'),
                leaves_taken: formData.get('leaves_taken'),
                overtime_hours: formData.get('overtime_hours')
            };

            // Clear any previous messages
            attendanceFormMessage.textContent = '';
            attendanceFormMessage.classList.remove('text-red-600', 'text-green-600');

            try {
                // Send the data to the backend
                const response = await fetch(`${API_BASE_URL}/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(attendanceData),
                    credentials: 'include' // Send cookies
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to add attendance');
                }
                
                // Show success message and refresh the list
                attendanceFormMessage.textContent = 'Record added successfully!';
                attendanceFormMessage.classList.add('text-green-600');
                addAttendanceForm.reset();
                fetchAttendanceHistory(); // Refresh the list
                
            } catch (error) {
                console.error('Error adding attendance:', error);
                attendanceFormMessage.textContent = error.message;
                attendanceFormMessage.classList.add('text-red-600');
            }
        });
    }

    // Add event listener for the logout button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await fetch(`${API_BASE_URL}/logout`, { method: 'POST', credentials: 'include' });
            window.location.href = 'login.html';
        });
    }

    // --- INITIAL LOAD ---
    // Fetch all necessary data when the page loads
    fetchEmployeeDetails();
    fetchAttendanceHistory();
}

