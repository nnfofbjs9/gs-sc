# Learning Summary Feature - Complete Workflow

## Overview

The learning summary feature automatically generates and maintains a rolling summary of each student's progress based on their last 5 class reports. This summary is then used to personalize future reports.

## When Is It Updated?

The learning summary is updated **automatically after each class session** when reports are generated and saved:

1. Teacher uploads gradesheet photo
2. OCR extracts student grades
3. Reports are generated for all students
4. Teacher reviews and saves reports to database
5. **→ Learning summaries are automatically updated** (happens in background)

## How Does It Work?

### Step-by-Step Process

#### 1. **Trigger** ([index.html:1787](c:\Akshat\EExpress\App\gs-sc\index.html#L1787))
After reports are saved to the database, `updateLearningSummaries()` is called:

```javascript
await saveReports(sessionId, generatedReports);
  ↓
await updateLearningSummaries(reportsToSave);
```

#### 2. **For Each Student** ([index.html:1798-1866](c:\Akshat\EExpress\App\gs-sc\index.html#L1798-L1866))

**a. Fetch Recent Reports** (line 1807-1812)
```javascript
const { data: recentReports } = await supabase
    .from('reports')
    .select('report_body, created_at, sessions(class_number, batches(level))')
    .eq('student_id', report.studentId)
    .order('created_at', { ascending: false })
    .limit(5);
```
- Gets the last 5 reports for this student
- Includes the report that was just saved
- Sorted by most recent first

**b. Build Context String** (line 1827-1829)
```javascript
const reportsContext = recentReports.map((r, idx) =>
    `Class ${idx + 1} (most recent first):\n${r.report_body}`
).join('\n\n---\n\n');
```
- Combines all report texts into one context string
- Format: "Class 1: [report]\n---\nClass 2: [report]..."

**c. Call OpenAI** (line 1834-1838)
```javascript
const summaryResult = await callOpenAI('generate_learning_summary', {
    studentName: report.studentName,
    reportsContext,
    reportCount: recentReports.length
});
```
- Sends reports to OpenAI edge function
- Action: `generate_learning_summary`
- Edge function location: [`supabase/functions/openai/index.ts:504-553`](c:\Akshat\EExpress\App\gs-sc\supabase\functions\openai\index.ts#L504-L553)

**d. Extract Summary** (line 1842)
```javascript
const learningSummary = summaryResult.summary || '';
```
- Expected format from edge function: `{ summary: "..." }`
- Falls back to empty string if no summary

**e. Update Database** (line 1847-1857)
```javascript
if (learningSummary) {
    await supabase
        .from('students')
        .update({ learning_summary: learningSummary })
        .eq('student_id', report.studentId);
}
```
- Only updates if summary is non-empty
- Updates the `students.learning_summary` column

## How Is It Used?

### When Generating Reports

#### 1. **Fetch Student Data** ([index.html:1923-1934](c:\Akshat\EExpress\App\gs-sc\index.html#L1923-L1934))
```javascript
const studentData = students.map((student, idx) => {
    const dbStudent = currentMatches[idx];
    return {
        name: student.name,
        activityGrades: ...,
        gender: dbStudent?.gender || null,
        learningStyle: dbStudent?.learning_style || null,
        learningSummary: dbStudent?.learning_summary || null  // ← HERE
    };
});
```

#### 2. **Pass to OpenAI** ([openai/index.ts:359-361](c:\Akshat\EExpress\App\gs-sc\supabase\functions\openai\index.ts#L359-L361))
```javascript
if (learningSummary) {
    studentProfile += `\n\nLearning Progress Summary (from recent classes):\n${learningSummary}`;
}
```

The summary is included in the prompt so OpenAI can:
- Reference past performance and progress
- Maintain consistency across reports
- Provide continuity in feedback
- Tailor suggestions based on long-term patterns

#### 3. **OpenAI Generates Personalized Report**
With the learning summary context, OpenAI can write reports that:
- Acknowledge improvement over time ("building on last week's success...")
- Reference ongoing challenges ("continuing to work on...")
- Provide continuity in suggestions
- Are aware of the student's learning journey

## Example Flow

### First Class (No Summary Yet)
1. Teacher generates reports for Class 1
2. Reports saved to database
3. `updateLearningSummaries()` runs:
   - Fetches 1 report (just saved)
   - Calls OpenAI with this 1 report
   - Generates summary: "Student shows enthusiasm in creative activities..."
   - Saves to `students.learning_summary`

### Second Class (Uses Summary)
1. Teacher generates reports for Class 2
2. System fetches student data **including** `learning_summary` from Class 1
3. OpenAI generates report **aware** of Class 1 performance
4. After saving:
   - Fetches 2 reports (Class 1 + Class 2)
   - Generates updated summary
   - Updates `students.learning_summary`

### Sixth Class (Rolling Window)
1. System uses summary from Classes 1-5
2. After Class 6:
   - Fetches 5 most recent reports (Classes 2-6)
   - Generates new summary (Class 1 is dropped)
   - Rolling window of last 5 classes

## Database Schema

```sql
-- students table
CREATE TABLE students (
    student_id UUID PRIMARY KEY,
    student_name TEXT,
    learning_summary TEXT,  -- ← This field
    ...
);

-- reports table
CREATE TABLE reports (
    report_id UUID PRIMARY KEY,
    session_id UUID,
    student_id UUID REFERENCES students(student_id),
    report_body TEXT,
    created_at TIMESTAMP,
    ...
);
```

## Console Logs to Check

When the feature is working correctly, you should see:

```
[Learning Summary] Starting update for 10 students
[Learning Summary] Processing student: John Doe (ID: abc-123)
[Learning Summary] Found 3 recent reports for John Doe
[Learning Summary] Calling OpenAI for John Doe...
[Learning Summary] OpenAI response for John Doe: { summary: "..." }
[Learning Summary] Generated summary for John Doe (147 chars): Student demonstrates strong progress in creative...
[Learning Summary] ✓ Successfully updated DB for John Doe
...
[Learning Summary] ✓ Completed update for all students
```

## Potential Issues

### Issue 1: No reports found
**Log**: `[Learning Summary] No reports found for [student], skipping`
**Cause**: Student has no previous reports in database
**Solution**: This is normal for first-time students

### Issue 2: Empty summary
**Log**: `[Learning Summary] Empty summary for [student], skipping DB update`
**Cause**: OpenAI returned empty string or `summaryResult.summary` is undefined
**Check**:
- Edge function deployed correctly
- OpenAI API key is valid
- Check edge function logs in Supabase dashboard

### Issue 3: Database update error
**Log**: `[Learning Summary] Error updating DB for [student]: [error]`
**Cause**: Database permissions or RLS policy issue
**Solution**: Check RLS policies on `students` table

### Issue 4: No logs at all
**Cause**: `updateLearningSummaries()` not being called
**Check**:
- Is `saveReports()` completing successfully?
- Check line 1787 is being reached

## Debugging Checklist

If learning summaries aren't working:

1. ✅ Check browser console for `[Learning Summary]` logs
2. ✅ Verify edge function is deployed: `supabase functions list`
3. ✅ Check edge function logs in Supabase Dashboard → Edge Functions → openai → Logs
4. ✅ Verify OpenAI API key is set: Supabase Dashboard → Project Settings → Secrets
5. ✅ Check database: `SELECT student_name, learning_summary FROM students LIMIT 5;`
6. ✅ Verify RLS policies allow updates to `students.learning_summary`
7. ✅ Check network tab for failed requests to edge function

## OpenAI Edge Function

The summary generation happens in: [`supabase/functions/openai/index.ts:504-553`](c:\Akshat\EExpress\App\gs-sc\supabase\functions\openai\index.ts#L504-L553)

**Prompt**:
```
Based on these reports, generate a concise learning summary (max 150 words) that captures:
1. Overall learning trajectory (improving, consistent, needs support in specific areas)
2. Key strengths and areas of consistent excellence
3. Areas that need ongoing attention or practice
4. Any notable changes or patterns over time
5. Learning preferences or engagement patterns if evident
```

**Model**: `gpt-5-mini`
**Max tokens**: 300
**Expected output**: Plain text summary (150 words max)
