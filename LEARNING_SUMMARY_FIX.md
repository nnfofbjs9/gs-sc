# Learning Summary Fix - Summary

## Issues Fixed

### 1. Client-Side Processing (Page Close Issue)
**Problem**: Learning summaries were only generated if the teacher kept the page open after saving reports.

**Fix**: Implemented server-side queue-based processing that runs independently of the browser.

## How It Works Now

### Architecture

```
Report Saved
    ↓
Database Trigger (automatic)
    ↓
Queue Entry Created (if student has 2+ reports)
    ↓
Edge Function Processes Queue (background)
    ↓
Learning Summary Generated & Saved
```

### Components Created

#### 1. Database Queue Table
- **Table**: `learning_summary_queue`
- **Purpose**: Stores pending learning summary updates
- **Columns**:
  - `id`: Unique identifier
  - `student_id`: Student to process
  - `status`: pending, processing, completed, or failed
  - `error_message`: Error details if failed
  - `created_at`: When queued
  - `processed_at`: When completed

#### 2. Database Trigger
- **Function**: `queue_learning_summary_update()`
- **Trigger**: `trigger_queue_learning_summary`
- **When**: Fires automatically after each report is inserted
- **Logic**:
  - Counts reports for the student
  - If 2+ reports exist, adds to queue
  - Prevents duplicate queue entries

#### 3. Edge Function Endpoint
- **Action**: `process_learning_summary_queue`
- **Location**: [supabase/functions/openai/index.ts](supabase/functions/openai/index.ts)
- **What it does**:
  1. Fetches up to 10 pending queue items
  2. For each student:
     - Fetches last 4 reports
     - Uses previous 3 reports (skips most recent)
     - Calls OpenAI to generate summary
     - Updates student's `learning_summary` field
     - Removes from queue or marks as failed

#### 4. Client-Side Trigger
- **Function**: `processLearningSummaryQueue()`
- **Location**: [index.html](index.html)
- **When**: Called after reports are saved (non-blocking)
- **Purpose**: Triggers queue processing in background
- **Behavior**: Doesn't block if it fails

## Benefits

✅ **Works offline (for teacher)**: Queue processing happens server-side
✅ **No page dependency**: Teacher can close page immediately after saving
✅ **Automatic**: Trigger fires when reports are saved
✅ **Resilient**: Failed items stay in queue with error messages
✅ **Scalable**: Processes in batches (10 at a time)
✅ **No duplicates**: Queue prevents duplicate entries

## Testing

### For Existing Reports
If you want to generate summaries for students who already have reports:

1. Check which students have 2+ reports:
```sql
SELECT s.student_name, COUNT(r.report_id) as report_count
FROM students s
JOIN reports r ON r.student_id = s.student_id
GROUP BY s.student_id, s.student_name
HAVING COUNT(r.report_id) >= 2
ORDER BY report_count DESC;
```

2. Manually add them to the queue:
```sql
INSERT INTO learning_summary_queue (student_id, status)
SELECT DISTINCT s.student_id, 'pending'
FROM students s
JOIN reports r ON r.student_id = s.student_id
GROUP BY s.student_id
HAVING COUNT(r.report_id) >= 2
ON CONFLICT DO NOTHING;
```

3. Process the queue via edge function or wait for next report save

### For New Reports
Just save reports normally - the system will:
1. Automatically queue students with 2+ reports
2. Process in background
3. Update learning summaries

## Monitoring

### Check Queue Status
```sql
SELECT status, COUNT(*)
FROM learning_summary_queue
GROUP BY status;
```

### View Failed Items
```sql
SELECT lsq.*, s.student_name, lsq.error_message
FROM learning_summary_queue lsq
JOIN students s ON s.student_id = lsq.student_id
WHERE status = 'failed';
```

### Check Latest Summaries
```sql
SELECT student_name,
       LEFT(learning_summary, 100) as summary_preview,
       LENGTH(learning_summary) as summary_length
FROM students
WHERE learning_summary IS NOT NULL
ORDER BY student_name;
```

## Console Logs to Look For

**Success**:
```
[SaveReports] Learning summaries queued for background processing
[Learning Summary Queue] Triggering background processing...
[Learning Summary Queue] ✓ Processed 4 students
```

**No items to process**:
```
[Learning Summary Queue] Background processing result: { processed: 0, message: "No items in queue" }
```

## Files Modified

1. [supabase/functions/openai/index.ts](supabase/functions/openai/index.ts)
   - Fixed model name: `gpt-5-mini` → `gpt-4o-mini`
   - Added `process_learning_summary_queue` action

2. [index.html](index.html)
   - Replaced `updateLearningSummaries()` with `processLearningSummaryQueue()`
   - Made it non-blocking background task

3. [supabase/migrations/008_learning_summary_trigger.sql](supabase/migrations/008_learning_summary_trigger.sql)
   - Created queue table
   - Created trigger function
   - Added automatic processing

## Next Steps for L3C8 Students

Since you mentioned the 4 L3C8 reports have empty summaries:

1. **Check report count** for these students:
```sql
SELECT s.student_name, COUNT(r.report_id) as reports
FROM students s
LEFT JOIN reports r ON r.student_id = s.student_id
JOIN batches b ON b.batch_id = s.batch_id
WHERE b.level = 3
GROUP BY s.student_id, s.student_name;
```

2. **If they have 2+ reports**, manually queue them:
```sql
INSERT INTO learning_summary_queue (student_id, status)
SELECT s.student_id, 'pending'
FROM students s
JOIN batches b ON b.batch_id = s.batch_id
WHERE b.level = 3
  AND (SELECT COUNT(*) FROM reports WHERE student_id = s.student_id) >= 2
ON CONFLICT DO NOTHING;
```

3. **Trigger processing** by calling the edge function from browser console:
```javascript
const { data, error } = await supabase.functions.invoke('openai', {
  body: { action: 'process_learning_summary_queue', data: {} }
});
console.log('Result:', data);
```

Or just save any new report for these students - it will trigger automatically.
