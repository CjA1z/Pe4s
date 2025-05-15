import { client } from "../db/denopost_conn.ts";

/**
 * Interface for user document history entry
 */
export interface DocumentHistoryEntry {
  id: number;
  user_id: string;
  document_id: number;
  accessed_at: Date;
  action: 'VIEW' | 'DOWNLOAD';
  title?: string;
  document_type?: string;
  category?: string;
  author_names?: string[];
  keywords?: string[];
}

/**
 * Model for handling user document history
 */
export class UserDocumentHistoryModel {
  /**
   * Record a document view or download action
   * @param userId User ID
   * @param documentId Document ID
   * @param action Action type ('VIEW' or 'DOWNLOAD')
   * @returns True if recorded successfully
   */
  static async recordAction(userId: string, documentId: number, action: 'VIEW' | 'DOWNLOAD'): Promise<boolean> {
    try {
      const result = await client.queryObject(
        `INSERT INTO user_document_history (user_id, document_id, action)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, documentId, action]
      );
      
      return result.rowCount > 0;
    } catch (error) {
      console.error(`Error recording document ${action}:`, error);
      return false;
    }
  }

  /**
   * Get user document history with filtering options
   * @param userId User ID
   * @param filters Optional filters for the query
   * @returns Array of document history entries
   */
  static async getUserHistory(
    userId: string, 
    filters: {
      category?: string;
      keyword?: string;
      startDate?: string;
      endDate?: string;
      searchTerm?: string;
      sortBy?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{items: DocumentHistoryEntry[], totalCount: number}> {
    try {
      // Build WHERE clauses based on filters
      const whereConditions = [`udh.user_id = $1`];
      const queryParams: any[] = [userId];
      let paramCount = 1;

      // Add category filter if provided
      if (filters.category && filters.category !== 'all') {
        paramCount++;
        whereConditions.push(`d.document_type = $${paramCount}`);
        queryParams.push(filters.category);
      }

      // Add date range filters if provided
      if (filters.startDate) {
        paramCount++;
        whereConditions.push(`udh.accessed_at >= $${paramCount}`);
        queryParams.push(filters.startDate);
      }

      if (filters.endDate) {
        paramCount++;
        whereConditions.push(`udh.accessed_at <= $${paramCount}::date + interval '1 day'`);
        queryParams.push(filters.endDate);
      }

      // Add search term filter
      if (filters.searchTerm) {
        paramCount++;
        whereConditions.push(`(
          d.title ILIKE '%' || $${paramCount} || '%' OR
          COALESCE(STRING_AGG(DISTINCT a.full_name, ', '), '') ILIKE '%' || $${paramCount} || '%'
        )`);
        queryParams.push(filters.searchTerm);
      }

      // Add keyword filter
      if (filters.keyword && filters.keyword !== 'all') {
        paramCount++;
        whereConditions.push(`ra.name = $${paramCount}`);
        queryParams.push(filters.keyword);
      }

      // Build the WHERE clause
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';

      // Determine sort order
      let orderBy = 'udh.accessed_at DESC'; // Default sort
      if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'date-saved-asc':
            orderBy = 'udh.accessed_at ASC';
            break;
          case 'title-asc':
            orderBy = 'd.title ASC';
            break;
          case 'title-desc':
            orderBy = 'd.title DESC';
            break;
          case 'category':
            orderBy = 'd.document_type ASC, udh.accessed_at DESC';
            break;
          default:
            orderBy = 'udh.accessed_at DESC';
        }
      }

      // Get total count first
      const countQuery = `
        SELECT COUNT(DISTINCT udh.id) as total_count
        FROM user_document_history udh
        JOIN documents d ON udh.document_id = d.id
        LEFT JOIN document_authors da ON d.id = da.document_id
        LEFT JOIN authors a ON da.author_id = a.id
        LEFT JOIN document_research_agenda dra ON d.id = dra.document_id
        LEFT JOIN research_agenda ra ON dra.research_agenda_id = ra.id
        ${whereClause}
      `;
      
      const countResult = await client.queryObject<{total_count: number}>(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0]?.total_count.toString() || '0');

      // Apply pagination
      const limit = filters.limit || 10;
      const offset = filters.offset || 0;
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      // Build main query
      const mainQuery = `
        SELECT 
          DISTINCT udh.id,
          udh.user_id,
          udh.document_id,
          udh.accessed_at,
          udh.action,
          d.title,
          d.document_type,
          d.document_type as category,
          (
            SELECT ARRAY_AGG(DISTINCT a.full_name)
            FROM document_authors da
            JOIN authors a ON da.author_id = a.id
            WHERE da.document_id = d.id
          ) as author_names,
          (
            SELECT ARRAY_AGG(DISTINCT ra.name)
            FROM document_research_agenda dra
            JOIN research_agenda ra ON dra.research_agenda_id = ra.id
            WHERE dra.document_id = d.id
          ) as keywords
        FROM user_document_history udh
        JOIN documents d ON udh.document_id = d.id
        LEFT JOIN document_authors da ON d.id = da.document_id
        LEFT JOIN authors a ON da.author_id = a.id
        LEFT JOIN document_research_agenda dra ON d.id = dra.document_id
        LEFT JOIN research_agenda ra ON dra.research_agenda_id = ra.id
        ${whereClause}
        GROUP BY udh.id, d.id
        ORDER BY ${orderBy}
        LIMIT $${paramCount-1} OFFSET $${paramCount}
      `;

      const result = await client.queryObject<DocumentHistoryEntry>(mainQuery, queryParams);
      
      return {
        items: result.rows,
        totalCount
      };
    } catch (error) {
      console.error("Error retrieving user document history:", error);
      throw new Error(`Failed to retrieve user document history: ${error.message}`);
    }
  }
  
  /**
   * Get the unique categories in the user's history
   * @param userId User ID 
   * @returns Array of category names
   */
  static async getHistoryCategories(userId: string): Promise<string[]> {
    try {
      const result = await client.queryObject<{document_type: string}>(
        `SELECT DISTINCT d.document_type as name
         FROM user_document_history udh
         JOIN documents d ON udh.document_id = d.id
         WHERE udh.user_id = $1
         ORDER BY d.document_type`,
        [userId]
      );
      
      return result.rows.map(row => row.document_type);
    } catch (error) {
      console.error("Error retrieving history categories:", error);
      return [];
    }
  }
  
  /**
   * Get the unique keywords in the user's history
   * @param userId User ID 
   * @returns Array of keyword names
   */
  static async getHistoryKeywords(userId: string): Promise<string[]> {
    try {
      const result = await client.queryObject<{name: string}>(
        `SELECT DISTINCT ra.name
         FROM user_document_history udh
         JOIN documents d ON udh.document_id = d.id
         JOIN document_research_agenda dra ON d.id = dra.document_id
         JOIN research_agenda ra ON dra.research_agenda_id = ra.id
         WHERE udh.user_id = $1
         ORDER BY ra.name`,
        [userId]
      );
      
      return result.rows.map(row => row.name);
    } catch (error) {
      console.error("Error retrieving history keywords:", error);
      return [];
    }
  }
} 