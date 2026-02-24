-- Quick fix script for L3C8 students with missing learning summaries
-- Run this to queue all L3C8 students who have 2+ reports

-- Step 1: Check which L3C8 students need summaries
SELECT
    s.student_name,
    COUNT(r.report_id) as total_reports,
    CASE
        WHEN s.learning_summary IS NULL OR s.learning_summary = '' THEN 'Missing'
        ELSE 'Has Summary'
    END as summary_status
FROM students s
LEFT JOIN reports r ON r.student_id = s.student_id
JOIN batches b ON b.batch_id = s.batch_id
WHERE b.level = 3 AND b.class_number = 8
GROUP BY s.student_id, s.student_name, s.learning_summary
ORDER BY total_reports DESC;

-- Step 2: Queue all L3C8 students with 2+ reports for processing
INSERT INTO learning_summary_queue (student_id, status)
SELECT DISTINCT s.student_id, 'pending'
FROM students s
JOIN batches b ON b.batch_id = s.batch_id
WHERE b.level = 3
  AND b.class_number = 8
  AND (SELECT COUNT(*) FROM reports WHERE student_id = s.student_id) >= 2
ON CONFLICT DO NOTHING;

-- Step 3: Verify queue entries were created
SELECT
    COUNT(*) as queued_students,
    status
FROM learning_summary_queue lsq
JOIN students s ON s.student_id = lsq.student_id
JOIN batches b ON b.batch_id = s.batch_id
WHERE b.level = 3 AND b.class_number = 8
GROUP BY status;

-- After running this, the summaries will be generated automatically
-- by the edge function when you:
-- 1. Save any new report for ANY student (triggers queue processing)
-- 2. Or manually call the edge function from browser console
