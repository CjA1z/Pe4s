// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Sidebar script loaded');
    
    // Get the sidebar container
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) {
        console.error('Sidebar container not found. Make sure an element with id="sidebar-container" exists.');
        return;
    }
    
    // Use absolute path to fetch sidebar HTML
    fetch('/admin/Components/side_bar.html')
    .then(response => response.text())
    .then(data => {
        sidebarContainer.innerHTML = data;
        
        // Find the sidebar element inside the container
        const sideBar = sidebarContainer.querySelector('#side-bar') || sidebarContainer;
        
        // If the sidebar exists, highlight the active link
        if (sideBar) {
            highlightActiveSidebarLink(sideBar);
        }
        
        // Setup logout functionality AFTER sidebar is loaded
        setupLogout();
    })
    .catch(error => console.error('Error loading sidebar:', error));
});

// Highlight active sidebar link
function highlightActiveSidebarLink(sideBar) {
    const currentPage = globalThis.location.pathname;
    // Find links either in the sidebar element or in the document if sidebar not provided
    const navLinks = sideBar ? 
        sideBar.querySelectorAll('a.icon-wrapper') : 
        document.querySelectorAll('#side-bar a.icon-wrapper');
    
    console.log("Current page:", currentPage); // Check the current page URL
    console.log("Sidebar links:", navLinks); // Check the selected links

    navLinks.forEach(link => {
        // Get the pathname from the link's href
        const href = new URL(link.href, globalThis.location.origin).pathname;
        console.log("Link href:", href); // Check the href attribute of each link

        // Skip highlighting for logout link
        if (href === '/logout') {
            link.classList.remove('active');
            return;
        }

        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Side bar functionality
 */

// Remove duplicate DOMContentLoaded listener to avoid conflicts
// document.addEventListener('DOMContentLoaded', () => {
//   console.log('Side bar script loaded');
//   
//   // Setup logout functionality
//   setupLogout();
//   
//   // Initialize prevention on page load
//   preventBackNavigation();
// });

// Initialize prevention on page load - moved outside of duplicate event listener
document.addEventListener('DOMContentLoaded', () => {
    preventBackNavigation();
});

// Function to prevent back navigation
function preventBackNavigation() {
    // Clear all history entries
    globalThis.history.pushState(null, '', globalThis.location.href);
    
    // Prevent back navigation
    globalThis.addEventListener('popstate', function() {
        globalThis.history.pushState(null, '', globalThis.location.href);
    });
    
    // Disable back button
    globalThis.history.pushState(null, '', globalThis.location.href);
    globalThis.onpopstate = function() {
        globalThis.history.pushState(null, '', globalThis.location.href);
    };
}

// Additional prevention for browser back button
globalThis.addEventListener('beforeunload', function() {
    preventBackNavigation();
});

/**
 * Setup logout functionality
 */
function setupLogout() {
  console.log('Setting up logout functionality');
  
  // Try multiple selectors to find the logout button - improved selector specificity
  const logoutButton = document.querySelector('.icon-wrapper.logout-btn') || 
                       document.querySelector('a.logout-btn') ||
                       document.querySelector('a[href="/logout"].icon-wrapper.logout-btn') ||
                       document.querySelector('a[onclick*="handleLogout"]');
  
  if (logoutButton) {
    // Check if the button already has an event handler
    if (logoutButton.getAttribute('data-has-logout-handler') !== 'true') {
      // Remove any existing event listeners to prevent duplicates
      logoutButton.removeEventListener('click', handleLogout);
      
      // Add fresh event listener
      logoutButton.addEventListener('click', handleLogout);
      
      // Mark this button as having a handler to prevent duplicates
      logoutButton.setAttribute('data-has-logout-handler', 'true');
      
      // Also ensure the onclick attribute is set correctly
      logoutButton.setAttribute('onclick', 'handleLogout(event); return false;');
      
      console.log('Logout button found and listener attached');
    } else {
      console.log('Logout button already has an event handler');
    }
  } else {
    console.warn('Logout button not found');
    // Add a fallback timeout to try again after sidebar is fully loaded
    setTimeout(() => {
      // Try a more comprehensive set of selectors
      const retryLogoutButton = document.querySelector('.icon-wrapper.logout-btn') || 
                                document.querySelector('a.logout-btn') ||
                                document.querySelector('a[href="/logout"].icon-wrapper.logout-btn') ||
                                document.querySelector('a[onclick*="handleLogout"]');
                                
      if (retryLogoutButton && retryLogoutButton.getAttribute('data-has-logout-handler') !== 'true') {
        retryLogoutButton.removeEventListener('click', handleLogout);
        retryLogoutButton.addEventListener('click', handleLogout);
        retryLogoutButton.setAttribute('data-has-logout-handler', 'true');
        retryLogoutButton.setAttribute('onclick', 'handleLogout(event); return false;');
        console.log('Logout button found on retry and listener attached');
      } else if (retryLogoutButton) {
        console.log('Logout button already has an event handler (on retry)');
      } else {
        console.error('Logout button still not found after retry');
      }
    }, 1000);
  }
}

function handleLogout(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation(); // Stop event propagation to prevent multiple handlers
  }
  console.log("Sidebar logout function called");
  
  // Prevent multiple logout attempts
  if (window.logoutInProgress) {
    console.log("Logout already in progress");
    return;
  }
  
  window.logoutInProgress = true;
  
  // Add visual indicator that logout is happening
  const loadingPopup = document.createElement('div');
  loadingPopup.style.position = 'fixed';
  loadingPopup.style.top = '0';
  loadingPopup.style.left = '0';
  loadingPopup.style.width = '100%';
  loadingPopup.style.height = '100%';
  loadingPopup.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  loadingPopup.style.display = 'flex';
  loadingPopup.style.justifyContent = 'center';
  loadingPopup.style.alignItems = 'center';
  loadingPopup.style.zIndex = '9999';
  
  const loadingContent = document.createElement('div');
  loadingContent.style.backgroundColor = 'white';
  loadingContent.style.padding = '20px';
  loadingContent.style.borderRadius = '10px';
  loadingContent.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  loadingContent.style.display = 'flex';
  loadingContent.style.flexDirection = 'column';
  loadingContent.style.alignItems = 'center';
  loadingContent.style.gap = '15px';
  
  const spinner = document.createElement('div');
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.border = '4px solid #f3f3f3';
  spinner.style.borderTop = '4px solid #10B981'; // Use primary green color
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'spin 1s linear infinite';
  
  // Add the animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  const loadingText = document.createElement('p');
  loadingText.textContent = 'Logging out...';
  loadingText.style.margin = '0';
  loadingText.style.fontFamily = 'Inter, sans-serif';
  loadingText.style.color = '#4b5563';
  
  loadingContent.appendChild(spinner);
  loadingContent.appendChild(loadingText);
  loadingPopup.appendChild(loadingContent);
  document.body.appendChild(loadingPopup);
  
  // More thorough client-side storage clearing
  try {
    // Clear localStorage - first specific keys then everything
    const localStorageKeys = ['userInfo', 'session_token', 'accessToken', 'user', 'userData', 'auth', 'role'];
    localStorageKeys.forEach(key => localStorage.removeItem(key));
    localStorage.clear(); // Clear all localStorage items
    
    // Clear sessionStorage - first specific keys then everything
    const sessionStorageKeys = ['userInfo', 'session_token', 'accessToken', 'user', 'userData', 'auth', 'role'];
    sessionStorageKeys.forEach(key => sessionStorage.removeItem(key));
    sessionStorage.clear(); // Clear all sessionStorage items
    
    // Clear specific cookies
    const cookiesToClear = ['session_token', 'accessToken', 'user', 'auth', 'role'];
    cookiesToClear.forEach(cookieName => {
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      // Also try to clear cookies with different paths
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/admin/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/api/;`;
    });
    
    // Clear all cookies (more aggressive approach)
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/admin/");
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/api/");
    });
    
    console.log("Cleared all client-side storage");

    // Check if we're still on admin dashboard after storage clearing
    if (window.location.pathname.includes('/admin/')) {
      console.log("Still on admin page after storage clearing; will redirect directly");
    }
  } catch (e) {
    console.error("Error clearing client storage:", e);
  }
  
  // Try multiple logout endpoints to ensure we hit the right one
  Promise.any([
    fetch('/logout', {
      method: 'POST',
      credentials: 'include',
      redirect: 'follow' // Allow the server's redirect to be followed
    }),
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      redirect: 'follow' // Allow the server's redirect to be followed
    }),
    fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      redirect: 'follow' // Allow the server's redirect to be followed
    })
  ])
  .then(response => {
    console.log("Logout response status:", response.status);
    
    // Check if redirect location contains the string 'dashboard'
    const hasRedirectHeader = response.headers && response.headers.get('Location');
    if (hasRedirectHeader) {
      const location = response.headers.get('Location');
      console.log("Redirect location from server:", location);
      
      if (location && location.includes('dashboard')) {
        console.log("WARNING: Server tried to redirect to dashboard after logout; overriding");
        window.location.href = '/index.html?nocache=' + Date.now();
        return;
      }
    }
    
    console.log("Logout successful, following server redirect");
    
    if (response.redirected) {
      window.location.href = response.url;
    } else {
      // Fallback if the server didn't redirect
      window.location.href = '/index.html?nocache=' + Date.now();
    }
  })
  .catch(error => {
    console.error("Error during logout:", error);
    // Fallback on error
    window.location.href = '/index.html?nocache=' + Date.now();
  })
  .finally(() => {
    // Small delay to show the loading animation
    setTimeout(() => {
      // Clean up loading popup
      if (document.body.contains(loadingPopup)) {
        document.body.removeChild(loadingPopup);
      }
      
      // Final safety check - if we're still on admin page after 2 seconds, force redirect
      if (window.location.pathname.includes('/admin/')) {
        console.log("FINAL SAFETY: Still on admin page after logout; forcing redirect");
        window.location.href = '/index.html?forcedRedirect=true&t=' + Date.now();
      }
    }, 1000);
  });
}

// Export the function for use in other files and make it globally available
window.handleLogout = handleLogout;
window.sidebarHandleLogout = handleLogout; // Add this for dashboard.html to use
globalThis.handleLogout = handleLogout;
globalThis.sidebarHandleLogout = handleLogout;

// Make sure the function is available after the page loads too
document.addEventListener('DOMContentLoaded', () => {
  window.handleLogout = handleLogout;
  window.sidebarHandleLogout = handleLogout; // Add this for dashboard.html to use
  globalThis.handleLogout = handleLogout;
  globalThis.sidebarHandleLogout = handleLogout;
  console.log("Sidebar logout handler registered globally");
});