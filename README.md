# Friday (ARCHITECT) - v1

An autonomous business-planning agent. Runs on a schedule, thinks through
a "council" decision internally using Claude, writes its plan to this
GitHub repo, and emails you when it needs approval before doing anything
that costs money or goes public.

## What v1 does (and doesn't)

- Reasons using Claude only - **no live web search yet**. It's instructed
  to say when it's reasoning from general knowledge rather than verified
  current data. Search can be added once this loop is proven reliable.
- Writes `business_plan.md` and `ideas.md` to this repo every cycle.
- Emails you (via its own dedicated Gmail account) when it has a
  recommendation that needs your approval.
- Does NOT spend money, post content, or take any real-world action yet -
  that comes in v2, once the planning loop itself is solid.

## Setup

### 1. GitHub
This code needs to live in its own repo (e.g. `Friday`), separate from
Remy. Upload the unzipped folder contents (not pasted text) to preserve
file structure.

### 2. Gmail (dedicated account for Friday)
Create a new Gmail account just for Friday - don't reuse Remy's or your
personal one. Then:
1. Enable 2-Step Verification on that account
2. Generate an "App Password" (Google Account -> Security -> App Passwords)
3. Use that app password as `GMAIL_APP_PASSWORD` below (not the regular
   login password)

### 3. GitHub token
Create a GitHub Personal Access Token (classic) with `repo` scope, so
Friday can commit `business_plan.md` / `ideas.md` updates.

### 4. Railway
1. New Railway project, deployed from the Friday GitHub repo
2. In the Variables tab, set:

```
ANTHROPIC_API_KEY=your key
GITHUB_TOKEN=your github token
GITHUB_OWNER=sanorg24
GITHUB_REPO=Friday
GMAIL_USER=fridays-new-gmail@gmail.com
GMAIL_APP_PASSWORD=the app password from step 2
OWNER_EMAIL=your real email
RUN_SCHEDULE_CRON=0 */6 * * *
```

Never put any of these values inside a `.js` file - Variables tab only.

### 5. Verify
After first deploy, check Railway logs for:
```
Friday is running. Schedule: 0 */6 * * *
```
And check that `business_plan.md` / `ideas.md` appeared in the GitHub repo,
plus a first approval email in your inbox.

## Cost notes

- Every cycle = one Claude API call (~4000 tokens output). At the default
  6-hour schedule that's 4 calls/day. Check actual cost in the Anthropic
  console under Usage.
- Railway charges for the service staying up 24/7, separate from API cost.
- Track both separately from Remy's costs since these are different
  Railway projects / API keys.

## Known fix already applied

Remy had a bug where email replies routed back to the owner's own inbox
instead of to Remy, breaking reply-in-thread. Friday's `lib/email.js`
sets `replyTo` to Friday's own Gmail address from the start, so this
shouldn't recur - but if replies aren't reaching Friday, check that line
first.
