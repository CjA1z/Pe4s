/**
 * navbar-loader.js
 *
 * A comprehensive, reusable module for loading and initializing the navbar
 * across all pages in the application.
 */

// Create a global NavbarModule object
window.NavbarModule = (function() {
    'use strict';

    // Configuration
    const USER_NAVBAR_URL = '/components/NavBar/user-Navbar.html';
    const GUEST_NAVBAR_URL = '/components/NavBar/default-NavBar.html';
    const USER_PROFILE_URL = '/api/user/profile';
    const LIBRARY_COUNT_URL = '/api/user/library/count';
    const JQUERY_CDN_URL = 'https://code.jquery.com/jquery-3.6.4.min.js';
    
    // Global initialization flag to prevent double initialization
    let isInitialized = false;

    // Check if jQuery is available, load it if not
    function ensureJQuery(callback) {
        if (window.jQuery) {
            console.log('jQuery is already available');
            if (callback) callback();
            return;
        }
        
        console.log('jQuery not found, loading from CDN...');
        const script = document.createElement('script');
        script.src = JQUERY_CDN_URL;
        script.integrity = 'sha256-oP6HI9z1XaZNBrJURtCoUT5SUnxFr8s3BzRl+cbzUq8=';
        script.crossOrigin = 'anonymous';
        
        script.onload = function() {
            console.log('jQuery loaded successfully from CDN');
            if (callback) callback();
        };
        
        script.onerror = function() {
            console.error('Failed to load jQuery from CDN');
            if (callback) callback(new Error('Failed to load jQuery'));
        };
        
        document.head.appendChild(script);
    }

    // Main initialization function - call this from each page
    function initNavbar() {
        console.log('Navbar module initializing...');
        console.log('DEBUG: Starting navbar initialization process');
        
        // Prevent double initialization
        if (isInitialized) {
            console.log('Navbar already initialized, skipping...');
            return;
        }
        
        // Check if navbar container exists
        const navbarContainer = document.getElementById('navbarContainer');
        if (!navbarContainer) {
            console.error('DEBUG: navbarContainer element not found in the DOM! Please add <div id="navbarContainer"></div> to your page.');
            return;
        } else {
            console.log('DEBUG: navbarContainer found in the DOM');
        }
        
        // Check if we're on a page that should not display the navbar
        const currentPath = window.location.pathname;
        const excludedPages = ['/pages/doc-single.html', '/pages/doc-compiled.html', '/pages/doc-compiled-single.html'];
        
        if (excludedPages.some(page => currentPath.includes(page))) {
            console.log('Navbar excluded on this page:', currentPath);
            return; // Skip navbar initialization for excluded pages
        }
        
        // Add global logout function that can be called from anywhere
        window.logout = logout;
        
        // First, clean up any stale user data
        cleanupUserData();
        
        // Add global function for login button
        window.handleLogin = function(event) {
            console.log("Global handleLogin function called");
            // Navigate to login page
            window.location.href = '/log-in.html';
        };
        
        // Ensure jQuery is available before proceeding
        ensureJQuery(function(error) {
            if (error) {
                console.warn('Proceeding without jQuery');
            }
        
        // Make sure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupNavbar);
                console.log('DEBUG: DOM not ready, added DOMContentLoaded listener');
        } else {
                console.log('DEBUG: DOM already loaded, calling setupNavbar directly');
            setupNavbar();
        }
        });
        
        // Implementation of recordPageVisit function
        if (typeof window.recordPageVisit !== 'function') {
            window.recordPageVisit = function() {
                try {
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
                        metadata: {}
                    };
                    
                    console.log(`Recording page visit for: ${pageUrl}`);
                    
                    // Send the visit data to the API
                    fetch('/api/page-visits', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(userInfo?.token ? {'Authorization': `Bearer ${userInfo.token}`} : {})
                        },
                        body: JSON.stringify(visitData)
                    }).then(response => {
                        if (!response.ok) {
                            console.warn(`Failed to record page visit: ${response.status} ${response.statusText}`);
                            return;
                        }
                        console.log('Page visit recorded successfully');
                    }).catch(error => {
                        console.error('Error recording page visit:', error);
                    });
                } catch (error) {
                    console.error('Error in recordPageVisit:', error);
                    // Non-critical error, don't disrupt the user experience
                }
            };
        }
        
        // Set initialization flag to true
        isInitialized = true;
    }

    // Function to clean up stale user data
    function cleanupUserData() {
        try {
            // Check sessionStorage
            const sessionUserInfo = sessionStorage.getItem('userInfo');
            if (sessionUserInfo) {
                try {
                    const userInfo = JSON.parse(sessionUserInfo);
                    
                    // If login time is more than 24 hours ago, clear it
                    if (userInfo.loginTime) {
                        const loginTime = new Date(userInfo.loginTime);
                        const currentTime = new Date();
                        const hoursSinceLogin = (currentTime - loginTime) / (1000 * 60 * 60);
                        
                        if (hoursSinceLogin > 24) {
                            console.log('Clearing stale session user data (older than 24 hours)');
                            sessionStorage.removeItem('userInfo');
                        }
                    }
                    
                    // If no token or login status is false, clear it
                    if (!userInfo.token || userInfo.isLoggedIn !== true) {
                        console.log('Clearing invalid session user data');
                        sessionStorage.removeItem('userInfo');
                    }
                } catch (e) {
                    console.error('Error parsing session user data, clearing it:', e);
                    sessionStorage.removeItem('userInfo');
                }
            }
            
            // Remove any existing localStorage items for backward compatibility
            if (localStorage.getItem('userInfo')) {
                console.log('Removing localStorage user data (moving to session-only auth)');
                            localStorage.removeItem('userInfo');
                        }
            if (localStorage.getItem('session_token')) {
                localStorage.removeItem('session_token');
            }
        } catch (e) {
            console.error('Error in cleanupUserData:', e);
        }
    }

    // Main setup logic
    function setupNavbar() {
        // Check for navbar container
        const navbarContainer = document.getElementById('navbarContainer');
        if (!navbarContainer) {
            console.error('Navbar container not found! Please add <div id="navbarContainer"></div> to your page.');
            return;
        }
        
        // Check if navbar is already initialized or initializing
        if (navbarContainer.dataset.initialized === 'true' || navbarContainer.dataset.initializing === 'true') {
            console.log('Navbar already initialized or initializing, skipping...');
            return;
        }

        // Check user authentication and load appropriate navbar
        const userInfo = getUserInfo();
        const isLoggedIn = isUserLoggedIn(userInfo);
        
        console.log(`User login status: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
        
        // Add initialized flag to the container
        navbarContainer.dataset.initializing = 'true';
        
        // Load the appropriate navbar
        loadNavbar(navbarContainer, isLoggedIn, userInfo);
        
        // Set up an observer to watch for when the navbar content is loaded
        const observer = new MutationObserver(function(mutations) {
            // Look for newly added nav elements
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    // Check if there's a navbar in the added content
                    const hasNavElement = Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === 1 && // Element node
                        (node.tagName === 'NAV' || node.querySelector('nav'))
                    );
                    
                    if (hasNavElement && navbarContainer.dataset.initializing === 'true') {
                        console.log('Navbar content loaded successfully, initializing functionality');
                        observer.disconnect();
                        
                        // Mark as initialized to prevent double initialization
                        navbarContainer.dataset.initializing = 'false';
                        navbarContainer.dataset.initialized = 'true';
                        
                        // Initialize navbar functionality
                        initializeNavbarFunctionality(userInfo);
                        
                        // Setup event listeners
                        setupDropdown();
                        setupMobileMenu();
                        setupSearch();
                        
                        break;
                    }
                }
            }
        });
        
        // Start observing
        observer.observe(navbarContainer, { 
            childList: true,
            subtree: true
        });
        
        // Failsafe: Try initializing after a delay if observer didn't catch it
        setTimeout(() => {
            const navElement = navbarContainer.querySelector('nav');
            if (navElement && navbarContainer.dataset.initialized !== 'true') {
                console.log('Navbar found through timeout check, initializing functionality');
                
                // Mark as initialized
                navbarContainer.dataset.initializing = 'false';
                navbarContainer.dataset.initialized = 'true';
                
                initializeNavbarFunctionality(userInfo);
                setupDropdown();
                setupMobileMenu();
                setupSearch();
            }
        }, 800); // Slightly longer timeout to ensure content is loaded
    }

    // Get user information from storage
    function getUserInfo() {
        try {
            // Check sessionStorage only
            const sessionUserInfo = sessionStorage.getItem('userInfo');
            
            console.log('DEBUG: Raw user info found in storage:');
            console.log('- sessionStorage:', sessionUserInfo ? 'present' : 'not found');
            
            // Parse the stored JSON data
            if (sessionUserInfo) {
                try {
                    const userInfo = JSON.parse(sessionUserInfo);
                    console.log('Found user info in sessionStorage');
                    
                    // Validate essential properties
                    if (!userInfo.token) {
                        console.warn('Token missing in sessionStorage user info');
                    }
                    
                    if (userInfo.isLoggedIn !== true) {
                        console.warn('isLoggedIn flag not true in sessionStorage user info');
                    }
                    
                    // Fetch additional user info from database if we have a token
                    if (userInfo.token) {
                        fetchUserProfileFromDatabase(userInfo)
                            .then(dbUserInfo => {
                                if (dbUserInfo) {
                                    // Merge the existing userInfo with database info
                                    console.log('Successfully fetched user profile from database');
                                }
                            })
                            .catch(error => {
                                console.error('Error fetching user profile from database:', error);
                            });
                    }
                    
                    return userInfo;
                } catch (parseError) {
                    console.error('Error parsing sessionStorage user info:', parseError);
                    // Clear invalid data
                    sessionStorage.removeItem('userInfo');
                    return null;
                }
            }
            
            console.log('No user info found in storage');
            return null;
        } catch (error) {
            console.error('Error retrieving user info:', error);
            return null;
        }
    }

    // Fetch user profile information from the database
    async function fetchUserProfileFromDatabase(userInfo) {
        if (!userInfo || !userInfo.token) {
            console.error('Cannot fetch user profile without a token');
            return null;
        }
        
        try {
            console.log('Fetching user profile from database...');
            
            // Make API call to fetch user data from database
            // Add userId to the URL as a query parameter
            const userId = userInfo.id || userInfo.user_id || '';
            console.log('Fetching profile for user ID:', userId);
            
            const response = await fetch(`/api/user/profile?userId=${userId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${userInfo.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText}`);
            }
            
            const dbUserData = await response.json();
            console.log('User profile data received:', dbUserData);
            
            if (dbUserData) {
                // Update session storage with the enriched user data
                // Especially ensure we're using first_name from the database
                const updatedUserInfo = {
                    ...userInfo,
                    first_name: dbUserData.first_name || userInfo.first_name || userInfo.id,
                    last_name: dbUserData.last_name || userInfo.last_name || '',
                    email: dbUserData.email || userInfo.email || '',
                    display_name: dbUserData.first_name || userInfo.first_name || userInfo.id,
                    // Add other fields as needed
                };
                
                console.log('Updated user info with DB data:', updatedUserInfo);
                
                // Update the session storage
                sessionStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
                
                // If already in a loaded state, update the UI
                const navbarContainer = document.getElementById('navbarContainer');
                if (navbarContainer && navbarContainer.dataset.initialized === 'true') {
                    updateProfileInfo(updatedUserInfo);
                }
                
                return updatedUserInfo;
            }
            
            return null;
        } catch (error) {
            console.error('Error in fetchUserProfileFromDatabase:', error);
            return null;
        }
    }

    // Check if user is logged in
    function isUserLoggedIn(userInfo) {
        if (!userInfo) {
            console.log('No user info found - not logged in');
            return false;
        }
        
        console.log('DEBUG: Checking user info for login status:', JSON.stringify(userInfo, null, 2));
        
        // Check for token validity
        if (!userInfo.token) {
            console.log('No token found in user info - not logged in');
            return false;
        }
        
        // Check for login timestamp and validate it's not too old (24 hours)
        if (userInfo.loginTime) {
            const loginTime = new Date(userInfo.loginTime);
            const currentTime = new Date();
            const hoursSinceLogin = (currentTime - loginTime) / (1000 * 60 * 60);
            
            if (hoursSinceLogin > 24) {
                console.log('Login session expired (older than 24 hours) - clearing old data');
                // Clear stale data
                sessionStorage.removeItem('userInfo');
                return false;
            }
        }
        
        // Final check for essential properties - ensuring isLoggedIn is explicitly true
        const isLoggedIn = userInfo.isLoggedIn === true && userInfo.token && userInfo.token.length > 0;
        console.log(`User login status: ${isLoggedIn ? 'Valid session' : 'Invalid session'} - Token present: ${!!userInfo.token}, isLoggedIn flag: ${userInfo.isLoggedIn}`);
        return isLoggedIn;
    }

    // Fetch and load the navbar HTML
    function loadNavbar(container, isLoggedIn, userInfo) {
        // Get the appropriate navbar URL
        const navbarUrl = isLoggedIn ? USER_NAVBAR_URL : GUEST_NAVBAR_URL;
        
        console.log(`Loading navbar from ${navbarUrl} (User status: ${isLoggedIn ? 'Logged in' : 'Guest'})`);
        
        // Try both capitalizations of path
        const urls = [
            navbarUrl,
            navbarUrl.replace('/components/', '/Components/')
        ];
        
        // Check if jQuery is available
        if (typeof jQuery !== 'undefined') {
            console.log('Using jQuery load method for navbar');
            
            // Use jQuery's load method which handles insertion and script execution
            $(container).load(urls[0], function(response, status, xhr) {
                if (status === "error") {
                    console.log(`Failed to load navbar from ${urls[0]}, trying alternative path`);
                    
                    // Try the alternative capitalization
                    $(container).load(urls[1], function(response2, status2, xhr2) {
                        if (status2 === "error") {
                            console.error(`Failed to load navbar from both paths: ${status}, ${status2}`);
                            createFallbackNavbar(container);
                        } else {
                            console.log(`Navbar loaded successfully from alternative path: ${urls[1]}`);
                        }
                    });
                } else {
                    console.log(`Navbar loaded successfully from: ${urls[0]}`);
                }
            });
        } else {
            console.log('jQuery not available, using fetch API');
            
            // Fallback to fetch API for browsers without jQuery
            fetch(urls[0])
                .then(response => {
                    if (!response.ok) {
                        console.log(`Fetch failed for ${urls[0]}, trying alternative path`);
                        return fetch(urls[1]).then(altResponse => {
                            if (!altResponse.ok) {
                                throw new Error(`Failed to load navbar from both paths`);
                            }
                            console.log(`Navbar fetched successfully from: ${urls[1]}`);
                            return altResponse.text();
                        });
                    }
                    console.log(`Navbar fetched successfully from: ${urls[0]}`);
                    return response.text();
                })
                .then(htmlContent => {
                    // Simple insertion of content
                    container.innerHTML = htmlContent;
                    console.log('Navbar HTML inserted into container');
                })
                .catch(error => {
            console.error('Error loading navbar:', error);
            createFallbackNavbar(container);
                });
        }
    }

    // Initialize navbar functionality after loading
    function initializeNavbarFunctionality(userInfo) {
        console.log('Initializing navbar functionality with user info:', userInfo);
        
        try {
            // Specifically initialize the profile badge for logged in users
            if (userInfo && isUserLoggedIn(userInfo)) {
                console.log('User is logged in, updating profile UI');
                
                // Fetch fresh user data from database if not already done
                if (userInfo.token && !userInfo.first_name) {
                    fetchUserProfileFromDatabase(userInfo)
                        .then(dbUserInfo => {
                            if (dbUserInfo) {
                                // Re-initialize with the fresh data
                                userInfo = dbUserInfo;
                            }
                            // Continue with UI initialization
                            initializeUserInterface(userInfo);
                        })
                        .catch(error => {
                            console.error('Error fetching user profile during initialization:', error);
                            // Continue with what we have
                            initializeUserInterface(userInfo);
                        });
                } else {
                    // Continue with current userInfo
                    initializeUserInterface(userInfo);
                }
            } else {
                console.log('User is not logged in, setting up login buttons');
                // Setup login buttons for non-logged in users
                setupLoginButtons();
            }
        
            // Set up dropdown toggle
            setupDropdown();
            
            // Set up mobile menu toggle
            setupMobileMenu();
            
            // Set up search button
            setupSearch();
                    } catch (error) {
            console.error('Error in initializeNavbarFunctionality:', error);
        }
    }

    // Helper function to initialize the UI after getting user data
    function initializeUserInterface(userInfo) {
        // Find user-auth-container elements
        const userAuthContainer = document.getElementById('user-auth-container');
        const mobileUserAuthContainer = document.getElementById('mobile-user-auth-container');
        
        if (userAuthContainer) {
            console.log('Found user-auth-container, initializing profile badge');
            
            // Initialize user data display in the navbar
            updateProfileInfo(userInfo);
            
            // Add fallback implementations in case they're not defined in the navbar
            if (typeof window.createProfileBadge !== 'function') {
                console.log('createProfileBadge function not found in navbar, using fallback implementation');
                
                window.createProfileBadge = function(user) {
                    // Generate initials
                    let initials = '';
                    if (user.first_name && user.last_name) {
                        initials = user.first_name.charAt(0) + user.last_name.charAt(0);
                    } else if (user.first_name) {
                        initials = user.first_name.charAt(0) + (user.middle_name ? user.middle_name.charAt(0) : '');
                    } else if (user.username) {
                        const parts = user.username.split(' ');
                        if (parts.length > 1) {
                            initials = parts[0].charAt(0) + parts[parts.length-1].charAt(0);
                        } else {
                            initials = user.username.substring(0, 2);
                        }
                    } else {
                        initials = 'U';
                    }
                    
                    // Full name for display - prioritize first_name from database
                    const displayName = user.display_name || user.first_name || user.name || user.username || 'User';
                    
                    // Create profile badge container
                    const profileBadgeContainer = document.createElement('div');
                    profileBadgeContainer.id = 'profile-badge-container-dynamic';
                    profileBadgeContainer.className = 'relative inline-block text-left';
                    
                    // Create button
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.id = 'profile-badge-button';
                    button.className = 'flex items-center justify-center w-10 h-10 bg-green-600 rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-green-600 profile-initials text-lg select-none';
                    button.setAttribute('aria-expanded', 'false');
                    button.setAttribute('aria-haspopup', 'true');
                    button.innerHTML = `<span class="text-white font-medium">${initials.toUpperCase()}</span>`;
                    
                    // Add click listener directly to button
                    button.addEventListener('click', function(event) {
                        event.stopPropagation();
                        
                        // Toggle dropdown visibility
                        const dropdownMenu = this.nextElementSibling;
                        if (!dropdownMenu) return;
                        
                        const isOpen = dropdownMenu.classList.contains('opacity-100');
                        
                        if (isOpen) {
                            // Close dropdown
                            dropdownMenu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
                            dropdownMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            } else {
                            // Open dropdown
                            dropdownMenu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
                            dropdownMenu.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
                        }
                        
                        this.setAttribute('aria-expanded', (!isOpen).toString());
                    });
                    
                    // Create dropdown menu
                    const dropdownMenu = document.createElement('div');
                    dropdownMenu.id = 'dropdown-menu';
                    dropdownMenu.className = 'dropdown-menu origin-top-right absolute right-0 mt-2 w-60 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none opacity-0 transform scale-95 pointer-events-none z-50 select-none';
                    dropdownMenu.setAttribute('role', 'menu');
                    dropdownMenu.setAttribute('aria-orientation', 'vertical');
                    dropdownMenu.setAttribute('aria-labelledby', 'profile-badge-button');
                    dropdownMenu.tabIndex = -1;
                    
                    // Get greeting based on time of day
                    const currentHour = new Date().getHours();
                    let greeting = "Hello";
                    let emoji = "👋";
                    if (currentHour < 12) {
                        greeting = "Good morning";
                        emoji = "☀️";
                    } else if (currentHour < 18) {
                        greeting = "Good afternoon";
                        emoji = "👋";
                    } else {
                        greeting = "Good evening";
                        emoji = "🌙";
                    }
                    
                    // Populate dropdown menu
                    dropdownMenu.innerHTML = `
                        <div class="dropdown-greeting-container" role="none">
                            <span id="greeting-part" class="greeting-text">${greeting}! ${emoji}</span>
                            <span id="user-name-part" class="greeting-name">${displayName}</span>
                        </div>
                        <div class="py-1" role="none">
                            <a href="#" class="group text-gray-700 flex items-center px-4 py-2 text-sm hover:bg-amber-100 hover:text-green-800 rounded-md mx-1" role="menuitem" tabindex="-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" class="w-5 h-5 mr-3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                                Profile
                            </a>
                            <a href="#" class="group text-gray-700 flex items-center px-4 py-2 text-sm hover:bg-amber-100 hover:text-green-800 rounded-md mx-1" role="menuitem" tabindex="-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" class="w-5 h-5 mr-3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                History
                            </a>
                            <a href="#" class="group text-gray-700 flex items-center px-4 py-2 text-sm hover:bg-amber-100 hover:text-green-800 rounded-md mx-1" role="menuitem" tabindex="-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" class="w-5 h-5 mr-3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                </svg>
                                Library 
                                ${user.libraryCount > 0 ? `<span class="count-badge">${user.libraryCount}</span>` : ''}
                            </a>
                            <div class="dropdown-divider mx-1" role="separator"></div>
                            <button type="button" id="logout-button-desktop" class="group text-red-600 flex items-center px-4 py-2 text-sm hover:bg-red-200 hover:text-red-800 rounded-md mx-1 w-full text-left" role="menuitem" tabindex="-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" class="w-5 h-5 mr-3">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                </svg>
                                Log Out
                            </button>
                        </div>`;
                    
                    // Add elements to container
                    profileBadgeContainer.appendChild(button);
                    profileBadgeContainer.appendChild(dropdownMenu);
                    
                    // Add document click listener to close dropdown when clicking outside
                    document.addEventListener('click', function(event) {
                        if (profileBadgeContainer && !profileBadgeContainer.contains(event.target)) {
                            if (dropdownMenu.classList.contains('opacity-100')) {
                                dropdownMenu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
                                dropdownMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                                button.setAttribute('aria-expanded', 'false');
                            }
                        }
                    });
                    
                    return profileBadgeContainer;
                };
            }
            
            if (typeof window.createMobileProfileSection !== 'function') {
                console.log('createMobileProfileSection function not found in navbar, using fallback implementation');
                
                window.createMobileProfileSection = function(user) {
                    // Generate initials
                    let initials = '';
                    if (user.first_name && user.last_name) {
                        initials = user.first_name.charAt(0) + user.last_name.charAt(0);
                    } else if (user.first_name) {
                        initials = user.first_name.charAt(0) + (user.middle_name ? user.middle_name.charAt(0) : '');
                    } else if (user.username) {
                        const parts = user.username.split(' ');
                        if (parts.length > 1) {
                            initials = parts[0].charAt(0) + parts[parts.length-1].charAt(0);
                        } else {
                            initials = user.username.substring(0, 2);
                        }
                    } else {
                        initials = 'U';
                    }
                    
                    // Full name for display
                    const displayName = user.display_name || user.first_name || user.name || user.username || 'User';
                    
                    // Create mobile profile section
                    const section = document.createElement('div');
                    section.innerHTML = `
                        <div class="flex items-center px-5">
                            <div class="flex-shrink-0">
                                <div class="flex items-center justify-center w-10 h-10 bg-green-600 rounded-full profile-initials text-lg select-none">
                                    <span class="text-white font-medium">${initials.toUpperCase()}</span>
                                </div>
                            </div>
                            <div class="ml-3">
                                <div class="text-base font-medium leading-none text-gray-800">${displayName}</div>
                                <div class="text-sm font-medium leading-none text-gray-500">${user.email || ''}</div>
                            </div>
                        </div>
                        <div class="mt-3 px-2 space-y-1">
                            <a href="#" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-amber-100 hover:text-green-800">Profile</a>
                            <a href="#" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-amber-100 hover:text-green-800">History</a>
                            <a href="#" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-amber-100 hover:text-green-800">
                                Library 
                                ${user.libraryCount > 0 ? `<span class="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-green-800">${user.libraryCount}</span>` : ''}
                            </a>
                            <button type="button" id="logout-button-mobile" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-200 hover:text-red-800">Log Out</button>
                        </div>`;
                    
                    return section;
                };
            }
            
            if (typeof window.handleUserNameClick !== 'function') {
                console.log('handleUserNameClick function not found in navbar, using fallback implementation');
                
                window.handleUserNameClick = function(event) {
                    const userNamePartElement = document.getElementById('user-name-part');
                    if (!userNamePartElement) return;
                    
                    // Rainbow effect
                    const rainbowGradient = 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #6366f1, #8b5cf6)';
                    userNamePartElement.style.backgroundImage = rainbowGradient;
                    userNamePartElement.style.webkitBackgroundClip = 'text';
                    userNamePartElement.style.backgroundClip = 'text';
                    userNamePartElement.style.color = 'transparent';
                    userNamePartElement.style.webkitTextFillColor = 'transparent';
                    
                    // Reset after animation
                    setTimeout(() => {
                        userNamePartElement.style.backgroundImage = '';
                        userNamePartElement.style.webkitBackgroundClip = '';
                        userNamePartElement.style.backgroundClip = '';
                        userNamePartElement.style.color = '';
                        userNamePartElement.style.webkitTextFillColor = '';
                    }, 1000);
                    
                    // Confetti effect if available
                    if (typeof confetti === 'function') {
                        const y = (event.clientY / window.innerHeight);
                        const baseConfettiOptions = {
                            particleCount: 60,
                            spread: 70,
                            origin: {y},
                            colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6']
                        };
                        
                        confetti({...baseConfettiOptions, angle: 60, origin: {...baseConfettiOptions.origin, x: 0}});
                        confetti({...baseConfettiOptions, angle: 120, origin: {...baseConfettiOptions.origin, x: 1}});
                    } else {
                        console.warn("Confetti library (confetti.js) not found or loaded.");
                    }
                };
            }
            
            // Check if createProfileBadge function exists in the loaded navbar
            if (typeof window.createProfileBadge === 'function') {
                // Use the createProfileBadge function from the navbar
                console.log('Using createProfileBadge function from navbar');
                const profileBadge = window.createProfileBadge(userInfo);
                userAuthContainer.innerHTML = '';
                userAuthContainer.appendChild(profileBadge);
                
                // Add event listener to logout button
                const logoutButtonDesktop = profileBadge.querySelector('#logout-button-desktop');
                if (logoutButtonDesktop) {
                    logoutButtonDesktop.addEventListener('click', logout);
                    console.log('Added event listener to desktop logout button');
                }
                
                // Fix navigation links to ensure they work across page navigations
                const navLinks = profileBadge.querySelectorAll('.dropdown-menu a[href]');
                navLinks.forEach(link => {
                    link.addEventListener('click', function(e) {
                        // Use normal navigation for links rather than direct manipulation
                        // This ensures proper page loading and event reattachment
                        const href = this.getAttribute('href');
                        
                        // Only prevent default for # links or javascript links
                        if (href === '#' || href.startsWith('javascript:')) {
                            e.preventDefault();
                        }
                        
                        // For library and history links, ensure they point to the right pages
                        if (this.textContent.trim() === 'Library') {
                            this.href = '/pages/savedDocument.html';
                        } else if (this.textContent.trim() === 'History') {
                            this.href = '/pages/userHistory.html';
                        }
                        
                        console.log(`Navbar navigation to: ${this.href}`);
                    });
                });
                
                // Add event listener to user name
                const userNamePart = profileBadge.querySelector('#user-name-part');
                if (userNamePart && typeof window.handleUserNameClick === 'function') {
                    userNamePart.addEventListener('click', window.handleUserNameClick);
                    console.log('Added event listener to user name element');
                }
                
                // Also update mobile view if available
                if (mobileUserAuthContainer && typeof window.createMobileProfileSection === 'function') {
                    const mobileProfileSection = window.createMobileProfileSection(userInfo);
                    mobileUserAuthContainer.innerHTML = '';
                    mobileUserAuthContainer.appendChild(mobileProfileSection);
                    
                    // Add event listener to mobile logout button
                    const logoutButtonMobile = mobileProfileSection.querySelector('#logout-button-mobile');
                    if (logoutButtonMobile) {
                        logoutButtonMobile.addEventListener('click', logout);
                        console.log('Added event listener to mobile logout button');
                    }
                    
                    // Fix navigation links in mobile menu
                    const mobileNavLinks = mobileProfileSection.querySelectorAll('a[href]');
                    mobileNavLinks.forEach(link => {
                        link.addEventListener('click', function(e) {
                            // Use normal navigation for links
                            const href = this.getAttribute('href');
                            
                            // Only prevent default for # links or javascript links
                            if (href === '#' || href.startsWith('javascript:')) {
                                e.preventDefault();
                            }
                            
                            // For library and history links, ensure they point to the right pages
                            if (this.textContent.trim().includes('Library')) {
                                this.href = '/pages/savedDocument.html';
                            } else if (this.textContent.trim().includes('History')) {
                                this.href = '/pages/userHistory.html';
                            }
                            
                            console.log(`Mobile navbar navigation to: ${this.href}`);
                        });
                    });
                }
            } else {
                console.error('createProfileBadge function not found in navbar');
            }
        } else {
            console.warn('user-auth-container not found in the navbar');
        }
    }

    // Update profile information in the navbar
    function updateProfileInfo(userInfo) {
        if (!userInfo) return;
        
        console.log('Updating profile info with user data:', userInfo);
        
        // Update profile initials
        const profileInitialsElements = document.querySelectorAll('.profile-initials-text');
        if (profileInitialsElements.length > 0) {
            let initials = '';
            
            // Try to generate initials from available name fields
            if (userInfo.first_name && userInfo.last_name) {
                initials = userInfo.first_name.charAt(0) + userInfo.last_name.charAt(0);
            } else if (userInfo.first_name) {
                initials = userInfo.first_name.charAt(0) + (userInfo.middle_name ? userInfo.middle_name.charAt(0) : '');
            } else if (userInfo.username) {
                const parts = userInfo.username.split(' ');
                if (parts.length > 1) {
                    initials = parts[0].charAt(0) + parts[parts.length-1].charAt(0);
                } else {
                    initials = userInfo.username.substring(0, 2);
                }
            } else {
                initials = 'U';
            }
            
            profileInitialsElements.forEach(element => {
                element.textContent = initials.toUpperCase();
            });
        }
        
        // Update user name
        const userNameElement = document.getElementById('user-name-part');
        const greetingElement = document.getElementById('greeting-part');
        
        if (userNameElement) {
            // Try different user info properties with clear priority order
            if (userInfo.display_name) {
                userNameElement.textContent = userInfo.display_name;
            } else if (userInfo.first_name) {
                userNameElement.textContent = userInfo.first_name;
            } else if (userInfo.username) {
                userNameElement.textContent = userInfo.username;
            } else if (userInfo.name) {
                userNameElement.textContent = userInfo.name;
            } else {
                userNameElement.textContent = 'User';
            }
            console.log('Updated user name element with:', userNameElement.textContent);
        }
        
        if (greetingElement) {
            // Set greeting based on time of day
            const currentHour = new Date().getHours();
            let greeting = "Hello";
            if (currentHour < 12) greeting = "Good morning";
            else if (currentHour < 18) greeting = "Good afternoon";
            else greeting = "Good evening";
            
            greetingElement.textContent = `${greeting}!`;
        }
        
        // Update user info in mobile menu
        const userFullNameElement = document.getElementById('user-full-name');
        const userEmailElement = document.getElementById('user-email');
        
        if (userFullNameElement) {
            if (userInfo.first_name || userInfo.middle_name || userInfo.last_name) {
                const fullName = [
                    userInfo.first_name,
                    userInfo.middle_name,
                    userInfo.last_name
                ].filter(Boolean).join(' ');
                
                userFullNameElement.textContent = fullName;
            } else if (userInfo.display_name) {
                userFullNameElement.textContent = userInfo.display_name;
            } else if (userInfo.username) {
                userFullNameElement.textContent = userInfo.username;
            } else if (userInfo.name) {
                userFullNameElement.textContent = userInfo.name;
            } else {
                userFullNameElement.textContent = 'User';
            }
        }
        
        if (userEmailElement && userInfo.email) {
            userEmailElement.textContent = userInfo.email;
        }
    }

    // Set up dropdown menu toggle
    function setupDropdown() {
        console.log('Setting up dropdown toggle functionality');
        const profileButton = document.getElementById('profile-badge-button');
        const dropdownMenu = document.getElementById('dropdown-menu');
        
        if (profileButton && dropdownMenu) {
            console.log('Found profile button and dropdown menu, adding event listeners');
            
            // Add click event to toggle dropdown visibility
            profileButton.addEventListener('click', (event) => {
                event.stopPropagation();
                console.log('Profile button clicked, toggling dropdown');
                
                const isOpen = dropdownMenu.classList.contains('opacity-100');
                
                if (isOpen) {
                    // Close dropdown
                    console.log('Closing dropdown');
                    dropdownMenu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
                    dropdownMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                } else {
                    // Open dropdown
                    console.log('Opening dropdown');
                    dropdownMenu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
                    dropdownMenu.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
                }
                
                profileButton.setAttribute('aria-expanded', (!isOpen).toString());
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (event) => {
                const profileBadgeContainer = document.getElementById('profile-badge-container-dynamic');
                if (dropdownMenu.classList.contains('opacity-100') && profileBadgeContainer && !profileBadgeContainer.contains(event.target)) {
                    console.log('Clicked outside dropdown, closing it');
                    dropdownMenu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
                    dropdownMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                    profileButton.setAttribute('aria-expanded', 'false');
                }
            });
        } else {
            console.warn('Profile button or dropdown menu not found in the DOM');
            console.log('profileButton:', profileButton ? 'Found' : 'Not found');
            console.log('dropdownMenu:', dropdownMenu ? 'Found' : 'Not found');
        }
    }

    // Set up mobile menu toggle
    function setupMobileMenu() {
        const mobileMenuButton = document.querySelector('.mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (mobileMenuButton && mobileMenu) {
            const mobileMenuOpenIcon = mobileMenuButton.querySelector('svg:not(.hidden)');
            const mobileMenuCloseIcon = mobileMenuButton.querySelector('svg.hidden');
            
            mobileMenuButton.addEventListener('click', () => {
                const isCurrentlyExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
                const openMenu = !isCurrentlyExpanded;
                
                mobileMenuButton.setAttribute('aria-expanded', openMenu.toString());
                mobileMenu.classList.toggle('hidden', !openMenu);
                if (mobileMenuOpenIcon && mobileMenuCloseIcon) {
                    mobileMenuOpenIcon.classList.toggle('hidden', openMenu);
                    mobileMenuCloseIcon.classList.toggle('hidden', !openMenu);
                }
            });
        }
    }

    // Function to load filters data when search is opened
    function setupSearch() {
        const searchOpenButton = document.getElementById('search-open-button');
        const searchOpenButtonMobile = document.getElementById('search-open-button-mobile');
        const searchCloseButton = document.getElementById('search-close-button');
        const searchOverlay = document.getElementById('search-overlay');
        
        if (searchOpenButton) {
            searchOpenButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openSearch();
            });
        }
        
        if (searchOpenButtonMobile) {
            searchOpenButtonMobile.addEventListener('click', (event) => {
                event.stopPropagation();
                openSearch();
            });
        }
        
        if (searchCloseButton && searchOverlay) {
            searchCloseButton.addEventListener('click', () => {
                closeSearch();
            });
            
            searchOverlay.addEventListener('click', (event) => {
                if (event.target === searchOverlay) {
                    closeSearch();
                }
            });
        }
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (!searchOverlay) return;
            
            // Close with Escape key
            if (event.key === 'Escape' && searchOverlay.classList.contains('visible')) {
                closeSearch();
                event.preventDefault();
                return;
            }
            
            // Open with / key when not in an input field
            const isInputFocused = document.activeElement?.tagName === 'INPUT' ||
                                 document.activeElement?.tagName === 'TEXTAREA' ||
                                 document.activeElement?.isContentEditable;
            
            if (event.key === '/' && !isInputFocused && !searchOverlay.classList.contains('visible')) {
                event.preventDefault();
                openSearch();
            }
            
            // Open with Ctrl+K or Cmd+K
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (searchOverlay.classList.contains('visible')) {
                    const searchInputOverlay = document.getElementById('searchInputOverlay');
                    if (document.activeElement !== searchInputOverlay && searchInputOverlay) {
                        searchInputOverlay.focus();
                    }
                } else {
                    openSearch();
                }
            }
        });
        
        // Set up window.openSearch and window.closeSearch functions if they don't exist
        // These are called by the navbar implementation
        if (typeof window.openSearch !== 'function') {
            window.openSearch = openSearch;
        }
        if (typeof window.closeSearch !== 'function') {
            window.closeSearch = closeSearch;
        }
        
        // Initialize search data for direct navbar access
        if (!window.NavbarModule) {
            window.NavbarModule = {};
        }
        
        // Initialize search filtering
        const searchInputOverlay = document.getElementById('searchInputOverlay');
        const clearSearchInputButton = document.getElementById('clearSearchInputButton');
        
        if (searchInputOverlay && typeof searchInputOverlay.addEventListener === 'function') {
            // Set up search input event listener if the navbar hasn't done so
            if (!searchInputOverlay._hasInputListener) {
                searchInputOverlay.addEventListener('input', () => {
                    if (typeof window.performSearchOverlay === 'function') {
                        window.performSearchOverlay();
                    }
                    if (clearSearchInputButton) {
                        clearSearchInputButton.classList.toggle('visible', searchInputOverlay.value.length > 0);
                    }
                });
                searchInputOverlay._hasInputListener = true;
            }
        }
    }

    // Open search overlay
    function openSearch() {
        const searchOverlay = document.getElementById('search-overlay');
        const searchInputOverlay = document.getElementById('searchInputOverlay');
        const clearSearchInputButton = document.getElementById('clearSearchInputButton');
        const bodyElement = document.body;
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (!searchOverlay || !searchInputOverlay || !bodyElement) return;
        
        const originalBodyOverflow = bodyElement.style.overflow;
        bodyElement.style.overflow = 'hidden';
        
        searchOverlay.classList.remove('hidden');
        searchOverlay.classList.add('visible');
        
        setTimeout(() => {
            searchInputOverlay.focus();
            if (clearSearchInputButton) {
                clearSearchInputButton.classList.toggle('visible', searchInputOverlay.value.length > 0);
            }
        }, 50);
        
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            const mobileMenuButton = document.querySelector('.mobile-menu-button');
            if (mobileMenuButton) {
                mobileMenuButton.setAttribute('aria-expanded', 'false');
                mobileMenu.classList.add('hidden');
                const mobileMenuOpenIcon = mobileMenuButton.querySelector('svg:not(.hidden)');
                const mobileMenuCloseIcon = mobileMenuButton.querySelector('svg.hidden');
                if (mobileMenuOpenIcon) mobileMenuOpenIcon.classList.remove('hidden');
                if (mobileMenuCloseIcon) mobileMenuCloseIcon.classList.add('hidden');
            }
        }
        
        // If the navbar has defined loadFiltersData function, call it
        if (typeof window.loadFiltersData === 'function' && !openSearch.filtersLoaded) {
            window.loadFiltersData();
            openSearch.filtersLoaded = true;
        }
    }

    // Close search overlay
    function closeSearch() {
        const searchOverlay = document.getElementById('search-overlay');
        const bodyElement = document.body;
        
        if (!searchOverlay || !bodyElement) return;
        
        bodyElement.style.overflow = '';
        searchOverlay.classList.remove('visible');
        
        setTimeout(() => {
            searchOverlay.classList.add('hidden');
        }, 300); // Match transition duration
    }

    // Create a simple fallback navbar if everything else fails
    function createFallbackNavbar(container) {
        console.log('Creating emergency fallback navbar');
        console.log('DEBUG: Fallback navbar creation triggered. This means neither primary nor alternative navbar loading succeeded.');
        
        if (!container) {
            console.error('DEBUG: Container is null or undefined in createFallbackNavbar!');
            return;
        }
        
        try {
            // Simple HTML fallback with minimal styling that works everywhere
            container.innerHTML = `
                <nav class="emergency-navbar" style="background-color: #f8f9fa; padding: 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center;">
                        <a href="/" style="text-decoration: none; color: #006A4E; font-weight: bold; font-size: 1.25rem; display: flex; align-items: center;">
                            <img src="/components/img/logo1.png" alt="Logo" style="height: 2.5rem; margin-right: 0.5rem;" onerror="this.onerror=null; this.src='https://placehold.co/80x40/f8f9fa/006A4E?text=LOGO';">
                            <span>Paulinian Electronic Archiving System</span>
                            </a>
                        </div>
                    <div>
                        <a href="/" style="margin-right: 1rem; text-decoration: none; color: #006A4E;">Home</a>
                        <a href="/pages/doc-search.html" style="margin-right: 1rem; text-decoration: none; color: #006A4E;">Search</a>
                        <a href="/log-in.html" style="padding: 0.5rem 1rem; background-color: #FDB813; color: white; text-decoration: none; border-radius: 0.25rem; font-weight: 500;">Log In</a>
                    </div>
                </nav>
            `;
            
            // Add event listener to the login button
            const loginButton = container.querySelector('a[href="/log-in.html"]');
            if (loginButton) {
                loginButton.addEventListener('click', function(event) {
                    console.log('Emergency navbar login button clicked');
                    window.location.href = '/log-in.html';
                });
            }
            
            console.log('Emergency fallback navbar successfully created');
        } catch (error) {
            console.error('Error creating fallback navbar:', error);
            // Ultimate fallback - just a simple login link
            container.innerHTML = '<div style="text-align: center; padding: 1rem;"><a href="/log-in.html" style="color: #006A4E;">Log In</a></div>';
        }
    }

    // Function to handle user logout
    function logout() {
        console.log('Logging out user...');
        console.log('NavbarModule.logout called');
        
        // Create visible log message
        console.log('%c NavbarModule.logout - Active logout process initiated! ', 'background: #f44336; color: white; font-size: 14px; padding: 5px;');
        
        // 1. Clear all user data from client storage
        try {
            sessionStorage.removeItem('userInfo');
            sessionStorage.removeItem('session_token');
            // Clear localStorage for backward compatibility
            localStorage.removeItem('userInfo');
            localStorage.removeItem('session_token');
            console.log('Cleared user data from client storage');
        } catch (e) {
            console.error('Error clearing client storage:', e);
        }
        
        // 2. Clear cookies
        document.cookie = 'session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // 3. Call multiple server logout endpoints for maximum compatibility
        Promise.all([
            // Try direct POST to /logout endpoint
            fetch('/logout', {
                method: 'POST',
                credentials: 'include'
            }).catch(e => console.warn('POST to /logout failed:', e)),
            
            // Try direct GET to /logout endpoint
            fetch('/logout', {
                method: 'GET',
                credentials: 'include'
            }).catch(e => console.warn('GET to /logout failed:', e)),
            
            // Try auth endpoints
            fetch('/auth/logout', {
                method: 'POST',
                credentials: 'include'
            }).catch(e => console.warn('POST to /auth/logout failed:', e))
        ]).finally(() => {
            console.log('All logout attempts completed, redirecting to home page');
            
            // 4. Redirect to home page - use timeout to ensure other operations complete
            setTimeout(() => {
                // Add timestamp for cache busting
                window.location.href = `/index.html?logout=true&t=${Date.now()}`;
            }, 200);
        });
    }

    // Setup login buttons functionality
    function setupLoginButtons() {
        const loginButtonDesktop = document.getElementById('login-button');
        const loginButtonMobile = document.getElementById('mobile-login-button');
        
        if (loginButtonDesktop) {
            loginButtonDesktop.addEventListener('click', window.handleLogin);
        }
        
        if (loginButtonMobile) {
            loginButtonMobile.addEventListener('click', window.handleLogin);
        }
    }

    // Public API
    return {
        init: initNavbar,
        updateProfileInfo: updateProfileInfo,
        logout: logout
    };
})();

// The function initNavbar is defined inside the module closure above,
// so we need to use the version returned by the module
document.addEventListener('DOMContentLoaded', function() {
    if (window.NavbarModule && typeof window.NavbarModule.init === 'function') {
        window.NavbarModule.init();
    } else {
        console.error('NavbarModule or init function not available');
    }
}); 