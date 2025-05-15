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
        console.log('Fetching most visited works data directly from documents and visits tables...');
        
        // Try the new endpoint that directly joins documents and document_visits tables
        const response = await fetch(`/api/documents/most-visited?limit=${limit}&days=${days}`);
        
        if (!response.ok) {
            console.log(`Direct join API returned error! status: ${response.status}`);
            console.log('Trying legacy endpoint as fallback...');
            
            // Fall back to the legacy endpoint
            const legacyResponse = await fetch(`/api/page-visits/most-visited-documents?limit=${limit}&days=${days}`);
            
            if (!legacyResponse.ok) {
                console.log(`Legacy endpoint also failed with status: ${legacyResponse.status}`);
                await fetchDocumentsWithVisits(days, limit);
                return;
            }
            
            const legacyData = await legacyResponse.json();
            console.log('Legacy endpoint data received:', legacyData);
            
            if (!legacyData.documents || legacyData.documents.length === 0) {
                await fetchDocumentsWithVisits(days, limit);
                return;
            }
            
            updateWorksTable(legacyData.documents.slice(0, limit));
            return;
        }
        
        const data = await response.json();
        console.log('Direct join API data received:', data);
        
        if (!data.documents || data.documents.length === 0) {
            console.log('No documents returned from direct join API');
            await fetchDocumentsWithVisits(days, limit);
            return;
        }
        
        // Ensure only 5 documents are displayed
        updateWorksTable(data.documents.slice(0, limit));
    } catch (error) {
        console.error('Error updating most visited works:', error);
        await fetchDocumentsWithVisits(days, limit);
    }
}

/**
 * New function to fetch documents first, then manually get visit counts
 * This is a more reliable approach when the API endpoints aren't working properly
 */
async function fetchDocumentsWithVisits(days = 7, limit = 5) {
    try {
        console.log('Fetching all documents first, then getting visit counts...');
        
        // First get all documents
        const docsResponse = await fetch('/api/documents?limit=50');
        
        if (!docsResponse.ok) {
            console.error(`Failed to fetch documents: ${docsResponse.status}`);
            await fetchRegularDocuments();
            return;
        }
        
        const docsData = await docsResponse.json();
        
        if (!docsData.documents || docsData.documents.length === 0) {
            console.log('No documents found in documents API');
            await fetchRegularDocuments();
            return;
        }
        
        console.log(`Got ${docsData.documents.length} documents, now fetching visit counts...`);
        
        // Try to get visit counts separately
        let visitCounts = {};
        
        try {
            // Try to fetch visit counts from document_visits table
            const visitsResponse = await fetch(`/api/document-visits/counts?days=${days}`);
            
            if (visitsResponse.ok) {
                const visitsData = await visitsResponse.json();
                console.log('Visit counts received:', visitsData);
                
                if (visitsData.visits) {
                    visitCounts = visitsData.visits;
                }
            } else {
                console.log(`Could not fetch visit counts: ${visitsResponse.status}`);
            }
        } catch (visitsError) {
            console.error('Error fetching visit counts:', visitsError);
        }
        
        // Combine the documents with visit counts
        console.log('Raw document data from API:', docsData.documents);

        const documentsWithVisits = docsData.documents.map(doc => {
            // Get visit count for this document
            const visitCount = visitCounts[doc.id] || 0;
            
            // Extensive logging to debug title issues
            console.log(`Processing document ${doc.id}:`);
            console.log('- Raw title field:', doc.title);
            console.log('- All document fields:', Object.keys(doc).join(', '));
            
            // Try multiple possible title field names
            let documentTitle = 'Untitled Document';
            
            if (doc.title && typeof doc.title === 'string' && doc.title.trim() !== '') {
                documentTitle = doc.title;
                console.log(`- Using 'title' field: ${documentTitle}`);
            } else if (doc.document_title && typeof doc.document_title === 'string' && doc.document_title.trim() !== '') {
                documentTitle = doc.document_title;
                console.log(`- Using 'document_title' field: ${documentTitle}`);
            } else if (doc.name && typeof doc.name === 'string' && doc.name.trim() !== '') {
                documentTitle = doc.name;
                console.log(`- Using 'name' field: ${documentTitle}`);
            } else if (doc.text && typeof doc.text === 'string' && doc.text.trim() !== '') {
                // Use the first 50 characters of text as title
                documentTitle = doc.text.substring(0, 50) + '...';
                console.log(`- Using 'text' field: ${documentTitle}`);
            } else {
                console.log('- No valid title field found. Using default: "Untitled Document"');
            }
            
            return {
                document_id: doc.id,
                document_type: doc.document_type || 'single',
                title: documentTitle, // Use our determined title
                original_title: doc.title, // Keep original for debugging
                original_document: doc, // Keep full document for debugging
                visit_count: visitCount,
                last_visit_date: doc.updated_at || doc.publication_date || doc.created_at,
                keywords: doc.keywords || [],
                author: doc.author_name || doc.author || 'Unknown'
            };
        });
        
        // Sort by visit count (highest first)
        documentsWithVisits.sort((a, b) => b.visit_count - a.visit_count);
        
        console.log('Combined documents with visits:', documentsWithVisits);
        
        // Take the top documents based on limit
        updateWorksTable(documentsWithVisits.slice(0, limit));
    } catch (error) {
        console.error('Error in fetchDocumentsWithVisits:', error);
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
    console.log('Documents to display in works table:', documents);
    
    // Get the table body
    const tableBody = document.getElementById('most-visited-works-tbody');
    if (!tableBody) {
        console.error('Could not find most visited works table body');
        return;
    }
    
    // Clear existing content
    tableBody.innerHTML = '';
    
    // Check if we need to query actual document titles from database
    if (documents.some(doc => doc.title === 'Untitled Document' || !doc.title)) {
        console.warn('Some documents are missing titles - attempting direct database query...');
        
        // Mark documents that need title resolution
        documents.forEach(doc => {
            if (doc.title === 'Untitled Document' || !doc.title) {
                doc.needsTitleResolution = true;
            }
        });
        
        // Get list of document IDs that need title resolution
        const documentIdsToResolve = documents
            .filter(d => d.needsTitleResolution)
            .map(d => d.document_id || d.id)
            .filter(id => id); // Remove any undefined IDs
            
        if (documentIdsToResolve.length > 0) {
            console.log(`Attempting to resolve titles for ${documentIdsToResolve.length} documents:`, documentIdsToResolve);
            
            // Make a direct API call to resolve titles
            fetch('/api/documents/by-ids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentIds: documentIdsToResolve })
            })
            .then(response => {
                if (!response.ok) {
                    console.error(`Failed to resolve titles: ${response.status}`);
                    throw new Error(`Failed to resolve titles: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Title resolution response:', data);
                
                // Check if we have resolved documents
                if (data.documents && data.documents.length > 0) {
                    // Update titles with resolved ones
                    data.documents.forEach(resolvedDoc => {
                        // Find matching document in our list
                        const docToUpdate = documents.find(d => 
                            (d.document_id && d.document_id.toString() === resolvedDoc.id.toString()) || 
                            (d.id && d.id.toString() === resolvedDoc.id.toString())
                        );
                        
                        if (docToUpdate) {
                            // Try multiple fields for title
                            if (resolvedDoc.title) {
                                docToUpdate.title = resolvedDoc.title;
                                console.log(`✅ Resolved title for doc ${resolvedDoc.id}: "${resolvedDoc.title}"`);
                            } else if (resolvedDoc.name) {
                                docToUpdate.title = resolvedDoc.name;
                                console.log(`✅ Resolved title from name for doc ${resolvedDoc.id}: "${resolvedDoc.name}"`);
                            } else {
                                docToUpdate.title = `Document #${resolvedDoc.id}`;
                                console.log(`⚠️ Could not find title for doc ${resolvedDoc.id}, using ID instead`);
                            }
                            
                            // Mark as resolved
                            docToUpdate.needsTitleResolution = false;
                        }
                    });
                    
                    // Refresh the table with updated titles
                    console.log('Refreshing table with resolved titles');
                    renderDocumentsToTable(documents, tableBody);
                } else {
                    console.warn('No documents found in title resolution response');
                }
            })
            .catch(error => {
                console.error('Error resolving titles:', error);
                // Continue with rendering even if resolution failed
                renderDocumentsToTable(documents, tableBody);
            });
            
            // Initial render with unresolved titles
            // This will be updated once titles are resolved
            renderDocumentsToTable(documents, tableBody);
        } else {
            // If no titles need resolution, just render normally
            renderDocumentsToTable(documents, tableBody);
        }
    } else {
        // If no documents need title resolution, just render normally
        renderDocumentsToTable(documents, tableBody);
    }
}

// Separate function to render documents to the table
function renderDocumentsToTable(documents, tableBody) {
    // Add each document to the table
    documents.forEach((doc) => {
        // Add debug attribute to help identify untitled documents
        const debugInfo = doc.needsTitleResolution ? ' data-needs-title="true"' : '';
        
        // Create a row with the debug attribute
        const row = document.createElement('tr');
        row.className = 'most-visited-row';
        if (doc.needsTitleResolution) {
            row.setAttribute('data-needs-title', 'true');
            row.style.backgroundColor = '#fff8e1'; // Light yellow background for debugging
        }
        
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
        
        // Even more enhanced fallback for title
        let title = doc.title || 'Untitled Document';
        
        // If title is still "Untitled Document", create a more descriptive fallback
        if (title === 'Untitled Document' || !title) {
            // Try other fields in order of preference
            if (doc.document_title) {
                title = doc.document_title;
            } else if (doc.name) {
                title = doc.name;
            } else if (doc.description && doc.description.length > 0) {
                // Use first 50 chars of description
                title = doc.description.substring(0, 50) + (doc.description.length > 50 ? '...' : '');
            } else if (doc.document_type) {
                // Create title from document type and ID
                const docType = formatDocumentType(doc.document_type);
                title = `${docType} #${doc.document_id || doc.id || 'Unknown'}`;
            } else if (doc.document_id || doc.id) {
                title = `Document #${doc.document_id || doc.id}`;
            } else if (doc.path) {
                // Extract filename from path
                const pathParts = doc.path.split('/');
                title = pathParts[pathParts.length - 1];
            }
        }
        
        // Handle special case for legacy database entry format
        if (doc.original_document && doc.original_document.title) {
            title = doc.original_document.title;
        }
        
        // Only show the title without document type or date
        titleElement.textContent = title;
        // Add title attribute to show full title on hover
        titleElement.title = title;
        
        // Add data attribute for debugging
        titleElement.setAttribute('data-doc-id', doc.document_id || doc.id || 'unknown');
        
        // Log document data for debugging
        console.log(`Rendering document:`, {
            id: doc.document_id || doc.id,
            title: title,
            original_title: doc.title,
            doc_type: doc.document_type,
            all_fields: Object.keys(doc),
            final_title_used: title
        });
        
        // Format the document type for display (used for tags only)
        const docType = formatDocumentType(doc.document_type);
        
        // Create tags container
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'tags most-visited-tags';
        
        // Document type tag
        const docTypeSpan = document.createElement('span');
        docTypeSpan.className = 'doc-type most-visited-doc-type';
        docTypeSpan.textContent = docType;
        // Make the document type tag non-clickable
        docTypeSpan.style.pointerEvents = 'none';
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
                    // Make sure it's not clickable
                    keywordTag.style.pointerEvents = 'none';
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
                // Make sure it's not clickable
                keywordTag.style.pointerEvents = 'none';
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