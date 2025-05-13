/**
 * Trending Keywords Component
 * 
 * This script fetches and displays trending keywords based on:
 * 1. User searches
 * 2. Keywords from most visited documents
 * 
 * It only displays keywords that already exist in the database.
 */

// Function to fetch trending keywords
async function fetchTrendingKeywords() {
    try {
        console.log('Fetching trending keywords...');
        // Show loading state
        showLoadingState();
        
        // Fetch trending keywords based on document visits and searches
        // Set limit to 10 to ensure maximum of 10 keywords
        const response = await fetch('/api/trending-keywords?limit=10');
        
        if (!response.ok) {
            console.log(`HTTP error! status: ${response.status}`);
            // Fallback to static keywords from database
            await fetchStaticKeywords();
            return;
        }
        
        const data = await response.json();
        console.log('Trending keywords data received:', data);
        
        if (!data.keywords || data.keywords.length === 0) {
            // If no trending keywords, fetch regular keywords as fallback
            console.log('No trending keywords data available, falling back to static keywords');
            await fetchStaticKeywords();
            return;
        }
        
        updateKeywordsDisplay(data.keywords);
    } catch (error) {
        console.error('Error fetching trending keywords:', error);
        // Fallback to static keywords
        await fetchStaticKeywords();
    }
}

// Function to fetch static keywords from database as fallback
async function fetchStaticKeywords() {
    try {
        console.log('Fetching static keywords as fallback...');
        // Fetch existing keywords from database, limit to 10
        const response = await fetch('/api/keywords?limit=20');
        
        if (!response.ok) {
            console.log(`HTTP error fetching static keywords: ${response.status}`);
            displayErrorMessage();
            return;
        }
        
        const data = await response.json();
        console.log('Static keywords data received:', data);
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            displayNoDataMessage();
            return;
        }
        
        // Take a maximum of 10 random keywords
        const randomKeywords = getRandomItems(data, 10);
        updateKeywordsDisplay(randomKeywords);
    } catch (error) {
        console.error('Error fetching static keywords:', error);
        displayErrorMessage();
    }
}

// Helper function to get random items from array
function getRandomItems(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
}

// Function to update the trending keywords display
function updateKeywordsDisplay(keywords) {
    // Use the correct container class
    const keywordsContainer = document.querySelector('.keywords-list');
    if (!keywordsContainer) {
        console.error('Keywords list container not found');
        return;
    }
    
    // Clear existing content
    keywordsContainer.innerHTML = '';
    
    // Ensure we only display a maximum of 10 keywords
    const keywordsToDisplay = keywords.slice(0, 10);
    
    // Add each keyword to the keywords list
    keywordsToDisplay.forEach(keyword => {
        const keywordElement = document.createElement('div');
        keywordElement.className = 'keyword';
        
        // Handle different keyword formats (string or object)
        let keywordText = '';
        if (typeof keyword === 'string') {
            keywordText = keyword;
        } else if (keyword && keyword.name) {
            keywordText = keyword.name;
        } else if (keyword && keyword.keyword) {
            keywordText = keyword.keyword;
        } else if (keyword && keyword.text) {
            keywordText = keyword.text;
        } else {
            // Skip invalid keywords
            return;
        }
        
        keywordElement.textContent = keywordText;
        
        // Make keyword clickable to filter documents
        keywordElement.addEventListener('click', () => {
            window.location.href = `/admin/Components/documents_list.html?keyword=${encodeURIComponent(keywordText)}`;
        });
        
        keywordsContainer.appendChild(keywordElement);
    });
}

// Function to display loading state
function showLoadingState() {
    const keywordsContainer = document.querySelector('.keywords-list');
    if (!keywordsContainer) return;
    
    keywordsContainer.innerHTML = `
        <div class="loading-message" style="width: 100%; text-align: center; color: #6b7280;">
            <div class="loading-spinner"></div>
            <p>Loading trending keywords...</p>
        </div>
    `;
}

// Function to display an error message
function displayErrorMessage() {
    const keywordsContainer = document.querySelector('.keywords-list');
    if (!keywordsContainer) return;
    
    keywordsContainer.innerHTML = `
        <div class="error-message" style="width: 100%; text-align: center; color: #6b7280;">
            <p>Could not load trending keywords.</p>
        </div>
    `;
}

// Function to display a message when no data is available
function displayNoDataMessage() {
    const keywordsContainer = document.querySelector('.keywords-list');
    if (!keywordsContainer) return;
    
    keywordsContainer.innerHTML = `
        <div class="no-data-message" style="width: 100%; text-align: center; color: #6b7280;">
            <p>No keywords available.</p>
        </div>
    `;
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing trending keywords component...');
    fetchTrendingKeywords();
}); 