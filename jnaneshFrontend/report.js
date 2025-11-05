// NO auth check or role check logic here. auth.js handles it.

// --- Main function for the Reports page (reports.html) ---
function runPageLogic() {
    console.log("reports.js: runPageLogic() started."); // Add log

    // --- ELEMENT SELECTORS ---
    const reportTableBody = document.getElementById('report-table-body');
    const chartCanvas = document.getElementById('average-salary-chart');
    const chartError = document.getElementById('chart-error');
    const tableError = document.getElementById('table-error');
    const logoutButton = document.getElementById('logout-button');

    // --- NEW: Selectors for new hires chart ---
    const newHiresChartCanvas = document.getElementById('new-hires-chart');
    const newHiresChartError = document.getElementById('new-hires-chart-error');

    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let myChart = null; // Variable to hold the bar chart instance
    // --- NEW: Variable for line chart instance ---
    let newHiresChart = null; 

    // --- HELPER FUNCTIONS ---
    // Updated formatCurrency to handle null/undefined
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : 'N/A';

    // --- NEW: formatMonthYear helper (ROBUST VERSION) ---
    const formatMonthYear = (dateString) => {
        if (!dateString) return 'Invalid Date';
        try {
            // Robust parsing for 'YYYY-MM-DD'
            const parts = dateString.split('-');
            if (parts.length !== 3) return 'Invalid Date';
            
            // new Date(year, monthIndex, day)
            // parts[1] - 1 because months are 0-indexed
            const date = new Date(parts[0], parts[1] - 1, parts[2]);
            
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Invalid Date';
        }
    };


    // --- DATA FETCHING & RENDERING ---
    async function fetchReportData() {
        console.log("reports.js: fetchReportData() called."); // Add log
        // Ensure elements exist
        if (!reportTableBody || !chartCanvas || !chartError || !tableError) {
             console.error("Report page elements (bar chart/table) not found!");
             return;
        }

        // Clear previous errors/data
        chartError.textContent = '';
        tableError.textContent = '';
        reportTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">Loading report data...</td></tr>`; // Show loading state in table

        try {
            const response = await fetch(`${API_BASE_URL}/reports/department-salaries`, { credentials: 'include' });
            if (!response.ok) {
                 if(response.status === 401) {
                    console.error("fetchReportData: Unauthorized (401). Should have been redirected by auth.js.");
                    // window.location.href = 'login.html'; // Fallback redirect
                    return; // Stop execution
                }
                // Try to get error message from backend
                let errorMsg = `Failed to fetch report data (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch(e) { /* Ignore if response isn't JSON */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            console.log("reports.js: Report data received:", data); // Add log

            if (!data || data.length === 0) {
                 console.log("reports.js: No report data available."); // Add log
                 chartError.textContent = 'No report data available to display.';
                 tableError.textContent = 'No report data available.';
                 reportTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-gray-500">No report data found.</td></tr>`;
                 // Destroy old chart if it exists
                 if (myChart) { myChart.destroy(); myChart = null; }
                return;
            }

            // Populate table
            reportTableBody.innerHTML = ''; // Clear loading message
            data.forEach(item => {
                const row = document.createElement('tr');
                 // Add null checks for safety
                row.innerHTML = `
                    <td class="py-2 px-4 border-b">${item.department ?? 'N/A'}</td>
                    <td class="py-2 px-4 border-b text-center">${item.employee_count ?? 0}</td>
                    <td class="py-2 px-4 border-b text-right">${formatCurrency(item.average_salary)}</td>
                `;
                reportTableBody.appendChild(row);
            });

            // Prepare chart data
            const labels = data.map(item => item.department ?? 'Unknown'); // Handle null department names
            const chartData = data.map(item => item.average_salary ?? 0); // Handle null salary

            // Render chart
            if (myChart) {
                myChart.destroy(); // Destroy previous instance before creating new one
            }

            try {
                 myChart = new Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Average Salary by Department',
                            data: chartData,
                            backgroundColor: 'rgba(54, 162, 235, 0.7)', // Slightly darker blue
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1,
                             barThickness: 'flex', // Adjust bar thickness based on available space
                             maxBarThickness: 50 // Set a maximum thickness
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false, // Important for fitting in the container
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    // Format Y-axis ticks as currency
                                    callback: (value) => formatCurrency(value),
                                     padding: 10 // Add padding to ticks
                                }
                            },
                             x: {
                                ticks: {
                                    maxRotation: 0, // Prevent label rotation if possible
                                    minRotation: 0,
                                     autoSkip: true, // Automatically skip labels if they overlap
                                     maxTicksLimit: 10 // Limit the number of visible labels
                                }
                             }
                        },
                        plugins: {
                            legend: {
                                display: false // Hide legend as it's redundant for one dataset
                            },
                            tooltip: {
                                callbacks: {
                                    // Format tooltip value as currency
                                    label: (context) => `Avg Salary: ${formatCurrency(context.raw)}`
                                }
                            }
                        },
                        // Add some padding around the chart area
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
                console.log("reports.js: Bar chart rendered successfully."); // Add log
            } catch(chartRenderError) {
                 console.error("reports.js: Error rendering Chart.js (bar):", chartRenderError);
                 chartError.textContent = 'Error displaying chart.';
            }


        } catch (error) {
            console.error('Error fetching report data:', error);
            chartError.textContent = 'Failed to load chart data.';
            tableError.textContent = 'Failed to load report data.';
            reportTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">Error loading report.</td></tr>`;
            // Destroy chart on error too
            if (myChart) { myChart.destroy(); myChart = null; }
        }
    }


    // --- NEW: Function to fetch and render new hires chart ---
    async function fetchNewHiresReport() {
        console.log("reports.js: fetchNewHiresReport() called.");
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
            console.log("reports.js: New hires data received:", data);

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

    // --- NEW: Function to render new hires chart ---
    function renderNewHireChart(data) {
        // Format labels from 'YYYY-MM-DD' to 'Month Year'
        const labels = data.map(item => formatMonthYear(item.hire_month));
        const chartData = data.map(item => item.hire_count);

        if (newHiresChart) {
            newHiresChart.destroy(); // Destroy old instance
        }

        try {
            newHiresChart = new Chart(newHiresChartCanvas, {
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
             console.log("reports.js: New hires chart rendered successfully.");
        } catch (chartRenderError) {
            console.error("reports.js: Error rendering new hires chart:", chartRenderError);
            newHiresChartError.textContent = 'Error displaying new hires chart.';
        }
    }


    // --- EVENT LISTENERS ---

    // Logout Button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
             console.log("reports.js: Logout button clicked."); // Add log
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
        console.warn("reports.js: Logout button not found."); // Add log
    }

    // --- INITIAL DATA LOAD ---
    console.log("reports.js: Calling initial fetch functions inside runPageLogic."); // Add log
    fetchReportData();
    fetchNewHiresReport(); // --- NEW: Call the new function ---

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);