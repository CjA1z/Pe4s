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
    const USER_NAVBAR_URL = '/Components/user-navBar.html';
    const GUEST_NAVBAR_URL = '/Components/public-navBar.html'; // Use public navbar for guests
    const USER_PROFILE_URL = '/api/user/profile';
    const LIBRARY_COUNT_URL = '/api/user/library/count';

    // Main initialization function - call this from each page
    function initNavbar() {
        console.log('Navbar module initializing...');
        
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
        
        // Make sure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupNavbar);
        } else {
            setupNavbar();
        }
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
            
            // Check localStorage
            const localUserInfo = localStorage.getItem('userInfo');
            if (localUserInfo) {
                try {
                    const userInfo = JSON.parse(localUserInfo);
                    
                    // If login time is more than 24 hours ago, clear it
                    if (userInfo.loginTime) {
                        const loginTime = new Date(userInfo.loginTime);
                        const currentTime = new Date();
                        const hoursSinceLogin = (currentTime - loginTime) / (1000 * 60 * 60);
                        
                        if (hoursSinceLogin > 24) {
                            console.log('Clearing stale local user data (older than 24 hours)');
                            localStorage.removeItem('userInfo');
                        }
                    }
                    
                    // If no token or login status is false, clear it
                    if (!userInfo.token || userInfo.isLoggedIn !== true) {
                        console.log('Clearing invalid local user data');
                        localStorage.removeItem('userInfo');
                    }
                } catch (e) {
                    console.error('Error parsing local user data, clearing it:', e);
                    localStorage.removeItem('userInfo');
                }
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

        // Check user authentication and load appropriate navbar
        const userInfo = getUserInfo();
        console.log('DEBUG: Retrieved user info:', userInfo ? JSON.stringify(userInfo, null, 2) : 'null');
        
        const isLoggedIn = isUserLoggedIn(userInfo);
        
        console.log(`User login status summary: ${isLoggedIn ? 'Logged in' : 'Not logged in'}`);
        console.log('DEBUG: UserInfo object present:', !!userInfo);
        console.log('DEBUG: isLoggedIn value:', isLoggedIn);
        
        // Force a clear URL path to prevent any path resolution issues
        const userNavbarFullPath = new URL(USER_NAVBAR_URL, window.location.origin).href;
        const guestNavbarFullPath = new URL(GUEST_NAVBAR_URL, window.location.origin).href;
        
        console.log('DEBUG: Will use navbar URL:', isLoggedIn ? userNavbarFullPath : guestNavbarFullPath);
        
        loadNavbar(navbarContainer, isLoggedIn, userInfo);
    }

    // Get user information from storage
    function getUserInfo() {
        try {
            // Check sessionStorage first, then localStorage
            const sessionUserInfo = sessionStorage.getItem('userInfo');
            const localUserInfo = localStorage.getItem('userInfo');
            
            console.log('DEBUG: Raw user info found in storage:');
            console.log('- sessionStorage:', sessionUserInfo ? 'present' : 'not found');
            console.log('- localStorage:', localUserInfo ? 'present' : 'not found');
            
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
                    
                    return userInfo;
                } catch (parseError) {
                    console.error('Error parsing sessionStorage user info:', parseError);
                    // Clear invalid data
                    sessionStorage.removeItem('userInfo');
                    return null;
                }
            } else if (localUserInfo) {
                try {
                    const userInfo = JSON.parse(localUserInfo);
                    console.log('Found user info in localStorage');
                    
                    // Validate essential properties
                    if (!userInfo.token) {
                        console.warn('Token missing in localStorage user info');
                    }
                    
                    if (userInfo.isLoggedIn !== true) {
                        console.warn('isLoggedIn flag not true in localStorage user info');
                    }
                    
                    // Synchronize sessionStorage with localStorage to ensure consistency
                    sessionStorage.setItem('userInfo', localUserInfo);
                    
                    return userInfo;
                } catch (parseError) {
                    console.error('Error parsing localStorage user info:', parseError);
                    // Clear invalid data
                    localStorage.removeItem('userInfo');
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
                localStorage.removeItem('userInfo');
                return false;
            }
        }
        
        // Final check for essential properties - ensuring isLoggedIn is explicitly true
        const isLoggedIn = userInfo.isLoggedIn === true && userInfo.token && userInfo.token.length > 0;
        console.log(`User login status: ${isLoggedIn ? 'Valid session' : 'Invalid session'} - Token present: ${!!userInfo.token}, isLoggedIn flag: ${userInfo.isLoggedIn}`);
        return isLoggedIn;
    }

    // Fetch and load the navbar HTML
    async function loadNavbar(container, isLoggedIn, userInfo) {
        // Create absolute URLs
        const userNavbarFullPath = new URL(USER_NAVBAR_URL, window.location.origin).href;
        const guestNavbarFullPath = new URL(GUEST_NAVBAR_URL, window.location.origin).href;
        
        // Choose which navbar to load
        const navbarUrl = isLoggedIn ? userNavbarFullPath : guestNavbarFullPath;
        
        console.log(`Loading navbar from: ${navbarUrl}`);
        console.log(`DEBUG: Full path to navbar: ${navbarUrl}`);
        console.log(`DEBUG: User logged in status (double-check): ${isLoggedIn}`);
        
        try {
            const response = await fetch(navbarUrl);
            console.log(`DEBUG: Fetch response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load navbar: ${response.status} ${response.statusText}`);
            }
            
            const html = await response.text();
            console.log(`DEBUG: Successfully fetched navbar HTML, length: ${html.length}`);
            
            // Find the container where the navbar should be inserted
            const navbarContainer = document.getElementById('navbarContainer');
            if (!navbarContainer) {
                throw new Error('Navbar container not found! Add a div with id="navbarContainer" to your page.');
            }
            
            // First, extract all script content from the HTML
            const scriptContents = [];
            let scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
            let scriptMatch;
            
            while ((scriptMatch = scriptRegex.exec(html)) !== null) {
                // Extract just the content between script tags
                scriptContents.push(scriptMatch[1]);
            }
            
            // Now add the HTML to the container (without running scripts yet)
            navbarContainer.innerHTML = html;
            
            console.log(`DEBUG: Extracted ${scriptContents.length} scripts from navbar HTML`);
            console.log(`DEBUG: Navbar type loaded: ${isLoggedIn ? 'USER NAVBAR' : 'PUBLIC NAVBAR'}`);
            
            // Execute all script content after the HTML is in the DOM
            scriptContents.forEach((content, index) => {
                if (content.trim()) {
                    console.log(`DEBUG: Executing script ${index + 1}`);
                    try {
                        // Create a new function from the script content and execute it
                        // This ensures the script runs in the global scope with access to all variables
                        const scriptFunction = new Function(content);
                        scriptFunction();
                    } catch (error) {
                        console.error(`Error executing script ${index + 1}:`, error);
                    }
                }
            });
            
            console.log('Navbar loaded successfully');
            
            // Initialize navbar functionality
            initializeNavbarFunctionality(userInfo);
            
            return true;
        } catch (error) {
            console.error('Error loading navbar:', error);
            console.error('DEBUG: Falling back to emergency navbar');
            createFallbackNavbar(container);
            return false;
        }
    }

    // Import scripts and styles from the navbar HTML
    function importScriptsAndStyles(tempDiv) {
        // Import scripts
        const scripts = tempDiv.querySelectorAll('script');
        scripts.forEach(script => {
            const newScript = document.createElement('script');
            if (script.src) {
                newScript.src = script.src;
            } else {
                newScript.textContent = script.textContent;
            }
            document.body.appendChild(newScript);
        });
        
        // Import styles
        const styles = tempDiv.querySelectorAll('style');
        styles.forEach(style => {
            document.head.appendChild(style.cloneNode(true));
        });
    }

    // Initialize navbar functionality after loading
    function initializeNavbarFunctionality(userInfo) {
        // Set up user profile button
        updateProfileInfo(userInfo);
        
        // Set up dropdown toggle
        setupDropdown();
        
        // Set up mobile menu toggle
        setupMobileMenu();
        
        // Set up search button
        setupSearch();
        
        // Setup login buttons (for public navbar)
        setupLoginButtons();
    }

    // Update profile information in the navbar
    function updateProfileInfo(userInfo) {
        if (!userInfo) return;
        
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
            // Try different user info properties
            if (userInfo.first_name) {
                userNameElement.textContent = userInfo.first_name;
            } else if (userInfo.username) {
                userNameElement.textContent = userInfo.username;
            } else if (userInfo.name) {
                userNameElement.textContent = userInfo.name;
            } else {
                userNameElement.textContent = userInfo.role === 'user' ? `User ${userInfo.id || ''}` : 'User';
            }
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
        const profileButton = document.getElementById('profile-badge-button');
        const dropdownMenu = document.getElementById('dropdown-menu');
        
        if (profileButton && dropdownMenu) {
            profileButton.addEventListener('click', (event) => {
                event.stopPropagation();
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
                
                profileButton.setAttribute('aria-expanded', (!isOpen).toString());
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (event) => {
                const profileBadgeContainer = document.getElementById('profile-badge-container');
                if (profileBadgeContainer && !profileBadgeContainer.contains(event.target)) {
                    dropdownMenu.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
                    dropdownMenu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                    profileButton.setAttribute('aria-expanded', 'false');
                }
            });
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

    // Set up search functionality
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

    // Create a simple fallback navbar if loading fails
    function createFallbackNavbar(container) {
        const fallbackNavbar = document.createElement('nav');
        fallbackNavbar.className = 'shadow-md sticky top-0 z-30';
        fallbackNavbar.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between h-16">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <a href="/index.html">
                                <img class="h-20 w-auto" src="/components/images/spud-logo.png" alt="SPUD Logo" 
                                     onerror="this.onerror=null; this.src='https://placehold.co/100x80/F9F6EE/006A4E?text=Logo';">
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = '';
        container.appendChild(fallbackNavbar);
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
            localStorage.removeItem('userInfo');
            sessionStorage.removeItem('session_token');
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
        refresh: function() {
            console.log('Manually refreshing navbar...');
            setupNavbar();
        },
        logout: logout
    };
})(); 