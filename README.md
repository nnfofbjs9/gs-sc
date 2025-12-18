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
