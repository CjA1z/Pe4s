import { client } from "../db/denopost_conn.ts";

/**
 * Interface for session data
 */
export interface SessionData {
  id: string;
  role: string;
  isLoggedIn: boolean;
}

/**
 * Verifies a session token against the database
 * @param token The session token to verify
 * @returns The user ID and role if token is valid, or null if invalid
 */
export async function verifySessionToken(token: string): Promise<SessionData | null> {
  if (!token) return null;
  
  try {
    // Query the database to validate the token
    const result = await client.queryObject(
      `SELECT s.user_id, u.role_id, r.role_name 
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    
    if (!result.rows || result.rows.length === 0) {
      console.log(`Token validation failed: ${token.substring(0, 8)}... not found or expired`);
      return null;
    }
    
    const row = result.rows[0] as {
      user_id: string;
      role_id: number;
      role_name: string;
    };
    
    // Determine role from either role_name or role_id
    let role = 'USER';
    if (row.role_name) {
      role = row.role_name.toUpperCase();
    } else if (row.role_id === 1) {
      role = 'ADMIN';
    }
    
    console.log(`Token validated successfully for user ${row.user_id} with role ${role}`);
    
    return {
      id: row.user_id,
      role: role,
      isLoggedIn: true
    };
  } catch (error) {
    console.error("Error verifying session token:", error);
    return null;
  }
} 