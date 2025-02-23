const fs = require('fs');
const puppeteer = require('puppeteer');
const { exec } = require("child_process");

// File to log output
const logFile = 'livestream_log.txt';
const CHANNEL_URL = 'https://www.youtube.com/@stonypointbaptistchurch1909/live'; 
const HTML_FILE = 'livestream.html';

// Function to log messages
function logMessage(message) {
    const logEntry = `[${new Date().toLocaleString()}] - ${message}\n`;
    console.log(logEntry); // Log to console
    fs.appendFileSync(logFile, logEntry); // Log to file
}

// Function to execute shell commands and log their output
function runCommand(command, callback) {
    logMessage(`Running command: ${command}`);
    exec(command, { cwd: "C:/Users/SPBC Streaming PC/Desktop/Github/liveStream" }, (error, stdout, stderr) => {
        if (error) {
            logMessage(`Error: ${error.message}`);
            return;
        }
        if (stderr) {
            logMessage(`Stderr: ${stderr}`);
            return;
        }
        logMessage(`Command Output: ${stdout}`);
        if (callback) callback();
    });
}

async function getLiveStreamID() {
    try {
        logMessage('Launching Puppeteer...');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        logMessage('Opening YouTube Live page...');
        await page.goto(CHANNEL_URL, { waitUntil: 'load', timeout: 30000 });

        // Wait for the video element to load
        logMessage('Waiting for the canonical link...');
        await page.waitForSelector('link[rel="canonical"]', { timeout: 10000 });

        // Get the video URL from the canonical link
        const videoUrl = await page.$eval('link[rel="canonical"]', el => el.href);
        logMessage(`Video URL: ${videoUrl}`);

        await browser.close();

        // Extract Video ID
        const videoIdMatch = videoUrl.match(/watch\?v=([\w-]+)/);
        return videoIdMatch ? videoIdMatch[1] : null;
    } catch (error) {
        logMessage(`Error in getLiveStreamID: ${error.message}`);
    }
}

async function updateLivestream() {
    logMessage('Fetching latest livestream...');
    const videoId = await getLiveStreamID();
    if (!videoId) {
        logMessage('No active livestream found.');
        return;
    }

    logMessage(`Latest livestream ID: ${videoId}`);

    let htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Livestream</title>
</head>
<body>
    <iframe id="liveStream" width="100%" height="100%" 
        src="https://www.youtube.com/embed/${videoId}"
        frameborder="0" allowfullscreen>
    </iframe>
</body>
</html>`;

    try {
        logMessage(`Writing HTML content to ${HTML_FILE}`);
        fs.writeFileSync(HTML_FILE, htmlContent);
        logMessage(`Updated livestream to Video ID: ${videoId}`);

        // Log git status to see the state before committing
        runCommand('git status', () => {
            runCommand('git add --renormalize .', () => {
                // Log status again before commit to verify if changes are staged
                runCommand('git status', () => {
                    runCommand(`git commit -m "Auto-update: ${new Date().toLocaleString()}"`, () => {
                        runCommand('git push origin main', (error, stdout, stderr) => {
                            if (error || stderr) {
                                logMessage('Push failed:', error || stderr);
                            } else {
                                logMessage('Successfully pushed to GitHub!');
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        logMessage(`Error during updateLivestream: ${error.message}`);
    }
}

logMessage('Starting script...');
updateLivestream();