const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const PORT = 8065;

const app = express();

const keyFile = path.join(__dirname, 'alpine-realm-381711-c882a05f7e41.json');

async function getVideoUrl() {
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
  });

  const youtube = google.youtube({
    version: 'v3',
    auth,
  });

  const playlists = await youtube.playlists.list({
    part: 'snippet',
    channelId: 'UCFKE7WVJfvaHW5q283SxchA',
    maxResults: 50,
  });

  const month = new Date().toLocaleString('default', { month: 'long' });
  let selectedPlaylist = playlists.data.items.find((playlist) =>
    playlist.snippet.title.includes(month)
  );

  console.log('Selected Playlist:', selectedPlaylist);

  if (!selectedPlaylist) {
    selectedPlaylist = playlists.data.items[0];
  }

  const playlistItems = await youtube.playlistItems.list({
    part: 'snippet',
    playlistId: selectedPlaylist.id,
    maxResults: 50,
  });

  const videoIndex = new Date().getDate() - 1;
  const videoId = playlistItems.data.items[videoIndex].snippet.resourceId.videoId;
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}

app.get('/', async (req, res) => {
  try {
    const videoUrl = await getVideoUrl();
    res.send(`<html><body><script>window.location.replace("${videoUrl}");</script></body></html>`);
  } catch (error) {
    res.status(500).send('Error fetching video URL');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
