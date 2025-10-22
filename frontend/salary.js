// This ensures the page is protected and logic runs AFTER auth check
document.addEventListener('DOMContentLoaded', () => {
    // Check auth status first
    // --- THIS IS THE FIX ---
    // Use the full, absolute URL for the API
    fetch('http://127.0.0.1:5000/api/check-auth', { credentials: 'include' })
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
    const salaryHistoryBody = document.getElementById('salary-history-body');
    const addSalaryForm = document.getElementById('add-salary-form');
    const employeeIdInput = document.getElementById('employee-id');
    const baseSalaryInput = document.getElementById('base-salary');
    const salaryFormMessage = document.getElementById('salary-form-message');
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
    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
    
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
            
            employeeNameHeader.textContent = `Salary for ${employee.name}`;
            employeeIdInput.value = employee.employee_id;
            baseSalaryInput.value = employee.base_salary;
        } catch (error)
{
            console.error('Error fetching employee details:', error);
            employeeNameHeader.textContent = 'Error loading employee data';
        }
    }

    // Fetches all past salary records for this employee
    async function fetchSalaryHistory() {
        try {
            const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/salaries`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch salary history');
            const salaries = await response.json();
            
            salaryHistoryBody.innerHTML = ''; // Clear existing rows
            if (salaries.length === 0) {
                salaryHistoryBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No salary records found.</td></tr>`;
            } else {
                // Populate the table with salary records
                salaries.forEach(salary => {
                    const row = document.createElement('tr');
                    const base = salary.base_salary || 0; 
                    const overtime = salary.overtime_pay || 0;
                    const bonus = salary.bonus || 0;
                    const deductions = salary.deductions || 0;
                    const pf = salary.pf_amount || 0;
                    
                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${formatMonthYear(salary.month)}</td>
                        <td class="py-2 px-4 border-b text-right">${formatCurrency(base)}</td>
                        <td class="py-2 px-4 border-b text-right text-green-600">+ ${formatCurrency(overtime)}</td>
                        <td class="py-2 px-4 border-b text-right text-green-600">+ ${formatCurrency(bonus)}</td>
                        <td class="py-2 px-4 border-b text-right text-red-600">- ${formatCurrency(deductions)}</td>
                        <td class="py-2 px-4 border-b text-right text-red-600">- ${formatCurrency(pf)}</td>
                        <td class="py-2 px-4 border-b text-right font-bold">${formatCurrency(salary.total_salary)}</td>
                        <td class="py-2 px-4 border-b text-center">
                            <a href="slip.html?salary_id=${salary.salary_id}" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded">
                                Download Slip
                            </a>
                        </td>
                    `;
                    salaryHistoryBody.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Error fetching salary history:', error);
            salaryHistoryBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load salary history.</td></tr>`;
        }
    }

    // --- EVENT LISTENERS ---
    
    // Add event listener for the new salary form
    if (addSalaryForm) {
        addSalaryForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Stop the default form submission (page reload)
            
            const formData = new FormData(addSalaryForm);
            
            // Construct the data object to send to the backend
            const salaryData = {
                employee_id: employeeId,
                month: formData.get('month') + '-01', // Ensure it's a full date for the DB
                base_salary: baseSalaryInput.value, // Send the base salary
                overtime_hours: formData.get('overtime_hours'),
                overtime_pay: formData.get('overtime_pay'),
                bonus: formData.get('bonus'),
                deductions: formData.get('deductions'),
                pf_amount: formData.get('pf_amount')
            };

            // Clear any previous messages
            salaryFormMessage.textContent = '';
            salaryFormMessage.classList.remove('text-red-600', 'text-green-600');

            try {
                // Send the data to the backend
                const response = await fetch(`${API_BASE_URL}/salaries`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(salaryData),
                    credentials: 'include' // Send cookies
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to add salary');
                }
                
                // Show success message and refresh the list
                salaryFormMessage.textContent = 'Salary record added successfully!';
                salaryFormMessage.classList.add('text-green-600');
                addSalaryForm.reset();
                fetchSalaryHistory(); // Refresh the list
                
            } catch (error) {
                console.error('Error adding salary:', error);
                salaryFormMessage.textContent = error.message;
                salaryFormMessage.classList.add('text-red-600');
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
    fetchSalaryHistory();
}

