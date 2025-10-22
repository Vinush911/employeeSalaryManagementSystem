document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const employeeTableBody = document.getElementById('employee-table-body');
    const addEmployeeForm = document.getElementById('add-employee-form');
    const searchInput = document.getElementById('search-input');
    const departmentFilter = document.getElementById('department-filter');
    const departmentChartCanvas = document.getElementById('department-chart');
    
    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const closeModalButton = document.getElementById('close-modal');
    const cancelEditButton = document.getElementById('cancel-edit');

    // Notification and Confirmation Elements
    const notificationToast = document.getElementById('notification-toast');
    const notificationMessage = document.getElementById('notification-message');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYesButton = document.getElementById('confirm-yes');
    const confirmNoButton = document.getElementById('confirm-no');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let departmentChart = null; // To hold the chart instance
    let employeeToDeleteId = null; // To hold the ID of the employee to be deleted

    // --- HELPER FUNCTIONS ---
    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
    const formatDate = (dateString) => dateString ? new Date(dateString.split(' ')[0]).toLocaleDateString('en-GB') : 'N/A'; // Handles YYYY-MM-DD format

    const showNotification = (message, isError = false) => {
        notificationMessage.textContent = message;
        notificationToast.classList.remove('hidden');
        if (isError) {
            notificationToast.classList.add('bg-red-500');
            notificationToast.classList.remove('bg-green-500');
        } else {
            notificationToast.classList.add('bg-green-500');
            notificationToast.classList.remove('bg-red-500');
        }
        setTimeout(() => {
            notificationToast.classList.add('hidden');
        }, 3000);
    };

    // --- DATA FETCHING & RENDERING ---
    async function fetchEmployees(searchTerm = '', department = '') {
        try {
            const response = await fetch(`${API_BASE_URL}/employees?search=${searchTerm}&department=${department}`, {
                credentials: 'include' 
            });
            if (!response.ok) {
                // If unauthorized, the auth.js script will handle redirection
                if(response.status === 401) return; 
                throw new Error('Failed to fetch data');
            }
            const data = await response.json();

            // Populate table
            employeeTableBody.innerHTML = ''; // Clear existing rows
            if (data.employees.length === 0) {
                employeeTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4">No employees found.</td></tr>`;
            } else {
                data.employees.forEach(emp => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="py-2 px-4 border-b">${emp.employee_id}</td>
                        <td class="py-2 px-4 border-b">${emp.name}</td>
                        <td class="py-2 px-4 border-b">${emp.department}</td>
                        <td class="py-2 px-4 border-b">${emp.position}</td>
                        <td class="py-2 px-4 border-b">${formatDate(emp.joining_date)}</td>
                        <td class="py-2 px-4 border-b text-right">${formatCurrency(emp.base_salary)}</td>
                        <td class="py-2 px-4 border-b text-center space-x-1">
                            <a href="attendance.html?employee_id=${emp.employee_id}" class="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold py-1 px-2 rounded">Attendance</a>
                            <a href="salary.html?employee_id=${emp.employee_id}" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-2 rounded">Salary</a>
                            <button data-action="edit" data-id="${emp.employee_id}" class="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded">Edit</button>
                            <button data-action="delete" data-id="${emp.employee_id}" class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2 rounded">Delete</button>
                        </td>
                    `;
                    employeeTableBody.appendChild(row);
                });
            }
            
            // Populate department filter
            if (departmentFilter.options.length <= 1) { // Only populate once
                 data.departments.forEach(dep => {
                    const option = document.createElement('option');
                    option.value = dep;
                    option.textContent = dep;
                    departmentFilter.appendChild(option);
                });
            }
            
            // Render Chart
            renderDepartmentChart(data.employees);

        } catch (error) {
            showNotification('Failed to load data. Is the backend running?', true);
            console.error('Fetch error:', error);
        }
    }

    // --- CHART RENDERING ---
    function renderDepartmentChart(employees) {
        const departmentCounts = employees.reduce((acc, emp) => {
            acc[emp.department] = (acc[emp.department] || 0) + 1;
            return acc;
        }, {});

        const chartData = {
            labels: Object.keys(departmentCounts),
            datasets: [{
                label: 'Employees per Department',
                data: Object.values(departmentCounts),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(153, 102, 255, 0.6)'
                ]
            }]
        };

        if (departmentChart) {
            departmentChart.destroy(); // Destroy old chart before creating a new one
        }

        departmentChart = new Chart(departmentChartCanvas, {
            type: 'pie',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    // --- EVENT LISTENERS ---

    // Add Employee
    addEmployeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addEmployeeForm);
        const newEmployee = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`${API_BASE_URL}/employees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newEmployee),
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to add employee');
            showNotification('Employee added successfully!');
            addEmployeeForm.reset();
            fetchEmployees();
        } catch (error) {
            showNotification('Error adding employee.', true);
            console.error('Add error:', error);
        }
    });

    // Edit and Delete Buttons
    employeeTableBody.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        const id = e.target.dataset.id;
        if (!action) return;

        if (action === 'delete') {
            employeeToDeleteId = id;
            confirmMessage.textContent = `Are you sure you want to delete this employee? This action cannot be undone.`;
            confirmModal.classList.remove('hidden');
        } else if (action === 'edit') {
            try {
                const response = await fetch(`${API_BASE_URL}/employees/${id}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Failed to fetch employee data');
                const employee = await response.json();
                
                // Populate the edit form
                editForm.elements['employee_id'].value = employee.employee_id;
                editForm.elements['name'].value = employee.name;
                editForm.elements['department'].value = employee.department;
                editForm.elements['position'].value = employee.position;
                editForm.elements['joining_date'].value = employee.joining_date.split(' ')[0];
                editForm.elements['base_salary'].value = employee.base_salary;
                
                editModal.classList.remove('hidden');
            } catch (error) {
                showNotification('Could not load employee data for editing.', true);
                console.error('Edit load error:', error);
            }
        }
    });
    
    // Edit Form Submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = e.target.elements['employee_id'].value;
        const updatedData = {
            name: e.target.elements['name'].value,
            department: e.target.elements['department'].value,
            position: e.target.elements['position'].value,
            joining_date: e.target.elements['joining_date'].value,
            base_salary: e.target.elements['base_salary'].value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/employees/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData),
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to update employee');
            editModal.classList.add('hidden');
            showNotification('Employee updated successfully!');
            fetchEmployees();
        } catch (error) {
            showNotification('Error updating employee.', true);
            console.error('Update error:', error);
        }
    });

    // Confirmation Modal Logic
    confirmYesButton.addEventListener('click', async () => {
        if (employeeToDeleteId) {
            try {
                const response = await fetch(`${API_BASE_URL}/employees/${employeeToDeleteId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to delete employee');
                showNotification('Employee deleted successfully.');
                fetchEmployees();
            } catch (error) {
                showNotification('Error deleting employee.', true);
                console.error('Delete error:', error);
            } finally {
                employeeToDeleteId = null;
                confirmModal.classList.add('hidden');
            }
        }
    });

    confirmNoButton.addEventListener('click', () => {
        employeeToDeleteId = null;
        confirmModal.classList.add('hidden');
    });

    // Modal Closing Buttons
    closeModalButton.addEventListener('click', () => editModal.classList.add('hidden'));
    cancelEditButton.addEventListener('click', () => editModal.classList.add('hidden'));

    // Live Search and Filter
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            fetchEmployees(searchInput.value, departmentFilter.value);
        }, 300); // Debounce to avoid excessive API calls
    });
    departmentFilter.addEventListener('change', () => {
        fetchEmployees(searchInput.value, departmentFilter.value);
    });

    // Logout Button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await fetch(`${API_BASE_URL}/logout`, { method: 'POST', credentials: 'include' });
            window.location.href = 'login.html';
        });
    }

    // --- INITIAL LOAD ---
    // The auth.js script runs first and validates the session.
    // If the session is valid, then we can fetch the employees.
    fetchEmployees();
});

