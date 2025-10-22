document.addEventListener('DOMContentLoaded', () => {
    const employeeNameHeader = document.getElementById('employee-name-header');
    const attendanceHistoryBody = document.getElementById('attendance-history-body');
    const addAttendanceForm = document.getElementById('add-attendance-form');
    const employeeIdInput = document.getElementById('employee-id');

    const urlParams = new URLSearchParams(window.location.search);
    const employeeId = urlParams.get('id');

    if (!employeeId) {
        window.location.href = 'index.html'; // Redirect if no ID is present
        return;
    }

    const employeeApiUrl = `http://127.0.0.1:5000/api/employees/${employeeId}`;
    const attendanceApiUrl = `http://127.0.0.1:5000/api/employees/${employeeId}/attendance`;
    const addAttendanceApiUrl = 'http://127.0.0.1:5000/api/attendance';

    // Fetch employee name to display in the header
    fetch(employeeApiUrl)
        .then(response => response.json())
        .then(employee => {
            if (employee.error) {
                employeeNameHeader.textContent = 'Employee Not Found';
            } else {
                employeeNameHeader.textContent = `Attendance for ${employee.name}`;
                employeeIdInput.value = employee.employee_id;
            }
        });

    // Function to fetch and display attendance history
    function fetchAndDisplayAttendance() {
        fetch(attendanceApiUrl)
            .then(response => response.json())
            .then(records => {
                attendanceHistoryBody.innerHTML = '';
                if (records.length === 0) {
                    attendanceHistoryBody.innerHTML = `<tr><td colspan="4" class="text-center p-4">No attendance records found.</td></tr>`;
                    return;
                }
                records.forEach(record => {
                    const row = document.createElement('tr');
                    row.className = 'border-b border-gray-200 hover:bg-gray-50';
                    
                    const monthDate = new Date(record.month);
                    const formattedMonth = monthDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });

                    row.innerHTML = `
                        <td class="py-3 px-6 text-left font-medium">${formattedMonth}</td>
                        <td class="py-3 px-6 text-center">${record.days_present}</td>
                        <td class="py-3 px-6 text-center">${record.leaves_taken}</td>
                        <td class="py-3 px-6 text-right font-semibold">${record.overtime_hours} hrs</td>
                    `;
                    attendanceHistoryBody.appendChild(row);
                });
            });
    }

    // Event listener for the form submission
    addAttendanceForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const attendanceData = {
            employee_id: employeeIdInput.value,
            month: document.getElementById('month').value + '-01', // Append day for consistency
            days_present: document.getElementById('days_present').value,
            leaves_taken: document.getElementById('leaves_taken').value,
            overtime_hours: document.getElementById('overtime_hours').value,
        };

        fetch(addAttendanceApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                addAttendanceForm.reset();
                fetchAndDisplayAttendance(); // Refresh the list
            } else {
                throw new Error(data.error || 'Failed to add record');
            }
        })
        .catch(error => {
            console.error('Error adding attendance:', error);
            alert(`Error: ${error.message}`);
        });
    });

    // Initial load of attendance data
    fetchAndDisplayAttendance();
});
