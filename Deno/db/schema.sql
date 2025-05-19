-- Add email tracking columns to document_requests if they don't exist
ALTER TABLE document_requests 
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS email_error TEXT DEFAULT NULL; 