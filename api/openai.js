export const config = {
  runtime: 'edge',
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify the request has a valid Supabase token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { action, data } = body;

    if (action === 'extract') {
      // Vision API call using /v1/responses with gpt-5-nano
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          input: [
            {
              type: 'input_text',
              text: 'Extract student gradesheet data from this image. The gradesheet should show students in rows and activities/assessments in columns. Return ONLY a JSON object with this exact format: {"activities": ["Activity 1", "Activity 2", ...], "students": [{"name": "Student Name", "grades": ["A", "B", "C", ...]}, ...]}. The grades array should match the activities array in order. Use "A" for Excellent, "B" for Good, "C" for Needs Practice, "X" for Absent. If a grade is unclear, use empty string "".',
            },
            {
              type: 'input_image',
              image: data.image, // Raw base64, no data:image/... prefix
            },
          ],
          max_output_tokens: 7000,
          text: { format: { type: 'json_object' } },
          temperature: 0,
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Transform response to match old format for frontend compatibility
      const transformedResult = {
        choices: [{
          message: {
            content: result.output?.[0]?.content || result.output_text || JSON.stringify(result)
          }
        }]
      };

      return new Response(JSON.stringify(transformedResult), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } else if (action === 'generate_report') {
      // Generate report using /v1/responses with gpt-5-nano
      const { studentName, activityGrades } = data;

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-5-nano',
          instructions: SYSTEM_PROMPT,
          input: [
            {
              type: 'input_text',
              text: `Child: ${studentName}\n\nActivity Ratings:\n${activityGrades}\n\nFor each child, generate:
1. A 3-4 line summary in friendly tone.
2. 3-4 fun, 15-minute home activities.
Keep total reply per child under 200 words.
Very important: The response must not contain m-dashes ("—"). Replace them with colons where appropriate.`,
            },
          ],
          max_output_tokens: 4000,
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      // Transform response to match old format for frontend compatibility
      const transformedResult = {
        choices: [{
          message: {
            content: result.output?.[0]?.content || result.output_text || ''
          }
        }]
      };

      return new Response(JSON.stringify(transformedResult), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
