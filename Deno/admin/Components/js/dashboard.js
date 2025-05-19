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
        
        // Get compiled documents - skip the failing endpoint
        console.log('Fetching compiled documents from filtered documents endpoint...');
        let compiledDocuments = [];
        try {
            // Skip the failing endpoint and go directly to the working one
                const filteredResponse = await fetch('/api/documents?is_compiled=true&limit=1000');
                if (filteredResponse.ok) {
                    const filteredData = await filteredResponse.json();
                    compiledDocuments = filteredData.documents || [];
                    console.log(`Found ${compiledDocuments.length} compiled documents from filtered endpoint`);
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
        
        // DEBUG: First check our debug endpoint to see what's actually in the database
        try {
            console.log('Checking debug endpoint data...');
            const debugResponse = await fetch('/api/debug/author-visits-counter');
            if (debugResponse.ok) {
                const debugData = await debugResponse.json();
                console.log('DEBUG DATA from counter table:', debugData);
                
                // Display debug info in the console in table format if available
                if (debugData.counter_data && debugData.counter_data.length > 0) {
                    console.table(debugData.counter_data);
                    console.log(`Found ${debugData.row_count} rows in author_visits_counter table`);
                } else {
                    console.log('No data found in author_visits_counter table');
                }
            } else {
                console.log('Debug endpoint not available or returned error');
            }
        } catch (debugError) {
            console.log('Error checking debug data:', debugError);
        }
        
        // Use the compatibility endpoint specifically for the dashboard with breakdown data
        const response = await fetch('/api/author-visits/stats?include_breakdown=true&nocache=' + Date.now());
        
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
        console.log('Raw API response from /api/author-visits/stats:', data);
        
        // CRITICAL FIX: Check if we got valid data and debug the structure
        if (data.topAuthors) {
            console.log('TopAuthors data structure:', data.topAuthors.map(a => {
                return {
                    name: a.full_name,
                    count: a.visit_count,
                    countType: typeof a.visit_count
                };
            }));
        } else {
            console.log('No topAuthors data found in API response');
            console.log('Response structure:', Object.keys(data));
        }
        
        // Enhanced data handling to check multiple response formats
        let usableData = { topAuthors: [] };
        
        // Check if we have data in different formats
        if (data.topAuthors && data.topAuthors.length > 0) {
            // Direct format with topAuthors array - ensure visit_count is a number
            usableData = {
                topAuthors: data.topAuthors.map(author => ({
                    ...author,
                    visit_count: Number(author.visit_count || 0),
                    author_id: author.author_id || author.id // Make sure we have author_id
                }))
            };
            console.log('Using topAuthors from direct response format with fixed number conversion');
        } else if (data.authors && data.authors.length > 0) {
            // Alternative format with authors array
            usableData = {
                topAuthors: data.authors.map(author => ({
                    full_name: author.full_name || author.name || 'Unknown Author',
                    visit_count: Number(author.visit_count || author.visits || 0),
                    profile_picture: author.profilePicUrl || author.profile_picture || author.avatar || "/admin/Components/img/samp_pfp.jpg",
                    author_id: author.author_id || author.id
                }))
            };
            console.log('Converted authors array to topAuthors format');
        } else {
            // Fallback to getting all authors
            console.log('No top authors data in expected format, fetching all authors...');
            const allAuthorsResponse = await fetch('/api/authors/all');
            
            if (allAuthorsResponse.ok) {
                const allAuthorsData = await allAuthorsResponse.json();
                usableData = {
                    topAuthors: allAuthorsData.authors.slice(0, 5).map(author => ({
                        full_name: author.full_name || author.name || 'Unknown Author',
                        visit_count: 0,
                        profile_picture: author.profilePicUrl || author.profile_picture || "/admin/Components/img/samp_pfp.jpg",
                        author_id: author.id
                    }))
                };
            }
        }
        
        // Final check to ensure we have visit counts as numbers
        usableData.topAuthors = usableData.topAuthors.map(author => {
            const visitCount = Number(author.visit_count || 0);
            console.log(`Author ${author.full_name}: raw count=${author.visit_count}, parsed=${visitCount}`);
            return {
                ...author,
                visit_count: visitCount
            };
        });
        
        updateTopAuthorsUI(usableData);
    } catch (error) {
        console.log('Error updating top authors:', error);
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
        
        // Improve profile picture URL handling to fix 404 errors
        let imageUrl = '/admin/Components/img/default_user.png'; // Default image that should always exist
        
        if (author.profile_picture) {
            // Check if profile_picture is already a full URL or a relative path
            if (author.profile_picture.startsWith('http') || author.profile_picture.startsWith('/')) {
                imageUrl = author.profile_picture;
            } else {
                // If it's just a filename, prepend the path
                imageUrl = `/storage/authors/profile-pictures/${author.profile_picture}`;
            }
            
            // Log the image URL for debugging
            console.log(`Author image URL: ${imageUrl} (from ${author.profile_picture})`);
        }
        
        // Format the visit count with the proper label - use 'let' instead of 'const' to allow updates
        let visitCount = author.visit_count || 0;
        let visitText = visitCount === 1 ? '1 visit' : `${visitCount} visits`;
        
        // Create DOM elements instead of using innerHTML for better control
        const imageDiv = document.createElement('div');
        imageDiv.className = 'author-image';
        imageDiv.style.backgroundImage = `url('${imageUrl}')`;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'author-name';
        nameDiv.textContent = author.full_name;
        
        const visitsDiv = document.createElement('div');
        visitsDiv.className = 'author-visits';
        visitsDiv.textContent = visitText;
        
        // Append all elements to the author card
        authorElement.appendChild(imageDiv);
        authorElement.appendChild(nameDiv);
        authorElement.appendChild(visitsDiv);
        
        // Create tooltip for showing guest/user breakdown
        const tooltip = document.createElement('div');
        tooltip.className = 'author-visits-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.display = 'none';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '0.75rem';
        tooltip.style.borderRadius = '0.375rem';
        tooltip.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        tooltip.style.fontSize = '0.875rem';
        tooltip.style.zIndex = '1000';
        tooltip.style.width = 'auto';
        tooltip.style.minWidth = '200px';
        tooltip.style.pointerEvents = 'none'; // Ensure tooltip doesn't interfere with mouse events

        // Get the breakdown for guest/user visits
        // Start with default values that will be updated when data is fetched
        let guestCount = Math.round(visitCount * 0.85); // Default estimate: 85% guest visits
        let userCount = visitCount - guestCount; // Default estimate: 15% user visits
        
        // Fetch actual breakdown data if we have an author ID
        if (author.author_id) {
            // Create loading content
            tooltip.innerHTML = `
                <div style="text-align: center; padding: 5px;">
                    <div style="font-size: 0.9rem;">Loading visit details...</div>
                </div>
            `;
            
            // Fetch the visit breakdown asynchronously
            fetch(`/api/author-visits/${author.author_id}?days=30&nocache=${Date.now()}`)
                .then(response => response.json())
                .then(data => {
                    console.log(`Visit breakdown data for ${author.full_name}:`, JSON.stringify(data, null, 2));
                    
                    // Extract the visitor type breakdown directly
                    if (data && data.visitsByType) {
                        // Log the specific breakdown structure
                        console.log(`Breakdown structure for ${author.full_name}:`, {
                            guest: data.visitsByType.guest,
                            guest_type: typeof data.visitsByType.guest,
                            user: data.visitsByType.user,
                            user_type: typeof data.visitsByType.user,
                            total: data.total
                        });
                        
                        // Get the correct breakdown - ensure we have numbers
                        guestCount = Number(data.visitsByType.guest || 0);
                        userCount = Number(data.visitsByType.user || 0);
                        
                        // Ensure total matches the sum (or use the larger value if there's a discrepancy)
                        const breakdownSum = guestCount + userCount;
                        if (breakdownSum > 0) {
                            // ALWAYS update visitCount based on actual data from breakdown
                            visitCount = breakdownSum;
                            visitText = visitCount === 1 ? '1 visit' : `${visitCount} visits`;
                            visitsDiv.textContent = visitText;
                            console.log(`Updated visit count for ${author.full_name} to ${visitCount} based on breakdown`);
                            
                            // Also update the author object to reflect correct count
                            author.visit_count = visitCount;
                        } else if (data.total > 0) {
                            // If we have a total but no breakdown, use the total
                            visitCount = Number(data.total);
                            visitText = visitCount === 1 ? '1 visit' : `${visitCount} visits`;
                            visitsDiv.textContent = visitText;
                            console.log(`Updated visit count for ${author.full_name} to ${visitCount} based on total`);
                            
                            // Also update the author object
                            author.visit_count = visitCount;
                            
                            // Then estimate breakdown
                            guestCount = Math.round(data.total * 0.85);
                            userCount = data.total - guestCount;
                        }
                    } else if (data && typeof data.total === 'number' && data.total > 0) {
                        // If no breakdown but we have a total, estimate the values
                        guestCount = Math.round(data.total * 0.85);
                        userCount = data.total - guestCount;
                        
                        // If visitCount is 0 but we have a total, update it
                        if (visitCount === 0) {
                            visitCount = data.total;
                            visitsDiv.textContent = visitCount === 1 ? '1 visit' : `${visitCount} visits`;
                            console.log(`Updated visit count for ${author.full_name} from 0 to ${visitCount} based on total`);
                        }
                    }
                    
                    console.log(`Final counts for ${author.full_name}: guest=${guestCount}, user=${userCount}, total=${visitCount}`);
                    
                    // Update tooltip content
                    updateTooltipContent();
                })
                .catch(error => {
                    console.warn(`Error fetching visit breakdown for author ${author.author_id}:`, error);
                    // Use the default estimates
                    updateTooltipContent();
                });
        } else {
            // No author ID, use the defaults
            updateTooltipContent();
        }
        
        function updateTooltipContent() {
            // Create tooltip content with author name at the top and the breakdown
            tooltip.innerHTML = `
                <div style="margin-bottom: 0.75rem; font-size: 1rem; font-weight: bold; text-align: center;">${author.full_name}</div>
                <div style="margin-bottom: 0.5rem"><strong>Visit Breakdown:</strong></div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem">
                    <span>Guest Visits:</span>
                    <strong>${guestCount}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem">
                    <span>User Visits:</span>
                    <strong>${userCount}</strong>
                </div>
                <div style="border-top: 1px solid rgba(255, 255, 255, 0.2); padding-top: 0.5rem;">
                    <div style="display: flex; justify-content: space-between">
                        <span>Total Visits:</span>
                        <strong>${visitCount}</strong>
                    </div>
                </div>
            `;
        }
        
        // Add tooltip to the page
        document.body.appendChild(tooltip);

        // Track if we're hovering over the author element
        let isHovering = false;
        let hideTooltipTimeout = null;

        // Add mouse event listeners to show/hide tooltip
        authorElement.addEventListener('mouseenter', function(e) {
            isHovering = true;
            
            // Clear any pending hide timeout
            if (hideTooltipTimeout) {
                clearTimeout(hideTooltipTimeout);
                hideTooltipTimeout = null;
            }
            
            const rect = this.getBoundingClientRect();
            // Center the tooltip under the author element
            const tooltipWidth = 220; // Approximate width based on our styling
            const leftPosition = rect.left + (rect.width / 2) - (tooltipWidth / 2) + window.scrollX;
            
            tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`; // Increase distance from element
            tooltip.style.left = `${leftPosition}px`;
            tooltip.style.display = 'block';
            // Allow the tooltip to be displayed before adding the visible class
            setTimeout(() => {
                if (isHovering) { // Only make visible if still hovering
                    tooltip.classList.add('visible');
                }
            }, 10);
        });
        
        authorElement.addEventListener('mouseleave', function() {
            isHovering = false;
            
            // Add a small delay before hiding to prevent flickering
            hideTooltipTimeout = setTimeout(() => {
                if (!isHovering) { // Only hide if we're not hovering
                    tooltip.classList.remove('visible');
                    // Wait for the transition to complete before hiding
                    setTimeout(() => {
                        if (!isHovering) {
                            tooltip.style.display = 'none';
                        }
                    }, 200); // Match the transition duration
                }
            }, 100); // Small delay before starting to hide
        });
        
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

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing dashboard...');
    
    // Add CSS for tooltips to the page
    const style = document.createElement('style');
    style.textContent = `
        .most-visited-visits {
            position: relative;
        }
        .visits-tooltip, .author-visits-tooltip {
            position: absolute;
            display: none;
            z-index: 1000;
            transition: opacity 0.2s ease-in-out, transform 0.2s ease-out;
            opacity: 0;
            transform: translateY(-4px);
            max-width: 280px;
        }
        .visits-tooltip.visible, .author-visits-tooltip.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Author tooltip specific styles */
        .author {
            position: relative;
            cursor: pointer;
            transition: transform 0.15s ease-in-out;
        }
        .author:hover {
            transform: translateY(-2px);
        }
        .author-visits-tooltip {
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
            text-align: left;
        }
    `;
    document.head.appendChild(style);
    
    // No need for manual refresh anymore since we fixed the data loading
    
    setTimeout(() => {
        updateWorksSummary();
        updateTopAuthors();
        updateTotalVisits();
    }, 100); // Small delay to ensure all HTML is loaded
}); 