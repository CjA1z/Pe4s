/**
 * Document Visit Tracker
 * 
 * This script tracks visits to document pages and records them using the page visits API.
 * It should be included on both doc-single.html and doc-compiled.html pages.
 */

/**
 * Records a visit to the current document page
 * @param {string} documentId - The ID of the document being viewed
 * @param {string} documentType - The type of document ('single' or 'compiled')
 */
async function recordDocumentVisit(documentId, documentType) {
    try {
        if (!documentId) {
            console.warn('Cannot record document visit: Missing document ID');
            return;
        }
        
        // Check if user is logged in
        let userInfo = null;
        try {
            userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo'));
        } catch (e) {
            console.log('No user info found or invalid format');
        }
        
        // Get current page URL
        const pageUrl = window.location.pathname + window.location.search;
        
        // Prepare visit data
        const visitData = {
            pageUrl: pageUrl,
            visitorType: userInfo?.isLoggedIn ? 'user' : 'guest',
            userId: userInfo?.isLoggedIn ? userInfo.id : undefined,
            // Include document-specific metadata
            metadata: {
                documentId: documentId,
                documentType: documentType // 'single' or 'compiled'
            }
        };
        
        // Record visit attempt in console
        console.log(`Recording ${documentType} document visit for document ID: ${documentId}`);
        
        // Send the visit data to the API
        const response = await fetch('/api/page-visits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(userInfo?.token ? {'Authorization': `Bearer ${userInfo.token}`} : {})
            },
            body: JSON.stringify(visitData)
        });
        
        if (!response.ok) {
            console.warn(`Failed to record document visit: ${response.status} ${response.statusText}`);
            return;
        }
        
        console.log('Document visit recorded successfully');
    } catch (error) {
        console.error('Error recording document visit:', error);
        // Non-critical error, don't disrupt the user experience
    }
}

/**
 * Helper function to extract document ID from URL
 * @returns {string|null} Document ID or null if not found
 */
function getDocumentIdFromUrl() {
    // Get the current URL
    const url = new URL(window.location.href);
    
    // Try to extract document ID from path (e.g., /document/123)
    const pathMatch = window.location.pathname.match(/\/document\/(\d+)/);
    if (pathMatch && pathMatch[1]) {
        return pathMatch[1];
    }
    
    // Try to extract document ID from query parameter (e.g., ?id=123)
    return url.searchParams.get('id');
}

/**
 * Initializes document visit tracking for a single document page
 */
function initSingleDocumentTracking() {
    const documentId = getDocumentIdFromUrl();
    
    if (!documentId) {
        console.warn('Could not determine document ID, visit not recorded');
        return;
    }
    
    recordDocumentVisit(documentId, 'single');
}

/**
 * Initializes document visit tracking for a compiled document page
 */
function initCompiledDocumentTracking() {
    const documentId = getDocumentIdFromUrl();
    
    if (!documentId) {
        console.warn('Could not determine document ID, visit not recorded');
        return;
    }
    
    recordDocumentVisit(documentId, 'compiled');
}

/**
 * Gets visit statistics for a document
 * @param {string} documentId - The ID of the document
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Promise<Object>} Visit statistics
 */
async function getDocumentVisitStats(documentId, days = 30) {
    try {
        if (!documentId) {
            console.warn('Cannot get document visit stats: Missing document ID');
            return null;
        }
        
        // Get user info for possible authentication
        let userInfo = null;
        try {
            userInfo = JSON.parse(sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo'));
        } catch (e) {
            console.log('No user info found or invalid format');
        }
        
        // Fetch document visit stats
        const response = await fetch(`/api/page-visits/documents/${documentId}?days=${days}`, {
            headers: {
                ...(userInfo?.token ? {'Authorization': `Bearer ${userInfo.token}`} : {})
            }
        });
        
        if (!response.ok) {
            console.warn(`Failed to get document visit stats: ${response.status} ${response.statusText}`);
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error getting document visit stats:`, error);
        return null;
    }
}

// Export functionality so it can be used from the individual pages
window.DocumentTracker = {
    initSingleDocumentTracking,
    initCompiledDocumentTracking,
    recordDocumentVisit,
    getDocumentIdFromUrl,
    getDocumentVisitStats
}; 