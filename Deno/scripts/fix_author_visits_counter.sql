-- Add unique constraint to author_visits_counter table
-- This fixes the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error

-- First check if the constraint already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'author_visits_counter_author_id_date_key' 
        AND conrelid = 'author_visits_counter'::regclass
    ) THEN
        -- Add the unique constraint on author_id and date fields
        ALTER TABLE author_visits_counter 
        ADD CONSTRAINT author_visits_counter_author_id_date_key 
        UNIQUE (author_id, date);
        
        RAISE NOTICE 'Unique constraint added successfully to author_visits_counter table';
    ELSE
        RAISE NOTICE 'Unique constraint already exists on author_visits_counter table';
    END IF;
END $$;

-- Add an index to speed up queries if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_author_visits_counter_author_date' 
        AND tablename = 'author_visits_counter'
    ) THEN
        CREATE INDEX idx_author_visits_counter_author_date 
        ON author_visits_counter(author_id, date);
        
        RAISE NOTICE 'Index added for better performance';
    ELSE
        RAISE NOTICE 'Index already exists';
    END IF;
END $$; 