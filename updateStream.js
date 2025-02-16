const fs = require('fs');

const puppeteer = require('puppeteer');



const CHANNEL_URL = 'https://www.youtube.com/@stonypointbaptistchurch1909/live'; // Replace with your actual channel URL

const HTML_FILE = 'livestream.html';



async function getLiveStreamID() {

    const browser = await puppeteer.launch({ headless: true });

    const page = await browser.newPage();



    console.log('Opening YouTube Live page...');

    await page.goto(CHANNEL_URL, { waitUntil: 'load', timeout: 30000 });



    // Wait for the video element to load

    await page.waitForSelector('link[rel="canonical"]', { timeout: 10000 });



    // Get the video URL from the canonical link

    const videoUrl = await page.$eval('link[rel="canonical"]', el => el.href);

    

    await browser.close();



    // Extract Video ID

    const videoIdMatch = videoUrl.match(/watch\?v=([\w-]+)/);

    return videoIdMatch ? videoIdMatch[1] : null;

}



async function updateLivestream() {

    console.log('Fetching latest livestream...');

    const videoId = await getLiveStreamID();

    if (!videoId) {

        console.log('No active livestream found.');

        return;

    }



    console.log(`Latest livestream ID: ${videoId}`);



    let htmlContent = `<!DOCTYPE html>

<html>

<head>

    <title>Livestream</title>

</head>

<body>

    <iframe id="liveStream" width="560" height="315" 

        src="https://www.youtube.com/embed/${videoId}"

        frameborder="0" allowfullscreen>

    </iframe>

</body>

</html>`;



    fs.writeFileSync(HTML_FILE, htmlContent);

    console.log(`Updated livestream to Video ID: ${videoId}`);

}



updateLivestream();

