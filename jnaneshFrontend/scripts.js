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

    // === MODAL SELECTORS (CRITICAL) ===
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const closeModalButton = document.getElementById('close-modal');
    const cancelEditButton = document.getElementById('cancel-edit');
    const editUserIdSelect = document.getElementById('edit_user_id'); // User link dropdown
    const editModalBackdrop = document.getElementById('edit-modal-backdrop'); // Modal backdrop

    // Notification and Confirmation Elements
    const notificationToast = document.getElementById('notification-toast');
    const notificationMessage = document.getElementById('notification-message');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYesButton = document.getElementById('confirm-yes');
    const confirmNoButton = document.getElementById('confirm-no');
    const confirmModalBackdrop = document.getElementById('confirm-modal-backdrop'); // Modal backdrop

    // Logout Button
    const logoutButton = document.getElementById('logout-button');
    const usernameDisplay = document.getElementById('username-display');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let departmentChart = null;
    let employeeToDeleteId = null;

    // --- HELPER: Set Username ---
    async function setUsername() {
        // This is handled by auth.js, but we can call it again
        // just in case auth.js runs before the element exists.
        if (!usernameDisplay) {
            console.warn("scripts.js: Username display element not found in header.");
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
                        console.log("scripts.js: Username set in header:", data.username);
                    } else {
                         usernameDisplay.textContent = 'Admin'; 
                    }
                } else {
                     usernameDisplay.textContent = 'Error';
                }
            } catch (error) {
                console.error("scripts.js: Error fetching username for header:", error);
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

    const showNotification = (message, isError = false) => {
        if (!notificationToast || !notificationMessage) {
            console.error("Notification elements not found!");
            alert(message); // Fallback to alert
            return;
        }
        notificationMessage.textContent = message;
        
        // Clear old classes
        notificationToast.classList.remove('hidden', 'bg-gradient-to-r', 'from-red-500', 'to-rose-500', 'from-green-500', 'to-emerald-500', 'translate-y-4', 'opacity-0');

        if (isError) {
            notificationToast.classList.add('bg-gradient-to-r', 'from-red-500', 'to-rose-500');
        } else {
            notificationToast.classList.add('bg-gradient-to-r', 'from-green-500', 'to-emerald-500');
        }
        
        // Show and animate
        notificationToast.classList.remove('hidden');
        setTimeout(() => {
             notificationToast.classList.remove('translate-y-4', 'opacity-0');
        }, 10); // 10ms delay to trigger transition

        // Hide after 3 seconds
        setTimeout(() => {
            notificationToast.classList.add('opacity-0');
            setTimeout(() => notificationToast.classList.add('hidden'), 500); // Hide after fade
        }, 3000);
    };
    
    // --- MODAL HELPER FUNCTIONS ---
    const showEditModal = () => {
        if (editModal) editModal.classList.remove('hidden');
    };
    const hideEditModal = () => {
        if (editModal) editModal.classList.add('hidden');
    };
    const showConfirmModal = () => {
        if (confirmModal) confirmModal.classList.remove('hidden');
    };
    const hideConfirmModal = () => {
        if (confirmModal) confirmModal.classList.add('hidden');
    };


    // --- DATA FETCHING & RENDERING ---
    async function fetchDashboardStats() {
        console.log("scripts.js: fetchDashboardStats() called.");
        if(totalEmployeesEl) totalEmployeesEl.textContent = '...';
        if(totalDepartmentsEl) totalDepartmentsEl.textContent = '...';
        if(averageSalaryEl) averageSalaryEl.textContent = '...';

        try {
            const response = await fetch(`${API_BASE_URL}/dashboard-stats`, { credentials: 'include' });
            if (!response.ok) {
                if(response.status === 401 || response.status === 403) return;
                 let errorMsg = `Failed to fetch stats (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const stats = await response.json();
            console.log("scripts.js: Dashboard stats received:", stats);

            if(totalEmployeesEl) totalEmployeesEl.textContent = stats.total_employees ?? 'N/A';
            if(totalDepartmentsEl) totalDepartmentsEl.textContent = stats.total_departments ?? 'N/A';
            if(averageSalaryEl) averageSalaryEl.textContent = formatCurrency(stats.average_salary);

        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            if(totalEmployeesEl) totalEmployeesEl.textContent = 'N/A';
            if(totalDepartmentsEl) totalDepartmentsEl.textContent = 'N/A';
            if(averageSalaryEl) averageSalaryEl.textContent = 'N/A';
            showNotification(`Error loading stats: ${error.message}`, true);
        }
    }

    async function fetchEmployees(searchTerm = '', department = '') {
         console.log(`scripts.js: fetchEmployees called with search: "${searchTerm}", department: "${department}"`);
         if (!employeeTableBody || !tableSpinner || !tableContainer || !departmentFilter) {
             console.error("Employee list or related elements not found!");
             return;
         }

        tableSpinner.classList.remove('hidden');
        tableContainer.classList.add('hidden');
        employeeTableBody.innerHTML = ''; 

        try {
            const response = await fetch(`${API_BASE_URL}/employees?search=${encodeURIComponent(searchTerm)}&department=${encodeURIComponent(department)}&include_linked_user=true`, {
                credentials: 'include'
            });
            if (!response.ok) {
                if(response.status === 401 || response.status === 403) return;
                 let errorMsg = `Failed to fetch employees (${response.status})`;
                 try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log("scripts.js: Employee data received:", data);

            if (!data.employees || data.employees.length === 0) {
                employeeTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">No employees found matching criteria.</td></tr>`;
            } else {
                data.employees.forEach(emp => {
                    const row = document.createElement('tr');
                    const linkedUserText = emp.linked_username 
                        ? `<span class="text-xs text-blue-600">(${emp.linked_username})</span>` 
                        : `<span class="text-xs text-gray-400">(Unlinked)</span>`;
                    
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

            if (departmentFilter.options.length <= 1 && data.departments && data.departments.length > 0) {
                 console.log("scripts.js: Populating department filter.");
                 data.departments.forEach(dep => {
                     if (dep) { 
                        const option = document.createElement('option');
                        option.value = dep;
                        option.textContent = dep;
                        departmentFilter.appendChild(option);
                     }
                });
            }

            renderDepartmentChart(data.employees || []);

        } catch (error) {
            console.error('Fetch employees error:', error);
            showNotification(`Failed to load employee data: ${error.message}`, true);
            employeeTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error loading employees.</td></tr>`;
             renderDepartmentChart([]);
        } finally {
            tableSpinner.classList.add('hidden');
            tableContainer.classList.remove('hidden');
        }
    }

    // --- CHART RENDERING ---
    function renderDepartmentChart(employees) {
        console.log("scripts.js: renderDepartmentChart called.");
        if (!departmentChartCanvas) {
             console.error("Department chart canvas not found!");
             return;
        }
        
        const chartCtx = departmentChartCanvas.getContext('2d');
        if (!chartCtx) {
            console.error("Failed to get chart canvas context");
            return;
        }

        const departmentCounts = (employees || []).reduce((acc, emp) => {
             const dept = emp.department || 'Unknown';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {});

        const chartData = {
            labels: Object.keys(departmentCounts),
            datasets: [{
                label: 'Employees per Department',
                data: Object.values(departmentCounts),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)'
                ],
                 borderColor: '#fff',
                 borderWidth: 1
            }]
        };

        if (departmentChart) {
            departmentChart.destroy();
            departmentChart = null;
        }

         if (Object.keys(departmentCounts).length > 0) {
            try {
                departmentChart = new Chart(chartCtx, { // Use chartCtx
                    type: 'pie',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    padding: 15
                                }
                            },
                            tooltip: {
                                callbacks: {
                                     label: (context) => `${context.label}: ${context.raw}`
                                }
                            }
                        },
                         layout: {
                             padding: 5
                         }
                    }
                });
                 console.log("scripts.js: Department chart rendered.");
            } catch (chartError) {
                 console.error("scripts.js: Error rendering department chart:", chartError);
                 if (departmentChartCanvas.parentElement) {
                     departmentChartCanvas.parentElement.innerHTML = '<p class="text-red-500 text-center">Could not display chart.</p>';
                 }
            }
         } else {
             console.log("scripts.js: No department data to render chart.");
              if (departmentChartCanvas.parentElement) {
                 departmentChartCanvas.parentElement.innerHTML = '<p class="text-gray-500 text-center">No department data available.</p>';
              }
         }
    }


    // --- EVENT LISTENERS ---

    // Add Employee Form Submission
    if (addEmployeeForm) {
        addEmployeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("scripts.js: Add employee form submitted.");
            const formData = new FormData(addEmployeeForm);
            const newEmployee = Object.fromEntries(formData.entries());

            if (!newEmployee.name || !newEmployee.department || !newEmployee.position || !newEmployee.joining_date || !newEmployee.base_salary) {
                showNotification("Please fill in all employee fields.", true);
                return;
            }

             const submitButton = addEmployeeForm.querySelector('button[type="submit"]');
             if(submitButton) submitButton.disabled = true;

            try {
                const response = await fetch(`${API_BASE_URL}/employees`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newEmployee),
                    credentials: 'include'
                });
                 let data;
                 try {
                     data = await response.json();
                     console.log("scripts.js: Add employee response:", data);
                 } catch (jsonError) {
                     throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }

                if (!response.ok) {
                    throw new Error(data.error || `Failed to add employee (Status: ${response.status})`);
                }
                showNotification('Employee added successfully!');
                addEmployeeForm.reset();
                fetchEmployees();
                fetchDashboardStats();

            } catch (error) {
                console.error('Add employee error:', error);
                showNotification(`Error adding employee: ${error.message}`, true);
            } finally {
                 if(submitButton) submitButton.disabled = false;
            }
        });
    } else {
         console.warn("scripts.js: Add employee form not found.");
    }


    // Event Delegation for Edit and Delete buttons
    if (employeeTableBody) {
        employeeTableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return; 

            const action = button.dataset.action;
            const id = button.dataset.id;
            console.log(`scripts.js: Action "${action}" clicked for employee ID ${id}`);


            if (action === 'delete') {
                 if (!confirmModal || !confirmMessage || !confirmYesButton || !confirmNoButton) {
                     console.error("Confirmation modal elements not found!");
                     if(confirm("Are you sure you want to delete this employee? (Modal failed)")) {
                         await proceedWithDelete(id);
                     }
                     return;
                 }
                employeeToDeleteId = id;
                confirmMessage.textContent = `Are you sure you want to delete employee ID ${id}? This action cannot be undone.`;
                showConfirmModal(); // Use helper
            }
            else if (action === 'edit') {
                 if (!editModal || !editForm || !editUserIdSelect) {
                     console.error("Edit modal elements not found!");
                     alert("Cannot open edit form. Please refresh.");
                     return;
                 }
                try {
                     button.textContent = 'Loading...';
                     button.disabled = true;

                     editUserIdSelect.innerHTML = '<option value="">Loading users...</option>';
                     editUserIdSelect.disabled = true;

                     const usersResponse = await fetch(`${API_BASE_URL}/users/unlinked`, { credentials: 'include' });
                     if (!usersResponse.ok) {
                        throw new Error(`Failed to load unlinked users (${usersResponse.status})`);
                     }
                     const unlinkedUsers = await usersResponse.json();

                    const response = await fetch(`${API_BASE_URL}/employees/${id}?include_linked_user=true`, { credentials: 'include' });
                    if (!response.ok) {
                         if(response.status === 401 || response.status === 403) return;
                         let errorMsg = `Failed to load employee data (${response.status})`;
                         try {
                             const errorData = await response.json();
                             errorMsg = errorData.error || errorMsg;
                         } catch(e) { /* Ignore */ }
                        throw new Error(errorMsg);
                    }
                    const employee = await response.json();
                    console.log("scripts.js: Editing employee:", employee);

                    // Fill the edit form fields
                    // Use .elements for robust form filling
                    editForm.elements['employee_id'].value = employee.employee_id ?? '';
                    editForm.elements['name'].value = employee.name ?? '';
                    editForm.elements['department'].value = employee.department ?? '';
                    editForm.elements['position'].value = employee.position ?? '';
                    editForm.elements['joining_date'].value = (employee.joining_date ? employee.joining_date.split('T')[0] : '');
                    editForm.elements['base_salary'].value = employee.base_salary ?? '';

                    // Populate and set dropdown
                    editUserIdSelect.innerHTML = '';
                    editUserIdSelect.add(new Option('-- Unlinked --', ''));
                    
                    unlinkedUsers.forEach(user => {
                        editUserIdSelect.add(new Option(user.username, user.id));
                    });

                    const currentUserId = employee.user_id;
                    const currentUsername = employee.linked_username;
                    
                    if (currentUserId && currentUsername) {
                        const alreadyInList = unlinkedUsers.some(user => user.id === currentUserId);
                        if (!alreadyInList) {
                            editUserIdSelect.add(new Option(`${currentUsername} (Currently Linked)`, currentUserId));
                        }
                    }

                    editUserIdSelect.value = currentUserId || '';
                    editUserIdSelect.disabled = false;

                    showEditModal(); // Use helper

                } catch (error) {
                    console.error('Edit load error:', error);
                    showNotification(`Could not load employee data for editing: ${error.message}`, true);
                    editUserIdSelect.innerHTML = '<option value="">Error loading users</option>';
                } finally {
                     button.textContent = 'Edit';
                     button.disabled = false;
                     editUserIdSelect.disabled = false;
                }
            }
        });
    } else {
         console.warn("scripts.js: Employee table body not found for event delegation.");
    }

    // Function to handle deletion after confirmation
     async function proceedWithDelete(id) {
         if (!id) return;
         console.log(`scripts.js: Proceeding with delete for employee ID ${id}`);
         try {
             const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
                 method: 'DELETE',
                 credentials: 'include'
             });
             let data;
             try {
                 data = await response.json();
                 console.log("scripts.js: Delete response:", data);
             } catch (jsonError) {
                  throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
             }

             if (!response.ok) {
                 throw new Error(data.error || `Failed to delete employee (Status: ${response.status})`);
             }
             showNotification('Employee deleted successfully.');
             fetchEmployees(searchInput.value, departmentFilter.value);
             fetchDashboardStats();
         } catch (error) {
             console.error('Delete error:', error);
             showNotification(`Error deleting employee: ${error.message}`, true);
         } finally {
             employeeToDeleteId = null;
             hideConfirmModal(); // Use helper
         }
     }


    // Edit Form Submission
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = e.target.elements['employee_id'].value;
             console.log(`scripts.js: Edit form submitted for employee ID ${id}`);

            const updatedData = {
                name: e.target.elements['name'].value,
                department: e.target.elements['department'].value,
                position: e.target.elements['position'].value,
                joining_date: e.target.elements['joining_date'].value,
                base_salary: e.target.elements['base_salary'].value,
                user_id: e.target.elements['user_id'].value
            };

             if (!updatedData.name || !updatedData.department || !updatedData.position || !updatedData.joining_date || !updatedData.base_salary) {
                showNotification("Please fill in all employee fields.", true);
                return;
            }

             const saveButton = editForm.querySelector('button[type="submit"]');
             if(saveButton) saveButton.disabled = true;

            try {
                const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData),
                    credentials: 'include'
                });
                 let data;
                 try {
                     data = await response.json();
                      console.log("scripts.js: Edit response:", data);
                 } catch (jsonError) {
                     throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                 }

                if (!response.ok) {
                    throw new Error(data.error || `Failed to update employee (Status: ${response.status})`);
                }
                hideEditModal(); // Use helper
                showNotification(data.message || 'Employee updated successfully!');
                
                fetchEmployees(searchInput.value, departmentFilter.value); 
                fetchDashboardStats();
            } catch (error) {
                 console.error('Update error:', error);
                 if (error.message.includes("409")) {
                     showNotification("Update failed: This user account is already linked to another employee.", true);
                 } else {
                     showNotification(`Error updating employee: ${error.message}`, true);
                 }
            } finally {
                 if(saveButton) saveButton.disabled = false;
            }
        });
    } else {
         console.warn("scripts.js: Edit form not found.");
    }


    // --- MODAL CLOSING LISTENERS ---
    if (confirmYesButton) {
        confirmYesButton.addEventListener('click', () => proceedWithDelete(employeeToDeleteId));
    }
    if (confirmNoButton) {
        confirmNoButton.addEventListener('click', hideConfirmModal);
    }
    if (confirmModalBackdrop) {
        confirmModalBackdrop.addEventListener('click', hideConfirmModal);
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', hideEditModal);
    }
    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', hideEditModal);
    }
     if (editModalBackdrop) {
        editModalBackdrop.addEventListener('click', hideEditModal);
    }


    // Live Search Input (with Debounce)
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                 console.log("scripts.js: Search input changed, fetching...");
                 fetchEmployees(searchInput.value, departmentFilter.value);
            }, 300); // 300ms delay
        });
    } else {
         console.warn("scripts.js: Search input not found.");
    }


    // Department Filter Dropdown
    if (departmentFilter) {
        departmentFilter.addEventListener('change', () => {
             console.log("scripts.js: Department filter changed, fetching...");
             fetchEmployees(searchInput.value, departmentFilter.value);
        });
    } else {
         console.warn("scripts.js: Department filter not found.");
    }


    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log("scripts.js: Logout button clicked.");
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
         console.warn("scripts.js: Logout button not found.");
    }

    // --- INITIAL DATA LOAD ---
    console.log("scripts.js: Calling initial fetch functions inside runPageLogic.");
    setUsername(); // Set the username in the header
    fetchEmployees();
    fetchDashboardStats();

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);