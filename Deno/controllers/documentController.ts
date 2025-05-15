import { DocumentModel } from "../models/documentModel.ts";
import type { Request } from "../deps.ts";
import { client } from "../db/denopost_conn.ts";
import { fetchDocuments as fetchDocumentsService, fetchChildDocuments as fetchChildDocumentsService } from "../services/documentService.ts";

/**
 * Fetch categories from the database
 */
export async function fetchCategories(): Promise<Response> {
  try {
    console.log("Fetching categories with document counts including compiled documents");
    
    // Get basic category information
    const categoriesResult = await client.queryObject(
      "SELECT id, category_name as name FROM categories ORDER BY category_name"
    );
    
    // Process the categories data
    const categories = categoriesResult.rows.map(row => {
      return {
        id: typeof (row as any).id === 'bigint' ? Number((row as any).id) : (row as any).id,
        name: (row as any).name || '',
        count: 0 // Initialize count to 0
      };
    });
    
    // Get counts for regular documents (excluding child documents of compilations)
    const regularDocsQuery = `
      SELECT category_id, COUNT(*) as count 
      FROM documents 
      WHERE deleted_at IS NULL 
      AND compiled_parent_id IS NULL
      GROUP BY category_id
    `;
    
    const regularDocsResult = await client.queryObject(regularDocsQuery);
    
    // Update counts from regular documents
    if (regularDocsResult.rows) {
      for (const row of regularDocsResult.rows) {
        const categoryId = typeof (row as any).category_id === 'bigint' ? 
          Number((row as any).category_id) : (row as any).category_id;
        const count = typeof (row as any).count === 'bigint' ? 
          Number((row as any).count) : Number((row as any).count);
        
        // Find the matching category and update its count
        const category = categories.find(c => c.id === categoryId);
        if (category) {
          category.count = count;
        }
      }
    }
    
    // Get counts for compiled documents
    const compiledDocsQuery = `
      SELECT cd.category, COUNT(*) as count 
      FROM compiled_documents cd
      WHERE cd.deleted_at IS NULL
      GROUP BY cd.category
    `;
    
    const compiledDocsResult = await client.queryObject(compiledDocsQuery);
    
    // Update counts from compiled documents
    if (compiledDocsResult.rows) {
      for (const row of compiledDocsResult.rows) {
        const categoryName = ((row as any).category || '').toUpperCase();
        const count = typeof (row as any).count === 'bigint' ? 
          Number((row as any).count) : Number((row as any).count);
        
        // Find categories that match this name (case insensitive)
        for (const category of categories) {
          if (category.name.toUpperCase() === categoryName || 
              categoryName.includes(category.name.toUpperCase())) {
            category.count += count;
            console.log(`Added ${count} compiled documents to category "${category.name}", new total: ${category.count}`);
            break;
          }
        }
      }
    }
    
    return new Response(JSON.stringify(categories), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: unknown) {
    console.error("Error fetching categories:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Handle GET request to fetch documents with filtering and pagination
 * @param request The fetch request object
 * @returns Response object with documents data
 */
export async function fetchDocuments(request: Request): Promise<Response> {
  try {
    console.log("DocumentController: fetchDocuments called");
    
    // Get URL parameters for pagination and filtering
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const size = parseInt(url.searchParams.get("size") || "10");
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const sort = url.searchParams.get("sort") || "latest";
    
    console.log(`Fetching documents with page=${page}, size=${size}, category=${category}, sort=${sort}`);
    
    // ADDITIONAL DEBUGGING: Check if database client is available
    if (!client) {
      console.error("CRITICAL ERROR: Database client is null or undefined in controller");
      return new Response(JSON.stringify({
        error: "Database client is not available",
        documents: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // ADDITIONAL DEBUGGING: Try a simple database query to confirm connection
    try {
      console.log("Testing database connection with a simple query");
      const testResult = await client.queryObject("SELECT 1 as test");
      console.log("Database connection test result:", testResult.rows);
    } catch (testError: unknown) {
      console.error("Database connection test failed:", testError);
      return new Response(JSON.stringify({
        error: "Database connection failed",
        message: testError instanceof Error ? testError.message : String(testError),
        documents: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Convert sort parameter to appropriate order
    let sortField = 'id';
    let order = 'ASC';
    
    if (sort === 'latest') {
      sortField = 'publication_date';
      order = 'DESC';
    } else if (sort === 'earliest') {
      sortField = 'publication_date';
      order = 'ASC';
    }
    
    // Use document service to fetch actual documents with the new interface
    console.log("Calling documentService.fetchDocuments() with options");
    const result = await fetchDocumentsService({
      page,
      limit: size,
      category,
      search,
      sort: sortField,
      order
    });
    
    console.log(`Documents fetched: ${result.documents.length} documents found`);
    
    // Check if we received fewer documents than expected
    if (result.documents.length === 0 && result.totalCount > 0) {
      console.warn("No documents returned despite totalCount > 0. This might indicate a database issue.");
    }
    
    // Add structured debug info to the response for troubleshooting
    const responseWithDebug = {
      ...result,
      _debug: {
        requestParams: {
          page, size, category, sort
        },
        timestamp: new Date().toISOString(),
        source: "documentController.ts"
      }
    };
    
    // Create and return response
    return new Response(JSON.stringify(responseWithDebug), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    console.error("Error in document controller:", error);
    
    // Return error response
    return new Response(JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Get a document by ID
 */
export async function getDocumentById(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const documentId = path.split("/").pop();
    
    if (!documentId) {
      return new Response(JSON.stringify({ error: "Document ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Check if this is a guest request
    const isGuestRequest = url.searchParams.get("guest") === "true";
    
    console.log(`Fetching document with ID: ${documentId}, isGuestRequest: ${isGuestRequest}`);
    
    // Validate document ID is a number
    const docIdNum = parseInt(documentId);
    if (isNaN(docIdNum)) {
      return new Response(JSON.stringify({ error: "Invalid document ID. ID must be a valid integer." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get the document from the database
    const document = await DocumentModel.getById(docIdNum);
    
    if (!document) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // If this is a guest request, check if the document is public
    if (isGuestRequest && !document.is_public) {
      console.log(`Guest requested non-public document: ${documentId}`);
      return new Response(JSON.stringify({ error: "Document is not available for guest viewing" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Fetch author information
    let authors: Array<any> = [];
    try {
      const authorsResult = await client.queryObject(
        `SELECT a.*
         FROM authors a
         JOIN document_authors da ON a.id = da.author_id
         WHERE da.document_id = $1
         ORDER BY da.author_order`,
        [docIdNum]
      );
      
      authors = authorsResult.rows.map((row: any) => ({
        id: row.id,
        full_name: row.full_name,
        affiliation: row.affiliation,
        department: row.department,
        email: row.email,
        orcid_id: row.orcid_id
      }));
      
      console.log(`Found ${authors.length} authors for document ${documentId}`);
    } catch (authorError) {
      console.warn(`Error fetching authors for document ${documentId}:`, authorError);
    }
    
    // Fetch keywords from research_agenda tables
    let keywords: string[] = document.keywords || [];
    try {
      console.log(`Fetching keywords for document ID ${docIdNum} from research_agenda`);
      const keywordsResult = await client.queryObject(
        `SELECT ra.id, ra.name
         FROM research_agenda ra
         JOIN document_research_agenda dra ON ra.id = dra.research_agenda_id
         WHERE dra.document_id = $1`,
        [docIdNum]
      );
      
      if (keywordsResult.rows.length > 0) {
        console.log(`Found ${keywordsResult.rows.length} research agenda entries`);
        
        // Extract keywords from research agenda entries
        // Simply use the research agenda names as keywords
        for (const row of keywordsResult.rows as Array<{
          id?: number;
          name?: string;
        }>) {
          // Add the agenda name itself as a keyword if not already included
          if (row.name && !keywords.includes(row.name)) {
            keywords.push(row.name);
          }
        }
        
        // Remove duplicates
        keywords = [...new Set(keywords)];
        console.log(`Extracted keywords for document ${documentId}:`, keywords);
      } else {
        console.log(`No research agenda entries found for document ${documentId}`);
      }
    } catch (keywordsError) {
      console.warn(`Error fetching keywords for document ${documentId}:`, keywordsError);
    }
    
    // Extract publication year from publication_date if available
    let publicationYear = document.publication_year || "";
    if (document.publication_date && !publicationYear) {
      try {
        publicationYear = new Date(document.publication_date).getFullYear().toString();
      } catch (dateError) {
        console.warn(`Error extracting year from publication_date:`, dateError);
      }
    }
    
    // Prepare the response with enhanced data
    const enhancedDocument = {
      ...document,
      enhancedAuthors: authors.length > 0 ? authors : undefined,
      publication_year: publicationYear,
      keywords: keywords
    };
    
    return new Response(JSON.stringify(enhancedDocument), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error getting document by ID:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Create a new document
 */
export async function createDocument(req: Request): Promise<Response> {
  try {
    if (req.body) {
      const body = await req.json();
      
      // Validate required fields
      if (!body.title) {
        return new Response(JSON.stringify({ error: "Title is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Validate document_type against known types
      const validDocumentTypes = ['THESIS', 'DISSERTATION', 'CONFLUENCE', 'SYNERGY', 'HELLO'];
      if (body.document_type && !validDocumentTypes.includes(body.document_type)) {
        return new Response(JSON.stringify({ 
          error: `Invalid document_type. Must be one of: ${validDocumentTypes.join(', ')}` 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // Set appropriate file paths based on document type if not already set
      if (!body.file_path && body.document_type) {
        switch (body.document_type) {
          case 'THESIS':
            body.file_path = 'storage/thesis/';
            break;
          case 'DISSERTATION':
            body.file_path = 'storage/dissertation/';
            break;
          case 'CONFLUENCE':
            body.file_path = 'storage/confluence/';
            break;
          case 'SYNERGY':
            body.file_path = 'storage/synergy/';
            break;
          case 'HELLO':
            body.file_path = 'storage/hello/';
            break;
          default:
            body.file_path = 'storage/hello/';
        }
      }
      
      // For single documents (THESIS or DISSERTATION), we don't include volume and issue
      if (body.document_type === 'THESIS' || body.document_type === 'DISSERTATION') {
        // Remove volume and issue if they exist
        delete body.volume;
        delete body.issue;
      }

      // For Synergy documents, ensure issue is null and department_id is used
      if (body.document_type === 'SYNERGY') {
        // Always set issue to null for Synergy documents
        body.issue = null;
        
        // Make sure department_id is present
        if (!body.department_id) {
          console.warn('SYNERGY document created without department_id');
        }
      }

      // For research studies in compiled documents, set appropriate category_id if not already set
      if (body.document_type === 'HELLO' && body.parent_document_id && !body.category_id) {
        body.category_id = 5; // Default research study category ID
      }
      
      console.log('Creating document with data:', JSON.stringify(body, null, 2));
      const newDocument = await DocumentModel.create(body);
      
      return new Response(JSON.stringify(newDocument), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Error creating document:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Update an existing document
 */
export async function updateDocument(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const documentId = path.split("/").pop();
    
    if (!documentId) {
      return new Response(JSON.stringify({ error: "Document ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Validate documentId is a valid number
    if (isNaN(Number(documentId)) || !Number.isInteger(Number(documentId))) {
      return new Response(JSON.stringify({ error: "Invalid document ID. ID must be a valid integer." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (req.body) {
      const body = await req.json();
      
      // Check if document exists
      const existingDocument = await DocumentModel.getById(parseInt(documentId));
      
      if (!existingDocument) {
        return new Response(JSON.stringify({ error: "Document not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      const updatedDocument = await DocumentModel.update(parseInt(documentId), body);
      
      return new Response(JSON.stringify(updatedDocument), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Error updating document:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Delete a document (soft delete)
 */
export async function deleteDocument(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const documentId = path.split("/").pop();
    
    if (!documentId) {
      return new Response(JSON.stringify({ error: "Document ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Validate documentId is a valid number
    if (isNaN(Number(documentId)) || !Number.isInteger(Number(documentId))) {
      return new Response(JSON.stringify({ error: "Invalid document ID. ID must be a valid integer." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Check if document exists
    const existingDocument = await DocumentModel.getById(parseInt(documentId));
    
    if (!existingDocument) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    await DocumentModel.delete(parseInt(documentId));
    
    return new Response(JSON.stringify({ message: "Document deleted successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get child documents for a compiled document
 * @param req - The request object
 * @returns Response with child documents
 */
export async function getChildDocuments(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const matches = path.match(/\/api\/documents\/(\d+)\/children/);
    
    if (!matches || !matches[1]) {
      return new Response(JSON.stringify({ error: "Invalid document ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const documentIdStr = matches[1];
    
    // Validate documentId is a valid number
    if (isNaN(Number(documentIdStr)) || !Number.isInteger(Number(documentIdStr))) {
      return new Response(JSON.stringify({ error: "Invalid document ID. ID must be a valid integer." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const documentId = parseInt(documentIdStr);
    console.log(`Controller: Fetching child documents for parent ID: ${documentId}`);
    
    const result = await fetchChildDocumentsService(documentId);
    
    // Create a safe version of the documents to avoid serialization issues
    const safeDocuments = [];
    
    for (const doc of result.documents) {
      // Create a basic safe document object
      const safeDoc: Record<string, any> = {
        id: doc.id,
        title: typeof doc.title === 'string' ? doc.title : '',
        description: typeof doc.description === 'string' ? doc.description : '',
        document_type: typeof doc.document_type === 'string' ? doc.document_type : '',
        volume: typeof doc.volume === 'string' ? doc.volume : '',
        issue: typeof doc.issue === 'string' ? doc.issue : '',
        is_compiled: Boolean(doc.is_compiled),
        parent_compiled_id: doc.parent_compiled_id
      };
      
      // Handle date carefully
      if (doc.publication_date instanceof Date) {
        safeDoc.publication_date = doc.publication_date.toISOString();
      } else {
        safeDoc.publication_date = null;
      }
      
      // Handle authors array
      safeDoc.authors = [];
      if (Array.isArray(doc.authors)) {
        for (const author of doc.authors) {
          if (author && typeof author === 'object') {
            safeDoc.authors.push({
              id: author.id,
              full_name: typeof author.full_name === 'string' ? author.full_name : ''
            });
          }
        }
      }
      
      // Handle topics array
      safeDoc.topics = [];
      if (Array.isArray(doc.topics)) {
        for (const topic of doc.topics) {
          if (topic && typeof topic === 'object') {
            safeDoc.topics.push({
              id: topic.id,
              name: typeof topic.name === 'string' ? topic.name : ''
            });
          }
        }
      }
      
      safeDocuments.push(safeDoc);
    }
    
    // Create the final response object
    const responseObject = {
      documents: safeDocuments
    };
    
    return new Response(JSON.stringify(responseObject), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(`Error fetching child documents:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: "Error fetching child documents",
      message: errorMessage
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get authors for a document
 */
export async function getDocumentAuthors(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const parts = path.split('/');
    const documentId = parts[parts.length - 2]; // Get the ID from the URL path
    
    if (!documentId) {
      return new Response(JSON.stringify({ error: "Document ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log(`Fetching authors for document ID: ${documentId}`);
    
    // Validate document ID is a number
    const docIdNum = parseInt(documentId);
    if (isNaN(docIdNum)) {
      return new Response(JSON.stringify({ error: "Invalid document ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Query to fetch authors for this document
    const authorsResult = await client.queryObject(
      `SELECT a.*
       FROM authors a
       JOIN document_authors da ON a.id = da.author_id
       WHERE da.document_id = $1
       ORDER BY da.author_order`,
      [docIdNum]
    );
    
    const authors = authorsResult.rows.map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      affiliation: row.affiliation,
      department: row.department,
      email: row.email,
      orcid_id: row.orcid_id
    }));
    
    return new Response(JSON.stringify({ 
      success: true,
      authors: authors
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error getting document authors:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}