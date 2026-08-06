[README.md](https://github.com/user-attachments/files/30805370/README.md)
# Friday (ARCHITECT) - v1

An autonomous business-planning agent. Runs on a schedule, thinks through
a "council" decision internally using Claude, writes its plan to this
GitHub repo, and messages you on Telegram when it needs approval before
doing anything that costs money or goes public.

## What v1 does (and doesn't)

- Reasons using Claude only - **no live web search yet**. It's instructed
  to say when it's reasoning from general knowledge rather than verified
  current data. Search can be added once this loop is proven reliable.
- Writes `business_plan.md` and `ideas.md` to this repo every cycle.
- Messages you on Telegram when it has a recommendation that needs your
  approval.
- Does NOT spend money, post content, or take any real-world action yet -
  that comes in v2, once the planning loop itself is solid.

## Setup

### 1. GitHub
This code needs to live in its own repo (e.g. `Friday`), separate from
Remy. When uploading files that belong in the `lib` folder, either drag
the actual `lib` folder itself into GitHub's upload box, or use
**Add file -> Create new file** and type the path (e.g. `lib/claude.js`)
directly in the filename box - typing a slash makes GitHub create the
folder automatically. Don't upload the files loose into the repo root.

### 2. Telegram bot
1. In the Telegram app, message **@BotFather** and send `/newbot`
2. Give it a name and a username ending in `bot`
3. BotFather replies with a token - this is `TELEGRAM_BOT_TOKEN` below
4. Open a chat with your new bot and send it any message (bots can't
   message you first until you've messaged them)
5. Visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a
   browser - find `"chat":{"id":...}` in the response, that number is
   `TELEGRAM_CHAT_ID` below

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
TELEGRAM_BOT_TOKEN=the token from BotFather
TELEGRAM_CHAT_ID=the chat id from getUpdates
RUN_SCHEDULE_CRON=0 */6 * * *
```

Never put any of these values inside a `.js` file - Variables tab only.

### 5. Verify
After first deploy, check Railway logs for:
```
Friday is running. Schedule: 0 */6 * * *
```
then, after the first cycle finishes, for:
```
Cycle complete. Confidence: ...
```
Check that `business_plan.md` / `ideas.md` appeared in the GitHub repo,
and that a message arrived in your Telegram chat with the bot.

## Cost notes

- Every cycle = one Claude API call (~4000 tokens output). At the default
  6-hour schedule that's 4 calls/day. Check actual cost in the Anthropic
  console under Usage.
- Railway charges for the service staying up 24/7, separate from API cost.
- Telegram messaging itself is free - no per-message cost like WhatsApp/
  Twilio would have had.
- Track costs separately from Remy's since these are different Railway
  projects / API keys.

## Known issue already fixed once

The very first deploy crashed with `MODULE_NOT_FOUND` because `lib/claude.js`
and `lib/github.js` got uploaded loose into the repo root instead of inside
a `lib` folder. If you ever see that error again after editing files on
GitHub, check that everything under `lib/` is actually nested in a `lib`
folder, not sitting in the root.
