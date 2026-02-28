# Project Instructions for Claude Code

## OpenAI Model Information

**CRITICAL**: This project uses `gpt-5-mini` as the OpenAI model.

- ✅ **CORRECT**: `gpt-5-mini`
- ❌ **WRONG**: `gpt-4o-mini`, `gpt-4-mini`, `gpt-4o`, etc.

**Do NOT change `gpt-5-mini` to any other model name unless explicitly requested by the user.**

The model `gpt-5-mini` is valid and currently in use throughout this codebase:
- `supabase/functions/openai/index.ts` - all OpenAI API calls
- Used for: OCR extraction, report generation, learning summary generation

## Project Overview

This is a preschool enrichment program management system with:
- Student grading and report generation
- Parent-facing feedback with PlayPack activities
- Learning summary tracking across classes
- Automated background processing via Supabase Edge Functions

## Key Technologies

- **Frontend**: Vanilla HTML/JavaScript with Alpine.js
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: OpenAI API (via Supabase Edge Functions)
- **Deployment**: Vercel (frontend), Supabase (backend)

## Important Patterns

### Database
- Students belong to batches
- Batches have level (1-5) and class_number (1-36)
- Reports are linked to sessions (which represent a class occurrence)
- Learning summaries are auto-generated from last 3 reports

### Edge Functions
- All OpenAI calls go through `supabase/functions/openai/index.ts`
- Actions: `extract`, `generate_report`, `generate_reports_batch`, `generate_learning_summary`, `process_learning_summary_queue`
- Always use service role key for database operations in edge functions

### Learning Summaries
- Triggered automatically via database trigger when reports are saved
- Requires 2+ reports per student
- Processed via queue system (`learning_summary_queue` table)
- Background processing via edge function

## Coding Standards

### Style
- Use British English spellings (colour, behaviour, etc.)
- Avoid emojis unless explicitly requested
- Keep code simple and maintainable
- Add comments for complex logic

### Git
- Commit messages: conventional format (fix:, feat:, etc.)
- Test before committing
- Use descriptive commit messages

### Testing
- Test locally before deploying edge functions
- Verify database migrations don't break existing data
- Check console logs for errors

## Common Tasks

### Deploy Edge Function
```bash
npx supabase functions deploy openai
```

### Apply Database Migration
```bash
npx supabase db push
# OR if migration history is out of sync:
# Use Supabase MCP tools: mcp__claude_ai_Supabase__execute_sql
```

### Check Logs
- Browser console: [Learning Summary], [Recent Grades], [SaveReports] prefixes
- Supabase Dashboard: Edge Functions → openai → Logs

## File Structure

```
.
├── index.html                      # Main application (frontend)
├── supabase/
│   ├── functions/
│   │   └── openai/
│   │       └── index.ts           # OpenAI edge function
│   └── migrations/                # Database migrations
├── LEARNING_SUMMARY_WORKFLOW.md   # Learning summary documentation
└── CLAUDE.md                      # This file
```

## Known Issues & Quirks

1. **Migration History**: Sometimes out of sync - use MCP tools to execute SQL directly
2. **TypeScript Errors**: Edge function shows TS errors in IDE but works fine when deployed (Deno runtime)
3. **Learning Summary**: Only generates for students with 2+ reports
4. **Queue Processing**: Auto-triggered but can be manually invoked if needed

## CORS Policy — Do Not Restrict

**CRITICAL**: The edge function (`supabase/functions/openai/index.ts`) MUST use `"Access-Control-Allow-Origin": "*"` (wildcard).

**Do NOT restrict CORS to a hardcoded list of domains.** Here is why:

- Vercel generates a unique URL for every branch, commit, and PR (e.g. `gs-sc-git-staging-abc123.vercel.app`)
- A hardcoded allowlist will never cover all of these — any unlisted URL gets blocked immediately
- This looks identical to a cold start CORS error, making it very hard to diagnose
- The wildcard is safe here because **every request already requires a valid Supabase JWT** — that is the real security layer

The correct CORS config in the edge function is:
```typescript
function getCorsHeaders(_origin: string | null) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  };
}
```

## Contact

For questions about requirements or design decisions, ask the user (Akshat).
