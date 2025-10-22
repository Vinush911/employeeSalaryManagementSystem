document.addEventListener('DOMContentLoaded', () => {
    // --- LOGOUT BUTTON LOGIC ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/logout', {
                    method: 'POST',
                    credentials: 'include',
                });
                if(response.ok) {
                    window.location.href = 'login.html';
                }
            } catch (error) {
                console.error('Logout request failed:', error);
            }
        });
    }

    const chartCtx = document.getElementById('salary-chart').getContext('2d');
    const reportTableBody = document.getElementById('report-table-body');
    let salaryChart = null;

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

    const renderReport = (reportData) => {
        // Render Table
        reportTableBody.innerHTML = '';
        if (reportData.length === 0) {
            reportTableBody.innerHTML = '<tr><td colspan="3" class="text-center py-4">No report data available.</td></tr>';
        } else {
            reportData.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'border-b';
                row.innerHTML = `
                    <td class="py-4 px-6 font-medium text-gray-900">${item.department}</td>
                    <td class="py-4 px-6 text-right">${item.employee_count}</td>
                    <td class="py-4 px-6 text-right">${formatCurrency(item.average_salary)}</td>
                `;
                reportTableBody.appendChild(row);
            });
        }

        // Render Chart
        const labels = reportData.map(item => item.department);
        const data = reportData.map(item => item.average_salary);
        
        const chartColors = ['#4A55A2', '#7895CB', '#A0BFE0', '#C5DFF8', '#A2D2FF'];

        if (salaryChart) {
            salaryChart.destroy();
        }
        
        salaryChart = new Chart(chartCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Average Salary (₹)',
                    data: data,
                    backgroundColor: chartColors,
                    borderColor: chartColors.map(color => color.replace(')', ', 0.8)')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + (value / 1000) + 'k';
                            }
                        }
                    }
                }
            }
        });
    };

    const fetchReportData = async () => {
        try {
            // --- THIS IS THE FIX ---
            const response = await fetch('http://127.0.0.1:5000/api/reports/department-salaries', {
                credentials: 'include' 
            });

            if (!response.ok) {
                if(response.status === 401) window.location.href = 'login.html';
                throw new Error('Failed to load report data.');
            }
            const data = await response.json();
            renderReport(data);
        } catch (error) {
            console.error(error);
            reportTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-red-500">${error.message}</td></tr>`;
            document.getElementById('salary-chart').parentElement.innerHTML = `<p class="text-center text-red-500">${error.message}</p>`;
        }
    };

    fetchReportData();
});

