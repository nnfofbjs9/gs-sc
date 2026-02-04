# Gradesheet Scanner - Vercel Deployment

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
3. Upload a gradesheet image
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
- `api/openai.js` - Vercel Edge Function using gpt-5-mini model

## WhatsApp Integration

The app supports sending reports directly to parents via WhatsApp. To use this feature:

### Database Setup

Add the `parent_phone` column to your `students` table in Supabase:

```sql
ALTER TABLE students ADD COLUMN parent_phone VARCHAR(20);
```

### Phone Number Format

- Store phone numbers with country code (e.g., `6591234567` for Singapore)
- If only 8 digits are provided (local Singapore number), the app will automatically prepend `65`
- The app uses the WhatsApp Web API (`wa.me`) to open chats

### How It Works

1. When generating reports, the app matches students from the gradesheet to database records
2. If a `parent_phone` is found, the WhatsApp button will open a chat with that number
3. If no phone number is stored, the button opens WhatsApp with the message so you can select a contact manually

### Features

- **Edit Reports**: Teachers can edit the AI-generated report text before sending
- **Save Changes**: Save edited reports back to the database
- **Send via WhatsApp**: Individual button per student to send that report
- **Send All via WhatsApp**: Bulk send to all parents with phone numbers (opens multiple tabs)
