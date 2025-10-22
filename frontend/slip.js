document.addEventListener('DOMContentLoaded', () => {
    const slipMonth = document.getElementById('slip-month');
    const empName = document.getElementById('emp-name');
    const empDepartment = document.getElementById('emp-department');
    const empPosition = document.getElementById('emp-position');
    const salaryIdEl = document.getElementById('salary-id');
    
    // Earnings
    const earnBase = document.getElementById('earn-base');
    const earnOvertime = document.getElementById('earn-overtime');
    const earnBonus = document.getElementById('earn-bonus');
    const totalEarnings = document.getElementById('total-earnings');

    // Deductions
    const deductStandard = document.getElementById('deduct-standard');
    const deductPf = document.getElementById('deduct-pf');
    const totalDeductions = document.getElementById('total-deductions');
    
    // Net
    const netSalary = document.getElementById('net-salary');

    const urlParams = new URLSearchParams(window.location.search);
    const salaryId = urlParams.get('id');

    if (!salaryId) {
        document.body.innerHTML = '<h1 class="text-red-500 text-center mt-10">Error: Salary ID not provided.</h1>';
        return;
    }

    const formatCurrency = (amount) => {
        // Ensure amount is a number, default to 0 if not
        const numericAmount = Number(amount) || 0;
        return numericAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    };

    const formatMonth = (dateString) => {
        // Add a day to the YYYY-MM string to ensure correct parsing
        return new Date(dateString + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });
    };


    async function fetchAndRenderSlip() {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/salaries/${salaryId}`);
            if (!response.ok) throw new Error('Could not fetch salary slip data.');
            const data = await response.json();

            // Populate Header and Employee Info
            slipMonth.textContent = formatMonth(data.month);
            empName.textContent = data.name;
            empDepartment.textContent = data.department;
            empPosition.textContent = data.position;
            salaryIdEl.textContent = `#${data.salary_id}`;

            // Populate Earnings
            const totalEarn = (Number(data.base_salary) || 0) + (Number(data.overtime_pay) || 0) + (Number(data.bonus) || 0);
            earnBase.textContent = formatCurrency(data.base_salary);
            earnOvertime.textContent = formatCurrency(data.overtime_pay);
            earnBonus.textContent = formatCurrency(data.bonus);
            totalEarnings.textContent = formatCurrency(totalEarn);
            
            // Populate Deductions
            const totalDeduct = (Number(data.deductions) || 0) + (Number(data.pf_amount) || 0);
            deductStandard.textContent = formatCurrency(data.deductions);
            deductPf.textContent = formatCurrency(data.pf_amount);
            totalDeductions.textContent = formatCurrency(totalDeduct);

            // Populate Net Salary
            netSalary.textContent = formatCurrency(data.total_salary);
            
            // Trigger print dialog after a short delay to allow content to render
            setTimeout(() => {
                window.print();
            }, 500);

        } catch (error) {
            document.getElementById('slip-content').innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
        }
    }

    fetchAndRenderSlip();
});

