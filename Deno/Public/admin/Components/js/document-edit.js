/**
 * Document edit functionality
 * Handles editing of existing documents
 */

console.log('Document edit module loaded');

// Add toast notification styles
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            max-width: 250px;
            font-size: 14px;
            padding: 10px 15px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            opacity: 0;
            transform: translateY(10px);
            animation: slide-in-toast 0.3s forwards;
        }
        
        @keyframes slide-in-toast {
            to { opacity: 1; transform: translateY(0); }
        }
        
        .toast-success {
            background-color: #e8f5e9;
            color: #2e7d32;
            border-left: 3px solid #2e7d32;
        }
        
        .toast-error {
            background-color: #ffebee;
            color: #c62828;
            border-left: 3px solid #c62828;
        }
        
        /* Success Popup Styles */
        .success-popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        
        .success-popup {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
            padding: 25px 30px;
            text-align: center;
            max-width: 300px;
            animation: popup-appear 0.3s ease-out;
        }
        
        @keyframes popup-appear {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
        }
        
        .success-popup-icon {
            color: #2e7d32;
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        .success-popup-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #333;
        }
        
        .success-popup-message {
            font-size: 16px;
            color: #666;
            margin-bottom: 20px;
        }
        
        .success-popup-button {
            background-color: #2e7d32;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .success-popup-button:hover {
            background-color: #1b5e20;
        }
        
        /* Dropdown Styles */
        .dropdown-list {
            position: absolute;
            background-color: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            width: 100%;
            max-height: 250px;
            overflow-y: auto;
            z-index: 1000;
            margin-top: 2px;
        }
        
        .dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            transition: background-color 0.2s;
        }
        
        .dropdown-item:hover {
            background-color: #f5f5f5;
        }
        
        .dropdown-item .item-name {
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        .dropdown-item .item-detail {
            font-size: 12px;
            color: #666;
        }
        
        .dropdown-item .item-detail-small {
            font-size: 11px;
            color: #888;
        }
        
        .dropdown-item.no-results,
        .dropdown-item.error,
        .dropdown-item.loading {
            color: #888;
            font-style: italic;
        }
        
        .dropdown-item.create-new {
            color: #2e7d32;
            font-weight: 500;
        }
        
        .dropdown-item.create-new i {
            margin-right: 5px;
        }
        
        /* Selected items styles */
        .selected-author,
        .selected-topic {
            display: inline-block;
            background-color: #e3f2fd;
            color: #1565c0;
            padding: 4px 8px;
            border-radius: 4px;
            margin: 4px;
            font-size: 14px;
        }
        
        .selected-topic {
            background-color: #e8f5e9;
            color: #2e7d32;
        }
        
        .remove-author,
        .remove-topic {
            margin-left: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        
        .remove-author:hover,
        .remove-topic:hover {
            color: #f44336;
        }
    `;
    document.head.appendChild(style);
})();

// Function to show a toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

// Document edit module
window.documentEdit = {
    // Function to show the edit modal for a single document
    showEditModal: function(documentId) {
        console.log(`Showing edit modal for document ID: ${documentId}`);
        
        // First, load the modals HTML if not already loaded
        this.loadModalHTML().then(() => {
            // Get the modal elements
            const modal = document.getElementById('edit-single-document-modal');
            if (!modal) {
                console.error('Edit modal not found in DOM');
                showToast('Error loading edit modal. Please refresh the page and try again.', 'error');
                return;
            }
            
            // Show a loading indicator
            showToast('Loading document data...', 'info');
            
            // Set the document ID in the form
            document.getElementById('edit-single-document-id').value = documentId;
            
            // Display the modal first with a loading state
            modal.style.display = 'flex';
            
            // Add a loading indicator to the form
            const form = modal.querySelector('.left-panel');
            if (form) {
                const loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-spin"></i></div><div class="loading-text">Loading document data...</div>';
                form.appendChild(loadingOverlay);
            }
            
            // Fetch document data and populate the form
            this.fetchDocumentData(documentId, false)
                .then(data => {
                    // Remove loading overlay
                    const loadingOverlay = modal.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.remove();
                    }
                    
                    this.populateEditForm(data);
                })
                .catch(error => {
                    console.error('Error fetching document data:', error);
                    showToast('Error loading document data. Please try again.', 'error');
                    
                    // Remove loading overlay
                    const loadingOverlay = modal.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.remove();
                    }
                    
                    // Show error in the form
                    const formContent = modal.querySelector('.left-panel');
                    if (formContent) {
                        formContent.innerHTML = `
                            <div class="error-container">
                                <i class="fas fa-exclamation-triangle"></i>
                                <h3>Error Loading Document</h3>
                                <p>${error.message}</p>
                                <button class="btn-secondary cancel-edit-btn">Close</button>
                            </div>
                        `;
                        
                        const closeBtn = formContent.querySelector('.cancel-edit-btn');
                        if (closeBtn) {
                            closeBtn.addEventListener('click', () => {
                                modal.style.display = 'none';
                            });
                        }
                    }
                });
        }).catch(error => {
            console.error('Error loading modal HTML:', error);
            showToast('Error loading edit modal. Please refresh the page and try again.', 'error');
        });
    },
    
    // Function to show the edit modal for a compiled document
    showCompiledEditModal: function(documentId) {
        console.log(`Showing edit modal for compiled document ID: ${documentId}`);
        
        // First, load the modals HTML if not already loaded
        this.loadModalHTML().then(() => {
        // Find the modal and ensure it exists
        const modal = document.getElementById('edit-compiled-document-modal');
        if (!modal) {
            console.error('Compiled document edit modal not found!');
                showToast('Error loading edit modal. Please refresh the page and try again.', 'error');
            return;
        }
            
            // Show a loading indicator
            showToast('Loading compiled document data...', 'info');
            
            // Set the document ID in the form
            document.getElementById('edit-compiled-document-id').value = documentId;
            
            // Display the modal first with a loading state
            modal.style.display = 'flex';
            
            // Add a loading indicator to the form
            const form = modal.querySelector('.left-panel');
            if (form) {
                const loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.innerHTML = '<div class="spinner"></div><div class="loading-text">Loading compiled document data...</div>';
                form.appendChild(loadingOverlay);
        }
        
        // Set up the modal event listeners
        this.setupModalEventListeners();
        
            // Fetch document data - use a proper compiled endpoint
            console.log('Fetching compiled document data for ID:', documentId);
            this.fetchCompiledDocumentData(documentId)
            .then(data => {
                // Log data for debugging
                    console.log('Compiled document data fetched successfully:', data);
                    
                    // Remove loading overlay
                    const loadingOverlay = modal.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.remove();
                }
                
                // Populate form with data
                this.populateCompiledEditForm(data);
            })
            .catch(error => {
                    console.error('Error fetching compiled document data:', error);
                    
                    // Remove loading overlay
                    const loadingOverlay = modal.querySelector('.loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.remove();
                    }
                    
                    // Show error in the form
                    const formContent = modal.querySelector('.left-panel');
                    if (formContent) {
                        formContent.innerHTML = `
                            <div class="error-container">
                                <i class="fas fa-exclamation-triangle"></i>
                                <h3>Error Loading Compiled Document</h3>
                                <p>${error.message}</p>
                                <button class="btn-secondary cancel-edit-btn">Close</button>
                            </div>
                        `;
                        
                        const closeBtn = formContent.querySelector('.cancel-edit-btn');
                        if (closeBtn) {
                            closeBtn.addEventListener('click', () => {
                                modal.style.display = 'none';
                            });
                        }
                    }
                    
                    showToast('Error loading compiled document data. Please try again.', 'error');
                });
        }).catch(error => {
            console.error('Error loading modal HTML:', error);
            showToast('Error loading edit modal. Please refresh the page and try again.', 'error');
            });
    },
    
    // Specialized function to fetch compiled document data
    fetchCompiledDocumentData: function(documentId) {
        return new Promise(async (resolve, reject) => {
            console.log(`Fetching compiled document data for ID: ${documentId}`);
            
            // Define compiled-specific endpoints to try in sequence
            const compiledEndpoints = [
                `/api/compiled-documents/${documentId}?include_children=true&include_authors=true&include_topics=true`,
                `/api/compiled-documents/${documentId}`,
                `/api/documents/${documentId}?include_children=true&include_authors=true&include_topics=true`,
                `/api/documents/${documentId}`
            ];
            
            let documentData = null;
            let lastError = null;
            
            // Try each endpoint in sequence until we get data
            for (const endpoint of compiledEndpoints) {
                try {
                    console.log(`Trying to fetch from compiled endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`Got data from compiled endpoint: ${endpoint}`, data);
                        
                        // Detailed logging of the received data
                        console.log('Received document structure:', Object.keys(data));
                        if (data.children) console.log(`Children data: ${data.children.length} items`);
                        if (data.authors) console.log(`Authors data: ${data.authors.length} items`);
                        if (data.research_agenda) console.log(`Research agenda data: ${data.research_agenda.length} items`);
                        if (data.topics) console.log(`Topics data: ${data.topics.length} items`);
                        
                        // Process and normalize the data
                        documentData = this.normalizeCompiledDocumentData(data, documentId);
                        break; // We have data, break out of the loop
                    } else {
                        console.warn(`Compiled endpoint ${endpoint} failed with status ${response.status}`);
                        lastError = new Error(`Failed to fetch compiled document: ${response.status}`);
                    }
                } catch (error) {
                    console.warn(`Error trying compiled endpoint ${endpoint}:`, error);
                    lastError = error;
                }
            }
            
            // If we have data, only fetch missing pieces if necessary
            if (documentData) {
                console.log('Document data after normalization:', documentData);
                
                try {
                    const promises = [];
                    
                    // Only fetch children if not already included and they should be included
                    if ((!documentData.children || documentData.children.length === 0) && 
                        !compiledEndpoints[0].includes('failed_already')) {
                        // Only add this promise if we need it
                        promises.push(this.fetchChildrenIfNeeded(documentId, documentData));
                    } else {
                        console.log('Using existing children data:', documentData.children.length, 'items');
                    }
                    
                    // Only fetch authors if not already included
                    if (!documentData.authors || documentData.authors.length === 0) {
                        promises.push(this.fetchAuthorsIfNeeded(documentId, documentData));
                    } else {
                        console.log('Using existing authors data:', documentData.authors.length, 'items');
                    }
                    
                    // Only fetch research agenda if not already included
                    if ((!documentData.research_agenda || documentData.research_agenda.length === 0) &&
                        (!documentData.topics || documentData.topics.length === 0)) {
                        promises.push(this.fetchResearchAgendaIfNeeded(documentId, documentData));
                    } else {
                        console.log('Using existing research agenda data:', 
                            documentData.research_agenda ? documentData.research_agenda.length : 0, 'items');
                    }
                    
                    // Wait for any needed fetches to complete
                    if (promises.length > 0) {
                        console.log(`Fetching ${promises.length} additional data pieces`);
                        await Promise.all(promises);
                    } else {
                        console.log('All data available, no additional fetches needed');
                    }
                    
                    console.log('Final compiled document data:', documentData);
                    // Resolve with the complete data
                    resolve(documentData);
                } catch (error) {
                    console.error('Error fetching additional compiled document data:', error);
                    // Still resolve with partial data
                    resolve(documentData);
                }
            } else {
                // No data found, reject with error
                reject(lastError || new Error('Failed to fetch compiled document data'));
            }
        });
    },
    
    // Helper function to fetch children only if needed
    fetchChildrenIfNeeded: async function(documentId, documentData) {
        if (!documentData.children || documentData.children.length === 0) {
            const childrenEndpoints = [
                `/api/compiled-documents/${documentId}/children`,
                `/compiled-documents/${documentId}/children`
            ];
            
            for (const childEndpoint of childrenEndpoints) {
                try {
                    console.log(`Trying to fetch children from: ${childEndpoint}`);
                    const childResponse = await fetch(childEndpoint);
                    if (childResponse.ok) {
                        const childData = await childResponse.json();
                        console.log('Children data response:', childData);
                        if (childData.children && Array.isArray(childData.children)) {
                            documentData.children = childData.children;
                            console.log(`Fetched ${documentData.children.length} child documents from ${childEndpoint}`);
                            return;
                        } else if (Array.isArray(childData)) {
                            documentData.children = childData;
                            console.log(`Fetched ${documentData.children.length} child documents (array format) from ${childEndpoint}`);
                            return;
                        }
                    } else {
                        console.warn(`Children endpoint ${childEndpoint} failed: ${childResponse.status}`);
                    }
                } catch (childError) {
                    console.warn(`Error fetching children from ${childEndpoint}:`, childError);
                }
            }
            console.log('Could not fetch children, using empty array');
            documentData.children = [];
        }
    },
    
    // Helper function to fetch authors only if needed
    fetchAuthorsIfNeeded: async function(documentId, documentData) {
        try {
            console.log('Fetching authors separately');
            const authors = await this.fetchAuthorsForDocument(documentId);
            if (authors && authors.length > 0) {
                documentData.authors = authors;
                console.log(`Fetched ${authors.length} authors separately`);
            } else {
                console.log('No authors found, using empty array');
                documentData.authors = [];
            }
        } catch (authorError) {
            console.warn('Failed to fetch authors separately:', authorError);
            documentData.authors = [];
        }
    },
    
    // Helper function to fetch research agenda only if needed
    fetchResearchAgendaIfNeeded: async function(documentId, documentData) {
        try {
            console.log('Fetching research agenda separately');
            const topics = await this.fetchResearchAgendaForDocument(documentId);
            if (topics && topics.length > 0) {
                documentData.research_agenda = topics;
                console.log(`Fetched ${topics.length} research agenda items separately`);
            } else {
                console.log('No research agenda items found, using empty array');
                documentData.research_agenda = [];
            }
        } catch (topicError) {
            console.warn('Failed to fetch research agenda separately:', topicError);
            documentData.research_agenda = [];
        }
    },
    
    // Helper function to normalize compiled document data
    normalizeCompiledDocumentData: function(data, documentId) {
        // Ensure we have the basic structure
        const normalizedData = {
            id: data.id || documentId,
            title: data.title || 'Untitled Compiled Document',
            document_type: data.document_type || data.category || data.type || 'CONFLUENCE',
            is_compiled: true
        };
        
        // Copy all other fields
        Object.keys(data).forEach(key => {
            normalizedData[key] = data[key];
        });
        
        // Normalize date fields - if publication_date exists but date_published doesn't
        if (data.publication_date && !normalizedData.date_published) {
            normalizedData.date_published = data.publication_date;
            console.log('Mapped publication_date to date_published:', data.publication_date);
        }
        
        // Handle the case where topics is populated but research_agenda isn't
        if (data.topics && Array.isArray(data.topics) && (!normalizedData.research_agenda || normalizedData.research_agenda.length === 0)) {
            normalizedData.research_agenda = data.topics;
            console.log('Mapped topics to research_agenda:', data.topics.length, 'items');
        }
        
        // Make sure children is an array
        if (!normalizedData.children) {
            normalizedData.children = [];
        } else if (!Array.isArray(normalizedData.children)) {
            normalizedData.children = [];
        }
        
        // Make sure authors is an array
        if (!normalizedData.authors) {
            normalizedData.authors = [];
        } else if (!Array.isArray(normalizedData.authors)) {
            normalizedData.authors = [];
        }
        
        // Make sure research_agenda is an array
        if (!normalizedData.research_agenda) {
            normalizedData.research_agenda = [];
        } else if (!Array.isArray(normalizedData.research_agenda)) {
            normalizedData.research_agenda = [];
        }
        
        console.log('Normalized document data:', normalizedData);
        return normalizedData;
    },
    
    // Load the modal HTML if not already present
    loadModalHTML: function() {
        return new Promise((resolve, reject) => {
            // Check if modals are already loaded
            if (document.getElementById('edit-single-document-modal') && 
                document.getElementById('edit-compiled-document-modal') &&
                document.getElementById('pdf-viewer-modal')) {
                console.log('Modals already loaded in the DOM, re-initializing event listeners');
                this.setupModalEventListeners();
                resolve();
                return;
            }
            
            console.log('Loading edit modal HTML');
            
            // Load the modal HTML
            fetch('/admin/Components/modals/edit-document-modals.html')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load modals: ${response.status}`);
                    }
                    return response.text();
                })
                .then(html => {
                    console.log('Modal HTML loaded successfully, length:', html.length);
                    
                    // Create a temporary div to hold the HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    
                    // Extract the modals from the HTML
                    const modals = [
                        tempDiv.querySelector('#edit-single-document-modal'),
                        tempDiv.querySelector('#edit-compiled-document-modal'),
                        tempDiv.querySelector('#select-child-document-modal'),
                        tempDiv.querySelector('#pdf-viewer-modal')
                    ];
                    
                    // Log what we found to help with debugging
                    console.log('Found modals:', 
                        modals[0] ? 'single-edit ✓' : 'single-edit ✗',
                        modals[1] ? 'compiled-edit ✓' : 'compiled-edit ✗',
                        modals[2] ? 'select-child ✓' : 'select-child ✗',
                        modals[3] ? 'pdf-viewer ✓' : 'pdf-viewer ✗'
                    );
                    
                    // Check if we found all the required modals
                    if (!modals[0] || !modals[1] || !modals[3]) {
                        console.error('Some required modals were not found in the loaded HTML');
                        // Try to extract the entire body contents as a fallback
                        const bodyContent = tempDiv.querySelector('body');
                        if (bodyContent) {
                            console.log('Attempting to use entire body content as fallback');
                            document.body.insertAdjacentHTML('beforeend', bodyContent.innerHTML);
                        } else {
                            console.error('No body content found in the HTML');
                            throw new Error('Required modals not found in HTML');
                        }
                    } else {
                        // Append the modals to the document body
                        modals.forEach(modal => {
                            if (modal) {
                                // Check if a modal with this ID already exists
                                const existingModal = document.getElementById(modal.id);
                                if (existingModal) {
                                    console.log(`Modal with ID ${modal.id} already exists, replacing`);
                                    existingModal.parentNode.replaceChild(modal, existingModal);
                                } else {
                                    document.body.appendChild(modal);
                                }
                            }
                        });
                    }
                    
                    // Set up event listeners for the modals
                    this.setupModalEventListeners();
                    
                    // Do a final check that everything loaded correctly
                    setTimeout(() => {
                        // Double-check that all required modals are in the DOM
                        const singleModal = document.getElementById('edit-single-document-modal');
                        const compiledModal = document.getElementById('edit-compiled-document-modal');
                        const pdfModal = document.getElementById('pdf-viewer-modal');
                        
                        if (!singleModal || !compiledModal || !pdfModal) {
                            console.error('Modals still missing after load:', 
                                !singleModal ? 'single-edit' : '',
                                !compiledModal ? 'compiled-edit' : '',
                                !pdfModal ? 'pdf-viewer' : ''
                            );
                            
                            // Try one more time with direct HTML insertion if needed
                            if (!singleModal || !compiledModal || !pdfModal) {
                                console.log('Attempting emergency direct HTML insertion');
                                this.insertEmergencyModals();
                            }
                        }
                    }, 100);
                    
                    resolve();
                })
                .catch(error => {
                    console.error('Error loading modals:', error);
                    reject(error);
                });
        });
    },
    
    // Emergency function to directly insert the most essential modal HTML
    insertEmergencyModals: function() {
        // Check which modals are missing
        const singleModal = document.getElementById('edit-single-document-modal');
        const compiledModal = document.getElementById('edit-compiled-document-modal');
        const pdfModal = document.getElementById('pdf-viewer-modal');
        
        // If PDF viewer modal is missing, insert a basic version
        if (!pdfModal) {
            const pdfModalHtml = `
                <div id="pdf-viewer-modal" style="display: none;">
                    <div class="pdf-modal-content">
                        <div class="pdf-modal-header">
                            <h3 id="pdf-viewer-title">Document Preview</h3>
                            <button id="close-pdf-btn" class="close-button">×</button>
                        </div>
                        <div class="pdf-container">
                            <iframe id="pdf-iframe" src=""></iframe>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', pdfModalHtml);
            console.log('Emergency PDF viewer modal inserted');
        }
        
        // Re-setup event listeners
        this.setupModalEventListeners();
    },
    
    // Set up event listeners for modals
    setupModalEventListeners: function() {
        console.log('Setting up modal event listeners');
        
        // Single document modal
        const singleModal = document.getElementById('edit-single-document-modal');
        if (singleModal) {
            console.log('Found single document modal');
            
            // Cancel button - try multiple selector approaches to ensure we find all buttons
            const cancelButtons = singleModal.querySelectorAll('.cancel-edit-btn, button.btn-secondary');
            console.log(`Found ${cancelButtons.length} cancel buttons in single document modal`);
            
            cancelButtons.forEach(button => {
                // Remove any existing event listeners to prevent duplicates
                button.removeEventListener('click', () => singleModal.style.display = 'none');
                
                // Add the event listener
                button.addEventListener('click', () => {
                    console.log('Cancel button clicked in single document modal');
                    singleModal.style.display = 'none';
                });
                
                console.log('Added click event listener to cancel button:', button);
            });
            
            // Form submission
            const form = document.getElementById('edit-single-document-form');
            if (form) {
                // Remove any existing listeners to prevent duplicates
                const oldListener = form._editSubmitListener;
                if (oldListener) {
                    form.removeEventListener('submit', oldListener);
                }
                
                // Create new listener
                const submitListener = (e) => {
                    e.preventDefault();
                    this.saveDocument(new FormData(form));
                };
                
                // Store reference to listener for future removal
                form._editSubmitListener = submitListener;
                
                // Add the event listener
                form.addEventListener('submit', submitListener);
            }
            
            // File upload handling
            const fileInput = document.getElementById('edit-single-document-file');
            const fileIndicator = document.getElementById('edit-single-document-file-indicator');
            if (fileInput && fileIndicator) {
                // Remove any existing listeners to prevent duplicates
                const oldListener = fileInput._editChangeListener;
                if (oldListener) {
                    fileInput.removeEventListener('change', oldListener);
                }
                
                // Create new listener
                const changeListener = (e) => {
                    if (fileInput.files.length > 0) {
                        fileIndicator.textContent = fileInput.files[0].name;
                    } else {
                        fileIndicator.textContent = '';
                    }
                };
                
                // Store reference to listener for future removal
                fileInput._editChangeListener = changeListener;
                
                // Add the event listener
                fileInput.addEventListener('change', changeListener);
            }
            
            // Initialize author search input
            const authorSearchInput = document.getElementById('edit-single-document-author-search');
            if (authorSearchInput && typeof window.initAuthorSearchInput === 'function') {
                this.initializeAuthorSearch(authorSearchInput, 'edit-single-document-selected-authors');
            } else {
                console.warn('Author search input or initialization function not found');
            }
            
            // Initialize research agenda search
            const topicSearchInput = document.getElementById('edit-single-document-topic-search');
            if (topicSearchInput) {
                this.initializeResearchAgendaSearch(topicSearchInput, 'edit-single-document-selected-topics');
            }
            
            // Read document button
            const readBtn = document.getElementById('edit-single-document-read-btn');
            if (readBtn) {
                console.log('Found read document button in single document modal');
                
                // Remove any existing event listeners to prevent duplicates
                readBtn.removeEventListener('click', readBtn._readBtnListener);
                
                // Create new listener with proper "this" context
                const self = this;
                const readBtnListener = function() {
                    console.log('Read document button clicked');
                    const docId = document.getElementById('edit-single-document-id').value;
                    console.log('Document ID for PDF viewer:', docId);
                    self.showPdfViewer(docId);
                };
                
                // Store reference to listener for future removal
                readBtn._readBtnListener = readBtnListener;
                
                // Add the event listener
                readBtn.addEventListener('click', readBtnListener);
                console.log('Added click event listener to read button');
            } else {
                console.warn('Read document button not found in single document modal!');
            }
        } else {
            console.warn('Single document modal not found!');
        }
        
        // Compiled document modal
        const compiledModal = document.getElementById('edit-compiled-document-modal');
        if (compiledModal) {
            console.log('Found compiled document modal');
            
            // Cancel button
            const cancelButtons = compiledModal.querySelectorAll('.cancel-edit-btn, button.btn-secondary');
            console.log(`Found ${cancelButtons.length} cancel buttons in compiled document modal`);
            
            cancelButtons.forEach(button => {
                // Remove any existing event listeners to prevent duplicates
                button.removeEventListener('click', () => compiledModal.style.display = 'none');
                
                // Add the event listener
                button.addEventListener('click', () => {
                    console.log('Cancel button clicked in compiled document modal');
                    compiledModal.style.display = 'none';
                });
                
                console.log('Added click event listener to cancel button:', button);
            });
            
            // Form submission
            const form = document.getElementById('edit-compiled-document-form');
            if (form) {
                // Remove any existing listeners to prevent duplicates
                const oldListener = form._editSubmitListener;
                if (oldListener) {
                    form.removeEventListener('submit', oldListener);
                }
                
                // Create new listener
                const submitListener = (e) => {
                    e.preventDefault();
                    this.saveCompiledDocument(new FormData(form));
                };
                
                // Store reference to listener for future removal
                form._editSubmitListener = submitListener;
                
                // Add the event listener
                form.addEventListener('submit', submitListener);
            }
            
            // Initialize author search input
            const authorSearchInput = document.getElementById('edit-compiled-document-author-search');
            if (authorSearchInput && typeof window.initAuthorSearchInput === 'function') {
                this.initializeAuthorSearch(authorSearchInput, 'edit-compiled-document-selected-authors');
            } else {
                console.warn('Author search input or initialization function not found');
            }
            
            // Initialize research agenda search
            const topicSearchInput = document.getElementById('edit-compiled-document-topic-search');
            if (topicSearchInput) {
                this.initializeResearchAgendaSearch(topicSearchInput, 'edit-compiled-document-selected-topics');
            }
            
            // File upload handling
            const fileInput = document.getElementById('edit-compiled-document-file');
            const fileIndicator = document.getElementById('edit-compiled-document-file-indicator');
            if (fileInput && fileIndicator) {
                // Remove any existing listeners to prevent duplicates
                const oldListener = fileInput._editChangeListener;
                if (oldListener) {
                    fileInput.removeEventListener('change', oldListener);
                }
                
                // Create new listener
                const changeListener = (e) => {
                    if (fileInput.files.length > 0) {
                        fileIndicator.textContent = fileInput.files[0].name;
                    } else {
                        fileIndicator.textContent = '';
                    }
                };
                
                // Store reference to listener for future removal
                fileInput._editChangeListener = changeListener;
                
                // Add the event listener
                fileInput.addEventListener('change', changeListener);
            }
            
            // Read document button
            const readBtn = document.getElementById('edit-compiled-document-read-btn');
            if (readBtn) {
                console.log('Found read document button in compiled document modal');
                
                // Remove any existing event listeners to prevent duplicates
                readBtn.removeEventListener('click', readBtn._readBtnListener);
                
                // Create new listener with proper "this" context
                const self = this;
                const readBtnListener = function() {
                    console.log('Read document button clicked');
                    const docId = document.getElementById('edit-compiled-document-id').value;
                    
                    // Check if document has a foreword and open it instead
                    fetch(`/api/documents/${docId}`)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Error fetching document: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then(document => {
                            if (document && document.foreword) {
                                console.log(`Opening foreword: ${document.foreword}`);
                                // Ensure we have a fully qualified URL by adding protocol and host if missing
                                let forewordPath = document.foreword;
                                
                                // If the path doesn't start with http or /, add the leading /
                                if (!forewordPath.startsWith('http') && !forewordPath.startsWith('/')) {
                                    forewordPath = '/' + forewordPath;
                                }
                                
                                // If the path is relative (starts with /), prepend the current origin
                                if (forewordPath.startsWith('/')) {
                                    forewordPath = window.location.origin + forewordPath;
                                }
                                
                                // Open in new tab
                                window.open(forewordPath, '_blank');
                            } else {
                                console.log('No foreword found, falling back to document PDF');
                    self.showPdfViewer(docId);
                            }
                        })
                        .catch(error => {
                            console.error('Error opening foreword:', error);
                            // Fallback to normal document view
                            self.showPdfViewer(docId);
                        });
                };
                
                // Store reference to listener for future removal
                readBtn._readBtnListener = readBtnListener;
                
                // Add the event listener
                readBtn.addEventListener('click', readBtnListener);
                console.log('Added click event listener to read button');
            } else {
                console.warn('Read document button not found in compiled document modal!');
            }
            
            // Add child document button
            const addChildBtn = document.getElementById('add-child-document-btn');
            if (addChildBtn) {
                // Remove any existing event listeners to prevent duplicates
                addChildBtn.removeEventListener('click', addChildBtn._addChildListener);
                
                // Create new listener with proper "this" context 
                const self = this;
                const addChildListener = function() {
                    self.showChildDocumentSelector();
                };
                
                // Store reference to listener for future removal
                addChildBtn._addChildListener = addChildListener;
                
                // Add the event listener
                addChildBtn.addEventListener('click', addChildListener);
            }
        } else {
            console.warn('Compiled document modal not found!');
        }
        
        // Child document selection modal
        const selectModal = document.getElementById('select-child-document-modal');
        if (selectModal) {
            // Cancel button
            const cancelBtn = document.getElementById('close-select-document-btn');
            if (cancelBtn) {
                // Remove any existing event listeners to prevent duplicates
                cancelBtn.removeEventListener('click', () => selectModal.style.display = 'none');
                
                // Add the event listener
                cancelBtn.addEventListener('click', () => {
                    selectModal.style.display = 'none';
                });
            }
            
            // Search input
            const searchInput = document.getElementById('child-document-search');
            if (searchInput) {
                // Remove any existing listeners to prevent duplicates
                const oldListener = searchInput._searchListener;
                if (oldListener) {
                    searchInput.removeEventListener('input', oldListener);
                }
                
                // Create new listener with proper "this" context
                const self = this;
                const searchListener = function(e) {
                    self.searchAvailableDocuments(e.target.value);
                };
                
                // Store reference to listener for future removal
                searchInput._searchListener = searchListener;
                
                // Add the event listener
                searchInput.addEventListener('input', searchListener);
            }
        }
        
        // PDF viewer modal
        const pdfModal = document.getElementById('pdf-viewer-modal');
        if (pdfModal) {
            // Close button
            const closeBtn = document.getElementById('close-pdf-btn');
            if (closeBtn) {
                // Remove any existing event listeners to prevent duplicates
                closeBtn.removeEventListener('click', () => pdfModal.style.display = 'none');
                
                // Add the event listener
                closeBtn.addEventListener('click', () => {
                    pdfModal.style.display = 'none';
                });
            }
        }
        
        console.log('Modal event listeners setup complete');
    },
    
    // Fetch document data for editing
    fetchDocumentData: function(documentId, isCompiled) {
        return new Promise((resolve, reject) => {
            console.log(`Fetching document data for ID: ${documentId}, isCompiled: ${isCompiled}`);
            
            // Try different potential endpoints for the document
            let endpoints = [];
            
            if (isCompiled) {
                // For compiled documents, try compiled-specific endpoints first
                endpoints = [
                    `/api/compiled-documents/${documentId}?include_children=true&include_authors=true&include_topics=true`,
                    `/api/compiled-documents/${documentId}`,
                    `/api/documents/${documentId}?include_children=true&include_authors=true&include_topics=true`,
                    `/api/documents/${documentId}`
                ];
            } else {
                // For regular documents, try standard endpoints
                endpoints = [
                    `/api/documents/${documentId}`,
                    `/api/document/${documentId}`
                ];
            }
            
            // Try each endpoint in sequence
            this.tryEndpoints(endpoints)
                .then(data => resolve(data))
                .catch(error => {
                    console.error('Error fetching document data:', error);
                    reject(error);
                });
        });
    },
    
    // Helper function for compatibility - uses loadChildDocuments
    populateChildDocumentsList: function(children) {
        console.log('Wrapper function for backward compatibility');
        this.loadChildDocuments(null, children);
    },
    
    // Helper function to fetch minimal document data when main endpoints fail
    fetchMinimalDocumentData: function(documentId, isCompiled) {
        return new Promise(async (resolve, reject) => {
            try {
                const minimalData = { id: documentId };
                
                // Try to at least get the title
                try {
                    const titleResponse = await fetch(`/api/documents/${documentId}/title`);
                    if (titleResponse.ok) {
                        const titleData = await titleResponse.json();
                        minimalData.title = titleData.title || 'Unknown Title';
                    }
                } catch (titleError) {
                    console.warn('Failed to fetch document title:', titleError);
                }
                
                // Try to get authors
                try {
                    const authors = await this.fetchAuthorsForDocument(documentId);
                    minimalData.authors = authors;
                } catch (authorsError) {
                    console.warn('Failed to fetch document authors:', authorsError);
                }
                
                // Try to get research agenda
                try {
                    const researchAgenda = await this.fetchResearchAgendaForDocument(documentId);
                    minimalData.research_agenda = researchAgenda;
                } catch (agendaError) {
                    console.warn('Failed to fetch document research agenda:', agendaError);
                }
                
                // For compiled documents, also try to get child documents
                if (isCompiled) {
                    try {
                        const childResponse = await fetch(`/api/compiled-documents/${documentId}/children`);
                        if (childResponse.ok) {
                            const childData = await childResponse.json();
                            minimalData.children = childData.children || [];
                        }
                    } catch (childError) {
                        console.warn('Failed to fetch child documents:', childError);
                        minimalData.children = [];
                    }
                }
                
                resolve(minimalData);
            } catch (error) {
                reject(error);
            }
        });
    },
    
    // Helper function to try multiple endpoints in sequence
    tryEndpoints: function(endpoints) {
        return new Promise(async (resolve, reject) => {
            let lastError = null;
            let partialData = null;
            
            // Extract ID from the first endpoint URL to use as fallback
            const idMatch = endpoints[0].match(/\/(\d+)(?:\?|$)/);
            const docId = idMatch ? idMatch[1] : 'unknown';
            
            // Check if this might be a compiled document based on endpoints
            const isLikelyCompiled = endpoints.some(ep => ep.includes('compiled'));
            
            // If compiled document, make sure we include compiled-specific endpoints
            if (isLikelyCompiled) {
                // Make sure we have compiled document endpoints
                const compiledEndpoints = [
                    `/api/compiled-documents/${docId}?include_children=true&include_authors=true&include_topics=true`,
                    `/api/compiled-documents/${docId}`
                ];
                
                // Add compiledEndpoints to the beginning of the endpoints array if they're not already there
                compiledEndpoints.forEach(ep => {
                    if (!endpoints.includes(ep)) {
                        endpoints.unshift(ep);
                    }
                });
                
                console.log('Document appears to be compiled, prioritizing compiled endpoints:', 
                            endpoints.slice(0, 2));
            }
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`Trying to fetch from endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // If we get some data, save it even if incomplete
                        if (data && Object.keys(data).length > 0) {
                            console.log(`Got data from endpoint: ${endpoint}`, data);
                            
                            // Normalize date fields - if publication_date exists but date_published doesn't
                            if (data.publication_date && !data.date_published) {
                                data.date_published = data.publication_date;
                                console.log('Mapped publication_date to date_published:', data.publication_date);
                            }
                            
                            // Mark as compiled if it came from a compiled endpoint
                            if (endpoint.includes('compiled') && !data.is_compiled) {
                                data.is_compiled = true;
                            }
                            
                            // Save any data we get, even if it's partial
                            if (partialData) {
                                // Merge with previous partial data, preferring newer values
                                partialData = { ...partialData, ...data };
                            } else {
                                partialData = data;
                            }
                            
                            // If this looks like complete data, break out of the loop
                            if (data.title && (data.document_type || data.category)) {
                                break;
                            }
                        }
                    } else {
                        console.log(`Endpoint ${endpoint} failed with status ${response.status}`);
                        lastError = new Error(`Failed to fetch document: ${response.status}`);
                    }
                } catch (error) {
                    console.log(`Error trying endpoint ${endpoint}:`, error);
                    lastError = error;
                }
            }
            
            // If we didn't get any data at all, create fallback data
            if (!partialData || Object.keys(partialData).length === 0) {
                console.warn(`No data found for document ${docId}, using fallback defaults`);
                partialData = {
                                id: docId,
                                title: 'Untitled Document',
                                document_type: '',
                                date_published: new Date().toISOString(),
                                abstract: '',
                                authors: [],
                    research_agenda: [],
                    children: [],
                    is_compiled: isLikelyCompiled
                };
                        }
                        
                        // Ensure document ID is available
            if (!partialData.id) {
                partialData.id = docId;
            }
            
            // Ensure critical fields exist with defaults if missing
            if (!partialData.title) partialData.title = 'Untitled Document';
            if (!partialData.document_type && !partialData.category) partialData.document_type = '';
            if (!partialData.authors) partialData.authors = [];
            if (!partialData.research_agenda) partialData.research_agenda = [];
            if (!partialData.children) partialData.children = [];
            
            // Also ensure the date field exists
            if (!partialData.date_published && partialData.publication_date) {
                partialData.date_published = partialData.publication_date;
            } else if (!partialData.date_published) {
                partialData.date_published = new Date().toISOString();
            }
            
            // If we know it's compiled, mark it accordingly
            if (isLikelyCompiled && !partialData.is_compiled) {
                partialData.is_compiled = true;
            }
            
            try {
                // Only fetch additional author/topic data if endpoints didn't already include them
                // and avoid making extra API calls if we're dealing with a compiled document
                // which often has specific endpoints for these
                const shouldFetchAdditional = !endpoints.some(ep => 
                    ep.includes('include_authors') || ep.includes('include_topics'));
                
                if (shouldFetchAdditional) {
                    // Try to fetch additional data separately
                    const [authors, researchAgenda] = await Promise.all([
                        // Only fetch authors if we don't already have them
                        (!partialData.authors || partialData.authors.length === 0) 
                            ? this.fetchAuthorsForDocument(partialData.id).catch(() => [])
                            : Promise.resolve(partialData.authors),
                        
                        // Only fetch research agenda if we don't already have it
                        (!partialData.research_agenda || partialData.research_agenda.length === 0) 
                            ? this.fetchResearchAgendaForDocument(partialData.id).catch(() => [])
                            : Promise.resolve(partialData.research_agenda)
                    ]);
                    
                    // Merge the data - don't override if we already have values
                    if (authors && authors.length > 0) {
                        partialData.authors = authors;
                    }
                    
                    if (researchAgenda && researchAgenda.length > 0) {
                        partialData.research_agenda = researchAgenda;
                    }
                }
                
                // Always resolve with whatever data we have - never reject
                resolve(partialData);
            } catch (error) {
                console.error('Error fetching additional data:', error);
                // Still resolve with partial data even if additional fetches fail
                resolve(partialData);
            }
        });
    },
    
    // Fetch authors for a document separately
    fetchAuthorsForDocument: function(documentId) {
        console.log(`Fetching authors for document ${documentId}`);
        
        // Try multiple potential endpoints, adding compiled-specific endpoints
        const endpoints = [
            `/api/document-authors/${documentId}`,
            `/api/documents/${documentId}/authors`,
            `/document-authors/${documentId}`,
            `/api/compiled-documents/${documentId}/authors`,
            `/compiled-documents/${documentId}/authors`
        ];
        
        return new Promise(async (resolve, reject) => {
            try {
                let authors = [];
                let succeeded = false;
                
                // Try each endpoint sequentially
                for (const endpoint of endpoints) {
                    try {
                        console.log(`Trying to fetch authors from: ${endpoint}`);
                        const response = await fetch(endpoint);
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`Authors data from ${endpoint}:`, data);
                            
                            // Handle different API response formats
                            if (data.authors && Array.isArray(data.authors)) {
                                authors = data.authors;
                                succeeded = true;
                                console.log(`Found ${authors.length} authors at ${endpoint}`);
                                break;
                            } else if (Array.isArray(data)) {
                                authors = data;
                                succeeded = true;
                                console.log(`Found ${authors.length} authors at ${endpoint} (array format)`);
                                break;
                            } else if (data.document_authors && Array.isArray(data.document_authors)) {
                                authors = data.document_authors;
                                succeeded = true;
                                console.log(`Found ${authors.length} authors at ${endpoint} (document_authors format)`);
                                break;
                            } else {
                                console.warn(`Response from ${endpoint} doesn't contain authors in expected format:`, data);
                            }
                        } else {
                            console.warn(`Failed to fetch authors from ${endpoint}: ${response.status}`);
                        }
                    } catch (endpointError) {
                        console.warn(`Error fetching authors from ${endpoint}:`, endpointError);
                    }
                }
                
                // Skip the document extraction fallback for compiled documents
                // since this often fails with 404 errors
                const isCompiled = documentId && String(documentId).startsWith('C');
                
                // If no authors found and not a compiled doc, try one more strategy - get document and extract authors
                if (!succeeded && authors.length === 0 && !isCompiled) {
                    try {
                        console.log('Trying to extract authors from document data');
                        // Try both regular and compiled document endpoints
                        let docData = null;
                        
                        try {
                            const regDocResponse = await fetch(`/api/documents/${documentId}`);
                            if (regDocResponse.ok) {
                                docData = await regDocResponse.json();
                            } else {
                                console.warn(`Regular document endpoint failed: ${regDocResponse.status}`);
                            }
                        } catch (regError) {
                            console.warn('Error fetching from regular document endpoint:', regError);
                        }
                        
                        // If regular endpoint failed, try compiled endpoint
                        if (!docData) {
                            try {
                                const compDocResponse = await fetch(`/api/compiled-documents/${documentId}`);
                                if (compDocResponse.ok) {
                                    docData = await compDocResponse.json();
                                } else {
                                    console.warn(`Compiled document endpoint failed: ${compDocResponse.status}`);
                                }
                            } catch (compError) {
                                console.warn('Error fetching from compiled document endpoint:', compError);
                            }
                        }
                        
                        // If we have data, extract authors
                        if (docData && docData.authors && Array.isArray(docData.authors)) {
                            authors = docData.authors;
                            console.log(`Extracted ${authors.length} authors from document data`);
                        }
                    } catch (docError) {
                        console.warn('No authors found for this document');
                    }
                }
                
                resolve(authors);
            } catch (error) {
                console.error('Error fetching authors:', error);
                resolve([]); // Resolve with empty array in case of error
            }
        });
    },
    
    // Fetch research agenda for a document separately
    fetchResearchAgendaForDocument: function(documentId) {
        console.log(`Fetching research agenda for document ${documentId}`);
        
        // Try multiple potential endpoints
        const endpoints = [
            `/api/document-research-agenda/${documentId}`,
            `/api/documents/${documentId}/topics`,
            `/document-research-agenda/${documentId}`,
            `/api/compiled-documents/${documentId}/topics`,
            `/api/documents/${documentId}/research-agenda`
        ];
        
        return new Promise(async (resolve, reject) => {
            try {
                let topics = [];
                let succeeded = false;
                
                // Try each endpoint sequentially
                for (const endpoint of endpoints) {
                    try {
                        console.log(`Trying to fetch research agenda from: ${endpoint}`);
                        const response = await fetch(endpoint);
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`Research agenda data from ${endpoint}:`, data);
                            
                            // Handle different API response formats
                            if (data.topics && Array.isArray(data.topics)) {
                                topics = data.topics;
                                succeeded = true;
                                console.log(`Found ${topics.length} topics at ${endpoint}`);
                                break;
                            } else if (data.research_agenda && Array.isArray(data.research_agenda)) {
                                topics = data.research_agenda;
                                succeeded = true;
                                console.log(`Found ${topics.length} topics at ${endpoint} (research_agenda format)`);
                                break;
                            } else if (Array.isArray(data)) {
                                topics = data;
                                succeeded = true;
                                console.log(`Found ${topics.length} topics at ${endpoint} (array format)`);
                                break;
                            } else {
                                console.warn(`Response from ${endpoint} doesn't contain topics in expected format:`, data);
                            }
                        } else {
                            console.warn(`Failed to fetch research agenda from ${endpoint}: ${response.status}`);
                        }
                    } catch (endpointError) {
                        console.warn(`Error fetching research agenda from ${endpoint}:`, endpointError);
                    }
                }
                
                // If no topics found, try one more strategy - get document and extract topics
                if (!succeeded && topics.length === 0) {
                    try {
                        console.log('Trying to extract topics from document data');
                        const docResponse = await fetch(`/api/documents/${documentId}`);
                        if (docResponse.ok) {
                            const docData = await docResponse.json();
                            
                            if (docData.research_agenda && Array.isArray(docData.research_agenda)) {
                                topics = docData.research_agenda;
                                console.log(`Extracted ${topics.length} topics from document data (research_agenda)`);
                            } else if (docData.topics && Array.isArray(docData.topics)) {
                                topics = docData.topics;
                                console.log(`Extracted ${topics.length} topics from document data (topics)`);
                            }
                        }
                    } catch (docError) {
                        console.warn('No research agenda found for this document');
                    }
                }
                
                resolve(topics);
            } catch (error) {
                console.error('Error fetching research agenda:', error);
                resolve([]); // Resolve with empty array in case of error
            }
        });
    },
    
    // Populate the edit form with document data
    populateEditForm: function(data) {
        console.log('Populating edit form with data:', data);
        
        // Set ID field
        document.getElementById('edit-single-document-id').value = data.id;
        
        // Set basic fields
        document.getElementById('edit-single-document-title').value = data.title || '';
        
        // Set document type dropdown
        const typeSelect = document.getElementById('edit-single-document-type');
        if (typeSelect) {
            // Try to find matching option
            const documentType = data.document_type || data.type || data.category || '';
            
            for (let i = 0; i < typeSelect.options.length; i++) {
                if (typeSelect.options[i].value.toUpperCase() === documentType.toUpperCase()) {
                    typeSelect.selectedIndex = i;
                    break;
                }
            }
        }
        
        // Set date field - handle both date_published and publication_date formats
        const dateField = document.getElementById('edit-single-document-date');
        if (dateField) {
            const dateValue = data.date_published || data.publication_date;
            if (dateValue) {
                try {
                    // Format date as YYYY-MM-DD for input[type=date]
                    const date = new Date(dateValue);
                    const formattedDate = date.toISOString().split('T')[0];
                    dateField.value = formattedDate;
                } catch (error) {
                    console.error('Error formatting date:', error);
                }
            }
        }
        
        // Set abstract field
        const abstractField = document.getElementById('edit-single-document-abstract');
        if (abstractField && data.abstract) {
            abstractField.value = data.abstract;
        }
        
        // Handle file path if available
        if (data.file_path) {
            const fileIndicator = document.getElementById('edit-single-document-file-indicator');
            if (fileIndicator) {
                const fileName = data.file_path.split('/').pop();
                fileIndicator.textContent = `Current file: ${fileName}`;
                fileIndicator.classList.add('has-file');
                
                // Add a note about replacement
                const fileNoteContainer = document.getElementById('edit-single-document-file-note');
                if (fileNoteContainer) {
                    fileNoteContainer.innerHTML = '<div class="file-replace-note">Select a new file to replace the current document</div>';
                }
            }
        }
        
        // Populate authors
        this.populateAuthorsContainer(data.authors || []);
        
        // Populate research agenda/topics
        this.populateResearchAgendaContainer(data.research_agenda || data.topics || []);
        
        // Update the preview section
        this.updateDocumentPreview(data);
    },
    
    // Populate authors container
    populateAuthorsContainer: function(authors) {
        const selectedAuthorsContainer = document.getElementById('edit-single-document-selected-authors');
        if (!selectedAuthorsContainer) {
            console.error('Authors container not found');
            return;
        }
        
        // Clear existing content
        selectedAuthorsContainer.innerHTML = '';
        
        // Populate with author items
        if (authors && Array.isArray(authors) && authors.length > 0) {
            console.log(`Populating authors container with ${authors.length} items:`, authors);
            
            authors.forEach(author => {
                // Skip if author is null or undefined
                if (!author) return;
                
                // Handle different formats of author items
                let authorId = 'unknown';
                let authorName = '';
                
                if (typeof author === 'string') {
                    authorName = author;
                } else if (author.id) {
                    authorId = author.id;
                    
                    if (author.full_name) {
                        authorName = author.full_name;
                    } else if (author.name) {
                        authorName = author.name;
                    } else if (author.first_name || author.last_name) {
                        authorName = [author.first_name, author.last_name].filter(Boolean).join(' ');
                    }
                }
                
                if (!authorName) {
                    console.warn('Author item has no name, skipping', author);
                    return;
                }
                
                const authorElement = document.createElement('div');
                authorElement.className = 'selected-author';
                authorElement.dataset.id = authorId;
                authorElement.innerHTML = `
                    ${authorName}
                    <span class="remove-author" data-id="${authorId}">&times;</span>
                `;
                
                // Add to container
                selectedAuthorsContainer.appendChild(authorElement);
                
                // Add click handler to remove button
                const removeBtn = authorElement.querySelector('.remove-author');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        authorElement.remove();
                    });
                }
            });
        } else {
            console.warn('No author items found for this document');
        }
    },
    
    // Update document preview
    updateDocumentPreview: function(data) {
        console.log('Updating document preview with data:', data);
        
        // Update title
        const titleElement = document.getElementById('edit-single-document-preview-title');
        if (titleElement) {
            titleElement.textContent = data.title || 'Untitled Document';
        }
        
        // Update type
        const typeElement = document.getElementById('edit-single-document-preview-type');
        if (typeElement) {
            typeElement.textContent = data.document_type || data.type || data.category || 'Unknown Type';
        }
        
        // Update date
        const dateElement = document.getElementById('edit-single-document-preview-date');
        if (dateElement) {
            const dateValue = data.date_published || data.publication_date;
            const formattedDate = dateValue ? new Date(dateValue).toLocaleDateString() : '-';
            dateElement.textContent = formattedDate;
        }
        
        // Update authors
        const authorsElement = document.getElementById('edit-single-document-preview-authors');
        if (authorsElement) {
            const authors = data.authors || [];
            
            if (authors.length > 0) {
                const authorNames = authors.map(author => {
                    if (typeof author === 'string') return author;
                    return author.full_name || author.name || [author.first_name, author.last_name].filter(Boolean).join(' ') || 'Unknown Author';
                });
                
                authorsElement.textContent = authorNames.join(', ');
            } else {
                authorsElement.textContent = 'No authors';
            }
        }
        
        // Update abstract
        const abstractElement = document.getElementById('edit-single-document-preview-abstract');
        if (abstractElement) {
            abstractElement.textContent = data.abstract || 'No abstract available';
        }
        
        // Set document type icon if available
        const typeIcon = document.getElementById('edit-single-document-type-icon');
        if (typeIcon) {
            const iconPath = this.getDocumentTypeIcon(data.document_type || data.category);
            if (iconPath && !iconPath.includes('undefined')) {
                typeIcon.src = iconPath;
            } else {
                // Use a default icon path if the document type doesn't have a specific icon
                typeIcon.src = '/admin/Components/icons/Category-icons/default_category_icon.png';
            }
            
            // Add background color to the icon container
            const iconContainer = document.getElementById('edit-single-document-preview-icon');
            if (iconContainer) {
                iconContainer.style.backgroundColor = '#10B981'; // Green color from css
            }
        }
    },
    
    // Helper function to populate keywords container
    populateResearchAgendaContainer: function(researchAgenda) {
        const selectedTopicsContainer = document.getElementById('edit-single-document-selected-topics');
        if (!selectedTopicsContainer) {
            console.error('Research agenda container not found');
            return;
        }
        
        // Clear existing content
        selectedTopicsContainer.innerHTML = '';
        
        // Populate with research agenda items
        if (researchAgenda && Array.isArray(researchAgenda) && researchAgenda.length > 0) {
            console.log(`Populating research agenda container with ${researchAgenda.length} items:`, researchAgenda);
            researchAgenda.forEach(item => {
                // Skip if item is null or undefined
                if (!item) return;
                
                // Handle different formats of research agenda items
                let itemId = 'unknown';
                let itemName = '';
                
                if (typeof item === 'string') {
                    itemName = item;
                } else if (item.id && item.name) {
                    itemId = item.id;
                    itemName = item.name;
                } else if (item.id && item.title) {
                    itemId = item.id;
                    itemName = item.title;
                } else if (item.name) {
                    itemId = 'unknown';
                    itemName = item.name;
                } else if (item.title) {
                    itemId = 'unknown';
                    itemName = item.title;
                }
                
                if (!itemName) {
                    console.warn('Research agenda item has no name, skipping', item);
                    return;
                }
                
                const topicElement = document.createElement('div');
                topicElement.className = 'selected-topic';
                topicElement.dataset.id = itemId;
                topicElement.innerHTML = `
                    ${itemName}
                    <span class="remove-topic" data-id="${itemId}">&times;</span>
                `;
                
                // Add to container
                selectedTopicsContainer.appendChild(topicElement);
                
                // Add click handler to remove button
                const removeBtn = topicElement.querySelector('.remove-topic');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        topicElement.remove();
                    });
                }
            });
        } else {
            console.warn('No research agenda items found for this document');
        }
    },
    
    // Populate the compiled document edit form
    populateCompiledEditForm: function(data) {
        // ... existing code ...
    },
    
    // Load and display child documents in the compiled document edit form
    loadChildDocuments: function(parentId, children = [], container = null) {
        // ... existing code ...
    },
    
    // Update the child documents preview in the right panel
    updateChildDocumentsPreview: function(children = [], container = null) {
        // ... existing code ...
    },
    
    // Update the compiled document edit preview section
    updateCompiledEditPreview: function(data) {
        // ... existing code ...
    },
    
    // Remove a child document from the compilation
    removeChildDocument: function(childId) {
        // ... existing code ...
    },
    
    // Show the child document selection modal
    showChildDocumentSelector: function() {
        // ... existing code ...
    },
    
    // Load available documents for selection
    loadAvailableDocuments: function() {
        // ... existing code ...
    },
    
    // Render available documents for selection
    renderAvailableDocuments: function(documents) {
        // ... existing code ...
    },
    
    // Search available documents
    searchAvailableDocuments: function(query) {
        // ... existing code ...
    },
    
    // Add a child document to the compilation
    addChildDocument: function(childId) {
        // ... existing code ...
    },
    
    // Get the currently selected child documents
    getSelectedChildDocuments: function() {
        // ... existing code ...
    },
    
    // Show PDF viewer
    showPdfViewer: function(documentId) {
        // ... existing code ...
    },
    
    // Show success message
    showSaveSuccess: function() {
        // ... existing code ...
    },
    
    // Show error message
    showSaveError: function(error) {
        // ... existing code ...
    },
    
    // Hide modal by ID
    hideModal: function(modalId) {
        // ... existing code ...
    },
    
    // Save changes to a document
    saveDocument: function(formData) {
        // ... existing code ...
    },
    
    // Save changes to a compiled document
    saveCompiledDocument: function(formData) {
        // ... existing code ...
    },
    
    // Get document type icon URL
    getDocumentTypeIcon: function(documentType) {
        // Map document types to icon paths
        const iconMap = {
            'THESIS': '/admin/Components/icons/Category-icons/thesis.png',
            'DISSERTATION': '/admin/Components/icons/Category-icons/dissertation.png',
            'CONFLUENCE': '/admin/Components/icons/Category-icons/confluence.png',
            'SYNERGY': '/admin/Components/icons/Category-icons/synergy.png'
        };
        
        // Get the normalized document type
        const normType = documentType ? documentType.toUpperCase() : '';
        
        // Check for all possible case variations
        for (const [key, path] of Object.entries(iconMap)) {
            if (normType === key || normType === key.toLowerCase()) {
                return path;
            }
        }
        
        // Return the default icon path
        return '/admin/Components/icons/Category-icons/default_category_icon.png';
    },
    
    // Initialize Author Search
    initializeAuthorSearch: function(inputElement, selectedContainerId) {
        if (!inputElement) return;
        
        console.log('Initializing author search input:', inputElement.id);
        
        // Try to use the global function first if available
        if (typeof window.initAuthorSearchInput === 'function' && window.initAuthorSearchInput !== this.dummyAuthorSearchInit) {
            try {
                console.log('Using global author search initialization');
                window.initAuthorSearchInput(inputElement);
                return;
            } catch (error) {
                console.error('Error using global author search function, falling back to internal implementation:', error);
                // Continue with internal implementation
            }
        } else {
            console.log('Using internal author search implementation');
        }
        
        // Create author dropdown container
        const dropdownId = `${inputElement.id}-dropdown`;
        
        // First remove any existing dropdown to avoid duplicates
        const existingDropdown = document.getElementById(dropdownId);
        if (existingDropdown) {
            existingDropdown.remove();
        }
        
        // Create new dropdown element with absolute positioning
        const dropdownContainer = document.createElement('div');
        dropdownContainer.style.position = 'relative';
        dropdownContainer.style.width = '100%';
        
        const dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'dropdown-list';
        dropdown.style.display = 'none';
        dropdownContainer.appendChild(dropdown);
        
        // Insert the dropdown container after the input element
        const parent = inputElement.parentNode;
        if (parent.nextSibling) {
            parent.parentNode.insertBefore(dropdownContainer, parent.nextSibling);
        } else {
            parent.parentNode.appendChild(dropdownContainer);
        }
        
        console.log(`Created author dropdown with ID: ${dropdownId}`);
        
        // Debounce function for search delay
        const debounce = (func, delay) => {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        };
        
        // Search authors as user types
        const searchAuthors = debounce(async (query) => {
            if (query.length < 2) {
                dropdown.innerHTML = '';
                dropdown.style.display = 'none';
                return;
            }
            
            // Show loading indicator
            dropdown.innerHTML = '<div class="dropdown-item loading"><i class="fas fa-spinner fa-spin"></i> Searching authors...</div>';
            dropdown.style.display = 'block';
            
            try {
                // Try multiple potential author search endpoints
                let response;
                let authorsData;
                let authors = [];
                
                // First try the search endpoints
                let endpoints = [
                    `/api/authors/search?q=${encodeURIComponent(query)}`,
                    `/authors/search?q=${encodeURIComponent(query)}`,
                    `/api/authors?name=${encodeURIComponent(query)}`
                ];
                
                // Try each endpoint until one works
                for (const endpoint of endpoints) {
                    try {
                        console.log(`Trying author search endpoint: ${endpoint}`);
                        response = await fetch(endpoint);
                        
                        if (response.ok) {
                            authorsData = await response.json();
                            console.log(`Found working author endpoint: ${endpoint}`, authorsData);
                            
                            // Format the data based on response structure
                            if (authorsData.authors) {
                                authors = authorsData.authors;
                            } else if (Array.isArray(authorsData)) {
                                authors = authorsData;
                            }
                            
                            if (authors.length > 0) {
                                break; // We found results, stop trying endpoints
                            } else {
                                console.log('Endpoint returned 0 authors, trying next endpoint');
                            }
                        } else {
                            console.warn(`Endpoint ${endpoint} failed with status ${response.status}`);
                        }
                    } catch (err) {
                        console.warn(`Error with endpoint ${endpoint}:`, err);
                    }
                }
                
                // If no search endpoints worked or returned results, try getting all authors as fallback
                if (authors.length === 0) {
                    console.log('No authors found via search endpoints, trying to fetch all authors');
                    try {
                        const allAuthorsResponse = await fetch('/api/authors/all');
                        
                        if (allAuthorsResponse.ok) {
                            const allAuthorsData = await allAuthorsResponse.json();
                            
                            // Filter authors by the search query manually
                            if (allAuthorsData.authors && Array.isArray(allAuthorsData.authors)) {
                                const lowerQuery = query.toLowerCase();
                                authors = allAuthorsData.authors.filter(author => {
                                    const fullName = (author.full_name || '').toLowerCase();
                                    const firstName = (author.first_name || '').toLowerCase();
                                    const lastName = (author.last_name || '').toLowerCase();
                                    const affiliation = (author.affiliation || '').toLowerCase();
                                    const spudId = (author.spud_id || '').toLowerCase();
                                    
                                    return fullName.includes(lowerQuery) || 
                                           firstName.includes(lowerQuery) ||
                                           lastName.includes(lowerQuery) ||
                                           affiliation.includes(lowerQuery) ||
                                           spudId.includes(lowerQuery);
                                });
                            }
                            
                            console.log(`Found ${authors.length} authors by filtering all authors`);
                        }
                    } catch (err) {
                        console.warn('Error fetching all authors:', err);
                    }
                }
                
                // Update dropdown with results
                dropdown.innerHTML = '';
                
                if (authors.length === 0) {
                    dropdown.innerHTML = '<div class="dropdown-item no-results">No authors found</div>';
                    
                    // Add option to create new author
                    if (query.length >= 3) {
                        const createItem = document.createElement('div');
                        createItem.className = 'dropdown-item create-new';
                        createItem.innerHTML = `<div class="item-name"><i class="fas fa-plus"></i> Create "${query}"</div>`;
                        
                        // Add click handler to create and select new author
                        createItem.addEventListener('click', async () => {
                            // Try to create a new author if possible
                            try {
                                // First check if we should try to create via API or just select as new
                                const newAuthor = await this.createNewAuthor(query);
                                if (newAuthor && newAuthor.id) {
                                    // Successfully created via API
                                    this.selectAuthor(newAuthor.id, newAuthor.full_name || newAuthor.name || query, selectedContainerId);
                                } else {
                                    // Fallback to just marking as new
                            this.selectAuthor('new', query, selectedContainerId);
                                }
                            } catch (error) {
                                console.error('Error creating new author:', error);
                                // Fallback to just marking as new
                                this.selectAuthor('new', query, selectedContainerId);
                            }
                            
                            dropdown.style.display = 'none';
                            inputElement.value = '';
                        });
                        
                        dropdown.appendChild(createItem);
                    }
                } else {
                    // Check if there's an exact match
                    const exactMatch = authors.some(author => 
                        (author.full_name || author.name || '').toLowerCase() === query.toLowerCase()
                    );
                    
                    // Add authors to dropdown
                    authors.forEach(author => {
                        const item = document.createElement('div');
                        item.className = 'dropdown-item';
                        item.dataset.id = author.id;
                        item.dataset.name = author.full_name || author.name;
                        
                        // Format with name and affiliation if available
                        let authorDisplay = `<div class="item-name">${author.full_name || author.name}</div>`;
                        if (author.affiliation) {
                            authorDisplay += `<div class="item-detail">${author.affiliation}</div>`;
                        }
                        if (author.spud_id) {
                            authorDisplay += `<div class="item-detail-small">ID: ${author.spud_id}</div>`;
                        }
                        
                        item.innerHTML = authorDisplay;
                        
                        // Add click handler to select the author
                        item.addEventListener('click', () => {
                            this.selectAuthor(author.id, author.full_name || author.name, selectedContainerId);
                            dropdown.style.display = 'none';
                            inputElement.value = '';
                        });
                        
                        dropdown.appendChild(item);
                    });
                    
                    // Add option to create new if no exact match
                    if (!exactMatch && query.length >= 3) {
                        const createItem = document.createElement('div');
                        createItem.className = 'dropdown-item create-new';
                        createItem.innerHTML = `<div class="item-name"><i class="fas fa-plus"></i> Create "${query}"</div>`;
                        
                        // Add click handler to create and select new author
                        createItem.addEventListener('click', async () => {
                            // Try to create a new author if possible
                            try {
                                // First check if we should try to create via API or just select as new
                                const newAuthor = await this.createNewAuthor(query);
                                if (newAuthor && newAuthor.id) {
                                    // Successfully created via API
                                    this.selectAuthor(newAuthor.id, newAuthor.full_name || newAuthor.name || query, selectedContainerId);
                                } else {
                                    // Fallback to just marking as new
                                    this.selectAuthor('new', query, selectedContainerId);
                                }
                            } catch (error) {
                                console.error('Error creating new author:', error);
                                // Fallback to just marking as new
                                this.selectAuthor('new', query, selectedContainerId);
                            }
                            
                            dropdown.style.display = 'none';
                            inputElement.value = '';
                        });
                        
                        dropdown.appendChild(createItem);
                    }
                }
                
                // Position dropdown directly under the input field
                dropdown.style.display = 'block';
            } catch (error) {
                console.error('Error searching authors:', error);
                dropdown.innerHTML = '<div class="dropdown-item error">Error searching authors</div>';
            }
        }, 300);
        
        // Add input event listener
        inputElement.addEventListener('input', (e) => {
            searchAuthors(e.target.value);
        });
        
        // Handle focus to reshow dropdown if there's a value
        inputElement.addEventListener('focus', () => {
            if (inputElement.value.length >= 2) {
                searchAuthors(inputElement.value);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    },
    
    // Helper function to try creating a new author via API
    createNewAuthor: async function(name) {
        console.log(`Attempting to create new author: "${name}"`);
        
        // Try different endpoints for creating authors
        const endpoints = [
            '/api/authors',
            '/authors'
        ];
        
        // Parse name into components (simple logic)
        let firstName = '';
        let lastName = '';
        
        const nameParts = name.trim().split(' ');
        if (nameParts.length > 1) {
            lastName = nameParts.pop();
            firstName = nameParts.join(' ');
        } else {
            // If only one word, assume it's the last name
            lastName = name.trim();
        }
        
        // Prepare author data
        const authorData = {
            name: name,
            full_name: name,
            first_name: firstName,
            last_name: lastName
        };
        
        // Try each endpoint
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(authorData)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log(`Successfully created author via ${endpoint}:`, result);
                    
                    // Handle different API response formats
                    if (result.id || result.author_id) {
                        return {
                            id: result.id || result.author_id,
                            full_name: name,
                            name: name
                        };
                    } else if (result.author && result.author.id) {
                        return result.author;
                    }
                    
                    return result;
                } else {
                    console.warn(`Failed to create author via ${endpoint}: ${response.status}`);
                }
            } catch (error) {
                console.error(`Error creating author via ${endpoint}:`, error);
            }
        }
        
        // If we didn't create via API, return a basic object
        return {
            id: 'new',
            name: name,
            full_name: name
        };
    },
    
    // A dummy function for the fallback implementation
    dummyAuthorSearchInit: function(inputElement) {
        console.log('Using fallback author search implementation');
    },
    
    // Select an author and add to the selected list
    selectAuthor: function(authorId, authorName, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Check if author already selected
        const existingAuthor = container.querySelector(`.selected-author[data-id="${authorId}"]`);
        if (existingAuthor) return;
        
        // Create author element
        const authorElement = document.createElement('div');
        authorElement.className = 'selected-author';
        authorElement.dataset.id = authorId;
        authorElement.innerHTML = `
            ${authorName}
            <span class="remove-author" data-id="${authorId}">&times;</span>
        `;
        
        // Add to container
        container.appendChild(authorElement);
        
        // Add click handler to remove button
        const removeBtn = authorElement.querySelector('.remove-author');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                authorElement.remove();
            });
        }
    },
    
    // Initialize Research Agenda Search
    initializeResearchAgendaSearch: function(inputElement, selectedContainerId) {
        if (!inputElement) return;
        
        console.log('Initializing research agenda search input:', inputElement.id);
        
        // Create dropdown container
        const dropdownId = `${inputElement.id}-dropdown`;
        
        // First remove any existing dropdown to avoid duplicates
        const existingDropdown = document.getElementById(dropdownId);
        if (existingDropdown) {
            existingDropdown.remove();
        }
        
        // Create new dropdown element with absolute positioning
        const dropdownContainer = document.createElement('div');
        dropdownContainer.style.position = 'relative';
        dropdownContainer.style.width = '100%';
        
        const dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'dropdown-list';
        dropdown.style.display = 'none';
        dropdownContainer.appendChild(dropdown);
        
        // Insert the dropdown container after the input element
        const parent = inputElement.parentNode;
        if (parent.nextSibling) {
            parent.parentNode.insertBefore(dropdownContainer, parent.nextSibling);
        } else {
            parent.parentNode.appendChild(dropdownContainer);
        }
        
        console.log(`Created research agenda dropdown with ID: ${dropdownId}`);
        
        // Debounce function for search delay
        const debounce = (func, delay) => {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        };
        
        // Search research agenda items as user types
        const searchAgendaItems = debounce(async (query) => {
            if (query.length < 2) {
                dropdown.innerHTML = '';
                dropdown.style.display = 'none';
                return;
            }
            
            // Show loading indicator
            dropdown.innerHTML = '<div class="dropdown-item loading"><i class="fas fa-spinner fa-spin"></i> Searching research agenda items...</div>';
            dropdown.style.display = 'block';
            
            try {
                // Try multiple potential research agenda endpoints
                let items = [];
                let response;
                
                // Define all potential endpoints to try
                let endpoints = [
                    `/research-agenda-items/search?q=${encodeURIComponent(query)}`,
                    `/api/research-agenda-items/search?q=${encodeURIComponent(query)}`,
                    `/document-research-agenda/search?q=${encodeURIComponent(query)}`,
                    `/api/topics/search?q=${encodeURIComponent(query)}`
                ];
                
                // Try each endpoint until one works
                for (const endpoint of endpoints) {
                    try {
                        console.log(`Trying research agenda endpoint: ${endpoint}`);
                        response = await fetch(endpoint);
                        
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`Found working research agenda endpoint: ${endpoint}`, data);
                            
                            // Format the data based on response structure
                            if (data.items) {
                                items = data.items;
                            } else if (Array.isArray(data)) {
                                items = data;
                            } else if (data.agendaItems) {
                                items = data.agendaItems;
                            } else if (data.topics) {
                                items = data.topics;
                            }
                            
                            if (items.length > 0) {
                                break; // We found results, stop trying endpoints
                            } else {
                                console.log('Endpoint returned 0 items, trying next endpoint');
                            }
                        } else {
                            console.warn(`Endpoint ${endpoint} failed with status ${response.status}`);
                        }
                    } catch (err) {
                        console.warn(`Error with endpoint ${endpoint}:`, err);
                    }
                }
                
                // If no search endpoints worked or returned results, try getting all research agenda items
                if (items.length === 0) {
                    console.log('No items found via search endpoints, trying to fetch all research agenda items');
                    try {
                        // Try the all research agenda items endpoint with multiple paths
                        const allEndpoints = [
                            '/research-agenda-items/all',
                            '/research-agenda-items',
                            '/api/research-agenda-items',
                            '/api/topics'
                        ];
                        
                        for (const allEndpoint of allEndpoints) {
                            try {
                                const allItemsResponse = await fetch(allEndpoint);
                        
                        if (allItemsResponse.ok) {
                            const allItemsData = await allItemsResponse.json();
                                    console.log(`All research agenda items from ${allEndpoint}:`, allItemsData);
                            
                                    // Handle different response structures
                                    let allItems = [];
                            if (allItemsData.items && Array.isArray(allItemsData.items)) {
                                        allItems = allItemsData.items;
                            } else if (Array.isArray(allItemsData)) {
                                        allItems = allItemsData;
                                    } else if (allItemsData.topics && Array.isArray(allItemsData.topics)) {
                                        allItems = allItemsData.topics;
                                    }
                                    
                                    if (allItems.length > 0) {
                                        // Filter items by the search query manually
                                const lowerQuery = query.toLowerCase();
                                        items = allItems.filter(item => {
                                    const name = (item.name || '').toLowerCase();
                                            const title = (item.title || '').toLowerCase();
                                    const description = (item.description || '').toLowerCase();
                                    
                                            return name.includes(lowerQuery) || 
                                                   title.includes(lowerQuery) || 
                                                   description.includes(lowerQuery);
                                });
                            
                            console.log(`Found ${items.length} research agenda items by filtering all items`);
                                        if (items.length > 0) break;
                                    }
                                }
                            } catch (err) {
                                console.warn(`Error fetching all research agenda items from ${allEndpoint}:`, err);
                            }
                        }
                    } catch (err) {
                        console.warn('Error fetching all research agenda items:', err);
                    }
                }
                
                // Update dropdown with results
                dropdown.innerHTML = '';
                
                // Always add option to create a new item
                const exactMatchFound = items.some(item => 
                    (item.name || item.title || '').toLowerCase() === query.toLowerCase()
                );
                
                if (items.length > 0) {
                    items.forEach(item => {
                        const dropdownItem = document.createElement('div');
                        dropdownItem.className = 'dropdown-item';
                        
                        // Handle different item structures
                        const itemId = item.id || 'unknown';
                        const itemName = item.name || item.title || '';
                        
                        dropdownItem.dataset.id = itemId;
                        dropdownItem.dataset.name = itemName;
                        
                        // Add item details including description if available
                        let itemDisplay = `<div class="item-name">${itemName}</div>`;
                        if (item.description) {
                            itemDisplay += `<div class="item-detail">${item.description}</div>`;
                        }
                        
                        dropdownItem.innerHTML = itemDisplay;
                        
                        // Add click handler to select the item
                        dropdownItem.addEventListener('click', () => {
                            this.selectResearchAgendaItem(itemId, itemName, selectedContainerId);
                            dropdown.style.display = 'none';
                            inputElement.value = '';
                        });
                        
                        dropdown.appendChild(dropdownItem);
                    });
                } else {
                    dropdown.innerHTML = '<div class="dropdown-item no-results">No research agenda items found</div>';
                }
                
                // If no exact match found, add option to create new item 
                if (!exactMatchFound && query.length >= 3) {
                    const createItem = document.createElement('div');
                    createItem.className = 'dropdown-item create-new';
                    createItem.innerHTML = `<div class="item-name"><i class="fas fa-plus"></i> Create "${query}"</div>`;
                    
                    // Add click handler to create and select new item
                    createItem.addEventListener('click', async () => {
                        try {
                            // Attempt to create the new item via API
                            const newItem = await this.createNewResearchAgendaItem(query);
                            if (newItem && newItem.id) {
                                this.selectResearchAgendaItem(newItem.id, newItem.name || newItem.title || query, selectedContainerId);
                            } else {
                        this.selectResearchAgendaItem('new', query, selectedContainerId);
                            }
                        } catch (error) {
                            console.error('Error creating new research agenda item:', error);
                            this.selectResearchAgendaItem('new', query, selectedContainerId);
                        }
                        
                        dropdown.style.display = 'none';
                        inputElement.value = '';
                    });
                    
                    dropdown.appendChild(createItem);
                }
                
                // Position dropdown directly under the input field
                dropdown.style.display = 'block';
            } catch (error) {
                console.error('Error searching research agenda items:', error);
                dropdown.innerHTML = '<div class="dropdown-item error">Error searching</div>';
            }
        }, 300);
        
        // Add input event listener
        inputElement.addEventListener('input', (e) => {
            searchAgendaItems(e.target.value);
        });
        
        // Handle focus to reshow dropdown if there's a value
        inputElement.addEventListener('focus', () => {
            if (inputElement.value.length >= 2) {
                searchAgendaItems(inputElement.value);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!inputElement.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    },
    
    // Helper function to create a new research agenda item
    createNewResearchAgendaItem: async function(name) {
        console.log(`Attempting to create new research agenda item: "${name}"`);
        
        // Try different endpoints for creating items
        const endpoints = [
            '/api/research-agenda-items',
            '/research-agenda-items',
            '/api/topics'
        ];
        
        const itemData = {
            name: name,
            title: name,
            description: ''
        };
        
        // Try each endpoint
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                    body: JSON.stringify(itemData)
            });
            
                if (response.ok) {
            const result = await response.json();
                    console.log(`Successfully created research agenda item via ${endpoint}:`, result);
                    
                    // Handle different API response formats
                    if (result.id) {
                        return {
                            id: result.id,
                            name: name
                        };
                    } else if (result.item && result.item.id) {
                        return result.item;
                    } else if (result.topic && result.topic.id) {
                        return {
                            id: result.topic.id,
                            name: result.topic.name || name
                        };
                    }
                    
                    return result;
                } else {
                    console.warn(`Failed to create research agenda item via ${endpoint}: ${response.status}`);
                }
            } catch (error) {
                console.error(`Error creating research agenda item via ${endpoint}:`, error);
            }
        }
        
        // If we didn't create via API, return a basic object
        return {
            id: 'new',
            name: name
        };
    },
    
    // Select a research agenda item and add to the selected list
    selectResearchAgendaItem: function(itemId, itemName, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Check if item already selected
        const existingItem = container.querySelector(`.selected-topic[data-id="${itemId}"]`);
        if (existingItem) return;
        
        // Create item element
        const itemElement = document.createElement('div');
        itemElement.className = 'selected-topic';
        itemElement.dataset.id = itemId;
        itemElement.innerHTML = `
            ${itemName}
            <span class="remove-topic" data-id="${itemId}">&times;</span>
        `;
        
        // Add to container
        container.appendChild(itemElement);
        
        // Add click handler to remove button
        const removeBtn = itemElement.querySelector('.remove-topic');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                itemElement.remove();
            });
        }
    },
    
    // Helper function to fetch child documents by IDs
    fetchChildDocuments: function(childIds) {
        // ... existing code ...
    },
    
    // Update compiled document preview - for references in other parts of the code
    updateCompiledDocumentPreview: function() {
        // ... existing code ...
    },
    
    // Function to upload a file with multiple endpoint attempts
    uploadFileWithFallback: function(documentId, fileInput) {
        // ... existing code ...
    },
    
    // Helper function to try multiple file upload endpoints
    tryFileUploadEndpoints: function(endpoints, formData) {
        // ... existing code ...
    }
};

// Initialize document edit components when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing document edit functionality');
    
    // Set up global functions for use in other scripts
    window.showEditModal = window.documentEdit.showEditModal.bind(window.documentEdit);
    window.showCompiledEditModal = window.documentEdit.showCompiledEditModal.bind(window.documentEdit);
    
    // Create a fallback author search function if the main one isn't available
    if (typeof window.initAuthorSearchInput !== 'function') {
        console.log('Author search function not found, creating fallback implementation');
        window.initAuthorSearchInput = function(inputElement) {
            // This is a simplified fallback implementation
            console.log('Using fallback author search implementation');
            // The document edit module will use its own implementation
        };
    }
}); 