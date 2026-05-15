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

let trendingCache: any[] = [];
let dailyPick: any = null;
let lastTrendingUpdate = 0;

async function updateTrending() {
  try {
    const currentYear = 2026;
    const currentMonth = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
    
    const categories = ["Trending", "Afrobeats", "UK Drill", "Asian", "Hip Hop", "Drill", "Amapiano", "Electronic", "Albums"];
    const queries = [
      `top global music hits ${currentMonth} 2026`, 
      "Top Trending Nigerian Afrobeats Hits 2026", 
      "Latest Naija Music 2026 Afrobeat Anthems",
      "Trending Asian Hits 2026 K-Pop J-Pop",
      "Official Billboard Hip Hop Charts 2026", 
      "Global Drill Music Trends 2026",
      "New Amapiano 2026 Viral Mix",
      "Top Trending Electronic and House 2026", 
      "Best New Nigerian Afrobeat Albums 2026 - Best of Naija"
    ];
    
    const allResults = await Promise.all(queries.map(async (query, i) => {
      try {
        const results = await ytSearch(query);
        const category = categories[i];
        const categoryResults: any[] = [];
        
        // Add tracks
        const videos = results.videos.slice(0, 15).map(v => ({
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
  
        // Add playlists/albums for this category
        const playlists = results.playlists.slice(0, 5).map(p => ({
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
        return categoryResults;
      } catch (err) {
        console.error(`Search failed for ${query}:`, err);
        return [];
      }
    }));
    
    trendingCache = allResults.flat();
    
    // Set daily pick from trending
    const tracksOnly = trendingCache.filter(t => t.type === 'track');
    if (tracksOnly.length > 0) {
      dailyPick = tracksOnly[Math.floor(Math.random() * tracksOnly.length)];
    }

    lastTrendingUpdate = Date.now();
    console.log("Trending cache updated with", trendingCache.length, "items");
  } catch (error) {
    console.error("Failed to update trending cache:", error);
  }
}

// Initial update and every 12 hours
updateTrending();
setInterval(updateTrending, 12 * 60 * 60 * 1000);

async function startServer() {
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
      const results = await ytSearch(`${artist} similar artists hits`);
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
    if (!q) return res.status(400).json({ error: "Query is required" });

    try {
      const results = await ytSearch(q);
      const videos = results.videos.slice(0, 20).map(v => ({
        id: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        author: v.author.name,
        url: v.url,
        type: "track"
      }));
      const playlists = results.playlists.slice(0, 5).map(p => ({
        id: p.listId,
        title: p.title,
        thumbnail: p.thumbnail,
        author: p.author.name,
        url: p.url,
        type: "album",
        trackCount: p.videoCount
      }));

      // Search artists and albums via Deezer with better filtering
      let artists: any[] = [];
      let dzAlbums: any[] = [];
      try {
        const [artRes, albRes, searchRes] = await Promise.all([
           axios.get(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=15`),
           axios.get(`https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=15`),
           axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20`)
        ]);

        artists = artRes.data.data.map((a: any) => ({
          id: a.id,
          name: a.name,
          title: a.name,
          thumbnail: a.picture_medium,
          type: "artist",
          fans: a.nb_fan,
          author: "Verified Artist"
        }));

        dzAlbums = albRes.data.data.map((a: any) => ({
          id: a.id,
          title: a.title,
          thumbnail: a.cover_medium,
          author: a.artist.name,
          type: "album",
          trackCount: a.nb_tracks || "Album"
        }));

        const dzTracks = searchRes.data.data.map((t: any) => ({
          id: t.id,
          title: t.title,
          thumbnail: t.album.cover_medium,
          author: t.artist.name,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(t.artist.name + ' ' + t.title)}`,
          type: "track",
          duration: t.duration
        }));

        res.json([...artists, ...dzAlbums, ...dzTracks, ...playlists, ...videos]);
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

      // Fetch Wikipedia bio
      let bio = "";
      try {
        const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(info.data.name)}`, { timeout: 5000 });
        bio = wikiRes.data.extract || "";
      } catch (e) {
        try {
          const wikiRes2 = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(info.data.name + ' (musician)')}`, { timeout: 5000 });
          bio = wikiRes2.data.extract || "";
        } catch (e2) {}
      }

      res.json({
        info: info.data,
        tracks: topTracks.data.data || [],
        albums: albums.data.data || [],
        bio
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch artist data" });
    }
  });

  app.get("/api/videos/trending", async (req, res) => {
    try {
      const results = await ytSearch("trending music videos 2024");
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
    const AUDD_TOKEN = '45a9639dc5f736027983b959b0776287';
    try {
      if (!req.body || req.body.length === 0) {
        return res.status(400).json({ error: "Empty request body" });
      }

      const form = new FormData();
      form.append('api_token', AUDD_TOKEN);
      form.append('return', 'apple_music,spotify');
      // Pass the buffer as a file with a generic name, Audd handles various formats
      form.append('file', req.body, { filename: 'audio.bin' });

      const { data } = await axios.post('https://api.audd.io/', form, {
        headers: form.getHeaders(),
        timeout: 60000
      });

      console.log("Shazam API response:", data);
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
      const results = await ytSearch({ listId: id });
      if (!results || !results.videos) {
        return res.status(404).json({ error: "Album not found" });
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
        thumbnail: info.videoDetails.thumbnails[0].url,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author.name,
      });
    } catch (error) {
      console.error("Error fetching video info:", error);
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
        const searchResults = await ytSearch(url);
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
      
      try {
        // Fallback 1: Priyanshi API
        const fallbackRes = await axios.get(`https://dev-priyanshi.onrender.com/api/alldl?url=${encodeURIComponent(url)}`, { timeout: 30000 });
        let downloadUrl = format === 'mp3' ? (fallbackRes.data.data?.high || fallbackRes.data.data?.low) : (fallbackRes.data.data?.video || fallbackRes.data.data?.url);
        
        if (!downloadUrl) {
          // Fallback 2: Prexzyvilla API
          const fallbackRes2 = await axios.get(`https://apis.prexzyvilla.site/download/aio?url=${encodeURIComponent(url)}`, { timeout: 30000 });
          const data = fallbackRes2.data?.result || fallbackRes2.data?.data || fallbackRes2.data;
          downloadUrl = format === 'mp3' ? (data.high || data.low || data.url) : (data.video || data.high || data.url);
        }

        if (downloadUrl) {
           const stream = await axios.get(downloadUrl, { responseType: 'stream' });
           if (format === "mp3") res.header("Content-Type", "audio/mpeg");
           else res.header("Content-Type", "video/mp4");
           res.header("Content-Disposition", `attachment; filename="download.${format}"`);
           return stream.data.pipe(res);
        }
      } catch (fallbackError) {
        console.error("All download fallback layers failed", fallbackError);
      }

      res.status(500).json({ error: "Download failed. YouTube's bot detection might be blocking this request." });
    }
  });

  app.get("/api/trending", (req, res) => {
    try {
      res.json(trendingCache || []);
    } catch (err) {
      res.status(500).json({ error: "Failed to serve trending cache" });
    }
  });

  app.get("/api/daily-pick", (req, res) => {
    try {
      res.json(dailyPick || null);
    } catch (err) {
      res.status(500).json({ error: "Failed to serve daily pick" });
    }
  });

  app.get("/api/stream", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

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

    try {
      res.setHeader("Content-Type", "audio/mpeg");
      ytdl(url, ytdlOptions)
        .on('error', (err) => {
          console.error("YTDL Stream Error:", err);
        })
        .pipe(res);
    } catch (err) {
      console.error("YTDL outer catch:", err);
      
      // Fallback for streaming
      try {
        const fallbackRes = await axios.get(`https://dev-priyanshi.onrender.com/api/alldl?url=${encodeURIComponent(url)}`, { timeout: 15000 });
        const streamUrl = fallbackRes.data.data?.high || fallbackRes.data.data?.low;
        if (streamUrl) {
          const stream = await axios.get(streamUrl, { responseType: 'stream' });
          res.setHeader("Content-Type", "audio/mpeg");
          return stream.data.pipe(res);
        }
      } catch (e) {}

      res.status(500).json({ error: "Streaming failed" });
    }
  });

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
