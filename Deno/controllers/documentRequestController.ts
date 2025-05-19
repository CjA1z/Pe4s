import { RouterContext } from "../deps.ts";
import { DocumentRequestModel, DocumentRequest } from "../models/documentRequestModel.ts";
import { DocumentModel } from "../models/documentModel.ts";
import { sendRequestConfirmationEmail, sendApprovedRequestEmail } from "../services/emailService.ts";
import { client } from "../db/denopost_conn.ts";

export class DocumentRequestController {
    private documentRequestModel: DocumentRequestModel;

    constructor(documentRequestModel: DocumentRequestModel) {
        this.documentRequestModel = documentRequestModel;
    }

    // Create a new document request
    async createRequest(ctx: RouterContext<any, any, any>) {
        try {
            const body = ctx.request.body();
            const requestData = await body.value;

            // Validate required fields
            const requiredFields = ['document_id', 'full_name', 'email', 'affiliation', 'reason', 'reason_details'];
            for (const field of requiredFields) {
                if (!requestData[field]) {
                    ctx.response.status = 400;
                    ctx.response.body = { error: `Missing required field: ${field}` };
                    return;
                }
            }

            // Check if this is a request for an entire collection
            const isEntireCollection = !!requestData.is_entire_collection;
            console.log(`Document request for document ID ${requestData.document_id}, is entire collection: ${isEntireCollection}`);

            let document;
            let documentId = parseInt(requestData.document_id);

            // First attempt to look in regular documents table
            document = await DocumentModel.getById(documentId);

            // If not found in documents table, check compiled_documents table
            if (!document) {
                console.log(`Document not found in documents table, checking compiled_documents table`);
                try {
                    const compiledResult = await client.queryObject(`
                        SELECT cd.*, 
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
                        WHERE cd.id = $1 AND cd.deleted_at IS NULL
                    `, [documentId]);
                    
                    if (compiledResult.rows.length > 0) {
                        // Create a document-like object from compiled document
                        const compiledDoc = compiledResult.rows[0] as Record<string, any>;
                        document = {
                            id: compiledDoc.id,
                            title: compiledDoc.title,
                            is_public: false,
                            document_type: compiledDoc.category || 'CONFLUENCE',
                            category: compiledDoc.category,
                            is_compiled: true,
                            file_path: ''  // Compiled documents don't typically have a file_path
                        };
                        console.log(`Found compiled document: ${document.title}`);
                        
                        // If this is an entire collection request, get child documents
                        if (isEntireCollection && Array.isArray(requestData.child_document_ids)) {
                            console.log(`Request includes ${requestData.child_document_ids.length} child documents`);
                            requestData.child_documents = requestData.child_document_ids;
                        } else if (isEntireCollection) {
                            // Try to fetch child documents if not provided in request
                            try {
                                const childDocsResult = await client.queryObject(`
                                    SELECT d.id
                                    FROM documents d
                                    JOIN compiled_document_items cdi ON d.id = cdi.document_id
                                    WHERE cdi.compiled_document_id = $1
                                    AND d.deleted_at IS NULL
                                `, [documentId]);
                                
                                if (childDocsResult.rows.length > 0) {
                                    requestData.child_documents = childDocsResult.rows.map((row) => {
                                        const typedRow = row as Record<string, any>;
                                        return typedRow.id;
                                    });
                                    console.log(`Found ${requestData.child_documents.length} child documents`);
                                }
                            } catch (childError) {
                                console.error(`Error fetching child documents:`, childError);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error checking compiled_documents table:`, error);
                }
            }

            // If document still not found, return error
            if (!document) {
                console.error(`Document with ID ${documentId} not found in any table`);
                ctx.response.status = 404;
                ctx.response.body = { error: 'Document not found' };
                return;
            }

            // Create the request
            const request = await this.documentRequestModel.create(requestData);
            
            // Send confirmation email - moved to background processing to prevent server crashes
            let emailSuccess = false;
            
            // Create response first - immediately return success to the client
            ctx.response.status = 201;
            ctx.response.body = { 
                ...request, 
                email_status: 'processing'
            };
            
            // Process email asynchronously after responding to the client
            setTimeout(async () => {
                try {
                    console.log("Sending document request confirmation email (background process)...");
                
                // Extract document info
                const documentInfo = {
                    title: document.title || 'Requested Document',
                    author: document.author || undefined,
                    category: document.category || undefined,
                    researchAgenda: document.research_agenda || undefined,
                    abstract: document.abstract || undefined
                };
                
                // Extract request info
                const requestInfo = {
                    affiliation: requestData.affiliation,
                    reason: requestData.reason,
                    reasonDetails: requestData.reason_details
                };
                
                // Generate request ID - this format matches what we show in the UI
                const requestId = `REQ-${request.id || Date.now()}`;
                
                    // Send the confirmation email with error handling
                    try {
                        emailSuccess = await sendRequestConfirmationEmail(
                    requestData.email,
                    requestData.full_name,
                    documentInfo,
                    requestInfo,
                    requestId
                        );
                        
                        console.log(`Confirmation email ${emailSuccess ? 'sent to' : 'failed for'} ${requestData.email}`);
                    } catch (innerEmailError) {
                        console.error("Failed to send confirmation email:", innerEmailError);
                        emailSuccess = false;
                    }
                    
                    // Update request with email status
                    try {
                        await this.documentRequestModel.update(request.id, { 
                            email_sent: emailSuccess,
                            email_error: emailSuccess ? null : "Failed to send confirmation email"
                });
                    } catch (updateError) {
                        console.error("Failed to update request with email status:", updateError);
                    }
                } catch (outerEmailError) {
                    console.error("Error in email confirmation background process:", outerEmailError);
            }
            }, 100);
            
        } catch (error) {
            console.error('Error creating document request:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Get all document requests (admin only)
    async getAllRequests(ctx: RouterContext<any, any, any>) {
        try {
            const requests = await this.documentRequestModel.getAll();
            ctx.response.body = requests;
        } catch (error) {
            console.error('Error getting document requests:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Get requests by status (admin only)
    async getRequestsByStatus(ctx: RouterContext<any, any, any>) {
        try {
            const status = ctx.params?.status;
            if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
                ctx.response.status = 400;
                ctx.response.body = { error: 'Invalid status' };
                return;
            }

            const requests = await this.documentRequestModel.getByStatus(status as 'pending' | 'approved' | 'rejected');
            ctx.response.body = requests;
        } catch (error) {
            console.error('Error getting document requests by status:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Get requests for a specific document
    async getRequestsByDocumentId(ctx: RouterContext<any, any, any>) {
        try {
            const documentId = ctx.params?.documentId;
            if (!documentId) {
                ctx.response.status = 400;
                ctx.response.body = { error: 'Document ID is required' };
                return;
            }

            const requests = await this.documentRequestModel.getByDocumentId(documentId);
            ctx.response.body = requests;
        } catch (error) {
            console.error('Error getting document requests:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Update request status (admin only)
    async updateRequestStatus(ctx: RouterContext<any, any, any>) {
        try {
            const requestId = ctx.params.id;
            const body = ctx.request.body();
            const { status, reviewedBy, reviewNotes } = await body.value;

            if (!requestId || !status || !reviewedBy) {
                ctx.response.status = 400;
                ctx.response.body = { error: "Missing required fields" };
                return;
            }

            if (status !== 'approved' && status !== 'rejected') {
                ctx.response.status = 400;
                ctx.response.body = { error: "Status must be 'approved' or 'rejected'" };
                return;
            }

            const request = await this.documentRequestModel.getById(parseInt(requestId));
            if (!request) {
                ctx.response.status = 404;
                ctx.response.body = { error: "Request not found" };
                return;
            }

            const result = await this.documentRequestModel.updateStatus(
                parseInt(requestId),
                status,
                reviewedBy,
                reviewNotes
            );

            if (!result) {
                ctx.response.status = 500;
                ctx.response.body = { error: "Failed to update request status" };
                return;
            }

            // Update the request object with the new status
            request.status = status;
            request.reviewed_by = reviewedBy;
            request.reviewed_at = new Date();
            request.review_notes = reviewNotes || null;

            // Send email notification
            if (status === 'approved') {
                try {
                    // Fetch the associated document to get the file path
                    const document = await DocumentModel.getById(request.document_id);
                    
                    if (!document) {
                        console.error(`Document not found: ${request.document_id}`);
                        ctx.response.status = 200;
                        ctx.response.body = { 
                            success: true, 
                            warning: "Document not found. Email notification may not include the document." 
                        };
                        return;
                    }
                    
                    // Verify if the document file actually exists before trying to send it
                    let fileExists = false;
                    const filePath = document.file_path;
                    
                    if (filePath) {
                        const pathsToCheck = [
                            filePath,
                            `./Public/documents/${filePath}`,
                            `./documents/${filePath}`,
                            `./storage/${filePath}`,
                            `${Deno.cwd()}/Public/documents/${filePath}`,
                            `${Deno.cwd()}/documents/${filePath}`,
                            `${Deno.cwd()}/storage/${filePath}`
                        ];
                        
                        console.log(`[DOC REQUEST] Checking file existence for document: ${request.document_id}`);
                        console.log(`[DOC REQUEST] File path from database: ${filePath}`);
                        
                        for (const path of pathsToCheck) {
                            try {
                                const fileInfo = await Deno.stat(path);
                                if (fileInfo.isFile) {
                                    fileExists = true;
                                    console.log(`[DOC REQUEST] Found document file at: ${path}`);
                                    break;
                                }
                            } catch (error) {
                                // File doesn't exist at this path, try next one
                            }
                        }
                        
                        if (!fileExists) {
                            console.warn(`[DOC REQUEST] Document file not found at any expected location!`);
                            console.warn(`[DOC REQUEST] This will likely result in an email without attachments.`);
                        }
                    } else {
                        console.warn(`[DOC REQUEST] No file path available for document: ${request.document_id}`);
                    }
                    
                    // Proceed with sending the email
                    const title = document.title || "Requested Document";
                    const requestIdString = request.id ? request.id.toString() : "unknown";
                    
                    await sendApprovedRequestEmail(
                        request.email,
                        request.full_name,
                        title,
                        document.file_path || '',
                        requestIdString,
                        document.author,
                        document.category,
                        document.keywords
                    );

                    ctx.response.status = 200;
                    ctx.response.body = { 
                        success: true,
                        fileFound: fileExists
                    };
                } catch (error: any) {
                    console.error("Error sending approval email:", error);
                    ctx.response.status = 200; // Still return 200 as the status update was successful
                    ctx.response.body = { 
                        success: true, 
                        emailError: "Failed to send notification email: " + (error.message || "Unknown error") 
                    };
                }
            } else {
                ctx.response.status = 200;
                ctx.response.body = { success: true };
            }
        } catch (error) {
            console.error('Error updating request status:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Delete a request (admin only)
    async deleteRequest(ctx: RouterContext<any, any, any>) {
        try {
            const requestId = ctx.params?.id;
            const success = await this.documentRequestModel.delete(requestId);

            if (!success) {
                ctx.response.status = 404;
                ctx.response.body = { error: 'Request not found' };
                return;
            }

            ctx.response.body = { message: 'Request deleted successfully' };
        } catch (error) {
            console.error('Error deleting request:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Check if user has access to a document
    async checkDocumentAccess(ctx: RouterContext<any, any, any>) {
        try {
            const documentId = ctx.params?.documentId;
            const email = ctx.request.url.searchParams.get('email');

            // First check if the document is public
            const document = await DocumentModel.getById(parseInt(documentId || '0'));
            if (!document) {
                // If not found in documents table, check compiled_documents table
                try {
                    const compiledResult = await client.queryObject(`
                        SELECT cd.* FROM compiled_documents cd
                        WHERE cd.id = $1 AND cd.deleted_at IS NULL
                    `, [parseInt(documentId || '0')]);
                    
                    if (compiledResult.rows.length === 0) {
                ctx.response.status = 404;
                ctx.response.body = { error: 'Document not found' };
                return;
                    }
                    
                    // Compiled documents aren't public by default
                    if (!email) {
                        ctx.response.body = { hasAccess: false };
                        return;
                    }
                    
                    // Check if user has an approved request for this compiled document
                    const hasAccess = await this.documentRequestModel.hasApprovedRequest(documentId || '', email);
                    ctx.response.body = { hasAccess };
                    return;
                } catch (error) {
                    console.error(`Error checking compiled_documents:`, error);
                    ctx.response.status = 404;
                    ctx.response.body = { error: 'Document not found' };
                    return;
                }
            }

            // If document is public, allow access
            if (document.is_public) {
                ctx.response.body = { hasAccess: true };
                return;
            }

            // If no email provided, treat as guest user
            if (!email) {
                ctx.response.body = { hasAccess: false };
                return;
            }

            // Check if user has an approved request
            const hasAccess = await this.documentRequestModel.hasApprovedRequest(documentId || '', email);
            ctx.response.body = { hasAccess };
        } catch (error) {
            console.error('Error checking document access:', error);
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }
} 