import * as React from "react";
import { useState, useEffect, createContext, useContext } from "react";
import { 
  Home, 
  Search, 
  Library, 
  Download, 
  Plus, 
  Heart, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Repeat, 
  Shuffle, 
  Volume2, 
  Music2, 
  Youtube,
  Loader2,
  CheckCircle2,
  User as UserIcon,
  LogOut,
  FolderHeart,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  Settings,
  Trash2,
  CloudDownload,
  WifiOff,
  Mic2,
  TrendingUp,
  ShieldCheck,
  Star,
  Sun,
  Moon,
  BarChart3,
  ListMusic,
  Users,
  CreditCard,
  Megaphone,
  Globe,
  Radio,
  FileLock,
  MessageSquare,
  Activity,
  ArrowRight,
  Upload,
  ChevronRight,
  DollarSign,
  Cpu,
  Layers,
  LayoutDashboard,
  Share2,
  Clock,
  History as HistoryIcon,
  Monitor,
  Smartphone,
  Menu,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, signInWithGoogle } from "./lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp,
  getDocs,
  orderBy,
  limit
} from "firebase/firestore";
import { get, set, del, keys } from "idb-keyval";

// --- Types ---
interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  url: string;
  duration?: string;
  isOffline?: boolean;
}

interface Playlist {
  id: string;
  name: string;
  ownerId: string;
  tracks: Track[];
}

// --- Contexts ---
const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

// --- Components ---

function AudioVisualizer({ audioRef }: { audioRef: React.RefObject<HTMLAudioElement | null> }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const contextRef = React.useRef<AudioContext | null>(null);
  const sourceRef = React.useRef<MediaElementAudioSourceNode | null>(null);
  const analyzerRef = React.useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!audioRef.current || !canvasRef.current) return;

    const audio = audioRef.current;
    
    const initAudio = () => {
      if (!contextRef.current) {
        contextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyzerRef.current = contextRef.current.createAnalyser();
        sourceRef.current = contextRef.current.createMediaElementSource(audio);
        sourceRef.current.connect(analyzerRef.current);
        analyzerRef.current.connect(contextRef.current.destination);
        analyzerRef.current.fftSize = 256;
      }
    };

    const draw = () => {
      if (!canvasRef.current || !analyzerRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyzerRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzerRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 2) * (canvas.height / 128);
        
        // Use brand color logic
        const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-color').trim() || '#10B981';
        ctx.fillStyle = brandColor;
        ctx.globalAlpha = 0.6;
        
        // Draw bars from middle if high or just regular bars
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
      
      requestAnimationFrame(draw);
    };

    audio.addEventListener('play', () => {
      initAudio();
      if (contextRef.current?.state === 'suspended') {
        contextRef.current.resume();
      }
    });

    draw();
  }, [audioRef]);

  return <canvas ref={canvasRef} width={200} height={40} className="w-full h-full opacity-60" />;
}

// --- Sidebar Components ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [offlineTracks, setOfflineTracks] = useState<Track[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [trendingTracks, setTrendingTracks] = useState<any[]>([]);
  const [trendingCategory, setTrendingCategory] = useState("Trending");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<any | null>(null);
  const [fetchingAlbum, setFetchingAlbum] = useState(false);
  const [fetchingArtist, setFetchingArtist] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyricsData, setLyricsData] = useState<any>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [downloadModal, setDownloadModal] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dailyPick, setDailyPick] = useState<any | null>(null);
  const [staticArtistData, setStaticArtistData] = useState<any>({});
  const [staticTrending2026, setStaticTrending2026] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<string>(localStorage.getItem('theme') || 'emerald');
  const [downloadQueue, setDownloadQueue] = useState<any[]>([]);
  const [searchType, setSearchType] = useState("all");
  const [searchGenre, setSearchGenre] = useState("all");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [history, setHistory] = useState<Track[]>([]);
  const [quality, setQuality] = useState("320kbps");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [showQueue, setShowQueue] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const analyzerRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);

  // Offline URL Loader
  useEffect(() => {
    if (currentTrack?.isOffline) {
      get(`track_${currentTrack.id}`).then(data => {
        if (data && data.blob) {
          if (offlineUrl) URL.revokeObjectURL(offlineUrl);
          setOfflineUrl(URL.createObjectURL(data.blob));
        } else {
          setErrorMessage("Offline track data missing.");
          setOfflineUrl(null);
        }
      }).catch(err => {
        console.error("Failed to load offline track", err);
        setOfflineUrl(null);
      });
    } else {
      if (offlineUrl) URL.revokeObjectURL(offlineUrl);
      setOfflineUrl(null);
    }
  }, [currentTrack]);

  // Auto-hide error

  // Auto-hide error
  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  // Audio Control
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(err => {
        setIsPlaying(false);
        setErrorMessage("Playback failed. YouTube stream blocked or invalid.");
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isPlaying, currentTrack]);

  // Refined Download Progress Simulation with stages
  useEffect(() => {
    const interval = setInterval(() => {
      setDownloadQueue(prev => prev.map(item => {
        if (item.status === 'downloading' && item.progress < 100) {
          const newProgress = Math.min(item.progress + Math.random() * 8, 100);
          
          let subStatus = "Connecting...";
          if (newProgress > 10 && newProgress <= 30) subStatus = "Fetching metadata...";
          if (newProgress > 30 && newProgress <= 60) subStatus = "Encoding audio stream...";
          if (newProgress > 60 && newProgress <= 85) subStatus = "Compiling binary chunks...";
          if (newProgress > 85 && newProgress < 100) subStatus = "Finalizing encryption...";
          if (newProgress === 100) subStatus = "Completed";

          const elapsed = Date.now() - item.startTime;
          const totalEst = (elapsed / newProgress) * 100;
          const remaining = Math.max(0, totalEst - elapsed);
          const remSecs = Math.ceil(remaining / 1000);
          
          return { 
            ...item, 
            progress: newProgress,
            subStatus,
            status: newProgress === 100 ? 'completed' : 'downloading',
            estimatedTime: newProgress === 100 ? 'Done' : `${Math.floor(remSecs / 60)}m ${remSecs % 60}s`
          };
        }
        return item;
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestSongName, setRequestSongName] = useState("");
  const [requestArtist, setRequestArtist] = useState("");

  const submitRequest = async () => {
    if (!user) {
      setErrorMessage("Identity verification required for requests. Login first.");
      return;
    }
    if (!requestSongName) return;
    try {
      await addDoc(collection(db, "song-requests"), {
        songName: requestSongName,
        artist: requestArtist,
        requesterEmail: user.email,
        requesterId: user.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setRequestSongName("");
      setRequestArtist("");
      setShowRequestModal(false);
      setErrorMessage("Request emitted to the Nexus. Stay tuned.");
    } catch (err) {
      console.error("Request failed", err);
      setErrorMessage("Request broadcast failed. System interference detected.");
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const playTrack = (track: Track, context?: Track[]) => {
    if (context) {
      setPlaybackQueue(context);
      const idx = context.findIndex(t => t.id === track.id);
      setQueueIndex(idx !== -1 ? idx : 0);
    } else {
      // If no context, just add to current queue or replace
      setPlaybackQueue([track]);
      setQueueIndex(0);
    }
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playNext = () => {
    if (playbackQueue.length > 0 && queueIndex < playbackQueue.length - 1) {
      const nextIdx = queueIndex + 1;
      setQueueIndex(nextIdx);
      setCurrentTrack(playbackQueue[nextIdx]);
      setIsPlaying(true);
    } else if (trendingTracks.length > 0) {
      const idx = Math.floor(Math.random() * trendingTracks.length);
      setCurrentTrack(trendingTracks[idx]);
      setIsPlaying(true);
    }
  };

  const playPrevious = () => {
    if (playbackQueue.length > 0 && queueIndex > 0) {
      const prevIdx = queueIndex - 1;
      setQueueIndex(prevIdx);
      setCurrentTrack(playbackQueue[prevIdx]);
      setIsPlaying(true);
    }
  };

  const removeFromQueue = (index: number) => {
    setPlaybackQueue(prev => {
      const newQueue = [...prev];
      newQueue.splice(index, 1);
      if (index === queueIndex) {
        // If we removed the current track, play next if possible
        if (newQueue.length > 0) {
           const nextIdx = Math.min(index, newQueue.length - 1);
           setQueueIndex(nextIdx);
           setCurrentTrack(newQueue[nextIdx]);
        } else {
           setCurrentTrack(null);
           setIsPlaying(false);
           setQueueIndex(-1);
        }
      } else if (index < queueIndex) {
        setQueueIndex(queueIndex - 1);
      }
      return newQueue;
    });
  };

  const reorderQueue = (fromIdx: number, toIdx: number) => {
    setPlaybackQueue(prev => {
      const newQueue = [...prev];
      const [removed] = newQueue.splice(fromIdx, 1);
      newQueue.splice(toIdx, 0, removed);
      
      // Update queueIndex
      if (queueIndex === fromIdx) setQueueIndex(toIdx);
      else if (queueIndex > fromIdx && queueIndex <= toIdx) setQueueIndex(queueIndex - 1);
      else if (queueIndex < fromIdx && queueIndex >= toIdx) setQueueIndex(queueIndex + 1);
      
      return newQueue;
    });
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = x / rect.width;
    audioRef.current.currentTime = p * duration;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // PWA & Daily Pick & History
  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });

    const fetchDailyPick = async (retries = 10) => {
      try {
        const res = await fetch("/api/daily-pick");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data) {
          setDailyPick(data);
        } else {
          // If null returned, use a fallback
          setDailyPick({
            id: "hTWKbfoikeg",
            title: "Global Viral Mix 2026",
            author: "MusicFlow Discovery",
            thumbnail: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400",
            duration: "1:02:40",
            url: "https://www.youtube.com/watch?v=hTWKbfoikeg",
            type: "track"
          });
        }
      } catch (err: any) {
        console.error("Daily pick fetch failed:", err?.message || err);
        if (retries > 0) {
          const delay = Math.min((11 - retries) * 2000, 30000); // Backoff
          setTimeout(() => fetchDailyPick(retries - 1), delay);
        }
      }
    };

    fetchDailyPick();
    
    // Fetch static data
    fetch("/api/static/artist-discography").then(r => r.json()).then(setStaticArtistData).catch(() => {});
    fetch("/api/static/trending-2026").then(r => r.json()).then(d => setStaticTrending2026(d.trending_2026 || [])).catch(() => {});

    const savedHistory = localStorage.getItem("music_history");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // Sleep Timer logic
  useEffect(() => {
    if (sleepTimer !== null && sleepTimer > 0) {
      const interval = setInterval(() => {
        setSleepTimer(prev => (prev && prev > 0 ? prev - 1 : 0));
      }, 60000);
      return () => clearInterval(interval);
    } else if (sleepTimer === 0) {
      setIsPlaying(false);
      setSleepTimer(null);
    }
  }, [sleepTimer]);

  // Recommendations Logic
  useEffect(() => {
    if (currentTrack) {
      fetch(`/api/recommendations?artist=${encodeURIComponent(currentTrack.artist)}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setRecommendations(data))
        .catch(err => console.error("Recommendations fetch failed", err));
      
      const newHistory = [currentTrack, ...history.filter(t => t.id !== currentTrack.id)].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem("music_history", JSON.stringify(newHistory));
    }
  }, [currentTrack]);

  const handleHomeNavigation = () => {
    setActiveTab("home");
    // Shuffling tracks for visual variety on return
    if (trendingTracks.length > 0) {
      setTrendingTracks(prev => [...prev].sort(() => Math.random() - 0.5));
    }
    // Also refresh daily pick to feel fresh
    if (Math.random() > 0.5) {
       fetch("/api/daily-pick").then(r => r.json()).then(d => d && setDailyPick(d)).catch(() => {});
    }
  };

  useEffect(() => {
    if (user && !authLoading) {
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [user, authLoading]);

  // Auth & Admin Check
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDocRef = doc(db, "users", u.uid);
          const uSnap = await getDoc(userDocRef);
          if (uSnap.exists()) {
             const data = uSnap.data();
             if (data.role === 'admin') setIsAdmin(true);
             if (data.themePreference) setTheme(data.themePreference);
          } else {
             await setDoc(userDocRef, {
               userId: u.uid,
               displayName: u.displayName,
               email: u.email,
               photoURL: u.photoURL,
               role: u.email === 'akewusholaabdulbakri101@gmail.com' ? 'admin' : 'user',
               createdAt: serverTimestamp()
             });
             if (u.email === 'akewusholaabdulbakri101@gmail.com') setIsAdmin(true);
          }
        } catch (e) {
          console.error("User profile sync failed:", e);
        }

        if (u.email === 'akewusholaabdulbakri101@gmail.com') {
          setIsAdmin(true);
        } else {
          try {
            const adminDoc = await getDocs(query(collection(db, "admins"), where("email", "==", u.email)));
            if (!adminDoc.empty) setIsAdmin(true);
          } catch {
            // Already set by profile possibly
          }
        }
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
  }, []);

  // Lyrics Loader
  useEffect(() => {
    if (showLyrics && currentTrack) {
      const fetchLyrics = async () => {
        setLoadingLyrics(true);
        try {
          const query = `${currentTrack.title} ${currentTrack.artist}`;
          const res = await fetch(`/api/lyrics?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          setLyricsData(data);
        } catch (err) {
          setLyricsData({ lyrics: "No lyrics found for this track." });
        } finally {
          setLoadingLyrics(false);
        }
      };
      fetchLyrics();
    }
  }, [showLyrics, currentTrack]);

  // Playlists Listener
  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      return;
    }
    const q = query(collection(db, "playlists"), where("ownerId", "==", user.uid));
    return onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist));
      setPlaylists(p);
    });
  }, [user]);

  // Offline Tracks Loader
  useEffect(() => {
    const loadOffline = async () => {
      const allKeys = await keys();
      const tracks: Track[] = [];
      for (const key of allKeys) {
        if (typeof key === 'string' && key.startsWith('track_')) {
          const data = await get(key);
          if (data && data.metadata) {
            tracks.push({ ...data.metadata, isOffline: true });
          }
        }
      }
      setOfflineTracks(tracks);
    };
    loadOffline();
  }, [downloading]);

  // Search Suggestions Logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        try {
          const res = await fetch(`/api/suggestions?q=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
          setSearchSuggestions(data);
          setShowSuggestions(true);
        } catch (err) {}
      } else {
        setSearchSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTrending = async (retries = 10) => {
    try {
      const res = await fetch("/api/trending");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data) && data.length > 0) {
        // Deduplicate here just in case server missed some
        const uniqueMap = new Map();
        data.forEach((t: any) => {
          if (t.id && !uniqueMap.has(t.id)) uniqueMap.set(t.id, t);
        });
        setTrendingTracks(Array.from(uniqueMap.values()));
      }
    } catch (err: any) {
      console.error("Failed to fetch trending:", err?.message || err);
      if (retries > 0) {
        const delay = Math.min((11 - retries) * 2000, 30000); // Backoff
        setTimeout(() => fetchTrending(retries - 1), delay);
      }
    }
  };

  useEffect(() => {
    fetchTrending();
    const interval = setInterval(() => fetchTrending(0), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAlbumClick = async (album: any) => {
    setFetchingAlbum(true);
    setSelectedAlbum(null);
    setActiveTab("album-view");
    try {
      const res = await fetch(`/api/album/${album.id}`);
      const data = await res.json();
      setSelectedAlbum(data);
    } catch (err) {
      console.error("Album load failed", err);
    } finally {
      setFetchingAlbum(false);
    }
  };

  const handleArtistClick = async (artist: any) => {
    setFetchingArtist(true);
    setSelectedArtist(null);
    setActiveTab("artist-view");
    
    // Check if we have static data (match by name)
    const artistKey = artist.name.toLowerCase().replace(/\s+/g, '_');
    if (staticArtistData[artistKey]) {
      const mockInfo = {
        name: artist.name,
        picture_xl: artist.img || artist.thumbnail || `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800`,
        nb_fan: 5000000,
        genres: { data: [{ id: 1, name: 'Afrobeats' }] }
      };
      
      const tracks = staticArtistData[artistKey].map((t: any, i: number) => ({
        id: `static-${artistKey}-${i}`,
        title: t.title,
        release_date: t.release_date,
        duration: "3:45",
        album: { title: "Essential Collection", cover_medium: mockInfo.picture_xl }
      }));

      setSelectedArtist({
        info: mockInfo,
        tracks: tracks,
        trendingTracks: tracks.slice(0, 5),
        albums: [{ id: `essential-${artistKey}`, title: "Discography", cover_medium: mockInfo.picture_xl, release_date: "2026-01-01" }],
        trendingAlbums: [{ id: `essential-${artistKey}`, title: "Featured Collection", cover_medium: mockInfo.picture_xl, release_date: "2026-05-16" }],
        bio: `${artist.name} is a leading figure in the music scene, known for their unique style and chart-topping hits included in this essential collection.`
      });
      setFetchingArtist(false);
      return;
    }

    try {
      const res = await fetch(`/api/artist/${artist.id}`);
      const data = await res.json();
      setSelectedArtist(data);
    } catch (err) {
      console.error("Artist load failed", err);
    } finally {
      setFetchingArtist(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToUse = customQuery || searchQuery;
    if (!queryToUse) return;
    if (customQuery) setSearchQuery(customQuery);
    setShowSuggestions(false);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(queryToUse)}&type=${searchType}&genre=${searchGenre}`);
      const data = await res.json();
      setSearchResults(data);
      setActiveTab("downloader");
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const downloadTrack = async (video: any, format: "mp3" | "mp4" = "mp3") => {
    if (!user) {
      alert("Please login to download tracks for offline playback.");
      return;
    }
    setDownloading(video.id);
    setDownloadModal(null);
    
    // Add to visual download queue
    const queueItem = {
      id: video.id,
      title: video.title,
      artist: video.artist || video.author,
      thumbnail: video.thumbnail || video.cover,
      progress: 0,
      status: 'downloading',
      estimatedTime: 'Calculating...',
      startTime: Date.now(),
    };
    setDownloadQueue(prev => [...prev, queueItem]);

    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(video.url)}&format=${format}`);
      const blob = await res.blob();
      const track: Track = {
        id: video.id,
        title: video.title,
        artist: video.author,
        cover: video.thumbnail,
        url: video.url,
        duration: video.duration,
        isOffline: true
      };
      
      if (format === "mp3") {
        await set(`track_${video.id}`, { blob, metadata: track });
      } else {
        // Handle MP4 download via prompt
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${video.title}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setDownloading(null);
      setDownloadQueue(prev => prev.map(item => item.id === video.id ? { ...item, progress: 100, status: 'completed' } : item));
    } catch (err: any) {
      console.error("Download failed", err);
      setErrorMessage("Download failed: YouTube blocked the request. Try streaming instead.");
      setDownloading(null);
      setDownloadQueue(prev => prev.map(item => item.id === video.id ? { ...item, status: 'failed' } : item));
    }
  };

  const createPlaylist = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, "playlists"), {
        name: "New Playlist",
        ownerId: user.uid,
        tracks: [],
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to create playlist", err);
    }
  };

  const addToPlaylist = async (playlistId: string, track: Track) => {
    try {
      const pRef = doc(db, "playlists", playlistId);
      await updateDoc(pRef, {
        tracks: arrayUnion(track)
      });
    } catch (err) {
      console.error("Failed to add to playlist", err);
    }
  };

  const updatePlaylistName = async (id: string, newName: string) => {
    try {
      await updateDoc(doc(db, "playlists", id), { name: newName });
      setEditingPlaylist(null);
    } catch (err) {
      console.error("Failed to rename playlist", err);
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full bg-[#070708] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-[#070708] text-[#E0E0E0] font-sans flex flex-col overflow-hidden">
      {/* Mesh Background */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        
        {/* Sidebar Overlay (Mobile) */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 w-64 backdrop-blur-xl bg-black/40 lg:bg-white/5 border-r border-white/10 flex flex-col p-6 z-[200] transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between mb-10 lg:block">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <Music2 size={16} color="black" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">SoundSync</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/40">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold px-2">Menu</p>
              <SidebarItem icon={<Home size={20} />} label="Home" active={activeTab === "home"} onClick={handleHomeNavigation} />
              <SidebarItem icon={<TrendingUp size={20} />} label="Trending" active={activeTab === "trending"} onClick={() => setActiveTab("trending")} />
              <SidebarItem icon={<VideoIcon size={20} />} label="Videos" active={activeTab === "videos"} onClick={() => setActiveTab("videos")} />
              <SidebarItem icon={<Mic2 size={20} />} label="Identify (Shazam)" active={activeTab === "shazam"} onClick={() => setActiveTab("shazam")} />
              <SidebarItem icon={<Download size={20} />} label="Downloader" active={activeTab === "downloader"} onClick={() => setActiveTab("downloader")} />
              <SidebarItem icon={<WifiOff size={20} className={offlineTracks.length > 0 ? "text-emerald-400" : ""} />} label="Offline Library" active={activeTab === "offline"} onClick={() => setActiveTab("offline")} />
              <SidebarItem icon={<Megaphone size={20} className="text-[var(--brand-color)]" />} label="Request Song" onClick={() => setShowRequestModal(true)} />
              {isAdmin && (
                <SidebarItem icon={<ShieldCheck size={20} className="text-magenta" />} label="Admin Panel" active={activeTab === "admin"} onClick={() => setActiveTab("admin")} />
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Library</p>
                {user && (
                  <button onClick={createPlaylist} className="p-1 hover:bg-white/10 rounded-md transition-colors">
                    <Plus size={14} className="text-magenta" />
                  </button>
                )}
              </div>
              <SidebarItem icon={<WifiOff size={20} />} label="Offline" active={activeTab === "offline"} onClick={() => setActiveTab("offline")} />
              <div className="space-y-1">
                {playlists.map(p => (
                  <SidebarPlaylist key={p.id} name={p.name} onClick={() => { setActiveTab(`playlist-${p.id}`) }} />
                ))}
              </div>
            </div>
          </nav>

          <div className="mt-auto border-t border-white/10 pt-6 space-y-4">
            <div className="px-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-white/20 block mb-3">System Aesthetics</span>
              <div className="flex items-center gap-2">
                {[
                  { id: 'emerald', color: '#10B981' },
                  { id: 'magenta', color: '#FF00FF' },
                  { id: 'blue', color: '#00F2FF' },
                  { id: 'orange', color: '#F97316' },
                  { id: 'purple', color: '#8B5CF6' }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    title={t.id}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${theme === t.id ? 'border-white scale-125' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-110'}`}
                    style={{ backgroundColor: t.color }}
                  />
                ))}
              </div>
            </div>

            {user ? (
              <div 
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${activeTab === "profile" ? "mixed-gradient border-transparent text-white" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
              >
                <img src={user.photoURL || undefined} className="w-8 h-8 rounded-full border border-white/20" alt="avatar" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{user.displayName}</p>
                  <button onClick={(e) => { e.stopPropagation(); signOut(auth); }} className="text-[10px] opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1">
                    <LogOut size={10} /> Logout
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={signInWithGoogle} className="w-full mixed-gradient text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl">
                <UserIcon size={18} /> Login
              </button>
            )}
          </div>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto overflow-x-hidden relative pb-44 lg:pb-32">
          
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-white/40">
                <Menu size={24} />
              </button>
              <button onClick={() => setProfileOpen(!profileOpen)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                 {user ? <img src={user.photoURL || undefined} className="w-full h-full object-cover" alt="p" /> : <UserIcon size={20} className="text-white/40" />}
              </button>
            </div>
            <h1 className="text-2xl font-black text-emerald-400">SoundSync</h1>
            <button onClick={() => setActiveTab("profile")} className="text-white/40">
              <Settings size={24} />
            </button>
          </div>

          <AnimatePresence>
            {showWelcome && user && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 bg-white text-black rounded-full font-black uppercase tracking-tighter italic shadow-[0_0_50px_rgba(255,255,255,0.3)] flex items-center gap-4 border-2 border-magenta"
              >
                <div className="w-8 h-8 rounded-full bg-magenta flex items-center justify-center text-white">
                  <Star size={16} />
                </div>
                Welcome back, {user.displayName?.split(' ')[0]}!
              </motion.div>
            )}

            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[101] px-8 py-4 bg-red-600 text-white rounded-full font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center gap-4 border border-white/20"
              >
                {errorMessage}
                <button onClick={() => setErrorMessage(null)} className="opacity-60 hover:opacity-100">✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header Search Bar */}
          <div className="flex items-center justify-center mb-10 relative z-[95]">
            <form onSubmit={handleSearch} className="relative w-full max-w-2xl group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-magenta transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search tracks, artists, or YouTube URLs..." 
                className="w-full bg-white/5 border border-white/10 rounded-full py-4 px-14 text-lg outline-none focus:ring-4 focus:ring-magenta/10 focus:border-magenta/30 transition-all backdrop-blur-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length > 2 && setShowSuggestions(true)}
              />
              {isSearching && <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 animate-spin text-magenta" size={20} />}
              
              <AnimatePresence>
                {showSuggestions && searchSuggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-[#121214] border border-white/10 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100]"
                  >
                    {searchSuggestions.map((s) => (
                      <div 
                        key={s.id} 
                        onClick={() => { setSearchQuery(s.title); handleSearch(); }}
                        className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                      >
                         <img src={s.thumbnail} className="w-10 h-10 rounded-lg" alt="s" />
                         <div>
                            <p className="text-sm font-bold text-white">{s.title}</p>
                            <p className="text-[10px] uppercase font-bold text-white/30">{s.author}</p>
                         </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search Filters */}
              <div className="flex flex-wrap items-center gap-2 mt-4 ml-2">
                <span className="text-[10px] uppercase font-black text-white/20 mr-2">Filters:</span>
                {['all', 'track', 'album', 'artist'].map(t => (
                  <button 
                    key={t}
                    type="button"
                    onClick={() => setSearchType(t)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${searchType === t ? 'bg-[var(--brand-color)] text-black border-[var(--brand-color)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                  >
                    {t}
                  </button>
                ))}
                <div className="w-px h-4 bg-white/10 mx-2" />
                {['all', 'Pop', 'Hip-Hop', 'Naija', 'Amapiano', 'Drill'].map(g => (
                  <button 
                    key={g}
                    type="button"
                    onClick={() => setSearchGenre(g)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${searchGenre === g ? 'bg-[var(--brand-color)] text-black border-[var(--brand-color)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </form>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                
                {/* Autoscrolling Music Ticker */}
                <div className="w-full overflow-hidden bg-white/5 border-y border-white/10 py-4 mb-8 -mx-8 px-8 group relative">
                  <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#070708] to-transparent z-10 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#070708] to-transparent z-10 pointer-events-none" />
                  
                  <div className="flex animate-marquee whitespace-nowrap gap-24 items-center">
                    {[...trendingTracks, ...staticTrending2026, ...trendingTracks].slice(0, 40).map((t: any, i: number) => (
                      <div key={`marquee-${i}`} className="flex items-center gap-6 group/item cursor-pointer" onClick={() => handleSearch(undefined, `${t.author || t.artist} ${t.title}`)}>
                        <div className="flex items-center gap-3">
                          <div className="px-2 py-0.5 bg-emerald-500/20 rounded-md text-[8px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/30">Subbed</div>
                          <span className="text-xl font-black italic uppercase tracking-tighter text-white group-hover/item:text-emerald-400 transition-colors">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-white/20 tracking-[0.3em]">Artist</span>
                          <span className="text-sm font-bold text-emerald-500/60 uppercase">{t.author || t.artist}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/10">
                           <TrendingUp size={10} className="text-emerald-400" />
                           <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{Math.floor(Math.random() * 500) + 100}K Plays</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Search Bar (matches SoundSync design) */}
                <div className="relative group w-full max-w-2xl mx-auto mb-8">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search songs, artists, albums..." 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-14 text-base outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all backdrop-blur-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Daily Pick Section */}
                {dailyPick && (
                  <section className="relative overflow-hidden rounded-[3rem] p-10 md:p-16 border border-white/10 group bg-white/[0.02]">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10 pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                       <div className="w-64 h-64 md:w-80 md:h-80 rounded-[3rem] overflow-hidden shadow-2xl border border-white/20 group">
                          <img src={dailyPick.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[3s]" alt="daily" />
                       </div>
                       <div className="space-y-6 flex-1 text-center md:text-left">
                          <div>
                            <p className="text-[10px] uppercase font-black tracking-[0.6em] text-emerald-400 mb-2 italic">Daily Resonance</p>
                            <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-[ -0.05em] leading-none mb-4">{dailyPick.title}</h2>
                            <p className="text-xl md:text-2xl font-black text-white/40 uppercase tracking-tighter italic">{dailyPick.author}</p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <button onClick={() => { setCurrentTrack({ ...dailyPick, cover: dailyPick.thumbnail, artist: dailyPick.author }); setIsPlaying(true); }} className="px-12 py-5 bg-white text-black rounded-full font-black uppercase italic tracking-widest text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                               <Play fill="black" size={20} /> Stream Discovery
                            </button>
                            <button onClick={() => downloadTrack(dailyPick)} className="p-5 bg-white/5 border border-white/10 text-white rounded-full hover:bg-white/10 transition-all">
                               <Download size={24} />
                            </button>
                          </div>
                       </div>
                    </div>
                  </section>
                )}

                {/* Artists & Their Logic - Organized view */}
                {Array.from(new Set(trendingTracks.filter(t => t.type === 'track').map(t => t.author))).slice(0, 5).map((artistName, sidx) => {
                  const artistTracks = trendingTracks.filter(t => t.author === artistName && t.type === 'track');
                  return (
                    <section key={`${artistName}-${sidx}`} className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full mixed-gradient flex items-center justify-center font-black text-xs italic">
                              {(artistName as string).charAt(0)}
                           </div>
                           <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">{artistName as string}</h2>
                        </div>
                        <button className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-emerald-400 transition-colors">Discography</button>
                      </div>
                      <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 -mx-2 px-2">
                         {artistTracks.map((t, tidx) => (
                           <div 
                             key={`${t.id}-${tidx}`} 
                             onClick={() => playTrack({ ...t, cover: t.thumbnail, artist: t.author }, artistTracks.map(track => ({ ...track, cover: track.thumbnail, artist: track.author })))} 
                             className="min-w-[220px] max-w-[220px] group cursor-pointer space-y-4"
                           >
                              <div className="relative aspect-square rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 bg-white/5">
                                 <img src={t.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="card" />
                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-md">
                                    <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-all">
                                       <Play fill="white" size={20} stroke="none" className="ml-1" />
                                    </div>
                                 </div>
                              </div>
                              <div className="px-2">
                                <p className="font-black italic uppercase tracking-tight text-white whitespace-nowrap overflow-hidden text-ellipsis">{t.title}</p>
                                <p className="text-[10px] font-black uppercase text-white/30 tracking-widest mt-1 italic">{t.category}</p>
                              </div>
                           </div>
                         ))}
                      </div>
                    </section>
                  );
                })}

                {/* Trending Albums (Sectioned) */}
                <section className="space-y-6">
                   <h2 className="text-4xl font-black italic uppercase tracking-[ -0.05em] text-white px-2">Essential Collections</h2>
                   <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {/* Priority to our static trending 2026 data */}
                      {staticTrending2026.slice(0, 10).map((album, aidx) => (
                        <div key={`static-trending-${aidx}`} onClick={() => handleSearch(undefined, `${album.artist} ${album.title}`)} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] hover:bg-emerald-500/10 transition-all group cursor-pointer hover:-translate-y-2">
                           <div className="aspect-square rounded-2xl overflow-hidden mb-4 shadow-xl relative">
                              <img src={`https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80&sig=${aidx}`} className="w-full h-full object-cover" alt="alb" />
                              <div className="absolute top-2 right-2 bg-emerald-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">2026</div>
                           </div>
                           <h3 className="font-bold text-white text-sm truncate px-1">{album.title}</h3>
                           <p className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1 mt-1">{album.artist}</p>
                        </div>
                      ))}
                      {trendingTracks.filter(t => t.type === 'album').slice(0, 5).map((album, aidx) => (
                        <div key={`${album.id}-${aidx}`} onClick={() => handleAlbumClick(album)} className="p-4 bg-white/[0.03] border border-white/10 rounded-[2rem] hover:bg-white/[0.08] transition-all group cursor-pointer hover:-translate-y-2">
                           <div className="aspect-square rounded-2xl overflow-hidden mb-4 shadow-xl">
                              <img src={album.thumbnail} className="w-full h-full object-cover" alt="alb" />
                           </div>
                           <h3 className="font-bold text-white text-sm truncate px-1">{album.title}</h3>
                           <p className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1 mt-1">{album.author}</p>
                        </div>
                      ))}
                   </div>
                </section>
              </motion.div>
            )}

            {activeTab === "trending" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-20">
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-[0.4em] text-magenta mb-2">Discovery</p>
                      <h3 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Global Artists</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8">
                    {[
                      { id: 'asake', name: 'Asake', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400' },
                      { id: 'rema', name: 'Rema', img: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400' },
                      { id: 'burna_boy', name: 'Burna Boy', img: 'https://images.unsplash.com/photo-1514525253361-bee8a187499b?w=400' },
                      { id: 'ayra_starr', name: 'Ayra Starr', img: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400' },
                      { id: 'davido', name: 'Davido', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400' },
                      { id: 'wizkid', name: 'Wizkid', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400' },
                      { id: 144227, name: 'Drake', img: 'https://e-cdns-images.dzcdn.net/images/artist/Drake/500x500.jpg' },
                      { id: 27, name: 'Daft Punk', img: 'https://e-cdns-images.dzcdn.net/images/artist/f2bc007e9133c9484f380a9370f37d50/500x500.jpg' }
                    ].map(art => (
                      <div 
                        key={art.id} 
                        onClick={() => handleArtistClick(art)}
                        className="group cursor-pointer space-y-3"
                      >
                        <div className="relative aspect-square rounded-full overflow-hidden border border-white/5 group-hover:border-magenta group-hover:shadow-[0_0_30px_rgba(255,0,255,0.2)] transition-all">
                          <img src={art.img} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700" alt={art.name} />
                        </div>
                        <p className="text-center font-black italic uppercase tracking-tighter text-[10px] group-hover:text-magenta transition-colors">{art.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-[0.4em] text-magenta mb-2">Aural Trends</p>
                      <h2 className="text-6xl font-black uppercase italic tracking-tighter leading-none">Chart Toppers</h2>
                    </div>
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
                      {["Trending", "Afrobeats", "Asian", "Electronic", "Albums"].map((cat) => (
                        <button 
                          key={cat}
                          onClick={() => setTrendingCategory(cat)}
                          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${trendingCategory === cat ? "bg-magenta text-white" : "text-white/40 hover:text-white"}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                    {trendingTracks.filter(t => (trendingCategory === "Trending" ? true : trendingCategory === "Albums" ? t.type === "album" : t.category === trendingCategory)).map((t, tidx) => (
                      <div 
                        key={`${t.id}-${tidx}`} 
                        onClick={() => { 
                          if (t.type === 'album') { handleAlbumClick(t); }
                          else { playTrack({ ...t, cover: t.thumbnail, artist: t.author }, trendingTracks.filter(tr => tr.type === 'track').map(tr => ({ ...tr, cover: tr.thumbnail, artist: tr.author }))); }
                        }}
                        className="group cursor-pointer space-y-4"
                      >
                          <div className="relative aspect-square rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10">
                            {t.thumbnail ? (
                              <img src={t.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="t" />
                            ) : (
                              <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" /></div>
                            )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-all ${t.type === 'album' ? 'bg-magenta' : 'bg-white/20'}`}>
                            {t.type === 'album' ? <Music2 /> : <Play fill="white" size={24} stroke="none" className="ml-1" />}
                          </div>
                        </div>
                        {t.type === 'album' && (
                          <div className="absolute top-4 right-4 px-3 py-1 bg-magenta text-[8px] font-black italic rounded-full uppercase tracking-widest text-white">Album</div>
                        )}
                      </div>
                      <div className="px-2">
                        <p className="text-sm font-black truncate text-white uppercase italic tracking-tight">{t.title}</p>
                        <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-1 italic">{t.author}</p>
                        {t.type === 'album' && <p className="text-[9px] text-magenta font-black mt-2 uppercase">{t.trackCount} Tracks</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

            {activeTab === "album-view" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                 {fetchingAlbum ? (
                   <div className="h-96 flex flex-col items-center justify-center gap-6">
                      <div className="w-20 h-20 border-4 border-magenta/20 border-t-magenta rounded-full animate-spin" />
                      <p className="text-white/40 font-black uppercase tracking-[0.4em] text-xs">Loading tracks...</p>
                   </div>
                 ) : selectedAlbum ? (
                   <div className="space-y-12">
                      <div className="flex flex-col md:flex-row gap-12 items-end">
                         <div className="w-72 h-72 rounded-[3.5rem] overflow-hidden shadow-[0_30px_70px_rgba(255,0,255,0.2)] border border-white/10 group">
                            {selectedAlbum.thumbnail ? (
                              <img src={selectedAlbum.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-7s" alt="album-art" />
                            ) : (
                              <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={48} /></div>
                            )}
                         </div>
                         <div className="space-y-6 flex-1">
                            <p className="text-magenta font-black text-[10px] uppercase tracking-[0.6em] italic">Full Album</p>
                            <h2 className="text-7xl font-black uppercase italic tracking-tighter leading-none">{selectedAlbum.title}</h2>
                            <div className="flex items-center gap-6">
                               <p className="text-white/40 font-black italic text-xl uppercase tracking-tighter">{selectedAlbum.author}</p>
                               <div className="w-1 h-1 bg-white/20 rounded-full" />
                               <p className="text-white/40 font-black text-xs uppercase tracking-widest">{(selectedAlbum.tracks || []).length} Songs</p>
                            </div>
                            <div className="flex gap-4 pt-4">
                               <button onClick={() => { if (selectedAlbum.tracks?.[0]) { setCurrentTrack(selectedAlbum.tracks[0]); setIsPlaying(true); } }} className="px-10 py-4 mixed-gradient rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3">
                                  <Play fill="white" stroke="none" size={16} /> Stream Album
                               </button>
                               <button onClick={() => setActiveTab("trending")} className="px-10 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase tracking-widest text-xs border border-white/10 text-white/60">Back</button>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-3">
                         {(selectedAlbum.tracks || []).map((track: any, i: number) => (
                           <div 
                             key={track.id} 
                             onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                             className="flex items-center gap-6 p-5 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 transition-all group cursor-pointer"
                           >
                              <span className="w-6 text-center text-xs font-black text-white/20 italic group-hover:text-magenta">{i + 1}</span>
                              <div className="w-12 h-12 rounded-xl overflow-hidden grayscale group-hover:grayscale-0 transition-all">
                                {track.thumbnail ? (
                                  <img src={track.thumbnail} className="w-full h-full object-cover" alt="t" />
                                ) : (
                                  <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={16} /></div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-black text-white uppercase italic tracking-tight">{track.title}</p>
                                <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mt-1">{track.author}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-white/20 font-mono italic">{track.duration}</span>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); downloadTrack(track, "mp3"); }}
                                    className="p-3 bg-white/5 hover:bg-magenta/20 rounded-xl transition-all text-white/40 hover:text-magenta flex items-center gap-2 group/btn"
                                  >
                                    <Download size={14} />
                                    <span className="text-[8px] font-black uppercase tracking-widest hidden group-hover/btn:block">Audio</span>
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); downloadTrack(track, "mp4"); }}
                                    className="p-3 bg-white/5 hover:bg-blue-500/20 rounded-xl transition-all text-white/40 hover:text-blue-500 flex items-center gap-2 group/btn"
                                  >
                                    <VideoIcon size={14} />
                                    <span className="text-[8px] font-black uppercase tracking-widest hidden group-hover/btn:block">Video</span>
                                  </button>
                                </div>
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); setDownloadModal(track); }}
                                   className="p-3 bg-white/5 rounded-xl text-white/20 hover:text-magenta transition-all hidden"
                                 >
                                    <Download size={14} />
                                 </button>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                 ) : (
                   <div className="h-64 flex flex-col items-center justify-center text-white/20 italic">Album data corrupted or unavailable.</div>
                 )}
              </motion.div>
            )}

            {activeTab === "downloader" && (
              <motion.div key="downloader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                   <div>
                      <p className="text-[10px] uppercase font-black tracking-[0.4em] text-magenta mb-2">Search Results</p>
                      <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Music Discovery</h2>
                   </div>
                   <p className="text-xs text-white/40 font-black uppercase">{searchResults.length} Entities Found</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {searchResults.map((item) => (
                    <div key={item.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 group flex flex-col hover:bg-white/10 transition-all shadow-xl">
                      <div className={`relative ${item.type === 'artist' ? 'aspect-square rounded-full' : 'aspect-video rounded-2xl'} overflow-hidden mb-6 shadow-lg`}>
                        {item.thumbnail ? (
                          <img src={item.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="thumb" />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={32} /></div>
                        )}
                        <div 
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer"
                          onClick={() => {
                            if (item.type === 'album') handleAlbumClick(item);
                            else if (item.type === 'artist') handleArtistClick(item);
                            else { setCurrentTrack({ ...item, cover: item.thumbnail, artist: item.author }); setIsPlaying(true); }
                          }}
                        >
                           <Play fill="white" size={48} stroke="none" />
                        </div>
                        {item.duration && <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-[10px] font-black italic text-white tracking-widest">{item.duration}</div>}
                      </div>

                      <div className="mb-6 flex-1 px-2">
                         <h3 className="font-black text-white italic uppercase tracking-tight text-lg leading-tight h-12 overflow-hidden mb-2">{item.title || item.name}</h3>
                         <p className="text-[10px] text-white/40 font-black uppercase tracking-widest italic">{item.author || (item.type === 'artist' ? 'Verified Artist' : '')}</p>
                         {item.type === 'album' && <p className="text-[9px] text-magenta font-black mt-2 uppercase tracking-widest">Digital Collection • {item.trackCount} Tracks</p>}
                         {item.type === 'artist' && <p className="text-[9px] text-magenta font-black mt-2 uppercase tracking-widest">{item.fans?.toLocaleString()} Followers</p>}
                      </div>

                      <div className="flex gap-3">
                        <button 
                          onClick={() => {
                            if (item.type === 'album') handleAlbumClick(item);
                            else if (item.type === 'artist') handleArtistClick(item);
                            else { setCurrentTrack({ ...item, cover: item.thumbnail, artist: item.author }); setIsPlaying(true); }
                          }}
                          className="flex-1 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2 py-4"
                        >
                          {item.type === 'album' ? "View Album" : item.type === 'artist' ? "View Profile" : "Play Now"}
                        </button>
                        {item.type !== 'artist' && (
                          <button 
                            onClick={() => setDownloadModal(item)}
                            className="px-6 mixed-gradient text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center py-4"
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="col-span-full h-96 border-4 border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center text-white/10 gap-6">
                      <Search size={64} className="animate-pulse" />
                      <div className="text-center">
                         <p className="font-black uppercase tracking-[0.4em] text-sm mb-2">No results yet</p>
                         <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Search for tracks, albums or artists</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "offline" && (
              <motion.div key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                    <WifiOff className="text-magenta" /> Offline Sync
                  </h2>
                  <span className="text-xs text-white/40 font-bold uppercase">{offlineTracks.length} tracks sync'd</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {offlineTracks.map((track) => (
                    <div 
                      key={track.id} 
                      onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                      className="flex items-center gap-4 p-5 rounded-[2rem] bg-white/5 border border-white/10 hover:bg-white/10 transition-all group cursor-pointer"
                    >
                      <img src={track.cover} className="w-14 h-14 rounded-xl object-cover" alt="cover" />
                      <div className="flex-1">
                        <p className="font-black text-white text-sm uppercase italic">{track.title}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{track.artist}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] text-white/20 font-mono italic">{track.duration}</span>
                        <button className="text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); del(`track_${track.id}`); setOfflineTracks(p => p.filter(t => t.id !== track.id)); }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {offlineTracks.length === 0 && (
                    <div className="col-span-full h-64 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center text-white/10 gap-4">
                       <CloudDownload size={48} />
                       <p className="font-bold uppercase text-xs tracking-widest">No tracks available offline</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "admin" && isAdmin && (
              <AdminPanel />
            )}

            {activeTab === "profile" && user && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-12">
                <div className="flex flex-col md:flex-row items-center gap-10">
                  <div className="relative group">
                    <img src={user.photoURL || undefined} className="w-40 h-40 rounded-full border-4 border-magenta/20 group-hover:border-magenta transition-all shadow-2xl" alt="avatar" />
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <Settings className="text-white animate-spin-slow" />
                    </div>
                  </div>
                  <div className="text-center md:text-left space-y-4">
                    <h2 className="text-5xl font-black italic uppercase tracking-tighter">{user.displayName}</h2>
                    <p className="text-white/40 font-bold text-lg">{user.email}</p>
                    <div className="flex gap-4">
                      <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <p className="text-[9px] uppercase font-bold text-magenta tracking-widest mb-1">Status</p>
                        <p className="text-xs font-black uppercase italic">Vocalist Rank</p>
                      </div>
                      <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <p className="text-[9px] uppercase font-bold text-magenta tracking-widest mb-1">ID</p>
                        <p className="text-xs font-black italic uppercase">#{user.uid.slice(0, 6)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem]">
                    <HistoryIcon className="text-magenta mb-4" size={24} />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-2">History</p>
                    <p className="text-2xl font-black italic tracking-tighter">{history.length} Tracks</p>
                  </div>
                  <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem]">
                    <Clock className="text-magenta mb-4" size={24} />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-2">Listening Time</p>
                    <p className="text-2xl font-black italic tracking-tighter">14.2 Hours</p>
                  </div>
                  <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem]">
                    <ListMusic className="text-magenta mb-4" size={24} />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-2">Collections</p>
                    <p className="text-2xl font-black italic tracking-tighter">{playlists.length} Playlists</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Listening History</h3>
                    <button onClick={() => { setHistory([]); localStorage.removeItem("music_history"); }} className="text-xs text-white/20 hover:text-red-500 font-bold uppercase transition-colors">Wipe Records</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {history.slice(0, 10).map((t, i) => (
                     <div key={`${t.id}-${i}`} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 cursor-pointer" onClick={() => { setCurrentTrack(t); setIsPlaying(true); }}>
                          {t.cover ? (
                            <img src={t.cover} className="w-12 h-12 rounded-lg object-cover" alt="h" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={14} /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{t.title}</p>
                            <p className="text-[10px] text-white/30 truncate mt-1">{t.artist}</p>
                          </div>
                          <Play size={14} className="text-white/20 group-hover:text-magenta transition-colors" />
                       </div>
                     ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab.startsWith("playlist-") && (
              <PlaylistView playlist={playlists.find(p => `playlist-${p.id}` === activeTab)!} onPlay={(t) => { setCurrentTrack(t); setIsPlaying(true); }} />
            )}

            {activeTab === "videos" && (
              <VideosView onPlay={(v: any) => { setCurrentTrack({ ...v, cover: v.thumbnail, artist: v.author }); setIsPlaying(true); }} onDownload={(v: any) => setDownloadModal(v)} />
            )}

            {activeTab === "shazam" && (
              <ShazamView onPlay={(track: any) => { setSearchQuery(`${track.artist} ${track.title}`); handleSearch(); }} />
            )}

            {activeTab === "artist-view" && (
              <ArtistView loading={fetchingArtist} artist={selectedArtist} onPlay={(t: any) => { setCurrentTrack(t); setIsPlaying(true); }} onAlbum={handleAlbumClick} />
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Player Bar */}
      <footer className="fixed bottom-20 lg:bottom-0 left-0 right-0 h-24 backdrop-blur-3xl bg-black/80 border-t border-white/10 flex items-center justify-between px-4 lg:px-10 z-[110]">
        <div className="flex items-center gap-3 lg:gap-5 w-auto lg:w-1/4">
          {currentTrack ? (
            <>
              <div className="w-10 h-10 lg:w-14 lg:h-14 bg-white/5 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="current" />
              </div>
              <div className="max-w-[120px] lg:max-w-[180px]">
                <p className="text-xs lg:text-sm font-bold text-white truncate leading-tight">{currentTrack.title}</p>
                <p className="text-[10px] text-white/40 truncate mt-0.5 lg:mt-1 uppercase tracking-widest font-black italic">{currentTrack.artist}</p>
              </div>
            </>
          ) : (
            <div className="text-white/20 text-[10px] font-black uppercase tracking-widest italic hidden lg:block">Choose a track to play</div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 lg:gap-3 flex-1 lg:w-2/4 lg:max-w-2xl px-2 lg:px-16">
          <div className="flex items-center gap-4 lg:gap-8">
            <Shuffle size={16} className="text-white/40 cursor-pointer hover:text-[var(--brand-color)] transition-colors hidden lg:block" />
            <SkipBack size={20} className="text-white cursor-pointer hover:scale-110 transition-all hidden lg:block" />
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 lg:w-12 lg:h-12 bg-[var(--brand-color)] rounded-full flex items-center justify-center text-black shadow-[0_0_20px_var(--brand-shadow)] hover:scale-110 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
            <SkipForward size={20} className="text-white cursor-pointer hover:scale-110 transition-all" />
            
            <div className="relative group hidden lg:block">
              <button className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest">{playbackRate}x</button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-[#121214] border border-white/10 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                 {[0.5, 1, 1.25, 1.5, 2].map(r => (
                   <button key={r} onClick={() => setPlaybackRate(r)} className="block w-full px-4 py-2 text-[10px] font-black text-white/40 hover:bg-white/5 hover:text-white">{r}x</button>
                 ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:gap-4 w-full px-2 lg:px-4">
            <span className="text-[9px] lg:text-[10px] text-white/30 font-mono font-bold">{formatTime(currentTime)}</span>
            <div className="flex-1 h-2 relative flex items-center">
              <div className="absolute inset-0 z-0 opacity-20">
                 <AudioVisualizer audioRef={audioRef} />
              </div>
              <div 
                onClick={seek}
                className="w-full h-1 lg:h-1.5 bg-white/10 rounded-full cursor-pointer relative overflow-hidden group z-10"
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-[var(--brand-color)] rounded-full shadow-[0_0_10px_var(--brand-shadow)]" 
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-[9px] lg:text-[10px] text-white/30 font-mono font-bold">{formatTime(duration)}</span>
          </div>
        </div>

        <audio 
          ref={audioRef}
          src={currentTrack ? (currentTrack.isOffline ? (offlineUrl || undefined) : `/api/stream?url=${encodeURIComponent(currentTrack.url)}`) : undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={playNext}
          preload="auto"
          onError={() => {
            setIsPlaying(false);
            setErrorMessage("Sync failure. Node sequence interrupted.");
          }}
        />

        <div className="flex items-center justify-end gap-6 w-1/4">
          {currentTrack && currentTrack.isOffline && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
            >
               <WifiOff size={12} className="text-emerald-400 animate-pulse" />
               <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 italic">Offline Sequence Active</span>
            </motion.div>
          )}
          {currentTrack && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const url = `https://musicflow.app/track/${currentTrack.id}`;
                  if (navigator.share) {
                    navigator.share({ title: currentTrack.title, text: `Listening to ${currentTrack.title} on MusicFlow`, url });
                  } else {
                    navigator.clipboard.writeText(url);
                    setErrorMessage("Link copied to clipboard!");
                  }
                }}
                className="p-3 bg-white/5 rounded-xl text-white/40 hover:text-magenta transition-all"
              >
                <Share2 size={16} />
              </button>
              <button 
                onClick={() => setSleepTimer(sleepTimer === null ? 30 : null)} 
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sleepTimer !== null ? "bg-red-500/20 text-red-500" : "bg-white/5 text-white/40 hover:text-white"}`}
              >
                <Clock size={14} /> {sleepTimer ? `${sleepTimer}m` : "Sleep"}
              </button>
              <button 
                onClick={() => setShowQueue(!showQueue)} 
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showQueue ? "bg-magenta text-white shadow-[0_0_30px_var(--brand-shadow)]" : "bg-white/5 text-white/40 hover:text-white"}`}
              >
                <ListMusic size={14} /> Queue ({playbackQueue.length})
              </button>
              <button 
                onClick={() => setShowLyrics(!showLyrics)} 
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showLyrics ? "mixed-gradient text-white shadow-[0_0_30px_rgba(0,242,255,0.3)]" : "bg-white/5 text-white/40 hover:text-white"}`}
              >
                <Mic2 size={14} /> Lyrics
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
             <div className="relative group">
                <button className="text-[10px] font-black text-white/40 hover:text-magenta mr-2 uppercase tracking-tight">{quality}</button>
                <div className="absolute bottom-full right-0 mb-4 bg-[#121214] border border-white/10 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                   {["128kbps", "256kbps", "320kbps"].map(q => (
                     <button key={q} onClick={() => setQuality(q)} className="block w-full px-4 py-2 text-[10px] font-black text-white/40 hover:bg-white/5 hover:text-white whitespace-nowrap">{q}</button>
                   ))}
                </div>
             </div>
            <Volume2 size={18} className="text-white/40" />
            <div className="w-24 h-1 bg-white/10 rounded-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-[70%] h-full bg-white/50" />
            </div>
          </div>
        </div>
      </footer>

      {/* Download Queue Floating Panel */}
      {showQueue && (
         <div className="fixed bottom-28 left-6 z-[120] w-[350px] pointer-events-none">
            <AnimatePresence>
              <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="bg-[#121214]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto flex flex-col max-h-[600px]"
              >
                 <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-xl mixed-gradient flex items-center justify-center">
                          <ListMusic size={14} className="text-white" />
                       </div>
                       <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] block">Upcoming Sequence</span>
                          <span className="text-[8px] text-white/40 uppercase font-black">{playbackQueue.length} Entities</span>
                       </div>
                    </div>
                    <button onClick={() => setShowQueue(false)} className="text-white/20 hover:text-white transition-colors"><X size={20} /></button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
                    {playbackQueue.length > 0 ? playbackQueue.map((item, idx) => (
                       <div 
                         key={`${item.id}-${idx}`} 
                         onClick={() => { setQueueIndex(idx); setCurrentTrack(item); setIsPlaying(true); }}
                         className={`p-3 rounded-2xl border transition-all cursor-pointer group flex items-center gap-4 ${idx === queueIndex ? "bg-[var(--brand-color)]/20 border-[var(--brand-color)]/30" : "bg-white/5 border-white/5 hover:bg-white/10"}`}
                       >
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                             <img src={item.cover} className="w-full h-full object-cover" alt="q" />
                             {idx === queueIndex && (
                               <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all">
                                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                               </div>
                             )}
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className={`text-[10px] font-bold truncate ${idx === queueIndex ? "text-[var(--brand-color)]" : "text-white"}`}>{item.title}</p>
                             <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">{item.artist}</p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }} className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={12} /></button>
                          </div>
                       </div>
                    )) : (
                      <div className="h-40 flex flex-col items-center justify-center text-white/10 gap-3 grayscale">
                         <Library size={32} />
                         <p className="text-[10px] font-black uppercase tracking-widest">Nexus Empty</p>
                      </div>
                    )}
                 </div>

                 {playbackQueue.length > 0 && (
                    <div className="p-4 bg-white/5 border-t border-white/10">
                       <button onClick={() => setPlaybackQueue([])} className="w-full py-3 text-[8px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-colors">Terminate Sequence</button>
                    </div>
                 )}
              </motion.div>
            </AnimatePresence>
         </div>
      )}

      {/* Download Queue Floating Panel */}
      {downloadQueue.length > 0 && (
        <div className="fixed bottom-28 right-6 z-[120] w-[320px] pointer-events-none">
           <AnimatePresence>
              <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="bg-[#121214]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto"
              >
                 <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Download size={14} className="text-[var(--brand-color)]" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em]">Flux Queue</span>
                    </div>
                    <button onClick={() => setDownloadQueue([])} className="text-white/20 hover:text-white transition-colors text-[10px] uppercase font-black">Purge</button>
                 </div>
                 <div className="max-h-[350px] overflow-y-auto no-scrollbar p-3 space-y-2">
                    {downloadQueue.map((item, qidx) => (
                       <div key={`${item.id}-${qidx}`} className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                          <div className="flex items-center gap-3">
                             <img src={item.thumbnail} className="w-10 h-10 rounded-lg object-cover" alt="t" />
                             <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-white truncate">{item.title}</p>
                                <p className="text-[8px] font-black uppercase text-white/30 tracking-widest">{item.status}</p>
                             </div>
                             {item.status === 'completed' ? (
                                <CheckCircle2 size={14} className="text-green-500" />
                             ) : (
                                <span className="text-[8px] font-mono text-white/40">{item.estimatedTime}</span>
                             ) }
                          </div>
                          {item.status === 'downloading' && (
                             <div className="space-y-1">
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                   <div className="h-full bg-[var(--brand-color)] transition-all duration-1000 shadow-[0_0_10px_var(--brand-shadow)]" style={{ width: `${item.progress}%` }} />
                                </div>
                                <div className="flex justify-between items-center px-1">
                                   <span className="text-[7px] font-black text-white/20 uppercase tracking-tighter">Syncing...</span>
                                   <span className="text-[7px] font-mono text-white/40">{Math.round(item.progress)}%</span>
                                </div>
                             </div>
                          )}
                       </div>
                    ))}
                 </div>
              </motion.div>
           </AnimatePresence>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-3xl border-t border-white/10 flex lg:hidden items-center justify-around px-2 z-[100]">
        <MobileNavItem icon={<Home size={24} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
        <MobileNavItem icon={<Search size={24} />} label="Search" active={activeTab === "downloader"} onClick={() => setActiveTab("downloader")} />
        <MobileNavItem icon={<TrendingUp size={24} />} label="Trending" active={activeTab === "trending"} onClick={() => setActiveTab("trending")} />
        <MobileNavItem icon={<Library size={24} />} label="Library" active={activeTab.startsWith("playlist-") || activeTab === "offline"} onClick={() => setActiveTab("offline")} />
      </nav>

      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/80">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-[#121214] border border-white/10 p-8 rounded-[3rem] max-w-md w-full space-y-8 shadow-[0_40px_100px_rgba(0,0,0,0.9)]"
            >
               <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-[var(--brand-color)]/20 rounded-[2rem] flex items-center justify-center mx-auto text-[var(--brand-color)]">
                    <Megaphone size={40} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white">Broadcast Request</h3>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-2">Relay your sonic desires to the community</p>
                  </div>
               </div>
               
               <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/30 ml-4 tracking-[0.2em]">Sonification Target</label>
                    <input 
                      type="text" 
                      placeholder="Input Track Name..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-[var(--brand-color)] transition-all font-bold text-white"
                      value={requestSongName}
                      onChange={(e) => setRequestSongName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/30 ml-4 tracking-[0.2em]">Entity Source (Artist)</label>
                    <input 
                      type="text" 
                      placeholder="Optional Artist Meta..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-[var(--brand-color)] transition-all font-bold text-white"
                      value={requestArtist}
                      onChange={(e) => setRequestArtist(e.target.value)}
                    />
                  </div>
               </div>

               <div className="flex flex-col gap-3">
                  <button 
                    onClick={submitRequest}
                    disabled={!requestSongName}
                    className="w-full py-5 mixed-gradient rounded-3xl font-black text-white uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale transition-all"
                  >
                    Initiate Transmission
                  </button>
                  <button 
                    onClick={() => setShowRequestModal(false)}
                    className="w-full py-3 text-white/40 text-[10px] font-black uppercase tracking-[0.3em] hover:text-white transition-colors"
                  >
                    Abort Sequence
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLyrics && currentTrack && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col overflow-y-auto"
          >
            <div className="max-w-6xl mx-auto w-full p-20 flex flex-col md:flex-row gap-20">
              <div className="md:w-1/2 space-y-12">
                <div className="relative aspect-square rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.05)] border border-white/10">
                  {(lyricsData?.image || currentTrack.cover) ? (
                    <img src={lyricsData?.image || currentTrack.cover} className="w-full h-full object-cover" alt="lyrics-art" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={64} /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                  <div className="absolute bottom-10 left-10">
                    <h2 className="text-6xl font-black italic uppercase tracking-tighter text-white mb-4 leading-none">
                      {lyricsData?.title || currentTrack.title}
                    </h2>
                    <p className="text-magenta text-2xl font-black uppercase tracking-widest italic">{lyricsData?.artist || currentTrack.artist}</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                   <button onClick={() => setShowLyrics(false)} className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center gap-3 text-white font-bold transition-all">
                      <Plus className="rotate-45" /> Close Lyrics
                   </button>
                   {lyricsData?.url && (
                     <a href={lyricsData.url} target="_blank" className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 rounded-2xl flex items-center gap-3 text-black font-bold transition-all">
                        <Star /> Official Source
                     </a>
                   )}
                </div>
              </div>

              <div className="md:w-1/2 relative">
                {loadingLyrics ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <Loader2 className="animate-spin text-magenta" size={48} />
                    <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Loading Lyrics...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-white/30 mb-10">Track Lyrics</p>
                    <pre className="text-3xl md:text-5xl font-black leading-[1.3] whitespace-pre-wrap text-white/90 font-display italic tracking-tight">
                      {lyricsData?.lyrics || "Lyrics are not available for this track."}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {installPrompt && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-32 right-10 z-[105] bg-[#121214] border border-white/10 p-6 rounded-3xl shadow-2xl flex items-center gap-6 max-w-sm"
          >
            <div className="w-12 h-12 bg-magenta/20 rounded-2xl flex items-center justify-center text-magenta">
              <Smartphone size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">MusicFlow for Desktop</p>
              <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Install as native application</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setInstallPrompt(null)} className="p-2 text-white/20 hover:text-white transition-colors">✕</button>
              <button 
                onClick={() => { installPrompt.prompt(); setInstallPrompt(null); }}
                className="px-4 py-2 mixed-gradient text-white text-[10px] font-black uppercase rounded-lg shadow-lg"
              >
                Install
              </button>
            </div>
          </motion.div>
        )}

        {downloadModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-md bg-black/60">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="bg-[#121214] border border-white/10 p-8 rounded-[3rem] max-w-sm w-full space-y-8"
            >
               <div className="text-center space-y-2">
                 <h3 className="text-2xl font-black italic tracking-tighter uppercase">Download Format</h3>
                 <p className="text-white/40 text-xs">Select your preferred media quality</p>
               </div>
               
               <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => downloadTrack(downloadModal, 'mp3')}
                    className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-4 text-left">
                       <div className="w-10 h-10 rounded-xl bg-magenta/20 flex items-center justify-center text-magenta">
                          <MusicIcon size={20} />
                       </div>
                       <div>
                          <p className="font-bold">Audio Only</p>
                          <p className="text-[10px] text-white/30">MP3 • 320kbps High Fidelity</p>
                       </div>
                    </div>
                    <Download size={18} className="text-white/20 group-hover:text-white" />
                  </button>

                  <button 
                    onClick={() => downloadTrack(downloadModal, 'mp4')}
                    className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-4 text-left">
                       <div className="w-10 h-10 rounded-xl bg-neon-blue/20 flex items-center justify-center text-neon-blue">
                          <VideoIcon size={20} />
                       </div>
                       <div>
                          <p className="font-bold">Video Clip</p>
                          <p className="text-[10px] text-white/30">MP4 • 1080p HD Quality</p>
                       </div>
                    </div>
                    <Download size={18} className="text-white/20 group-hover:text-white" />
                  </button>
               </div>

               <button 
                 onClick={() => setDownloadModal(null)}
                 className="w-full text-white/40 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
               >
                 Cancel Operation
               </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Admin Panel ---
const AdminPanel = () => {
  const [activeSubTab, setActiveSubTab] = useState('dash');
  const [stats, setStats] = useState<any>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setStats(data))
      .catch(err => console.error("Admin stats fetch failed", err));

    const adminsQ = query(collection(db, "admins"));
    const unsubAdmins = onSnapshot(adminsQ, (snapshot) => {
      setAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const usersQ = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50));
    const unsubUsers = onSnapshot(usersQ, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const requestsQ = query(collection(db, "song-requests"), orderBy("createdAt", "desc"), limit(30));
    const unsubRequests = onSnapshot(requestsQ, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubAdmins();
      unsubUsers();
      unsubRequests();
    };
  }, []);

  const addAdmin = async () => {
    if (!newAdminEmail) return;
    try {
      const adminRef = doc(db, "admins", newAdminEmail);
      await setDoc(adminRef, { email: newAdminEmail, addedAt: serverTimestamp() });
      setNewAdminEmail("");
    } catch (err) {
      console.error("Admin add failed", err);
    }
  };

  const toggleAdmin = async (u: any) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, "users", u.id), { role: newRole });
      if (newRole === 'admin') {
        const adminRef = doc(db, "admins", u.email);
        await setDoc(adminRef, { email: u.email, addedAt: serverTimestamp() });
      } else {
        await deleteDoc(doc(db, "admins", u.email));
      }
    } catch (err) {
      console.error("Promotion failed", err);
    }
  };

  const updateRequestStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "song-requests", id), { status });
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
           <p className="text-magenta text-xs font-black uppercase tracking-[0.3em] mb-2 italic">Control Center</p>
           <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white">System Nexus</h2>
        </div>
        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-3xl overflow-x-auto no-scrollbar">
           <AdminTabBtn active={activeSubTab === 'dash'} icon={<LayoutDashboard size={14} />} label="Dash" onClick={() => setActiveSubTab('dash')} />
           <AdminTabBtn active={activeSubTab === 'users'} icon={<Users size={14} />} label="Users" onClick={() => setActiveSubTab('users')} />
           <AdminTabBtn active={activeSubTab === 'requests'} icon={<MessageSquare size={14} />} label="Requests" onClick={() => setActiveSubTab('requests')} />
           <AdminTabBtn active={activeSubTab === 'content'} icon={<MusicIcon size={14} />} label="Content" onClick={() => setActiveSubTab('content')} />
        </div>
      </div>

      <div className="relative min-h-[500px]">
        {activeSubTab === 'dash' && (
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard label="Total Pulse" value={users.length || '0'} trend="+12.5%" icon={<Users className="text-magenta" size={20}/>}/>
                 <StatCard label="Song Requests" value={requests.length || '0'} trend="Live" icon={<Activity className="text-neon-blue" size={20}/>}/>
                 <StatCard label="System Admins" value={admins.length || '0'} trend="Secure" icon={<ShieldCheck className="text-green-400" size={20}/>}/>
                 <StatCard label="Daily Active" value={stats?.dailyActive || '0'} trend="+2.3%" icon={<Cpu className="text-magenta" size={20}/>}/>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 bg-white/5 border border-white/10 p-8 rounded-[3rem] h-[450px] overflow-hidden flex flex-col items-center justify-center text-white/10 gap-6">
                    <BarChart3 size={64} />
                    <p className="font-black uppercase tracking-[0.5em] text-[10px] text-white/30 text-center">Neural Network Latency Telemetry...</p>
                    <div className="flex gap-2 items-end">
                       {[40, 70, 45, 90, 65, 80, 55, 30, 95, 60, 40, 85].map((h, i) => (
                         <motion.div 
                           key={i} 
                           initial={{ height: 0 }} 
                           animate={{ height: h }} 
                           transition={{ delay: i * 0.1 }}
                           className="w-4 bg-magenta/20 rounded-full border border-magenta/40" 
                         />
                       ))}
                    </div>
                 </div>
                 <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] space-y-6">
                    <h3 className="font-black uppercase italic tracking-widest text-white/20 text-[10px]">Infrastructure Load</h3>
                    <div className="space-y-8">
                       <UsageBar label="Global Storage" value={76} hint={stats?.storageUsed || '0GB'} color="bg-magenta shadow-[0_0_20px_rgba(255,0,255,0.4)]" />
                       <UsageBar label="CDN Transmit" value={34} hint={stats?.bandwidth || '0TB'} color="bg-neon-blue shadow-[0_0_20px_rgba(0,255,255,0.4)]" />
                       <UsageBar label="Core Servers" value={12} hint="Optimal" color="bg-green-400" />
                       <UsageBar label="System Health" value={98} hint="Nominal" color="bg-white" />
                    </div>
                 </div>
              </div>
           </motion.div>
        )}

        {/* User Management */}
        {activeSubTab === 'users' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/5 border border-white/10 rounded-[3rem] overflow-hidden">
              <table className="w-full text-left">
                 <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-[10px] uppercase font-black tracking-widest text-white/40">
                       <th className="px-8 py-6 italic">Identity</th>
                       <th className="px-8 py-6 italic">Privilege</th>
                       <th className="px-8 py-6 italic">Nexus Join</th>
                       <th className="px-8 py-6 italic">Nexus Access</th>
                       <th className="px-8 py-6 italic">Permission Matrix</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                       <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-3">
                                {u.photoURL ? (
                                   <img src={u.photoURL} className="w-10 h-10 rounded-full border border-white/10" alt="u" />
                                ) : (
                                   <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-black italic text-xs">{u.displayName?.[0] || 'U'}</div>
                                )}
                                <div>
                                   <p className="text-sm font-bold text-white">{u.displayName || 'Anonymous'}</p>
                                   <p className="text-[10px] text-white/30 font-black">{u.email}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                             <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-magenta/20 text-magenta border border-magenta/20' : 'bg-white/10 text-white/40'}`}>
                                {u.role || 'user'}
                             </span>
                          </td>
                          <td className="px-8 py-6 text-[10px] font-mono text-white/40">{u.createdAt ? new Date(u.createdAt?.seconds * 1000).toLocaleDateString() : 'Historical'}</td>
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(0,255,0,0.5)]"></div>
                                <span className="text-[10px] font-black uppercase text-white/80">Active</span>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                             <button 
                               onClick={() => toggleAdmin(u)}
                               className={`transition-colors p-2 rounded-xl border ${u.role === 'admin' ? 'text-magenta border-magenta/30 bg-magenta/10' : 'text-white/20 border-white/10 hover:text-white hover:border-white/30'}`}
                             >
                               <ShieldCheck size={18} />
                             </button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </motion.div>
        )}

        {/* Requests Management */}
        {activeSubTab === 'requests' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {requests.map(req => (
                   <div key={req.id} className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] space-y-4 group">
                      <div className="flex justify-between items-start">
                         <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center text-[var(--brand-color)]">
                            <Music2 size={24} />
                         </div>
                         <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : req.status === 'processed' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                            {req.status}
                         </span>
                      </div>
                      <div>
                         <p className="text-lg font-black italic uppercase tracking-tighter text-white truncate">{req.songName}</p>
                         <p className="text-xs font-bold text-white/30 truncate">{req.artist || 'Unknown Artist'}</p>
                      </div>
                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                         <div className="flex flex-col">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Requester</p>
                            <p className="text-[9px] font-bold text-white/40">{req.requesterEmail}</p>
                         </div>
                         <div className="flex gap-2">
                            <button onClick={() => updateRequestStatus(req.id, 'rejected')} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"><X size={14} /></button>
                            <button onClick={() => updateRequestStatus(req.id, 'processed')} className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"><CheckCircle2 size={14} /></button>
                         </div>
                      </div>
                   </div>
                 ))}
                 {requests.length === 0 && (
                   <div className="col-span-full py-20 text-center space-y-4">
                      <MessageSquare size={48} className="mx-auto text-white/5" />
                      <p className="text-white/20 font-black uppercase tracking-[0.5em] text-xs">No pending requests in the queue</p>
                   </div>
                 )}
              </div>
           </motion.div>
        )}

        {/* Content Management (Mock) */}
        {activeSubTab === 'content' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-[2.5rem] flex items-center gap-4 group">
                   <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                      <Music2 className="text-white/10 group-hover:text-magenta transition-colors" size={24} />
                   </div>
                   <div className="flex-1">
                      <p className="text-xs font-black uppercase italic text-white/40 mb-1">Entity_{i * 123}</p>
                      <p className="text-base font-black uppercase italic tracking-tighter text-white">Neural Sonic Wave</p>
                   </div>
                   <button className="p-3 bg-white/5 rounded-xl text-white/20 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                </div>
              ))}
           </motion.div>
        )}

        {activeSubTab === 'config' && (
           <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] space-y-8">
                 <h3 className="text-xl font-bold italic uppercase tracking-tighter text-magenta">Authorize Administrators</h3>
                 <div className="flex gap-4">
                    <input 
                      type="email" 
                      placeholder="Gmail address..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-magenta/50 font-bold text-sm"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                    />
                    <button onClick={addAdmin} className="mixed-gradient px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white">Grant</button>
                 </div>
                 <div className="space-y-3">
                   {admins.map(adm => (
                     <div key={adm.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-magenta/20 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><UserIcon size={14}/></div>
                           <p className="text-xs font-black italic uppercase tracking-tight">{adm.email}</p>
                        </div>
                        <button onClick={() => deleteDoc(doc(db, "admins", adm.id))} className="text-white/20 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] space-y-8">
                 <h3 className="text-xl font-bold italic uppercase tracking-tighter text-neon-blue">Network Overrides</h3>
                 <div className="space-y-4">
                    <ConfigToggle label="Quantum Lyrics Engine" active />
                    <ConfigToggle label="Hyper-Sync Download" active />
                    <ConfigToggle label="Neural Recommendation" active />
                    <ConfigToggle label="Maintenance Lockdown" />
                    <ConfigToggle label="Force Global V2 Pulse" />
                 </div>
              </div>
           </motion.div>
        )}
      </div>
    </div>
  );
};

const AdminTabBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"}`}>
    {icon} {label}
  </button>
);

const StatCard = ({ label, value, trend, icon }: any) => (
  <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
     <div className="flex items-center justify-between">
        <div className="p-3 bg-white/5 rounded-xl">{icon}</div>
        <span className="text-[10px] font-black text-neon-green">{trend}</span>
     </div>
     <div>
        <p className="text-[10px] uppercase font-black text-white/30 tracking-widest">{label}</p>
        <p className="text-3xl font-black italic uppercase tracking-tighter text-white">{value}</p>
     </div>
  </div>
);

const UsageBar = ({ label, value, hint, color }: any) => (
  <div className="space-y-2">
     <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
        <span className="text-white/40">{label}</span>
        <span className="text-white">{hint}</span>
     </div>
     <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className={`h-full ${color}`} />
     </div>
  </div>
);

const ConfigToggle = ({ label, active = false }: any) => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
     <span className="font-bold text-sm">{label}</span>
     <div className={`w-12 h-6 rounded-full transition-all relative cursor-pointer ${active ? 'bg-magenta' : 'bg-white/20'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${active ? 'right-1' : 'left-1'}`} />
     </div>
  </div>
);

// --- New Specialized Views ---

const VideosView = ({ onPlay, onDownload }: any) => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/videos/trending")
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setVideos(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Trending videos fetch failed", err);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500"><VideoIcon size={24} /></div>
        <div>
          <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Trending Visuals</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 italic">Viral Music Videos 2026</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-magenta" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {videos.map(v => (
            <div key={v.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden group hover:bg-white/10 transition-all">
              <div className="relative aspect-video">
                <img src={v.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                <div onClick={() => onPlay(v)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer">
                  <Play fill="white" size={48} stroke="none" />
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                   <p className="text-xs font-black text-white italic uppercase tracking-tight line-clamp-1">{v.title}</p>
                   <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-1 italic">{v.author}</p>
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-mono text-white/20 italic">{v.views.toLocaleString()} Views</span>
                   <button onClick={() => onDownload(v)} className="p-2 bg-white/5 rounded-lg text-white/40 hover:text-magenta transition-colors"><Download size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const ShazamView = ({ onPlay }: any) => {
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const mediaRecorder = React.useRef<MediaRecorder | null>(null);
  const audioChunks = React.useRef<Blob[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const identifyBlob = async (blob: Blob) => {
    setIdentifying(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/shazam", {
        method: "POST",
        body: blob
      });
      const data = await res.json();
      console.log("Shazam result:", data);
      if (data.result) {
        setResult(data.result);
      } else {
        if (data.status === "error") {
          setError(`AudD Error: ${data.error?.error_message || data.error?.message || "Unknown error"}`);
        } else {
          setError("No match found. Ensure the original music is loud and clear.");
        }
      }
    } catch (e) {
      setError("Network or server error. Identification failed.");
    } finally {
      setIdentifying(false);
    }
  };

  const startIdentification = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
        setIsRecording(false);
        console.log("Recording stopped, chunks:", audioChunks.current.length, "blob size:", audioBlob.size, "mime:", audioBlob.type);
        if (audioBlob.size < 10000) {
          setError("Recorded audio is too short or silent. Please record at least 10-15 seconds of clear music.");
          return;
        }
        setIdentifying(true);
        identifyBlob(audioBlob);
      };

      mediaRecorder.current.start(1000); // Pulse every 1s to ensure data flows
      setIsRecording(true);
      // Record for 15 seconds for better identification
      setTimeout(() => {
        if (mediaRecorder.current?.state === "recording") {
          mediaRecorder.current.stop();
          stream.getTracks().forEach(t => t.stop());
        }
      }, 15000);
    } catch (err) {
      setError("Microphone access denied.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) return setError("File too large. Max 15MB.");
      identifyBlob(file);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto py-20 text-center space-y-12">
      <div className="space-y-4">
        <h2 className="text-6xl font-black italic uppercase tracking-tighter">Sonic ID</h2>
        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Identify via Mic or File Upload</p>
      </div>

      <div className="relative flex flex-col items-center gap-10">
        <div className={`w-64 h-64 rounded-full flex items-center justify-center border-4 transition-all duration-500 bg-white/5 border-white/10 ${isRecording || identifying ? "border-magenta animate-pulse scale-110" : "hover:border-magenta hover:bg-white/10"}`}>
          <button 
            disabled={isRecording || identifying}
            onClick={startIdentification}
            className={`w-48 h-48 rounded-full mixed-gradient flex items-center justify-center text-white shadow-2xl transition-all ${isRecording || identifying ? "opacity-50" : "hover:scale-105 active:scale-95"}`}
          >
            {isRecording || identifying ? (
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <motion.div 
                    key={i} 
                    animate={{ height: [10, 30, 10] }} 
                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} 
                    className="w-1.5 bg-white rounded-full" 
                  />
                ))}
              </div>
            ) : <Mic2 size={48} />}
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.3em]">OR</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="audio/*,video/*" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3"
          >
            <Upload size={14} /> Upload Audio/Video
          </button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-10 bg-white/5 border border-white/10 rounded-[3rem] space-y-6">
            <div className="flex items-center gap-6 text-left">
               <div className="w-20 h-20 rounded-2xl bg-magenta/10 flex items-center justify-center text-magenta">
                  <MusicIcon size={32} />
               </div>
               <div>
                  <h4 className="text-3xl font-black italic uppercase tracking-tighter">{result.title}</h4>
                  <p className="text-magenta font-black uppercase tracking-widest text-sm">{result.artist}</p>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[10px] text-white/30 uppercase font-black mb-1">Album</p>
                   <p className="text-xs font-bold text-white truncate">{result.album}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[10px] text-white/30 uppercase font-black mb-1">Release</p>
                   <p className="text-xs font-bold text-white">{result.release_date}</p>
                </div>
            </div>
            <button onClick={() => onPlay(result)} className="w-full py-4 mixed-gradient text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">Get Studio Track</button>
          </motion.div>
        )}
        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 font-black italic uppercase tracking-widest text-xs">{error}</motion.p>}
      </AnimatePresence>
    </motion.div>
  );
};

const ArtistView = ({ artist, loading, onPlay, onAlbum, onDownload }: any) => {
  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-magenta" /></div>;
  if (!artist) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-16 pb-32">
      {/* Hero Section */}
      <div className="relative h-[500px] rounded-[4rem] overflow-hidden group shadow-2xl border border-white/10">
        {artist.info.picture_xl ? (
          <img src={artist.info.picture_xl} className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-[10s]" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center"><UserIcon className="text-white/20" size={64} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-[#070708]/60 to-transparent"></div>
        <div className="absolute bottom-12 left-12 right-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="text-magenta" size={24} />
                 <span className="text-xs font-black uppercase tracking-[0.4em] text-white/60 italic">Certified Global Artist</span>
              </div>
              <h2 className="text-7xl md:text-9xl font-black uppercase italic tracking-tighter text-white leading-none drop-shadow-2xl">{artist.info.name}</h2>
              <div className="flex flex-wrap gap-6 items-center">
                 <div className="flex items-center gap-2">
                    <Users size={16} className="text-magenta" />
                    <span className="text-white font-black text-xl italic uppercase tracking-tighter">{artist.info.nb_fan.toLocaleString()} Fans</span>
                 </div>
                 <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                 <div className="flex items-center gap-2">
                    <MusicIcon size={16} className="text-white/40" />
                    <span className="text-white/40 font-black text-xs uppercase tracking-widest">{artist.albums.length} Total Projects</span>
                 </div>
              </div>
           </div>
           <button onClick={() => { if (artist.tracks?.[0]) onPlay({ id: artist.tracks[0].id, title: artist.tracks[0].title, artist: artist.info.name, cover: artist.tracks[0].album?.cover_medium, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.info.name + ' ' + artist.tracks[0].title + ' official audio')}` }); }} className="px-10 py-5 mixed-gradient text-black font-black uppercase tracking-[0.2em] italic rounded-[2rem] shadow-2xl hover:scale-110 transition-all flex items-center gap-4">
             <Play fill="black" size={20} /> Shuffle Play
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 space-y-24">
             {/* Trending Section */}
             <section className="space-y-10">
                <div className="flex items-center gap-4">
                  <TrendingUp className="text-magenta" />
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter">Trending Anthems</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                   {(artist.trendingTracks || artist.tracks.slice(0, 5)).map((t: any, i: number) => (
                     <motion.div 
                       key={t.id} 
                       initial={{ opacity: 0, y: 10 }}
                       whileInView={{ opacity: 1, y: 0 }}
                       viewport={{ once: true }}
                       className="flex items-center gap-5 p-5 bg-white/[0.03] border border-white/5 rounded-[2rem] hover:bg-white/[0.08] transition-all group cursor-pointer"
                     >
                        <div className="text-xs font-black text-white/10 w-8 text-center group-hover:text-magenta">{i + 1}</div>
                        <div onClick={() => onPlay({ 
                          id: t.id, 
                          title: t.title, 
                          artist: artist.info.name, 
                          cover: t.album?.cover_medium, 
                          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.info.name + ' ' + t.title + ' official audio')}`
                        })} className="flex flex-1 items-center gap-5 min-w-0">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-lg group-hover:rotate-6 transition-transform">
                            <img src={t.album?.cover_small || `https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100`} className="w-full h-full object-cover" alt="t" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="font-bold text-white italic truncate text-lg uppercase tracking-tight group-hover:text-magenta transition-colors">{t.title}</p>
                             <p className="text-[10px] text-white/30 uppercase font-black truncate mt-1 tracking-widest">{t.album?.title}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-mono text-white/20 hidden md:block">{t.duration || "4:02"}</span>
                           <button 
                             onClick={(e) => { e.stopPropagation(); onDownload({ id: t.id, title: t.title, author: artist.info.name, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.info.name + ' ' + t.title + ' official audio')}`, thumbnail: t.album?.cover_medium, duration: t.duration }, "mp3"); }}
                             className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/20 hover:bg-magenta hover:text-black transition-all"
                           >
                             <Download size={16} />
                           </button>
                        </div>
                     </motion.div>
                   ))}
                </div>
             </section>

             {/* Trending Albums */}
             <section className="space-y-10">
                <div className="flex items-center gap-4">
                  <Star className="text-magenta" />
                  <h3 className="text-4xl font-black italic uppercase tracking-tighter">Essential Projects</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                   {(artist.trendingAlbums || artist.albums.slice(0, 4)).map((a: any) => (
                     <div key={a.id} onClick={() => onAlbum({ id: a.id, title: a.title, thumbnail: a.cover_medium, author: artist.info.name })} className="space-y-5 group cursor-pointer">
                        <div className="aspect-square rounded-[2.5rem] overflow-hidden bg-white/5 border-2 border-white/5 group-hover:border-magenta/40 transition-all relative shadow-2xl">
                           <img src={a.cover_medium || `https://images.unsplash.com/photo-1514525253361-bee8a187499b?w=400`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="a" />
                           <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-6">
                              <span className="text-[10px] font-black uppercase text-white tracking-[0.3em]">Explore</span>
                           </div>
                        </div>
                        <div className="text-center">
                           <h4 className="text-sm font-black italic uppercase text-white truncate px-1 group-hover:text-magenta transition-colors">{a.title}</h4>
                           <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-1">{a.release_date?.split('-')[0] || "2026"}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </section>

             {/* Full Archives */}
             <section className="space-y-10 border-t border-white/5 pt-20">
                <div className="flex items-center justify-between">
                   <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white/30">Complete Archive</h3>
                   <span className="px-4 py-1.5 bg-white/5 rounded-full text-[10px] font-black text-white/20 uppercase tracking-widest">{artist.albums.length} Releases</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {artist.albums.map((a: any) => (
                     <div key={a.id} onClick={() => onAlbum({ id: a.id, title: a.title, thumbnail: a.cover_medium, author: artist.info.name })} className="flex items-center gap-5 p-4 rounded-3xl border border-white/5 hover:bg-white/5 transition-all cursor-pointer group">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                           <img src={a.cover_small || a.cover_medium} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" alt="a" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-black uppercase italic text-white truncate group-hover:text-white transition-colors">{a.title}</p>
                           <p className="text-[10px] text-white/30 uppercase font-black mt-1">{a.release_date || "Unknown"}</p>
                        </div>
                        <ArrowRight size={16} className="text-white/10 group-hover:text-magenta group-hover:translate-x-1 transition-all" />
                     </div>
                   ))}
                </div>
             </section>
          </div>

          <div className="space-y-12">
             {/* Bio Section */}
             <aside className="p-10 bg-white/5 border border-white/10 rounded-[3.5rem] space-y-10 relative overflow-hidden group sticky top-8">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Sparkles size={160} className="text-magenta" />
                </div>
                <div className="space-y-6 relative z-10">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-magenta rounded-full animate-pulse" />
                      <h3 className="text-xs font-black uppercase italic tracking-[0.4em] text-magenta">Legacy Narrative</h3>
                   </div>
                   <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                      <p className="text-base font-bold text-white/70 leading-relaxed italic first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left first-letter:text-magenta">
                        {artist.bio || "Crafting an identity through sonic waves, this entity continues to push the boundaries of modern acoustic experiences."}
                      </p>
                   </div>
                   <div className="pt-6 flex flex-wrap gap-2 border-t border-white/5">
                      {artist.info.genres?.data?.map((g: any) => (
                        <span key={g.id} className="px-5 py-2.5 bg-magenta/10 border border-magenta/20 text-[9px] font-black uppercase tracking-widest rounded-full text-magenta">{g.name}</span>
                      )) || ["Experimental", "Visionary"].map(g => <span key={g} className="px-5 py-2.5 bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest rounded-full text-white/40">{g}</span>)}
                   </div>
                </div>
             </aside>
          </div>
      </div>
    </motion.div>
  );
};

// --- Components ---
interface SidebarItemProps { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; }
const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active = false, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center space-x-4 transition-all cursor-pointer px-4 py-3 rounded-2xl ${active ? "bg-emerald-500 text-black shadow-xl" : "text-white/50 hover:text-white hover:bg-white/5"}`}
    >
      {icon}
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </div>
  );
}

const MobileNavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? "text-emerald-400" : "text-white/40"}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
  </button>
);

interface SidebarPlaylistProps { id?: string; name: string; onClick: () => void; }
const SidebarPlaylist: React.FC<SidebarPlaylistProps> = ({ name, onClick }) => {
  return (
    <div onClick={onClick} className="flex items-center space-x-4 group cursor-pointer px-4 py-2 rounded-xl transition-all hover:bg-white/5">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-all border border-white/5">
        <Music2 size={14} className="text-white/30 group-hover:text-white" />
      </div>
      <span className="text-xs font-bold text-white/40 group-hover:text-white transition-colors truncate">{name}</span>
    </div>
  );
}

interface PlaylistCardProps { id: string; title: string; author: string; cover: string; }
const PlaylistCard: React.FC<PlaylistCardProps> = ({ title, author, cover }) => {
  return (
    <div className="p-4 backdrop-blur-md bg-white/5 rounded-[2rem] hover:bg-white/10 transition-all duration-500 group cursor-pointer border border-white/10">
      <div className="relative mb-4 aspect-square rounded-2xl overflow-hidden shadow-2xl">
        {cover ? (
          <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={32} /></div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
            <div className="w-12 h-12 bg-[#FF00FF] rounded-full flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-all duration-300 shadow-[0_0_30px_rgba(255,0,255,0.4)]">
              <Play size={24} fill="white" stroke="none" className="ml-1" />
            </div>
        </div>
      </div>
      <h3 className="font-black text-sm mb-1 truncate text-white uppercase italic tracking-tight">{title}</h3>
      <p className="text-[10px] text-white/40 font-black uppercase tracking-widest italic">{author}</p>
    </div>
  );
}

const PlaylistView = ({ playlist, onPlay }: { playlist: Playlist, onPlay: (t: Track) => void }) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-end gap-8 mb-10">
        <div className="w-52 h-52 bg-white/5 rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex items-center justify-center">
          {playlist.tracks[0]?.cover ? <img src={playlist.tracks[0].cover} className="w-full h-full object-cover" /> : <Music2 size={64} className="text-white/10" />}
        </div>
        <div className="space-y-4">
          <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-magenta italic">Playlist Selection</p>
          <h2 className="text-6xl font-black italic uppercase tracking-tighter">{playlist.name}</h2>
          <div className="flex items-center gap-6">
            <p className="text-sm text-white/40 font-black uppercase italic">{playlist.tracks.length} Tracks • Personal Collection</p>
          </div>
          <div className="flex gap-4 pt-4">
             {playlist.tracks.length > 0 && (
               <button onClick={() => { onPlay(playlist.tracks[0]); }} className="px-10 py-4 mixed-gradient rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-[0_0_30px_rgba(255,0,255,0.3)]">
                  <Play fill="white" stroke="none" size={16} /> Play Collection
               </button>
             )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {playlist.tracks.map((track, i) => (
          <div 
            key={`${track.id}-${i}`} 
            onClick={() => onPlay(track)}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group cursor-pointer"
          >
            <span className="w-6 text-center text-xs text-white/20 font-mono group-hover:hidden">{i + 1}</span>
            <Play size={12} className="w-6 hidden group-hover:block text-emerald-400" />
            <img src={track.cover} className="w-12 h-12 rounded-lg object-cover" alt="cover" />
            <div className="flex-1">
              <p className="font-bold text-white text-sm">{track.title}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">{track.artist}</p>
            </div>
            <span className="text-[10px] text-white/30 font-mono">{track.duration}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
