// server.js

const Database = require('@replit/database');
const db = new Database();



const express = require('express');
const fetch = require('node-fetch'); 
const cors = require('cors'); // Importing CORS middleware
require('dotenv').config();


const app = express();

const artists = [
  '3TVXtAsR1Inumwj472S9r4', // Drake's Spotify ID
  '1Xyo4u8uXC1ZmMpatF05PJ', // Replace with actual Spotify ID for Eminem
  '6HvZYsbFfjnjFrWF950C9d', // New Jeans' Spotify ID
  '7dGJo4pcD2V6oG8kP0tJRR', // Eminem 
  '2YZyLoL8N0Wb9xBt1NhZWg', // Kendrick 
  '4O15NlyKLIASxsJ0PrXPfz', // lil uzi vert
  '5t5FqBwTcgKTaWmfEbwQY9', // enhypen
  '0iEtIxbK0KxaSlF7G42ZOp', // metro boomin
  '1URnnhqYAYcrqrcwql10ft', // 21 savage 
  '7cYEt1pqMgXJdq00hAwVpT', // chase atlantic
  '2jOm3cYujQx6o1dxuiuqaX', // riize
  '3fMbdgg4jU18AjLCKBhRSm', // michael jackson
  '2ye2Wgw4gimLv2eAKyk1NB', // blackpink
  '3qiHUAX7zY4Qnjx8TNUzVx', // yeat
  '699OTQXzgjhIYAHMy9RyPD', // playboi carti 
  '3cjEqqelV9zb4BYE3qDQ4O', // EXO
];

// Use CORS middleware to allow cross-origin requests (useful if your frontend and backend are served from different origins)
app.use(cors());



// Serve static files from 'public' directory
app.use(express.static('public'));

// Spotify API credentials
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
let spotifyAccessToken = '';

// Function to get Spotify access token using node-fetch
async function getSpotifyAccessToken() {
  const credentials = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64');
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Spotify access token');
    }

    const data = await response.json();
    spotifyAccessToken = data.access_token;
    console.log('Spotify access token successfully retrieved');
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
  }
}
// Function to fetch an artist's albums
async function fetchArtistsAlbums(artistId) {
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album&market=US&limit=5`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${spotifyAccessToken}` },
  });
  const data = await response.json();
  return data.items; // Returns an array of albums
}
// Function to fetch tracks from an album
async function fetchAlbumTracks(albumId) {
  const url = `https://api.spotify.com/v1/albums/${albumId}/tracks?market=US&limit=5`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${spotifyAccessToken}` },
  });
  const data = await response.json();
  return data.items; // Returns an array of tracks
}

// Function to fetch an artist's top tracks
// Elo Rating Update Function
async function updateSongRating(winnerId, loserId) {
  const K = 32;
  const winnerRating = (await db.get(`rating:${winnerId}`)) || 1200;
  const loserRating = (await db.get(`rating:${loserId}`)) || 1200;

  const expectedScoreWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedScoreLoser = 1 - expectedScoreWinner;

  const newWinnerRating = Math.round(winnerRating + K * (1 - expectedScoreWinner));
  const newLoserRating = Math.round(loserRating + K * (0 - expectedScoreLoser));

  await db.set(`rating:${winnerId}`, newWinnerRating);
  await db.set(`rating:${loserId}`, newLoserRating);
}

// Endpoint to handle votes
app.post('/vote', async (req, res) => {
  const { winnerId, loserId } = req.body;
  await updateSongRating(winnerId, loserId);
  res.json({ message: 'Vote processed and ratings updated.' });
});

// Function to get a random song from the Spotify API
app.get('/leaderboard', async (req, res) => {
  const keys = await db.list('rating:');
  let leaderboard = [];

  for (const key of keys) {
    const songId = key.replace('rating:', ''); // Extract songId correctly
    const rating = await db.get(key);

    // Fetch detailed song information stored under a 'song:' prefix
    const songDetailsString = await db.get(`song:${songId}`);
    // Ensure song details are stored as a JSON string; parse them back into an object
    const songDetails = songDetailsString ? JSON.parse(songDetailsString) : null;

    // Check if songDetails exist before pushing to the leaderboard
    if (songDetails) {
      leaderboard.push({
        songId,
        rating,
        name: songDetails.name, // Assuming songDetails includes the name
        artists: songDetails.artists.join(", "), // Assuming songDetails includes an array of artist names
        previewUrl: songDetails.preview_url, // Assuming songDetails includes a preview URL
        imageUrl: songDetails.image_url // Assuming you've stored an image URL
      });
    }
  }

  // Sort the leaderboard by rating in descending order
  leaderboard.sort((a, b) => b.rating - a.rating);

  // Optionally, limit the leaderboard to the top 10 entries
  res.json(leaderboard.slice(0, 10));
});




// Immediately invoke the function to get the access token when the server starts
getSpotifyAccessToken();

// Refresh the access token every hour
setInterval(getSpotifyAccessToken, 1000 * 60 * 60);

// Route to fetch random songs
// server.js

// Assume we have an array to store IDs of previously fetched songs
let previousSongs = [];

app.get('/random-songs', async (req, res) => {
  if (!spotifyAccessToken) {
    return res.status(500).send('Spotify access token is not available.');
  }

  const randomArtistIndex = Math.floor(Math.random() * artists.length);
  const artistId = artists[randomArtistIndex];

  try {
    const albums = await fetchArtistsAlbums(artistId);
    if (albums.length > 0) {
      // Randomly select an album from the artist's albums
      const randomAlbumIndex = Math.floor(Math.random() * albums.length);
      const albumId = albums[randomAlbumIndex].id;

      const tracks = await fetchAlbumTracks(albumId);
      // Return the first two tracks from the selected album
      res.json(tracks.slice(0, 10));
    } else {
      res.status(500).send('No albums found for the artist.');
    }
  } catch (error) {
    res.status(500).send('Error fetching songs: ' + error.message);
  }
});









// Route to fetch random songs




// Export the app for index.js to use
module.exports = app;

