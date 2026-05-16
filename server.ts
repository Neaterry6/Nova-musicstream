import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import ytdl from "@distube/ytdl-core";
import ytSearch from "yt-search";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import { GoogleGenAI } from "@google/genai";

const DATA_FILE = path.join(process.cwd(), "trending.json");
const ARTIST_DATA_FILE = path.join(process.cwd(), "artist_discographies.json");
const TRENDING_2026_FILE = path.join(process.cwd(), "trending_2026.json");

let trendingCache: any[] = [
  {
    id: "hTWKbfoikeg",
    title: "Global Viral Mix 2026",
    author: "MusicFlow Discovery",
    thumbnail: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400",
    duration: "1:02:40",
    url: "https://www.youtube.com/watch?v=hTWKbfoikeg",
    category: "Trending",
    type: "track"
  },
  {
    id: "kJQP7kiw5Fk",
    title: "Lofi Hip Hop Radio - Beats to relax/study to",
    author: "Lofi Girl",
    thumbnail: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400",
    duration: "LIVE",
    url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    category: "Relaxation",
    type: "track"
  }
];

function loadPersistedData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        trendingCache = parsed;
        const tracksOnly = trendingCache.filter(t => t.type === 'track');
        if (tracksOnly.length > 0) {
          dailyPick = tracksOnly[Math.floor(Math.random() * tracksOnly.length)];
        } else {
          dailyPick = trendingCache[0];
        }
        console.log(`Loaded ${trendingCache.length} items from ${DATA_FILE}`);
      }
    }
  } catch (err) {
    console.error("Failed to load persisted data:", err);
  }
}

function savePersistedData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(trendingCache, null, 2));
    console.log(`Persisted ${trendingCache.length} items to ${DATA_FILE}`);
  } catch (err) {
    console.error("Failed to persist data:", err);
  }
}
let dailyPick: any = trendingCache[0];
let lastTrendingUpdate = 0;

async function ytSearchWithTimeout(query: string | any, timeoutMs: number = 10000) {
  return Promise.race([
    ytSearch(query),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Search timeout")), timeoutMs))
  ]) as Promise<any>;
}

async function updateTrending() {
  try {
    console.log("Updating trending cache...");
    
    // Load static data first to respond quickly
    let staticTrending: any[] = [];
    try {
      if (fs.existsSync(TRENDING_2026_FILE)) {
        const raw = fs.readFileSync(TRENDING_2026_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.trending_2026) staticTrending = parsed.trending_2026;
      }
    } catch (e) {}

    // Initial population from static data if cache is empty or minimal
    if (trendingCache.length < 10 && staticTrending.length > 0) {
      const initialStatic = staticTrending.slice(0, 20).map((item: any, idx: number) => ({
        id: `static-${idx}`,
        title: item.title,
        author: item.artist,
        thumbnail: `https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&sig=${idx}`,
        duration: "3:30",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.artist + ' ' + item.title)}`,
        category: "Trending",
        type: "track",
        year: "2026",
        isEssential: true
      }));
      trendingCache = [...initialStatic, ...trendingCache];
    }

    const currentYear = 2026;
    const currentMonth = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
    
    const categories = ["Trending", "Afrobeats", "Asian", "Electronic", "Albums"];
    const queries = [
      `top global music hits ${currentMonth} 2026`, 
      "Top Trending Nigerian Afrobeats Hits 2026", 
      "Trending Asian Hits 2026 K-Pop J-Pop",
      "Top Trending Electronic and House 2026", 
      "Best New Nigerian Afrobeat Albums 2026"
    ];
    
    const resultsMap = [];
    // Only search 3 categories in background to save resources
    for (let i = 0; i < Math.min(queries.length, 3); i++) {
      try {
        const query = queries[i];
        const results = await ytSearchWithTimeout(query, 10000);
        const category = categories[i];
        const categoryResults: any[] = [];
        
        if (results && results.videos) {
          const videos = results.videos.slice(0, 8).map((v: any) => ({
            id: v.videoId,
            title: v.title,
            thumbnail: v.thumbnail,
            duration: v.timestamp,
            author: v.author.name,
            url: v.url,
            category: category,
            type: "track",
            year: currentYear.toString()
          }));
          categoryResults.push(...videos);
        }
  
        if (results && results.playlists) {
          const playlists = results.playlists.slice(0, 3).map((p: any) => ({
            id: p.listId,
            title: p.title,
            thumbnail: p.thumbnail,
            author: p.author.name,
            url: p.url,
            category: category,
            type: "album",
            trackCount: p.videoCount
          }));
          categoryResults.push(...playlists);
        }
        
        resultsMap.push(categoryResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Search failed for ${queries[i]}:`, err);
      }
    }
    
    if (resultsMap.length > 0) {
      const flattened = resultsMap.flat();
      const deduplicatedMap = new Map();
      flattened.forEach((item) => {
        if (item && item.id && !deduplicatedMap.has(item.id)) {
          deduplicatedMap.set(item.id, item);
        }
      });
      
      const newCache = Array.from(deduplicatedMap.values());
      if (newCache.length > 0) {
        trendingCache = newCache;
        const tracksOnly = trendingCache.filter(t => t.type === 'track');
        if (tracksOnly.length > 0) {
          dailyPick = tracksOnly[Math.floor(Math.random() * tracksOnly.length)];
        }
        lastTrendingUpdate = Date.now();
        savePersistedData();
        console.log("Trending cache updated successfully.");
      }
    }
  } catch (error) {
    console.error("Failed to update trending cache:", error);
  }
}

// Initial update and every 12 hours
// (Now called inside startServer after listen)
setInterval(updateTrending, 12 * 60 * 60 * 1000);

async function startServer() {
  loadPersistedData();
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/recommendations", async (req, res) => {
    const artist = req.query.artist as string;
    if (!artist) return res.json([]);
    try {
      const results = await ytSearchWithTimeout(`${artist} similar artists hits`);
      const videos = results.videos.slice(0, 8).map(v => ({
        id: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        author: v.author.name,
        url: v.url,
        type: "track"
      }));
      res.json(videos);
    } catch (err) {
      res.json([]);
    }
  });

  app.get("/api/search", async (req, res) => {
    const q = req.query.q as string;
    const type = req.query.type as string; // track, album, artist
    const genre = req.query.genre as string;
    if (!q) return res.status(400).json({ error: "Query is required" });

    try {
      let searchQuery = q;
      if (genre && genre !== 'all') searchQuery += ` ${genre}`;
      if (type && type !== 'all') searchQuery += ` ${type}`;

      const results = await ytSearchWithTimeout(searchQuery);
      let videos = results.videos.slice(0, 20).map((v: any) => ({
        id: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        author: v.author.name,
        url: v.url,
        type: "track"
      }));

      let playlists = results.playlists.slice(0, 5).map((p: any) => ({
        id: p.listId,
        title: p.title,
        thumbnail: p.thumbnail,
        author: p.author.name,
        url: p.url,
        type: "album",
        trackCount: p.videoCount
      }));

      // Filter local results if type is specified
      if (type === 'track') {
        playlists = [];
      } else if (type === 'album') {
        videos = [];
      }

      // Search artists and albums via Deezer with better filtering
      let artists: any[] = [];
      let dzAlbums: any[] = [];
      try {
        const deezerQuery = genre && genre !== 'all' ? `${q} ${genre}` : q;
        const [artRes, albRes, searchRes] = await Promise.all([
           axios.get(`https://api.deezer.com/search/artist?q=${encodeURIComponent(deezerQuery)}&limit=15`),
           axios.get(`https://api.deezer.com/search/album?q=${encodeURIComponent(deezerQuery)}&limit=15`),
           axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(deezerQuery)}&limit=20`)
        ]);

        if (type === 'all' || type === 'artist') {
          artists = artRes.data.data.map((a: any) => ({
            id: a.id,
            name: a.name,
            title: a.name,
            thumbnail: a.picture_medium,
            type: "artist",
            fans: a.nb_fan,
            author: "Verified Artist"
          }));
        }

        if (type === 'all' || type === 'album') {
          dzAlbums = albRes.data.data.map((a: any) => ({
            id: a.id,
            title: a.title,
            thumbnail: a.cover_medium,
            author: a.artist.name,
            type: "album",
            trackCount: a.nb_tracks || "Album"
          }));
        }

        let dzTracks: any[] = [];
        if (type === 'all' || type === 'track') {
          dzTracks = searchRes.data.data.map((t: any) => ({
            id: t.id,
            title: t.title,
            thumbnail: t.album.cover_medium,
            author: t.artist.name,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(t.artist.name + ' ' + t.title)}`,
            type: "track",
            duration: t.duration
          }));
        }

        let combined = [];
        if (type === 'artist') combined = artists;
        else if (type === 'album') combined = [...dzAlbums, ...playlists];
        else if (type === 'track') combined = [...dzTracks, ...videos];
        else combined = [...artists, ...dzAlbums, ...dzTracks, ...playlists, ...videos];

        res.json(combined);
        return;
      } catch (e) {
        console.error("Deezer search failed:", e);
      }

      res.json([...artists, ...dzAlbums, ...playlists, ...videos]);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/artist/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const [info, topTracks, albums] = await Promise.all([
        axios.get(`https://api.deezer.com/artist/${id}`),
        axios.get(`https://api.deezer.com/artist/${id}/top?limit=100`),
        axios.get(`https://api.deezer.com/artist/${id}/albums?limit=100`)
      ]);

      const artistName = info.data.name;

      // Fetch Wikipedia bio
      let bio = "";
      try {
        const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`, { timeout: 5000 });
        bio = wikiRes.data.extract || "";
      } catch (e) {
        try {
          const wikiRes2 = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName + ' (musician)')}`, { timeout: 5000 });
          bio = wikiRes2.data.extract || "";
        } catch (e2) {}
      }

      // If bio is still missing or very short, use Gemini
      if (!bio || bio.length < 200) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });
          const geminiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Provide a detailed, professional, and engaging biography for the music artist "${artistName}". Include their origins, musical style, key achievements, and impact on the industry. Keep it around 250 words. Return only the biography text.`
          });
          if (geminiResponse.text) {
            bio = geminiResponse.text;
          }
        } catch (err) {
          console.error("Gemini bio generation failed:", err);
        }
      }

      const tracks = topTracks.data.data || [];
      const artistAlbums = albums.data.data || [];

      // Categorize
      const trendingTracks = tracks.slice(0, 10); // Deezer top tracks are already popular/trending
      const allTracks = tracks;
      
      const trendingAlbums = [...artistAlbums]
        .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
        .slice(0, 4);
      
      res.json({
        info: info.data,
        tracks: allTracks,
        trendingTracks,
        albums: artistAlbums,
        trendingAlbums,
        bio
      });
    } catch (err) {
      console.error("Failed to fetch artist data:", err);
      res.status(500).json({ error: "Failed to fetch artist data" });
    }
  });

  app.get("/api/videos/trending", async (req, res) => {
    try {
      const results = await ytSearchWithTimeout("trending music videos 2026");
      const videos = results.videos.slice(0, 20).map(v => ({
        id: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        views: v.views,
        author: v.author.name,
        url: v.url
      }));
      res.json(videos);
    } catch (err) {
      res.json([]);
    }
  });

  app.post("/api/shazam", express.raw({ type: "*/*", limit: "15mb" }), async (req, res) => {
    const AUDD_TOKEN = process.env.AUDD_TOKEN || '45a9639dc5f736027983b959b0776287';
    try {
      if (!req.body || req.body.length === 0) {
        console.error("Shazam error: Empty request body received");
        return res.status(400).json({ error: "Empty request body" });
      }

      console.log(`Shazam request received: ${req.body.length} bytes`);

      const form = new FormData();
      form.append('api_token', AUDD_TOKEN);
      form.append('return', 'apple_music,spotify');
      // Pass the buffer as a file with a recognizable extension
      form.append('file', req.body, { filename: 'audio.ogg' });

      const { data } = await axios.post('https://api.audd.io/', form, {
        headers: form.getHeaders(),
        timeout: 120000
      });

      console.log("Shazam API response received:", data.status || "success");
      if (data.status === "error") {
        console.error("Audd.io error details:", JSON.stringify(data.error, null, 2));
      }
      res.json(data);
    } catch (err) {
      console.error("Shazam API Error:", err);
      res.status(500).json({ error: "Shazam service failed", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/suggestions", async (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.json([]);
    try {
      const filtered = trendingCache.filter(t => 
        t.title.toLowerCase().includes(q.toLowerCase()) || 
        t.author.toLowerCase().includes(q.toLowerCase())
      ).slice(0, 5);
      res.json(filtered);
    } catch (err) {
      res.json([]);
    }
  });

  app.get("/api/album/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // If the ID is a numeric Deezer ID, use Deezer API
      if (/^\d+$/.test(id)) {
        const dzRes = await axios.get(`https://api.deezer.com/album/${id}`);
        const data = dzRes.data;
        if (data.error) {
          return res.status(404).json({ tracks: [], error: "Album not found on Deezer" });
        }
        
        const tracks = (data.tracks?.data || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          thumbnail: data.cover_medium,
          duration: t.duration,
          author: t.artist.name,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(t.artist.name + ' ' + t.title + ' official audio')}`,
          type: "track"
        }));

        return res.json({
          id,
          title: data.title,
          thumbnail: data.cover_medium,
          author: data.artist.name,
          tracks
        });
      }

      // Otherwise assume it's a YouTube listId
      const results = await ytSearchWithTimeout({ listId: id });
      if (!results || !results.videos) {
        return res.status(404).json({ tracks: [], error: "Album not found" });
      }
      const tracks = results.videos.map(v => ({
        id: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        author: v.author.name,
        url: v.url,
        type: "track"
      }));
      res.json({
        id,
        title: results.title || "Unknown Album",
        thumbnail: (results as any).thumbnail || "",
        author: (results as any).author?.name || "Unknown",
        tracks
      });
    } catch (err) {
      console.error("Album API error:", err);
      // Ensure we always return JSON, even on error
      res.status(500).json({ 
        tracks: [],
        error: "Failed to fetch album tracks",
        message: err instanceof Error ? err.message : "Unknown error"
      });
    }
  });

  app.get("/api/info", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const options = {
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
          }
        }
      };
      const info = await ytdl.getInfo(url, options);
      res.json({
        title: info.videoDetails.title,
        thumbnail: info.videoDetails.thumbnails[0].url || (info.videoDetails.thumbnails.length > 0 ? info.videoDetails.thumbnails[0].url : ""),
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author.name,
      });
    } catch (error) {
      console.error("Error fetching video info with ytdl, trying yt-search fallback:", error);
      try {
        const searchResults = await ytSearchWithTimeout(url);
        if (searchResults.videos.length > 0) {
          const v = searchResults.videos[0];
          return res.json({
            title: v.title,
            thumbnail: v.thumbnail,
            duration: v.seconds,
            author: v.author.name,
          });
        }
      } catch (e) {
        console.error("Info fallback failed:", e);
      }
      res.status(500).json({ error: "Failed to fetch video info" });
    }
  });

  app.get("/api/download", async (req, res) => {
    let url = req.query.url as string;
    const format = req.query.format as string || "mp4";

    if (!url) return res.status(400).json({ error: "URL is required" });

    // If it's a results page or just query text, search for the first video
    if (!url.includes("watch?v=") && !url.includes("youtu.be/")) {
      try {
        const searchResults = await ytSearchWithTimeout(url);
        if (searchResults.videos.length > 0) {
          url = searchResults.videos[0].url;
        } else {
          return res.status(404).json({ error: "No video found for search query" });
        }
      } catch (err) {
        return res.status(500).json({ error: "Search failed during download" });
      }
    }

    const ytdlOptions: ytdl.downloadOptions = {
      quality: format === "mp3" ? "highestaudio" : "highestvideo",
      requestOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Encoding": "identity",
          "Accept-Language": "en-US,en;q=0.9",
        }
      },
      filter: (format === "mp3" ? "audioonly" : "videoandaudio") as ytdl.Filter
    };

    try {
      const info = await ytdl.getInfo(url, ytdlOptions);
      const title = info.videoDetails.title.replace(/[^\w\s]/gi, "");
      
      if (format === "mp3") {
        res.header("Content-Type", "audio/mpeg");
      } else {
        res.header("Content-Type", "video/mp4");
      }
      
      res.header("Content-Disposition", `attachment; filename="${title}.${format}"`);
      ytdl(url, ytdlOptions).pipe(res);
      
    } catch (error) {
      console.error("YTDL download failed, trying fallback...", error);
      
      if (!res.headersSent) {
        if (format === "mp3") res.header("Content-Type", "audio/mpeg");
        else res.header("Content-Type", "video/mp4");
        res.header("Content-Disposition", `attachment; filename="download.${format}"`);
        await streamWithFallbacks(url, res);
      }
    }
  });

  app.get("/api/trending", (req, res) => {
    try {
      if (!trendingCache || trendingCache.length === 0) {
        // Safe fallback if for some reason cache is empty
        return res.json([
          {
            id: "hTWKbfoikeg",
            title: "Global Viral Mix 2026",
            author: "MusicFlow Discovery",
            thumbnail: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400",
            duration: "1:02:40",
            url: "https://www.youtube.com/watch?v=hTWKbfoikeg",
            category: "Trending",
            type: "track"
          }
        ]);
      }
      // Shuffle the results slightly for variety on every call
      const shuffled = [...trendingCache].sort(() => Math.random() - 0.5);
      res.json(shuffled);
    } catch (err) {
      console.error("Trending API Error:", err);
      res.status(500).json({ error: "Failed to serve trending cache", details: String(err) });
    }
  });

  app.get("/api/static/artist-discography", (req, res) => {
    try {
      if (fs.existsSync(ARTIST_DATA_FILE)) {
        const data = fs.readFileSync(ARTIST_DATA_FILE, "utf-8");
        return res.json(JSON.parse(data));
      }
      res.json({});
    } catch (e) {
      res.status(500).json({ error: "Failed to load static discography" });
    }
  });

  app.get("/api/static/trending-2026", (req, res) => {
    try {
      if (fs.existsSync(TRENDING_2026_FILE)) {
        const data = fs.readFileSync(TRENDING_2026_FILE, "utf-8");
        return res.json(JSON.parse(data));
      }
      res.json({ trending_2026: [] });
    } catch (e) {
      res.status(500).json({ error: "Failed to load static trending" });
    }
  });

  app.get("/api/daily-pick", (req, res) => {
    try {
      // Force pick a new one every time for freshness
      const tracksOnly = (trendingCache || []).filter(t => t.type === 'track');
      let pick = null;
      if (tracksOnly.length > 0) {
        pick = tracksOnly[Math.floor(Math.random() * tracksOnly.length)];
      } else if (trendingCache && trendingCache.length > 0) {
        pick = trendingCache[Math.floor(Math.random() * trendingCache.length)];
      }
      res.json(pick || null);
    } catch (err) {
      console.error("Daily Pick API Error:", err);
      res.status(500).json({ error: "Failed to serve daily pick", details: String(err) });
    }
  });

  app.get("/api/stream", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const ytdlOptions: ytdl.downloadOptions = {
        filter: "audioonly",
        quality: "highestaudio",
        requestOptions: {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
          }
        }
      };

      // Try local ytdl first
      try {
        const info = await ytdl.getBasicInfo(url, ytdlOptions);
        if (info) {
          res.setHeader("Content-Type", "audio/mpeg");
          const stream = ytdl(url, ytdlOptions);
          stream.on('error', (err) => {
             console.error("YTDL Stream inner error, falling back...");
             // If headers sent, we can't fall back to another response
             if (!res.headersSent) streamWithFallbacks(url, res);
          });
          return stream.pipe(res);
        }
      } catch (e) {
        console.log("YTDL direct stream failed, trying fallbacks...");
      }

      await streamWithFallbacks(url, res);
    } catch (err) {
      console.error("Master stream catch:", err);
      if (!res.headersSent) res.status(500).json({ error: "Streaming failed" });
    }
  });

  async function streamWithFallbacks(videoUrl: string, res: express.Response) {
    const sources = [
      `https://apis.prexzyvilla.site/download/aio?url=${encodeURIComponent(videoUrl)}`,
      `https://dev-priyanshi.onrender.com/api/alldl?url=${encodeURIComponent(videoUrl)}`,
      `https://api.vyt.pp.ua/api/info?url=${encodeURIComponent(videoUrl)}`,
      `https://api.cobalt.tools/api/json`
    ];

    for (const src of sources) {
      try {
        console.log(`Trying fallback source: ${src.split('?')[0]}`);
        let streamUrl = null;
        if (src.includes("cobalt")) {
          try {
            const cRes = await axios.post(src, { 
              url: videoUrl, 
              downloadMode: 'audio',
              videoQuality: '720',
              audioFormat: 'mp3'
            }, { 
              headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }, 
              timeout: 12000 
            });
            streamUrl = cRes.data?.url;
          } catch (ce) {
            console.log("Cobalt failed, continuing...");
          }
        } else {
          const sRes = await axios.get(src, { timeout: 15000 });
          const data = sRes.data;
          
          if (src.includes("priyanshi")) {
            streamUrl = data?.data?.high || data?.data?.low || data?.data?.url;
          } else if (src.includes("prexzyvilla")) {
            const content = data?.result || data?.data || data;
            const medias = content?.medias || [];
            // Prefer audio-only streams
            const audio = medias.find((m: any) => (m.type === 'audio' || m.extension === 'mp3') && m.url) || medias[0];
            streamUrl = audio?.url || content?.high || content?.low || content?.url;
          } else if (src.includes("vyt.pp.ua")) {
            if (data.formats) {
              const audio = data.formats.filter((f: any) => f.acodec !== 'none' && f.vcodec === 'none').sort((a: any, b: any) => b.abr - a.abr)[0];
              streamUrl = audio?.url || data.formats[0]?.url;
            }
          }
        }

        if (streamUrl) {
          console.log(`Attempting to proxy stream URL: ${streamUrl.substring(0, 40)}...`);
          const success = await proxyStreamWithCheck(streamUrl, res);
          if (success) {
            console.log("Stream successfully proxied from fallback.");
            return;
          }

          if (!res.headersSent) {
            console.log("Proxy failed, attempting direct redirect as final fallback for this source...");
            // Before redirecting, check if it's a googlevideo URl which usually fails on redirect unless user has right cookies
            // But for other CDNs it might work
            res.redirect(streamUrl);
            return;
          }
        }
      } catch (e: any) {
        console.log(`Fallback ${src.split('?')[0]} failed: ${e.message}`);
      }
    }
    
    if (!res.headersSent) {
      res.status(503).json({ 
        error: "Resource currently unavailable via server proxy.", 
        message: "This content is restricted or the fallback servers are over capacity. Try another track.",
        suggestion: "If this persists, try searching for the specific official audio."
      });
    }
  }

  async function proxyStreamWithCheck(url: string, res: express.Response): Promise<boolean> {
    try {
      // Don't proxy googlevideo directly if we can avoid it, but if we must...
      // Some googlevideo links require the same IP. Our server IP might be blocked or different.
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 45000,
        maxRedirects: 8,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Range': 'bytes=0-' // Help some servers start streaming
        },
        validateStatus: (status) => status < 400
      });
      
      const contentType = (response.headers['content-type'] as string) || 'audio/mpeg';
      // If it's a small response, it might be an error page disguised as success
      const contentLen = parseInt(response.headers['content-length'] as string || "0");
      
      if (contentLen > 0 && contentLen < 5000 && !contentType.includes('audio')) {
         console.warn("Stream response looks too small to be audio, failing check.");
         return false;
      }

      if (!res.getHeader('Content-Type')) res.setHeader("Content-Type", contentType);
      if (response.headers['content-length'] && !res.getHeader('Content-Length')) {
        res.setHeader("Content-Length", response.headers['content-length'] as string);
      }
      
      return new Promise((resolve) => {
        const stream = response.data.pipe(res);
        stream.on('finish', () => resolve(true));
        response.data.on('error', (err: any) => {
          console.error("Proxy stream data error:", err.message);
          resolve(false);
        });
        res.on('close', () => {
          response.data.destroy();
          resolve(true);
        });
      });
    } catch (err: any) {
      const status = err.response?.status || 'Error';
      console.error(`Proxy failure for URL: ${url.substring(0, 30)}... Status: ${status}`);
      return false;
    }
  }

  app.get("/api/lyrics", async (req, res) => {
    const rawQuery = req.query.q as string;
    if (!rawQuery) return res.status(400).json({ error: "Query is required" });

    const query = rawQuery.replace(/\(Official.*?\)|\[Official.*?\]|Official Video|Lyric Video|Audio Only|FT\.|FEAT\./gi, "").trim();
    const parts = query.split("-").map(p => p.trim());
    const artist = parts.length > 1 ? parts[0] : "";
    const title = parts.length > 1 ? parts[1] : parts[0];

    try {
      // 1. Try Popcat
      try {
        const resPop = await axios.get(`https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(query)}`, { timeout: 30000 });
        if (resPop.data && resPop.data.lyrics) return res.json({ lyrics: resPop.data.lyrics, source: "Popcat" });
      } catch (e) {}

      // 2. Try Lyrics.ovh
      if (artist && title) {
        try {
          const resOvh = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`, { timeout: 10000 });
          if (resOvh.data && resOvh.data.lyrics) return res.json({ lyrics: resOvh.data.lyrics, source: "Lyrics.ovh" });
        } catch (e) {}
      }

      // 3. Try Vagalume (simplified search)
      try {
        const resVag = await axios.get(`https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artist || title)}&mus=${encodeURIComponent(title)}`, { timeout: 10000 });
        if (resVag.data && resVag.data.mus && resVag.data.mus[0]) {
          return res.json({ lyrics: resVag.data.mus[0].text, source: "Vagalume" });
        }
      } catch (e) {}

      // 4. Fallback to Gemini
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Provide detailed lyrics for "${query}". Only return the lyrics.`
        });
        const lyrics = response.text;
        if (lyrics && lyrics.length > 20) return res.json({ lyrics, source: "Gemini AI" });
      } catch (e) {
        console.error("Gemini lyrics error:", e);
      }

      res.status(404).json({ error: "Lyrics unavailable for this song." });
    } catch (error) {
      res.status(500).json({ error: "Internal lyrics error." });
    }
  });

  app.get("/api/admin/stats", (req, res) => {
    res.json({
      totalUsers: 1420,
      dailyActive: 890,
      newSignups: 42,
      totalStreams: 15400,
      revenue: 1250.50,
      storageUsed: "450GB",
      bandwidth: "1.2TB"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    
    // Kick off trending update after a short delay so server can handle early requests
    setTimeout(() => {
      updateTrending().catch(err => console.error("Initial trending update failed:", err));
    }, 1000);
  });

  // Global uncaught error handling to prevent process crash
  process.on('uncaughtException', (err) => {
    console.error('URGENT: Uncaught Exception:', err);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('URGENT: Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
