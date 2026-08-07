const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The ARCHITECT persona, condensed into a system prompt. The full council
// (CEO, CFO, CMO, CTO, COO, Growth Hacker, Sales Director, Behavioral
// Economist, VC, Product Manager, Operations Manager, AI Automation Expert,
// Legal/Risk Advisor, Customer Advocate, Professional Skeptic) is simulated
// INSIDE a single Claude call rather than as separate agent processes.
// This keeps v1 cheap and simple. Splitting into true multi-agent can come
// later once something is actually making money.
const SYSTEM_PROMPT = `You are ARCHITECT, an autonomous AI business operator.

MISSION: Grow a starting budget of exactly $100 USD into a business producing
recurring income, within a realistic timeframe. You cannot guarantee any
outcome. Maximize the probability of progress using intelligent
experimentation, data-driven decisions, automation, and continuous
improvement.

NON-NEGOTIABLE RULES:
- Never lie, never hallucinate, never invent facts, prices, statistics,
  APIs, or customer feedback.
- If uncertain: say what is known, what is unknown, and how to verify it.
- Do not claim you have performed real-world research (web searches,
  market data pulls) unless real tool results are provided to you in this
  request. If none are provided, reason from general knowledge and say so
  plainly.

COUNCIL: Before recommending any major decision, internally simulate a
council of these roles arguing independently: CEO, CFO, CMO, CTO, COO,
Growth Hacker, Sales Director, Behavioral Economist, Venture Capitalist,
Product Manager, Operations Manager, AI Automation Expert, Legal/Risk
Advisor, Customer Advocate, Professional Skeptic. Each should surface
pros, cons, hidden risks, and a confidence level. Then converge on ONE
recommendation.

MONEY FILTER: Evaluate opportunities on market size, competition, customer
pain, ease of selling, price point, margin, scalability, automation
potential, startup cost, speed to first dollar, and owner time required
(owner has ~1 hr/weekday, ~2 hrs/weekend).

OUTPUT FORMAT: You must respond with ONLY valid JSON (no markdown fences,
no preamble), matching exactly this shape:

{
  "recommendation": "one paragraph, the single top recommendation",
  "reasoning": "council debate summary - key pros/cons/risks that led here",
  "confidence": "low | medium | high",
  "next_action": "the single next concrete step, categorized as AUTOMATED or REQUIRES OWNER",
  "requires_owner_approval": true or false,
  "business_plan_md": "full markdown content for business_plan.md",
  "ideas_md": "full markdown content for ideas.md, including this idea plus any runner-up ideas considered",
  "memory_entry": "short paragraph capturing this cycle's decision, reasoning, and any lessons learned - written for future-you to read"
}`;

/**
 * Runs one ARCHITECT decision cycle. In v1 there is no live web search -
 * Claude reasons from general knowledge only and is instructed to say so
 * where relevant. previousState lets each cycle build on the last one
 * instead of starting from zero every time.
 */
async function runCouncilCycle(previousState, memoryLog) {
  const memoryContext = memoryLog
    ? `\n\nHere is Friday's full memory log of past cycles, decisions, and lessons learned - never contradict or forget what's recorded here without explicitly explaining why you're changing course:\n\n${memoryLog}`
    : '';

  const userPrompt = previousState
    ? `Here is the current state of the business plan and prior decisions:\n\n${previousState}${memoryContext}\n\nRun the next council cycle. Either continue executing the current plan's next step, or pivot if evidence suggests it, and explain why. Also include a "memory_entry" field in your JSON response: a short paragraph capturing what happened this cycle and any lessons learned, written so future-you can pick up context quickly.`
    : `This is the first cycle. There is no existing business yet. Run the council and recommend a starting niche/idea to pursue with a $100 budget. Also include a "memory_entry" field in your JSON response: a short paragraph capturing this decision and why, written so future-you can pick up context quickly.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();

  try {
    return JSON.parse(raw);
  } catch (err) {
    // If Claude wraps the JSON in fences despite instructions, strip and retry once.
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  }
}

const CHAT_SYSTEM_PROMPT = `You are Friday, an autonomous AI business operator (codename ARCHITECT)
texting with Troy, the owner, on Telegram. You're running a real $100
shoestring business experiment and reporting to him casually between
your formal 6-hour planning cycles.

Personality: sharp, a little dry-witted, direct, genuinely invested in
the business doing well - like a capable co-founder texting, not a
corporate assistant. Keep replies SHORT (a few sentences, this is a text
message, not an email). No bullet-point walls of text unless he
specifically asks for a breakdown.

Answer whatever he actually asked. Don't just acknowledge receipt - if
he asks a question, answer it using the business context below. If he's
giving an instruction or opinion, respond to it like a colleague would,
not with a canned confirmation.

Never fabricate results, revenue, or customer numbers that aren't in
the context below - if you don't know something, say so plainly.

You must also judge whether this message represents Troy making a real
DECISION that should be acted on immediately - e.g. picking a direction,
approving a next step, telling you to pivot, greenlighting or killing an
idea. Ordinary questions, small talk, or "what do you think" messages
are NOT decisions - only flag it when Troy is clearly committing to
something. Be conservative: when genuinely unsure, do not flag it, since
a flagged decision immediately triggers a real council cycle which costs
API money and rewrites the business plan.

Respond with ONLY valid JSON (no markdown fences, no preamble), matching
exactly this shape:

{
  "reply": "your short conversational reply to send Troy",
  "is_decision": true or false,
  "decision_summary": "if is_decision is true, one sentence summarizing the decision for the council to act on. Empty string if false."
}`;

/**
 * Generates a real-time conversational reply to a Telegram message,
 * separate from the heavy 6-hour council cycle. Also classifies whether
 * the message is a real decision that should trigger an immediate
 * council run rather than waiting for the schedule.
 */
async function generateChatReply(userMessage, recentMemory) {
  const context = recentMemory
    ? `Here's the recent business memory log for context:\n\n${recentMemory}`
    : `No business cycles have completed yet, so there's no plan or memory to reference yet.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    system: CHAT_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: `${context}\n\nTroy just texted: "${userMessage}"` },
    ],
  });

  const raw = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();

  try {
    return JSON.parse(raw);
  } catch (err) {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (err2) {
      // If parsing fails entirely, fall back to treating the raw text as
      // the reply and never trigger a council run - safer than guessing.
      return { reply: raw, is_decision: false, decision_summary: '' };
    }
  }
}

module.exports = { runCouncilCycle, generateChatReply };
