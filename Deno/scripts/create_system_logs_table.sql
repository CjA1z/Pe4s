-- Create system_logs table to store various system activities
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  log_type VARCHAR(50) NOT NULL,  -- 'login', 'download', 'document', 'error', etc.
  user_id VARCHAR(50),            -- Can be NULL for system-generated logs
  username VARCHAR(100),          -- Store username for easier querying/display
  action VARCHAR(255) NOT NULL,   -- What happened
  details JSONB,                  -- Additional context as JSON
  ip_address VARCHAR(45),         -- Store IP address for security tracking
  status VARCHAR(50),             -- 'success', 'failed', 'pending', etc.
  related_id VARCHAR(100)         -- ID of related entity (document_id, user_id, etc.)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_type ON system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_status ON system_logs(status);

-- Insert sample data for testing
INSERT INTO system_logs (log_type, username, action, details, ip_address, status, related_id)
VALUES 
('login', 'admin@example.com', 'User login', 
 '{"browser": "Chrome", "device": "Desktop"}', '192.168.1.1', 'success', NULL),
 
('login', 'jane.doe@example.com', 'User login attempt', 
 '{"browser": "Firefox", "device": "Mobile", "reason": "Invalid password"}', '192.168.1.2', 'failed', NULL),
 
('download', 'john.doe@example.com', 'Document download', 
 '{"document_title": "Research Paper on Climate Change", "file_size": "2.4MB"}', '192.168.1.3', 'success', '123'),
 
('document', 'admin@example.com', 'Document updated', 
 '{"document_title": "Annual Report 2023", "changes": ["Updated abstract", "Added new author"]}', '192.168.1.1', 'success', '456'),
 
('system', NULL, 'Server startup', 
 '{"version": "1.2.0", "environment": "production"}', NULL, 'success', NULL),
 
('error', NULL, 'Database connection failed', 
 '{"error_code": "DB_CONN_001", "details": "Timeout connecting to database after 30 seconds"}', NULL, 'failed', NULL); 