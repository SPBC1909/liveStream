const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

const REPO_DIR = 'C:/Users/SPBC Streaming PC/Desktop/Github/liveStream';
const LOG_FILE = path.join(REPO_DIR, 'livestream_log.txt');
const HTML_FILE = path.join(REPO_DIR, 'livestream.html');
const CHANNEL_URL = 'https://www.youtube.com/@stonypointbaptistchurch1909/live';
const BRANCH = 'main'; // change to 'master' if that's what your repo uses

function log(message) {
    const entry = `[${new Date().toLocaleString()}] - ${message}`;
    console.log(entry);
    fs.appendFileSync(LOG_FILE, entry + '\n');
}

// Runs a git command and throws (with the real error text) if it fails.
// GIT_TERMINAL_PROMPT=0 makes git fail instead of hanging forever
// if it ever wants a username/password.
function git(args) {
    log(`> git ${args}`);
    try {
        const out = execSync(`git ${args}`, {
            cwd: REPO_DIR,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        });
        if (out.trim()) log(out.trim());
        return out;
    } catch (err) {
        const detail = (err.stderr || err.stdout || err.message || '').toString().trim();
        throw new Error(`git ${args} failed (exit ${err.status}): ${detail}`);
    }
}

function hasStagedChanges() {
    try {
        execSync('git diff --cached --quiet', { cwd: REPO_DIR });
        return false; // exit 0 = nothing staged
    } catch {
        return true;  // exit 1 = there are staged changes
    }
}

async function getLiveStreamID() {
    log('Launching Puppeteer...');
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        log('Opening YouTube Live page...');
        await page.goto(CHANNEL_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        log(`Landed on: ${page.url()}`);

        // Sometimes YouTube redirects straight to the watch page
        let match = page.url().match(/[?&]v=([\w-]{11})/);
        if (match) return match[1];

        const canonical = await page
            .$eval('link[rel="canonical"]', el => el.href)
            .catch(() => null);
        log(`Canonical link: ${canonical}`);

        match = canonical && canonical.match(/[?&]v=([\w-]{11})/);
        return match ? match[1] : null;
    } finally {
        await browser.close();
    }
}

function buildHtml(videoId) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Livestream</title>
    <style>
        /* Make the live stream container maintain a 16:9 aspect ratio */
        .livestream-container {
            position: relative;
            width: 100%;
            height: 0;
            padding-bottom: 56.25%; /* 16:9 aspect ratio */
            overflow: hidden;
        }

        .livestream-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <div class="livestream-container">
        <iframe id="liveStream"
            src="https://www.youtube.com/embed/${videoId}"
            frameborder="0" allowfullscreen>
        </iframe>
    </div>
</body>
</html>
`;
}

(async () => {
    log('Starting script...');
    try {
        // Match GitHub exactly before doing anything, so the push can't be
        // rejected and there's nothing to conflict. livestream.html gets
        // rebuilt from scratch below, so no local work is lost.
        // NOTE: this drops any unpushed local commits. Commit and push
        // edits to this script before running it.
        git(`fetch origin ${BRANCH}`);
        git(`reset --keep origin/${BRANCH}`);

        const videoId = await getLiveStreamID();
        if (!videoId) {
            log('No live or upcoming stream found. Nothing to update.');
            return;
        }
        log(`Livestream ID: ${videoId}`);

        fs.writeFileSync(HTML_FILE, buildHtml(videoId));
        log(`Wrote ${HTML_FILE}`);

        git('add livestream.html');
        if (!hasStagedChanges()) {
            log('livestream.html already has this video ID. Nothing to push.');
            return;
        }

        git(`commit -m "Auto-update livestream: ${videoId}"`);
        git(`push origin ${BRANCH}`);
        log('Successfully pushed to GitHub!');
    } catch (err) {
        log(`FAILED: ${err.message}`);
        process.exitCode = 1;
    }
})();
