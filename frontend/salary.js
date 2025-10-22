document.addEventListener('DOMContentLoaded', () => {
    const employeeNameHeader = document.getElementById('employee-name-header');
    const addSalaryForm = document.getElementById('add-salary-form');
    const salaryHistoryBody = document.getElementById('salary-history-body');
    const employeeIdInput = document.getElementById('employee-id');
    const baseSalaryInput = document.getElementById('base-salary');
    const formMessage = document.getElementById('salary-form-message');

    const urlParams = new URLSearchParams(window.location.search);
    const employeeId = urlParams.get('id');

    if (!employeeId) {
        window.location.href = 'index.html';
        return;
    }

    const formatCurrency = (amount) => amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formatMonth = (dateString) => new Date(dateString + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });

    async function fetchEmployeeDetails() {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/employees/${employeeId}`);
            if (!response.ok) throw new Error('Employee not found');
            const employee = await response.json();
            employeeNameHeader.textContent = `Salary for ${employee.name}`;
            employeeIdInput.value = employee.employee_id;
            baseSalaryInput.value = employee.base_salary;
        } catch (error) {
            employeeNameHeader.textContent = 'Could not load employee details.';
        }
    }

    async function fetchAndDisplaySalaries() {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/employees/${employeeId}/salaries`);
            if (!response.ok) throw new Error('Could not fetch salaries');
            const salaries = await response.json();

            salaryHistoryBody.innerHTML = '';
            if (salaries.length === 0) {
                salaryHistoryBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">No salary records found.</td></tr>`;
                return;
            }
            salaries.forEach(salary => {
                const row = document.createElement('tr');
                row.className = 'border-b';
                row.innerHTML = `
                    <td class="py-3 px-6 text-left">${formatMonth(salary.month)}</td>
                    <td class="py-3 px-6 text-right">${formatCurrency(baseSalaryInput.value)}</td>
                    <td class="py-3 px-6 text-right text-green-600">${formatCurrency(salary.overtime_pay)}</td>
                    <td class="py-3 px-6 text-right text-green-600">${formatCurrency(salary.bonus)}</td>
                    <td class="py-3 px-6 text-right text-red-600">-${formatCurrency(salary.deductions)}</td>
                    <td class="py-3 px-6 text-right text-red-600">-${formatCurrency(salary.pf_amount)}</td>
                    <td class="py-3 px-6 text-right font-bold">${formatCurrency(salary.total_salary)}</td>
                    <td class="py-3 px-6 text-center">
                        <a href="slip.html?id=${salary.salary_id}" target="_blank" class="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded-md">
                            Download Slip
                        </a>
                    </td>
                `;
                salaryHistoryBody.appendChild(row);
            });
        } catch (error) {
            salaryHistoryBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-red-500">Error loading salary data.</td></tr>`;
        }
    }

    addSalaryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addSalaryForm);
        const salaryData = {
            employee_id: employeeId,
            month: formData.get('month'),
            overtime_hours: formData.get('overtime_hours'),
            overtime_pay: formData.get('overtime_pay'),
            bonus: formData.get('bonus'),
            deductions: formData.get('deductions'),
            pf_amount: formData.get('pf_amount'),
            base_salary: baseSalaryInput.value
        };

        try {
            const response = await fetch('http://127.0.0.1:5000/api/salaries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(salaryData),
            });
            if (!response.ok) throw new Error('Failed to add record');
            formMessage.textContent = 'Salary added successfully!';
            formMessage.className = 'mt-4 text-center text-green-600';
            addSalaryForm.reset();
            fetchAndDisplaySalaries();
        } catch (error) {
            formMessage.textContent = 'Error adding salary record.';
            formMessage.className = 'mt-4 text-center text-red-600';
        }
    });
    
    // Initial Load
    fetchEmployeeDetails();
    fetchAndDisplaySalaries();
});

