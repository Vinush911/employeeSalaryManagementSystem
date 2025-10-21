document.addEventListener('DOMContentLoaded', function() {

    const apiUrl = 'http://127.0.0.1:5000/api/employees';
    const tableBody = document.getElementById('employee-table-body');
    // Get references to the form and the message element
    const addEmployeeForm = document.getElementById('add-employee-form');
    const formMessage = document.getElementById('form-message');

    /**
     * Fetches all employees from the API and populates the HTML table.
     */
    function fetchAndDisplayEmployees() {
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then(employees => {
                tableBody.innerHTML = ''; // Clear existing table rows
                if (employees.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No employees found.</td></tr>';
                    return;
                }
                // Loop through each employee and add them to the table
                employees.forEach(employee => {
                    const row = document.createElement('tr');
                    row.className = 'border-b border-gray-200 hover:bg-gray-100';
                    
                    const joiningDate = new Date(employee.joining_date).toLocaleDateString();
                    const formattedSalary = employee.base_salary.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

                    row.innerHTML = `
                        <td class="py-3 px-6 text-left whitespace-nowrap">${employee.employee_id}</td>
                        <td class="py-3 px-6 text-left font-medium">${employee.name}</td>
                        <td class="py-3 px-6 text-left">${employee.department}</td>
                        <td class="py-3 px-6 text-left">${employee.position}</td>
                        <td class="py-3 px-6 text-left">${joiningDate}</td>
                        <td class="py-3 px-6 text-right">${formattedSalary}</td>
                    `;
                    tableBody.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error fetching employee data:', error);
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500">Failed to load data. Is the backend server running?</td></tr>`;
            });
    }

    /**
     * Handles the submission of the 'add-employee-form'.
     */
    if (addEmployeeForm) {
        addEmployeeForm.addEventListener('submit', function(event) {
            // Prevent the default browser action of reloading the page on form submission
            event.preventDefault();

            // Create a FormData object from the form, then convert it to a plain JS object
            const formData = new FormData(addEmployeeForm);
            const employeeData = Object.fromEntries(formData.entries());

            // Send the new employee data to the backend API
            fetch(apiUrl, {
                method: 'POST', // Use the POST method to create a new resource
                headers: {
                    'Content-Type': 'application/json', // Inform the server that we are sending JSON data
                },
                body: JSON.stringify(employeeData), // Convert the JavaScript object to a JSON string
            })
            .then(response => response.json())
            .then(data => {
                if (data.employee_id) {
                    // If the server responds with a new employee ID, the creation was successful
                    formMessage.textContent = 'Employee added successfully!';
                    formMessage.className = 'mt-4 text-center text-green-600';
                    addEmployeeForm.reset(); // Clear the form fields for the next entry
                    fetchAndDisplayEmployees(); // Refresh the employee list to show the new employee
                } else {
                    // If there's an error message from the server, throw an error to be caught below
                    throw new Error(data.error || 'An unknown error occurred.');
                }
            })
            .catch(error => {
                // Display any errors to the user
                console.error('Error adding employee:', error);
                formMessage.textContent = `Error: ${error.message}`;
                formMessage.className = 'mt-4 text-center text-red-600';
            });
        });
    }

    // Initially call the function to load the employee data when the page first loads.
    fetchAndDisplayEmployees();
});

