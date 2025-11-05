// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Admin Dashboard (index.html) ---
function runPageLogic() {
    console.log("scripts.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    const employeeTableBody = document.getElementById('employee-table-body');
    const addEmployeeForm = document.getElementById('add-employee-form');
    const searchInput = document.getElementById('search-input');
    const departmentFilter = document.getElementById('department-filter');
    const departmentChartCanvas = document.getElementById('department-chart');

    // Stat Card Selectors
    const totalEmployeesEl = document.getElementById('total-employees');
    const totalDepartmentsEl = document.getElementById('total-departments');
    const averageSalaryEl = document.getElementById('average-salary');

    // Spinner and Table Container
    const tableSpinner = document.getElementById('table-spinner');
    const tableContainer = document.getElementById('table-container');

    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const closeModalButton = document.getElementById('close-modal');
    const cancelEditButton = document.getElementById('cancel-edit');
    // --- NEW: Selector for user dropdown ---
    const editUserIdSelect = document.getElementById('edit_user_id');

    // Notification and Confirmation Elements
    const notificationToast = document.getElementById('notification-toast');
    const notificationMessage = document.getElementById('notification-message');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYesButton = document.getElementById('confirm-yes');
    const confirmNoButton = document.getElementById('confirm-no');

    // Logout Button
    const logoutButton = document.getElementById('logout-button');

    // --- FIX: Add selector for the username display in the header ---
    const usernameDisplay = document.getElementById('username-display');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let departmentChart = null;
    let employeeToDeleteId = null;

    // --- FIX: Function to set username ---
    async function setUsername() {
        if (!usernameDisplay) {
            console.warn("scripts.js: Username display element not found in header.");
            return;
        }
        try {
            // Fetch auth details again to get username reliably
            const response = await fetch(`${API_BASE_URL}/check-auth`, { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                if (data.logged_in && data.username) {
                    usernameDisplay.textContent = data.username;
                    console.log("scripts.js: Username set in header:", data.username);
                } else {
                     usernameDisplay.textContent = 'Admin'; // Fallback for admin page
                }
            } else {
                 usernameDisplay.textContent = 'Error'; // Indicate auth check failed
            }
        } catch (error) {
            console.error("scripts.js: Error fetching username for header:", error);
            usernameDisplay.textContent = 'Error';
        }
    }

    // --- HELPER FUNCTIONS ---
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : 'N/A';
    const formatDate = (dateString) => dateString ? new Date(dateString.split(' ')[0]).toLocaleDateString('en-GB') : 'N/A'; // Simple DD/MM/YYYY

    const showNotification = (message, isError = false) => {
        if (!notificationToast || !notificationMessage) {
            console.error("Notification elements not found!");
            alert(message); // Fallback to alert
            return;
        }
        notificationMessage.textContent = message;
        notificationToast.classList.remove('hidden', 'bg-red-500', 'bg-green-500'); // Reset classes
        notificationToast.classList.add(isError ? 'bg-red-500' : 'bg-green-500');

        // Simple fade in/out (optional)
        notificationToast.style.opacity = 1;
        setTimeout(() => {
            notificationToast.style.opacity = 0;
            // Use transition end or another timeout to hide completely
            setTimeout(() => notificationToast.classList.add('hidden'), 500); // Hide after fade
        }, 3000); // Show for 3 seconds
    };


    // --- DATA FETCHING & RENDERING ---
    async function fetchDashboardStats() {
        console.log("scripts.js: fetchDashboardStats() called."); // Add log
        // Set loading state
        if(totalEmployeesEl) totalEmployeesEl.textContent = '...';
        if(totalDepartmentsEl) totalDepartmentsEl.textContent = '...';
        if(averageSalaryEl) averageSalaryEl.textContent = '...';

        try {
            const response = await fetch(`${API_BASE_URL}/dashboard-stats`, { credentials: 'include' });
            if (!response.ok) {
                if(response.status === 401 || response.status === 403) return; // Handled by auth.js
                 let errorMsg = `Failed to fetch stats (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const stats = await response.json();
             console.log("scripts.js: Dashboard stats received:", stats); // Add log

            if(totalEmployeesEl) totalEmployeesEl.textContent = stats.total_employees ?? 'N/A';
            if(totalDepartmentsEl) totalDepartmentsEl.textContent = stats.total_departments ?? 'N/A';
            if(averageSalaryEl) averageSalaryEl.textContent = formatCurrency(stats.average_salary);

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            if(totalEmployeesEl) totalEmployeesEl.textContent = 'N/A';
            if(totalDepartmentsEl) totalDepartmentsEl.textContent = 'N/A';
            if(averageSalaryEl) averageSalaryEl.textContent = 'N/A';
            showNotification(`Error loading stats: ${error.message}`, true); // Show error to user
        }
    }

    async function fetchEmployees(searchTerm = '', department = '') {
         console.log(`scripts.js: fetchEmployees called with search: "${searchTerm}", department: "${department}"`); // Add log
         if (!employeeTableBody || !tableSpinner || !tableContainer || !departmentFilter) {
             console.error("Employee list or related elements not found!");
             return;
         }

        // --- SPINNER LOGIC (START) ---
        tableSpinner.classList.remove('hidden');
        tableContainer.classList.add('hidden');
        employeeTableBody.innerHTML = ''; // Clear previous results immediately

        try {
            // --- MODIFIED: Fetch linked username as well ---
            const response = await fetch(`${API_BASE_URL}/employees?search=${encodeURIComponent(searchTerm)}&department=${encodeURIComponent(department)}&include_linked_user=true`, {
                credentials: 'include'
            });
            if (!response.ok) {
                if(response.status === 401 || response.status === 403) return; // Handled by auth.js
                 let errorMsg = `Failed to fetch employees (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log("scripts.js: Employee data received:", data); // Add log

            // Populate table
            if (!data.employees || data.employees.length === 0) {
                employeeTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">No employees found matching criteria.</td></tr>`;
            } else {
                data.employees.forEach(emp => {
                    const row = document.createElement('tr');
                    // --- NEW: Add linked username display ---
                    const linkedUserText = emp.linked_username 
                        ? `<span class="text-xs text-blue-600">(${emp.linked_username})</span>` 
                        : `<span class="text-xs text-gray-400">(Unlinked)</span>`;
                    
                    // Add null checks for safety
                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${emp.employee_id ?? 'N/A'}</td>
                        <td class="py-2 px-4 border-b">
                            ${emp.name ?? 'N/A'}
                            <br>
                            ${linkedUserText}
                        </td>
                        <td class="py-2 px-4 border-b">${emp.department ?? 'N/A'}</td>
                        <td class="py-2 px-4 border-b">${emp.position ?? 'N/A'}</td>
                        <td class="py-2 px-4 border-b">${formatDate(emp.joining_date)}</td>
                        <td class="py-2 px-4 border-b text-right">${formatCurrency(emp.base_salary)}</td>
                        <td class="py-2 px-4 border-b text-center space-x-1">
                            <a href="attendance.html?employee_id=${emp.employee_id}" class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded transition-all duration-200">Attendance</a>
                            <a href="salary.html?employee_id=${emp.employee_id}" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-2 rounded transition-all duration-200">Salary</a>
                            <button data-action="edit" data-id="${emp.employee_id}" class="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded transition-all duration-200">Edit</button>
                            <button data-action="delete" data-id="${emp.employee_id}" class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded transition-all duration-200">Delete</button>
                        </td>
                    `;
                    employeeTableBody.appendChild(row);
                });
            }

            // Populate department filter (only if needed and departments exist)
            if (departmentFilter.options.length <= 1 && data.departments && data.departments.length > 0) {
                 console.log("scripts.js: Populating department filter."); // Add log
                 data.departments.forEach(dep => {
                     if (dep) { // Avoid adding null/empty departments
                        const option = document.createElement('option');
                        option.value = dep;
                        option.textContent = dep;
                        departmentFilter.appendChild(option);
                     }
                });
            }

            // Render the department distribution chart
            renderDepartmentChart(data.employees || []); // Pass empty array if no employees

        } catch (error) {
            console.error('Fetch employees error:', error);
            showNotification(`Failed to load employee data: ${error.message}`, true);
            employeeTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error loading employees.</td></tr>`; // Show error in table
             renderDepartmentChart([]); // Render empty chart on error
        } finally {
            // --- SPINNER LOGIC (END) ---
            tableSpinner.classList.add('hidden');
            tableContainer.classList.remove('hidden');
        }
    }

    // --- CHART RENDERING ---
    function renderDepartmentChart(employees) {
        console.log("scripts.js: renderDepartmentChart called."); // Add log
        if (!departmentChartCanvas) {
             console.error("Department chart canvas not found!");
             return;
        }

        // Calculate employee count per department
        const departmentCounts = (employees || []).reduce((acc, emp) => {
             const dept = emp.department || 'Unknown'; // Group null/empty departments
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {});

        // Prepare data for Chart.js
        const chartData = {
            labels: Object.keys(departmentCounts),
            datasets: [{
                label: 'Employees per Department',
                data: Object.values(departmentCounts),
                backgroundColor: [ // Add more colors if needed
                    'rgba(54, 162, 235, 0.7)', // Blue
                    'rgba(255, 99, 132, 0.7)',  // Red
                    'rgba(75, 192, 192, 0.7)',  // Green
                    'rgba(255, 206, 86, 0.7)',  // Yellow
                    'rgba(153, 102, 255, 0.7)', // Purple
                    'rgba(255, 159, 64, 0.7)'   // Orange
                ],
                 borderColor: '#fff', // Add white border for separation
                 borderWidth: 1
            }]
        };

        // Destroy previous chart instance if it exists
        if (departmentChart) {
            departmentChart.destroy();
            departmentChart = null; // Ensure it's reset
        }

        // Only create chart if there's data
         if (Object.keys(departmentCounts).length > 0) {
            try {
                departmentChart = new Chart(departmentChartCanvas, {
                    type: 'pie', // Or 'doughnut'
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false, // Allows chart to fit container height
                        plugins: {
                            legend: {
                                position: 'top', // Position the legend at the top
                                labels: {
                                    padding: 15 // Add padding to legend items
                                }
                            },
                            tooltip: {
                                callbacks: {
                                     // Show count in tooltip
                                     label: (context) => `${context.label}: ${context.raw}`
                                }
                            }
                        },
                         layout: {
                             padding: 5 // Add small padding around chart
                         }
                    }
                });
                 console.log("scripts.js: Department chart rendered."); // Add log
            } catch (chartError) {
                 console.error("scripts.js: Error rendering department chart:", chartError);
                 // Optionally display an error message on the canvas container
                 departmentChartCanvas.parentElement.innerHTML = '<p class="text-red-500 text-center">Could not display chart.</p>';
            }
         } else {
             console.log("scripts.js: No department data to render chart."); // Add log
              // Optionally display a "No data" message
              departmentChartCanvas.parentElement.innerHTML = '<p class="text-gray-500 text-center">No department data available.</p>';
         }
    }


    // --- EVENT LISTENERS ---

    // Add Employee Form Submission
    if (addEmployeeForm) {
        addEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("scripts.js: Add employee form submitted."); // Add log
            const formData = new FormData(addEmployeeForm);
            const newEmployee = Object.fromEntries(formData.entries());

            // Simple validation (can be more robust)
            if (!newEmployee.name || !newEmployee.department || !newEmployee.position || !newEmployee.joining_date || !newEmployee.base_salary) {
                showNotification("Please fill in all employee fields.", true);
                return;
            }

             const submitButton = addEmployeeForm.querySelector('button[type="submit"]');
             if(submitButton) submitButton.disabled = true; // Disable button during submission

            try {
                const response = await fetch(`${API_BASE_URL}/employees`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newEmployee),
                    credentials: 'include'
                });
                 // Try parsing JSON even for errors
                 let data;
                 try {
                     data = await response.json();
                     console.log("scripts.js: Add employee response:", data); // Add log
                 } catch (jsonError) {
                     throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }

                if (!response.ok) {
                    throw new Error(data.error || `Failed to add employee (Status: ${response.status})`);
                }
                showNotification('Employee added successfully!');
                addEmployeeForm.reset();
                fetchEmployees(); // Refresh list and chart
                fetchDashboardStats(); // Refresh stats

            } catch (error) {
                console.error('Add employee error:', error);
                showNotification(`Error adding employee: ${error.message}`, true);
            } finally {
                 if(submitButton) submitButton.disabled = false; // Re-enable button
            }
        });
    } else {
         console.warn("scripts.js: Add employee form not found."); // Add log
    }


    // Event Delegation for Edit and Delete buttons
    if (employeeTableBody) {
        employeeTableBody.addEventListener('click', async (e) => {
            // Target the button itself, even if icon inside is clicked
            const button = e.target.closest('button[data-action]');
            if (!button) return; // Exit if click wasn't on an action button

            const action = button.dataset.action;
            const id = button.dataset.id;
            console.log(`scripts.js: Action "${action}" clicked for employee ID ${id}`); // Add log


            if (action === 'delete') {
                 if (!confirmModal || !confirmMessage || !confirmYesButton || !confirmNoButton) {
                     console.error("Confirmation modal elements not found!");
                     if(confirm("Are you sure you want to delete this employee? (Modal failed)")) { // Fallback confirm
                         // Proceed with deletion logic directly if modal fails - NOT IDEAL
                         await proceedWithDelete(id);
                     }
                     return;
                 }
                employeeToDeleteId = id;
                confirmMessage.textContent = `Are you sure you want to delete employee ID ${id}? This action cannot be undone.`;
                confirmModal.classList.remove('hidden');
            }
            else if (action === 'edit') {
                 if (!editModal || !editForm || !editUserIdSelect) { // Check for dropdown too
                     console.error("Edit modal elements not found!");
                     alert("Cannot open edit form. Please refresh.");
                     return;
                 }
                try {
                     button.textContent = 'Loading...'; // Indicate loading
                     button.disabled = true;

                     // --- NEW: Reset dropdown and set loading state ---
                     editUserIdSelect.innerHTML = '<option value="">Loading users...</option>';
                     editUserIdSelect.disabled = true;

                     // --- NEW: Fetch unlinked users first ---
                     const usersResponse = await fetch(`${API_BASE_URL}/users/unlinked`, { credentials: 'include' });
                     if (!usersResponse.ok) {
                        throw new Error(`Failed to load unlinked users (${usersResponse.status})`);
                     }
                     const unlinkedUsers = await usersResponse.json();

                     // --- MODIFIED: Fetch employee with linked user info ---
                    const response = await fetch(`${API_BASE_URL}/employees/${id}?include_linked_user=true`, { credentials: 'include' });
                    if (!response.ok) {
                         if(response.status === 401 || response.status === 403) return; // Auth handled
                         let errorMsg = `Failed to load employee data (${response.status})`;
                         try {
                             const errorData = await response.json();
                             errorMsg = errorData.error || errorMsg;
                         } catch(e) { /* Ignore */ }
                        throw new Error(errorMsg);
                    }
                    const employee = await response.json();
                    console.log("scripts.js: Editing employee:", employee); // Add log

                    // Fill the edit form fields safely
                    editForm.elements['employee_id'].value = employee.employee_id ?? '';
                    editForm.elements['name'].value = employee.name ?? '';
                    editForm.elements['department'].value = employee.department ?? '';
                    editForm.elements['position'].value = employee.position ?? '';
                    // Ensure date format is YYYY-MM-DD
                    editForm.elements['joining_date'].value = (employee.joining_date ? employee.joining_date.split('T')[0] : ''); // Use split('T') for safety
                    editForm.elements['base_salary'].value = employee.base_salary ?? '';

                    // --- NEW: Populate and set dropdown ---
                    editUserIdSelect.innerHTML = ''; // Clear loading
                    editUserIdSelect.add(new Option('-- Unlinked --', '')); // Add default unlinked option
                    
                    // Add all unlinked users
                    unlinkedUsers.forEach(user => {
                        editUserIdSelect.add(new Option(user.username, user.id));
                    });

                    // If employee is already linked, add their user to the list
                    const currentUserId = employee.user_id;
                    const currentUsername = employee.linked_username;
                    
                    if (currentUserId && currentUsername) {
                        // Check if this user is somehow already in the unlinked list (shouldn't happen, but safe check)
                        const alreadyInList = unlinkedUsers.some(user => user.id === currentUserId);
                        if (!alreadyInList) {
                            // Add the currently linked user to the dropdown
                            editUserIdSelect.add(new Option(`${currentUsername} (Currently Linked)`, currentUserId));
                        }
                    }

                    // Set the dropdown's selected value
                    editUserIdSelect.value = currentUserId || '';
                    editUserIdSelect.disabled = false; // Enable dropdown

                    editModal.classList.remove('hidden');

                } catch (error) {
                    console.error('Edit load error:', error);
                    showNotification(`Could not load employee data for editing: ${error.message}`, true);
                    editUserIdSelect.innerHTML = '<option value="">Error loading users</option>'; // Show error in dropdown
                } finally {
                     button.textContent = 'Edit'; // Restore button text
                     button.disabled = false;
                     // Ensure dropdown is enabled if modal didn't open
                     editUserIdSelect.disabled = false;
                }
            }
        });
    } else {
         console.warn("scripts.js: Employee table body not found for event delegation."); // Add log
    }

    // Function to handle deletion after confirmation
     async function proceedWithDelete(id) {
         if (!id) return;
         console.log(`scripts.js: Proceeding with delete for employee ID ${id}`); // Add log
         try {
             const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
                 method: 'DELETE',
                 credentials: 'include'
             });
              // Try parsing JSON even for errors
             let data;
             try {
                 data = await response.json();
                 console.log("scripts.js: Delete response:", data); // Add log
             } catch (jsonError) {
                  throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
             }

             if (!response.ok) {
                 throw new Error(data.error || `Failed to delete employee (Status: ${response.status})`);
             }
             showNotification('Employee deleted successfully.');
             fetchEmployees(searchInput.value, departmentFilter.value); // Refresh list/chart
             fetchDashboardStats(); // Refresh stats
         } catch (error) {
             console.error('Delete error:', error);
             showNotification(`Error deleting employee: ${error.message}`, true);
         } finally {
             // Reset state and hide modal (ensure modal elements exist)
             employeeToDeleteId = null;
             if (confirmModal) confirmModal.classList.add('hidden');
         }
     }


    // Edit Form Submission
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = e.target.elements['employee_id'].value;
             console.log(`scripts.js: Edit form submitted for employee ID ${id}`); // Add log

            const updatedData = {
                name: e.target.elements['name'].value,
                department: e.target.elements['department'].value,
                position: e.target.elements['position'].value,
                joining_date: e.target.elements['joining_date'].value,
                base_salary: e.target.elements['base_salary'].value,
                // --- NEW: Get the selected user_id from the dropdown ---
                user_id: e.target.elements['user_id'].value
            };

            // Simple validation
             if (!updatedData.name || !updatedData.department || !updatedData.position || !updatedData.joining_date || !updatedData.base_salary) {
                showNotification("Please fill in all employee fields.", true);
                return;
            }

             const saveButton = editForm.querySelector('button[type="submit"]');
             if(saveButton) saveButton.disabled = true; // Disable button

            try {
                const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData),
                    credentials: 'include'
                });
                // Try parsing JSON even for errors
                 let data;
                 try {
                     data = await response.json();
                      console.log("scripts.js: Edit response:", data); // Add log
                 } catch (jsonError) {
                     throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }

                if (!response.ok) {
                    throw new Error(data.error || `Failed to update employee (Status: ${response.status})`);
                }
                if (editModal) editModal.classList.add('hidden'); // Hide modal on success
                showNotification(data.message || 'Employee updated successfully!'); // Use message from backend if available
                
                // --- MODIFIED: Refresh list/chart with current filters ---
                fetchEmployees(searchInput.value, departmentFilter.value); 
                fetchDashboardStats(); // Refresh stats
            } catch (error) {
                 console.error('Update error:', error);
                 // --- NEW: Check for specific 409 (Conflict) error ---
                 if (error.message.includes("409")) {
                     showNotification("Update failed: This user account is already linked to another employee.", true);
                 } else {
                     showNotification(`Error updating employee: ${error.message}`, true);
                 }
            } finally {
                 if(saveButton) saveButton.disabled = false; // Re-enable button
            }
        });
    } else {
         console.warn("scripts.js: Edit form not found."); // Add log
    }


    // Confirmation Modal Buttons
    if (confirmYesButton) {
        confirmYesButton.addEventListener('click', () => proceedWithDelete(employeeToDeleteId));
    } else {
         console.warn("scripts.js: Confirm Yes button not found."); // Add log
    }

    if (confirmNoButton) {
        confirmNoButton.addEventListener('click', () => {
             console.log("scripts.js: Delete cancelled."); // Add log
             employeeToDeleteId = null;
            if (confirmModal) confirmModal.classList.add('hidden');
        });
    } else {
        console.warn("scripts.js: Confirm No button not found."); // Add log
    }


    // Modal Closing Buttons
    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
             if (editModal) editModal.classList.add('hidden');
        });
    } else {
         console.warn("scripts.js: Close Modal button not found."); // Add log
    }

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', () => {
             if (editModal) editModal.classList.add('hidden');
        });
    } else {
         console.warn("scripts.js: Cancel Edit button not found."); // Add log
    }


    // Live Search Input (with Debounce)
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                 console.log("scripts.js: Search input changed, fetching..."); // Add log
                 fetchEmployees(searchInput.value, departmentFilter.value);
            }, 300); // 300ms delay
        });
    } else {
         console.warn("scripts.js: Search input not found."); // Add log
    }


    // Department Filter Dropdown
    if (departmentFilter) {
        departmentFilter.addEventListener('change', () => {
             console.log("scripts.js: Department filter changed, fetching..."); // Add log
             fetchEmployees(searchInput.value, departmentFilter.value);
        });
    } else {
         console.warn("scripts.js: Department filter not found."); // Add log
    }


    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log("scripts.js: Logout button clicked."); // Add log
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
         console.warn("scripts.js: Logout button not found."); // Add log
    }

    // --- INITIAL DATA LOAD ---
    console.log("scripts.js: Calling initial fetch functions inside runPageLogic."); // Add log
    // --- FIX: Call setUsername at the start ---
    setUsername(); // Set the username in the header first
    fetchEmployees();
    fetchDashboardStats();

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);