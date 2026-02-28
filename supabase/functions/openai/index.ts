import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SYSTEM_PROMPT = `You are an AI teaching assistant for a preschool enrichment program. You analyze teacher-provided learning area ratings for each child and generate friendly, parent-facing feedback and short home activities using the PlayPack – a box of educational toys. There are 4 ratings: Excellent, Good, Needs Practice and Absent for class (abbreviated A, B, C and X, respectively). Keep the tone warm, supportive, and encouraging. Prioritize educational tasks for those fields in which the child has done poorly, but also those where they have done very well – thus encouraging them in easy tasks while getting them to improve in weak areas.
The kit contains ONLY the following elements: beads, playdoh, number tiles (dominos with numbers on them but without dots). IMPORTANT: Do not suggest any additional materials (no paper, crayons, household items). Don't require much extra work from the parent even as little as asking them to draw something.
Be very careful that the activities are completely safe for children. None of the activities should involve putting anything in the mouth, climbing or putting oneself or others in danger in anyway.
For each child, generate:
1. A 3–4 line summary in friendly tone.
2. 3-4 fun, 15-minute home activities using ONLY PlayPack items (beads/playdoh/number tiles).
Keep total reply per child under 200 words.
Very important: The response must not contain m-dashes ("—"). Replace them with colons where appropriate.

Writing style:
Do not use m-dashes ("—")
Do not start with a greeting to the parent.
Do not end with a generic sign off line - simply end after all the activities have been listed.
Use clear, direct language and avoid complex terminology.
Use British English spellings
Aim for a Flesch reading score of 80 or higher.
Use the active voice.
Avoid adverbs.
Avoid buzzwords and instead use plain English.
Use jargon where relevant.
Avoid being salesy or overly enthusiastic and instead express calm confidence.`;

// =====================================================
// HELPER FUNCTION FOR FORMATTING RECENT GRADES
// =====================================================

/**
 * Formats recent class grades for inclusion in GPT prompts
 */
function formatRecentGrades(recentClassGrades: any[]): string {
  if (!recentClassGrades || recentClassGrades.length === 0) {
    return "No recent class history available.";
  }

  return recentClassGrades.map(classData => {
    const gradeStr = Object.entries(classData.grades)
      .map(([area, grade]) => `${area}: ${grade}`)
      .join(', ');
    return `Class ${classData.class_number}: ${gradeStr}`;
  }).join('\n');
}

// CORS is open to all origins because every request requires a valid Supabase JWT.
// The JWT is the real authentication layer — CORS restriction here adds no meaningful security
// and breaks Vercel's dynamically-generated preview/staging URLs.
function getCorsHeaders(_origin: string | null) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };
}

// =====================================================
// HELPER FUNCTIONS FOR ACTIVITY LOOKUP
// =====================================================

/**
 * Fetches activities with sequence_in_class defined for a given level and class_number
 */
async function getActivitiesWithSequence(level: number, classNumber: number) {
  const { data, error } = await supabaseClient
    .from('activities')
    .select(`
      activity_id,
      activity_name,
      description,
      sequence_in_class,
      class_number,
      level,
      learning_areas:learning_area_id (
        learning_area_name
      )
    `)
    .eq('level', level)
    .eq('class_number', classNumber)
    .not('sequence_in_class', 'is', null)
    .order('sequence_in_class', { ascending: true });

  if (error) {
    console.error('Error fetching activities with sequence:', error);
    return null;
  }

  return data;
}

/**
 * Fetches activity descriptions for given activity names, class_number and level
 */
async function getActivityDescriptions(activityNames: string[], level: number, classNumber: number) {
  const { data, error } = await supabaseClient
    .from('activities')
    .select(`
      activity_id,
      activity_name,
      description,
      level,
      learning_areas:learning_area_id (
        learning_area_name,
        description
      )
    `)
    .eq('level', level)
    .in('activity_name', activityNames);

  if (error) {
    console.error('Error fetching activity descriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * Maps OCR activity names to database activities using sequence_in_class as reference
 */
function mapActivitiesWithWarnings(
  ocrActivities: string[],
  dbActivitiesWithSequence: any[]
) {
  const mappedActivities: Array<{
    ocrName: string;
    dbName: string | null;
    description: string | null;
    learningArea: string | null;
    sequence: number;
    warning: string | null;
  }> = [];

  // Map by sequence position
  for (let i = 0; i < ocrActivities.length; i++) {
    const ocrName = ocrActivities[i];
    const dbActivity = dbActivitiesWithSequence[i];

    if (dbActivity) {
      const dbName = dbActivity.activity_name;
      const description = dbActivity.description;
      const learningArea = dbActivity.learning_areas?.learning_area_name;

      // Check for mismatch
      const warning = dbName.toLowerCase() !== ocrName.toLowerCase()
        ? `Activity name mismatch: OCR returned "${ocrName}" but expected "${dbName}" at position ${i + 1}`
        : null;

      mappedActivities.push({
        ocrName,
        dbName,
        description,
        learningArea,
        sequence: dbActivity.sequence_in_class,
        warning
      });
    } else {
      // No DB activity at this position
      mappedActivities.push({
        ocrName,
        dbName: null,
        description: null,
        learningArea: null,
        sequence: i + 1,
        warning: `No database activity defined at position ${i + 1}`
      });
    }
  }

  return mappedActivities;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    // Warm-up ping to prevent cold starts
    if (action === "ping") {
      return new Response(JSON.stringify({ status: "ready" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "extract") {
      // Validate image size server-side (base64 of 10MB ≈ 13.4MB string)
      const MAX_BASE64_LENGTH = 14_000_000; // ~10MB original
      if (!data.image || typeof data.image !== "string") {
        return new Response(JSON.stringify({ error: "Image data is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (data.image.length > MAX_BASE64_LENGTH) {
        return new Response(JSON.stringify({ error: "Image too large. Please upload an image under 10MB." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract ALL data from this student gradesheet image with MAXIMUM ACCURACY. Read every cell carefully.

WHAT TO EXTRACT:
1. center_student_id: 4-digit student ID number (usually first column, e.g., "0001", "0042")
2. Student names: Full name of each student
3. Activity names: Column headers for each activity/assessment
4. Grades: EVERY grade for EVERY student for EVERY activity
5. Batch code: Short numeric code (e.g., "001", "002") usually near top of sheet
6. Class number: Curriculum class number (1-36) visible on top left
7. Level number: Level (1-5) if visible

CRITICAL REQUIREMENTS FOR GRADES:
- Read EVERY single grade cell - do NOT skip any
- Use "A" for Excellent/Great/Good work
- Use "B" for Good/Satisfactory
- Use "C" for Needs Practice/Could improve
- Use "X" for Absent/Did not attend
- ONLY use empty string "" if the cell is truly blank or completely illegible
- If you can see ANY mark, letter, or symbol in a grade cell, interpret it as A, B, C, or X
- Double-check that grades array length matches activities array length for EVERY student

Return ONLY a valid JSON object in this EXACT format:
{
  "classNumber": "1" or null,
  "level": "1" or null,
  "batchCode": "001" or null,
  "activities": ["Activity 1", "Activity 2", ...],
  "students": [
    {"center_student_id": "0001", "name": "Student Name", "grades": ["A", "B", "C", "X", ...]},
    {"center_student_id": "0002", "name": "Another Student", "grades": ["B", "A", "B", "C", ...]}
  ]
}

IMPORTANT:
- center_student_id should contain the student ID (a 4-digit number like "0001", "0042"). Extract it if visible.
- If student ID is not visible for a student, use null
- grades array must match activities array in order
- Use "A" for Excellent, "B" for Good, "C" for Needs Practice, "X" for Absent
- If a grade is unclear, use empty string ""

VALIDATION CHECKLIST BEFORE RESPONDING:
✓ Every student has the same number of grades as there are activities
✓ No grades array is empty
✓ Empty string "" is only used if cell is truly blank/illegible
✓ All visible grades have been extracted`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${data.image}`,
                  },
                },
              ],
            },
          ],
          max_completion_tokens: 10000,
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Parse the OCR result and enhance with database lookup
      let extractedText = result.choices[0].message.content.trim();
      extractedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      let extractedData;
      try {
        extractedData = JSON.parse(extractedText);
      } catch (e) {
        // Return original result if parsing fails - let frontend handle it
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Enhance with activity lookup if we have level and classNumber
      if (extractedData.level && extractedData.classNumber) {
        const level = parseInt(extractedData.level);
        const classNumber = parseInt(extractedData.classNumber);

        if (!isNaN(level) && !isNaN(classNumber)) {
          // Try to get activities with sequence_in_class defined
          const dbActivities = await getActivitiesWithSequence(level, classNumber);

          if (dbActivities && dbActivities.length > 0) {
            // Map OCR activities to DB activities and check for mismatches
            const mappedActivities = mapActivitiesWithWarnings(
              extractedData.activities || [],
              dbActivities
            );

            // Add enhanced data to the result
            extractedData.activityMapping = mappedActivities;
            extractedData.hasSequenceDefined = true;

            // Collect warnings
            const warnings = mappedActivities
              .filter(a => a.warning)
              .map(a => a.warning);

            if (warnings.length > 0) {
              extractedData.warnings = warnings;
            }
          } else {
            // No sequence defined - use OCR activity names as-is
            extractedData.hasSequenceDefined = false;

            // Still try to fetch descriptions for the OCR-detected activity names
            const activityDescs = await getActivityDescriptions(
              extractedData.activities || [],
              level,
              classNumber
            );

            if (activityDescs.length > 0) {
              extractedData.activityDescriptions = activityDescs;
            }
          }
        }
      }

      // Return enhanced result
      return new Response(JSON.stringify({
        ...result,
        choices: [{
          ...result.choices[0],
          message: {
            ...result.choices[0].message,
            content: JSON.stringify(extractedData, null, 2)
          }
        }]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "generate_report") {
      const { studentName, activityGrades, activityDefinitions, level, classNumber, gender, learningStyle, learningSummary, recentClassGrades } = data;

      // Build activity context from definitions if provided - only include learning areas, not detailed descriptions
      let activityContext = "";
      if (activityDefinitions && Array.isArray(activityDefinitions) && activityDefinitions.length > 0) {
        const learningAreas = new Set<string>();
        activityDefinitions.forEach((activity: any) => {
          if (activity.learningArea) {
            learningAreas.add(activity.learningArea);
          }
        });
        if (learningAreas.size > 0) {
          activityContext = "\n\nLearning areas covered in class: " + Array.from(learningAreas).join(", ");
        }
      }

      // Build student profile context
      let studentProfile = "";
      if (gender) {
        studentProfile += `\nGender: ${gender}`;
      }
      if (learningStyle && Array.isArray(learningStyle) && learningStyle.length > 0) {
        const styleDescriptions: Record<string, string> = {
          'looker': 'Visual learner - learns by seeing images, diagrams, and patterns',
          'listener': 'Auditory learner - learns via sound and discussion',
          'mover': 'Kinesthetic learner - learns through touch, movement, and hands-on activity'
        };
        const styles = learningStyle.map((s: string) => styleDescriptions[s] || s).join('; ');
        studentProfile += `\nLearning Style: ${styles}`;
      }
      if (learningSummary) {
        studentProfile += `\n\nLearning Progress Summary (from recent classes):\n${learningSummary}`;
      }

      // Format recent grades history
      const recentGradesText = recentClassGrades ? formatRecentGrades(recentClassGrades) : "No recent class history available.";

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `Child: ${studentName}${studentProfile}

RECENT PERFORMANCE HISTORY (last 3 classes):
${recentGradesText}

CURRENT CLASS PERFORMANCE (Class ${classNumber || 'current'}):
${activityGrades}${activityContext}

TASK:
Analyze the student's performance across the last 3 classes. Identify learning areas where the student consistently scored C (needs practice) or struggled.

Generate 3-4 activities that:
1. PRIMARY (60% of activities): Target learning areas where student scored C in 2 or more of the last 3 classes
2. SECONDARY (40% of activities): Reinforce areas where student excelled (A grades) to build confidence
3. If student has no clear weaknesses, provide balanced enrichment across all areas

CRITICAL INSTRUCTIONS FOR PARENT-FRIENDLY ACTIVITIES:
- Make each activity completely self-contained and easy to understand
- Do NOT reference specific class activities, stories, or topics (like "Jack and the Beanstalk" or specific themes from class)
- Do NOT assume parents know what was taught in class
- Use simple, general descriptions that any parent can follow
- Explain concepts clearly (e.g., instead of saying "the 4 stages", say "four stages of plant growth: seed, sprout, seedling, full plant")
- Activities should work for parents with basic English skills
- Focus on the core skill being practiced, not replicating class activities

For EACH activity output:
- Name the learning area being targeted (e.g., sequencing, counting, pattern recognition)
- Describe the activity in simple, clear steps using ONLY PlayPack items (beads/playdoh/number tiles)
- Make sure any concepts (like plant stages, shapes, etc.) are explained within the activity itself

Keep total reply under 200 words.
Very important: The response must not contain m-dashes ("—"). Replace them with colons where appropriate.`,
            },
          ],
          max_completion_tokens: 10000,
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "generate_reports_batch") {
      const { students: batchStudents, activityDefinitions } = data;

      if (!batchStudents || !Array.isArray(batchStudents) || batchStudents.length === 0) {
        throw new Error("No students provided for batch report generation");
      }

      // Build shared activity context - only include learning areas, not detailed descriptions
      let activityContext = "";
      if (activityDefinitions && Array.isArray(activityDefinitions) && activityDefinitions.length > 0) {
        const learningAreas = new Set<string>();
        activityDefinitions.forEach((activity: any) => {
          if (activity.learningArea) {
            learningAreas.add(activity.learningArea);
          }
        });
        if (learningAreas.size > 0) {
          activityContext = "\n\nLearning areas covered in class: " + Array.from(learningAreas).join(", ");
        }
      }

      // Helper to build student profile
      const buildStudentProfile = (student: any) => {
        let profile = "";
        if (student.gender) {
          profile += `\nGender: ${student.gender}`;
        }
        if (student.learningStyle && Array.isArray(student.learningStyle) && student.learningStyle.length > 0) {
          const styleDescriptions: Record<string, string> = {
            'looker': 'Visual learner - learns by seeing images, diagrams, and patterns',
            'listener': 'Auditory learner - learns via sound and discussion',
            'mover': 'Kinesthetic learner - learns through touch, movement, and hands-on activity'
          };
          const styles = student.learningStyle.map((s: string) => styleDescriptions[s] || s).join('; ');
          profile += `\nLearning Style: ${styles}`;
        }
        if (student.learningSummary) {
          profile += `\n\nLearning Progress Summary (from recent classes):\n${student.learningSummary}`;
        }
        return profile;
      };

      // Build multi-student prompt with recent grades
      const studentSections = batchStudents.map((s: any, i: number) => {
        const recentGradesText = s.recentClassGrades ? formatRecentGrades(s.recentClassGrades) : "No recent class history available.";
        return `Child ${i + 1}: ${s.name}${buildStudentProfile(s)}

RECENT PERFORMANCE HISTORY (last 3 classes):
${recentGradesText}

CURRENT CLASS PERFORMANCE:
${s.activityGrades}`;
      }).join("\n\n---\n\n");

      const userPrompt = `${studentSections}${activityContext}

TASK:
For EACH child above, analyze their performance across the last 3 classes. Identify learning areas where they consistently scored C (needs practice) or struggled.

Generate 3-4 activities per child that:
1. PRIMARY (60% of activities): Target learning areas where student scored C in 2 or more of the last 3 classes
2. SECONDARY (40% of activities): Reinforce areas where student excelled (A grades) to build confidence
3. If student has no clear weaknesses, provide balanced enrichment across all areas

CRITICAL INSTRUCTIONS FOR PARENT-FRIENDLY ACTIVITIES:
- Make each activity completely self-contained and easy to understand
- Do NOT reference specific class activities, stories, or topics (like "Jack and the Beanstalk" or specific themes from class)
- Do NOT assume parents know what was taught in class
- Use simple, general descriptions that any parent can follow
- Explain concepts clearly (e.g., instead of saying "the 4 stages", say "four stages of plant growth: seed, sprout, seedling, full plant")
- Activities should work for parents with basic English skills
- Focus on the core skill being practiced, not replicating class activities

For EACH activity:
- Name the learning area being targeted (e.g., sequencing, counting, pattern recognition)
- Describe the activity in simple, clear steps using ONLY PlayPack items (beads/playdoh/number tiles)
- Make sure any concepts (like plant stages, shapes, etc.) are explained within the activity itself

Keep total reply per child under 200 words.
Very important: The response must not contain m-dashes ("\u2014"). Replace them with colons where appropriate.

IMPORTANT: Output the reports in the same order as the children listed above. Separate each child's report with EXACTLY this line (nothing else on that line):
===STUDENT_SEPARATOR===

Do NOT include "Child 1:", "Child 2:", or any student numbers/names as headers in your output - start directly with each child's report content.`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          max_completion_tokens: 2000 * batchStudents.length,
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      const fullText = result.choices?.[0]?.message?.content?.trim() || "";

      // Split by separator and clean up student markers
      const reports = fullText
        .split(/===STUDENT_SEPARATOR===/)
        .map((r: string) => r.replace(/^===STUDENT \d+===\s*/i, '').trim())
        .filter((r: string) => r.length > 0);

      return new Response(JSON.stringify({
        reports,
        studentCount: batchStudents.length,
        reportsReturned: reports.length,
        usage: result.usage
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "process_learning_summary_queue") {
      // Background task: Process queued learning summary updates
      const { data: queueItems, error: queueError } = await supabaseClient
        .from('learning_summary_queue')
        .select('id, student_id, students(student_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10); // Process up to 10 at a time

      if (queueError) {
        console.error('[Queue] Error fetching queue:', queueError);
        throw new Error(queueError.message);
      }

      if (!queueItems || queueItems.length === 0) {
        return new Response(JSON.stringify({
          message: 'No items in queue',
          processed: 0
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[Queue] Processing ${queueItems.length} learning summary updates`);
      const results = [];

      for (const item of queueItems) {
        const studentId = item.student_id;
        const studentName = item.students?.student_name || 'Unknown';

        try {
          // Mark as processing
          await supabaseClient
            .from('learning_summary_queue')
            .update({ status: 'processing' })
            .eq('id', item.id);

          // Fetch last 4 reports (to skip most recent and use previous 3)
          const { data: recentReports, error: reportsError } = await supabaseClient
            .from('reports')
            .select('report_body, created_at')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .limit(4);

          if (reportsError) throw reportsError;

          // Use previous 3 reports (skip the most recent)
          const previousReports = recentReports?.length > 1 ? recentReports.slice(1, 4) : [];

          if (previousReports.length === 0) {
            // Not enough reports yet
            await supabaseClient
              .from('learning_summary_queue')
              .delete()
              .eq('id', item.id);

            results.push({ student_id: studentId, status: 'skipped', reason: 'insufficient_reports' });
            continue;
          }

          // Build context
          const reportsContext = previousReports.map((r, idx) =>
            `Class ${idx + 1} (most recent first):\n${r.report_body}`
          ).join('\n\n---\n\n');

          // Call OpenAI
          const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-5-mini",
              messages: [
                {
                  role: "system",
                  content: `You are an AI assistant that analyzes student progress reports and generates concise learning summaries.`,
                },
                {
                  role: "user",
                  content: `Student: ${studentName}

Here are the last ${previousReports.length} class reports:

${reportsContext}

Generate a concise learning summary (max 120 words) capturing:
1. Overall learning trajectory
2. Key strengths and areas of excellence
3. Areas needing ongoing attention
4. Notable trends across classes

Use clear, direct language.`,
                },
              ],
              max_completion_tokens: 200,
            }),
          });

          const openaiResult = await openaiResponse.json();

          if (openaiResult.error) throw new Error(openaiResult.error.message);

          const summary = openaiResult.choices?.[0]?.message?.content?.trim() || "";

          // Update student's learning_summary
          if (summary) {
            await supabaseClient
              .from('students')
              .update({ learning_summary: summary })
              .eq('student_id', studentId);
          }

          // Mark as completed and remove from queue
          await supabaseClient
            .from('learning_summary_queue')
            .delete()
            .eq('id', item.id);

          results.push({ student_id: studentId, status: 'completed', summary_length: summary.length });
          console.log(`[Queue] ✓ Completed for ${studentName}`);

        } catch (error) {
          console.error(`[Queue] Error processing ${studentName}:`, error);

          // Mark as failed
          await supabaseClient
            .from('learning_summary_queue')
            .update({
              status: 'failed',
              error_message: error.message,
              processed_at: new Date().toISOString()
            })
            .eq('id', item.id);

          results.push({ student_id: studentId, status: 'failed', error: error.message });
        }
      }

      return new Response(JSON.stringify({
        processed: queueItems.length,
        results
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "fetch_batches") {
      // Workaround for CORS/525 error on REST API - fetch batches via edge function
      const { teacherId } = data;

      let query = supabaseClient
        .from('batches')
        .select('batch_id, batch_name, batch_code, center_name')
        .eq('is_active', true);

      // If teacherId provided, filter by it (maintains RLS security)
      if (teacherId) {
        query = query.eq('teacher_id', teacherId);
      }

      const { data: batches, error } = await query;

      if (error) {
        console.error('[fetch_batches] Database error:', error);
        throw new Error(error.message);
      }

      console.log(`[fetch_batches] Successfully fetched ${batches?.length || 0} batches`);

      return new Response(JSON.stringify({ batches }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "generate_learning_summary") {
      const { studentName, reportsContext, reportCount } = data;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `You are an AI assistant that analyzes student progress reports and generates concise learning summaries. Your task is to identify patterns, trends, and key insights from recent class reports to create a brief summary that will be used in future report generation.`,
            },
            {
              role: "user",
              content: `Student: ${studentName}

Here are the last ${reportCount} class reports for this student:

${reportsContext}

Based on these reports, generate a concise learning summary (max 120 words) that captures:
1. Overall learning trajectory (improving, consistent, needs support in specific areas)
2. Key strengths and areas of consistent excellence
3. Areas that need ongoing attention or practice
4. Any notable trends or patterns across the last 3 classes

This summary will be used to personalize future reports and track recent progress. Focus on actionable insights and observable patterns from the last 3 classes. Use clear, direct language.`,
            },
          ],
          max_completion_tokens: 200,
        }),
      });

      const result = await response.json();

      console.log("[Learning Summary] OpenAI API Response Status:", response.status);
      console.log("[Learning Summary] Full OpenAI Result:", JSON.stringify(result, null, 2));

      if (result.error) {
        console.error("[Learning Summary] OpenAI API Error:", result.error);
        throw new Error(result.error.message);
      }

      const summary = result.choices?.[0]?.message?.content?.trim() || "";
      console.log("[Learning Summary] Extracted summary length:", summary.length);
      console.log("[Learning Summary] Extracted summary:", summary);

      return new Response(JSON.stringify({ summary }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
