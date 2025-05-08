// logout.ts
import { client } from "../db/denopost_conn.ts";  // PostgreSQL connection file

export async function handleLogout(req: Request): Promise<Response> {
    try {
        // Get the cookie string and log it for debugging
        const cookieString = req.headers.get("cookie") || "";
        console.log(`[LOGOUT.TS] Raw cookie string: ${cookieString}`);
        
        // Improved session token extraction
        let sessionToken = null;
        try {
            // Try direct regex extraction
            const tokenMatch = cookieString.match(/session_token=([^;]+)/);
            if (tokenMatch && tokenMatch[1]) {
                sessionToken = tokenMatch[1];
                console.log(`[LOGOUT.TS] Found token via regex: ${sessionToken.substring(0, 8)}...`);
                
                // Check if token needs URL decoding
                try {
                    const decodedToken = decodeURIComponent(sessionToken);
                    if (decodedToken !== sessionToken) {
                        console.log("[LOGOUT.TS] Token was URL encoded, decoded it");
                        sessionToken = decodedToken;
                    }
                } catch (e) {
                    // Decoding failed, keep original token
                }
                
                // Check if token is a JSON string
                if (sessionToken.startsWith('{') || sessionToken.startsWith('[') || 
                    sessionToken.startsWith('"') || sessionToken.includes('":"')) {
                    try {
                        const jsonToken = JSON.parse(sessionToken);
                        console.log(`[LOGOUT.TS] Token is JSON: ${JSON.stringify(jsonToken)}`);
                        
                        // If token is object with token property
                        if (jsonToken && typeof jsonToken === 'object') {
                            if (jsonToken.token) {
                                console.log(`[LOGOUT.TS] Extracted token from JSON object: ${jsonToken.token.substring(0, 8)}...`);
                                sessionToken = jsonToken.token;
                            } else if (jsonToken.access_token) {
                                console.log(`[LOGOUT.TS] Extracted access_token from JSON object: ${jsonToken.access_token.substring(0, 8)}...`);
                                sessionToken = jsonToken.access_token;
                            } else {
                                // Check for first UUID-like property
                                for (const key in jsonToken) {
                                    const value = jsonToken[key];
                                    if (typeof value === 'string' && 
                                        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                                        console.log(`[LOGOUT.TS] Extracted UUID-like value from JSON: ${value.substring(0, 8)}...`);
                                        sessionToken = value;
                                        break;
                                    }
                                }
                            }
                        } else if (typeof jsonToken === 'string') {
                            console.log(`[LOGOUT.TS] Token is a JSON string: ${jsonToken.substring(0, 8)}...`);
                            sessionToken = jsonToken;
                        }
                    } catch (e) {
                        console.log("[LOGOUT.TS] Failed to parse token as JSON, using as-is");
                    }
                }
            } else {
                console.log("[LOGOUT.TS] No token found via regex, parsing all cookies");
                
                // Parse all cookies
                const cookies = cookieString.split(';').reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=');
                    if (key && value) acc[key] = value;
                    return acc;
                }, {} as Record<string, string>);
                
                // Try various cookie names
                const possibleCookieNames = ['session_token', 'auth_token', 'token', 'accessToken', 'auth', 'session'];
                for (const name of possibleCookieNames) {
                    if (cookies[name]) {
                        sessionToken = cookies[name];
                        console.log(`[LOGOUT.TS] Found token in cookie '${name}': ${sessionToken.substring(0, 8)}...`);
                        break;
                    }
                }
            }
        } catch (cookieError) {
            console.error("[LOGOUT.TS] Error extracting token from cookies:", cookieError);
        }

        // Create a timestamp for cache-busting
        const timestamp = Date.now();
        const redirectUrl = `/index.html?loggedOut=true&t=${timestamp}`;
        
        console.log(`[LOGOUT.TS] Processing logout request at ${new Date().toISOString()}`);
        console.log(`[LOGOUT.TS] Will redirect to: ${redirectUrl}`);

        // Security headers to prevent caching and back navigation
        const securityHeaders: Record<string, string> = {
            "Location": redirectUrl,
            "Set-Cookie": "session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "no-referrer",
            "Clear-Site-Data": "\"cache\", \"cookies\", \"storage\"",
            "Content-Type": "text/html; charset=utf-8"
        };

        // Also clear other possible cookies
        const cookiesToClear = ['auth_token', 'accessToken', 'token', 'auth', 'session'];
        for (const cookieName of cookiesToClear) {
            securityHeaders[`Set-Cookie`] += `, ${cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
        }

        // If we don't have a token, just redirect to login
        if (!sessionToken) {
            console.log("[LOGOUT.TS] No valid session token found, redirecting to index");
            return new Response(null, {
                status: 302,
                headers: securityHeaders
            });
        }

        // Log the session token for debugging (partially masked)
        console.log(`[LOGOUT.TS] Processing logout for token: ${sessionToken.substring(0, 8)}...`);

        // Also try to extract a token from localStorage via client-side script
        
        try {
            // Try to delete the token from the databases
            const tokenString = String(sessionToken);
            console.log(`[LOGOUT.TS] Attempting to delete token from database: ${tokenString.substring(0, 8)}...`);
            
            // Try with a LIKE query to find the token even if it's part of a JSON string
            try {
                const tokenLikeResult = await client.queryObject(`
                    DELETE FROM sessions 
                    WHERE token LIKE $1 OR token LIKE $2 OR token LIKE $3 OR token = $4
                    RETURNING token
                `, [`%${tokenString}%`, `%"token":"${tokenString}"%`, `%"access_token":"${tokenString}"%`, tokenString]);
                
                if (tokenLikeResult?.rows?.length > 0) {
                    console.log(`[LOGOUT.TS] Successfully deleted token from sessions table using LIKE: ${tokenString.substring(0, 8)}...`);
                } else {
                    console.log(`[LOGOUT.TS] No matching token found in sessions table with LIKE query`);
                    
                    // Try exact match query as fallback
                    const exactMatchResult = await client.queryObject(`
                        DELETE FROM sessions WHERE token = $1 RETURNING token
                    `, [tokenString]);
                    
                    if (exactMatchResult?.rows?.length > 0) {
                        console.log(`[LOGOUT.TS] Successfully deleted token from sessions using exact match: ${tokenString.substring(0, 8)}...`);
                    } else {
                        console.log(`[LOGOUT.TS] No matching token found in sessions table with exact match`);
                    }
                }
            } catch (sessionsError) {
                console.error("[LOGOUT.TS] Error deleting from sessions table:", sessionsError);
            }
            
            // Also try to delete from tokens table if it exists
            try {
                const tokensLikeResult = await client.queryObject(`
                    DELETE FROM tokens 
                    WHERE token LIKE $1 OR token LIKE $2 OR token LIKE $3 OR token = $4
                    RETURNING token
                `, [`%${tokenString}%`, `%"token":"${tokenString}"%`, `%"access_token":"${tokenString}"%`, tokenString]);
                
                if (tokensLikeResult?.rows?.length > 0) {
                    console.log(`[LOGOUT.TS] Successfully deleted token from tokens table using LIKE: ${tokenString.substring(0, 8)}...`);
                } else {
                    console.log(`[LOGOUT.TS] No matching token found in tokens table with LIKE query`);
                    
                    // Try exact match query as fallback
                    const exactMatchResult = await client.queryObject(`
                        DELETE FROM tokens WHERE token = $1 RETURNING token
                    `, [tokenString]);
                    
                    if (exactMatchResult?.rows?.length > 0) {
                        console.log(`[LOGOUT.TS] Successfully deleted token from tokens using exact match: ${tokenString.substring(0, 8)}...`);
                    } else {
                        console.log(`[LOGOUT.TS] No matching token found in tokens table with exact match`);
                    }
                }
            } catch (tokensError) {
                console.log("[LOGOUT.TS] Note: Could not delete from tokens table (might not exist)");
            }
        } catch (dbError) {
            console.error("[LOGOUT.TS] Error deleting token from database:", dbError);
        }

        // Create response with cleared cookie and redirect
        console.log(`[LOGOUT.TS] Completing logout, redirecting to ${redirectUrl}`);
        return new Response(null, {
            status: 302,
            headers: securityHeaders
        });
    } catch (error) {
        console.error("[LOGOUT.TS] Error during logout:", error);
        
        // Create error redirect URL with timestamp
        const timestamp = Date.now();
        const errorRedirectUrl = `/index.html?loggedOut=true&error=true&t=${timestamp}`;
        console.log(`[LOGOUT.TS] Error occurred, redirecting to ${errorRedirectUrl}`);
        
        // Even if there's an error, try to redirect to index with proper headers
        return new Response(null, {
            status: 302,
            headers: {
                "Location": errorRedirectUrl,
                "Set-Cookie": "session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, auth_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, accessToken=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, auth=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff",
                "X-XSS-Protection": "1; mode=block",
                "Referrer-Policy": "no-referrer",
                "Clear-Site-Data": "\"cache\", \"cookies\", \"storage\"",
                "Content-Type": "text/html; charset=utf-8"
            }
        });
    }
} 
