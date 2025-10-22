// This ensures the page is protected
document.addEventListener('DOMContentLoaded', () => {
    // Check auth status first
    fetch('/api/check-auth', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (!data.logged_in) {
                window.location.href = 'login.html';
            } else {
                // If logged in, run the page logic
                runSlipLogic();
            }
        });
});

function runSlipLogic() {
    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // Get salary ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const salaryId = urlParams.get('salary_id');

    if (!salaryId) {
        document.body.innerHTML = '<h1>Error: No Salary ID provided.</h1><a href="index.html">Back to Dashboard</a>';
        return;
    }

    // --- HELPER FUNCTIONS ---
    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
    
    const formatMonthYear = (dateString) => {
        if (!dateString) return 'Invalid Date';
        const date = new Date(dateString + 'T00:00:00'); // Fix for timezone issues
        return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    };

    // --- DATA FETCHING AND POPULATING ---
    async function fetchAndPopulateSlip() {
        try {
            const response = await fetch(`${API_BASE_URL}/salaries/${salaryId}`, { credentials: 'include' });
            if (!response.ok) throw new Error('Failed to fetch salary slip data');
            const data = await response.json();

            // Populate Employee Details
            document.getElementById('slip-pay-period').textContent = formatMonthYear(data.month);
            document.getElementById('slip-employee-name').textContent = data.name;
            document.getElementById('slip-department').textContent = data.department;
            document.getElementById('slip-position').textContent = data.position;

            // Populate Earnings
            const base = data.base_salary || 0;
            const overtime = data.overtime_pay || 0;
            const bonus = data.bonus || 0;
            const totalEarnings = base + overtime + bonus;

            document.getElementById('slip-base-salary').textContent = formatCurrency(base);
            document.getElementById('slip-overtime-pay').textContent = formatCurrency(overtime);
            document.getElementById('slip-bonus').textContent = formatCurrency(bonus);
            document.getElementById('slip-total-earnings').textContent = formatCurrency(totalEarnings);

            // Populate Deductions
            const deductions = data.deductions || 0;
            const pf = data.pf_amount || 0;
            const totalDeductions = deductions + pf;

            document.getElementById('slip-deductions').textContent = formatCurrency(deductions);
            document.getElementById('slip-pf').textContent = formatCurrency(pf);
            document.getElementById('slip-total-deductions').textContent = formatCurrency(totalDeductions);

            // Populate Net Salary
            const netSalary = data.total_salary;
            document.getElementById('slip-net-salary').textContent = formatCurrency(netSalary);
            
            // Trigger print dialog automatically
            // We use a small timeout to ensure all content is rendered before printing
            setTimeout(() => {
                window.print();
            }, 500);

        } catch (error) {
            console.error('Error fetching salary slip:', error);
            document.getElementById('salary-slip-content').innerHTML = `<h1 class="text-red-500">Error: ${error.message}</h1>`;
        }
    }

    // --- INITIAL LOAD ---
    fetchAndPopGopulateSlip();
}

