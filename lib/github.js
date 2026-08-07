const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

/**
 * Creates or updates a file in the Friday repo. Handles the "does this
 * file already exist" check automatically so callers don't have to.
 */
async function writeFile(path, content, message) {
  let sha;
  try {
    const existing = await octokit.repos.getContent({ owner, repo, path });
    if (!Array.isArray(existing.data)) {
      sha = existing.data.sha;
    }
  } catch (err) {
    if (err.status !== 404) throw err;
    // File doesn't exist yet - that's fine, we're creating it.
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: message || `Update ${path}`,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha,
  });
}

/**
 * Reads a file from the repo. Returns null if it doesn't exist yet
 * (e.g. business_plan.md on the very first cycle).
 */
async function fetchFile(path) {
  try {
    const res = await octokit.repos.getContent({ owner, repo, path });
    if (Array.isArray(res.data)) return null;
    return Buffer.from(res.data.content, 'base64').toString('utf-8');
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/**
 * Appends a dated entry to a running log file (e.g. memory.md) instead of
 * overwriting it. This is Friday's actual long-term memory - business_plan.md
 * gets rewritten each cycle and can lose nuance, but this file only grows.
 */
async function appendToLog(path, entryText) {
  const existing = await fetchFile(path);
  const date = new Date().toISOString();
  const entry = `\n\n## ${date}\n\n${entryText}`;
  const updated = existing ? existing + entry : `# Friday - Memory Log${entry}`;
  await writeFile(path, updated, `Append memory entry ${date}`);
}

/**
 * Reads/writes the last-processed Telegram update ID as a plain number
 * in a small file, so the "don't reply twice" tracking survives Railway
 * restarts and redeploys instead of resetting to 0 every time.
 */
async function getTelegramOffset() {
  const content = await fetchFile('telegram_offset.txt');
  const parsed = content ? parseInt(content.trim(), 10) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function setTelegramOffset(offset) {
  await writeFile('telegram_offset.txt', String(offset), 'Update Telegram offset');
}

module.exports = { writeFile, fetchFile, appendToLog, getTelegramOffset, setTelegramOffset };
