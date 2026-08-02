require('dotenv').config();
const cron = require('node-cron');
const { runCouncilCycle } = require('./lib/claude');
const { writeFile, fetchFile } = require('./lib/github');
const { sendApprovalEmail } = require('./lib/email');

async function runCycle() {
  console.log(`[${new Date().toISOString()}] Starting cycle...`);

  try {
    const previousPlan = await fetchFile('business_plan.md');
    const result = await runCouncilCycle(previousPlan);

    // Always write the plan and ideas files, even if no owner approval is
    // needed yet - this is the "memory" of what's been decided so far.
    await writeFile('business_plan.md', result.business_plan_md, 'ARCHITECT cycle update');
    await writeFile('ideas.md', result.ideas_md, 'ARCHITECT cycle update');

    console.log(`[${new Date().toISOString()}] Cycle complete. Confidence: ${result.confidence}`);

    if (result.requires_owner_approval) {
      const subject = `Friday needs your approval: ${result.next_action.slice(0, 60)}`;
      const body = `RECOMMENDATION:\n${result.recommendation}\n\nREASONING:\n${result.reasoning}\n\nNEXT ACTION:\n${result.next_action}\n\nCONFIDENCE: ${result.confidence}\n\n---\nReply to this email to send Friday your decision.`;
      await sendApprovalEmail({ subject, body });
      console.log(`[${new Date().toISOString()}] Approval email sent to owner.`);
    } else {
      console.log(`[${new Date().toISOString()}] No owner approval needed this cycle: ${result.next_action}`);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Cycle failed:`, err);
  }
}

// Run once on startup so you can verify it works immediately after deploy,
// then follow the configured schedule after that.
runCycle();

const schedule = process.env.RUN_SCHEDULE_CRON || '0 */6 * * *';
cron.schedule(schedule, runCycle);

console.log(`Friday is running. Schedule: ${schedule}`);
