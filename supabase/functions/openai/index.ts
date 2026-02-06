import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const SYSTEM_PROMPT = `You are an AI teaching assistant for a preschool enrichment program. You analyze teacher-provided skill ratings for each child and generate friendly, parent-facing feedback and short home activities using the PlayPack – a box of educational toys. There are 4 ratings: Excellent, Good, Needs Practice and Absent for class (abbreviated A, B, C and X, respectively). Keep the tone warm, supportive, and encouraging. Prioritize educational tasks for those fields in which the child has done poorly, but also those where they have done very well – thus encouraging them in easy tasks while getting them to improve in weak areas.
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
                  text: `Extract all data from this gradesheet image. Look carefully for:
1. center_student_id (a 4-digit number, usually in the first column or next to names)
2. Student names
3. Activity/assessment names (usually column headers)
4. Grades for each student per activity
5. Class name written on the topsheet (e.g. "Cuddly Koala A", "Funny Bunny B", or anything in front of the "class name" section on the top left)
6. Session number visible on the top left of the sheet

Return ONLY a valid JSON object in this EXACT format:
{
  "sessionNumber": "1" or null,
  "className": "Class name" or null,
  "activities": ["Activity 1", "Activity 2", ...],
  "students": [
    {"center_student_id": "0001", "name": "Student Name", "grades": ["A", "B", ...]},
    {"center_student_id": "0002", "name": "Another Student", "grades": ["B", "A", ...]}
  ]
}

IMPORTANT:
- center_student_id should contain the student ID (a 4-digit number like "0001", "0042"). Extract it if visible.
- If student ID is not visible for a student, use null
- grades array must match activities array in order
- Use "A" for Excellent, "B" for Good, "C" for Needs Practice, "X" for Absent
- If a grade is unclear, use empty string ""`,
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

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "generate_report") {
      const { studentName, activityGrades } = data;

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
              content: `Child: ${studentName}\n\nActivity Ratings:\n${activityGrades}\n\nFor each child, generate:\n1. A 3-4 line summary in friendly tone.\n2. 3-4 fun, 15-minute home activities.\nKeep total reply per child under 200 words.\nVery important: The response must not contain m-dashes ("—"). Replace them with colons where appropriate.`,
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
