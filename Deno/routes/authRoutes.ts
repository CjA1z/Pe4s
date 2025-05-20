import { Route } from "./index.ts";
import { RouterContext } from "../deps.ts";
import * as sessionService from "../services/sessionService.ts";
import { SystemLogsModel } from "../models/systemLogsModel.ts";

// Create a function to get server start time without creating circular imports
let cachedServerStartTime: number | null = null;
const getServerStartTime = (): number => {
  if (cachedServerStartTime === null) {
    // If not cached yet, use current time as fallback
    cachedServerStartTime = Date.now();
  }
  return cachedServerStartTime;
};

// Add function to set server start time from server.ts
export function setServerStartTime(time: number): void {
  cachedServerStartTime = time;
  console.log(`Auth routes: Server start time set to ${new Date(time).toISOString()}`);
}

// Auth route handlers
const login = async (ctx: RouterContext<any, any, any>) => {
  try {
    // Check if login.js exists
    try {
      const loginJsPath = `${Deno.cwd()}/public/Components/js/login.js`;
      await Deno.stat(loginJsPath);
    } catch (fileError) {
      console.error("login.js not found:", fileError);
      ctx.response.status = 500;
      ctx.response.body = { 
        message: "Authentication system unavailable", 
        error: "Required authentication files are missing"
      };
      return;
    }
    
    // Get and log request body for debugging
    let body: Record<string, any> = {};
    try {
      // Oak v12 body parsing
      const bodyParser = await ctx.request.body({type: "json"});
      body = await bodyParser.value;
      console.log("Successfully parsed JSON body");
    } catch (bodyError) {
      console.error("Error parsing request body:", bodyError);
      // Fallback to a simple object if JSON parsing fails
      body = {};
      
      // Try to get form data from URL parameters if JSON fails
      const params = new URL(ctx.request.url).searchParams;
      for (const [key, value] of params.entries()) {
        body[key] = value;
      }
      
      // If we still have no data, create dummy data for testing
      if (Object.keys(body).length === 0) {
        body = { ID: "test_user", Password: "password" };
        console.log("Using fallback test credentials");
      }
    }
    
    console.log("Login request body:", body);
    
    // Get user info from request
    const userId = body.ID || body.id;
    const password = body.Password || body.password;
    
    if (!userId || !password) {
      throw new Error("User ID and password are required");
    }
    
    // Query the database to validate credentials
    let userRole = 'User'; // Default role
    let userExists = false;
    
    try {
      // Import the client here to avoid issues
      const { client } = await import("../db/denopost_conn.ts");
      
      // First check if the user exists in the users table (required for sessions foreign key)
      const userCheckResult = await client.queryObject(
        `SELECT id, role_id FROM users WHERE id = $1`,
        [userId]
      );
      
      if (userCheckResult.rows && userCheckResult.rows.length > 0) {
        // User exists in the users table, now check credentials
        const credResult = await client.queryObject(
          `SELECT user_id FROM credentials 
           WHERE user_id = $1 AND password = $2`,
          [userId, password]
        );
        
        if (credResult.rows && credResult.rows.length > 0) {
          userExists = true;
          
          // Now get the user's role from the users and roles tables with proper join
          const roleResult = await client.queryObject(
            `SELECT r.role_name 
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [userId]
          );
          
          if (roleResult.rows && roleResult.rows.length > 0) {
            const row = roleResult.rows[0] as { role_name: string };
            userRole = String(row.role_name || 'User');
          } else {
            // No role found, assign default based on role_id from users table
            const row = userCheckResult.rows[0] as { role_id: number };
            userRole = row.role_id === 1 ? 'Admin' : 'User';
          }
        } else {
          // Credentials don't match
          console.log("Invalid credentials. Login rejected.");
          userExists = false;
        }
      } else {
        // User doesn't exist in users table
        console.log(`User ${userId} not found in users table. Login rejected.`);
        userExists = false;
      }
    } catch (dbError) {
      console.error("Database error during credential validation:", dbError);
      userExists = false; // Don't allow login on database errors
    }
    
    if (!userExists) {
      ctx.response.status = 401;
      ctx.response.body = { 
        message: "Invalid credentials or user does not exist", 
        error: "Authentication failed" 
      };
      
      // Log the failed login attempt to system logs
      try {
        await SystemLogsModel.createLog({
          log_type: 'login',
          username: userId,
          action: 'Failed login attempt',
          details: {
            reason: 'Invalid credentials or user not found',
            timestamp: new Date().toISOString(),
            browser: ctx.request.headers.get('user-agent') || 'Unknown',
            ip: ctx.request.ip || 'Unknown'
          },
          ip_address: ctx.request.ip || 'Unknown',
          status: 'failed'
        });
      } catch (logError) {
        console.error("Failed to log failed login attempt:", logError);
      }
      
      return;
    }
    
    console.log(`Processing login for user ID: ${userId}, assigned role: ${userRole}`);
    
    // Update last_login timestamp in the users table
    try {
      const { client } = await import("../db/denopost_conn.ts");
      
      // Use different timestamp formats to ensure compatibility
      const currentDate = new Date();
      const isoTimestamp = currentDate.toISOString();
      const sqlTimestamp = currentDate.toISOString().replace('T', ' ').replace('Z', '');
      
      // First try standard ISO format
      try {
        const updateResult = await client.queryObject(
          `UPDATE users SET last_login = $1 WHERE id = $2`,
          [isoTimestamp, userId]
        );
        
        console.log(`Updated last_login timestamp for user ${userId} to ${isoTimestamp}`);
      } catch (isoError) {
        console.warn("ISO timestamp format failed, trying SQL format:", isoError);
        
        // If ISO format fails, try SQL timestamp format
        try {
          const updateSqlResult = await client.queryObject(
            `UPDATE users SET last_login = $1 WHERE id = $2`,
            [sqlTimestamp, userId]
          );
          
          console.log(`Updated last_login timestamp for user ${userId} to ${sqlTimestamp} (SQL format)`);
        } catch (sqlError) {
          // Last resort: use a simple TIMESTAMP literal
          try {
            const updateLiteralResult = await client.queryObject(
              `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
              [userId]
            );
            
            console.log(`Updated last_login timestamp for user ${userId} using CURRENT_TIMESTAMP`);
          } catch (literalError) {
            console.error("All timestamp update methods failed:", literalError);
          }
        }
      }
    } catch (updateError) {
      console.error("Error updating last_login timestamp:", updateError);
      // Continue with login process even if timestamp update fails
    }
    
    // Generate a token
    let token = crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`; // Default fallback with type assertion
    try {
      const result = await sessionService.createSessionToken(String(userId), String(userRole));
      if (result) {
        token = result as `${string}-${string}-${string}-${string}-${string}`;
      }
    } catch (tokenError) {
      console.error("Token generation error:", tokenError);
    }
    
    // Log the user login with role information
    console.log(`User login: ${userId} (${userRole}) logged in at ${new Date().toISOString()}`);
    
    // Log the successful login to the system logs
    try {
      await SystemLogsModel.createLog({
        log_type: 'login',
        user_id: String(userId),
        username: String(userId),
        action: 'User login',
        details: {
          role: userRole,
          timestamp: new Date().toISOString(),
          browser: ctx.request.headers.get('user-agent') || 'Unknown',
          ip: ctx.request.ip || 'Unknown'
        },
        ip_address: ctx.request.ip || 'Unknown',
        status: 'success'
      });
    } catch (logError) {
      console.error("Failed to log successful login:", logError);
    }
    
    // Additional logging based on user role
    const lowerRole = String(userRole).toLowerCase();
    switch(lowerRole) {
      case "admin":
        console.log(`ADMIN LOGIN: Administrator ${userId} accessed the system`);
        break;
      case "user":
        console.log(`USER LOGIN: Regular user ${userId} accessed the system`);
        break;
      default:
        console.log(`GUEST LOGIN: Guest user ${userId} accessed the system`);
    }
    
    // Determine redirect URL based on user role
    let redirectUrl = "/public/index.html"; // Default redirect
    
    // Role-based redirects
    if (lowerRole === "admin") {
      redirectUrl = "/admin/dashboard.html"; // Admin dashboard
    } else {
      redirectUrl = "/index.html"; // Regular user home
    }
    
    // Return successful response
    ctx.response.status = 200;
    ctx.response.body = { 
      message: "Login successful", 
      token: token,
      userId: userId,
      username: userId,
      role: userRole,
      redirect: redirectUrl,
      serverTime: getServerStartTime() // Use the function instead of direct reference
    };
  } catch (error) {
    console.error("Login error:", error);
    ctx.response.status = 400;
    ctx.response.body = { 
      message: "Login failed", 
      error: error instanceof Error ? error.message : String(error),
      details: "See server logs for more information"
    };
  }
};

const register = async (ctx: RouterContext<any, any, any>) => {
  const bodyParser = await ctx.request.body({type: "json"});
  const body = await bodyParser.value;
  ctx.response.body = { message: "User registered successfully", data: body };
};

const logout = async (ctx: RouterContext<any, any, any>) => {
  try {
    // Extract auth token from request headers or cookies
    const authHeader = ctx.request.headers.get("Authorization");
    let token = null;
    let userId = null;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
      console.log("Found token in Authorization header");
    } else if (ctx.cookies && typeof ctx.cookies.get === "function") {
      // Try different possible cookie names for the token
      const possibleCookies = ["session_token", "auth_token"];
      for (const cookieName of possibleCookies) {
        const cookieValue = ctx.cookies.get(cookieName);
        if (cookieValue) {
          token = cookieValue;
          console.log(`Found token in ${cookieName} cookie`);
          break;
        }
      }
    }
    
    // Log the start of logout process
    console.log(`[${new Date().toISOString()}] Processing logout request`);
    
    // If we have a token, try to delete it from the database
    if (token) {
      try {
        // Handle case when token is an object instead of a string
        let tokenString;
        
        if (typeof token === 'object') {
          try {
            console.log("Token is an object, attempting to stringify");
            tokenString = JSON.stringify(token);
          } catch (jsonError) {
            console.error("Failed to stringify token object:", jsonError);
            tokenString = String(token);
          }
        } else {
          tokenString = String(token);
        }
        
        // Log the token (safely)
        const tokenStart = tokenString.substring(0, 8);
        const tokenEnd = tokenString.length > 16 ? tokenString.substring(tokenString.length - 8) : '';
        console.log(`Processing logout for token: ${tokenStart}...${tokenEnd}`);
        
        // Also try the raw token value if it's been encoded
        let decodedTokenString;
        try {
          decodedTokenString = decodeURIComponent(tokenString);
          if (decodedTokenString !== tokenString) {
            console.log("Using decoded token value for deletion");
          }
        } catch (e) {
          console.log("Token decoding failed, using original value");
          decodedTokenString = tokenString;
        }
        
        // Get the user ID from the session before deleting it
        try {
          const { client } = await import("../db/denopost_conn.ts");
          
          // Try both token formats
          let userId = null;
          let foundToken = false;
          
          for (const tokenVal of [tokenString, decodedTokenString]) {
            if (!tokenVal) continue;
            
            try {
              const sessionResult = await client.queryObject(
                `SELECT user_id FROM sessions WHERE token = $1`,
                [tokenVal]
              );
              
              if (sessionResult.rows && sessionResult.rows.length > 0) {
                const row = sessionResult.rows[0] as { user_id: string };
                userId = row.user_id;
                console.log(`Found user ID ${userId} for logout using token: ${tokenVal.substring(0, 8)}...`);
                foundToken = true;
                break;
              }
            } catch (sessionError) {
              console.error(`Error retrieving user ID with token ${tokenVal.substring(0, 8)}...`, sessionError);
            }
          }
          
          if (!foundToken) {
            console.log("Could not find user ID for token in sessions table");
          }
        } catch (sessionError) {
          console.error("Error retrieving user ID from session:", sessionError);
        }
        
        // Try to delete the token from the database using both formats
        let success = false;
        
        for (const tokenVal of [tokenString, decodedTokenString]) {
          if (!tokenVal) continue;
          
          try {
            const deleteResult = await sessionService.deleteSessionToken(tokenVal);
            if (deleteResult) {
              console.log(`Successfully deleted token from database using value: ${tokenVal.substring(0, 8)}...`);
              success = true;
              break;
            }
          } catch (deleteError) {
            console.error(`Error deleting token ${tokenVal.substring(0, 8)}...`, deleteError);
          }
        }
        
        if (!success) {
          console.log("Token not found in database or already deleted");
        }
        
        // Update last_logout timestamp if we have a user ID
        if (userId) {
          try {
            const { client } = await import("../db/denopost_conn.ts");
            
            // Try using CURRENT_TIMESTAMP directly
            try {
              const updateResult = await client.queryObject(
                `UPDATE users SET last_logout = CURRENT_TIMESTAMP WHERE id = $1`,
                [userId]
              );
              
              console.log(`Updated last_logout timestamp for user ${userId}`);
            } catch (updateError) {
              console.error("Error updating last_logout timestamp:", updateError);
            }
          } catch (dbError) {
            console.error("Database connection error when updating last_logout:", dbError);
          }
        }
      } catch (error) {
        console.error("Error during token deletion:", error);
      }
    } else {
      console.log("No token provided in logout request");
    }
    
    // Clear session cookie
    if (ctx.cookies && typeof ctx.cookies.set === "function") {
      ctx.cookies.set("session_token", "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true
      });
    }
    
    // Set more forceful redirect headers and status
    const redirectUrl = `/index.html?loggedOut=true&t=${Date.now()}`;
    console.log(`[REDIRECT] Setting redirect to ${redirectUrl}`);
    
    ctx.response.headers.set("Location", redirectUrl);
    ctx.response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.headers.set("Clear-Site-Data", "\"cache\", \"cookies\", \"storage\"");
    
    // Make sure response status is 302 for redirect
    ctx.response.status = 302; // Use redirect status code
    
    // Empty body for redirect
    ctx.response.body = null;
    
    console.log("Logout successful, redirecting to index page");
  } catch (error) {
    const err = error as Error;
    console.error("Logout error:", err);
    
    // More forceful redirect on error
    const errorRedirectUrl = `/index.html?loggedOut=true&error=true&t=${Date.now()}`;
    ctx.response.headers.set("Location", errorRedirectUrl);
    ctx.response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.headers.set("Clear-Site-Data", "\"cache\", \"cookies\", \"storage\"");
    ctx.response.status = 302;
    ctx.response.body = null;
    
    console.log(`[ERROR REDIRECT] Setting redirect to ${errorRedirectUrl}`);
  }
};

// Export an array of routes
export const authRoutes: Route[] = [
  { method: "POST", path: "/auth/login", handler: login },
  { method: "POST", path: "/login", handler: login }, // Add plain /login endpoint
  { method: "POST", path: "/auth/register", handler: register },
  { method: "POST", path: "/auth/logout", handler: logout },
  { method: "POST", path: "/logout", handler: logout }, // Add direct /logout endpoint
  { method: "GET", path: "/logout", handler: logout }, // Add GET method support for logout
];
