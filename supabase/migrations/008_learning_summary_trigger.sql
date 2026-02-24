-- Migration: Add learning summary queue table for background processing
-- This allows learning summaries to be generated asynchronously server-side
-- Benefits: Works even if user closes browser, processes in background

-- Create queue table for pending learning summary updates
CREATE TABLE IF NOT EXISTS learning_summary_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Create index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_learning_summary_queue_status
    ON learning_summary_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_learning_summary_queue_student
    ON learning_summary_queue(student_id);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_queue_learning_summary ON reports;
DROP FUNCTION IF EXISTS queue_learning_summary_update();

-- Function to queue learning summary update when report is inserted
CREATE OR REPLACE FUNCTION queue_learning_summary_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report_count INTEGER;
BEGIN
    -- Count total reports for this student (including the one just inserted)
    SELECT COUNT(*) INTO v_report_count
    FROM reports
    WHERE student_id = NEW.student_id;

    -- Only queue if student has 2+ reports
    IF v_report_count >= 2 THEN
        -- Insert into queue (only if not already queued as pending)
        INSERT INTO learning_summary_queue (student_id, status)
        SELECT NEW.student_id, 'pending'
        WHERE NOT EXISTS (
            SELECT 1 FROM learning_summary_queue
            WHERE student_id = NEW.student_id
            AND status = 'pending'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger to auto-queue learning summary updates
CREATE TRIGGER trigger_queue_learning_summary
    AFTER INSERT ON reports
    FOR EACH ROW
    EXECUTE FUNCTION queue_learning_summary_update();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_summary_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_summary_queue TO service_role;

-- Comments
COMMENT ON TABLE learning_summary_queue IS
    'Queue for background processing of learning summary updates';
COMMENT ON FUNCTION queue_learning_summary_update() IS
    'Automatically queues learning summary generation when a new report is saved (requires 2+ reports)';
