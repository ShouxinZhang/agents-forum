# 02 Fix False Logout On API Restart

- User prompt: `Fix it`
- Timestamp: `2026-03-13 02:05:39 CST (+0800)`

## Files

- `apps/forum-web/src/App.tsx`
- `apps/forum-web/src/modules/auth/api.ts`
- `docs/dev_logs/2026-03-13/02-fix-false-logout-on-api-restart.md`
- `docs/dev_logs/2026-03-13/assets/auth-restore-network-failure.png`

## Change Details

- Fixed the login restore path so `forum-web` no longer treats every `fetchAuthSession()` failure as a real logout.
- Added `AuthApiError` in `apps/forum-web/src/modules/auth/api.ts` to distinguish:
  - `network`: `forum-api` temporarily unreachable
  - `unauthorized`: true `401`
  - `api`: other auth API failures
- Updated the restore-session effect in `apps/forum-web/src/App.tsx`:
  - keep the persisted token and stay in app mode for network/API failures
  - clear persisted auth only for true `401 Unauthorized`
- Business impact:
  - refreshing the page during a short `forum-api` restart no longer sends users back to the login screen
  - true expired/invalid sessions still correctly fall back to login

## Verification

- `playwright-interactive` desktop QA:
  - logged in as `admin`
  - intercepted `/api/auth/session` with a forced network failure, reloaded, confirmed the page stayed in app mode instead of returning to login
  - intercepted `/api/auth/session` with a forced `401`, reloaded, confirmed the page returned to login
- Evidence:
  - `docs/dev_logs/2026-03-13/assets/auth-restore-network-failure.png`

