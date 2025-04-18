const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const WebSocket = require('ws');

// Convert Steam64 to Steam32
function steam64To32(steam64) {
  return parseInt(steam64) - 76561197960265728;
}

// Fetch recent match data for the player
async function fetchPlayerData(steam64) {
  const steam32 = steam64To32(steam64);
  const url = `https://api.opendota.com/api/players/${steam32}/recentMatches`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('OpenDota fetch error:', err);
    return null;
  }
}

const app = express();
const wss = new WebSocket.Server({ port: 8080 });

const clients = [];

// Middleware for parsing incoming JSON data
app.use(bodyParser.json());

app.post('/gsi', async (req, res) => {
  const gsiData = req.body;

  // Check if gsiData, gsiData.map, and gsiData.allplayers are defined before proceeding
  if (gsiData && gsiData.map && gsiData.map.game_state && gsiData.allplayers) {
    if (gsiData.map.game_state === "DOTA_GAMERULES_STATE_HERO_SELECTION") {
      // If we're in the Hero Selection phase, start tracking players
      const players = gsiData.allplayers;
      const enhancedPlayers = {};

      // Loop through players and fetch recent match data if they have a Steam ID
      for (const [name, player] of Object.entries(players)) {
        if (player.steamid) {
          const lastMatch = await fetchPlayerData(player.steamid);
          enhancedPlayers[name] = {
            ...player,
            recent_match: lastMatch
              ? {
                  win_rate: lastMatch.radiant_win ? "Win" : "Loss", // You can calculate win rate based on recent matches
                  hero_id: lastMatch.hero_id,  // Track recent hero ID if needed
                }
              : null,
          };
        } else {
          enhancedPlayers[name] = player;  // For bot players, just keep their data as is
        }
      }

      gsiData.allplayers = enhancedPlayers;  // Update players with enhanced data
    }
  } else {
    //console.error('Invalid GSI data:', gsiData); // Log error if data is incomplete or invalid
  }

  // Send updated GSI data to all connected clients (frontend)
  for (const client of clients) {
    client.send(JSON.stringify(gsiData));
  }

  res.sendStatus(200);  // Acknowledge receipt of GSI data
});


// WebSocket connections to clients (frontend)
wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    const index = clients.indexOf(ws);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
