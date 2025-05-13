import { Route } from "./index.ts";
import { RouterContext } from "../deps.ts";
import { 
    handleCreateCompiledDocument,
    handleGetCompiledDocument,
    handleAddDocumentsToCompilation,
    handleSoftDeleteCompiledDocument,
    handleUpdateCompiledDocument
} from "../api/compiledDocument.ts";

// Compiled Document route handlers
const createCompiledDocument = async (ctx: RouterContext<any, any, any>) => {
    const bodyParser = await ctx.request.body({type: "json"});
    const body = await bodyParser.value;
    
    // Convert context to Request
    const request = new Request(ctx.request.url.toString(), {
        method: "POST",
        headers: ctx.request.headers,
        body: JSON.stringify(body)
    });
    
    const response = await handleCreateCompiledDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

const getCompiledDocument = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/compiled-documents/${id}`, {
        method: "GET",
        headers: ctx.request.headers
    });
    
    const response = await handleGetCompiledDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

const addDocumentsToCompilation = async (ctx: RouterContext<any, any, any>) => {
    const bodyParser = await ctx.request.body({type: "json"});
    const body = await bodyParser.value;
    
    // Convert context to Request
    const request = new Request(ctx.request.url.toString(), {
        method: "POST",
        headers: ctx.request.headers,
        body: JSON.stringify(body)
    });
    
    const response = await handleAddDocumentsToCompilation(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

// Add soft delete handler
const softDeleteCompiledDocument = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/compiled-documents/${id}/soft-delete`, {
        method: "DELETE",
        headers: ctx.request.headers
    });
    
    const response = await handleSoftDeleteCompiledDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

// Add update compiled document handler
const updateCompiledDocument = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    let body: Record<string, any>;
    let contentType = '';
    
    // Check content type from request headers
    const contentTypeHeader = ctx.request.headers.get('content-type') || '';
    contentType = contentTypeHeader.split(';')[0].toLowerCase();
    
    // Process body based on content type
    if (contentType === 'application/json') {
        const bodyParser = await ctx.request.body({type: "json"});
        body = await bodyParser.value;
    } else if (contentType === 'multipart/form-data') {
        try {
            // Handle multipart/form-data
            const bodyParser = await ctx.request.body({type: "form-data"});
            const formData = await bodyParser.value.read();
            
            // Convert form data to a format the API can handle
            body = {} as Record<string, any>;
            
            // Process form fields
            if (formData.fields) {
                for (const [key, value] of Object.entries(formData.fields)) {
                    // Try to parse JSON strings in form data
                    try {
                        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
                            body[key] = JSON.parse(value);
                        } else {
                            body[key] = value;
                        }
                    } catch {
                        body[key] = value;
                    }
                }
            }
            
            // Add any files from form data
            if (formData.files && Array.isArray(formData.files)) {
                body.files = formData.files;
            }
        } catch (e) {
            const error = e as Error;
            console.error("Error processing multipart/form-data:", error);
            ctx.response.status = 400;
            ctx.response.body = { error: "Error processing form data: " + error.message };
            return;
        }
    } else {
        // Default to JSON for backward compatibility
        try {
            const bodyParser = await ctx.request.body({type: "json"});
            body = await bodyParser.value;
        } catch (e) {
            const error = e as Error;
            console.error("Error processing request body:", error);
            ctx.response.status = 400;
            ctx.response.body = { error: "Invalid request format: " + error.message };
            return;
        }
    }
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/compiled-documents/${id}`, {
        method: "PUT",
        headers: new Headers({
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify(body)
    });
    
    const response = await handleUpdateCompiledDocument(request);
    
    // Convert Response back to context
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
};

// Add hard delete handler for compiled documents
const hardDeleteCompiledDocument = async (ctx: RouterContext<any, any, any>) => {
    const id = ctx.params.id;
    
    // Convert context to Request
    const request = new Request(`${ctx.request.url.origin}/api/compiled-documents/${id}/hard-delete`, {
        method: "DELETE",
        headers: ctx.request.headers
    });
    
    try {
        // First, check if the compiled document exists in the database
        const checkResult = await ctx.state.client.queryObject(
            "SELECT id FROM compiled_documents WHERE id = $1",
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            ctx.response.status = 404;
            ctx.response.body = { 
                error: "Compiled document not found",
                success: false
            };
            return;
        }
        
        // Execute a hard delete of the compiled document
        const deleteResult = await ctx.state.client.queryObject(
            "DELETE FROM compiled_documents WHERE id = $1 RETURNING id",
            [id]
        );
        
        if (deleteResult.rowCount > 0) {
            ctx.response.status = 200;
            ctx.response.body = { 
                message: "Compiled document permanently deleted successfully",
                id: id,
                success: true
            };
        } else {
            ctx.response.status = 404;
            ctx.response.body = { 
                error: "Compiled document could not be deleted",
                success: false
            };
        }
    } catch (error) {
        console.error(`Error hard deleting compiled document ${id}:`, error);
        ctx.response.status = 500;
        ctx.response.body = { 
            error: error instanceof Error ? error.message : "Unknown error occurred",
            success: false
        };
    }
};

// Export an array of routes
export const compiledDocumentRoutes: Route[] = [
    { method: "POST", path: "/compiled-documents", handler: createCompiledDocument },
    { method: "GET", path: "/compiled-documents/:id", handler: getCompiledDocument },
    { method: "POST", path: "/compiled-documents/add-documents", handler: addDocumentsToCompilation },
    { method: "DELETE", path: "/compiled-documents/:id/soft-delete", handler: softDeleteCompiledDocument },
    { method: "PUT", path: "/compiled-documents/:id", handler: updateCompiledDocument },
    { method: "DELETE", path: "/compiled-documents/:id/hard-delete", handler: hardDeleteCompiledDocument },
]; 