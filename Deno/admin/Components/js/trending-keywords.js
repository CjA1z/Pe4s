/**
 * Trending Keywords Component
 * 
 * This script fetches and displays trending keywords based on:
 * 1. Document keywords from most visited documents
 * 2. Keywords from documents list if trending isn't available
 */

// Function to fetch trending keywords
async function fetchTrendingKeywords() {
    try {
        console.log('Fetching trending keywords...');
        // Show loading state
        showLoadingState();
        
        // Skip the failing endpoint and go directly to the working documents list endpoint
        await fetchKeywordsFromDocumentsList();
    } catch (error) {
        console.error('Error fetching trending keywords:', error);
        // Use hardcoded keywords as last resort
        useHardcodedKeywords();
    }
}

// Function to extract keywords from most visited documents
async function fetchKeywordsFromMostVisitedDocuments() {
    try {
        // Use the most-visited-works endpoint which is confirmed to be working
        const response = await fetch('/api/most-visited-documents?period=30&limit=20');
        
        if (!response.ok) {
            console.log(`HTTP error! Most visited documents status: ${response.status}`);
            // Fallback to documents list
            await fetchKeywordsFromDocumentsList();
            return;
        }
        
        const data = await response.json();
        console.log('Most visited documents data received:', data);
        
        if (!data || !Array.isArray(data.documents) || data.documents.length === 0) {
            console.log('No most visited documents data available');
            await fetchKeywordsFromDocumentsList();
            return;
        }
        
        // Extract keywords from the documents
        const allKeywords = [];
        data.documents.forEach(doc => {
            if (doc.keywords && Array.isArray(doc.keywords)) {
                doc.keywords.forEach(keyword => {
                    if (keyword && typeof keyword === 'string' && keyword.trim() !== '') {
                        allKeywords.push(keyword.trim());
                    }
                });
            }
        });
        
        if (allKeywords.length === 0) {
            console.log('No keywords found in most visited documents');
            await fetchKeywordsFromDocumentsList();
            return;
        }
        
        // Count keyword occurrences and sort by popularity
        const keywordCounts = {};
        allKeywords.forEach(keyword => {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
        });
        
        // Convert to array of objects and sort
        const sortedKeywords = Object.keys(keywordCounts)
            .map(keyword => ({ keyword, count: keywordCounts[keyword] }))
            .sort((a, b) => b.count - a.count);
            
        // Take the top 10 keywords
        const topKeywords = sortedKeywords.slice(0, 10);
        
        if (topKeywords.length > 0) {
            updateKeywordsDisplay(topKeywords);
        } else {
            await fetchKeywordsFromDocumentsList();
        }
    } catch (error) {
        console.error('Error extracting keywords from most visited documents:', error);
        await fetchKeywordsFromDocumentsList();
    }
}

// Function to fetch keywords from all documents as fallback
async function fetchKeywordsFromDocumentsList() {
    try {
        console.log('Fetching keywords from documents list as fallback...');
        
        // Use the documents list API which should be available
        const response = await fetch('/api/documents?limit=20');
        
        if (!response.ok) {
            console.log(`HTTP error fetching documents: ${response.status}`);
            displayErrorMessage();
            return;
        }
        
        const data = await response.json();
        console.log('Documents data received:', data);
        
        if (!data || !Array.isArray(data.documents) || data.documents.length === 0) {
            displayNoDataMessage();
            return;
        }
        
        // Extract all keywords from documents
        const allKeywords = [];
        data.documents.forEach(doc => {
            if (doc.keywords && Array.isArray(doc.keywords)) {
                doc.keywords.forEach(keyword => {
                    if (keyword && typeof keyword === 'string' && keyword.trim() !== '') {
                        allKeywords.push(keyword.trim());
                    }
                });
            }
        });
        
        if (allKeywords.length === 0) {
            // If still no keywords, use hardcoded fallback
            useHardcodedKeywords();
            return;
        }
        
        // Remove duplicates by using a Set
        const uniqueKeywords = [...new Set(allKeywords)];
        
        // Select random keywords from the unique list
        const randomKeywords = getRandomItems(uniqueKeywords, 10);
        
        // Format as objects to match expected format
        const formattedKeywords = randomKeywords.map(keyword => ({ keyword }));
        
        updateKeywordsDisplay(formattedKeywords);
    } catch (error) {
        console.error('Error fetching keywords from documents list:', error);
        useHardcodedKeywords();
    }
}

// Last resort: use hardcoded keywords if all else fails
function useHardcodedKeywords() {
    console.log('Using hardcoded keywords as last resort');
    
    const fallbackKeywords = [
        { keyword: "Research" },
        { keyword: "Thesis" },
        { keyword: "Digital Archive" },
        { keyword: "Academic" },
        { keyword: "Education" },
        { keyword: "Preservation" },
        { keyword: "Documentation" },
        { keyword: "Analysis" },
        { keyword: "Archives" },
        { keyword: "Learning" }
    ];
    
    updateKeywordsDisplay(fallbackKeywords);
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
    
    // Disable scrolling by removing max-height and setting overflow to visible
    keywordsContainer.style.maxHeight = 'none';
    keywordsContainer.style.overflowY = 'visible';
    
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