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

    const API_BASE_URL = 'http://127.0.0.1:5000/api';
    let myChart = null; // Variable to hold the chart instance

    // --- HELPER FUNCTIONS ---
    // Updated formatCurrency to handle null/undefined
    const formatCurrency = (amount) => amount != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount) : 'N/A';


    // --- DATA FETCHING & RENDERING ---
    async function fetchReportData() {
        console.log("reports.js: fetchReportData() called."); // Add log
        // Ensure elements exist
        if (!reportTableBody || !chartCanvas || !chartError || !tableError) {
             console.error("Report page elements not found!");
             // Optionally display an error message on the page body if critical elements are missing
             document.body.innerHTML = '<p class="text-red-500 p-4">Error: Required page elements are missing. Cannot load report.</p>';
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
                console.log("reports.js: Chart rendered successfully."); // Add log
            } catch(chartRenderError) {
                 console.error("reports.js: Error rendering Chart.js:", chartRenderError);
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

} // --- End of runPageLogic ---


// --- Add the event listener at the VERY END to call runPageLogic ---
document.addEventListener('DOMContentLoaded', runPageLogic);

