// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Salary Slip page (slip.html) ---
function runPageLogic() {
    console.log("slip.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    // Get all the span elements where data will be displayed
    const slipPayPeriodEl = document.getElementById('slip-pay-period');
    const slipPayDateEl = document.getElementById('slip-pay-date');
    const slipEmployeeNameEl = document.getElementById('slip-employee-name');
    const slipEmployeeIdEl = document.getElementById('slip-employee-id');
    const slipDepartmentEl = document.getElementById('slip-department');
    const slipPositionEl = document.getElementById('slip-position');
    const slipNetPayEl = document.getElementById('slip-net-pay');
    const slipNetPayWordsEl = document.getElementById('slip-net-pay-words');
    const slipBaseSalaryEl = document.getElementById('slip-base-salary');
    const slipOvertimePayEl = document.getElementById('slip-overtime-pay');
    const slipBonusEl = document.getElementById('slip-bonus');
    const slipTotalEarningsEl = document.getElementById('slip-total-earnings');
    const slipDeductionsEl = document.getElementById('slip-deductions');
    const slipPfEl = document.getElementById('slip-pf');
    const slipTotalDeductionsEl = document.getElementById('slip-total-deductions');

    // Basic check if critical elements are missing
    if (!slipPayPeriodEl || !slipEmployeeNameEl || !slipNetPayEl) {
        console.error("slip.js: Critical slip elements not found!");
        document.body.innerHTML = '<h1 class="text-red-500 p-4">Error: Page elements missing. Cannot display slip.</h1>';
        return;
    }


    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // Get salary ID from the URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const salaryId = urlParams.get('salary_id');

    if (!salaryId) {
        console.error("slip.js: No salary_id found in URL."); // Add log
        document.body.innerHTML = '<h1 class="text-red-500 p-4">Error: No Salary ID provided in the URL.</h1>';
        return;
    }
     console.log(`slip.js: Fetching slip data for salary_id: ${salaryId}`); // Add log


    // --- HELPER FUNCTIONS ---
    // Updated formatCurrency
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : '₹0.00';

    // Updated formatDate
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString + 'T00:00:00');
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch (e) { return 'N/A'; }
    };

    // Updated formatMonthYear
    const formatMonthYear = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString + 'T00:00:00');
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        } catch (e) { return 'N/A'; }
    };

    // Helper function to convert number to words (simple version)
    // You can replace this with a more robust library if needed
    function toWords(num) {
        const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        // Ensure num is treated as a number and handle potential errors
        const numAsNumber = Number(num);
        if (isNaN(numAsNumber) || num == null) return "Zero"; // Default to Zero if invalid

        const numStr = Math.round(numAsNumber).toString();

        // Handle large numbers - adjust limit as needed
        if (numAsNumber > 999999999) return 'Number too large';

        // Split integer and decimal parts correctly
        const parts = numAsNumber.toFixed(2).split('.');
        const integerPart = parseInt(parts[0], 10);
        const decimalPart = parseInt(parts[1], 10);

        if (integerPart === 0 && decimalPart === 0) return 'Zero'; // Handle zero amount

        const numToWordsRecursive = (n) => {
            if (n === 0) return ''; // Base case for recursion
            let str = '';
            const crore = Math.floor(n / 10000000);
            if (crore > 0) {
                str += numToWordsRecursive(crore) + ' crore ';
                n %= 10000000;
            }
            const lakh = Math.floor(n / 100000);
            if (lakh > 0) {
                str += numToWordsRecursive(lakh) + ' lakh ';
                n %= 100000;
            }
            const thousand = Math.floor(n / 1000);
            if (thousand > 0) {
                str += numToWordsRecursive(thousand) + ' thousand ';
                n %= 1000;
            }
            const hundred = Math.floor(n / 100);
            if (hundred > 0) {
                str += numToWordsRecursive(hundred) + ' hundred ';
                n %= 100;
            }
            if (n > 0) {
                if (str !== '' && str.slice(-1) !== ' ') str += ' '; // Add space if needed
                 // No "and" needed for Indian numbering style usually
                if (n < 20) {
                    str += a[n];
                } else {
                    str += b[Math.floor(n / 10)];
                    if (n % 10 > 0) {
                        str += '-' + a[n % 10];
                    }
                }
            }
            return str.trim(); // Trim extra spaces
        };

        let words = numToWordsRecursive(integerPart);
        if (words === '') words = 'Zero'; // Handle case where integer part is 0 but decimal isn't

        if (decimalPart > 0) {
            words += ' and ' + numToWordsRecursive(decimalPart) + ' paise';
        }
        words += ' only';
        // Capitalize first letter
        return words.charAt(0).toUpperCase() + words.slice(1);
    }


    // --- DATA FETCHING & RENDERING ---
    async function fetchSalarySlipData() {
        console.log("slip.js: fetchSalarySlipData() called."); // Add log
        // Set loading states
        slipPayPeriodEl.textContent = 'Loading...';
        slipEmployeeNameEl.textContent = 'Loading...';
        slipNetPayEl.textContent = 'Loading...';
        // ... set loading for other elements if desired

        try {
            const response = await fetch(`${API_BASE_URL}/salaries/${salaryId}`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) {
                    console.error("fetchSalarySlipData: Unauthorized (401). Should have been redirected by auth.js.");
                    document.body.innerHTML = '<h1 class="text-red-500 p-4">Error: Unauthorized. Please log in again.</h1>';
                    return;
                }
                 // Try to get error message from backend
                let errorMsg = `Failed to fetch salary slip data (Status: ${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) { /* Ignore if response isn't JSON */ }
                throw new Error(errorMsg);
            }
            const slip = await response.json();
            console.log("slip.js: Slip data received:", slip); // Add log

            // Ensure slip data exists
            if (!slip) {
                throw new Error("Received empty salary slip data from server.");
            }

            // Populate Employee Details (using ?? nullish coalescing for defaults)
            slipPayPeriodEl.textContent = formatMonthYear(slip.month);
            slipPayDateEl.textContent = formatDate(new Date().toISOString().split('T')[0]); // Use today's date
            slipEmployeeNameEl.textContent = slip.name ?? 'N/A';
            slipEmployeeIdEl.textContent = slip.employee_id ?? 'N/A';
            slipDepartmentEl.textContent = slip.department ?? 'N/A';
            slipPositionEl.textContent = slip.position ?? 'N/A';

            // Populate Earnings
            const baseSalary = slip.base_salary ?? 0;
            const overtimePay = slip.overtime_pay ?? 0;
            const bonus = slip.bonus ?? 0;
            const totalEarnings = baseSalary + overtimePay + bonus;

            slipBaseSalaryEl.textContent = formatCurrency(baseSalary);
            slipOvertimePayEl.textContent = formatCurrency(overtimePay);
            slipBonusEl.textContent = formatCurrency(bonus);
            slipTotalEarningsEl.textContent = formatCurrency(totalEarnings);

            // Populate Deductions
            const deductions = slip.deductions ?? 0;
            const pfAmount = slip.pf_amount ?? 0;
            const totalDeductions = deductions + pfAmount;

            slipDeductionsEl.textContent = formatCurrency(deductions);
            slipPfEl.textContent = formatCurrency(pfAmount);
            slipTotalDeductionsEl.textContent = formatCurrency(totalDeductions);

            // Populate Summary
            const totalSalary = slip.total_salary ?? 0; // Use total calculated by DB trigger
            slipNetPayEl.textContent = formatCurrency(totalSalary);
            slipNetPayWordsEl.textContent = `(Rupees ${toWords(totalSalary)})`;

            // --- IMPORTANT: Trigger print AFTER data is populated ---
            // Use a small timeout to allow the browser to render the updated content
            setTimeout(() => {
                 console.log("slip.js: Attempting to print..."); // Add log
                 try {
                     window.print();
                     console.log("slip.js: Print dialog should be open."); // Add log
                 } catch (printError) {
                     console.error("slip.js: Error opening print dialog:", printError);
                     alert("Could not automatically open print dialog. Please use your browser's print function (Ctrl+P or Cmd+P).");
                 }
            }, 500); // 500ms delay - adjust if needed


        } catch (error) {
            console.error('Error fetching or displaying slip data:', error);
            // Display a user-friendly error on the page
             document.body.innerHTML = `<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                                            <h1 class="font-bold">Error Loading Salary Slip</h1>
                                            <p>${error.message}</p>
                                            <p class="mt-2 text-sm">Please check the Salary ID or try again later.</p>
                                        </div>`;

        }
    } // --- End of fetchSalarySlipData ---

    // --- INITIAL DATA LOAD ---
    console.log("slip.js: Calling fetchSalarySlipData inside runPageLogic."); // Add log
    fetchSalarySlipData();

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);

