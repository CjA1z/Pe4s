import { client } from "../db/denopost_conn.ts";

/**
 * Interface for saved document in user library
 */
export interface SavedDocument {
  user_id: string;
  doc_id: number;
  saved_at: Date;
}

/**
 * Model for handling user library operations
 */
export class UserLibraryModel {
  /**
   * Add a document to user's library
   * @param userId The user ID
   * @param docId The document ID
   * @returns True if document was added successfully
   */
  static async addToLibrary(userId: string, docId: number): Promise<boolean> {
    try {
      // Check if the document is already in the library
      const existingDoc = await this.isInLibrary(userId, docId);
      if (existingDoc) {
        return true; // Document already exists in library
      }

      // Add document to library
      const result = await client.queryObject(
        `INSERT INTO saved_documents (user_id, doc_id) 
         VALUES ($1, $2)
         RETURNING *`,
        [userId, docId]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error("Error adding document to library:", error);
      throw new Error(`Failed to add document to library: ${error.message}`);
    }
  }

  /**
   * Remove a document from user's library
   * @param userId The user ID
   * @param docId The document ID
   * @returns True if document was removed successfully
   */
  static async removeFromLibrary(userId: string, docId: number): Promise<boolean> {
    try {
      const result = await client.queryObject(
        `DELETE FROM saved_documents 
         WHERE user_id = $1 AND doc_id = $2
         RETURNING *`,
        [userId, docId]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error("Error removing document from library:", error);
      throw new Error(`Failed to remove document from library: ${error.message}`);
    }
  }

  /**
   * Check if a document is in user's library
   * @param userId The user ID
   * @param docId The document ID
   * @returns True if document is in the library
   */
  static async isInLibrary(userId: string, docId: number): Promise<boolean> {
    try {
      const result = await client.queryObject(
        `SELECT * FROM saved_documents 
         WHERE user_id = $1 AND doc_id = $2`,
        [userId, docId]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error("Error checking if document is in library:", error);
      throw new Error(`Failed to check if document is in library: ${error.message}`);
    }
  }

  /**
   * Get all documents in user's library
   * @param userId The user ID
   * @returns Array of saved documents
   */
  static async getUserLibrary(userId: string): Promise<any[]> {
    try {
      // Query to get document details and authors
      const result = await client.queryObject(
        `SELECT 
          sd.*, 
          d.title, 
          d.abstract, 
          d.document_type,
          COALESCE(d.file_path, '') as file_path,
          ARRAY_AGG(DISTINCT a.full_name) FILTER (WHERE a.full_name IS NOT NULL) as author_names,
          ARRAY_AGG(DISTINCT ra.name) FILTER (WHERE ra.name IS NOT NULL) as keywords
        FROM 
          saved_documents sd
        JOIN 
          documents d ON sd.doc_id = d.id
        LEFT JOIN 
          document_authors da ON d.id = da.document_id
        LEFT JOIN 
          authors a ON da.author_id = a.id
        LEFT JOIN 
          document_research_agenda dra ON d.id = dra.document_id
        LEFT JOIN 
          research_agenda ra ON dra.research_agenda_id = ra.id
        WHERE 
          sd.user_id = $1
        GROUP BY 
          sd.user_id, sd.doc_id, sd.saved_at, d.id, d.title, d.abstract, d.document_type, d.file_path
        ORDER BY 
          sd.saved_at DESC`,
        [userId]
      );

      // Return rows with arrays for authors and keywords
      return result.rows;
    } catch (error) {
      console.error("Error retrieving user library:", error);
      throw new Error(`Failed to retrieve user library: ${error.message}`);
    }
  }

  /**
   * Count how many documents are in a user's library
   * @param userId The user ID
   * @returns Number of documents in the library
   */
  static async getLibraryCount(userId: string): Promise<number> {
    try {
      const result = await client.queryObject(
        `SELECT COUNT(*) as count FROM saved_documents 
         WHERE user_id = $1`,
        [userId]
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error("Error counting library documents:", error);
      throw new Error(`Failed to count library documents: ${error.message}`);
    }
  }
} 