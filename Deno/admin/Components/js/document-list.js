// Global variables for document list functionality
let globalDisplayedDocIds = new Set();
let expandedDocIds = []; // Tracks which compiled documents are expanded

/**
 * Initialize the confirmation modal for document deletion
 */
function initializeConfirmationModal() {
    console.log('Initializing confirmation modal for document deletion');
    
    // Ensure the modal exists in the DOM
    const modal = document.getElementById('delete-confirmation-modal');
    if (!modal) {
        console.error('Delete confirmation modal not found in DOM. Make sure the HTML is properly loaded.');
        return;
    }
    
    // Style the modal to ensure it's not hidden by CSS issues
    modal.style.position = 'fixed';
    modal.style.zIndex = '9999';  // Ensure it's on top
    
    // Get all modal elements
    const closeBtn = document.getElementById('close-confirmation-modal');
    const cancelBtn = document.getElementById('cancel-confirmation-btn');
    const confirmBtn = document.getElementById('confirm-archive-btn');
    
    if (!closeBtn || !cancelBtn || !confirmBtn) {
        console.error('One or more confirmation modal buttons not found:', {
            closeBtn: !!closeBtn,
            cancelBtn: !!cancelBtn,
            confirmBtn: !!confirmBtn
        });
        return;
    }
    
    // Default close handlers that can be used by any close button
    const closeModal = () => {
        console.log('Closing confirmation modal');
        modal.classList.remove('show');
    };
    
    // Add click outside to close
    modal.addEventListener('click', (e) => {
        // Close only if clicking directly on the overlay
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Manually add event listeners to all close buttons
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    console.log('Confirmation modal initialized successfully');
}

/**
 * Fetch authors for a document
 * @param {string|number} documentId - The document ID
 */
async function fetchAuthorsForDocument(documentId) {
    try {
        console.log(`DEBUG: Fetching authors directly for document ${documentId}`);
        const response = await fetch(`/api/document-authors/${documentId}`);
        
        if (!response.ok) {
            console.error(`Error fetching authors: ${response.status} ${response.statusText}`);
            return [];
        }
        
        const data = await response.json();
        console.log(`Authors from API for document ${documentId}:`, data.authors);
        return data.authors;
    } catch (error) {
        console.error('Error fetching authors:', error);
        return [];
    }
}

/**
 * Initialize the document list and set up event listeners
 */
function initializeDocumentList() {
    console.log('INIT DEBUG: Initializing document list');
    
    // Add styles for volume-issue span
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .volume-issue {
            font-size: 0.8em;
            font-weight: normal;
            color: #666;
            margin-left: 10px;
            white-space: nowrap;
        }
        
        .document-title {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .publication-date {
            white-space: nowrap;
            color: #555;
            font-weight: 500;
        }
        
        .publication-date i {
            color: #4a6da7;
            margin-right: 4px;
        }
        
        .author-list i {
            color: #4a6da7;
            margin-right: 4px;
        }
    `;
    document.head.appendChild(styleEl);
    
    // Initialize confirmation modal for document deletion
    initializeConfirmationModal();
    
    // Initialize filters and pagination via document-filters.js
    if (typeof window.documentFilters === 'object' && window.documentFilters !== null) {
        console.log('INIT DEBUG: window.documentFilters already initialized, reusing');
    } else {
        console.log('INIT DEBUG: window.documentFilters not found, initializing now');
        // Check if the function exists in the global scope
        if (typeof initializeFiltersAndPagination === 'function') {
            initializeFiltersAndPagination();
        } else {
            console.error('INIT DEBUG: initializeFiltersAndPagination function not found. Make sure document-filters.js is loaded before document-list.js');
            
            // Create a basic documentFilters object to prevent errors
            window.documentFilters = {
                setCurrentPage: () => console.log('Stub setCurrentPage called'),
                getCurrentCategoryFilter: () => null,
                getCurrentSortOrder: () => 'latest',
                getCurrentSearchQuery: () => '',
                updatePagination: () => console.log('Stub updatePagination called')
            };
        }
    }
    
    console.log('INIT DEBUG: Document filters status:', window.documentFilters ? 'Available' : 'Not available');
    
    // Make functions globally available
    window.documentList = {
        loadDocuments,
        refreshDocumentList,
        renderDocuments
    };
    
    // Make the confirmation functions globally available
    window.showDeleteConfirmation = showDeleteConfirmation;
    
    // Debug to verify it's available globally
    console.log('INIT DEBUG: Functions exported to global scope:', {
        documentList: !!window.documentList,
        showDeleteConfirmation: !!window.showDeleteConfirmation
    });
    
    console.log('INIT DEBUG: Exported document list functions to window.documentList');
    
    // Initial document load
    console.log('INIT DEBUG: Triggering initial document load');
    loadDocuments(1, true);
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('INIT DEBUG: DOM content loaded, initializing document list');
    initializeDocumentList();
});

/**
 * Fetch documents from the database with specified filters
 * @param {number} page - Page number to fetch 
 * @param {string|null} category - Category filter or null for all
 * @param {string} sortOrder - Sort order ('latest' or 'earliest')
 * @param {number} limit - Number of documents per page
 * @param {boolean} showLoading - Whether to show loading indicator
 * @returns {Promise<Object>} - The documents data
 */
async function fetchDocumentsFromDB(page = 1, category = null, sortOrder = 'latest', limit = 10, showLoading = true) {
    try {
        // Get search query if available
        const searchQuery = window.documentFilters && window.documentFilters.getCurrentSearchQuery 
            ? window.documentFilters.getCurrentSearchQuery() 
            : '';
            
        // Get keyword filter if available
        const keywordFilter = window.documentFilters && window.documentFilters.getCurrentKeyword
            ? window.documentFilters.getCurrentKeyword()
            : '';
            
        console.log(`Fetching documents: page=${page}, category=${category}, sort=${sortOrder}, limit=${limit}, search=${searchQuery}, keyword=${keywordFilter}`);
        
        // Construct the API URL with query parameters
        let url = `/api/documents?page=${page}&size=${limit}&sort=${sortOrder}`;
        if (category && category !== 'All') {
            url += `&category=${encodeURIComponent(category)}`;
        }
        if (searchQuery) {
            url += `&search=${encodeURIComponent(searchQuery)}`;
        }
        // Add keyword filter if specified
        if (keywordFilter) {
            url += `&keyword=${encodeURIComponent(keywordFilter)}`;
        }
        
        // Add cache busting parameter if force refreshing
        if (window.forceRefreshTimestamp) {
            url += `&t=${window.forceRefreshTimestamp}`;
            // Clear the timestamp so we don't keep forcing refresh
            window.forceRefreshTimestamp = null;
        }
        
        // Show loading indicator in the container if requested
        if (showLoading) {
            document.getElementById('documents-container').innerHTML = '<div class="loading-documents"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>';
        }
        
        console.log('FETCH DEBUG: Making API request to URL:', url);
        console.log('FETCH DEBUG: Current document filters:', window.documentFilters);
        
        // Fetch documents from the API
        const response = await fetch(url, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        console.log('FETCH DEBUG: Response status:', response.status);
        console.log('FETCH DEBUG: Response headers:', Object.fromEntries([...response.headers]));
        
        if (!response.ok) {
            console.error('FETCH DEBUG: Response error:', response.status, response.statusText);
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('FETCH DEBUG: Documents data received:', data);
        
        if (data.documents && data.documents.length > 0) {
            console.log('FETCH DEBUG: First document:', data.documents[0]);
            // Check if is_compiled properties are set correctly
            data.documents.forEach((doc, index) => {
                console.log(`FETCH DEBUG: Document ${index} (ID: ${doc.id}): is_compiled = ${doc.is_compiled}, doc_type = ${doc.doc_type}, title = "${doc.title}"`);
                console.log(`FETCH DEBUG: Document ${index} deleted_at:`, doc.deleted_at);
                
                // Enhanced debugging to check all properties
                console.log(`FETCH DEBUG: Full properties of document ${doc.id}:`, Object.keys(doc));
                console.log(`FETCH DEBUG: Document ${doc.id} deleted_at type:`, typeof doc.deleted_at);
                if (doc.deleted_at) {
                    console.warn(`URGENT: Document ${doc.id} has deleted_at set but is still included in results!`);
                }
            });
            
            // Log all possible category-related fields
            const firstDoc = data.documents[0];
            console.log('FETCH DEBUG: All properties of first document:', Object.keys(firstDoc));
        } else {
            console.log('FETCH DEBUG: No documents returned');
        }
        
        // Filter out any documents that might have deleted_at set
        // This is an extra safeguard to ensure deleted documents don't appear in the main view
        if (data.documents) {
            // First log any documents that should be filtered out
            const deletedDocs = data.documents.filter(doc => doc.deleted_at);
            if (deletedDocs.length > 0) {
                console.warn('FETCH DEBUG: Found deleted documents that should be filtered out:', deletedDocs);
            }
            
            // Add client-side filtering as a backup for server filter
            const filteredDocs = data.documents.filter(doc => {
                if (doc.deleted_at) {
                    console.warn(`CLIENT: Filtering out document ${doc.id} (${doc.title}) because it has deleted_at set`);
                    return false;
                }
                return true;
            });
            
            // Check if we filtered anything
            if (filteredDocs.length !== data.documents.length) {
                console.warn(`CLIENT: Filtered out ${data.documents.length - filteredDocs.length} deleted documents on client side!`);
                // Replace the documents with filtered version
                data.documents = filteredDocs;
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching documents:', error);
        document.getElementById('documents-container').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading documents: ${error.message}</p>
                <button onclick="loadDocuments(${page})">Try Again</button>
            </div>
        `;
        return { documents: [], totalDocuments: 0, totalPages: 0 };
    }
}

/**
 * Load documents and update the display
 * @param {number} page - Page number to load
 * @param {boolean} resetTracking - Whether to reset tracking variables
 */
async function loadDocuments(page = 1, resetTracking = true) {
    console.log(`Loading documents for page ${page}, resetTracking=${resetTracking}`);
    console.log('LOAD DEBUG: Current window.documentFilters:', window.documentFilters);
    
    // Validate page number
    if (page < 1) page = 1;
    
    // Update current page in filters
    if (window.documentFilters) {
        window.documentFilters.setCurrentPage(page);
    } else {
        console.error('LOAD DEBUG: window.documentFilters is not initialized!');
    }
    
    // Reset tracking if requested
    if (resetTracking) {
        globalDisplayedDocIds = new Set();
    }
    
    try {
        // Get filters and sort from document-filters.js
        const category = window.documentFilters ? window.documentFilters.getCurrentCategoryFilter() : null;
        const sortOrder = window.documentFilters ? window.documentFilters.getCurrentSortOrder() : 'latest';
        
        console.log('LOAD DEBUG: Using category filter:', category);
        console.log('LOAD DEBUG: Using sort order:', sortOrder);
        
        // Fetch documents from the API
        const data = await fetchDocumentsFromDB(
            page,
            category,
            sortOrder,
            10, // documents per page
            true // show loading indicator
        );
        
        if (!data || !data.documents) {
            console.error('LOAD DEBUG: No document data returned from server');
            throw new Error('No document data returned from server');
        }
        
        console.log('LOAD DEBUG: Successfully fetched documents:', data.documents.length);
        
        const { documents, totalPages, totalDocuments } = data;
        
        // Render documents
        renderDocuments('documents-container', documents, expandedDocIds);
        
        // Update pagination controls
        if (window.documentFilters) {
            window.documentFilters.updatePagination(totalPages);
        }
        
        // Update entries info display
        if (window.documentFilters) {
            window.documentFilters.setVisibleEntriesCount(documents.length);
        }
        
        // Update filter indicator (only if the function exists)
        if (window.documentFilters && typeof window.documentFilters.updateFilterIndicator === 'function') {
            window.documentFilters.updateFilterIndicator();
        }
        
        // If no documents found, show empty state
        if (documents.length === 0) {
            document.getElementById('documents-container').innerHTML = `
                <div class="no-docs">
                    <div class="empty-state">
                        <i class="fas fa-file-alt empty-icon"></i>
                        <p>No documents found</p>
                    </div>
                </div>
            `;
        }
        
        // Check if we need to search child documents
        const searchQuery = window.documentList ? window.documentList.currentSearchQuery : '';
        if (searchQuery && searchQuery.trim() !== '') {
            // Set a small delay to ensure documents are fully rendered
            setTimeout(() => {
                searchChildDocuments(searchQuery);
            }, 300);
        }
        
    } catch (error) {
        console.error('Error in loadDocuments:', error);
        document.getElementById('documents-container').innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading documents: ${error.message}</p>
                <button onclick="loadDocuments(${page})">Try Again</button>
            </div>
        `;
    }
}

/**
 * Refresh the document list with current filters and page
 * @param {boolean} forceReload - Whether to force a complete reload from server
 */
function refreshDocumentList(forceReload = false) {
    console.log('Refreshing document list - forceReload:', forceReload);
    
    if (forceReload) {
        // Add a cache-busting parameter to force a complete reload
        window.forceRefreshTimestamp = Date.now();
        console.log('Setting force refresh timestamp:', window.forceRefreshTimestamp);
        
        // Also clear any cached document data if using document cache
        if (window.documentCache && typeof window.documentCache.clearAll === 'function') {
            window.documentCache.clearAll();
        }
        
        // Reset any document tracking variables
        globalDisplayedDocIds = new Set();
        expandedDocIds = [];
    }
    
    const currentPage = window.documentFilters ? 
        window.documentFilters.getCurrentPage() : 1;
    
    // Notify console for debugging
    console.log(`REFRESH: Loading documents for page ${currentPage}, resetTracking=true, forceReload=${forceReload}`);
    
    // Trigger the document loading with reset
    loadDocuments(currentPage, true);
}

/**
 * Renders a collection of documents into the specified container
 * @param {string|HTMLElement} containerId - Container ID or element to render documents in
 * @param {Array} documents - Array of document objects to render
 * @param {Array} expandedDocIds - Array of document IDs that should be expanded
 */
function renderDocuments(containerId, documents, expandedDocIds = []) {
    console.log(`Rendering ${documents?.length || 0} documents to container ${typeof containerId === 'string' ? containerId : 'element'}`);
    
    // Get container element
    let container;
    if (typeof containerId === 'string') {
        container = document.getElementById(containerId);
    } else {
        container = containerId;
    }
    
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return;
    }

    // Clear container and show loading first
    container.innerHTML = '<div class="loading-documents"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>';
    
    // Check if document card components are available
    if (typeof window.documentCardComponents === 'undefined') {
        console.log("Document card components not found, attempting to load dynamically");
        
        // Try to determine the correct path based on current location
        const scriptPaths = [
            'js/document-card-components.js',           // Direct js folder
            '../js/document-card-components.js',        // One level up
            'Components/js/document-card-components.js' // Components folder
        ];
        
        let loadAttempted = false;
        
        function tryNextPath(index) {
            if (index >= scriptPaths.length) {
                console.error("Failed to load document card components after trying all paths");
                renderBasicDocuments(container, documents);
                return;
            }
            
            const script = document.createElement('script');
            script.src = scriptPaths[index];
            console.log(`Attempting to load from: ${scriptPaths[index]}`);
            
            script.onload = function() {
                console.log(`Successfully loaded document components from ${scriptPaths[index]}`);
                if (typeof window.documentCardComponents !== 'undefined') {
                    console.log("Document card components now available, rendering documents");
                    // We'll call the render function again, but by this point the script is loaded
                    actuallyRenderDocuments(container, documents, expandedDocIds);
                } else {
                    console.error("Script loaded but documentCardComponents still not defined");
                    tryNextPath(index + 1);
                }
            };
            script.onerror = function() {
                console.error(`Failed to load document components from ${scriptPaths[index]}`);
                tryNextPath(index + 1);
            };
            document.head.appendChild(script);
            loadAttempted = true;
        }
        
        tryNextPath(0);
        
        if (loadAttempted) return; // Exit and wait for script to load
        
        // Fallback to basic rendering if script loading fails
        renderBasicDocuments(container, documents);
        return;
    }
    
    // If document card components are available, render directly
    actuallyRenderDocuments(container, documents, expandedDocIds);
}

/**
 * Actually renders documents after component loading issues are resolved
 * This avoids recursion and ensures we have a clean rendering process
 */
function actuallyRenderDocuments(container, documents, expandedDocIds = []) {
    // Reset tracking variables
    globalDisplayedDocIds = new Set();
    
    // If no documents, show empty state
    if (!documents || documents.length === 0) {
        container.innerHTML = `
            <div class="no-docs">
                <div class="empty-state">
                    <i class="fas fa-file-alt empty-icon"></i>
                    <p>No documents found</p>
                </div>
            </div>`;
        return;
    }
            
            // Clear container
            container.innerHTML = '';
            
            // Create document fragment for better performance
            const fragment = document.createDocumentFragment();
            
    // Track document IDs to avoid duplicates
    const renderedDocIds = new Set();
            
            // Process each document
            documents.forEach(doc => {
                try {
                    // Skip if already displayed
            if (!doc.id || renderedDocIds.has(doc.id)) {
                console.log(`Skipping duplicate document: ${doc.id}`);
                        return;
                    }
                    
            renderedDocIds.add(doc.id);
                    globalDisplayedDocIds.add(doc.id);
                    
                    let card;
                    
            // Debug the document properties
            console.log(`Document ${doc.id} properties:`, {
                id: doc.id,
                title: doc.title,
                is_compiled: doc.is_compiled,
                child_count: doc.child_count
            });
            
            // Check if this is a compiled document
            if (doc.is_compiled === true) {
                console.log(`Creating compiled document card for document ${doc.id} with ${doc.child_count || 0} children`);
                
                if (typeof window.documentCardComponents !== 'undefined' && 
                    typeof window.documentCardComponents.createCompiledDocumentCard === 'function') {
                    card = window.documentCardComponents.createCompiledDocumentCard(doc, expandedDocIds);
                    } else {
                    // Fallback to basic rendering if components not available
                    card = renderBasicDocumentCard(doc);
                }
                
                // Add a specific class for compiled documents
                card.classList.add('compiled-document-card');
                
                // If this document should be expanded, prepare to show children
                if (expandedDocIds.includes(doc.id)) {
                    setTimeout(() => {
                        toggleCompiledDocument(doc.id, card, true);
                    }, 100);
                }
            } else {
                // Regular document
                console.log(`Creating regular document card for document ${doc.id}`);
                
                if (typeof window.documentCardComponents !== 'undefined' && 
                    typeof window.documentCardComponents.createDocumentCard === 'function') {
                    card = window.documentCardComponents.createDocumentCard(doc);
                } else {
                    // Fallback to basic rendering if components not available
                    card = renderBasicDocumentCard(doc);
                }
                    }
                    
                    if (card) {
                        fragment.appendChild(card);
            } else {
                console.error(`Failed to create card for document ${doc.id}`);
            }
        } catch (error) {
            console.error(`Error rendering document ${doc.id}:`, error);
            
            // Create a basic fallback card
            const fallbackCard = document.createElement('div');
            fallbackCard.className = 'document-card error-card';
            fallbackCard.innerHTML = `
                <div class="card-header">
                    <h3>${doc.title || 'Untitled Document'}</h3>
                </div>
                <div class="card-body">
                    <p>Error rendering document: ${error.message}</p>
                </div>
            `;
            fragment.appendChild(fallbackCard);
        }
    });
    
    // Append all cards to container
            container.appendChild(fragment);
            
    // Update the visible entries count
    if (window.documentFilters) {
        window.documentFilters.setVisibleEntriesCount(renderedDocIds.size);
    }
    
    console.log(`Rendered ${renderedDocIds.size} unique documents`);
}

/**
 * Render documents using a basic card layout when document components are not available
 * @param {HTMLElement} container - Container to render documents in
 * @param {Array} documents - Array of document objects to render
 */
function renderBasicDocuments(container, documents) {
    console.log('Rendering basic document cards as fallback');
    
    // Clear container
    container.innerHTML = '';
    
    // Reset tracking variables
    globalDisplayedDocIds = new Set();
    
    // If no documents, show empty state
    if (!documents || documents.length === 0) {
        container.innerHTML = `
            <div class="no-docs">
                <div class="empty-state">
                    <i class="fas fa-file-alt empty-icon"></i>
                    <p>No documents found</p>
                </div>
            </div>`;
        return;
    }
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Process each document
    documents.forEach(doc => {
            // Skip if already displayed
            if (globalDisplayedDocIds.has(doc.id)) {
                return;
            }
            
            globalDisplayedDocIds.add(doc.id);
            
        // Create a basic document card
        const card = renderBasicDocumentCard(doc);
            fragment.appendChild(card);
    });
    
    // Append all cards to container
    container.appendChild(fragment);
    
    // Update the visible entries count
    if (window.documentFilters) {
        window.documentFilters.setVisibleEntriesCount(documents.length);
    }
}

/**
 * Create a basic document card for fallback rendering
 * @param {Object} doc - Document object
 * @returns {HTMLElement} - Basic document card element
 */
function renderBasicDocumentCard(doc) {
    const card = document.createElement('div');
    card.className = 'document-card';
    card.dataset.documentId = doc.id;
    
    // Determine if it's a compiled document
    const isCompiled = doc.is_compiled === true;
    if (isCompiled) {
        card.classList.add('compiled');
    }
    
    // Format authors - handle different possible formats
    let authors = 'Unknown Author';
    if (doc.authors) {
        console.log(`Formatting authors for doc ${doc.id}:`, doc.authors);
        
        if (Array.isArray(doc.authors)) {
            if (doc.authors.length > 0) {
                // Format depends on the structure of author objects
                if (typeof doc.authors[0] === 'string') {
                    // Simple array of strings
                    authors = doc.authors.join(', ');
                } else if (doc.authors[0].full_name) {
                    // Array of objects with full_name
                    authors = doc.authors.map(author => author.full_name).join(', ');
                } else if (doc.authors[0].first_name || doc.authors[0].last_name) {
                    // Array of objects with first_name/last_name
                    authors = doc.authors.map(author => 
                        `${author.first_name || ''} ${author.last_name || ''}`.trim()
                    ).join(', ');
                                } else {
                    // Unknown format, dump whatever we have
                    authors = doc.authors.map(author => 
                        typeof author === 'object' ? JSON.stringify(author) : author
                    ).join(', ');
                }
            }
        } else if (typeof doc.authors === 'string') {
            // Direct string
            authors = doc.authors;
        } else if (typeof doc.authors === 'object') {
            // Single author object
            authors = doc.authors.full_name || 
                     `${doc.authors.first_name || ''} ${doc.authors.last_name || ''}`.trim() ||
                     JSON.stringify(doc.authors);
        }
    }
    
    // Format publication date with better display
    let pubDate = 'Unknown Date';
    if (doc.publish_date) {
        const dateObj = new Date(doc.publish_date);
        if (!isNaN(dateObj.getTime())) {
            pubDate = dateObj.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } else if (doc.publication_date) {
        const dateObj = new Date(doc.publication_date);
        if (!isNaN(dateObj.getTime())) {
            pubDate = dateObj.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } else if (isCompiled && doc.start_year) {
        pubDate = doc.start_year + (doc.end_year ? `-${doc.end_year}` : '');
    }
    
    // Get the appropriate icon for the category
    const getCategoryIcon = (category) => {
        const iconMap = {
            'THESIS': 'icons/Category-icons/thesis.png',
            'Thesis': 'icons/Category-icons/thesis.png',
            'DISSERTATION': 'icons/Category-icons/dissertation.png',
            'Dissertation': 'icons/Category-icons/dissertation.png',
            'CONFLUENCE': 'icons/Category-icons/confluence.png',
            'Confluence': 'icons/Category-icons/confluence.png',
            'SYNERGY': 'icons/Category-icons/synergy.png',
            'Synergy': 'icons/Category-icons/synergy.png'
        };
        return iconMap[category] || 'icons/Category-icons/default_category_icon.png';
    };
    
    // Format the document_type into a readable category name
    const formatDocumentType = (type) => {
        if (!type) return 'Uncategorized';
        
        // Convert to title case (first letter uppercase, rest lowercase)
        return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    };
    
    // Use document_type for category, fallback to category_name or category
    const documentType = doc.document_type || '';
    let category = formatDocumentType(documentType) || doc.category_name || doc.category || 'Uncategorized';
    
    // Change Synergy to Departmental
    if (category === 'Synergy') {
        category = 'Departmental';
    }
    
    console.log(`Rendering document ${doc.id} with type: ${documentType}, displayed as category: ${category}`);
    
    // Create the document card structure
    card.innerHTML = `
        <div class="document-icon">
            <img src="${getCategoryIcon(documentType || category)}" alt="${category} Icon">
        </div>
        <div class="document-info">
            <h3 class="document-title">
                ${isCompiled ? '<span class="toggle-indicator">▶</span>' : ''}
                ${doc.title || 'Untitled Document'} 
            </h3>
            <div class="document-meta">
                ${isCompiled ? 
                    `Volume ${doc.volume || ''} | <span class="publication-date"><i class="fas fa-calendar-day"></i> Published: ${pubDate}</span> | ${doc.child_count || 0} document${doc.child_count !== 1 ? 's' : ''}` : 
                    `<span class="author-list" data-document-id="${doc.id}"><i class="fas fa-user"></i> ${authors}</span> | <span class="publication-date"><i class="fas fa-calendar-day"></i> Published: ${pubDate}</span>`
                }
            </div>
            ${isCompiled ? 
                `<div class="category-badge ${(documentType || '').toLowerCase()}">${category}</div>` : 
                ''
            }
        </div>
        <div class="document-actions">
            ${isCompiled ? '' : 
            `<button class="action-btn view-btn" data-document-id="${doc.id}">
                <i class="fas fa-eye"></i> 
            </button>`}
            <button class="action-btn edit-btn" data-document-id="${doc.id}">
                <i class="fas fa-edit"></i> 
            </button>
            ${doc.parent_compiled_id ? '' : 
            `<button class="action-btn delete-btn" data-document-id="${doc.id}">
                <i class="fas fa-trash"></i> 
            </button>`}
        </div>
    `;
    
    // For non-compiled documents, fetch authors directly from API
    if (!isCompiled) {
        // Only fetch if the authors array is empty or doesn't look right
        if (!doc.authors || doc.authors.length === 0 || 
            (Array.isArray(doc.authors) && doc.authors.length > 0 && !doc.authors[0].full_name)) {
            fetchAuthorsForDocument(doc.id).then(authorData => {
                if (authorData && authorData.length > 0) {
                    const authorNames = authorData.map(author => author.full_name).join(', ');
                    const authorSpan = card.querySelector(`.author-list[data-document-id="${doc.id}"]`);
                    if (authorSpan) {
                        authorSpan.textContent = authorNames || 'Unknown Author';
                    }
                }
                                    });
                            }
                        }
    
    // Add event listeners
    if (!isCompiled) {
        card.querySelector('.view-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            // Call preview function if available, or show alert
            if (typeof showPreviewModal === 'function') {
                showPreviewModal(doc.id);
                    } else {
                alert(`Preview document: ${doc.title}`);
                }
            });
        }
    
    card.querySelector('.edit-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        // Call edit function if available, or show alert
        if (typeof editDocument === 'function') {
            editDocument(doc.id, isCompiled);
        } else {
            alert(`Edit document: ${doc.title}`);
        }
    });
    
    // Only add delete button event listener if the button exists (not a child document)
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Call delete function if available, or show alert
            if (typeof deleteDocument === 'function') {
                deleteDocument(doc.id);
                        } else {
                alert(`Delete document: ${doc.title}`);
            }
        });
    }
    
    // For compiled documents, add click handler to toggle children
    if (isCompiled) {
        // Make the title clickable for toggle
        const titleElement = card.querySelector('.document-title');
        titleElement.style.cursor = 'pointer';
        titleElement.addEventListener('click', function() {
            toggleCompiledDocument(doc.id, card);
        });
    }
    
    return card;
}

/**
 * Toggle the display of children for a compiled document
 * @param {string|number} documentId - Document ID
 * @param {HTMLElement} card - The card element
 * @param {boolean} forceOpen - Optional parameter to force the children container to open
 */
function toggleCompiledDocument(documentId, card, forceOpen = false) {
    // Ensure we have a valid document ID
    if (!documentId) {
        console.error("Cannot toggle document with undefined ID");
        return;
    }

    console.log(`Toggling compiled document ${documentId}, forceOpen: ${forceOpen}`);
    
    // Get the card's wrapper (parent)
    const wrapper = card.closest('.compiled-document-wrapper');
    if (!wrapper) {
        console.error(`No wrapper found for document ${documentId}`);
        return;
    }
    
    // Find children container as a sibling to the card
    let childrenContainer = wrapper.querySelector(`.children-container[data-parent="${documentId}"]`);
    
    if (!childrenContainer) {
        // Create the container for child documents
        childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';
        childrenContainer.dataset.parent = documentId;
        childrenContainer.style.display = 'none';
        childrenContainer.style.marginTop = '0';
        childrenContainer.style.marginBottom = '15px';
        childrenContainer.style.width = '95%';
        childrenContainer.style.marginLeft = 'auto';
        
        // Insert after the card
        wrapper.appendChild(childrenContainer);
        
        // Fetch children documents
        fetchChildDocuments(documentId, childrenContainer);
        
        // Update indicator
        const indicator = card.querySelector('.toggle-indicator');
        if (indicator) {
            indicator.textContent = '▼';
        }
        
        // Force display
        childrenContainer.style.display = 'block';
        
        // Update tracking array
        if (!expandedDocIds.includes(documentId)) {
            expandedDocIds.push(documentId);
            console.log(`