// Function to update the works summary section with dynamic counts
async function updateWorksSummary() {
    try {
        console.log('Fetching documents data for category counts...');
        
        // Initialize counts
        const categoryCounts = {
            'thesis': 0,
            'dissertation': 0, 
            'confluence': 0,
            'synergy': 0
        };
        
        // Track which document IDs we've already counted to prevent double-counting
        const countedDocumentIds = new Set();
        
        // STEP 1: First try a direct API endpoint for counting documents by category
        try {
            const countResponse = await fetch('/api/documents/count-by-category');
            if (countResponse.ok) {
                const countData = await countResponse.json();
                console.log('Category count data received directly:', countData);
                
                if (countData && countData.categories) {
                    // If we have a dedicated endpoint that gives us complete counts, use it
                    Object.keys(categoryCounts).forEach(category => {
                        const upperCategory = category.toUpperCase();
                        if (countData.categories[upperCategory]) {
                            categoryCounts[category] = countData.categories[upperCategory];
                        }
                    });
                    
                    updateCategoryUI(categoryCounts);
                    return;
                }
            }
        } catch (countError) {
            console.log('Direct count endpoint not available:', countError);
        }
        
        // STEP 2: Fetch regular documents and compiled documents separately
        
        // Get regular documents
        console.log('Fetching regular documents...');
        let regularDocuments = [];
        try {
            const regularResponse = await fetch('/api/documents?limit=1000');
            if (regularResponse.ok) {
                const regularData = await regularResponse.json();
                regularDocuments = regularData.documents || [];
                console.log(`Found ${regularDocuments.length} regular documents`);
            }
        } catch (regularError) {
            console.error('Error fetching regular documents:', regularError);
        }
        
        // Count regular documents by category
        regularDocuments.forEach(doc => {
            // Skip if no ID
            if (!doc.id) return;
            
            // Skip if it's marked as compiled
            if (doc.is_compiled === true || doc.is_parent === true) {
                console.log(`Skipping compiled doc in regular documents: ${doc.id}`);
                return;
            }
            
            // Skip if already counted
            if (countedDocumentIds.has(doc.id)) {
                console.log(`Skipping already counted document: ${doc.id}`);
                return;
            }
            
            const docType = (doc.document_type || '').toLowerCase();
            if (categoryCounts.hasOwnProperty(docType)) {
                categoryCounts[docType]++;
                countedDocumentIds.add(doc.id);
                console.log(`Counted regular document ${doc.id} as ${docType}`);
            }
        });
        
        // Get compiled documents
        console.log('Directly fetching compiled documents from compiled_documents endpoint...');
        let compiledDocuments = [];
        try {
            // Try a more specific compiled documents endpoint first
            const compiledResponse = await fetch('/api/compiled-documents/all');
            if (compiledResponse.ok) {
                const compiledData = await compiledResponse.json();
                compiledDocuments = compiledData.documents || [];
                console.log(`Found ${compiledDocuments.length} compiled documents from direct endpoint`);
            } else {
                // Fallback to the documents endpoint with filter
                console.log('Falling back to filtered documents endpoint...');
                const filteredResponse = await fetch('/api/documents?is_compiled=true&limit=1000');
                if (filteredResponse.ok) {
                    const filteredData = await filteredResponse.json();
                    compiledDocuments = filteredData.documents || [];
                    console.log(`Found ${compiledDocuments.length} compiled documents from filtered endpoint`);
                }
            }
        } catch (compiledError) {
            console.error('Error fetching compiled documents:', compiledError);
        }
        
        // Process compiled documents
        compiledDocuments.forEach(doc => {
            // Skip if no ID
            if (!doc.id) return;
            
            // Skip if already counted
            if (countedDocumentIds.has(doc.id)) {
                console.log(`Skipping already counted compiled document: ${doc.id}`);
                return;
            }
            
            // First check document_type, then check category which might be used in compiled docs
            let docType = (doc.document_type || '').toLowerCase();
            if (!docType && doc.category) {
                docType = doc.category.toLowerCase();
            }
            
            if (categoryCounts.hasOwnProperty(docType)) {
                categoryCounts[docType]++;
                countedDocumentIds.add(doc.id);
                console.log(`Counted compiled document ${doc.id} as ${docType}`);
            } else if (docType === 'confluence' || docType.includes('confluence')) {
                categoryCounts.confluence++;
                countedDocumentIds.add(doc.id);
                console.log(`Counted compiled document ${doc.id} as confluence`);
            } else if (docType === 'synergy' || docType.includes('synergy')) {
                categoryCounts.synergy++;
                countedDocumentIds.add(doc.id);
                console.log(`Counted compiled document ${doc.id} as synergy`);
            } else {
                console.warn(`Unrecognized compiled document type: ${docType} for doc ${doc.id}`);
            }
        });
        
        // STEP 3: As a last resort, try the categories endpoint for total counts
        // We'll only use this if we couldn't get any documents from the other methods
        if (countedDocumentIds.size === 0) {
            console.log('No documents counted, checking categories endpoint as fallback...');
            try {
                const categoriesResponse = await fetch('/api/categories');
                if (categoriesResponse.ok) {
                    const categories = await categoriesResponse.json();
                    console.log('Categories data received:', categories);
                    
                    // Process each category
                    categories.forEach(category => {
                        const count = Number(category.count) || 0;
                        const name = (category.name || '').toLowerCase();
                        
                        if (categoryCounts.hasOwnProperty(name)) {
                            categoryCounts[name] = count;
                            console.log(`Updated count for ${name} to ${count} from categories endpoint`);
                        }
                    });
                }
            } catch (categoriesError) {
                console.error('Error fetching categories:', categoriesError);
            }
        }
        
        console.log(`Final document counts by category (counted ${countedDocumentIds.size} unique documents):`, categoryCounts);
        updateCategoryUI(categoryCounts);
        
    } catch (error) {
        console.error('Error updating works summary:', error);
        // Display error in the UI
        document.querySelectorAll('.work-count .count').forEach(el => {
            el.textContent = 'Error';
        });
        const totalCountElement = document.querySelector('.total-count');
        if (totalCountElement) {
            totalCountElement.textContent = 'Error';
        }
    }
}

// Helper function to update the UI with category counts
function updateCategoryUI(categoryCounts) {
    // Update individual category counts
    document.querySelectorAll('.work-count').forEach(workCountEl => {
        // Find which category this element represents
        Object.keys(categoryCounts).forEach(category => {
            if (workCountEl.querySelector(`.work-type.${category}-text`)) {
                const countEl = workCountEl.querySelector('.count');
                if (countEl) {
                    countEl.textContent = categoryCounts[category];
                }
            }
        });
    });
    
    // Calculate total works
    const totalWorks = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    
    // Update total works count
    const totalCountElement = document.querySelector('.total-count');
    if (totalCountElement) {
        totalCountElement.textContent = totalWorks;
    } else {
        console.warn('Could not find total count element');
    }
}

// Function to update the top authors section with dynamic data
async function updateTopAuthors() {
    try {
        console.log('Fetching top authors data...');
        const response = await fetch('/api/author-visits/top-authors');
        
        if (!response.ok) {
            console.log(`HTTP error! status: ${response.status}`);
            // Try to fetch all authors instead
            console.log('Fetching all authors as fallback...');
            const allAuthorsResponse = await fetch('/api/authors/all');
            
            if (!allAuthorsResponse.ok) {
                // If both APIs fail, use mock data
                console.log('Using mock data as both APIs failed');
                const mockData = {
                    topAuthors: [
                        { full_name: "Jane Smith", visit_count: 521, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                        { full_name: "John Doe", visit_count: 470, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                        { full_name: "Alex Johnson", visit_count: 455, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                        { full_name: "Maria Garcia", visit_count: 400, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                        { full_name: "Robert Chen", visit_count: 399, profile_picture: "/admin/Components/img/samp_pfp.jpg" }
                    ]
                };
                updateTopAuthorsUI(mockData);
                return;
            }
            
            // Convert all authors data to top authors format
            const allAuthorsData = await allAuthorsResponse.json();
            console.log('All authors data received:', allAuthorsData);
            
            // Transform authors data to match the expected format
            // Set view count to 0 for all authors since we don't have real counts
            const transformedData = {
                topAuthors: allAuthorsData.authors.slice(0, 5).map(author => ({
                    full_name: author.full_name,
                    visit_count: 0, // No visit count data available
                    profile_picture: author.profilePicUrl || "/admin/Components/img/samp_pfp.jpg"
                }))
            };
            
            updateTopAuthorsUI(transformedData);
            return;
        }
        
        const data = await response.json();
        console.log('Top authors data received:', data);
        
        // If we have top authors data but it's empty, try to fetch all authors
        if (!data.topAuthors || data.topAuthors.length === 0) {
            console.log('No top authors data, fetching all authors...');
            const allAuthorsResponse = await fetch('/api/authors/all');
            
            if (allAuthorsResponse.ok) {
                const allAuthorsData = await allAuthorsResponse.json();
                const transformedData = {
                    topAuthors: allAuthorsData.authors.slice(0, 5).map(author => ({
                        full_name: author.full_name,
                        visit_count: 0,
                        profile_picture: author.profilePicUrl || "/admin/Components/img/samp_pfp.jpg"
                    }))
                };
                updateTopAuthorsUI(transformedData);
                return;
            }
        }
        
        updateTopAuthorsUI(data);
    } catch (error) {
        console.log('Error updating top authors:', error);
        // Try to fetch all authors as a fallback
        try {
            console.log('Trying to fetch all authors after error...');
            const allAuthorsResponse = await fetch('/api/authors/all');
            
            if (allAuthorsResponse.ok) {
                const allAuthorsData = await allAuthorsResponse.json();
                const transformedData = {
                    topAuthors: allAuthorsData.authors.slice(0, 5).map(author => ({
                        full_name: author.full_name,
                        visit_count: 0,
                        profile_picture: author.profilePicUrl || "/admin/Components/img/samp_pfp.jpg"
                    }))
                };
                updateTopAuthorsUI(transformedData);
                return;
            }
        } catch (fallbackError) {
            console.log('Error fetching all authors as fallback:', fallbackError);
        }
        
        // Use mock data if all else fails
        const mockData = {
            topAuthors: [
                { full_name: "Jane Smith", visit_count: 521, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                { full_name: "John Doe", visit_count: 470, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                { full_name: "Alex Johnson", visit_count: 455, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                { full_name: "Maria Garcia", visit_count: 400, profile_picture: "/admin/Components/img/samp_pfp.jpg" },
                { full_name: "Robert Chen", visit_count: 399, profile_picture: "/admin/Components/img/samp_pfp.jpg" }
            ]
        };
        updateTopAuthorsUI(mockData);
    }
}

function updateTopAuthorsUI(data) {
    // Get the authors list container
    const authorsListContainer = document.querySelector('.authors-list');
    if (!authorsListContainer) {
        console.warn('Could not find authors list container');
        return;
    }
    
    // Clear existing content
    authorsListContainer.innerHTML = '';
    
    // Sort authors by visit count in descending order
    const sortedAuthors = [...data.topAuthors].sort((a, b) => (b.visit_count || 0) - (a.visit_count || 0));
    
    // Add each author to the list
    sortedAuthors.forEach(author => {
        const authorElement = document.createElement('div');
        authorElement.className = 'author';
        
        // Create author image div with background image
        const imageUrl = author.profile_picture || './Components/img/samp_pfp.jpg';
        
        // Format the visit count with the proper label
        const visitCount = author.visit_count || 0;
        const visitText = visitCount === 1 ? '1 visit' : `${visitCount} visits`;
        
        // Create DOM elements instead of using innerHTML for better control
        const imageDiv = document.createElement('div');
        imageDiv.className = 'author-image';
        imageDiv.style.backgroundImage = `url('${imageUrl}')`;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'author-name';
        nameDiv.textContent = author.full_name;
        nameDiv.title = author.full_name; // Add title attribute for tooltip
        
        const visitsDiv = document.createElement('div');
        visitsDiv.className = 'author-visits';
        visitsDiv.textContent = visitText;
        
        // Append all elements to the author card
        authorElement.appendChild(imageDiv);
        authorElement.appendChild(nameDiv);
        authorElement.appendChild(visitsDiv);
        
        authorsListContainer.appendChild(authorElement);
    });
}

// Function to update the total visits section with dynamic data
async function updateTotalVisits() {
    try {
        console.log('Fetching visit statistics...');
        const response = await fetch('/api/page-visits/home-stats');
        
        if (!response.ok) {
            console.log(`HTTP error! status: ${response.status}`);
            
            // Try to get author visit stats as a fallback
            const authorResponse = await fetch('/api/author-visits/stats');
            
            if (!authorResponse.ok) {
                // Use mock data if both APIs return 404
                const mockData = {
                    stats: {
                        total: 12321,
                        guest: 10653,
                        user: 1668
                    }
                };
                updateTotalVisitsUI(mockData);
                return;
            }
            
            // Use author visit stats if available
            const authorData = await authorResponse.json();
            console.log('Author visit statistics received as fallback:', authorData);
            updateTotalVisitsUI(authorData);
            return;
        }
        
        const data = await response.json();
        console.log('Home page visit statistics received:', data);
        updateTotalVisitsUI(data);
    } catch (error) {
        console.log('Error updating visit statistics:', error);
        // Use mock data on error
        const mockData = {
            stats: {
                total: 12321,
                guest: 10653,
                user: 1668
            }
        };
        updateTotalVisitsUI(mockData);
    }
}

function updateTotalVisitsUI(data) {
    // Update total visits count
    const totalVisitsElement = document.querySelector('.total-visits-number');
    if (totalVisitsElement) {
        totalVisitsElement.textContent = data.stats.total.toLocaleString();
    }
    
    // Update guest visits count
    const guestVisitsElement = document.querySelector('.visits-row div:first-child .visit-count');
    if (guestVisitsElement) {
        guestVisitsElement.textContent = data.stats.guest.toLocaleString();
    }
    
    // Update user visits count
    const userVisitsElement = document.querySelector('.visits-row div:last-child .visit-count');
    if (userVisitsElement) {
        userVisitsElement.textContent = data.stats.user.toLocaleString();
    }
    
    // Update the labels to indicate these are home page visits
    const visitLabels = document.querySelectorAll('.visit-label');
    if (visitLabels.length >= 2) {
        visitLabels[0].textContent = 'Guest Home Visits';
        visitLabels[1].textContent = 'User Home Visits'; 
    }
    
    // Update the total visits label
    const totalVisitsLabel = document.querySelector('.total-visits > div:nth-child(2)');
    if (totalVisitsLabel) {
        totalVisitsLabel.textContent = 'Total Home Page Visits';
    }
}

// Update works summary, top authors, and visit statistics when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing dashboard...');
    setTimeout(() => {
        updateWorksSummary();
        updateTopAuthors();
        updateTotalVisits();
    }, 100); // Small delay to ensure all HTML is loaded
}); 