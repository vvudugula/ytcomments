const express = require('express');
const { google } = require('googleapis');

const app = express();

// YouTube API setup
const youtube = google.youtube({
  version: 'v3',
  auth: 'AIzaSyAEsRWAHfTFAyBzR3OYp_sC4g5m4mzQccs', // Replace with your API key
});

app.get('/youtube/videos/:channelId', async (req, res) => {
  const channelId = req.params.channelId;

  try {
    const response = await youtube.search.list({
      part: 'snippet',
      channelId: channelId,
      maxResults: 50, // Maximum number of results per page (adjust as needed)
      type: 'video',
    });
	const videos = response.data.items.map((item) => {
      return {
        title: item.snippet.title,
        videoId: item.id.videoId,
      };
    });

    res.json({ videos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Endpoint to get comments for a video
app.get('/youtube/comments/:videoId', async (req, res) => {
  const videoId = req.params.videoId;

  try {
    const response = await youtube.commentThreads.list({
      part: 'snippet',
      videoId: videoId,
      maxResults: 1000000, // Maximum number of comments to retrieve per request
    });

    const comments = response.data.items
	.filter((item) => {
        const textOriginal = item.snippet.topLevelComment.snippet.textOriginal.toLowerCase();
        return textOriginal.includes('ask'); // Change 'ask' to the desired keyword
      }).
	map((item) => {
      return {
        author: item.snippet.topLevelComment.snippet.authorDisplayName,
        text: item.snippet.topLevelComment.snippet.textOriginal,
      };
    });

    res.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
  
});

async function getAllVideosFromChannel(channelId) {
  try {
    const response = await youtube.search.list({
      part: 'snippet',
      channelId: channelId,
      maxResults: 50, // Maximum number of results per page (adjust as needed)
      type: 'video',
    });

    return response.data.items.map((item) => item.id.videoId);
  } catch (error) {
    console.error('Error fetching videos:', error);
    return [];
  }
}

app.get('/youtube/commentsbyask/:channelId', async (req, res) => {
  const channelId = req.params.channelId;

 try {
    const videoIds = await getAllVideosFromChannel(channelId);

    const commentsPromises = videoIds.map(async (videoId) => {
      const commentsResponse = await youtube.commentThreads.list({
        part: 'snippet',
        videoId: videoId,
        maxResults: 1000000, // Maximum number of comments to retrieve per request
      });

      return commentsResponse.data.items
        .filter((item) => {
          const textOriginal = item.snippet.topLevelComment.snippet.textOriginal.toLowerCase();
          return true;//textOriginal.includes('ask'); // Change 'ask' to the desired keyword
        })
        .map((item) => {
          return {
            videoId: videoId,
            author: item.snippet.topLevelComment.snippet.authorDisplayName,
            text: item.snippet.topLevelComment.snippet.textOriginal,
          };
        });
    });

    const comments = await Promise.all(commentsPromises).then((result) => result.flat());

    res.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});


// Start the server
const port = 3000; // Replace with your desired port number
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
