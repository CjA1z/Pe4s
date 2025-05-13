import { createCompiledDocument as createCompiledDocumentService, getCompiledDocument as getCompiledDocumentService, addDocumentToCompilation as addDocumentToCompilationService, removeDocumentFromCompilation as removeDocumentFromCompilationService, softDeleteCompiledDocument as softDeleteCompiledDocumentService, updateCompiledDocument as updateCompiledDocumentService } from "../services/documentService.ts";

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
  documentIds: number[]
): Promise<number> {
  return await createCompiledDocumentService(compiledDoc, documentIds);
}

/**
 * Fetches a compiled document by ID
 * @param compiledDocId The compiled document ID
 * @returns The compiled document data
 */
export async function getCompiledDocument(compiledDocId: number): Promise<any> {
  try {
    // Get basic document data
    const compiledDoc = await getCompiledDocumentService(compiledDocId);
    
    if (!compiledDoc) {
      return null;
    }
    
    // Explicitly log the foreword field for debugging
    if (compiledDoc.foreword) {
      console.log(`Compiled document ${compiledDocId} has foreword: ${compiledDoc.foreword}`);
    } else {
      console.log(`Compiled document ${compiledDocId} does not have a foreword`);
    }
    
    return compiledDoc;
  } catch (error) {
    console.error(`Error in getCompiledDocument(${compiledDocId}):`, error);
    throw error;
  }
}

/**
 * Adds a document to a compilation
 * @param compiledDocId The compiled document ID
 * @param documentId The document ID to add
 */
export async function addDocumentToCompilation(compiledDocId: number, documentId: number): Promise<void> {
  await addDocumentToCompilationService(compiledDocId, documentId);
}

/**
 * Removes a document from a compilation
 * @param compiledDocId The compiled document ID
 * @param documentId The document ID to remove
 */
export async function removeDocumentFromCompilation(compiledDocId: number, documentId: number): Promise<void> {
  await removeDocumentFromCompilationService(compiledDocId, documentId);
}

/**
 * HTTP handler for creating a compiled document
 * @param request The HTTP request
 * @returns The HTTP response
 */
export async function handleCreateCompiledDocument(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    
    if (!body.compiledDoc || typeof body.compiledDoc !== 'object') {
      return new Response(JSON.stringify({ error: 'compiledDoc is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Default to empty array if documentIds not provided
    const documentIds = Array.isArray(body.documentIds) ? body.documentIds : [];

    // Log the abstract_foreword field if it's provided
    if (body.compiledDoc.abstract_foreword) {
      console.log(`Received abstract_foreword for new compiled document: ${body.compiledDoc.abstract_foreword.substring(0, 100)}...`);
    }

    const compiledDocId = await createCompiledDocument(body.compiledDoc, documentIds);

    return new Response(JSON.stringify({ id: compiledDocId, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('Error creating compiled document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create compiled document';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * HTTP handler for getting a compiled document by ID
 * @param request The HTTP request
 * @returns The HTTP response
 */
export async function handleGetCompiledDocument(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = parseInt(pathParts[pathParts.length - 1], 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const compiledDoc = await getCompiledDocument(id);
    
    if (!compiledDoc) {
      return new Response(JSON.stringify({ error: 'Compiled document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(compiledDoc), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error(`Error fetching compiled document with ID ${id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch compiled document';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * HTTP handler for adding documents to a compilation
 * @param request The HTTP request
 * @returns The HTTP response
 */
export async function handleAddDocumentsToCompilation(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    
    if (!body.compiledDocumentId || isNaN(parseInt(body.compiledDocumentId, 10))) {
      return new Response(JSON.stringify({ error: 'Valid compiledDocumentId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!Array.isArray(body.documentIds) || body.documentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'documentIds array is required and cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const compiledDocumentId = parseInt(body.compiledDocumentId, 10);
    const results = [];

    // Process each document ID and track results
    for (const docId of body.documentIds) {
      try {
        await addDocumentToCompilation(compiledDocumentId, docId);
        results.push({ documentId: docId, success: true });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : `Failed to add document ${docId}`;
        console.error(`Failed to add document ${docId} to compilation ${compiledDocumentId}:`, error);
        results.push({ documentId: docId, success: false, error: errorMessage });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('Error adding documents to compilation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to add documents to compilation';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * HTTP handler for soft deleting a compiled document by ID
 * @param request The HTTP request
 * @returns The HTTP response
 */
export async function handleSoftDeleteCompiledDocument(request: Request): Promise<Response> {
  if (request.method !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = parseInt(pathParts[pathParts.length - 2], 10); // Get ID from /compiled-documents/:id/soft-delete

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    await softDeleteCompiledDocumentService(id);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Compiled document successfully archived',
      id: id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error(`Error archiving compiled document with ID ${id}:`, error);
    
    // Check for specific errors to return appropriate status codes
    const errorMessage = error instanceof Error ? error.message : 'Failed to archive compiled document';
    
    if (errorMessage.includes('not found')) {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (errorMessage.includes('already archived')) {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Updates an existing compiled document
 * @param compiledDocId The compiled document ID
 * @param compiledDoc The updated compiled document data
 * @returns The updated compiled document data
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
): Promise<any> {
  try {
    // Get the current document to make sure it exists
    const existingDoc = await getCompiledDocumentService(compiledDocId);
    
    if (!existingDoc) {
      throw new Error(`Compiled document with ID ${compiledDocId} not found`);
    }
    
    console.log(`Compiled document data for ID ${compiledDocId}:`, existingDoc);
    
    // Update the document
    const updatedDoc = await updateCompiledDocumentService(compiledDocId, compiledDoc);
    return updatedDoc;
  } catch (error) {
    console.error(`Error in updateCompiledDocument(${compiledDocId}):`, error);
    throw error;
  }
}

/**
 * HTTP handler for updating a compiled document
 * @param request The HTTP request
 * @returns The HTTP response
 */
export async function handleUpdateCompiledDocument(request: Request): Promise<Response> {
  if (request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = parseInt(pathParts[pathParts.length - 1], 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: 'Invalid ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update the document
    const updatedDoc = await updateCompiledDocument(id, body);
    
    return new Response(JSON.stringify({
      success: true,
      document: updatedDoc
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error(`Error updating compiled document with ID ${id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update compiled document';
    
    // Special handling for document not found
    if (errorMessage.includes('not found')) {
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 