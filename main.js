// --- Claude API (the agent's "brain") ---
// Get this from console.anthropic.com -> API Keys
ANTHROPIC_API_KEY=

// --- Twilio (texting) ---
// Get these from console.twilio.com after creating a free trial account
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=      # the Twilio number you're assigned, e.g. +15551234567
OWNER_PHONE_NUMBER=       # YOUR real phone number, e.g. +14075551234

// --- Budget guardrails ---
TOTAL_BUDGET_USD=100
// Agent will NEVER mark a spend as approved without a YES reply to a text.
// It also refuses to recommend any single spend above this without extra confirmation.
MAX_SINGLE_SPEND_USD=25

// --- Schedule ---
// How often the agent runs its decision loop, in cron syntax. Default: every 4 hours.
RUN_SCHEDULE_CRON=0 */4 * * *

// --- Optional: virtual card for auto-pay on approved recurring spend (leave blank to disable) ---
PRIVACY_API_KEY=

require("dotenv").config();
const express = require("express");
const cron = require("node-cron");

const { decideNextAction } = require("./lib/claude");
const { sendText } = require("./lib/sms");
const { load, save, logEvent, remainingBudget } = require("./lib/state");

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio sends form-encoded webhooks

const PORT = process.env.PORT || 3000;

// ---- Core decision loop ----
async function runCycle() {
  let state = load();

  if (state.pending) {
    console.log("[agent] Still waiting on a reply for a pending approval — skipping this cycle.");
    return;
  }

  console.log("[agent] Running decision cycle...");
  const decision = await decideNextAction(state);

  if (decision.requires_approval) {
    const cost = decision.estimated_cost_usd;
    if (cost && cost > remainingBudget(state)) {
      await sendText(
        `Agent wanted to spend $${cost} on: ${decision.sms_message} ...but that's more than your remaining budget ($${remainingBudget(state)}). Skipping.`
      );
      logEvent("declined", { reason: "over_budget", decision });
      return;
    }

    state = logEvent("approval_requested", decision);
    state.pending = decision;
    save(state);
    await sendText(decision.sms_message);
    console.log("[agent] Sent approval request via SMS, waiting for reply.");
  } else {
    logEvent(decision.action_type, decision.result);
    console.log(`[agent] Completed autonomous action: ${decision.action_type}`);
  }
}

// ---- Twilio inbound webhook: owner's YES/NO reply lands here ----
app.post("/sms-webhook", async (req, res) => {
  const body = (req.body.Body || "").trim().toLowerCase();
  let state = load();

  if (!state.pending) {
    await sendText("No pending decision right now — nothing to approve.");
    res.status(200).end();
    return;
  }

  if (body === "yes" || body === "y") {
    const decision = state.pending;
    logEvent("approved", decision);

    if (decision.estimated_cost_usd) {
      state = load();
      state.budget_spent += decision.estimated_cost_usd;
    }
    state = load();
    state.pending = null;
    save(state);

    await sendText(
      `Approved and logged. Next step is on you to execute (e.g. complete the purchase/publish) unless it's set up for auto-pay. I'll keep going from here.`
    );
  } else if (body === "no" || body === "n") {
    logEvent("declined", state.pending);
    state.pending = null;
    save(state);
    await sendText("Got it, skipping that. I'll propose something else next cycle.");
  } else {
    await sendText('Reply YES or NO to the pending decision.');
  }

  res.status(200).end();
});

app.get("/", (req, res) => {
  const state = load();
  res.json({
    status: "running",
    budget_remaining: remainingBudget(state),
    pending_approval: !!state.pending,
    history_length: state.history.length
  });
});

// ---- Scheduler ----
const schedule = process.env.RUN_SCHEDULE_CRON || "0 */4 * * *";
cron.schedule(schedule, runCycle);

app.listen(PORT, () => {
  console.log(`[agent] Server listening on port ${PORT}. Schedule: ${schedule}`);
  console.log(`[agent] Set your Twilio webhook URL to: https://<your-deployed-url>/sms-webhook`);
});

{
  "name": "ai-business-agent",
  "version": "1.0.0",
  "description": "Autonomous AI agent that runs a $100 digital-product business, texting the owner for approval on key decisions.",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "node-cron": "^3.0.3",
    "twilio": "^5.2.2",
    "dotenv": "^16.4.5",
    "node-fetch": "^2.7.0"
  }
}

// Your AI Business Agent — Setup Guide

This agent runs on its own, decides what to do next every 4 hours, does research/writing
automatically, and **texts you** when it wants to spend money or publish something. You reply
YES or NO. Nothing gets spent or published without your reply.

// What you need to sign up for (all outside of Claude)

1. **Anthropic API key** — console.anthropic.com → API Keys → Create Key.
   This is billed separately from your Claude.ai subscription, pay-as-you-go, likely a few
   dollars a month at this run frequency.
2. **Twilio account** — twilio.com/try-twilio. Free trial gives you credit to start.
   You'll get a phone number for the agent to text from.
3. **Railway account** — railway.app. This is where the app runs 24/7. Free tier / a few
   dollars a month covers this project easily.
4. A GitHub account, to hold the code so Railway can deploy it (github.com, free).

// Step 1 — Get the code onto GitHub

1. Create a new repository on GitHub, e.g. `ai-business-agent`.
2. Upload everything in this project folder to that repo (drag-and-drop on github.com works,
   or `git push` if you're comfortable with git).

// Step 2 — Set up Twilio

1. In the Twilio console, buy/claim your free trial phone number.
2. Note down: Account SID, Auth Token, and your new Twilio phone number.
3. Verify your **own** phone number in Twilio (required on trial accounts before it can text you).

// Step 3 — Deploy to Railway

1. New Project → Deploy from GitHub repo → select `ai-business-agent`.
2. Railway will detect `package.json` and run `npm install` + `npm start` automatically.
3. Go to the project's **Variables** tab and add everything from `.env.example`:
   - `ANTHROPIC_API_KEY`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OWNER_PHONE_NUMBER`
   - `TOTAL_BUDGET_USD=100`, `MAX_SINGLE_SPEND_USD=25`
   - `RUN_SCHEDULE_CRON=0 */4 * * *`
4. Once deployed, Railway gives you a public URL like `https://ai-business-agent-production.up.railway.app`.

// Step 4 — Connect Twilio to your deployed app

1. In Twilio console → your phone number's settings → "A Message Comes In".
2. Set the webhook to: `https://<your-railway-url>/sms-webhook` (method: HTTP POST).
3. Save.

Now when the agent texts you and you reply YES/NO, Twilio forwards your reply to the app.

// Step 5 — Sanity check

Visit `https://<your-railway-url>/` in a browser — you should see a JSON status page showing
budget remaining and history length. That confirms it's alive.

The agent will run its first decision cycle at the next scheduled time (every 4 hours by
default — edit `RUN_SCHEDULE_CRON` if you want it sooner, e.g. `*/30 * * * *` for every 30 min
while you're testing).

// How approvals work

- Agent decides on a research/writing task → does it automatically, no text.
- Agent decides it needs to spend money or publish something public → texts you with a clear
  explanation and a cost estimate → **waits** (does nothing else until you reply).
- You reply YES → it's logged as approved. For anything Etsy/Canva/domain-related, **you still
  need to go complete that step yourself** (these platforms require a human login). The agent
  isn't currently wired to auto-pay anything — see "Optional: auto-pay" below.
- You reply NO → it moves on and proposes something else next cycle.

// Optional: auto-pay for recurring costs (off by default)

For things like a recurring subscription where a real payment API exists (e.g. a spend-capped
virtual card from privacy.com), you can extend `lib/sms.js`'s approval handler to trigger an
actual charge after a YES. I left this out by default — start manual, turn it on once you trust
the agent's judgement.

// Costs to expect against your $100

- Railway hosting: ~$5/mo
- Twilio: ~$1-2/mo + a fraction of a cent per text
- Anthropic API: a few dollars/mo at 6 runs/day
- **Realistic runway: 3-5 months before infrastructure eats the full $100**, so the business
  needs to start earning before then. First goal: get real products listed within week 1.

const fetch = require("node-fetch");

const MODEL = "claude-sonnet-4-6";

/**
 * Ask Claude to decide the next action given the agent's current state.
 * Returns a structured decision the agent can act on.
 */
async function decideNextAction(state) {
  const systemPrompt = `You are the autonomous operator of a small business.
Owner's starting budget: $${state.budget_total}. Spent so far: $${state.budget_spent}.
Current business info: ${JSON.stringify(state.business)}
Recent history (most recent last): ${JSON.stringify(state.history.slice(-10))}

IMPORTANT CONTEXT: the owner already has a live Etsy shop selling shirt designs. Listings have
been up 2-8 weeks with barely any views and zero sales. This points to a discoverability problem
(titles/tags not matching real search terms, thin photos, or a brand-new shop with no sales
history yet) rather than a "the designs are bad" problem.

Your FIRST PRIORITY for the next several cycles is diagnosing and fixing the existing shop:
- Research what buyers actually search for in this niche (real keyword phrases, not guesses)
- Propose specific title/tag rewrites for the existing listings
- Identify photo/mockup gaps
- Only propose a brand new niche or new product line once the existing shop's discoverability
  issue has been addressed and given a few weeks to show results.

Your job each run: propose exactly ONE next concrete action.
Rules:
- If the action requires spending money, signing up for a paid account, or publishing something
  publicly, set "requires_approval": true and write a clear one-sentence text message for the owner
  explaining what you want to do and why, ending in "Reply YES to approve or NO to skip."
- If the action is pure research, drafting, or writing (no money, nothing public), set
  "requires_approval": false and just do the work yourself, returning the output in "result".
- Never propose a single spend above $${process.env.MAX_SINGLE_SPEND_USD || 25} without flagging
  it as high-cost in the message.
- Be concrete. Not "research the market" but "here are the 3 niches with the best demand-to-
  competition ratio on Etsy right now, with reasoning."

Respond ONLY with JSON, no markdown fences, matching this shape:
{
  "action_type": "research" | "draft_content" | "recommend_spend" | "recommend_publish",
  "requires_approval": true | false,
  "sms_message": "string or null",
  "result": "string - the actual research/content/output, or null if awaiting approval",
  "estimated_cost_usd": number or null
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: "user", content: "Decide and return the next action now." }
      ]
    })
  });

  const data = await response.json();
  const text = data?.content?.find((b) => b.type === "text")?.text || "{}";
  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    return {
      action_type: "research",
      requires_approval: false,
      sms_message: null,
      result: `[Agent error parsing decision, raw output: ${text}]`,
      estimated_cost_usd: null
    };
  }
}

module.exports = { decideNextAction };

const twilio = require("twilio");

function getClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendText(body) {
  const client = getClient();
  return client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: process.env.OWNER_PHONE_NUMBER
  });
}

module.exports = { sendText };
