import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SYSTEM_PROMPT = `You are an AI teaching assistant for a preschool enrichment program. You analyze teacher-provided learning area ratings for each child and generate friendly, parent-facing feedback and short home activities using the PlayPack – a box of educational toys. There are 4 ratings: Excellent, Good, Needs Practice and Absent for class (abbreviated A, B, C and X, respectively). Keep the tone warm, supportive, and encouraging. Prioritize educational tasks for those fields in which the child has done poorly, but also those where they have done very well – thus encouraging them in easy tasks while getting them to improve in weak areas.
The kit contains the following elements beads, playdoh, number tiles (dominos with numbers on them but without dots). Don't require much extra work from the parent even as little as asking them to draw something.
Be very careful that the activities are completely safe for children. None of the activities should involve putting anything in the mouth, climbing or putting oneself or others in danger in anyway.
For each child, generate:
1. A 3–4 line summary in friendly tone.
2. 3-4 fun, 15-minute home activities.
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    if (action === "extract") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-nano",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract gradesheet data. Return ONLY valid JSON in this EXACT format:
{"classNumber":"1","level":"1","batchCode":"001","activities":["Activity 1","Activity 2"],"students":[{"center_student_id":"0001","name":"Student Name","grades":["A","B"]}]}

Extract:
1. center_student_id: 4-digit number (e.g. "0001"), null if not visible
2. Student names
3. Activity names (column headers)
4. Grades: "A"=Excellent, "B"=Good, "C"=Needs Practice, "X"=Absent, ""=unclear
5. batchCode: numeric code (e.g. "001")
6. classNumber: 1-36 (top left of sheet)
7. level: 1-5

grades array must match activities array order.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${data.image}`,
                    detail: "high"
                  },
                },
              ],
            },
          ],
          max_completion_tokens: 4000,
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
      const { studentName, activityGrades, activityDefinitions, level, classNumber } = data;

      // Build activity context from definitions if provided
      let activityContext = "";
      if (activityDefinitions && Array.isArray(activityDefinitions) && activityDefinitions.length > 0) {
        activityContext = "\n\nActivity Definitions (for context):\n";
        activityDefinitions.forEach((activity: any) => {
          activityContext += `- ${activity.activityName}`;
          if (activity.learningArea) {
            activityContext += ` (${activity.learningArea})`;
          }
          if (activity.description) {
            activityContext += `: ${activity.description}`;
          }
          activityContext += "\n";
        });
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-5-nano",
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: `Child: ${studentName}\n\nActivity Ratings:\n${activityGrades}${activityContext}\n\nFor each child, generate:\n1. A 3-4 line summary in friendly tone.\n2. 3-4 fun, 15-minute home activities.\nKeep total reply per child under 200 words.\nVery important: The response must not contain m-dashes ("—"). Replace them with colons where appropriate.`,
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
