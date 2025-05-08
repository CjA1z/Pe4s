import { client } from "../db/denopost_conn.ts";

/**
 * Interface for author visit data
 */
export interface AuthorVisit {
  id: number;
  author_id: string;
  visitor_type: "guest" | "user";
  user_id?: string; // Optional, only for logged in users, now VARCHAR in database
  visit_date: Date;
  ip_address?: string;
}

// Type for database row with count
interface CountResult {
  count: number;
}

// Type for visitor type count result
interface VisitorTypeCount {
  visitor_type: string;
  count: number;
}

// Type for top author result
interface TopAuthorResult {
  author_id: string;
  full_name: string;
  profile_picture: string | null;
  visit_count: number;
}

export class AuthorVisitsModel {
  /**
   * Record a new visit to an author's profile
   * 
   * @param authorId The UUID of the author
   * @param visitorType Whether the visitor is a guest or logged-in user
   * @param userId Optional user ID if the visitor is logged in
   * @param ipAddress Optional IP address of the visitor
   * @returns The newly created visit record or null if creation failed
   */
  static async recordVisit(
    authorId: string,
    visitorType: "guest" | "user",
    userId?: string,
    ipAddress?: string
  ): Promise<AuthorVisit | null> {
    try {
      // Check if author exists first
      const authorExists = await client.queryObject(
        "SELECT 1 FROM authors WHERE id = $1",
        [authorId]
      );
      
      if (authorExists.rows.length === 0) {
        console.error(`Author with ID ${authorId} not found`);
        return null;
      }
      
      const result = await client.queryObject(
        `INSERT INTO author_visits (
          author_id, visitor_type, user_id, ip_address, visit_date
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *`,
        [
          authorId,
          visitorType,
          userId || null,
          ipAddress || null
        ]
      );
      
      return result.rows[0] as AuthorVisit || null;
    } catch (error) {
      console.error("Error recording author visit:", error);
      return null;
    }
  }

  /**
   * Get the total number of visits for an author
   * 
   * @param authorId The UUID of the author
   * @returns The total number of visits
   */
  static async getTotalVisits(authorId: string): Promise<number> {
    try {
      const result = await client.queryObject(
        "SELECT COUNT(*) as count FROM author_visits WHERE author_id = $1",
        [authorId]
      );
      
      return parseInt((result.rows[0] as CountResult)?.count.toString() || "0");
    } catch (error) {
      console.error("Error getting total author visits:", error);
      return 0;
    }
  }

  /**
   * Get the number of visits broken down by visitor type
   * 
   * @param authorId The UUID of the author
   * @returns Object containing guest and user visit counts
   */
  static async getVisitsByType(authorId: string): Promise<{guest: number, user: number}> {
    try {
      const result = await client.queryObject(
        `SELECT visitor_type, COUNT(*) as count 
         FROM author_visits 
         WHERE author_id = $1 
         GROUP BY visitor_type`,
        [authorId]
      );
      
      let guestCount = 0;
      let userCount = 0;
      
      (result.rows as VisitorTypeCount[]).forEach(row => {
        if (row.visitor_type === "guest") {
          guestCount = parseInt(row.count.toString());
        } else if (row.visitor_type === "user") {
          userCount = parseInt(row.count.toString());
        }
      });
      
      return { guest: guestCount, user: userCount };
    } catch (error) {
      console.error("Error getting author visit breakdown:", error);
      return { guest: 0, user: 0 };
    }
  }

  /**
   * Get the top authors by visit count
   * 
   * @param limit The maximum number of authors to return
   * @returns Array of authors with their visit counts
   */
  static async getTopAuthors(limit: number = 5): Promise<Array<{
    author_id: string,
    full_name: string,
    profile_picture: string | null,
    visit_count: number
  }>> {
    try {
      const result = await client.queryObject(
        `SELECT 
           a.id as author_id, 
           a.full_name, 
           a.profile_picture,
           COUNT(av.id) as visit_count
         FROM authors a
         JOIN author_visits av ON a.id = av.author_id
         GROUP BY a.id, a.full_name, a.profile_picture
         ORDER BY visit_count DESC
         LIMIT $1`,
        [limit]
      );
      
      return (result.rows as TopAuthorResult[]).map(row => ({
        author_id: row.author_id,
        full_name: row.full_name,
        profile_picture: row.profile_picture,
        visit_count: parseInt(row.visit_count.toString())
      }));
    } catch (error) {
      console.error("Error getting top authors:", error);
      return [];
    }
  }

  /**
   * Get total visit statistics
   * 
   * @returns Object with total, guest, and user visit counts
   */
  static async getTotalVisitStats(): Promise<{
    total: number,
    guest: number,
    user: number
  }> {
    try {
      const result = await client.queryObject(
        `SELECT visitor_type, COUNT(*) as count 
         FROM author_visits 
         GROUP BY visitor_type`
      );
      
      let guestCount = 0;
      let userCount = 0;
      
      (result.rows as VisitorTypeCount[]).forEach(row => {
        if (row.visitor_type === "guest") {
          guestCount = parseInt(row.count.toString());
        } else if (row.visitor_type === "user") {
          userCount = parseInt(row.count.toString());
        }
      });
      
      return { 
        total: guestCount + userCount,
        guest: guestCount,
        user: userCount
      };
    } catch (error) {
      console.error("Error getting total visit stats:", error);
      return { total: 0, guest: 0, user: 0 };
    }
  }
} 