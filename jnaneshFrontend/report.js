// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Reports page (report.html) ---
function runPageLogic() {
    console.log("report.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    const reportTableBody = document.getElementById('report-table-body');
    const chartCanvas = document.getElementById('average-salary-chart');
    const chartError = document.getElementById('chart-error');
    const tableError = document.getElementById('table-error');
    const logoutButton = document.getElementById('logout-button');
    const usernameDisplay = document.getElementById('username-display'); // For header

    // === FIX: Added selectors for the New Hires chart ===
    const newHiresChartCanvas = document.getElementById('new-hires-chart');
    const newHiresChartError = document.getElementById('new-hires-chart-error');
    // === END FIX ===

    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let myChart = null; // Variable to hold the bar chart instance
    // === FIX: Added variable for line chart ===
    let newHiresChart = null; 
    // === END FIX ===

    // --- HELPER: Set Username ---
    async function setUsername() {
        if (!usernameDisplay) {
             console.warn("report.js: Username display element not found.");
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
                        console.log("report.js: Username set in header:", data.username);
                    } else {
                         usernameDisplay.textContent = 'Admin'; // Fallback
                    }
                } else {
                     usernameDisplay.textContent = 'Error';
                }
            } catch (error) {
                console.error("report.js: Error fetching username for header:", error);
                usernameDisplay.textContent = 'Error';
            }
        }
    }

    // --- HELPER FUNCTIONS ---
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : 'N/A';

    // === FIX: Added robust formatMonthYear helper for the new chart ===
    const formatMonthYear = (dateString) => {
        if (!dateString) return 'Invalid Date';
        try {
            // Robust parsing for 'YYYY-MM-DD'
            const parts = dateString.split('-');
            if (parts.length < 2) return 'Invalid Date';
            const date = new Date(parts[0], parts[1] - 1, 1); // Use 1st day

            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Invalid Date';
        }
    };
    // === END FIX ===


    // --- DATA FETCHING & RENDERING ---
    async function fetchReportData() {
        console.log("report.js: fetchReportData() called."); // Add log
        if (!reportTableBody || !chartCanvas || !chartError || !tableError) {
             console.error("Report page elements (bar chart/table) not found!");
             return;
        }

        chartError.textContent = '';
        tableError.textContent = 'Loading data...'; // Set loading text
        reportTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">Loading report data...</td></tr>`;

        try {
            const response = await fetch(`${API_BASE_URL}/reports/department-salaries`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) {
                    console.error("fetchReportData: Unauthorized (401).");
                    return; 
                }
                let errorMsg = `Failed to fetch report data (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log("report.js: Report data received:", data); // Add log

            if (!data || data.length === 0) {
                 console.log("report.js: No report data available."); // Add log
                 chartError.textContent = 'No report data available to display.';
                 tableError.textContent = 'No report data available.';
                 reportTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">No report data found.</td></tr>`;
                 if (myChart) { myChart.destroy(); myChart = null; }
                return;
            }

            // Populate table
            reportTableBody.innerHTML = ''; // Clear loading message
            tableError.textContent = ''; // Clear error
            data.forEach(item => {
                const row = document.createElement('tr');
                 row.innerHTML = `
                    <td class="py-2 px-4 border-b">${item.department ?? 'N/A'}</td>
                    <td class="py-2 px-4 border-b text-center">${item.employee_count ?? 0}</td>
                    <td class="py-2 px-4 border-b text-right">${formatCurrency(item.average_salary)}</td>
                `;
                reportTableBody.appendChild(row);
            });

            // Prepare chart data
            const labels = data.map(item => item.department ?? 'Unknown');
            const chartData = data.map(item => item.average_salary ?? 0);

            // Render chart
            if (myChart) {
                myChart.destroy(); 
            }
            
            const chartCtx = chartCanvas.getContext('2d');
            if (!chartCtx) {
                 console.error("report.js: Failed to get bar chart context");
                 return;
            }

            try {
                 myChart = new Chart(chartCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Average Salary by Department',
                            data: chartData,
                            backgroundColor: 'rgba(54, 162, 235, 0.7)', 
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1,
                             barThickness: 'flex',
                             maxBarThickness: 50 
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false, 
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: (value) => formatCurrency(value),
                                     padding: 10 
                                }
                            },
                             x: {
                                ticks: {
                                    maxRotation: 0, 
                                    minRotation: 0,
                                     autoSkip: true, 
                                     maxTicksLimit: 10 
                                }
                             }
                        },
                        plugins: {
                            legend: {
                                display: false 
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) => `Avg Salary: ${formatCurrency(context.raw)}`
                                }
                            }
                        },
                        layout: {
                            padding: {
                                top: 10,
                                right: 20,
                                bottom: 10,
                                left: 10
                            }
                        }
                    }
                });
                console.log("report.js: Bar chart rendered successfully."); // Add log
            } catch(chartRenderError) {
                 console.error("report.js: Error rendering Chart.js (bar):", chartRenderError);
                 chartError.textContent = 'Error displaying chart.';
            }

        } catch (error) {
            console.error('Error fetching report data:', error);
            chartError.textContent = 'Failed to load chart data.';
            tableError.textContent = 'Failed to load report data.';
            reportTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">Error loading report.</td></tr>`;
            if (myChart) { myChart.destroy(); myChart = null; }
        }
    }

    // === FIX: Added fetchNewHiresReport function ===
    async function fetchNewHiresReport() {
        console.log("report.js: fetchNewHiresReport() called.");
        if (!newHiresChartCanvas || !newHiresChartError) {
            console.error("New hires chart elements not found!");
            return;
        }
        newHiresChartError.textContent = 'Loading chart data...';

        try {
            const response = await fetch(`${API_BASE_URL}/reports/new-hires`, { credentials: 'include' });
            if (!response.ok) {
                if (response.status === 401) return; // Auth handled
                let errorMsg = `Failed to fetch new hires report (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log("report.js: New hires data received:", data);

            if (!data || data.length === 0) {
                newHiresChartError.textContent = 'No new hire data available to display.';
                if (newHiresChart) { newHiresChart.destroy(); newHiresChart = null; } // Clear old chart
                return;
            }
            
            newHiresChartError.textContent = ''; // Clear loading message
            renderNewHireChart(data); // Call the render function

        } catch (error) {
            console.error('Error fetching new hires report:', error);
            newHiresChartError.textContent = `Failed to load new hires chart: ${error.message}`;
            if (newHiresChart) { newHiresChart.destroy(); newHiresChart = null; } // Clear old chart
        }
    }
    // === END FIX ===

    // === FIX: Added renderNewHireChart function ===
    function renderNewHireChart(data) {
        // Format labels from 'YYYY-MM-DD' to 'Month Year'
        const labels = data.map(item => formatMonthYear(item.hire_month));
        const chartData = data.map(item => item.hire_count);

        if (newHiresChart) {
            newHiresChart.destroy(); // Destroy old instance
        }
        
        const chartCtx = newHiresChartCanvas.getContext('2d');
        if (!chartCtx) {
             console.error("report.js: Failed to get line chart context");
             return;
        }

        try {
            newHiresChart = new Chart(chartCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'New Hires',
                        data: chartData,
                        fill: true, // Make it an area chart
                        backgroundColor: 'rgba(75, 192, 192, 0.2)', // Greenish
                        borderColor: 'rgba(75, 192, 192, 1)',
                        tension: 0.1 // Slight curve
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1, // Only whole numbers for "hires"
                                callback: (value) => { if (value % 1 === 0) return value; } // Show only integers
                            }
                        },
                        x: {
                             ticks: {
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 12 // Limit number of date labels
                             }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.raw} new hires`
                            }
                        }
                    }
                }
            });
             console.log("report.js: New hires chart rendered successfully.");
        } catch (chartRenderError) {
            console.error("report.js: Error rendering new hires chart:", chartRenderError);
            newHiresChartError.textContent = 'Error displaying new hires chart.';
        }
    }
    // === END FIX ===


    // --- EVENT LISTENERS ---

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("report.js: Logout button clicked."); // Add log
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
        console.warn("report.js: Logout button not found."); // Add log
    }

    // --- INITIAL DATA LOAD ---
    console.log("report.js: Calling initial fetch functions inside runPageLogic."); // Add log
    setUsername(); // --- FIX: Call setUsername ---
    fetchReportData();
    fetchNewHiresReport(); // --- FIX: Call the new function ---

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);