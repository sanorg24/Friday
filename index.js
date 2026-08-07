require('dotenv').config();
const cron = require('node-cron');
const { runCouncilCycle } = require('./lib/claude');
const { writeFile, fetchFile, appendToLog } = require('./lib/github');
const { sendMessage, getNewMessages } = require('./lib/telegram');

async function runCycle() {
  console.log(`[${new Date().toISOString()}] Starting cycle...`);

  try {
    const previousPlan = await fetchFile('business_plan.md');
    const memoryLog = await fetchFile('memory.md');
    // Keep only the most recent ~8000 characters of memory in the prompt so
    // token usage/cost doesn't grow forever - the full history still lives
    // in memory.md on GitHub even if older entries get trimmed from context.
    const recentMemory = memoryLog ? memoryLog.slice(-8000) : null;

    const result = await runCouncilCycle(previousPlan, recentMemory);

    // Always write the plan and ideas files, even if no owner approval is
    // needed yet - this is the "memory" of what's been decided so far.
    await writeFile('business_plan.md', result.business_plan_md, 'ARCHITECT cycle update');
    await writeFile('ideas.md', result.ideas_md, 'ARCHITECT cycle update');

    if (result.memory_entry) {
      await appendToLog('memory.md', result.memory_entry);
    }

    console.log(`[${new Date().toISOString()}] Cycle complete. Confidence: ${result.confidence}`);

    if (result.requires_owner_approval) {
      const message = `🤖 Friday needs your approval\n\nRECOMMENDATION:\n${result.recommendation}\n\nREASONING:\n${result.reasoning}\n\nNEXT ACTION:\n${result.next_action}\n\nCONFIDENCE: ${result.confidence}`;
      await sendMessage(message);
      console.log(`[${new Date().toISOString()}] Telegram message sent to owner.`);
    } else {
      console.log(`[${new Date().toISOString()}] No owner approval needed this cycle: ${result.next_action}`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Cycle failed:`, err);
  }
}

async function checkMessages() {
  try {
    const messages = await getNewMessages();
    for (const text of messages) {
      console.log(`[${new Date().toISOString()}] Received message: ${text}`);
      await sendMessage(`Got it, thanks: "${text}"\n\nI've logged this and will factor it into my next planning cycle.`);
      await appendToLog(
        'memory.md',
        `OWNER MESSAGE received via Telegram: "${text}"\n\nTreat this as a direct instruction or piece of context from the owner. Take it into account in the next cycle, and explain in your reasoning how you addressed it.`
      );
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Message check failed:`, err);
  }
}

// Run once on startup so you can verify it works immediately after deploy,
// then follow the configured schedule after that.
runCycle();

const schedule = process.env.RUN_SCHEDULE_CRON || '0 */6 * * *';
cron.schedule(schedule, runCycle);

// Separate, much faster loop just for checking/acknowledging incoming
// Telegram messages - this is what makes the chat feel two-way instead
// of Friday only ever speaking on its 6-hour schedule.
setInterval(checkMessages, 30 * 1000);

console.log(`Friday is running. Schedule: ${schedule}. Checking for messages every 30s.`);
