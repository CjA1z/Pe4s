import { client } from "../db/denopost_conn.ts";

// Define interfaces for our data structures
export interface DocumentOptions {
  page?: number;
  limit?: number;
  category?: string | null;
  search?: string | null;
  keyword?: string | null;
  sort?: string;
  order?: string;
  docTypes?: string; // Add docTypes option to filter by document type (all, compiled, single)
}

export interface Document {
  id: number;
  title: string;
  description: string;
  publication_date?: Date | null;
  document_type: string;
  volume?: string;
  issue?: string;
  authors: Author[];
  topics: Topic[];
  is_compiled?: boolean;
  child_count?: number;
  parent_compiled_id?: number | null;
  start_year?: number;
  end_year?: number;
}

interface Author {
  id: number;
  full_name?: string;
}

interface Topic {
  id: number;
  name: string;
}

export interface DocumentsResponse {
  documents: Document[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  error?: string;
}

interface ChildDocumentsResponse {
  documents: Document[];
}

// Add interface for compiled document
export interface CompiledDocument {
  id: number;
  title?: string;
  start_year?: number;
  end_year?: number;
  volume?: number;
  issue_number?: number;
  department?: string;
  category?: string;
  foreword?: string;
  abstract_foreword?: string;
  created_at: string;
  updated_at?: string;
  document_count?: number;
}

/**
 * Normalize document type to ensure it's a valid enum value
 * @param documentType The document type to normalize
 * @returns A valid uppercase document type enum value
 */
function normalizeDocumentType(documentType: string): string {
  // Convert to uppercase
  const upperType = documentType.toUpperCase();
  
  // Check if it's one of the valid enum values
  const validTypes = ['THESIS', 'DISSERTATION', 'CONFLUENCE', 'SYNERGY'];
  
  if (validTypes.includes(upperType)) {
    return upperType;
  }
  
  // If not valid, map to a suitable default based on context
  console.warn(`Invalid document_type "${documentType}" normalized to default "CONFLUENCE"`);
  return 'CONFLUENCE';
}

/**
 * Fetches documents from the database with filtering, sorting, and pagination
 * Handles both regular and compiled documents in a single query
 */
export async function fetchDocuments(
  options: DocumentOptions = {}
): Promise<DocumentsResponse> {
  try {
    console.log(`[DB] Fetching documents with options: ${JSON.stringify(options)}`);
    
    const {
      page = 1,
      limit = 10,
      category = null,
      search = null,
      keyword = null,
      sort = 'id',
      order = 'ASC',
      docTypes = 'all', // Default to showing all document types
    } = options;
    
    // Build the parameters array
    const params: any[] = [];
    let paramIndex = 1;
    
    // Validate sort field and order to prevent SQL injection
    const validSortFields = ['id', 'title', 'publication_date', 'document_type', 'created_at'];
    const validOrders = ['ASC', 'DESC'];
    
    const sortField = validSortFields.includes(sort) ? sort : 'id';
    const sortOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';
    
    // For search filtering
    let searchWhereClause = '';
    if (search) {
      searchWhereClause = `AND (
        d.title ILIKE $${paramIndex} OR 
        d.description ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM authors a 
          JOIN document_authors da ON a.id = da.author_id
          WHERE da.document_id = d.id AND a.full_name ILIKE $${paramIndex}
        )
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // For keyword filtering
    let keywordWhereClause = '';
    if (keyword) {
      keywordWhereClause = `AND (
        EXISTS (
          SELECT 1 FROM research_agenda ra 
          JOIN document_research_agenda dra ON ra.id = dra.research_agenda_id
          WHERE dra.document_id = d.id AND ra.name ILIKE $${paramIndex}
        )
      )`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }
    
    // For category filtering in documents
    let categoryDocWhereClause = '';
    if (category && category !== 'All') {
      // Check if it's a comma-separated list of categories
      if (category.includes(',')) {
        const categories = category.split(',').map(c => c.trim());
        
        // Create a parameterized IN condition for multiple categories
        const placeholders = categories.map((_, i) => `$${paramIndex + i}`).join(',');
        categoryDocWhereClause = `AND LOWER((d.document_type)::TEXT) IN (${placeholders})`;
        
        // Add each category as a parameter
        categories.forEach(cat => {
          params.push(cat.toLowerCase());
          paramIndex++;
        });
      } else {
        // Single category - use the existing approach
        categoryDocWhereClause = `AND LOWER((d.document_type)::TEXT) = LOWER($${paramIndex})`;
        params.push(category);
        paramIndex++;
      }
    }
    
    // For category filtering in compiled documents
    let categoryCompWhereClause = '';
    if (category && category !== 'All') {
      // Check if it's a comma-separated list of categories
      if (category.includes(',')) {
        const categories = category.split(',').map(c => c.trim());
        
        // Create a parameterized condition for multiple categories
        const placeholders = [];
        const likeParams = [];
        
        for (let i = 0; i < categories.length; i++) {
          // Add exact match and like match placeholders for each category
          placeholders.push(`LOWER((cd.category)::TEXT) = $${paramIndex + i}`);
          placeholders.push(`cd.category ILIKE $${paramIndex + categories.length + i}`);
          
          // Add parameters for exact match and like match
          params.push(categories[i].toLowerCase());
          likeParams.push(`%${categories[i]}%`);
        }
        
        // Combine placeholders with OR
        categoryCompWhereClause = `AND (${placeholders.join(' OR ')})`;
        
        // Add like parameters
        params.push(...likeParams);
        paramIndex += categories.length * 2;
      } else {
        // Single category - use the existing approach
        categoryCompWhereClause = `AND (LOWER((cd.category)::TEXT) = LOWER($${paramIndex}) OR cd.category ILIKE $${paramIndex+1})`;
        params.push(category.toLowerCase());
        params.push(`%${category}%`);
        paramIndex += 2;
      }
    }
    
    // Determine which document types to include based on docTypes parameter
    let includeRegularDocs = true;
    let includeCompiledDocs = true;
    
    if (docTypes === 'compiled') {
      includeRegularDocs = false;
      includeCompiledDocs = true;
      console.log('[DB] Filtering to show only compiled documents');
    } else if (docTypes === 'single') {
      includeRegularDocs = true;
      includeCompiledDocs = false;
      console.log('[DB] Filtering to show only single documents');
    } else {
      // Default is 'all' - show both types
      includeRegularDocs = true;
      includeCompiledDocs = true;
      console.log('[DB] Showing all document types (single and compiled)');
    }
    
    // Build the query dynamically based on document types to include
    let combinedDocsQuery = 'WITH combined_docs AS (';
    
    // Include regular documents if requested
    if (includeRegularDocs) {
      combinedDocsQuery += `
        -- Regular documents that are not children of compilations
        SELECT 
          d.id, 
            COALESCE(d.title, 'Untitled Document')::TEXT as title,
            COALESCE(d.description, '')::TEXT as description,
          d.publication_date, 
          (d.document_type)::TEXT as document_type,
            COALESCE(d.volume, '')::TEXT as volume,
            COALESCE(d.issue, '')::TEXT as issue,
            NULL as start_year,
            NULL as end_year,
            'document'::TEXT as doc_source,
            false as is_parent,
            false as is_compiled,
            d.compiled_parent_id as parent_id,
            (
              SELECT COUNT(*) 
              FROM compiled_document_items cdi 
              WHERE cdi.compiled_document_id = d.id
            )::BIGINT as child_count,
            d.deleted_at
        FROM 
          documents d
        WHERE 
            -- Only include documents without compiled_parent_id for main document list
            d.compiled_parent_id IS NULL
            -- Exclude archived documents
            AND d.deleted_at IS NULL
            
            ${searchWhereClause}
            ${keywordWhereClause}
            ${categoryDocWhereClause}
      `;
    }
    
    // Add UNION ALL if including both document types
    if (includeRegularDocs && includeCompiledDocs) {
      combinedDocsQuery += `
        UNION ALL
      `;
    }
    
    // Include compiled documents if requested
    if (includeCompiledDocs) {
      combinedDocsQuery += `
        -- Compiled documents from the compiled_documents table directly
        SELECT
          cd.id,
          CONCAT(
            COALESCE(cd.category, ''),
            ' Vol. ',
            COALESCE(CAST(cd.volume AS TEXT), ''),
            CASE 
              WHEN cd.start_year IS NOT NULL AND cd.end_year IS NOT NULL THEN CONCAT(' (', cd.start_year, '-', cd.end_year, ')')
              WHEN cd.start_year IS NOT NULL THEN CONCAT(' (', cd.start_year, ')')
              ELSE ''
            END
          )::TEXT as title,
          ''::TEXT as description,
          NULL as publication_date,
          (COALESCE(cd.category, 'CONFLUENCE'))::TEXT as document_type,
          COALESCE(CAST(cd.volume AS TEXT), '')::TEXT as volume,
          COALESCE(CAST(cd.issue_number AS TEXT), '')::TEXT as issue,
          cd.start_year,
          cd.end_year,
          'compiled'::TEXT as doc_source,
          true as is_parent,
          true as is_compiled,
          NULL::BIGINT as parent_id,
          (
            SELECT COUNT(*) 
            FROM compiled_document_items cdi 
            WHERE cdi.compiled_document_id = cd.id
          )::BIGINT as child_count,
          cd.deleted_at
        FROM 
          compiled_documents cd
        WHERE 
          cd.deleted_at IS NULL ${categoryCompWhereClause}
      `;
    }
    
    // Close the CTE
    combinedDocsQuery += `),`;
    
    // Complete the query with count and ordering
    const fullQuery = `
      ${combinedDocsQuery}
      count_query AS (
        SELECT COUNT(*) as total_count FROM combined_docs
      )
      SELECT 
        cd.*,
        (SELECT total_count FROM count_query) as total_count
      FROM 
        combined_docs cd
      ORDER BY 
        ${sortField} ${sortOrder} NULLS LAST, id ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex+1}
    `;
    
    // Add pagination parameters
    params.push(limit, (page - 1) * limit);
    
    console.log(`[DB] Executing query with ${params.length} parameters`);
    
    // Execute the query
    const result = await client.queryObject(fullQuery, params);
    
    console.log(`[DB] Query returned ${result.rowCount} rows`);
    
    // Check and log how many compiled and single documents were returned
    if (result.rows && result.rows.length > 0) {
      const compiledCount = result.rows.filter((row: any) => row.is_compiled === true).length;
      const singleCount = result.rows.filter((row: any) => row.is_compiled !== true).length;
      console.log(`[DB] Document type breakdown: ${compiledCount} compiled, ${singleCount} single documents`);
    }
    
    // Check the first few results for deleted_at values
    if (result.rows && result.rows.length > 0) {
      console.log(`[DB] First 3 results from database:`);
      result.rows.slice(0, 3).forEach((row: any, index) => {
        console.log(`[DB] Row ${index}:`, {
          id: row.id, 
          title: row.title?.substring(0, 30) + '...',
          is_compiled: row.is_compiled,
          deleted_at: row.deleted_at,
          deleted_at_type: typeof row.deleted_at
        });
      });
    }
    
    // If no results in the combined query, check if we have compiled documents in the database
    if (result.rowCount === undefined || result.rowCount === 0 || result.rowCount < 5) {
      console.log(`[DB] Few or no results returned (${result.rowCount ?? 0}), checking for compiled documents separately...`);
      
      // Direct query to check if we have compiled documents in the database
      const compiledCheckQuery = `
        SELECT cd.id, cd.category, cd.volume, cd.start_year, cd.end_year, d.deleted_at 
        FROM compiled_documents cd
        LEFT JOIN documents d ON d.id = cd.id 
        LIMIT 10
      `;
      
      const compiledCheck = await client.queryObject(compiledCheckQuery);
      console.log(`[DB] Found ${compiledCheck.rowCount ?? 0} compiled documents in direct check:`, 
        compiledCheck.rows?.map((r: any) => ({ 
          id: r.id, 
          category: r.category, 
          deleted: r.deleted_at ? 'Yes' : 'No' 
        })) || []
      );
    }
    
    if (!result.rowCount) {
      return {
        documents: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
      };
    }
    
    // Get total count from the first row
    const totalCount = parseInt(String((result.rows[0] as any).total_count || '0'), 10);
    const totalPages = Math.ceil(totalCount / limit);
    
    // Process documents
    const documents: Document[] = [];
    
    for (const row of result.rows as any[]) {
      console.log(`[DB] Processing ${row.doc_source} row ID=${row.id}:`, {
        deleted_at: row.deleted_at,
        deleted_at_type: typeof row.deleted_at,
        title: row.title?.substring(0, 30)
      });
      
      // Create base document object
      const doc: Document = {
        id: row.id,
        title: row.title || 'Untitled Document',
        description: row.description || '',
        publication_date: row.publication_date ? new Date(row.publication_date) : null,
        document_type: row.document_type || '',
        volume: row.volume || '',
        issue: row.issue || '',
        authors: [],
        topics: [],
        is_compiled: row.is_compiled === true || row.is_parent === true,
        child_count: parseInt(String(row.child_count || '0'), 10),
        parent_compiled_id: row.parent_id,
        start_year: row.start_year ? parseInt(String(row.start_year), 10) : undefined,
        end_year: row.end_year ? parseInt(String(row.end_year), 10) : undefined
      };
      
      // Also add deleted_at explicitly for use in filtering
      (doc as any).deleted_at = row.deleted_at;
      
      // Log if this document has deleted_at set
      if (row.deleted_at) {
        console.warn(`[DB] WARNING: Document ${doc.id} has deleted_at=${row.deleted_at} but is still included in results!`);
      }
      
      // Log document type information to help debug the UI display
      console.log(`[DB] Document ${doc.id} type info: is_parent=${row.is_parent}, is_compiled=${doc.is_compiled}, doc_source=${row.doc_source}`);
      
      // Add a doc_type property for frontend compatibility
      (doc as any).doc_type = row.document_type || '';
      
      // Skip child documents with no children if we're filtering by category
      if (doc.is_compiled && doc.child_count === 0 && category && category !== 'All') {
        console.log(`[DB] Skipping empty compiled document ${doc.id} (${doc.title}) when filtering by category`);
        continue;
      }
      
      // Fetch authors for this document - for ALL document types
      try {
        console.log(`[DB] Fetching authors for document ${doc.id} (${doc.title})`);
        const authorsQuery = `
          SELECT a.id, a.full_name
          FROM authors a
          JOIN document_authors da ON a.id = da.author_id
          WHERE da.document_id = $1
        `;
        const authorsResult = await client.queryObject(authorsQuery, [doc.id]);
        
        doc.authors = authorsResult.rows.map((author: any) => ({
          id: author.id,
          full_name: author.full_name || '',
        }));
        
        console.log(`[DB] Found ${doc.authors.length} authors for document ${doc.id}:`, 
          doc.authors.map((author: any) => author.full_name || 'unnamed').join(', '));
      } catch (error) {
        console.error(`[DB] Error fetching authors for document ${doc.id}:`, error);
        doc.authors = [];
      }
      
      // Fetch topics for this document - for ALL document types 
      try {
        const topicsQuery = `
          SELECT ra.id, ra.name
          FROM research_agenda ra
          JOIN document_research_agenda dra ON ra.id = dra.research_agenda_id
          WHERE dra.document_id = $1
        `;
        const topicsResult = await client.queryObject(topicsQuery, [doc.id]);
        
        doc.topics = topicsResult.rows.map((topic: any) => ({
          id: topic.id,
          name: topic.name || '',
        }));
      } catch (error) {
        console.error(`[DB] Error fetching topics for document ${doc.id}:`, error);
        doc.topics = [];
      }
      
      documents.push(doc);
    }
    
    // Add one final check for deleted documents
    const deletedCount = documents.filter(doc => (doc as any).deleted_at).length;
    if (deletedCount > 0) {
      console.warn(`[DB] WARNING: Found ${deletedCount} documents with deleted_at set in final document array!`);
    }
    
    return {
      documents,
      totalCount,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error('[DB] Error fetching documents:', error);
    return {
      documents: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      error: `Error fetching documents: ${error}`,
    };
  }
}

/**
 * Fetches child documents of a compiled document
 * @param compiledDocId The ID of the compiled document
 * @returns Array of child documents
 */
export async function fetchChildDocuments(compiledDocId: number | string): Promise<ChildDocumentsResponse> {
  try {
    console.log(`Fetching child documents for compiled document ID: ${compiledDocId}`);
    
    // First, get the category of the compiled document to ensure type-specific fetching
    const categoryQuery = `
      SELECT category 
      FROM compiled_documents 
      WHERE id = $1
    `;
    
    const categoryResult = await client.queryObject(categoryQuery, [compiledDocId]);
    
    if (!categoryResult.rowCount || categoryResult.rowCount === 0) {
      console.warn(`Compiled document with ID ${compiledDocId} not found in compiled_documents table`);
      return { documents: [] };
    }
    
    const category = (categoryResult.rows[0] as any).category;
    console.log(`Compiled document category: ${category}`);
    
    // Build a type-specific query based on the category
    let childQuery = '';
    
    if (category === 'SYNERGY' || category === 'Synergy') {
      console.log(`Using Synergy-specific query for document ID: ${compiledDocId}`);
      childQuery = `
        SELECT 
          d.id, 
          d.title,
          d.description,
          d.publication_date, 
          d.document_type,
          d.volume,
          d.issue,
          cdi.compiled_document_id as parent_compiled_id
        FROM 
          documents d
        JOIN
          compiled_document_items cdi ON d.id = cdi.document_id
        WHERE 
          cdi.compiled_document_id = $1
          AND d.deleted_at IS NULL
          AND d.document_type = 'SYNERGY'
        ORDER BY
          d.publication_date DESC, d.id ASC
      `;
    } else if (category === 'CONFLUENCE' || category === 'Confluence') {
      console.log(`Using Confluence-specific query for document ID: ${compiledDocId}`);
      childQuery = `
        SELECT 
          d.id, 
          d.title,
          d.description,
          d.publication_date, 
          d.document_type,
          d.volume,
          d.issue,
          cdi.compiled_document_id as parent_compiled_id
        FROM 
          documents d
        JOIN
          compiled_document_items cdi ON d.id = cdi.document_id
        WHERE 
          cdi.compiled_document_id = $1
          AND d.deleted_at IS NULL
          AND d.document_type = 'CONFLUENCE'
        ORDER BY
          d.publication_date DESC, d.id ASC
      `;
    } else {
      // Generic query as fallback
      console.log(`Using generic query for document ID: ${compiledDocId}`);
      childQuery = `
        SELECT 
          d.id, 
          d.title,
          d.description,
          d.publication_date, 
          d.document_type,
          d.volume,
          d.issue,
          cdi.compiled_document_id as parent_compiled_id
        FROM 
          documents d
        JOIN
          compiled_document_items cdi ON d.id = cdi.document_id
        WHERE 
          cdi.compiled_document_id = $1
          AND d.deleted_at IS NULL
        ORDER BY
          d.publication_date DESC, d.id ASC
      `;
    }
    
    console.log(`Executing category-specific query for ${category} documents`);
    const childResult = await client.queryObject(childQuery, [compiledDocId]);
    console.log(`Query returned ${childResult.rowCount} rows`);
    
    // Process documents to include authors and topics
    const documents = await processChildDocuments(childResult.rows as any[]);
    return { documents };
  } catch (error) {
    console.error(`Error fetching child documents for compiled document ID ${compiledDocId}:`, error);
    return { documents: [] };
  }
}

/**
 * Helper function to process child document rows into full document objects
 * @param rows Database result rows
 * @returns Array of processed document objects
 */
async function processChildDocuments(rows: any[]): Promise<Document[]> {
  const documents: Document[] = [];
  
  for (const row of rows) {
    // Convert to Document structure
    const doc: Document = {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      publication_date: row.publication_date ? new Date(row.publication_date) : null,
      document_type: row.document_type || '',
      volume: row.volume || '',
      issue: row.issue || '',
      authors: [],
      topics: [],
      is_compiled: false,
      parent_compiled_id: parseInt(String(row.parent_compiled_id), 10) || null,
      start_year: row.start_year ? parseInt(String(row.start_year), 10) : undefined,
      end_year: row.end_year ? parseInt(String(row.end_year), 10) : undefined
    };
    
    // Add doc_type for frontend compatibility
    (doc as any).doc_type = row.document_type || '';
    
    // Fetch authors for this document
    try {
      const authorsQuery = `
        SELECT a.id, a.full_name
        FROM authors a
        JOIN document_authors da ON a.id = da.author_id
        WHERE da.document_id = $1
      `;
      const authorsResult = await client.queryObject(authorsQuery, [doc.id]);
      
      doc.authors = (authorsResult.rows as any[]).map(author => ({
        id: author.id,
        full_name: author.full_name || ''
      }));
    } catch (error) {
      console.error(`Error fetching authors for document ${doc.id}:`, error);
      doc.authors = [];
    }
    
    // Fetch topics for this document
    try {
      const topicsQuery = `
        SELECT ra.id, ra.name
        FROM research_agenda ra
        JOIN document_research_agenda dra ON ra.id = dra.research_agenda_id
        WHERE dra.document_id = $1
      `;
      const topicsResult = await client.queryObject(topicsQuery, [doc.id]);
      
      doc.topics = (topicsResult.rows as any[]).map(topic => ({
        id: topic.id,
        name: topic.name || ''
      }));
    } catch (error) {
      console.error(`Error fetching topics for document ${doc.id}:`, error);
      doc.topics = [];
    }
    
    documents.push(doc);
  }
  
  return documents;
}

/**
 * Creates a new compiled document
 * @param compiledDoc The compiled document data
 * @param documentIds Array of document IDs to associate with the compiled document
 * @returns The created compiled document ID
 */
export async function createCompiledDocument(
  compiledDoc: {
    start_year?: number;
    end_year?: number;
    volume?: number;
    issue_number?: number;
    department?: string;
    category?: string;
    foreword?: string;
    abstract_foreword?: string;
  },
  documentIds: number[] = []
): Promise<number> {
  try {
    console.log(`Creating compiled document: ${JSON.stringify(compiledDoc)}`);
    
    // Start a transaction
    await client.queryArray("BEGIN");
    
    try {
      // Generate a title for logging purposes
      const documentTitle = `${compiledDoc.category || 'Compiled Document'} Vol. ${compiledDoc.volume || '1'}${compiledDoc.start_year ? ` (${compiledDoc.start_year})` : ''}`;
      
      // Create the compiled document directly without creating a documents entry
      const compiledQuery = `
        INSERT INTO compiled_documents (
          start_year, 
          end_year, 
          volume, 
          issue_number, 
          department, 
          category,
          foreword,
          abstract_foreword,
          created_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      
      const compiledParams = [
        compiledDoc.start_year || null,
        compiledDoc.end_year || null,
        compiledDoc.volume || null,
        compiledDoc.issue_number || null,
        compiledDoc.department || null,
        compiledDoc.category || 'CONFLUENCE',
        compiledDoc.foreword || null,
        compiledDoc.abstract_foreword || null
      ];
      
      const compiledResult = await client.queryObject(compiledQuery, compiledParams);
      
      if (!compiledResult.rows || compiledResult.rows.length === 0) {
        throw new Error("Failed to create compiled document entry");
      }
      
      const row = compiledResult.rows[0] as Record<string, unknown>;
      const compiledDocId = typeof row.id === 'bigint' ? Number(row.id) : Number(row.id);
      
      console.log(`Successfully inserted into compiled_documents table with ID ${compiledDocId}`);
      
      // Associate document IDs with the compiled document if provided
      if (documentIds.length > 0) {
        console.log(`Setting compiled_parent_id for ${documentIds.length} documents to compilation ${compiledDocId}`);
        let successCount = 0;
        let failCount = 0;
        
        for (const docId of documentIds) {
          try {
            // Update the compiled_parent_id in the documents table
            const updateQuery = `
              UPDATE documents 
              SET compiled_parent_id = $1
              WHERE id = $2
            `;
            
            await client.queryObject(updateQuery, [compiledDocId, docId]);
            
            // Also add to the junction table for backward compatibility
            await addDocumentToCompilation(compiledDocId, docId);
            
            successCount++;
          } catch (error) {
            console.error(`Failed to link document ${docId} to compilation ${compiledDocId}:`, error);
            failCount++;
          }
        }
        
        console.log("-------------------------------------------");
        console.log("📊 DATABASE: DOCUMENT LINKING SUMMARY");
        console.log("-------------------------------------------");
        console.log(`✅ Successfully linked: ${successCount} documents`);
        console.log(`❌ Failed to link: ${failCount} documents`);
        console.log("-------------------------------------------");
      } else {
        console.log("No documents to link - skipping parent ID updates");
      }
      
      // Commit the transaction
      await client.queryArray("COMMIT");
      
      return compiledDocId;
    } catch (error) {
      // Rollback in case of any error
      await client.queryArray("ROLLBACK");
      throw error;
    }
  } catch (error) {
    console.error("Error creating compiled document:", error);
    throw error;
  }
}

/**
 * Adds a document to a compilation
 * @param compiledDocId The compiled document ID
 * @param documentId The document ID to add
 */
export async function addDocumentToCompilation(compiledDocId: number, documentId: number): Promise<void> {
  try {
    console.log(`Adding document ${documentId} to compilation ${compiledDocId}`);
    
    // Validate IDs
    if (!compiledDocId || !documentId) {
      throw new Error(`Invalid IDs: compiledDocId=${compiledDocId}, documentId=${documentId}`);
    }
    
    // First check if the relationship already exists
    const checkQuery = `
      SELECT id FROM compiled_document_items 
      WHERE compiled_document_id = $1 AND document_id = $2
    `;
    
    const checkResult = await client.queryObject(checkQuery, [compiledDocId, documentId]);
    
    // Skip insertion if relationship already exists
    if (checkResult.rows.length > 0) {
      console.log(`Document ${documentId} is already part of compilation ${compiledDocId}`);
      return;
    }
    
    // Insert the relationship if it doesn't exist
    const insertQuery = `
      INSERT INTO compiled_document_items (compiled_document_id, document_id)
      VALUES ($1, $2)
      RETURNING id
    `;
    
    const result = await client.queryObject(insertQuery, [compiledDocId, documentId]);
    
    // Check if the insertion was successful
    if (result.rows.length > 0) {
      console.log(`Document ${documentId} successfully added to compilation ${compiledDocId}`);
    } else {
      console.warn(`Failed to add document ${documentId} to compilation ${compiledDocId}`);
    }
  } catch (error) {
    console.error(`Error adding document ${documentId} to compilation ${compiledDocId}:`, error);
    throw error;
  }
}

/**
 * Removes a document from a compilation
 * @param compiledDocId The compiled document ID
 * @param documentId The document ID to remove
 */
export async function removeDocumentFromCompilation(compiledDocId: number, documentId: number): Promise<void> {
  try {
    const deleteQuery = `
      DELETE FROM compiled_document_items
      WHERE compiled_document_id = $1 AND document_id = $2
    `;
    
    await client.queryObject(deleteQuery, [compiledDocId, documentId]);
  } catch (error) {
    console.error(`Error removing document ${documentId} from compilation ${compiledDocId}:`, error);
    throw error;
  }
}

/**
 * Fetches a compiled document by ID
 * @param compiledDocId The compiled document ID
 * @returns The compiled document data
 */
export async function getCompiledDocument(compiledDocId: number): Promise<CompiledDocument | null> {
  try {
    // Get detailed compiled document data with all fields, especially foreword
    const query = `
      SELECT cd.*, 
             COUNT(cdi.document_id) as document_count,
             COALESCE(
               (SELECT title FROM documents WHERE id = cd.id),
               (cd.category || ' Vol. ' || COALESCE(cd.volume::text, '1') || 
                CASE WHEN cd.start_year IS NOT NULL 
                     THEN ' (' || cd.start_year::text || 
                          CASE WHEN cd.end_year IS NOT NULL 
                               THEN '-' || cd.end_year::text 
                               ELSE '' 
                          END || ')'
                     ELSE ''
                END)
             ) as title
      FROM compiled_documents cd
      LEFT JOIN compiled_document_items cdi ON cd.id = cdi.compiled_document_id
      WHERE cd.id = $1
      GROUP BY cd.id
    `;
    
    const result = await client.queryObject(query, [compiledDocId]);
    
    if (result.rows.length === 0) {
      console.log(`No compiled document found with ID ${compiledDocId}`);
      return null;
    }
    
    // Convert the row to CompiledDocument type
    const row = result.rows[0] as Record<string, unknown>;
    
    // Log all fields for debugging
    console.log(`Compiled document data for ID ${compiledDocId}:`, row);
    
    // Create a complete CompiledDocument object including all fields
    const compiledDoc: CompiledDocument = {
      id: typeof row.id === 'bigint' ? Number(row.id) : row.id as number,
      title: row.title as string,
      start_year: row.start_year as number | undefined,
      end_year: row.end_year as number | undefined,
      volume: row.volume as number | undefined,
      issue_number: row.issue_number as number | undefined,
      department: row.department as string | undefined,
      category: row.category as string | undefined,
      foreword: row.foreword as string | undefined,
      abstract_foreword: row.abstract_foreword as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string | undefined,
      document_count: typeof row.document_count === 'bigint' ? Number(row.document_count) : row.document_count as number | undefined
    };
    
    // Log specifically the foreword field to verify it's being retrieved
    if (compiledDoc.foreword) {
      console.log(`Retrieved foreword for document ${compiledDocId}: ${compiledDoc.foreword}`);
    } else {
      console.log(`No foreword found for compiled document ${compiledDocId}`);
    }
    
    // Log the abstract_foreword field as well
    if (compiledDoc.abstract_foreword) {
      console.log(`Retrieved abstract_foreword for document ${compiledDocId}: ${compiledDoc.abstract_foreword.substring(0, 100)}...`);
    } else {
      console.log(`No abstract_foreword found for compiled document ${compiledDocId}`);
    }
    
    return compiledDoc;
  } catch (error) {
    console.error(`Error fetching compiled document with ID ${compiledDocId}:`, error);
    return null;
  }
}

/**
 * Helper function to get the total count of documents
 * @param whereClause SQL WHERE clause for filtering
 * @param params Query parameters
 * @returns Total count of documents
 */
async function getTotalDocumentCount(whereClause: string, params: any[]): Promise<number> {
  // Modified query to exclude child documents of compiled documents
  const docsCountQuery = `
    SELECT COUNT(*) 
    FROM documents d
    ${whereClause}
    AND NOT EXISTS (
      SELECT 1 
      FROM compiled_document_items cdi 
      WHERE cdi.document_id = d.id
    )
  `;
  const docsCountResult = await client.queryObject(docsCountQuery, params);
  const docsCountRow = docsCountResult.rows[0] as Record<string, unknown>;
  const regularDocsCount = parseInt(String(docsCountRow?.count || '0'), 10);
  
  // Count compiled documents separately
  const compiledCountQuery = `
    SELECT COUNT(*) 
    FROM compiled_documents cd
    WHERE deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = cd.id AND d.deleted_at IS NOT NULL)
  `;
  const compiledCountResult = await client.queryObject(compiledCountQuery);
  const compiledCountRow = compiledCountResult.rows[0] as Record<string, unknown>;
  const compiledDocsCount = parseInt(String(compiledCountRow?.count || '0'), 10);
  
  // Return total
  return regularDocsCount + compiledDocsCount;
}

/**
 * Soft deletes a compiled document by setting deleted_at timestamp
 * @param compiledDocId The compiled document ID to soft delete
 * @returns The ID of the soft deleted document
 */
export async function softDeleteCompiledDocument(compiledDocId: number): Promise<number> {
  try {
    // Begin transaction
    await client.queryObject("BEGIN");
    
    // 1. First check if the document exists in the compiled_documents table
    const checkCompiledQuery = `
      SELECT id, category, volume, start_year, end_year, deleted_at 
      FROM compiled_documents 
      WHERE id = $1
    `;
    
    const compiledResult = await client.queryObject(checkCompiledQuery, [compiledDocId]);
    
    if (compiledResult.rows.length === 0) {
      throw new Error(`Compiled document with ID ${compiledDocId} not found in compiled_documents table`);
    }
    
    const compiledData = compiledResult.rows[0] as any;
    
    if (compiledData.deleted_at) {
      throw new Error(`Compiled document with ID ${compiledDocId} is already archived`);
    }
    
    // Get current timestamp for consistency
    const currentTime = new Date();
    
    // 2. Get all child documents for the compiled document from the junction table
    const childDocsQuery = `
      SELECT document_id
      FROM compiled_document_items
      WHERE compiled_document_id = $1
    `;
    
    const childDocsResult = await client.queryObject(childDocsQuery, [compiledDocId]);
    const childDocs = childDocsResult.rows.map((row: any) => row.document_id);
    
    console.log(`Found ${childDocs.length} child documents for compiled document ${compiledDocId}`);
    
    // 3. Mark all child documents as archived and ensure they reference their parent
    if (childDocs.length > 0) {
      const updateChildrenQuery = `
        UPDATE documents
        SET 
          deleted_at = $1,
          compiled_parent_id = $2
        WHERE id = ANY($3::int[])
      `;
      
      await client.queryObject(updateChildrenQuery, [currentTime, compiledDocId, childDocs]);
      console.log(`Archived ${childDocs.length} child documents and set their parent ID to ${compiledDocId}`);
    }
    
    // 4. Update the compiled document record in compiled_documents table
    const updateCompiledQuery = `
      UPDATE compiled_documents
      SET deleted_at = $1
      WHERE id = $2
    `;
    
    await client.queryObject(updateCompiledQuery, [currentTime, compiledDocId]);
    console.log(`Updated deleted_at in compiled_documents table for ID ${compiledDocId}`);
    
    // 5. Check if there's a corresponding entry in the documents table
    // If there is, update it too
    const checkDocumentQuery = `
      SELECT id
      FROM documents
      WHERE id = $1
    `;
    
    const documentResult = await client.queryObject(checkDocumentQuery, [compiledDocId]);
    
    if (documentResult.rows.length > 0) {
      // Document exists in documents table, update it
      const updateDocumentQuery = `
        UPDATE documents
        SET deleted_at = $1
        WHERE id = $2
      `;
      
      await client.queryObject(updateDocumentQuery, [currentTime, compiledDocId]);
      console.log(`Updated deleted_at in documents table for ID ${compiledDocId}`);
    } else {
      // No entry in documents table, we need to create one to ensure proper archive display
      const insertDocumentQuery = `
        INSERT INTO documents (
          id, title, document_type, deleted_at, is_compiled
        ) VALUES (
          $1, 
          (SELECT COALESCE((SELECT title FROM documents WHERE id = $1), 'Compiled Document ' || $1::text)),
          (SELECT category FROM compiled_documents WHERE id = $1),
          $2,
          true
        )
        ON CONFLICT (id) DO UPDATE
        SET 
          deleted_at = $2,
          is_compiled = true
      `;
      
      await client.queryObject(insertDocumentQuery, [compiledDocId, currentTime]);
      console.log(`Created or updated document entry for compiled document ${compiledDocId}`);
    }
    
    // Commit the transaction
    await client.queryObject("COMMIT");
    
    console.log(`Successfully archived compiled document ${compiledDocId} and ${childDocs.length} child documents`);
    
    return compiledDocId;
  } catch (error) {
    // Roll back transaction on error
    try {
      await client.queryObject("ROLLBACK");
    } catch (rollbackError) {
      console.error(`Error rolling back transaction for compiledDocId ${compiledDocId}:`, rollbackError);
    }
    
    console.error(`Error soft deleting compiled document ${compiledDocId}:`, error);
    throw error;
  }
}

/**
 * Updates a compiled document in the database
 * @param compiledDocId The ID of the compiled document to update
 * @param compiledDoc The updated data for the compiled document
 * @returns The updated compiled document
 */
export async function updateCompiledDocument(
  compiledDocId: number,
  compiledDoc: {
    start_year?: number;
    end_year?: number;
    volume?: number;
    issue_number?: number;
    department?: string;
    category?: string;
    foreword?: string;
    abstract_foreword?: string;
    title?: string;
    authors?: any[];
    topics?: any[];
    research_agenda?: any[];
  }
): Promise<CompiledDocument | null> {
  console.log(`Updating compiled document ${compiledDocId} with data:`, compiledDoc);
  
  try {
    // Start a transaction
    await client.queryArray('BEGIN');
    
    // Generate the update query based on provided fields
    let updateQuery = 'UPDATE compiled_documents SET updated_at = CURRENT_TIMESTAMP';
    const params = [];
    let paramIndex = 1;
    
    // Only include fields that are provided in the update
    if (compiledDoc.start_year !== undefined) {
      updateQuery += `, start_year = $${paramIndex}`;
      params.push(compiledDoc.start_year);
      paramIndex++;
    }
    
    if (compiledDoc.end_year !== undefined) {
      updateQuery += `, end_year = $${paramIndex}`;
      params.push(compiledDoc.end_year);
      paramIndex++;
    }
    
    if (compiledDoc.volume !== undefined) {
      updateQuery += `, volume = $${paramIndex}`;
      params.push(compiledDoc.volume);
      paramIndex++;
    }
    
    if (compiledDoc.issue_number !== undefined) {
      updateQuery += `, issue_number = $${paramIndex}`;
      params.push(compiledDoc.issue_number);
      paramIndex++;
    }
    
    if (compiledDoc.department !== undefined) {
      updateQuery += `, department = $${paramIndex}`;
      params.push(compiledDoc.department);
      paramIndex++;
    }
    
    if (compiledDoc.category !== undefined) {
      updateQuery += `, category = $${paramIndex}`;
      params.push(compiledDoc.category);
      paramIndex++;
    }
    
    if (compiledDoc.foreword !== undefined) {
      updateQuery += `, foreword = $${paramIndex}`;
      params.push(compiledDoc.foreword);
      paramIndex++;
    }
    
    if (compiledDoc.abstract_foreword !== undefined) {
      updateQuery += `, abstract_foreword = $${paramIndex}`;
      params.push(compiledDoc.abstract_foreword);
      paramIndex++;
    }
    
    // Add the WHERE clause
    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(compiledDocId);
    
    // Execute the update
    const result = await client.queryObject(updateQuery, params);
    
    if (result.rows.length === 0) {
      // No document was updated, roll back the transaction
      await client.queryArray('ROLLBACK');
      return null;
    }
    
    // Update authors if provided
    if (Array.isArray(compiledDoc.authors) && compiledDoc.authors.length > 0) {
      // First delete existing author associations
      await client.queryArray('DELETE FROM document_authors WHERE document_id = $1', [compiledDocId]);
      
      // Insert new author associations
      for (const author of compiledDoc.authors) {
        if (author && author.id) {
          await client.queryArray(
            'INSERT INTO document_authors (document_id, author_id) VALUES ($1, $2)',
            [compiledDocId, author.id]
          );
        }
      }
    }
    
    // Update research agenda/topics if provided
    if ((Array.isArray(compiledDoc.topics) && compiledDoc.topics.length > 0) ||
        (Array.isArray(compiledDoc.research_agenda) && compiledDoc.research_agenda.length > 0)) {
      // Use either topics or research_agenda, preferring topics
      const topicsToUse = Array.isArray(compiledDoc.topics) ? compiledDoc.topics : 
                         (Array.isArray(compiledDoc.research_agenda) ? compiledDoc.research_agenda : []);
      
      if (topicsToUse.length > 0) {
        // First delete existing topic associations
        await client.queryArray('DELETE FROM document_research_agenda WHERE document_id = $1', [compiledDocId]);
        
        // Insert new topic associations
        for (const topic of topicsToUse) {
          if (topic && topic.id) {
            await client.queryArray(
              'INSERT INTO document_research_agenda (document_id, research_agenda_id) VALUES ($1, $2)',
              [compiledDocId, topic.id]
            );
          }
        }
      }
    }
    
    // Commit the transaction
    await client.queryArray('COMMIT');
    
    // Fetch the updated document with all its relations
    return await getCompiledDocument(compiledDocId);
    
  } catch (error) {
    // Roll back on error
    await client.queryArray('ROLLBACK');
    console.error('Error updating compiled document:', error);
    throw error;
  }
}