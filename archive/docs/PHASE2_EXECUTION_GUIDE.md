# Phase 2 Execution Guide: Database Cleanup

## Overview
This guide walks you through cleaning the Sportime database to keep only:
- **Liga** (Spanish La Liga)
- **FC Barcelona** team
- **FC Barcelona players**

All other leagues, teams, and players will be permanently deleted.

---

## ⚠️ IMPORTANT WARNINGS

1. **BACKUP FIRST**: This operation is irreversible. Make sure you have a database backup.
2. **CASCADE DELETES**: Deleting leagues/teams/players will cascade to related tables (fixtures, stats, predictions, etc.)
3. **STAGING vs PRODUCTION**: We're cleaning both production (`leagues`, `teams`, `players`) AND staging (`fb_leagues`, `fb_teams`, `fb_players`)

---

## Execution Order

### Step 0: Backup (CRITICAL)
```bash
# Create a backup of your Supabase database
npx supabase db dump -f backup_before_cleanup.sql
```

### Step 1: Identify What Will Be Kept/Deleted
```bash
# Run this to see IDs and counts
psql $DATABASE_URL -f PHASE2_STEP1_IDENTIFY_IDS.sql
```

**Review the output carefully:**
- Liga should show `api_league_id = 140`
- FC Barcelona should appear in teams
- Barcelona players count should be ~25-30

**STOP HERE** if the IDs don't match your expectations!

---

### Step 2: Clean Production Leagues
```bash
psql $DATABASE_URL -f PHASE2_STEP2_CLEAN_LEAGUES.sql
```

**This script:**
1. Shows preview of what will be deleted
2. Has DELETE commented out by default
3. You must **edit the file** and uncomment the DELETE line to execute

**What gets deleted:**
- All non-Liga leagues
- CASCADE: team_league_participation, challenge_leagues, fixtures, player_season_stats, odds, matchday_fixtures, swipe_predictions

**After uncommenting DELETE:**
```bash
psql $DATABASE_URL -f PHASE2_STEP2_CLEAN_LEAGUES.sql
```

---

### Step 3: Clean Production Teams
```bash
psql $DATABASE_URL -f PHASE2_STEP3_CLEAN_TEAMS.sql
```

**This script:**
1. Shows preview of teams to delete
2. DELETE is commented out
3. Edit file and uncomment to execute

**What gets deleted:**
- All non-Barcelona teams
- CASCADE: player_team_association, team_league_participation, fixtures (home/away), player_match_stats

**After uncommenting DELETE:**
```bash
psql $DATABASE_URL -f PHASE2_STEP3_CLEAN_TEAMS.sql
```

---

### Step 4: Clean Production Players
```bash
psql $DATABASE_URL -f PHASE2_STEP4_CLEAN_PLAYERS.sql
```

**This script:**
1. Shows Barcelona players to keep
2. Shows count of players to delete
3. DELETE is commented out

**What gets deleted:**
- All non-Barcelona players
- CASCADE: player_team_association, player_season_stats, player_match_stats, player_transfer_history

**After uncommenting DELETE:**
```bash
psql $DATABASE_URL -f PHASE2_STEP4_CLEAN_PLAYERS.sql
```

---

### Step 5: Verify Production Cleanup
```bash
psql $DATABASE_URL -f PHASE2_STEP5_VERIFY_FINAL_STATE.sql
```

**Expected results:**
- `leagues`: 1 row (Liga)
- `teams`: 1 row (FC Barcelona)
- `players`: ~25-30 rows (Barcelona squad)
- `team_league_participation`: 1 row
- `player_team_association`: ~25-30 rows
- All orphaned counts: 0

**STOP HERE** if results don't match expectations!

---

### Step 6: Clean Staging Tables (fb_*)
```bash
psql $DATABASE_URL -f PHASE2_STEP6_CLEAN_FB_STAGING.sql
```

**This script:**
1. Cleans `fb_leagues`, `fb_teams`, `fb_players`, `fb_fixtures`, `fb_odds`
2. Has two options:
   - **Option A**: Delete non-Liga data (recommended)
   - **Option B**: TRUNCATE all staging tables (nuclear)

**This fixes the "Reorder Leagues" modal showing 4 leagues instead of 1**

**Choose Option A** (uncomment DELETE statements) or **Option B** (uncomment TRUNCATE)

```bash
psql $DATABASE_URL -f PHASE2_STEP6_CLEAN_FB_STAGING.sql
```

---

### Step 7: Clear Browser Cache
```javascript
// In your browser console (F12 → Console tab)
localStorage.removeItem('userLeagueOrder')
location.reload()
```

This clears the cached league order so the modal reloads fresh data.

---

## Verification Checklist

After completing all steps, verify:

### Production Tables ✓
- [ ] `leagues` table has only 1 row (Liga)
- [ ] `teams` table has only 1 row (FC Barcelona)
- [ ] `players` table has ~25-30 rows (Barcelona players)
- [ ] No orphaned rows in junction tables

### Staging Tables ✓
- [ ] `fb_leagues` table has only 1 row (Liga)
- [ ] `fb_teams` table has FC Barcelona
- [ ] `fb_fixtures` table has only Liga fixtures

### Application ✓
- [ ] "Reorder Leagues" modal shows only Liga
- [ ] Players admin page shows only Barcelona players
- [ ] Matches page shows only Liga fixtures
- [ ] Team filter in Players page shows only Barcelona

---

## Rollback Plan

If something goes wrong:

```bash
# Restore from backup
psql $DATABASE_URL -f backup_before_cleanup.sql
```

---

## Next Steps (Future Phases)

After Phase 2 is complete and verified:

### Phase 1: Remove Staging Tables (Optional)
- Drop `fb_*` tables entirely
- Update code to use production tables directly
- Remove sync triggers

### Phase 3: Rename to fb_* Prefix (Future)
- Rename `leagues` → `fb_leagues`
- Update all code references
- Prepare for multi-sport architecture (bb_*, tn_*, etc.)

---

## Troubleshooting

### "Cannot delete due to foreign key constraint"
- Check the dependency map in the exploration results
- You may need to delete child tables first
- Or modify CASCADE behavior

### "Too many rows deleted"
- Stop execution
- Restore from backup
- Review STEP1 output again
- Adjust WHERE clauses in DELETE statements

### "Modal still shows 4 leagues"
- Clear localStorage: `localStorage.removeItem('userLeagueOrder')`
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Check `fb_leagues` table still has old data

---

## Support

If you encounter issues:
1. Check the verification script output
2. Review PostgreSQL error messages
3. Ensure backup exists before retrying
4. Consider executing one table at a time instead of CASCADE

---

**Ready to execute? Start with Step 0 (Backup) and proceed carefully!**
