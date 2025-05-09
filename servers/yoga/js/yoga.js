const puppeteer = require('puppeteer');
const express = require('express');
const cron = require('node-cron');
const PORT = 8065;
const app = express();

async function extractPlaylistIdAndVideoUrl(channelUrl, playlistTitle, videoIndex) {

    // Launch a new browser instance
    const browser = await puppeteer.launch({
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-features=VizDisplayCompositor'
        ]
    });

    const page = await browser.newPage();

    // Navigate to the channel's feature page
    await page.goto(channelUrl, { waitUntil: 'networkidle2' });

    // Log the page title to confirm the page has loaded
    const pageTitle = await page.title();
    console.log(`Page Title: ${pageTitle}`);

    // Handle cookie consent popup
    try {
        await page.waitForSelector('button[aria-label="Accept all"]', { timeout: 5000 });
        const consentButton = await page.$('button[aria-label="Accept all"]');
        if (consentButton) {
            await consentButton.click();
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
            console.log('Cookie consent accepted.');
        } else {
            console.log('Cookie consent button not found.');
        }
    } catch (error) {
        console.error('Cookie consent not found or failed to accept:', error);
    }

    // Wait for the page to load and the playlist links to be available
    try {
        await page.waitForSelector('a[href*="/playlist?list="]', { timeout: 10000 }); // Increased timeout to 60 seconds
    } catch (error) {
        console.error('Selector not found within the timeout period:', error);

        // Log the page content to the console for debugging
        const pageContent = await page.content();
        console.log(pageContent);

        await browser.close();
        return;
    }

    // Extract the playlist ID with the specified title
    const playlistData = await page.evaluate((targetTitle) => {
        const playlists = document.querySelectorAll('a[href*="/playlist?list="]');
        for (const playlist of playlists) {
            const titleElement = playlist.querySelector('span#title');
            if (titleElement && titleElement.textContent.trim().includes(targetTitle)) {
                const playlistId = playlist.href.split('/playlist?list=')[1];
                return { title: titleElement.textContent.trim(), id: playlistId };
            }
        }
        return null;
    }, playlistTitle);

    if (playlistData) {
        const playlistUrl = `https://www.youtube.com/playlist?list=${playlistData.id}`;
        console.log(`Playlist URL: ${playlistUrl}`);
        console.log(`Playlist Title: ${playlistData.title}`);

        // Navigate to the playlist page
        await page.goto(playlistUrl, { waitUntil: 'networkidle2' });

        // Wait for the video links to be available
        try {
            await page.waitForSelector('a#video-title', { timeout: 5000 }); // Increased timeout to 60 seconds
        } catch (error) {
            console.error('Video links not found within the timeout period:', error);

            await browser.close();
            return;
        }

        // Extract the URL of the specified video index
        const videoUrl = await page.evaluate((index) => {
            const videoLinks = document.querySelectorAll('a#video-title');
            if (index < videoLinks.length) {
                const videoLink = videoLinks[index];
                const videoHref = videoLink.href;
                return videoHref;
            }
            return null;
        }, videoIndex - 1); // - 1 because array indices are 0-based

        if (videoUrl) {
            console.log(`URL of the ${videoIndex}th video: ${videoUrl}`);
            return videoUrl;
        } else {
            console.log('Video not found.');
        }
    } else {
        console.log('Playlist not found.');
    }

    // Close the browser
    await browser.close();
}

async function updateCachedVideoUrl() {
    const channelFeatureUrl = 'https://www.youtube.com/channel/UCFKE7WVJfvaHW5q283SxchA/featured';
    const targetPlaylistTitle = new Date().toLocaleString('default', { month: 'long' });
    const videoIndex = new Date().getDate();

    try {
        const videoUrl = await extractPlaylistIdAndVideoUrl(channelFeatureUrl, targetPlaylistTitle, videoIndex);
        if (videoUrl) {
            cachedVideoUrl = videoUrl;
            console.log('Cached video URL updated:', cachedVideoUrl);
        } else {
            console.log('Failed to update cached video URL.');
        }
    } catch (error) {
        console.error('Error fetching video URL:', error);
    }
}

// Schedule the update to run daily at 00:01
cron.schedule('1 1 * * *', () => {
    console.log('Updating cached video URL at 00:01');
    updateCachedVideoUrl();
});

// Fetch the video URL and cache it on application start
updateCachedVideoUrl();

// Express route to serve the cached video URL
app.get('/', async (req, res) => {
    try {
        if (cachedVideoUrl) {
            console.log('Serving cached video URL:', cachedVideoUrl);
            res.send(`<html><body><script>window.location.replace("${cachedVideoUrl}");</script></body></html>`);
        } else {
            res.status(500).send('Video URL not available. Please try again later.');
        }
    } catch (error) {
        res.status(500).send('Error fetching video URL');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

