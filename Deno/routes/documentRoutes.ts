import { Route } from "./index.ts";
import { RouterContext } from "../deps.ts";
import { 
    handleFetchDocuments, 
    handleDocumentById, 
    handleCreateDocument,
    handleUpdateDocument,
    handleDeleteDocument 
} from "../api/document.ts";

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

// Export an array of routes
export const documentRoutes: Route[] = [
    { method: "GET", path: "/documents", handler: getDocuments },
    { method: "GET", path: "/documents/:id", handler: getDocumentById },
    { method: "POST", path: "/documents", handler: createDocument },
    { method: "PUT", path: "/documents/:id", handler: updateDocument },
    { method: "DELETE", path: "/documents/:id", handler: deleteDocument },
];
