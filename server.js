const express = require('express');
const { google } = require('googleapis');

const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const allowedOrigins = [
  'http://localhost:4200', // Add your allowed origins here
  'https://www.subupnow.com',
   'https://subupnow.com',
  'https://github.com',
	'https://www.github.com',
  // Add more origins as needed
];

app.use(cors({
  origin: allowedOrigins, // Allow requests from this origin
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true // Include cookies in the requests if needed
}));

const apiKeys = [
  'AIzaSyAEsRWAHfTFAyBzR3OYp_sC4g5m4mzQccs', // bgm
  'AIzaSyA88MzVLgQ0XFAdlf7HpL3P85MuQavJrQQ', // like
  // Add more keys as needed
];
let currentApiKeyIndex = 0;
let youtube;

function initializeYouTubeClient(apiKey) {
  youtube = google.youtube({
    version: 'v3',
    auth: apiKey,
  });
}

initializeYouTubeClient(apiKeys[currentApiKeyIndex]);

// YouTube API setup

function apikeyCheck(error) {
	if (error.response && error.response.status === 403) {
      // If a 403 error occurs, switch to the next API key if available
      if (currentApiKeyIndex < apiKeys.length - 1) {
        console.log('403 Error: Switching to the next API key.');
        currentApiKeyIndex++;
        initializeYouTubeClient(apiKeys[currentApiKeyIndex]);
        return performYouTubeRequest(requestOptions);
      } else {
        console.error('All API keys exhausted. 403 error still persists.');
      }
	}
}
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
	 apikeyCheck(error);
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
  
});

async function getAllVideosFromChannel(channelId) {
  try {
    const response = await youtube.search.list({
      part: 'snippet',
      channelId: channelId,
      maxResults: 1000000, // Maximum number of results per page (adjust as needed)
      type: 'video',
    });

    return response.data.items.map((item) => item.id.videoId);
  } catch (error) {
	  apikeyCheck(error);
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
    apikeyCheck(error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

app.get('/yt/getAll/:channelId', async (req, res) => {
	const channelId = req.params.channelId;
	try {
    const videoIds = await getAllVideosFromChannel(channelId);
    console.log(videoIds);
    const commentsPromises = videoIds.map(async (videoId) => {
      const commentsResponse = await youtube.commentThreads.list({
        part: 'snippet',
        videoId: videoId,
        maxResults: 1000000, // Maximum number of comments to retrieve per request
      });

      return commentsResponse.data.items
        .map((item) => {
          return {
            videoId: videoId,
            author: item.snippet.topLevelComment.snippet.authorDisplayName,
            text: item.snippet.topLevelComment.snippet.textOriginal,
	    time: item.snippet.topLevelComment.snippet.publishedAt
          };
        });
    });

    const comments = await Promise.all(commentsPromises).then((result) => result.flat());

    res.json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    apikeyCheck(error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
  
});

app.get('/yt/search-channels/:search', async (req, res) => {
  const query = req.params.search || ''; // Get the search query from request query params

	console.log(query);
  try {
    const response = await youtube.channels.list({
      part: 'snippet,contentDetails,statistics',
      forUsername: query,
    });
	console.log(response);

    const channels = response.data.items.map(item => ({
      channelId: item.id,
      channelTitle: item.snippet.title
    }));

    res.json(channels);
  } catch (error) {
    console.error('Error fetching channels:', error);
	apikeyCheck(error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});


// API endpoint to get channel details from YouTube video URL

// Function to extract video ID from YouTube URL

function extractVideoId(url) {
  const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([^"&?\/\n\s]{11})/;
  const match = url.match(regExp);

  if (match && match[1]) {
    return match[1];
  } else {
    return null; // Invalid or unrecognized URL format
  }
}


// Function to get video details using YouTube Data API
async function getVideoDetails(videoId) {
	
	const response = await youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: videoId,
    });
	console.log(response);
	
  return response.data.items[0];
}

// Function to get channel details using YouTube Data API
async function getChannelDetails(channelId) {
  const response = await youtube.channels.list({
      part: 'snippet,contentDetails,statistics',
      id: channelId,
    });
	console.log(response);
	
  return response.data.items[0].snippet;
}


app.post('/yt/getChannelDetails', async (req, res) => {
  const { url } = req.body;
	
  // Extract video ID from the URL
  const videoId = extractVideoId(url);

  if (videoId) {
    try {
      // Fetch video details from YouTube Data API
      const videoDetails = await getVideoDetails(videoId);

      if (videoDetails && videoDetails.snippet && videoDetails.snippet.channelId) {
        const channelId = videoDetails.snippet.channelId;
        
        // Fetch channel details using the channel ID
        const channelDetails = await getChannelDetails(channelId);
        res.json({ channel_details: channelDetails, channel_id:	channelId });
      } else {
        res.status(404).json({ error: 'Channel details not found' });
      }
    } catch (error) {
		apikeyCheck(error);
      res.status(500).json({ error: 'Failed to fetch channel details' });
    }
  } else {
    res.status(400).json({ error: 'Invalid YouTube URL' });
  }
});


// Start the server
const port = 3000; // Replace with your desired port number
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
