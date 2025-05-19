/**
 * Document Visit Tracker (Enhanced)
 * 
 * This script tracks visits to document pages and records them using the document visits API.
 * Features:
 * - Tracks visits to both single and compiled documents
 * - Separates guest vs user visits
 * - Associates child document visits with parent compiled documents
 * - Uses counter-based tracking for better performance
 */

/**
 * Records a document visit using the counter-based API
 * @param {string} documentId - The ID of the document being viewed
 * @param {string} visitorType - Type of visitor ('guest' or 'user')
 * @param {Object} metadata - Additional metadata about the visit
 */
async function recordDocumentVisit(documentId, visitorType = 'guest', metadata = {}) {
    try {
        if (!documentId) {
            console.warn('VISIT TRACKER: Cannot record document visit: Missing document ID');
            return;
        }
        
        // More detailed debug logging
        console.log(`VISIT TRACKER: Recording ${visitorType} visit for document ${documentId}`);
        console.log(`VISIT TRACKER: Current URL: ${window.location.href}`);
        
        // Only check and possibly correct visitor type if not forced
        if (!metadata.forceVisitorType) {
            // Check login status with extra logging
            const currentLoginState = isUserLoggedIn();
            console.log(`VISIT TRACKER: User login status check returned: ${currentLoginState ? 'logged in (user)' : 'not logged in (guest)'}`);        
            console.log(`VISIT TRACKER: Provided visitor type was: ${visitorType}`);
            
            let originalVisitorType = visitorType;
            
            // Only correct visitor type in specific cases to prevent errors
            if (visitorType === 'user' && !currentLoginState) {
                console.warn(`VISIT TRACKER: Visitor type mismatch - provided as 'user' but not logged in`);
                // If we're in a guest page and getting a user visit type, it's probably incorrect
                if (window.location.pathname.includes('/guest-') || 
                    window.location.pathname.includes('/public/') || 
                    window.location.pathname.includes('/Public/')) {
                    console.log(`VISIT TRACKER: On guest/public page, correcting visitor type to 'guest'`);
                    visitorType = 'guest';
                }
            } else if (visitorType === 'guest' && currentLoginState && !metadata.isTest && !metadata.isRepair) {
                console.warn(`VISIT TRACKER: Visitor type mismatch - provided as 'guest' but user is logged in`);
                // If we're in a user page and getting a guest visit type, it's probably incorrect
                if (window.location.pathname.includes('/user-') || 
                    window.location.pathname.includes('/admin/')) {
                    console.log(`VISIT TRACKER: On user/admin page, correcting visitor type to 'user'`);
                    visitorType = 'user';
                }
            }
            
            if (originalVisitorType !== visitorType) {
                console.log(`VISIT TRACKER: Corrected visitor type from '${originalVisitorType}' to '${visitorType}'`);
            }
        } else {
            console.log(`VISIT TRACKER: Using forced visitor type: ${visitorType}`);
        }
        
        // Prepare request data
        const visitData = {
                documentId: documentId,
            visitorType: visitorType,
            pageUrl: window.location.pathname,
            referrer: document.referrer || 'direct',
            ...metadata
        };
        
        // Remove internal flags that shouldn't be sent to the server
        delete visitData.forceVisitorType;
        
        // Log the exact data being sent to the server
        console.log(`VISIT TRACKER: Sending visit data:`, JSON.stringify(visitData));
        
        // Use the counter-based document visits endpoint
        const response = await fetch('/api/document-visits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(visitData)
        });
        
        if (!response.ok) {
            console.warn(`VISIT TRACKER: Failed to record document visit: ${response.status}`);
            
            // Try legacy endpoint as fallback
            const legacyResponse = await fetch('/api/page-visits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pageUrl: window.location.pathname,
                    visitorType: visitorType,
                    metadata: {
                        documentId: documentId,
                        ...metadata,
                        forceVisitorType: undefined // Don't send this flag
                    }
                })
            });
            
            if (!legacyResponse.ok) {
                console.error('VISIT TRACKER: Both tracking endpoints failed');
                return;
            }
            
            console.log('VISIT TRACKER: Visit recorded using legacy endpoint');
            return;
        }
        
        console.log(`VISIT TRACKER: Successfully recorded ${visitorType} visit for document ${documentId}`);
    } catch (error) {
        console.error('VISIT TRACKER: Error recording document visit:', error);
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
 * Determines if the current user is logged in
 * @returns {boolean} True if user is logged in, false otherwise
 */
function isUserLoggedIn() {
    // Try multiple storage locations
    try {
        console.log('VISIT TRACKER: Checking login status...');
        
        // First check sessionStorage (primary storage for login status)
        let userInfo = sessionStorage.getItem('userInfo');
        if (userInfo) {
            try {
                userInfo = JSON.parse(userInfo);
                if (userInfo && userInfo.isLoggedIn === true && userInfo.token) {
                    console.log('VISIT TRACKER: User logged in according to sessionStorage with token');
                    return true;
                }
            } catch (e) {
                console.log('VISIT TRACKER: Error parsing sessionStorage userInfo', e);
            }
        }
        
        // Then check localStorage (used for cross-tab communication)
        userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            try {
                userInfo = JSON.parse(userInfo);
                if (userInfo && userInfo.isLoggedIn === true && userInfo.token) {
                    console.log('VISIT TRACKER: User logged in according to localStorage with token');
                    return true;
                }
            } catch (e) {
                console.log('VISIT TRACKER: Error parsing localStorage userInfo', e);
            }
        }
        
        // Finally check cookies directly
        const cookies = document.cookie.split(';');
        console.log('VISIT TRACKER: Checking cookies:', cookies);
        const sessionCookie = cookies.find(cookie => cookie.trim().startsWith('session_token='));
        if (sessionCookie) {
            const tokenValue = sessionCookie.trim().substring('session_token='.length);
            if (tokenValue && tokenValue !== 'undefined' && tokenValue !== 'null' && tokenValue.length > 10) {
                console.log('VISIT TRACKER: Valid session token found in cookies');
                return true;
            } else {
                console.log('VISIT TRACKER: Invalid/empty session token in cookies:', tokenValue);
            }
        }
        
        // Additional check for admin_session cookie which would indicate an admin is logged in
        const adminCookie = cookies.find(cookie => cookie.trim().startsWith('admin_session='));
        if (adminCookie) {
            const adminTokenValue = adminCookie.trim().substring('admin_session='.length);
            if (adminTokenValue && adminTokenValue !== 'undefined' && adminTokenValue !== 'null' && adminTokenValue.length > 10) {
                console.log('VISIT TRACKER: Admin session token found');
                return true;
            }
        }
        
        // No valid login found
        console.log('VISIT TRACKER: User is not logged in - guest visit');
        return false;
    } catch (e) {
        console.error('VISIT TRACKER: Error checking login status:', e);
        return false;
    }
}

/**
 * Gets the parent document ID for a child document (if available)
 * @param {string} documentId - The ID of the child document
 * @returns {Promise<string|null>} Parent document ID or null if not found
 */
async function getParentDocumentId(documentId) {
    try {
        console.log(`VISIT TRACKER: Checking for parent document of ${documentId}`);
        const response = await fetch(`/api/documents/${documentId}/parent`);
        
        // If 404, it means there's no parent (this is not an error)
        if (response.status === 404) {
            console.log(`VISIT TRACKER: No parent document found for ${documentId} (404 Not Found)`);
            return null;
        }
        
        // For other non-200 responses, log but don't throw
        if (!response.ok) {
            console.log(`VISIT TRACKER: Non-critical API error when looking for parent: ${response.status} ${response.statusText}`);
            return null;
        }
        
            const data = await response.json();
            if (data && data.parentId) {
            console.log(`VISIT TRACKER: Found parent document ${data.parentId} for ${documentId}`);
                return data.parentId;
        }
        
        console.log(`VISIT TRACKER: No parent document ID returned for ${documentId}`);
        return null;
    } catch (error) {
        // Log error but continue without parent tracking
        console.log(`VISIT TRACKER: Error checking for parent document, will continue without parent tracking: ${error.message}`);
        return null;
    }
}

/**
 * Initializes document visit tracking for a single document page
 * @param {string} documentId - Optional document ID override (uses URL param if not provided)
 */
async function initSingleDocumentTracking(documentId) {
    // Use provided ID or extract from URL
    const docId = documentId || getDocumentIdFromUrl();
    
    if (!docId) {
        console.warn('Could not determine document ID, visit not recorded');
        return;
    }
    
    // Check if we're on a guest page and force visitor type accordingly
    let visitorType = 'guest';
    const currentPath = window.location.pathname.toLowerCase();
    
    if (currentPath.includes('/guest-') || 
        currentPath.includes('/public/') || 
        currentPath.includes('/public/pages/')) {
        // Force guest type for guest pages
        console.log('VISIT TRACKER: On guest page - forcing visitor type to guest');
        visitorType = 'guest';
    } else if (currentPath.includes('/user-') || 
               currentPath.includes('/admin/')) {
        // Only check login status for user/admin pages
        visitorType = isUserLoggedIn() ? 'user' : 'guest';
        console.log(`VISIT TRACKER: On user/admin page - visitor type set to ${visitorType} based on login status`);
    } else {
        // For any other page, check login status
        visitorType = isUserLoggedIn() ? 'user' : 'guest';
        console.log(`VISIT TRACKER: On neutral page - visitor type set to ${visitorType} based on login status`);
    }
    
    console.log(`VISIT TRACKER: Initializing single document tracking for ${docId} as ${visitorType}`);
    console.log(`VISIT TRACKER: Page path: ${window.location.pathname}`);
    console.log(`VISIT TRACKER: SessionStorage userInfo:`, sessionStorage.getItem('userInfo'));
    console.log(`VISIT TRACKER: LocalStorage userInfo:`, localStorage.getItem('userInfo'));
    
    // Track the visit to this document
    await recordDocumentVisit(docId, visitorType, {
        documentType: 'single',
        url: window.location.pathname + window.location.search,
        forceVisitorType: true // Signal that we've already determined the visitor type
    });
    
    // Check if this document is a child of a compiled document
    const parentId = await getParentDocumentId(docId);
    
    if (parentId) {
        console.log(`This is a child document of compiled document ${parentId}`);
        // Also record a visit to the parent compiled document
        await recordDocumentVisit(parentId, visitorType, {
            documentType: 'compiled',
            childDocumentId: docId,
            fromChild: true,
            forceVisitorType: true // Signal that we've already determined the visitor type
        });
    }
}

/**
 * Initializes document visit tracking for a compiled document page
 * @param {string} documentId - Optional document ID override (uses URL param if not provided)
 */
async function initCompiledDocumentTracking(documentId) {
    // Use provided ID or extract from URL
    const docId = documentId || getDocumentIdFromUrl();
    
    if (!docId) {
        console.warn('Could not determine document ID, visit not recorded');
        return;
    }
    
    // Check if we're on a guest page and force visitor type accordingly
    let visitorType = 'guest';
    const currentPath = window.location.pathname.toLowerCase();
    
    if (currentPath.includes('/guest-') || 
        currentPath.includes('/public/') || 
        currentPath.includes('/public/pages/')) {
        // Force guest type for guest pages
        console.log('VISIT TRACKER: On guest page - forcing visitor type to guest');
        visitorType = 'guest';
    } else if (currentPath.includes('/user-') || 
               currentPath.includes('/admin/')) {
        // Only check login status for user/admin pages
        visitorType = isUserLoggedIn() ? 'user' : 'guest';
        console.log(`VISIT TRACKER: On user/admin page - visitor type set to ${visitorType} based on login status`);
    } else {
        // For any other page, check login status
        visitorType = isUserLoggedIn() ? 'user' : 'guest';
        console.log(`VISIT TRACKER: On neutral page - visitor type set to ${visitorType} based on login status`);
    }
    
    console.log(`VISIT TRACKER: Initializing compiled document tracking for ${docId} as ${visitorType}`);
    console.log(`VISIT TRACKER: Page path: ${window.location.pathname}`);
    console.log(`VISIT TRACKER: SessionStorage userInfo:`, sessionStorage.getItem('userInfo'));
    console.log(`VISIT TRACKER: LocalStorage userInfo:`, localStorage.getItem('userInfo'));
    
    // Record compiled document visit
    await recordDocumentVisit(docId, visitorType, {
        documentType: 'compiled',
        url: window.location.pathname + window.location.search,
        forceVisitorType: true // Signal that we've already determined the visitor type
    });
}

/**
 * Gets detailed visit statistics for a document with breakdown by visitor type
 * @param {string} documentId - The ID of the document
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Promise<Object>} Visit statistics with breakdown
 */
async function getDocumentVisitStats(documentId, days = 30) {
    try {
        if (!documentId) {
            console.warn('Cannot get document visit stats: Missing document ID');
            return {
                total: 0,
                guest: 0,
                user: 0
            };
        }
        
        // Fetch document visit stats from counter endpoint
        const response = await fetch(`/api/document-visits/counts?documentId=${documentId}&days=${days}`);
        
        if (!response.ok) {
            console.warn(`Failed to get document visit stats: ${response.status}`);
            return {
                total: 0,
                guest: 0,
                user: 0
            };
        }
        
        const data = await response.json();
        
        return {
            total: (data.guest || 0) + (data.user || 0),
            guest: data.guest || 0,
            user: data.user || 0,
            breakdown: data.breakdown || null
        };
    } catch (error) {
        console.error(`Error getting document visit stats:`, error);
        return {
            total: 0,
            guest: 0,
            user: 0
        };
    }
        }
        
/**
 * Get most visited documents with breakdown by visitor type
 * @param {number} limit - Maximum number of documents to return
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Most visited documents with stats
 */
async function getMostVisitedDocuments(limit = 10, days = 30) {
    try {
        const response = await fetch(`/api/documents/most-visited?limit=${limit}&days=${days}`);
        
        if (!response.ok) {
            console.warn(`Failed to get most visited documents: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        return data.documents || [];
    } catch (error) {
        console.error('Error getting most visited documents:', error);
        return [];
    }
}

// Export functionality as a module
window.DocumentTracker = {
    // Main tracking functions
    initSingleDocumentTracking,
    initCompiledDocumentTracking,
    recordDocumentVisit,
    
    // Helper functions
    getDocumentIdFromUrl,
    isUserLoggedIn,
    getParentDocumentId,
    
    // Stats functions
    getDocumentVisitStats,
    getMostVisitedDocuments,
    
    // Test function to force a guest visit
    forceGuestVisit: async function(documentId) {
        if (!documentId) {
            documentId = getDocumentIdFromUrl();
            if (!documentId) {
                console.error('No document ID provided or found in URL');
                return false;
            }
        }
        console.log(`VISIT TRACKER TEST: Forcing a guest visit to document ${documentId}`);
        
        try {
            // Force visitor type to guest regardless of login status
            const visitData = {
                documentId: documentId,
                visitorType: 'guest',
                documentType: 'test',
                url: window.location.pathname + window.location.search,
                isTest: true
            };
            
            console.log(`VISIT TRACKER TEST: Sending direct API request with data:`, JSON.stringify(visitData));
            
            // Use the counter-based document visits endpoint directly
            const response = await fetch('/api/document-visits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(visitData)
            });
            
            if (!response.ok) {
                console.warn(`VISIT TRACKER TEST: Failed with status: ${response.status}`);
                return false;
            }
            
            const responseData = await response.json();
            console.log(`VISIT TRACKER TEST: Server response:`, responseData);
            
            // Immediately verify the count was updated
            setTimeout(async () => {
                try {
                    const stats = await getDocumentVisitStats(documentId);
                    console.log(`VISIT TRACKER TEST: Current visit stats for document ${documentId}:`, stats);
                } catch (err) {
                    console.error(`VISIT TRACKER TEST: Error fetching stats:`, err);
                }
            }, 1000);
            
            return true;
        } catch (error) {
            console.error(`VISIT TRACKER TEST: Error during test:`, error);
            return false;
        }
    },
    
    // Diagnostic function to check document visits
    checkDocumentVisits: async function(documentIds) {
        // If no IDs provided, use top documents
        if (!documentIds || !documentIds.length) {
            try {
                console.log("DIAGNOSTIC: Fetching top documents to check");
                const response = await fetch('/api/page-visits/most-visited-documents?limit=10');
                if (response.ok) {
                    const data = await response.json();
                    documentIds = data.documents.map(doc => doc.document_id);
                    console.log(`DIAGNOSTIC: Checking top ${documentIds.length} documents:`, documentIds);
                } else {
                    console.error("DIAGNOSTIC: Failed to get top documents");
                    return { status: 'error', message: 'Failed to fetch top documents' };
                }
            } catch (error) {
                console.error("DIAGNOSTIC: Error fetching documents:", error);
                return { status: 'error', message: 'Error fetching documents' };
            }
        }
        
        const results = [];
        
        // Check each document
        for (const docId of documentIds) {
            try {
                console.log(`DIAGNOSTIC: Checking document ${docId}`);
                const stats = await getDocumentVisitStats(docId);
                
                // Report the results
                results.push({
                    document_id: docId,
                    total_visits: stats.total,
                    guest_visits: stats.guest,
                    user_visits: stats.user,
                    has_guest_visits: stats.guest > 0,
                    guest_percentage: stats.total > 0 ? Math.round((stats.guest / stats.total) * 100) : 0
                });
                
                // If no guest visits but has user visits, generate one
                if (stats.guest === 0 && stats.user > 0) {
                    console.log(`DIAGNOSTIC: Document ${docId} has 0 guest visits but ${stats.user} user visits. Adding test guest visit.`);
                    await this.forceGuestVisit(docId);
                }
            } catch (error) {
                console.error(`DIAGNOSTIC: Error checking document ${docId}:`, error);
                results.push({
                    document_id: docId,
                    error: true,
                    message: error.message
                });
            }
        }
        
        console.log("DIAGNOSTIC: Visit check complete:", results);
        return {
            status: 'success',
            results: results,
            message: 'Check complete. See browser console for details.'
        };
    }
}; 