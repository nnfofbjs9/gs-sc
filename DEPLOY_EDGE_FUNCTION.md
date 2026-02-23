# Deploy Edge Function to Supabase

The `learning_summary` field is not being populated because the edge function needs to be deployed to Supabase.

## Quick Deploy (Recommended)

1. **Install Supabase CLI** (if not already installed):
```bash
npm install -g supabase
```

2. **Login to Supabase**:
```bash
supabase login
```

3. **Link your project** (if not already linked):
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

You can find your PROJECT_REF in your Supabase dashboard URL:
`https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

4. **Deploy the edge function**:
```bash
supabase functions deploy openai
```

This will deploy the `openai` edge function with the `generate_learning_summary` action.

## Verify Deployment

After deployment, test it by:

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** section
3. You should see the `openai` function listed
4. Check the **Logs** to see if it's responding correctly

## Alternative: Deploy via Supabase Dashboard

If you don't want to use the CLI:

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click **Create Function** or **Upload Function**
4. Upload the file: `supabase/functions/openai/index.ts`
5. Name it: `openai`
6. Click **Deploy**

## After Deployment

Once deployed, test the learning summary feature by:

1. Generating reports for a batch
2. Check the browser console for logs like:
   - `[Learning Summary] Starting update for X students`
   - `[Learning Summary] ✓ Successfully updated DB for [student name]`
3. Verify in the database that the `learning_summary` column is now populated

## Troubleshooting

### "Command not found: supabase"
Install the Supabase CLI:
```bash
npm install -g supabase
```

### "Not logged in"
Run:
```bash
supabase login
```

### "Project not linked"
Run:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Edge function deployment failed
- Check that you have the correct API keys set in Supabase Dashboard:
  - Go to **Settings** → **API**
  - Ensure `OPENAI_API_KEY` is set as a secret

To set the secret:
```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

## Expected Result

After deployment, when you generate reports:

1. Reports will be generated normally
2. After saving, the system will:
   - Fetch the last 5 reports for each student
   - Call OpenAI to generate a learning summary
   - Update the `students.learning_summary` column
3. Future reports will use this summary to provide more personalized feedback
