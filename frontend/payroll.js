// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Payroll page (payroll.html) ---
function runPageLogic() {
    console.log("payroll.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    const payrollForm = document.getElementById('run-payroll-form');
    const payrollButton = document.getElementById('run-payroll-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const payrollResult = document.getElementById('payroll-result');
    const resultMessage = document.getElementById('result-message');
    const failedEmployeesList = document.getElementById('failed-employees-list');
    const failedList = document.getElementById('failed-list');
    const logoutButton = document.getElementById('logout-button');
    const monthInput = document.getElementById('month'); // Get month input
    const bonusInput = document.getElementById('bonus'); // Get bonus input

    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // --- EVENT LISTENERS ---

    if (payrollForm) {
        payrollForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Ensure elements exist before getting values
            if (!monthInput || !bonusInput) {
                 console.error("Month or Bonus input element not found!");
                 alert("Error: Month or Bonus input missing. Please refresh.");
                 return;
            }

            const month = monthInput.value + '-01'; // Append day for backend
            const bonus = bonusInput.value || 0; // Default bonus to 0 if empty

             console.log(`payroll.js: Submitting payroll run for month: ${month}, bonus: ${bonus}`); // Add log

            // Basic validation
            if (!monthInput.value) {
                alert("Please select a month.");
                return;
            }

            // Disable button and show spinner (ensure elements exist)
            if (payrollButton) {
                 payrollButton.disabled = true;
                 payrollButton.textContent = 'Running...';
            }
            if (loadingSpinner) loadingSpinner.classList.remove('hidden');
            if (payrollResult) payrollResult.classList.add('hidden');
            if (resultMessage) resultMessage.textContent = '';
            if (failedList) failedList.innerHTML = '';
            if (failedEmployeesList) failedEmployeesList.classList.add('hidden'); // Hide list initially


            try {
                const response = await fetch(`${API_BASE_URL}/payroll/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: month, bonus: bonus }), // Send bonus
                    credentials: 'include'
                });

                // Try to parse JSON regardless of ok status, as backend might send error details
                 let data;
                 try {
                     data = await response.json();
                     console.log("payroll.js: Payroll response data:", data); // Add log
                 } catch (jsonError) {
                      console.error("payroll.js: Failed to parse JSON response:", jsonError);
                      // If JSON parsing fails, create a generic error object
                      throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }


                if (!response.ok) {
                    // Use error message from parsed data if available
                    throw new Error(data.error || `Payroll run failed with status ${response.status}`);
                }

                // Show success (ensure elements exist)
                 if (payrollResult && resultMessage) {
                    payrollResult.classList.remove('hidden', 'bg-red-100', 'border-red-500', 'text-red-700');
                    payrollResult.classList.add('bg-green-100', 'border-green-500', 'text-green-700');
                    resultMessage.textContent = `Successfully processed ${data.success_count} employees. Failed: ${data.failed_count}.`;
                 }

                // Show failed list if any (ensure elements exist)
                if (data.failed_count > 0 && failedEmployeesList && failedList) {
                    failedEmployeesList.classList.remove('hidden');
                    if (data.failed_details && Array.isArray(data.failed_details)) {
                         data.failed_details.forEach(item => {
                            const li = document.createElement('li');
                            li.textContent = `ID ${item.employee_id}: ${item.reason}`;
                            failedList.appendChild(li);
                        });
                    } else {
                         // Handle case where failed_details might be missing or not an array
                         const li = document.createElement('li');
                         li.textContent = `Could not retrieve failure details.`;
                         failedList.appendChild(li);
                    }
                } else if (failedEmployeesList) {
                    failedEmployeesList.classList.add('hidden');
                }

            } catch (error) {
                console.error('Payroll run error:', error);
                 // Show error message (ensure elements exist)
                 if (payrollResult && resultMessage) {
                    payrollResult.classList.remove('hidden', 'bg-green-100', 'border-green-500', 'text-green-700');
                    payrollResult.classList.add('bg-red-100', 'border-red-500', 'text-red-700');
                    resultMessage.textContent = `Error: ${error.message}`;
                 } else {
                     // Fallback if result elements aren't found
                     alert(`Error running payroll: ${error.message}`);
                 }
                 // Ensure failed list section is hidden on error
                 if (failedEmployeesList) failedEmployeesList.classList.add('hidden');

            } finally {
                // Re-enable button and hide spinner (ensure elements exist)
                if (payrollButton) {
                     payrollButton.disabled = false;
                     payrollButton.textContent = 'Run Payroll';
                }
                if (loadingSpinner) loadingSpinner.classList.add('hidden');
                 console.log("payroll.js: Payroll submission finished."); // Add log
            }
        });
    } else {
        console.warn("payroll.js: Payroll form not found."); // Add log
    }

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("payroll.js: Logout button clicked."); // Add log
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
        console.warn("payroll.js: Logout button not found."); // Add log
    }

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);

