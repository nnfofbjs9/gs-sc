# Topsheet - Vercel Deployment

## Project Structure

```
your-project/
├── index.html          # Main app (renamed from index_v7_edge.html)
├── api/
│   └── openai.js       # Edge Function for OpenAI calls
└── vercel.json         # (optional) Vercel configuration
```

## Deployment Steps

### 1. Set Up Environment Variable in Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key (sk-...)
   - **Environment:** Production (and Preview if you want)
4. Click **Save**

### 2. Deploy the Files

Option A: **Via Vercel Dashboard**
1. Zip these files maintaining the folder structure
2. Drag and drop to Vercel

Option B: **Via Git**
1. Push these files to your GitHub repo
2. Vercel will auto-deploy

Option C: **Via Vercel CLI**
```bash
npm i -g vercel
cd your-project
vercel --prod
```

### 3. Test the App

1. Visit your Vercel URL
2. Sign up / Sign in
3. Upload a topsheet image
4. The app should now work without asking for an API key!

## How It Works

- Users authenticate via Supabase
- The frontend calls `/api/openai` (our Edge Function)
- The Edge Function:
  - Verifies the user is authenticated (checks Supabase token)
  - Makes the actual OpenAI API call using the server-side API key
  - Returns results to the frontend
- Your API key is never exposed to users

## Security Notes

- The Edge Function checks for a valid Supabase auth token
- Only authenticated users can use the API
- Your OpenAI key stays on the server
- Rate limiting can be added to the Edge Function if needed

## Files Included

- `index.html` - Main React app with Supabase auth
- `supabase/functions/openai/index.ts` - Supabase Edge Function for OpenAI calls

## WhatsApp Integration

The app supports sending reports directly to parents via WhatsApp.

### Database Requirements

The app uses the existing schema:
- `students` table with `parent_id` foreign key
- `parents` table with `phone` column

Parent phone numbers are fetched via: `students.parent_id` -> `parents.phone`

### Student Matching

Students from scanned topsheets are matched to database records by:
1. **Center Student ID** (a 4-digit, center-scoped identifier written on the worksheet). This match is performed **center-wide**, so a student visiting from another class within the same center will still be matched.
2. **Name matching** (fallback - case-insensitive, partial matching, class-level only)

Students not found in the database will be flagged with "Not in DB" and their reports won't be saved.

### Phone Number Format

- Store phone numbers with country code (e.g., `6591234567` for Singapore)
- If only 8 digits are provided (local Singapore number), the app will automatically prepend `65`
- The app uses the WhatsApp Click-to-Chat API (`wa.me`) to open chats

### How It Works

1. When generating reports, the app matches students from the topsheet to database records
2. Parent phone is fetched via the `parents` table join
3. If a phone number is found, the WhatsApp button opens a chat with that number
4. If no phone number is stored, WhatsApp opens with the message so you can manually select a contact
5. When sent, the `reports.sent_to` and `reports.sent_at` fields are updated

### Features

- **Edit Reports**: Teachers can edit the AI-generated report text before sending
- **Save Changes**: Save edited reports back to the database (only for students matched in DB)
- **Send via WhatsApp**: Individual button per student to send that report
- **Send All via WhatsApp**: Bulk send to all parents with phone numbers (opens multiple tabs)
- **Sent Status**: Reports show "Sent" badge after WhatsApp is opened

## Caveats

### Center Student ID (`center_student_id`)

Each student is assigned a unique 4-digit identifier scoped to their center (e.g., `0001`, `0042`). This ID is:
- **Auto-generated** when a new student is added (via a database trigger).
- **Unique within a center** -- no two students at the same center share an ID.
- **Stable** -- it never changes, even if the student moves between classes within the center.

Teachers write this ID on the physical worksheet. OCR extracts it and uses it as the primary matching key.

### Students Temporarily Attending a Different Class

A student can attend 1-2 sessions of a different class without any database changes. The teacher simply writes the student's `center_student_id` on that class's worksheet. The matching logic searches **all students in the center** (not just the selected class) when matching by ID, so the student will be found and their report will be generated and linked correctly.

The session record still belongs to the class it was created for. The student's home `class_id` in the `students` table does not change.

### Students Transferring to a Different Center

If a student permanently moves to a different center:
1. Add them as a new student at the new center (they will receive a new `center_student_id` at that center).
2. Optionally deactivate or remove their record at the old center.
3. Their historical reports at the old center remain intact.

### Capacity

Each center supports up to 9,999 students (IDs `0001`-`9999`). The trigger will raise an error if this limit is exceeded.
