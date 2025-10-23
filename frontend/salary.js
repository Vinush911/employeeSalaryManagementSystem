// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Salary page (salary.html) ---
function runPageLogic() {
    console.log("salary.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    const employeeNameHeader = document.getElementById('employee-name-header');
    const salaryHistoryBody = document.getElementById('salary-history-body');
    const addSalaryForm = document.getElementById('add-salary-form');
    const employeeIdInput = document.getElementById('employee-id'); // Hidden input
    const baseSalaryInput = document.getElementById('base-salary'); // Hidden input
    const salaryFormMessage = document.getElementById('salary-form-message');
    const logoutButton = document.getElementById('logout-button');
    const monthInput = document.getElementById('month'); // Get month input for validation/reset
    const bonusInput = document.getElementById('bonus'); // Get bonus input for validation/reset
    const deductionsInput = document.getElementById('deductions'); // Get deductions input

    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // Get employee ID from the URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const employeeId = urlParams.get('employee_id');

    if (!employeeId) {
        console.error("salary.js: No employee_id found in URL. Redirecting."); // Add log
        // Redirect if employee_id is missing
        window.location.href = 'index.html';
        return; // Stop further execution
    }
     console.log(`salary.js: Managing salary for employee_id: ${employeeId}`); // Add log


    // --- HELPER FUNCTIONS ---
    // Updated formatCurrency to handle potential null/undefined values
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : 'N/A';

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
         console.log("salary.js: fetchEmployeeDetails() called."); // Add log
         if (!employeeNameHeader || !employeeIdInput || !baseSalaryInput) {
            console.error("Required employee detail elements not found!");
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
             console.log("salary.js: Employee details received:", employee); // Add log
            employeeNameHeader.textContent = `Salary for ${employee.name ?? 'Unknown Employee'}`;
            // Populate hidden fields needed for form submission
            employeeIdInput.value = employee.employee_id ?? '';
            baseSalaryInput.value = employee.base_salary ?? '';
        } catch (error) {
            console.error('Error fetching employee details:', error);
            employeeNameHeader.textContent = 'Error loading employee data';
        }
    }

    async function fetchSalaryHistory() {
        console.log("salary.js: fetchSalaryHistory() called."); // Add log
        if (!salaryHistoryBody) {
             console.error("Salary history table body not found!");
             return;
        }
        salaryHistoryBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">Loading salary history...</td></tr>`; // Show loading state

        try {
            const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/salaries`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) return; // Handled by auth.js
                 // Try to get error message from backend
                let errorMsg = `Failed to fetch salary history (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) { /* Ignore if response isn't JSON */ }
                throw new Error(errorMsg);
            }
            const salaries = await response.json();
            console.log("salary.js: Salary history received:", salaries); // Add log

            salaryHistoryBody.innerHTML = ''; // Clear loading message
            if (!salaries || salaries.length === 0) {
                salaryHistoryBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">No salary records found.</td></tr>`;
            } else {
                salaries.forEach(salary => {
                    const row = document.createElement('tr');
                    // Add null checks for safety when accessing properties
                    const base = salary.base_salary ?? 0;
                    const overtime = salary.overtime_pay ?? 0;
                    const bonus = salary.bonus ?? 0;
                    const deductions = salary.deductions ?? 0;
                    const pf = salary.pf_amount ?? 0;
                    const total = salary.total_salary ?? 0; // Use total_salary calculated by DB trigger

                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${formatMonthYear(salary.month)}</td>
                        <td class="py-2 px-4 border-b text-right">${formatCurrency(base)}</td>
                        <td class="py-2 px-4 border-b text-right text-green-600">+ ${formatCurrency(overtime)}</td>
                        <td class="py-2 px-4 border-b text-right text-green-600">+ ${formatCurrency(bonus)}</td>
                        <td class="py-2 px-4 border-b text-right text-red-600">- ${formatCurrency(deductions)}</td>
                        <td class="py-2 px-4 border-b text-right text-red-600">- ${formatCurrency(pf)}</td>
                        <td class="py-2 px-4 border-b text-right font-bold">${formatCurrency(total)}</td>
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
    if (addSalaryForm) {
        addSalaryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
             console.log("salary.js: Add salary form submitted."); // Add log

            // Ensure message element exists
            if (!salaryFormMessage) {
                console.error("Salary form message element not found!");
                return;
            }
            // Ensure required inputs exist
             if (!monthInput || !bonusInput || !deductionsInput) {
                 console.error("Month, Bonus or Deductions input element not found!");
                 alert("Error: Form elements missing. Please refresh.");
                 return;
             }

            // Get data from form (use element references for values)
            const monthValue = monthInput.value;
            const bonusValue = bonusInput.value || 0; // Default to 0 if empty
            const deductionsValue = deductionsInput.value || 0; // Default to 0 if empty

            // Basic validation
            if (!monthValue) {
                alert("Please select a month.");
                return;
            }

            const salaryData = {
                employee_id: employeeId,
                month: monthValue + '-01', // Append day for backend consistency
                bonus: bonusValue,
                deductions: deductionsValue
            };
            console.log("salary.js: Sending salary data:", salaryData); // Add log


            salaryFormMessage.textContent = 'Generating & adding record...'; // Indicate processing
            salaryFormMessage.classList.remove('text-red-600', 'text-green-600');
            salaryFormMessage.classList.add('text-gray-600'); // Use neutral color for processing

            try {
                const response = await fetch(`${API_BASE_URL}/salaries`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(salaryData),
                    credentials: 'include'
                });

                 // Try parsing JSON even for errors
                 let data;
                 try {
                     data = await response.json();
                     console.log("salary.js: Add salary response data:", data); // Add log
                 } catch (jsonError) {
                     console.error("salary.js: Failed to parse JSON response:", jsonError);
                     throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }


                if (!response.ok) {
                    // Use error message from backend (e.g., "Attendance record not found")
                    throw new Error(data.error || `Failed to add salary (Status: ${response.status})`);
                }

                salaryFormMessage.textContent = 'Salary record added successfully!';
                salaryFormMessage.classList.remove('text-red-600', 'text-gray-600');
                salaryFormMessage.classList.add('text-green-600');
                addSalaryForm.reset(); // Clear form on success
                // Set default values back after reset if needed (optional)
                // bonusInput.value = 0;
                // deductionsInput.value = 0;
                fetchSalaryHistory(); // Refresh the list

            } catch (error) {
                console.error('Error adding salary:', error);
                salaryFormMessage.textContent = `Error: ${error.message}`;
                salaryFormMessage.classList.remove('text-green-600', 'text-gray-600');
                salaryFormMessage.classList.add('text-red-600');
            }
        });
    } else {
         console.warn("salary.js: Add salary form not found."); // Add log
    }

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("salary.js: Logout button clicked."); // Add log
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
        console.warn("salary.js: Logout button not found."); // Add log
    }

    // --- INITIAL DATA LOAD ---
    console.log("salary.js: Calling initial fetch functions inside runPageLogic."); // Add log
    fetchEmployeeDetails();
    fetchSalaryHistory();

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);

