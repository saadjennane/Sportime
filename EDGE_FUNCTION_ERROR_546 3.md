# Edge Function Error 546 - Investigation

## 🚨 Current Issue

**Error**: `POST https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/seed-fantasy-data 546`

**Status Code 546**: This is NOT a standard HTTP status code. Possible causes:

1. **Supabase Edge Function Timeout**: The function may be timing out before completing
2. **Memory Limit Exceeded**: Edge Functions have memory limits
3. **Connection Reset**: Network connection was reset during processing
4. **Rate Limiting**: Supabase may be rate limiting the function invocation

## 🔍 Investigation Steps

### Step 1: Check Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions/seed-fantasy-data/logs
2. Look for the most recent invocation (timestamp matching when you clicked the button)
3. Check for any error messages, warnings, or where it stopped

**What to look for**:
- Did it reach Phase 1 (Seed Leagues)?
- Did it complete any phases successfully?
- Are there any JavaScript errors?
- Did it timeout during execution?

### Step 2: Check Edge Function Invocation Settings

1. Go to: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions/seed-fantasy-data
2. Check the function configuration:
   - **Timeout**: Should be set to maximum (ideally 300s or higher)
   - **Memory**: Should be sufficient for processing
   - **Environment Variables**: Confirm all are set

### Step 3: Potential Issues and Solutions

#### Issue A: Edge Function Timeout (Most Likely)

**Problem**: The Edge Function is designed to run for 4-8 hours, but Supabase Edge Functions have execution time limits (typically 1-5 minutes).

**Solution**: We need to redesign the Edge Function to be async/non-blocking:

**Option 1**: Use Supabase Database Webhooks
- Store seeding tasks in a queue table
- Process tasks incrementally with separate function calls
- Track progress in database

**Option 2**: Use Background Processing
- Make Edge Function return immediately after starting the process
- Use Supabase Realtime to report progress
- Process batches asynchronously

**Option 3**: Client-Side Orchestration
- Break down the process into smaller API calls from the Admin UI
- Admin UI manages the orchestration and progress
- Each API call seeds a specific league/team/player

#### Issue B: Memory Limit

**Problem**: Loading and processing large amounts of data exceeds Edge Function memory limits.

**Solution**:
- Process data in smaller batches
- Don't load all data at once
- Stream results instead of accumulating

#### Issue C: API-Football Rate Limiting

**Problem**: Making too many requests too quickly to API-Football.

**Solution**:
- Increase delay between API calls (currently 500ms)
- Implement exponential backoff
- Batch requests more efficiently

## 🛠️ Recommended Fix: Client-Side Orchestration

Since Edge Functions have strict time limits, the best approach is to break the seeding process into smaller, manageable chunks orchestrated by the Admin UI.

### New Architecture:

```
Admin UI → Multiple Edge Function Calls → Database
   ↓
1. Seed League 1 (POST /seed-league)
2. Seed Teams for League 1 (POST /seed-teams?league=2)
3. Seed Players for League 1 (POST /seed-players?league=2)
4. Seed Stats for League 1 (POST /seed-stats?league=2)
5. Repeat for League 2, 3, etc.
```

**Advantages**:
- Each function call completes within timeout
- Progress can be tracked in real-time
- Can pause/resume easily
- Better error handling per stage

**Implementation**:
- Create separate Edge Functions for each phase
- Admin UI orchestrates the sequence
- Progress stored in database
- UI polls for status updates

## 📋 Immediate Action

**Please check the Edge Function logs and report back**:

1. Go to logs: https://supabase.com/dashboard/project/crypuzduplbzbmvefvzr/functions/seed-fantasy-data/logs
2. Find the latest invocation (should be from a few minutes ago)
3. Share:
   - What phase did it reach?
   - What was the last log message?
   - Was there any error message?
   - How long did it run before stopping?

This will help determine if it's a timeout issue or something else.

## 🔧 Quick Test

To verify the Edge Function works for small operations, try this:

1. Temporarily modify the Admin UI to only seed 1 league instead of 3
2. Change `fantasyLeagueIds` to just `"2"` (only Champions League)
3. Click "Start Fantasy Data Seeding" again
4. See if it completes successfully for a single league

If it works for 1 league but fails for 3, then we know it's a timeout issue and need to redesign the architecture.
