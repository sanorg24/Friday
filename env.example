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

module.exports = { writeFile, fetchFile };
