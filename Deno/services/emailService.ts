/**
 * Email Service
 * Handles sending emails, including those with attachments
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { ensureDir } from "https://deno.land/std@0.190.0/fs/ensure_dir.ts";

// Email configuration using environment variables with fallbacks to working credentials
const EMAIL_CONFIG = {
  hostname: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
  port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
  // Use hardcoded working credentials if environment variables aren't found
  username: Deno.env.get("SMTP_USERNAME") || "christianjames2212003@gmail.com",
  password: Deno.env.get("SMTP_PASSWORD") || "gjox pkdu xasv yudj",
  useTLS: Deno.env.get("SMTP_TLS") !== "false"    // True by default
};

// Log current email configuration (with password masked)
console.log("[EMAIL CONFIG] Host:", EMAIL_CONFIG.hostname);
console.log("[EMAIL CONFIG] Port:", EMAIL_CONFIG.port);
console.log("[EMAIL CONFIG] Username:", EMAIL_CONFIG.username);
console.log("[EMAIL CONFIG] Password set:", EMAIL_CONFIG.password ? "Yes" : "No");
console.log("[EMAIL CONFIG] TLS enabled:", EMAIL_CONFIG.useTLS);

// Log a warning if credentials are missing
if (!EMAIL_CONFIG.username || !EMAIL_CONFIG.password) {
  console.warn("WARNING: Email credentials not configured. Set SMTP_USERNAME and SMTP_PASSWORD environment variables.");
}

// Initialize SMTP client
let smtpClient: SMTPClient | null = null;

// Add file existence verification and debug mode to the email service
const DEBUG_MODE = true; // Enable more verbose debugging

/**
 * Initializes the SMTP client with the provided configuration
 */
function initializeClient() {
  if (!smtpClient) {
    try {
      smtpClient = new SMTPClient({
        connection: {
          hostname: EMAIL_CONFIG.hostname,
          port: EMAIL_CONFIG.port,
          tls: EMAIL_CONFIG.useTLS,
          auth: {
            username: EMAIL_CONFIG.username,
            password: EMAIL_CONFIG.password,
          },
        },
      });
      console.log("SMTP client initialized");
    } catch (error) {
      console.error("Error initializing SMTP client:", error);
      throw error;
    }
  }
}

/**
 * Logs email activity to a file for tracking purposes
 * @param action The action being performed
 * @param details Details about the email
 */
async function logEmailActivity(action: string, details: Record<string, any>): Promise<void> {
  try {
    // Ensure logs directory exists
    await ensureDir("./logs");
    
    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Create a log entry
    const logEntry = {
      timestamp,
      action,
      ...details
    };
    
    // Format log message
    const logMessage = JSON.stringify(logEntry) + "\n";
    
    // Append to daily log file
    const logFile = `./logs/email-activity-${date}.log`;
    
    await Deno.writeTextFile(logFile, logMessage, { append: true })
      .catch(async (err) => {
        // If file doesn't exist, create it
        if (err instanceof Deno.errors.NotFound) {
          await Deno.writeTextFile(logFile, logMessage);
        } else {
          throw err;
        }
      });
      
    console.log(`[SMTP] Activity logged to ${logFile}`);
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error("[SMTP] Error logging activity:", error);
  }
}

/**
 * Sends an email with an attachment
 * @param to Recipient email address
 * @param subject Email subject
 * @param text Plain text content
 * @param html HTML content (optional)
 * @param filePath Path to the file to attach (optional)
 * @param fileName Name to display for the attachment (optional)
 * @returns Promise that resolves when the email is sent
 */
export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  text: string,
  html?: string,
  filePath?: string,
  fileName?: string
): Promise<boolean> {
  try {
    console.log(`[SMTP] Initializing email client for sending to: ${to}`);
    initializeClient();
    
    if (!smtpClient) {
      console.error("[SMTP] Failed to initialize SMTP client");
      return false;
    }

    // Create message
    const message: any = {
      from: EMAIL_CONFIG.username,
      to: to,
      subject: subject,
      text: text
    };
    
    // Add HTML content if provided
    if (html) {
      message.html = html;
    }
    
    // Add attachment if provided
    if (filePath) {
      try {
        console.log(`[SMTP] 📎 Attempting to attach file from path: ${filePath}`);
        console.log(`[SMTP DEBUG] Current working directory: ${Deno.cwd()}`);
        
        // Enhanced file existence check
        let fileExists = false;
        try {
          const fileInfo = await Deno.stat(filePath);
          fileExists = true;
          console.log(`[SMTP] ✅ File exists check: YES - ${filePath} (${fileInfo.size} bytes)`);
          
          if (DEBUG_MODE) {
            console.log(`[SMTP DEBUG] File details:`, {
              size: fileInfo.size,
              isFile: fileInfo.isFile,
              isDirectory: fileInfo.isDirectory,
              isSymlink: fileInfo.isSymlink,
              mtime: fileInfo.mtime,
              birthtime: fileInfo.birthtime
            });
          }
        } catch (existError) {
          console.error(`[SMTP] ❌ File exists check: NO - ${filePath}`, existError);
          
          if (DEBUG_MODE) {
            console.log(`[SMTP DEBUG] Current working directory: ${Deno.cwd()}`);
            console.log(`[SMTP DEBUG] Error details:`, existError instanceof Error ? {
              name: existError.name,
              message: existError.message,
              stack: existError.stack
            } : String(existError));
          }
          
          // List all files in storage/thesis directory to see what's available
          try {
            const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
            console.log(`[SMTP DEBUG] Workspace root: ${workspaceRoot}`);
            console.log(`[SMTP DEBUG] Available files in thesis folder:`);
            
            for await (const entry of Deno.readDir(`${workspaceRoot}/storage/thesis`)) {
              if (entry.isFile) {
                const fileStat = await Deno.stat(`${workspaceRoot}/storage/thesis/${entry.name}`);
                console.log(`  - ${entry.name} (${fileStat.size} bytes)`);
              }
            }
          } catch (listError) {
            console.error(`[SMTP DEBUG] Error listing thesis directory:`, listError);
          }
          
          // Try to fix common path issues
          const alternativePaths = [
            // Try without leading slash
            filePath.replace(/^\//, ''),
            // Try with storage prefix
            `${Deno.cwd().replace(/[\\/]Deno$/, '')}/storage/${filePath.replace(/^\/?(storage\/)?/, '')}`,
            // Try relative to workspace root
            `${Deno.cwd().replace(/[\\/]Deno$/, '')}/${filePath.replace(/^\//, '')}`,
            // Try direct path in thesis folder with file extension replacement
            `${Deno.cwd().replace(/[\\/]Deno$/, '')}/storage/thesis/${filePath.split('/').pop()?.replace(/\.pdf$/, '.file')}`,
            // Try direct path in thesis folder
            `${Deno.cwd().replace(/[\\/]Deno$/, '')}/storage/thesis/${filePath.split('/').pop()}`,
            // Try with Windows path format
            filePath.replace(/\//g, '\\')
          ];
          
          console.log(`[SMTP] Trying alternative paths: ${JSON.stringify(alternativePaths)}`);
          
          for (const altPath of alternativePaths) {
            try {
              const altFileInfo = await Deno.stat(altPath);
              console.log(`[SMTP] ✅ Alternative path exists: ${altPath} (${altFileInfo.size} bytes)`);
              filePath = altPath; // Update filePath to the working path
              fileExists = true;
              break;
            } catch (altError) {
              console.log(`[SMTP] Alternative path failed: ${altPath}`);
            }
          }
          
          // If direct path matching fails, try to find files with similar names
          if (!fileExists) {
            try {
              const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
              const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
              const fileNameParts = fileName.split('_')[0];
              
              if (fileNameParts) {
                console.log(`[SMTP DEBUG] Trying to find files starting with: ${fileNameParts}`);
                
                for await (const entry of Deno.readDir(`${workspaceRoot}/storage/thesis`)) {
                  if (entry.isFile && entry.name.startsWith(fileNameParts)) {
                    const matchPath = `${workspaceRoot}/storage/thesis/${entry.name}`;
                    console.log(`[SMTP] ✅ Found similar file: ${matchPath}`);
                    filePath = matchPath;
                    fileExists = true;
                    break;
                  }
                }
              }
            } catch (fuzzyError) {
              console.error(`[SMTP DEBUG] Error during fuzzy filename search:`, fuzzyError);
            }
          }
        }
        
        if (!fileExists) {
          console.error(`[SMTP] ❌ File does not exist at any tried path. Cannot attach file to email.`);
          console.log(`[SMTP] ⚠️ Will continue sending email without attachment`);
          console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ FILE ATTACHMENT FAILED - FILE NOT FOUND: ${filePath}`);
          
          await logEmailActivity("FILE_ATTACHMENT_FAILED", {
            file_path: filePath,
            error: "File does not exist at any tried path",
            to: to,
            subject: subject
          });
        } else {
          // File exists, read and attach it
          try {
            console.log(`[SMTP] 📤 Reading file for attachment: ${filePath}`);
            const fileContent = await Deno.readFile(filePath);
            const attachmentName = fileName || filePath.split('/').pop() || filePath.split('\\').pop() || 'attachment';
            
            // Determine file extension - if .file, try to guess actual type
            let finalAttachmentName = attachmentName;
            if (finalAttachmentName.endsWith('.file')) {
              console.log(`[SMTP] File has generic .file extension, will try to determine proper extension`);
              // Simple magic number checks for common file types
              if (fileContent.length > 4) {
                const header = new Uint8Array(fileContent.slice(0, 4));
                if (DEBUG_MODE) {
                  console.log(`[SMTP DEBUG] File header bytes: ${Array.from(header.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
                }
                
                if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
                  // %PDF header
                  finalAttachmentName = finalAttachmentName.replace(/\.file$/, '.pdf');
                  console.log(`[SMTP] Detected PDF file, renamed to ${finalAttachmentName}`);
                } else if (header[0] === 0x50 && header[1] === 0x4B) {
                  // PK header (zip, docx, xlsx, pptx)
                  finalAttachmentName = finalAttachmentName.replace(/\.file$/, '.docx');
                  console.log(`[SMTP] Detected Office/ZIP file, renamed to ${finalAttachmentName}`);
                }
              }
            }
            
            const fileSize = fileContent.length;
            console.log(`[SMTP] File read successfully - Size: ${fileSize} bytes, Using name: ${finalAttachmentName}`);
            
            message.attachments = [{
              filename: finalAttachmentName,
              content: fileContent
            }];
            
            console.log(`[SMTP] ✅ Attachment added to email (${fileSize} bytes)`);
            console.log(`[SMTP] ✅✅✅ FILE SUCCESSFULLY READ AND ATTACHED: ${finalAttachmentName} (${fileSize} bytes)`);
            
            await logEmailActivity("FILE_ATTACHMENT_SUCCESS", {
              file_path: filePath,
              file_size: fileSize,
              attachment_name: finalAttachmentName,
              to: to
            });
          } catch (readError) {
            console.error(`[SMTP] ❌ Error reading file ${filePath}:`, readError);
            console.log(`[SMTP] ⚠️ File exists but cannot be read. Will continue sending email without attachment`);
            console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ FILE READ ERROR: ${readError instanceof Error ? readError.message : String(readError)}`);
            
            if (DEBUG_MODE) {
              console.log(`[SMTP DEBUG] Read error details:`, readError instanceof Error ? {
                name: readError.name,
                message: readError.message,
                stack: readError.stack
              } : String(readError));
            }
            
            await logEmailActivity("FILE_ATTACHMENT_FAILED", {
              file_path: filePath,
              error: readError instanceof Error ? readError.message : String(readError),
              stage: "file_read",
              to: to
            });
          }
        }
      } catch (fileError) {
        console.error(`[SMTP] ❌ Error processing attachment ${filePath}:`, fileError);
        // Continue sending email without attachment
        console.log(`[SMTP] ⚠️ Will continue sending email without attachment`);
        console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ GENERAL ATTACHMENT ERROR: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        
        await logEmailActivity("FILE_ATTACHMENT_FAILED", {
          file_path: filePath,
          error: fileError instanceof Error ? fileError.message : String(fileError),
          stage: "general_error",
          to: to
        });
      }
    }
    
    // Send the email
    console.log(`[SMTP] Sending email to ${to} with subject "${subject}"${filePath && message.attachments ? ' including attachment' : ' WITHOUT attachment'}`);
    await smtpClient.send(message);
    console.log(`[SMTP] ✅ Email successfully sent to ${to} with subject "${subject}"`);
    
    // Log clear confirmation about attachment status
    if (filePath && message.attachments) {
      console.log(`[FILE SENT SUCCESSFULLY] ✅✅✅ THE FILE WAS SUCCESSFULLY SENT TO ${to}`);
    } else if (filePath && !message.attachments) {
      console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ EMAIL WAS SENT BUT FILE WAS NOT ATTACHED TO ${to}`);
    }
    
    return true;
  } catch (error) {
    console.error("[SMTP] Error sending email:", error);
    await logEmailActivity("EMAIL_SEND_ERROR", {
      recipient: to,
      subject: subject,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return false;
  }
}

/**
 * Sends an email notification when a document request is approved with the document attached
 * @param email Recipient email
 * @param fullName Recipient's name
 * @param documentTitle Title of the document
 * @param documentFilePath Path to the document file
 * @returns Promise resolving to boolean indicating success
 */
export async function sendApprovedRequestEmail(
  email: string,
  fullName: string,
  documentTitle: string,
  documentFilePath: string
): Promise<boolean> {
  console.log(`[SMTP] Preparing approval email for document: "${documentTitle}"`);
  console.log(`[SMTP] Document path: ${documentFilePath}`);
  
  // Log the beginning of this activity
  await logEmailActivity("DOCUMENT_APPROVAL_START", {
    recipient: email,
    recipient_name: fullName,
    document: documentTitle,
    document_path: documentFilePath
  });
  
  const subject = `Your request for "${documentTitle}" has been approved`;
  
  const text = `
Dear ${fullName},

We are pleased to inform you that your request to access "${documentTitle}" has been approved.

The document you requested is attached to this email. Please note that this document is subject to our usage policies and should not be redistributed without permission.

If you have any questions or need further assistance, please don't hesitate to contact us.

Thank you for using our electronic archiving system.

Best regards,
Paulinian Electronic Archiving System
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #047857; color: white; padding: 10px 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Document Request Approved</h2>
    </div>
    <div class="content">
      <p>Dear ${fullName},</p>
      <p>We are pleased to inform you that your request to access <strong>"${documentTitle}"</strong> has been approved.</p>
      <p>The document you requested is attached to this email. Please note that this document is subject to our usage policies and should not be redistributed without permission.</p>
      <p>If you have any questions or need further assistance, please don't hesitate to contact us.</p>
      <p>Thank you for using our electronic archiving system.</p>
      <p>Best regards,<br>Paulinian Electronic Archiving System</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;

  try {
    // Check if file exists before sending
    let fileExists = false;
    let fileSize = 0;
    let fileError = null;
    let finalPath = documentFilePath;
    
    try {
      // Try the direct path first
      try {
        const fileInfo = await Deno.stat(documentFilePath);
        fileExists = true;
        fileSize = fileInfo.size;
        console.log(`[SMTP] ✅ Verified document exists: ${documentFilePath} (${fileInfo.size} bytes)`);
      } catch (directPathError) {
        console.log(`[SMTP] ⚠️ Document not found at direct path: ${documentFilePath}`);
        fileError = directPathError instanceof Error ? directPathError.message : String(directPathError);
        
        // Try to find the file using the FileCheckService
        try {
          // Get file name from path
          const fileName = documentFilePath.split('/').pop() || documentFilePath.split('\\').pop() || '';
          
          if (fileName) {
            console.log(`[SMTP] Searching for document "${fileName}" in storage directories...`);
            
            // Import dynamically to avoid circular dependency
            const { FileCheckService } = await import('./fileCheckService.ts');
            const results = await FileCheckService.findInStorage(fileName);
            
            // Find any successful matches
            const found = results.filter(r => r.exists);
            
            if (found.length > 0) {
              console.log(`[SMTP] ✅ Found document in ${found.length} location(s):`);
              found.forEach((result, i) => {
                console.log(`  ${i+1}. ${result.path} (${result.size} bytes)`);
              });
              
              // Use the first found file
              finalPath = found[0].path;
              fileExists = true;
              fileSize = found[0].size || 0;
            } else {
              console.error(`[SMTP] ❌ Document not found in any storage location`);
              await logEmailActivity("DOCUMENT_NOT_FOUND", {
                recipient: email,
                document: documentTitle,
                document_path: documentFilePath,
                error: "File not found in any storage location"
              });
            }
          }
        } catch (searchError) {
          console.error(`[SMTP] Error searching for document:`, searchError);
        }
      }
    } catch (error) {
      fileError = error instanceof Error ? error.message : String(error);
      console.error(`[SMTP] ⚠️ Error verifying document existence: ${documentFilePath}`, error);
      
      // Log file not found
      await logEmailActivity("DOCUMENT_NOT_FOUND", {
        recipient: email,
        document: documentTitle,
        document_path: documentFilePath,
        error: fileError
      });
    }
    
    // If file was found, update the path to use
    if (fileExists) {
      console.log(`[SMTP] ✅ Using document at: ${finalPath} (${fileSize} bytes)`);
      documentFilePath = finalPath;
    } else {
      console.log(`[SMTP] ⚠️ Document not found. Email will be sent without attachment.`);
    }
    
    const result = await sendEmailWithAttachment(
      email,
      subject,
      text,
      html,
      fileExists ? documentFilePath : undefined // Only attach if file exists
    );
    
    // Log the result
    if (result) {
      console.log(`[SMTP] ✅ Approval email ${fileExists ? 'with document' : 'WITHOUT document'} successfully sent to ${email}`);
      
      // Log success
      await logEmailActivity(fileExists ? "DOCUMENT_SENT_SUCCESS" : "EMAIL_SENT_NO_ATTACHMENT", {
        recipient: email,
        recipient_name: fullName,
        document: documentTitle,
        document_path: documentFilePath,
        file_size: fileSize,
        attachment_status: fileExists ? "included" : "missing"
      });
    } else {
      console.error(`[SMTP] ❌ Failed to send approval email to ${email}`);
      
      // Log failure
      await logEmailActivity("DOCUMENT_SENT_FAILURE", {
        recipient: email,
        document: documentTitle,
        document_path: documentFilePath,
        error: "Email sending failed"
      });
    }
    
    return result;
  } catch (error) {
    console.error(`[SMTP] Error in sendApprovedRequestEmail:`, error);
    
    // Log error
    await logEmailActivity("DOCUMENT_SENT_ERROR", {
      recipient: email,
      document: documentTitle,
      document_path: documentFilePath,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}

/**
 * Sends an email notification when a document request is rejected
 * @param email Recipient email
 * @param fullName Recipient's name
 * @param documentTitle Title of the document
 * @param reason Reason for rejection
 * @returns Promise resolving to boolean indicating success
 */
export async function sendRejectedRequestEmail(
  email: string,
  fullName: string,
  documentTitle: string,
  reason: string
): Promise<boolean> {
  const subject = `Your request for "${documentTitle}" has been rejected`;
  
  const text = `
Dear ${fullName},

We regret to inform you that your request to access "${documentTitle}" has been rejected.

Reason for rejection: ${reason}

If you have any questions or believe this was in error, please contact our administration.

Thank you for your understanding.

Best regards,
Paulinian Electronic Archiving System
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 10px 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
    .reason { background-color: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Document Request Rejected</h2>
    </div>
    <div class="content">
      <p>Dear ${fullName},</p>
      <p>We regret to inform you that your request to access <strong>"${documentTitle}"</strong> has been rejected.</p>
      <div class="reason">
        <p><strong>Reason for rejection:</strong><br>${reason}</p>
      </div>
      <p>If you have any questions or believe this was in error, please contact our administration.</p>
      <p>Thank you for your understanding.</p>
      <p>Best regards,<br>Paulinian Electronic Archiving System</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;

  return await sendEmailWithAttachment(
    email,
    subject,
    text,
    html
  );
}

/**
 * Sends a confirmation email when a document request is submitted
 * @param email Recipient email
 * @param fullName Recipient's name
 * @param documentInfo Document information (title, author, category, etc.)
 * @param requestInfo Request information (reason, affiliation, etc.)
 * @param requestId Unique ID assigned to the request
 * @returns Promise resolving to boolean indicating success
 */
export async function sendRequestConfirmationEmail(
  email: string,
  fullName: string,
  documentInfo: {
    title: string;
    author?: string;
    category?: string;
    researchAgenda?: string;
    abstract?: string;
  },
  requestInfo: {
    affiliation: string;
    reason: string;
    reasonDetails: string;
  },
  requestId: string
): Promise<boolean> {
  console.log(`[SMTP] Preparing document request confirmation email for ${email}`);
  
  // Log the beginning of this activity
  await logEmailActivity("DOCUMENT_REQUEST_CONFIRMATION", {
    recipient: email,
    recipient_name: fullName,
    document: documentInfo.title,
    request_id: requestId
  });
  
  const subject = `Your request for "${documentInfo.title}" has been received`;
  
  // Get the email template
  let emailTemplate: string;
  try {
    emailTemplate = await Deno.readTextFile("./Public/pages/EmailTemplate.html");
  } catch (error) {
    console.error("[SMTP] Error reading email template:", error);
    // Use a fallback template if the file can't be read
    emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #008000; color: white; padding: 10px 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
        .highlight { background-color: #f0e68c; padding: 15px; border-left: 4px solid #daa520; margin: 15px 0; }
        .details { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Document Request Receipt</h2>
        </div>
        <div class="content">
          <p>Dear [User's Full Name Placeholder],</p>
          <div class="highlight">
            <p>Thank you for submitting your request for full access to the item "[Item Title Placeholder]". Your request has been received and successfully forwarded for approval.</p>
            <p>Upon approval, you will receive a separate email containing the PDF of the requested item.</p>
          </div>
          <div class="details">
            <h3>Your Request Number: [Request Number Placeholder]</h3>
            <h3>Requestor Details:</h3>
            <p>Full Name: [User's Full Name Placeholder]</p>
            <p>Email: [User's Email Placeholder]</p>
            <p>Affiliation: [User's Affiliation Placeholder]</p>
            <p>Reason(s) for Access: [Selected Reasons Placeholder]</p>
            <p>Reason Details: [Reason Details Placeholder]</p>
          </div>
          <div class="details">
            <h3>Details:</h3>
            <p>Title: [Item Title Placeholder]</p>
            <p>Author(s): [Author(s) Placeholder]</p>
            <p>Category: [Category Placeholder]</p>
            <p>Research Agenda: [Research Agenda Placeholder]</p>
            <p>Abstract: [Item Abstract Placeholder]</p>
          </div>
          <p>If you have any questions regarding your request, please contact us and reference your Request Number.</p>
        </div>
        <div class="footer">
          <p>© Paulinian Electronic Archiving System. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
  
  // Helper function to safely truncate long text
  const safeText = (text: string | undefined, maxLength = 1000): string => {
    if (!text) return "Not provided";
    // Truncate if too long and add indicator
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + "... (truncated for email)";
    }
    return text;
  };
  
  // Replace placeholders with actual content - with length limits to prevent RangeError
  const replacements: Record<string, string> = {
    "[User's Full Name Placeholder]": safeText(fullName, 100),
    "[User's Email Placeholder]": safeText(email, 100),
    "[User's Affiliation Placeholder]": safeText(requestInfo.affiliation, 200),
    "[Selected Reasons Placeholder]": safeText(requestInfo.reason, 500),
    "[Reason Details Placeholder]": safeText(requestInfo.reasonDetails, 1000),
    "[Item Title Placeholder]": safeText(documentInfo.title, 200),
    "[Author(s) Placeholder]": safeText(documentInfo.author, 300),
    "[Category Placeholder]": safeText(documentInfo.category, 100),
    "[Research Agenda Placeholder]": safeText(documentInfo.researchAgenda, 300),
    "[Item Abstract Placeholder]": safeText(documentInfo.abstract, 2000),
    "[Request Number Placeholder]": safeText(requestId, 50)
  };
  
  // Apply all replacements to the template - safer approach to avoid regex issues
  let emailHtml = emailTemplate;
  for (const [placeholder, value] of Object.entries(replacements)) {
    try {
      // Use split and join instead of regex for safer replacement
      emailHtml = emailHtml.split(placeholder).join(value);
    } catch (error) {
      console.error(`[SMTP] Error replacing placeholder ${placeholder}:`, error);
      // If replacement fails, try a direct approach with a simpler placeholder
      emailHtml = emailHtml.replace(placeholder, "Content unavailable");
    }
  }
  
  // Simple plain text version of the email
  const text = `
Document Request Receipt

Dear ${fullName},

Thank you for submitting your request for full access to the item "${documentInfo.title}". Your request has been received and successfully forwarded for approval.

Your Request Number: ${requestId}

Request Details:
- Full Name: ${fullName}
- Email: ${email}
- Affiliation: ${requestInfo.affiliation}
- Reason(s) for Access: ${requestInfo.reason}
- Reason Details: ${requestInfo.reasonDetails}

Document Details:
- Title: ${documentInfo.title}
- Author(s): ${documentInfo.author || "Not provided"}
- Category: ${documentInfo.category || "Not provided"}
- Research Agenda: ${documentInfo.researchAgenda || "Not provided"}

Upon approval, you will receive a separate email containing the PDF of the requested item.

If you have any questions regarding your request, please contact us and reference your Request Number.

Best regards,
Paulinian Electronic Archiving System
`;

  try {
    const result = await sendEmailWithAttachment(
      email,
      subject,
      text,
      emailHtml
    );
    
    // Log the result
    if (result) {
      console.log(`[SMTP] ✅ Document request confirmation email successfully sent to ${email}`);
      
      // Log success
      await logEmailActivity("REQUEST_CONFIRMATION_SENT_SUCCESS", {
        recipient: email,
        recipient_name: fullName,
        document: documentInfo.title,
        request_id: requestId
      });
    } else {
      console.error(`[SMTP] ❌ Failed to send document request confirmation email to ${email}`);
      
      // Log failure
      await logEmailActivity("REQUEST_CONFIRMATION_SENT_FAILURE", {
        recipient: email,
        document: documentInfo.title,
        request_id: requestId,
        error: "Email sending failed"
      });
    }
    
    return result;
  } catch (error) {
    console.error(`[SMTP] Error in sendRequestConfirmationEmail:`, error);
    
    // Log error
    await logEmailActivity("REQUEST_CONFIRMATION_SENT_ERROR", {
      recipient: email,
      document: documentInfo.title,
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
} 