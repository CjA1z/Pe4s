import { Route } from "./index.ts";
import { RouterContext } from "../deps.ts";
import { 
    handleFetchDocuments, 
    handleDocumentById, 
    handleCreateDocument,
    handleUpdateDocument,
    handleDeleteDocument,
    handleHardDeleteDocument
} from "../api/document.ts";
import { DocumentModel } from "../models/documentModel.ts";
import { UserDocumentHistoryModel } from "../models/userDocumentHistoryModel.ts";
import { verifySessionToken } from "../utils/sessionUtils.ts";
import { client } from "../db/denopost_conn.ts";

// Document route handlers
const getDocuments = async (ctx: RouterContext<any, any, any>) => {
    // Convert context to Request
    const request = new Request(ctx.request.url.toString(), {
        method: ctx.request.method,
        headers: ctx.request.headers
    });
    
    const response = await handleFetchDocuments(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

const getDocumentById = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/documents/${id}`, {
        method: "GET",
        headers: ctx.request.headers
    });
    
    const response = await handleDocumentById(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

// Guest document handler - serves limited document information for guest pages
const getGuestDocumentById = async (ctx: RouterContext<any, any, any>) => {
    try {
        const id = ctx.params.id;
        
        // Validate ID is numeric
        const numericId = parseInt(id);
        if (isNaN(numericId)) {
            ctx.response.status = 400;
            ctx.response.body = { 
                success: false, 
                message: "Invalid document ID. ID must be a valid integer." 
            };
            return;
        }

        // Get document from the database
        const document = await DocumentModel.getById(numericId);
        
        if (!document) {
            ctx.response.status = 404;
            ctx.response.body = { 
                success: false, 
                message: "Document not found" 
            };
            return;
        }

        // Get document authors from the document_authors relationship table
        let authorText = "";
        try {
            // Query to fetch authors for this document
            const authorsResult = await client.queryObject(
                `SELECT a.full_name 
                 FROM authors a
                 JOIN document_authors da ON a.id = da.author_id
                 WHERE da.document_id = $1
                 ORDER BY da.author_order`,
                [numericId]
            );
            
            if (authorsResult.rows.length > 0) {
                // Format authors as a comma-separated string
                authorText = authorsResult.rows
                    .map((row: any) => row.full_name)
                    .join(", ");
            } else {
                // Fallback to document.author field if available
                authorText = document.author || "Unknown Author";
            }
        } catch (error) {
            console.error(`Error fetching authors for document ID ${numericId}:`, error);
            // Fallback to document.author field
            authorText = document.author || "Unknown Author";
        }
        
        // Get research agenda keywords
        let keywords = document.keywords || [];
        try {
            // Query to fetch keywords from research_agenda
            const keywordsResult = await client.queryObject(
                `SELECT ra.id, ra.name
                 FROM research_agenda ra
                 JOIN document_research_agenda dra ON ra.id = dra.research_agenda_id
                 WHERE dra.document_id = $1`,
                [numericId]
            );
            
            if (keywordsResult.rows.length > 0) {
                console.log(`Found ${keywordsResult.rows.length} research agenda entries for guest doc ${numericId}`);
                
                // Simply use research agenda names as keywords
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
            }
        } catch (error) {
            console.error(`Error fetching keywords for document ID ${numericId}:`, error);
        }
        
        // Handle publication year - extract from publication_date if available
        let publicationYear = "";
        if (document.publication_date) {
            publicationYear = new Date(document.publication_date).getFullYear().toString();
        } else if (document.publication_year) {
            publicationYear = document.publication_year;
        }

        // Define document result type that includes possible contained_documents
        type DocumentResult = {
            doc_id: number;
            id: number;
            title: string;
            author: string;
            abstract: string;
            publication_year: string;
            keywords: string[];
            category: string;
            volume: string;
            pages: string | number;
            research_agenda: string;
            date_uploaded: Date | undefined;
            editor: any;
            contained_documents?: Array<{
                doc_id: number;
                id: number;
                title: string;
                author: string;
                abstract: string;
                keywords: string[];
            }>;
        };

        // Convert to the format expected by the frontend
        const result = {
            success: true,
            document: {
                doc_id: document.id, // Map id to doc_id to match frontend expectations
                id: document.id,
                title: document.title || "Untitled Document",
                author: authorText,
                abstract: document.abstract || "",
                publication_year: publicationYear,
                keywords: keywords,
                category: document.category || "",
                volume: document.volume || "",
                pages: document.pages || "",
                research_agenda: document.research_agenda || "",
                date_uploaded: document.created_at,
                editor: document.editor || null
                // Note: Not including sensitive fields like file_path
            } as DocumentResult
        };

        // If this is a compiled document, try to get the contained documents
        if (document.is_compiled) {
            try {
                // Fetch contained documents (implementation depends on your database schema)
                // This is a simplified example - adjust according to your actual data model
                const containedDocuments = await DocumentModel.getContainedDocuments(numericId);
                
                if (containedDocuments && containedDocuments.length > 0) {
                    // Process each contained document to include author information
                    const processedDocuments = [];
                    
                    for (const doc of containedDocuments) {
                        // Get authors for this contained document
                        let childAuthorText = "";
                        try {
                            const childAuthorsResult = await client.queryObject(
                                `SELECT a.full_name 
                                 FROM authors a
                                 JOIN document_authors da ON a.id = da.author_id
                                 WHERE da.document_id = $1
                                 ORDER BY da.author_order`,
                                [doc.id]
                            );
                            
                            if (childAuthorsResult.rows.length > 0) {
                                // Format authors as a comma-separated string
                                childAuthorText = childAuthorsResult.rows
                                    .map((row: any) => row.full_name)
                                    .join(", ");
                            } else {
                                // Fallback to document.author field if available
                                childAuthorText = doc.author || "Unknown Author";
                            }
                        } catch (error) {
                            console.error(`Error fetching authors for contained document ID ${doc.id}:`, error);
                            // Fallback to document.author field
                            childAuthorText = doc.author || "Unknown Author";
                        }
                        
                        processedDocuments.push({
                            doc_id: doc.id,
                            id: doc.id,
                            title: doc.title || "Untitled Document",
                            author: childAuthorText,
                            abstract: doc.abstract || "",
                            keywords: doc.keywords || []
                        });
                    }
                    
                    result.document.contained_documents = processedDocuments;
                }
            } catch (error) {
                console.error(`Error fetching contained documents for ID ${id}:`, error);
                // Continue without contained documents
            }
        }

        ctx.response.status = 200;
        ctx.response.body = result;
    } catch (error) {
        console.error(`Error in getGuestDocumentById for ID ${ctx.params.id}:`, error);
        ctx.response.status = 500;
        ctx.response.body = { 
            success: false, 
            message: "Internal server error" 
        };
    }
};

// Document authors handler - returns author information for a document
const getDocumentAuthorsById = async (ctx: RouterContext<any, any, any>) => {
    try {
        const id = ctx.params.id;
        
        // Validate ID is numeric
        const numericId = parseInt(id);
        if (isNaN(numericId)) {
            ctx.response.status = 400;
            ctx.response.body = { 
                success: false, 
                message: "Invalid document ID. ID must be a valid integer." 
            };
            return;
        }

        // Query to fetch authors for this document
        const authorsResult = await client.queryObject(
            `SELECT a.*
             FROM authors a
             JOIN document_authors da ON a.id = da.author_id
             WHERE da.document_id = $1
             ORDER BY da.author_order`,
            [numericId]
        );
        
        const authors = authorsResult.rows.map((row: any) => ({
            id: row.id,
            full_name: row.full_name,
            affiliation: row.affiliation,
            department: row.department,
            email: row.email,
            orcid_id: row.orcid_id
        }));
        
        ctx.response.status = 200;
        ctx.response.body = { 
            success: true,
            authors: authors
        };
    } catch (error) {
        console.error(`Error in getDocumentAuthorsById for ID ${ctx.params.id}:`, error);
        ctx.response.status = 500;
        ctx.response.body = { 
            success: false, 
            message: "Internal server error" 
        };
    }
};

// Handler for the /api/public/documents/:id endpoint
const getPublicDocumentById = async (ctx: RouterContext<any, any, any>) => {
    try {
        const id = ctx.params.id;
        
        // Validate ID is numeric
        const numericId = parseInt(id);
        if (isNaN(numericId)) {
            ctx.response.status = 400;
            ctx.response.body = { 
                success: false, 
                message: "Invalid document ID. ID must be a valid integer." 
            };
            return;
        }

        // Get document from the database, only if it's public
        const document = await DocumentModel.getById(numericId);
        
        if (!document) {
            ctx.response.status = 404;
            ctx.response.body = { 
                success: false, 
                message: "Document not found" 
            };
            return;
        }

        // Check if document is public
        if (!document.is_public) {
            ctx.response.status = 403;
            ctx.response.body = { 
                success: false, 
                message: "This document is not public" 
            };
            return;
        }

        // Get document authors from the document_authors relationship table
        let authorText = "";
        try {
            // Query to fetch authors for this document
            const authorsResult = await client.queryObject(
                `SELECT a.full_name 
                 FROM authors a
                 JOIN document_authors da ON a.id = da.author_id
                 WHERE da.document_id = $1
                 ORDER BY da.author_order`,
                [numericId]
            );
            
            if (authorsResult.rows.length > 0) {
                // Format authors as a comma-separated string
                authorText = authorsResult.rows
                    .map((row: any) => row.full_name)
                    .join(", ");
            } else {
                // Fallback to document.author field if available
                authorText = document.author || "Unknown Author";
            }
        } catch (error) {
            console.error(`Error fetching authors for document ID ${numericId}:`, error);
            // Fallback to document.author field
            authorText = document.author || "Unknown Author";
        }
        
        // Handle publication year - extract from publication_date if available
        let publicationYear = "";
        if (document.publication_date) {
            publicationYear = new Date(document.publication_date).getFullYear().toString();
        } else if (document.publication_year) {
            publicationYear = document.publication_year;
        }

        // Get research agenda keywords
        let keywords = document.keywords || [];
        try {
            // Query to fetch keywords from research_agenda
            const keywordsResult = await client.queryObject(
                `SELECT ra.id, ra.name
                 FROM research_agenda ra
                 JOIN document_research_agenda dra ON ra.id = dra.research_agenda_id
                 WHERE dra.document_id = $1`,
                [numericId]
            );
            
            if (keywordsResult.rows.length > 0) {
                console.log(`Found ${keywordsResult.rows.length} research agenda entries for public doc ${numericId}`);
                
                // Simply use research agenda names as keywords
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
            }
        } catch (error) {
            console.error(`Error fetching keywords for public document ID ${numericId}:`, error);
        }

        // Return the document with limited fields
        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            document: {
                doc_id: document.id,
                id: document.id,
                title: document.title || "Untitled Document",
                author: authorText,
                abstract: document.abstract || "",
                publication_year: publicationYear,
                keywords: keywords,
                category: document.category || "",
                volume: document.volume || "",
                pages: document.pages || "",
                research_agenda: document.research_agenda || "",
                date_uploaded: document.created_at,
                editor: document.editor || null
            }
        };
    } catch (error) {
        console.error(`Error in getPublicDocumentById for ID ${ctx.params.id}:`, error);
        ctx.response.status = 500;
        ctx.response.body = { 
            success: false, 
            message: "Internal server error" 
        };
    }
};

// Document Creation
const createDocument = async (ctx: RouterContext<any, any, any>) => {
    const bodyParser = await ctx.request.body({type: "json"});
    const body = await bodyParser.value;
    
    // Convert context to Request
    const request = new Request(ctx.request.url.toString(), {
        method: "POST",
        headers: ctx.request.headers,
        body: JSON.stringify(body)
    });
    
    const response = await handleCreateDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

// Update Document
const updateDocument = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    let body;
    let contentType = '';
    
    // Check content type from request headers
    const contentTypeHeader = ctx.request.headers.get('content-type') || '';
    contentType = contentTypeHeader.split(';')[0].toLowerCase();
    
    // Process body based on content type
    if (contentType === 'application/json') {
        const bodyParser = await ctx.request.body({type: "json"});
        body = await bodyParser.value;
        
        // Convert context to Request
        const request = new Request(`${ctx.request.url.origin}/api/documents/${id}`, {
            method: "PUT",
            headers: ctx.request.headers,
            body: JSON.stringify(body)
        });
        
        const response = await handleUpdateDocument(request);
        
        // Convert Response back to context
        ctx.response.status = response.status;
        ctx.response.headers = response.headers;
        ctx.response.body = await response.json();
    } else if (contentType === 'multipart/form-data') {
        try {
            // Handle multipart/form-data
            const bodyParser = await ctx.request.body({type: "form-data"});
            const formData = await bodyParser.value.read();
            
            // Convert form data to a format the API can handle
            const formDataObj: Record<string, any> = {};
            
            // Process form fields
            if (formData.fields) {
                for (const [key, value] of Object.entries(formData.fields)) {
                    // Try to parse JSON strings in form data
                    try {
                        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
                            formDataObj[key] = JSON.parse(value);
                        } else {
                            formDataObj[key] = value;
                        }
                    } catch {
                        formDataObj[key] = value;
                    }
                }
            }
            
            // Add any files from form data
            if (formData.files && Array.isArray(formData.files)) {
                formDataObj.files = formData.files;
            }
            
            // Convert context to Request
            const request = new Request(`${ctx.request.url.origin}/api/documents/${id}`, {
                method: "PUT",
                headers: new Headers({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(formDataObj)
            });
            
            const response = await handleUpdateDocument(request);
            
            // Convert Response back to context
            ctx.response.status = response.status;
            ctx.response.headers = response.headers;
            ctx.response.body = await response.json();
        } catch (e) {
            const error = e as Error;
            console.error("Error processing multipart/form-data:", error);
            ctx.response.status = 400;
            ctx.response.body = { error: "Error processing form data: " + error.message };
        }
    } else {
        // Default to JSON for backward compatibility
        try {
            const bodyParser = await ctx.request.body({type: "json"});
            body = await bodyParser.value;
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/documents/${id}`, {
        method: "PUT",
        headers: ctx.request.headers,
        body: JSON.stringify(body)
    });
    
    const response = await handleUpdateDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
        } catch (e) {
            const error = e as Error;
            console.error("Error processing request body:", error);
            ctx.response.status = 400;
            ctx.response.body = { error: "Invalid request format: " + error.message };
        }
    }
};

// Document Deletion
const deleteDocument = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/documents/${id}`, {
        method: "DELETE",
        headers: ctx.request.headers
    });
    
    const response = await handleDeleteDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

// Hard Delete Document
const hardDeleteDocument = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/documents/${id}/hard-delete`, {
        method: "DELETE",
        headers: ctx.request.headers
    });
    
    const response = await handleHardDeleteDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

// Document download handler
const downloadDocument = async (ctx: RouterContext<any, any, any>) => {
    try {
        const id = ctx.params.id;
        
        if (!id) {
            ctx.response.status = 400;
            ctx.response.body = { error: "Document ID is required" };
            return;
        }
        
        // Verify user authentication (check the token)
        const token = ctx.request.url.searchParams.get("token");
        console.log(`🔍 Download endpoint hit:  ${ctx.request.url}`);
        console.log(`🔍 Download requested for document ID: ${id}`);
        console.log(`🔍 Token present: ${!!token}`);
        
        if (!token) {
            ctx.response.status = 401;
            ctx.response.body = { error: "Authentication token required" };
            return;
        }
        
        // Verify the token and get user info
        const sessionData = await verifySessionToken(token);
        if (!sessionData) {
            ctx.response.status = 401;
            ctx.response.body = { error: "Invalid or expired token" };
            return;
        }
        
        // Get the document's file path
        console.log(`🔍 Fetching file path for document ID: ${id}`);
        const filePath = await DocumentModel.getDocumentPath(id);
        console.log(`🔍 File path result: ${filePath}`);
        
        if (!filePath) {
            ctx.response.status = 404;
            ctx.response.body = { error: "Document not found" };
            return;
        }
        
        // Check if file exists
        console.log(`🔍 Checking if file exists at: ${filePath}`);
        try {
            const fileInfo = await Deno.stat(filePath);
            if (!fileInfo.isFile) {
                throw new Error("Not a file");
            }
            
            // RECORD THE DOWNLOAD IN HISTORY - Do this right before serving the file
            // This ensures we only record successful downloads
            const success = await UserDocumentHistoryModel.recordAction(
                sessionData.id,
                parseInt(id),
                "DOWNLOAD"
            );
            
            if (success) {
                console.log(`✅ Download recorded for user ${sessionData.id}, document ${id}`);
            } else {
                console.warn(`⚠️ Failed to record download for user ${sessionData.id}, document ${id}`);
            }
            
        } catch (error) {
            console.error(`❌ Error checking file at path ${filePath}:`, error);
            ctx.response.status = 404;
            ctx.response.body = { error: "File not found on server" };
            return;
        }
        
        // Get file name for the content-disposition header
        const fileName = filePath.split("/").pop() || `document-${id}`;
        
        // Determine content type based on file extension
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
        let contentType = 'application/octet-stream';
        
        if (fileExt === 'pdf') {
            contentType = 'application/pdf';
        } else if (['doc', 'docx'].includes(fileExt)) {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (['xls', 'xlsx'].includes(fileExt)) {
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (['jpg', 'jpeg'].includes(fileExt)) {
            contentType = 'image/jpeg';
        } else if (fileExt === 'png') {
            contentType = 'image/png';
        }
        
        // Set headers for file download
        ctx.response.headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
        ctx.response.headers.set("Content-Type", contentType);
        
        // Stream the file
        const fileContent = await Deno.readFile(filePath);
        ctx.response.body = fileContent;
        
    } catch (error) {
        console.error("Error downloading document:", error);
        ctx.response.status = 500;
        ctx.response.body = { 
            error: "Failed to download document",
            details: error instanceof Error ? error.message : String(error)
        };
    }
};

// Add this new route for document file verification
const verifyDocumentFile = async (ctx: RouterContext<any, any, any>) => {
    try {
        const documentId = ctx.params?.id;
        if (!documentId) {
            ctx.response.status = 400;
            ctx.response.body = { 
                success: false, 
                message: "Document ID is required" 
            };
            return;
        }
        
        // Get the file path from document ID
        console.log(`[DOCUMENT API] Verifying file for document ID: ${documentId}`);
        const filePath = await DocumentModel.getDocumentPath(documentId);
        
        if (!filePath) {
            ctx.response.status = 404;
            ctx.response.body = { 
                success: false, 
                message: "No file path found for document",
                documentId
            };
            return;
        }
        
        console.log(`[DOCUMENT API] File path from database: ${filePath}`);
        
        // Check if file exists at the path
        let fileExists = false;
        let fileSize = 0;
        let fileError = null;
        
        try {
            const fileInfo = await Deno.stat(filePath);
            fileExists = true;
            fileSize = fileInfo.size;
            console.log(`[DOCUMENT API] File exists at path: ${filePath} (${fileSize} bytes)`);
        } catch (error) {
            fileError = error instanceof Error ? error.message : String(error);
            console.error(`[DOCUMENT API] File does not exist at path: ${filePath}`, error);
            
            // Try more alternative paths with better detailed logging
            console.log(`[DOCUMENT API] Current working directory: ${Deno.cwd()}`);
            
            // Get more information about the document from the database
            try {
                const docDetailsResult = await client.queryObject(
                    "SELECT title, document_type FROM documents WHERE id = $1",
                    [documentId]
                );
                
                if (docDetailsResult.rows.length > 0) {
                    const docDetails = docDetailsResult.rows[0] as { title: string, document_type: string };
                    console.log(`[DOCUMENT API] Document details: Title=${docDetails.title}, Type=${docDetails.document_type}`);
                }
            } catch (dbError) {
                console.error(`[DOCUMENT API] Error fetching document details: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
            }
            
            // Try alternative paths
            const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
            
            const alternativePaths = [
                // Try without leading slash
                filePath.replace(/^\//, ''),
                // Try with storage prefix
                `${workspaceRoot}/storage/${filePath.replace(/^\/?(storage\/)?/, '')}`,
                // Try relative to workspace root
                `${workspaceRoot}/${filePath.replace(/^\//, '')}`,
                // Try with file name only in various storage locations
                `${workspaceRoot}/storage/thesis/${fileName}`,
                `${workspaceRoot}/storage/dissertation/${fileName}`,
                `${workspaceRoot}/storage/confluence/${fileName}`,
                `${workspaceRoot}/storage/synergy/${fileName}`,
                // Try with Windows path format
                filePath.replace(/\//g, '\\'),
                // Try finding any file with similar name pattern in thesis folder
                ...(fileName.includes('_') ? [`${workspaceRoot}/storage/thesis/${fileName.split('_')[0]}_*.file`] : [])
            ];
            
            console.log(`[DOCUMENT API] Trying these alternative paths:`);
            for (const [i, path] of alternativePaths.entries()) {
                console.log(`  [${i+1}] ${path}`);
            }
            
            // Special case for wildcard patterns
            const wildcardPaths = alternativePaths.filter(p => p.includes('*'));
            for (const wildcardPath of wildcardPaths) {
                try {
                    const dirPath = wildcardPath.substring(0, wildcardPath.lastIndexOf('/'));
                    const pattern = wildcardPath.substring(wildcardPath.lastIndexOf('/') + 1);
                    console.log(`[DOCUMENT API] Checking for pattern ${pattern} in directory ${dirPath}`);
                    
                    try {
                        for await (const entry of Deno.readDir(dirPath)) {
                            if (entry.isFile && new RegExp(pattern.replace('*', '.*')).test(entry.name)) {
                                const matchedPath = `${dirPath}/${entry.name}`;
                                console.log(`[DOCUMENT API] Found matching file with pattern: ${matchedPath}`);
                                
                                try {
                                    const matchedFileInfo = await Deno.stat(matchedPath);
                                    fileExists = true;
                                    fileSize = matchedFileInfo.size;
                                    console.log(`[DOCUMENT API] Pattern match exists: ${matchedPath} (${fileSize} bytes)`);
                                    
                                    // Return the correct path for the attachment
                                    ctx.response.body = {
                                        success: true,
                                        documentId,
                                        filePath: matchedPath,
                                        fileSize,
                                        originalPath: filePath,
                                        message: "File found via pattern matching"
                                    };
                                    return;
                                } catch (err) {
                                    console.log(`[DOCUMENT API] Error checking pattern match: ${err instanceof Error ? err.message : String(err)}`);
                                }
                            }
                        }
                    } catch (readDirErr) {
                        console.log(`[DOCUMENT API] Error reading directory for pattern: ${readDirErr instanceof Error ? readDirErr.message : String(readDirErr)}`);
                    }
                } catch (patternErr) {
                    console.log(`[DOCUMENT API] Error with wildcard pattern: ${patternErr instanceof Error ? patternErr.message : String(patternErr)}`);
                }
            }
            
            // Try exact paths
            for (const altPath of alternativePaths.filter(p => !p.includes('*'))) {
                try {
                    const altFileInfo = await Deno.stat(altPath);
                    fileExists = true;
                    fileSize = altFileInfo.size;
                    console.log(`[DOCUMENT API] Alternative path exists: ${altPath} (${fileSize} bytes)`);
                    
                    // Return the correct path for the attachment
                    ctx.response.body = {
                        success: true,
                        documentId,
                        filePath: altPath,
                        fileSize,
                        originalPath: filePath,
                        message: "File found at alternative path"
                    };
                    return;
                } catch (altError) {
                    console.log(`[DOCUMENT API] Alternative path failed: ${altPath}`);
                }
            }
            
            // Check existence of storage directories
            try {
                const storageRootInfo = await Deno.stat(`${workspaceRoot}/storage`);
                console.log(`[DOCUMENT API] Storage root exists: ${storageRootInfo.isDirectory ? 'Yes (directory)' : 'No (not a directory)'}`);
                
                const storageTypes = ['thesis', 'dissertation', 'confluence', 'synergy'];
                for (const type of storageTypes) {
                    try {
                        const typeInfo = await Deno.stat(`${workspaceRoot}/storage/${type}`);
                        console.log(`[DOCUMENT API] Storage/${type} exists: ${typeInfo.isDirectory ? 'Yes (directory)' : 'No (not a directory)'}`);
                        
                        // List files in this directory
                        console.log(`[DOCUMENT API] Files in storage/${type}:`);
                        try {
                            let fileCount = 0;
                            for await (const entry of Deno.readDir(`${workspaceRoot}/storage/${type}`)) {
                                if (entry.isFile) {
                                    fileCount++;
                                    if (fileCount <= 10) { // Limit to first 10 files to avoid overflow
                                        console.log(`  - ${entry.name}`);
                                    }
                                }
                            }
                            if (fileCount > 10) {
                                console.log(`  ... and ${fileCount - 10} more files`);
                            }
                        } catch (readDirErr) {
                            console.log(`  Error reading directory: ${readDirErr instanceof Error ? readDirErr.message : String(readDirErr)}`);
                        }
                    } catch (typeErr) {
                        console.log(`[DOCUMENT API] Storage/${type} does not exist: ${typeErr instanceof Error ? typeErr.message : String(typeErr)}`);
                    }
                }
            } catch (rootErr) {
                console.log(`[DOCUMENT API] Storage root does not exist: ${rootErr instanceof Error ? rootErr.message : String(rootErr)}`);
            }
        }
        
        if (fileExists) {
            ctx.response.body = {
                success: true,
                documentId,
                filePath,
                fileSize,
                message: "File verified"
            };
        } else {
            ctx.response.status = 404;
            ctx.response.body = {
                success: false,
                documentId,
                filePath,
                error: fileError,
                message: "File not found at any path",
                note: "Email will still be sent, but attachment may fail"
            };
        }
    } catch (error) {
        console.error(`[DOCUMENT API] Error verifying document file:`, error);
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Server error verifying document file",
            error: error instanceof Error ? error.message : String(error)
        };
    }
};

// Export an array of routes
export const documentRoutes: Route[] = [
    { method: "GET", path: "/documents", handler: getDocuments },
    { method: "GET", path: "/documents/:id", handler: getDocumentById },
    { method: "GET", path: "/documents/:id/download", handler: downloadDocument },
    { method: "GET", path: "/documents/:id/authors", handler: getDocumentAuthorsById },
    { method: "POST", path: "/documents", handler: createDocument },
    { method: "PUT", path: "/documents/:id", handler: updateDocument },
    { method: "DELETE", path: "/documents/:id", handler: deleteDocument },
    { method: "DELETE", path: "/documents/:id/hard-delete", handler: hardDeleteDocument },
    { method: "GET", path: "/guest/documents/:id", handler: getGuestDocumentById },
    { method: "GET", path: "/guest/documents/:id/authors", handler: getDocumentAuthorsById },
    { method: "GET", path: "/public/documents/:id", handler: getPublicDocumentById },
    { method: "GET", path: "/public/documents/:id/authors", handler: getDocumentAuthorsById },
    { method: "GET", path: "/documents/:id/verify-file", handler: verifyDocumentFile }
];
