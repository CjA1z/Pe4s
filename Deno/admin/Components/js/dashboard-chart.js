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
        
        // Try the specific period endpoint first
        const response = await fetch(apiEndpoint);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`Visitor data received for ${period}:`, data);
            
            if (data && data.data && data.data.length > 0) {
                return formatApiData(data, period);
            }
        }
        
        // If specific period endpoint fails, try the general stats endpoint
        console.log(`Specific ${period} endpoint failed, trying general stats...`);
        const generalResponse = await fetch('/api/page-visits/stats');
        
        if (generalResponse.ok) {
            const generalData = await generalResponse.json();
            console.log('General visitor stats received:', generalData);
            
            // Try to extract data from general stats
            if (generalData) {
                // Try different formats that might be returned by the API
                
                // Format 1: If period data is directly available
                if (generalData[period] && Array.isArray(generalData[period])) {
                    console.log(`Found ${period} data in general stats`);
                    return formatApiData({ data: generalData[period] }, period);
                }
                
                // Format 2: If data is in stats property
                if (generalData.stats) {
                    console.log('Found stats data in general response');
                    
                    // If we have the total/guest/user format like in the visits-column
                    if (typeof generalData.stats.total !== 'undefined' && 
                        typeof generalData.stats.guest !== 'undefined' && 
                        typeof generalData.stats.user !== 'undefined') {
                        
                        console.log('Converting total/guest/user stats to chart format');
                        
                        // Generate a simple one-point dataset
                        const today = new Date();
                        const formattedDate = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        
                        return {
                            labels: [formattedDate],
                            userVisits: [generalData.stats.user],
                            guestVisits: [generalData.stats.guest]
                        };
                    }
                }
                
                // Format 3: If historical data exists
                if (generalData.history && Array.isArray(generalData.history)) {
                    console.log('Found history data in general stats');
                    return formatApiData({ data: generalData.history }, period);
                }
                
                // Format 4: Try to use daily_stats, weekly_stats, or monthly_stats if available
                const altFieldName = `${period}_stats`;
                if (generalData[altFieldName] && Array.isArray(generalData[altFieldName])) {
                    console.log(`Found ${altFieldName} in general stats`);
                    return formatApiData({ data: generalData[altFieldName] }, period);
                }
                
                // Format 5: If there's a data array at the root
                if (Array.isArray(generalData.data)) {
                    console.log('Found data array in general stats');
                    return formatApiData({ data: generalData.data }, period);
                }
                
                // Last resort - if we have any numeric data, create a simple chart
                if (generalData.stats && (
                    typeof generalData.stats.total === 'number' || 
                    typeof generalData.stats.guest === 'number' || 
                    typeof generalData.stats.user === 'number'
                )) {
                    console.log('Creating simple chart from available stats');
                    
                    // Use home page stats to create a simple one-point dataset
                    const today = new Date();
                    const formattedDate = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    
                    return {
                        labels: ['Current'],
                        userVisits: [generalData.stats.user || 0],
                        guestVisits: [generalData.stats.guest || 0]
                    };
                }
            }
        }
        
        // Try the home-stats endpoint as a last resort (this is what visits-column uses)
        console.log('Trying home-stats endpoint as last resort...');
        const homeStatsResponse = await fetch('/api/page-visits/home-stats');
        
        if (homeStatsResponse.ok) {
            const homeStatsData = await homeStatsResponse.json();
            console.log('Home stats data received:', homeStatsData);
            
            if (homeStatsData && homeStatsData.stats) {
                // Use home page stats to create a simple one-point dataset
                const today = new Date();
                const formattedDate = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return {
                    labels: ['Current'],
                    userVisits: [homeStatsData.stats.user || 0],
                    guestVisits: [homeStatsData.stats.guest || 0]
                };
            }
        }
        
        // If all API calls fail, return empty data
        console.log('All API calls failed, returning empty data');
        return { labels: [], userVisits: [], guestVisits: [] };
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
        
        // Check if we received any data
        if (chartData.labels.length === 0) {
            // Display a "No Data Available" message on the canvas
            visitorChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['No Data'],
                    datasets: [{
                        data: [0],
                        backgroundColor: 'rgba(0,0,0,0)',
                        borderColor: 'rgba(0,0,0,0)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'No Data Available',
                            color: '#666',
                            font: {
                                size: 16
                            }
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    scales: {
                        x: {
                            display: false
                        },
                        y: {
                            display: false
                        }
                    }
                }
            });
            
            // Update button active state
            const buttons = document.querySelectorAll('.chart-header button');
            buttons.forEach(button => button.classList.remove('active'));
            document.querySelector(`.chart-header button[data-period="${period}"]`).classList.add('active');
            
            return;
        }
        
        // Create new chart with real data
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
        // Display error in chart
        try {
            const ctx = document.getElementById('visitorChart').getContext('2d');
            if (visitorChart) visitorChart.destroy();
            
            visitorChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Error'],
                    datasets: [{
                        data: [0],
                        backgroundColor: 'rgba(0,0,0,0)',
                        borderColor: 'rgba(0,0,0,0)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Error Loading Chart Data',
                            color: '#d32f2f',
                            font: {
                                size: 16
                            }
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    scales: {
                        x: {
                            display: false
                        },
                        y: {
                            display: false
                        }
                    }
                }
            });
        } catch (chartError) {
            console.error('Failed to display error in chart:', chartError);
        }
    }
}

// Initialize chart when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing visitor chart...');
    
    // Add a small delay to ensure Chart.js is fully loaded
    setTimeout(() => {
        // Initial chart update with default period (daily)
        updateVisitorChart('daily');
        
        // Add event listeners to period buttons
        document.querySelectorAll('.chart-header button').forEach(button => {
            button.addEventListener('click', (event) => {
                const period = event.target.getAttribute('data-period');
                updateVisitorChart(period);
            });
        });
    }, 300); // Small delay to ensure Chart.js and DOM are fully loaded
});

// Retry chart rendering if it fails or canvas is not ready
function retryChartRendering() {
    const canvas = document.getElementById('visitorChart');
    if (!canvas) {
        console.warn('Canvas element not found for visitor chart, will retry...');
        setTimeout(() => updateVisitorChart('daily'), 500);
        return;
    }
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not available yet, will retry...');
        setTimeout(() => updateVisitorChart('daily'), 500);
        return;
    }
    
    updateVisitorChart('daily');
}

// Add a global error handler to retry the chart if it fails to render
window.addEventListener('error', function(event) {
    if (event.message && event.message.includes('Chart') && visitorChart === null) {
        console.warn('Error initializing chart, attempting recovery:', event.message);
        setTimeout(retryChartRendering, 1000);
    }
});

// Add a fallback timeout to ensure chart renders even if DOMContentLoaded doesn't fire properly
setTimeout(() => {
    if (visitorChart === null) {
        console.warn('Chart not initialized after 1 second, attempting recovery...');
        retryChartRendering();
    }
}, 1000);

// Expose updateVisitorChart to the global scope for debugging
window.updateVisitorChart = updateVisitorChart; 