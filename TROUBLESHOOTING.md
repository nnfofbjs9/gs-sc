# Troubleshooting Guide

A reference log of errors encountered, their root causes, and how they were resolved.

---

## Empty GPT response / empty report generated

**Symptom**
- Report is blank or missing content after scanning
- No visible error, but OpenAI returned nothing useful

**Root Cause**
The response exceeded the `max_completion_tokens` limit set on the OpenAI API call. When the output is truncated, the result can come back empty or malformed.

**Fix**
Investigate why the response is so long (e.g. too many students, overly verbose prompt), or increase `max_completion_tokens` in `supabase/functions/openai/index.ts`.

---

## `NetworkError when attempting to fetch resource`

**Symptom**
- Console error: `Error: NetworkError when attempting to fetch resource.`
- Scanning or report generation fails immediately

**Root Cause**
The edge function is unavailable — usually because it needs to be redeployed after a Supabase update or after the function code has changed.

**Fix**
Redeploy the edge function:
```bash
supabase functions deploy openai --no-verify-jwt
```

---

## [2026-03-15] Empty batch dropdown in Scanner / `[Batch] ✗ No batchCode extracted from OCR or no batches loaded`

**Symptom**
- Batch dropdown in the Scanner shows no options
- Console warning: `[Batch] ✗ No batchCode extracted from OCR or no batches loaded`
- On-screen error shown after scanning a sheet

**Root Cause**
`loadBatches` was refactored to route through `fetchBatchesWithFallback`. That function has a silent `catch` that returns `[]` on any error. On mount, `isSiteAdmin` is `false` (set asynchronously), so the first call queries with `teacher_id = user.id`. Since neither Akshat nor Ami own any batches directly (batches belong to other teachers), this returns 0 results — silently. By the time `isSiteAdmin` flips to `true` and re-triggers the effect, the damage is done and batches stay empty.

The original `loadBatches` queried Supabase directly and relied on RLS (`is_site_admin()`) to grant site admins visibility of all batches — which works correctly.

**Fix**
Reverted `loadBatches` to the original direct Supabase query. `fetchBatchesWithFallback` remains available for 525/SSL edge cases but is no longer used in the normal load path.

```js
// CORRECT — direct query, RLS handles admin visibility
const loadBatches = async () => {
    let query = supabase
        .from('batches')
        .select('batch_id, batch_name, batch_code, center_name')
        .eq('is_active', true);
    if (!isSiteAdmin) {
        query = query.eq('teacher_id', user.id);
    }
    const { data, error } = await query;
    if (!error && data) {
        setBatches(data);
    } else if (error) {
        console.error('[loadBatches] Error:', error);
    }
};
```

**Key lesson**
Never route batch/session loading through a helper that swallows errors silently. Admin visibility is handled by RLS — don't replicate that logic in JS. If `isSiteAdmin` is involved, the async timing means the first render will always have `isSiteAdmin = false`; rely on the `useEffect([isSiteAdmin])` re-run with the direct query rather than a fallback chain.

---

## [2026-03-15] CORS restriction broke Vercel preview deployments

**Symptom**
- Scanner worked on production URL but failed on Vercel preview/staging URLs
- Error looked identical to a cold start CORS error, making it hard to diagnose

**Root Cause**
Edge function CORS was restricted to a hardcoded list of known domains. Vercel generates a unique URL for every branch, commit, and PR — these were never in the allowlist.

**Fix**
Reverted to wildcard CORS (`"Access-Control-Allow-Origin": "*"`). This is safe because every request already requires a valid Supabase JWT — that is the real auth layer.

See CLAUDE.md for the correct CORS config to prevent regression.

---

## [2026-03-15] Cold start warm-up ping not working

**Symptom**
- First scan after inactivity would fail with a connection error after exhausting all retries
- Warm-up ping was completing but the function was still cold when the user scanned

**Root Cause**
The warm-up used a raw `fetch` with a 5s timeout. Edge function cold boot takes 5-20s, so the ping would time out and give up — leaving the function still cold. The next real request hit the cold start itself.

**Fix**
Routed warm-up through `callOpenAI` so it uses the same retry logic (3 attempts, exponential backoff). The function is now guaranteed warm before the user can upload.
