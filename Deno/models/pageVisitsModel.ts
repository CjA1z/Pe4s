import { client } from "../db/denopost_conn.ts";

/**
 * Interface for page visit data
 */
export interface PageVisit {
  id: number;
  page_url: string;
  visitor_type: "guest" | "user";
  user_id?: string; // Optional, only for logged in users
  visit_date: Date;
  ip_address?: string;
  metadata?: Record<string, any>; // Added metadata field for document info
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

// Interface for document visit statistics
export interface DocumentVisitStats {
  document_id: string;
  document_type: string;
  title?: string;
  visit_count: number;
  last_visit_date?: Date;
}

export class PageVisitsModel {
  /**
   * Record a new visit to a page
   * 
   * @param pageUrl The URL of the page being visited
   * @param visitorType Whether the visitor is a guest or logged-in user
   * @param userId Optional user ID if the visitor is logged in
   * @param ipAddress Optional IP address of the visitor
   * @param metadata Optional additional metadata about the visit (like document ID)
   * @returns The newly created visit record or null if creation failed
   */
  static async recordVisit(
    pageUrl: string,
    visitorType: "guest" | "user",
    userId?: string,
    ipAddress?: string,
    metadata?: Record<string, any>
  ): Promise<PageVisit | null> {
    try {
      // Create the page_visits table if it doesn't exist
      await client.queryObject(`
        CREATE TABLE IF NOT EXISTS page_visits (
          id SERIAL PRIMARY KEY,
          page_url VARCHAR(255) NOT NULL,
          visitor_type VARCHAR(10) NOT NULL,
          user_id VARCHAR(50),
          ip_address VARCHAR(45),
          visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB
        )
      `);
      
      const result = await client.queryObject(
        `INSERT INTO page_visits (
          page_url, visitor_type, user_id, ip_address, visit_date, metadata
        ) VALUES ($1, $2, $3, $4, NOW(), $5)
        RETURNING *`,
        [
          pageUrl,
          visitorType,
          userId || null,
          ipAddress || null,
          metadata ? JSON.stringify(metadata) : null
        ]
      );
      
      return result.rows[0] as PageVisit || null;
    } catch (error) {
      console.error("Error recording page visit:", error);
      return null;
    }
  }

  /**
   * Get the total number of visits for a specific page
   * 
   * @param pageUrl The URL of the page
   * @returns The total number of visits
   */
  static async getTotalVisits(pageUrl: string): Promise<number> {
    try {
      const result = await client.queryObject(
        "SELECT COUNT(*) as count FROM page_visits WHERE page_url = $1",
        [pageUrl]
      );
      
      return parseInt((result.rows[0] as CountResult)?.count.toString() || "0");
    } catch (error) {
      console.error("Error getting total page visits:", error);
      return 0;
    }
  }

  /**
   * Get the number of visits broken down by visitor type for a specific page
   * 
   * @param pageUrl The URL of the page
   * @returns Object containing guest and user visit counts
   */
  static async getVisitsByType(pageUrl: string): Promise<{guest: number, user: number}> {
    try {
      const result = await client.queryObject(
        `SELECT visitor_type, COUNT(*) as count 
         FROM page_visits 
         WHERE page_url = $1 
         GROUP BY visitor_type`,
        [pageUrl]
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
      console.error("Error getting page visit breakdown:", error);
      return { guest: 0, user: 0 };
    }
  }

  /**
   * Get total visit statistics across all pages
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
         FROM page_visits 
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
  
  /**
   * Get home page visit statistics
   * 
   * @returns Object with total, guest, and user visit counts for the home page
   */
  static async getHomePageVisitStats(): Promise<{
    total: number,
    guest: number,
    user: number
  }> {
    try {
      // First, check if the home page has any visits
      const homepageResult = await client.queryObject(
        `SELECT visitor_type, COUNT(*) as count 
         FROM page_visits 
         WHERE page_url IN ('/', '/index.html', '/index')
         GROUP BY visitor_type`
      );
      
      let guestCount = 0;
      let userCount = 0;
      
      (homepageResult.rows as VisitorTypeCount[]).forEach(row => {
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
      console.error("Error getting homepage visit stats:", error);
      return { total: 0, guest: 0, user: 0 };
    }
  }

  /**
   * Get the most visited documents
   * 
   * @param limit Maximum number of documents to return
   * @param days Optional number of days to limit the timeframe
   * @returns Array of document visit statistics
   */
  static async getMostVisitedDocuments(limit = 10, days?: number): Promise<DocumentVisitStats[]> {
    try {
      // Build the SQL query with optional time limit
      let sql = `
        SELECT 
          (metadata->>'documentId') as document_id,
          (metadata->>'documentType') as document_type,
          COUNT(*) as visit_count,
          MAX(visit_date) as last_visit_date
        FROM page_visits
        WHERE 
          metadata IS NOT NULL AND
          metadata ? 'documentId'
      `;

      // Add time restriction if days parameter is provided
      const params: any[] = [];
      if (days) {
        sql += ` AND visit_date > NOW() - INTERVAL '${days} days'`;
      }

      // Group by and order the results
      sql += `
        GROUP BY document_id, document_type
        ORDER BY visit_count DESC, last_visit_date DESC
        LIMIT $1
      `;
      params.push(limit);

      // Execute the query
      const result = await client.queryObject(sql, params);
      
      return result.rows.map((row: any) => ({
        document_id: row.document_id,
        document_type: row.document_type,
        visit_count: parseInt(row.visit_count.toString()),
        last_visit_date: row.last_visit_date ? new Date(row.last_visit_date) : undefined
      }));
    } catch (error) {
      console.error("Error getting most visited documents:", error);
      return [];
    }
  }

  /**
   * Get visit statistics for a specific document
   * 
   * @param documentId The ID of the document
   * @returns Object with visit statistics for the document
   */
  static async getDocumentVisitStats(documentId: string): Promise<{
    total: number,
    guest: number,
    user: number,
    last_visit_date?: Date
  }> {
    try {
      const result = await client.queryObject(
        `SELECT 
          visitor_type, 
          COUNT(*) as count,
          MAX(visit_date) as last_visit_date
         FROM page_visits 
         WHERE metadata->>'documentId' = $1
         GROUP BY visitor_type`,
        [documentId]
      );
      
      let guestCount = 0;
      let userCount = 0;
      let lastVisitDate: Date | undefined;
      
      (result.rows as any[]).forEach(row => {
        if (row.visitor_type === "guest") {
          guestCount = parseInt(row.count.toString());
        } else if (row.visitor_type === "user") {
          userCount = parseInt(row.count.toString());
        }
        
        // Track the most recent visit date
        const rowDate = row.last_visit_date ? new Date(row.last_visit_date) : undefined;
        if (rowDate && (!lastVisitDate || rowDate > lastVisitDate)) {
          lastVisitDate = rowDate;
        }
      });
      
      return { 
        total: guestCount + userCount,
        guest: guestCount,
        user: userCount,
        last_visit_date: lastVisitDate
      };
    } catch (error) {
      console.error(`Error getting visit stats for document ${documentId}:`, error);
      return { total: 0, guest: 0, user: 0 };
    }
  }
} 