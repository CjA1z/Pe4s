/**
 * Dashboard Chart Component
 * 
 * This script handles the visitor chart functionality in the admin dashboard.
 * It fetches real visitor data from the API and displays it in a chart.
 */

// Chart instance reference
let visitorChart = null;

// Function to fetch visitor data from the API
async function fetchVisitorData(period) {
    try {
        console.log(`Fetching visitor data for period: ${period}`);
        
        let apiEndpoint;
        switch(period) {
            case 'daily':
                apiEndpoint = '/api/page-visits/stats/daily';
                break;
            case 'weekly':
                apiEndpoint = '/api/page-visits/stats/weekly';
                break;
            case 'monthly':
                apiEndpoint = '/api/page-visits/stats/monthly';
                break;
            default:
                apiEndpoint = '/api/page-visits/stats/daily'; // Default to daily
        }
        
        const response = await fetch(apiEndpoint);
        
        if (!response.ok) {
            console.error(`HTTP error fetching visitor data: ${response.status}`);
            return { labels: [], userVisits: [], guestVisits: [] };
        }
        
        const data = await response.json();
        console.log(`Visitor data received for ${period}:`, data);
        
        if (!data || !data.data || data.data.length === 0) {
            console.error(`No visitor data available for ${period}`);
            return { labels: [], userVisits: [], guestVisits: [] };
        }
        
        return formatApiData(data, period);
    } catch (error) {
        console.error(`Error fetching visitor data for ${period}:`, error);
        return { labels: [], userVisits: [], guestVisits: [] };
    }
}

// Function to format API data for chart use
function formatApiData(apiData, period) {
    // Extract relevant data from API response
    const chartData = {
        labels: [],
        userVisits: [],
        guestVisits: []
    };
    
    // Different formatting based on the period
    if (apiData && apiData.data && apiData.data.length > 0) {
        apiData.data.forEach(item => {
            // Format date label based on period
            let label;
            switch(period) {
                case 'daily':
                    // Format as "Jun 5"
                    const date = new Date(item.date);
                    label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    break;
                case 'weekly':
                    // Format as "Week 23"
                    label = `Week ${item.week || item.period}`;
                    break;
                case 'monthly':
                    // Format as "Jun 2023"
                    label = item.month || item.period;
                    break;
                default:
                    label = item.period || item.date;
            }
            
            chartData.labels.push(label);
            chartData.userVisits.push(item.user_visits || 0);
            chartData.guestVisits.push(item.guest_visits || 0);
        });
    }
    
    return chartData;
}

// Function to create or update the chart
async function updateVisitorChart(period = 'daily') {
    try {
        // Fetch data for the selected period
        const chartData = await fetchVisitorData(period);
        
        // Get the canvas context
        const ctx = document.getElementById('visitorChart').getContext('2d');
        
        // If chart exists, destroy it before creating a new one
        if (visitorChart) {
            visitorChart.destroy();
        }
        
        // Create new chart
        visitorChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'User Visits',
                    data: chartData.userVisits,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)', // Blue fill
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: true
                }, {
                    label: 'Guest Visits',
                    data: chartData.guestVisits,
                    backgroundColor: 'rgba(100, 220, 100, 0.2)', // Green fill
                    borderColor: 'rgba(100, 220, 100, 1)',
                    borderWidth: 1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: window.devicePixelRatio,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#000000'
                        },
                        grid: {
                            color: 'rgb(210, 210, 210)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#000000'
                        },
                        grid: {
                            color: 'rgb(210, 210, 210)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            labelColor: function(context) {
                                 if (context.datasetIndex === 0) {
                                    return {
                                        borderColor: 'rgba(75, 192, 192, 1)',
                                        backgroundColor: 'rgba(75, 192, 192, 1)'
                                    };
                                } else {
                                     return {
                                        borderColor: 'rgba(100, 220, 100, 1)',
                                        backgroundColor: 'rgba(100, 220, 100, 1)'
                                    };
                                }
                            },
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                 if (context.parsed.y !== null) {
                                    label += context.parsed.y + ' Visits';
                                }
                                return label;
                            }
                        },
                        backgroundColor: '#1e1e1e',
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        borderColor: '#4a5568',
                        borderWidth: 1,
                    },
                    legend: {
                        labels: {
                            color: '#000000'
                        }
                    }
                }
            }
        });
        
        // Update button active state
        const buttons = document.querySelectorAll('.chart-header button');
        buttons.forEach(button => button.classList.remove('active'));
        document.querySelector(`.chart-header button[data-period="${period}"]`).classList.add('active');
    } catch (error) {
        console.error('Error updating visitor chart:', error);
    }
}

// Initialize chart when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing visitor chart...');
    
    // Initial chart update with default period (daily)
    updateVisitorChart('daily');
    
    // Add event listeners to period buttons
    document.querySelectorAll('.chart-header button').forEach(button => {
        button.addEventListener('click', (event) => {
            const period = event.target.getAttribute('data-period');
            updateVisitorChart(period);
        });
    });
}); 