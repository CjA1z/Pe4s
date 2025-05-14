/**
 * Most Visited Works Component
 * 
 * This script fetches and displays document visit data
 * in the admin dashboard's Most Visited Works table.
 */

// Function to update the most visited works table
async function updateMostVisitedWorks(days = 7) {
    const limit = 5; // Always use exactly 5 documents
    try {
        console.log('Fetching most visited works data...');
        const response = await fetch(`/api/page-visits/most-visited-documents?limit=${limit}&days=${days}`);
        
        if (!response.ok) {
            console.log(`HTTP error! status: ${response.status}`);
            // Try to fetch regular documents as fallback
            await fetchRegularDocuments();
            return;
        }
        
        const data = await response.json();
        console.log('Most visited works data received:', data);
        
        if (!data.documents || data.documents.length === 0) {
            // If no visit data, fetch regular documents as fallback
            await fetchRegularDocuments();
            return;
        }
        
        // Ensure only 5 documents are displayed
        updateWorksTable(data.documents.slice(0, limit));
    } catch (error) {
        console.error('Error updating most visited works:', error);
        // Try to fetch regular documents as fallback
        await fetchRegularDocuments();
    }
}

// Function to fetch regular documents when no visit data is available
async function fetchRegularDocuments() {
    const limit = 5; // Always use exactly 5 documents
    try {
        console.log('Fetching regular documents as fallback...');
        const response = await fetch(`/api/documents?size=${limit}&sort=latest`);
        
        if (!response.ok) {
            console.log(`HTTP error fetching regular documents: ${response.status}`);
            displayErrorMessage();
            return;
        }
        
        const data = await response.json();
        console.log('Regular documents data received:', data);
        
        if (!data.documents || data.documents.length === 0) {
            displayNoDataMessage();
            return;
        }
        
        // Format the documents to match our expected structure
        const formattedDocuments = data.documents.map(doc => {
            // Process keywords to ensure they're in array format
            let processedKeywords = [];
            try {
                if (doc.keywords) {
                    if (Array.isArray(doc.keywords)) {
                        processedKeywords = doc.keywords;
                    } else if (typeof doc.keywords === 'string') {
                        try {
                            // Try to parse as JSON
                            processedKeywords = JSON.parse(doc.keywords);
                        } catch (e) {
                            // If not valid JSON, treat as comma-separated
                            processedKeywords = doc.keywords.split(',').map(k => k.trim()).filter(k => k);
                        }
                    } else if (typeof doc.keywords === 'object') {
                        // If it's an object but not an array, get its values
                        processedKeywords = Object.values(doc.keywords);
                    }
                }
            } catch (e) {
                console.error(`Error processing keywords for document ${doc.id}:`, e);
                processedKeywords = [];
            }
            
            return {
                document_id: doc.id,
                document_type: doc.document_type || 'single',
                title: doc.title,
                visit_count: 0, // No visits yet
                last_visit_date: doc.publication_date,
                start_year: doc.start_year,
                end_year: doc.end_year,
                keywords: processedKeywords
            };
        });
        
        // Ensure only 5 documents are displayed
        updateWorksTable(formattedDocuments.slice(0, limit));
    } catch (error) {
        console.error('Error fetching regular documents:', error);
        displayErrorMessage();
    }
}

// Function to get icon path for document type
function getDocumentTypeIcon(type) {
    if (!type) return '/admin/Components/icons/Category-icons/default_category_icon.png';
    
    type = type.toLowerCase();
    
    switch (type) {
        case 'thesis':
            return '/admin/Components/icons/Category-icons/thesis.png';
        case 'dissertation':
            return '/admin/Components/icons/Category-icons/dissertation.png';
        case 'confluence':
            return '/admin/Components/icons/Category-icons/confluence.png';
        case 'synergy':
            return '/admin/Components/icons/Category-icons/synergy.png';
        case 'compiled':
            return '/admin/Components/icons/Category-icons/confluence.png'; // Use confluence icon for compiled
        case 'single':
        default:
            return '/admin/Components/icons/Category-icons/thesis.png'; // Use thesis icon as default
    }
}

// Function to display data in the existing table
function updateWorksTable(documents) {
    // Get the table body
    const tableBody = document.getElementById('most-visited-works-tbody');
    if (!tableBody) {
        console.error('Could not find most visited works table body');
        return;
    }
    
    // Clear existing content
    tableBody.innerHTML = '';
    
    // Add each document to the table
    documents.forEach((doc) => {
        const row = document.createElement('tr');
        row.className = 'most-visited-row';
        
        // Create cover cell
        const coverCell = document.createElement('td');
        coverCell.className = 'most-visited-cover-cell';
        const coverDiv = document.createElement('div');
        coverDiv.className = 'cover most-visited-cover';
        
        // Add image instead of text
        const coverImg = document.createElement('img');
        coverImg.src = getDocumentTypeIcon(doc.document_type);
        coverImg.alt = formatDocumentType(doc.document_type);
        coverImg.className = 'cover-icon most-visited-cover-icon';
        
        // Add error handler in case image doesn't load
        coverImg.onerror = function() {
            // Fallback to document type text if image fails to load
            this.style.display = 'none';
            coverDiv.textContent = formatDocumentType(doc.document_type);
        };
        
        coverDiv.appendChild(coverImg);
        coverCell.appendChild(coverDiv);
        
        // Create details cell
        const detailsCell = document.createElement('td');
        detailsCell.className = 'most-visited-details-cell';
        
        // Document title and basic info
        const titleElement = document.createElement('h5');
        titleElement.className = 'most-visited-title';
        const title = doc.title || `Document ${doc.document_id}`;
        
        // Only show the title without document type or date
        titleElement.textContent = title;
        // Add title attribute to show full title on hover
        titleElement.title = title;
        
        // Format the document type for display (used for tags only)
        const docType = formatDocumentType(doc.document_type);
        
        // Create tags container
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'tags most-visited-tags';
        
        // Document type tag
        const docTypeSpan = document.createElement('span');
        docTypeSpan.className = 'doc-type most-visited-doc-type';
        docTypeSpan.textContent = docType;
        tagsDiv.appendChild(docTypeSpan);
        
        // Add keywords as tags if available
        if (doc.keywords && Array.isArray(doc.keywords) && doc.keywords.length > 0) {
            // Limit to first 3 keywords to avoid overcrowding
            const keywordsToShow = doc.keywords.slice(0, 3);
            keywordsToShow.forEach(keyword => {
                if (keyword) {
                    const keywordTag = document.createElement('span');
                    keywordTag.className = 'tag most-visited-tag';
                    keywordTag.textContent = keyword;
                    tagsDiv.appendChild(keywordTag);
                }
            });
        } else if (doc.keywords && typeof doc.keywords === 'string' && doc.keywords.trim() !== '') {
            // Handle case where keywords might be a comma-separated string
            const keywordsArray = doc.keywords.split(',').map(k => k.trim()).filter(k => k);
            // Limit to first 3 keywords
            const keywordsToShow = keywordsArray.slice(0, 3);
            keywordsToShow.forEach(keyword => {
                const keywordTag = document.createElement('span');
                keywordTag.className = 'tag most-visited-tag';
                keywordTag.textContent = keyword;
                tagsDiv.appendChild(keywordTag);
            });
        }
        // No fallback to mock tags - if no keywords are available, don't show any keyword tags
        
        // Add elements to details cell
        detailsCell.appendChild(titleElement);
        detailsCell.appendChild(tagsDiv);
        
        // Create visits cell
        const visitsCell = document.createElement('td');
        visitsCell.className = 'visits most-visited-visits';
        
        const visitsStrong = document.createElement('strong');
        visitsStrong.className = 'most-visited-count';
        visitsStrong.textContent = doc.visit_count || 0;
        
        visitsCell.appendChild(visitsStrong);
        visitsCell.appendChild(document.createTextNode(' Visits'));
        
        // Remove clickable behavior
        // row.style.cursor = 'pointer';
        // row.addEventListener('click', () => {
        //     window.location.href = `/document/${doc.document_id}`;
        // });
        
        // Add all cells to the row
        row.appendChild(coverCell);
        row.appendChild(detailsCell);
        row.appendChild(visitsCell);
        
        // Add the row to the table
        tableBody.appendChild(row);
    });
}

// Function to display an error message when data fetch fails
function displayErrorMessage() {
    const tableBody = document.getElementById('most-visited-works-tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="3" class="error-message">
                <p>Could not load document data.</p>
                <p class="error-detail">Please try again later.</p>
            </td>
        </tr>
    `;
}

// Function to display a message when no data is available
function displayNoDataMessage() {
    const tableBody = document.getElementById('most-visited-works-tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="3" class="no-data-message">
                <p>No documents available.</p>
                <p class="no-data-detail">Add documents to see them listed here.</p>
            </td>
        </tr>
    `;
}

// Helper function to format document type for display
function formatDocumentType(type) {
    if (!type) return 'Document';
    
    type = type.toLowerCase();
    
    switch (type) {
        case 'single':
            return 'Document';
        case 'compiled':
            return 'Compiled';
        case 'thesis':
            return 'Thesis';
        case 'dissertation':
            return 'Dissertation';
        case 'confluence':
            return 'Confluence';
        case 'synergy':
            return 'Synergy';
        default:
            // Capitalize first letter of each word
            return type.replace(/\b\w/g, l => l.toUpperCase());
    }
}

// Helper function to format date
function formatDate(doc) {
    if (!doc) return 'N/A';
    
    try {
        // Handle different document types
        if (doc.document_type === 'compiled' && doc.start_year && doc.end_year) {
            // For compiled documents, use start_year-end_year format
            return `${doc.start_year}-${doc.end_year}`;
        } else if (doc.document_type === 'compiled' && doc.start_year) {
            // If only start_year is available
            return doc.start_year.toString();
        } else if (doc.last_visit_date) {
            // For single documents, use publication date (last_visit_date)
            const date = new Date(doc.last_visit_date);
            const year = date.getFullYear();
            
            if (isNaN(year)) return 'N/A';
            
            return year.toString();
        }
        
        return 'N/A';
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'N/A';
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing most visited works component...');
    
    // Get the select element for time period
    const timeSelectElement = document.getElementById('most-visited-time-period');
    
    // Initial update with default of 7 days
    updateMostVisitedWorks(7);
    
    // Add event listener for time period changes
    if (timeSelectElement) {
        timeSelectElement.addEventListener('change', () => {
            const days = parseInt(timeSelectElement.value);
            
            // Log which time period was selected
            if (days === 1) {
                console.log('Showing daily most visited documents');
            } else if (days === 7) {
                console.log('Showing last 7 days most visited documents');
            } else if (days === 30) {
                console.log('Showing last month most visited documents');
            } else if (days === 0) {
                console.log('Showing all time most visited documents');
            }
            
            // Always use limit=5 to ensure exactly 5 documents are displayed
            updateMostVisitedWorks(days);
        });
    }
}); 