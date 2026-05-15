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
  Smartphone
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
  setDoc,
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  serverTimestamp,
  getDocs
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

// --- Mock / Init Data ---
const FEATURED_PLAYLISTS = [
  { id: "1", title: "Midnight City", author: "Electronic", cover: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&h=400&fit=crop" },
  { id: "2", title: "Indie Chill", author: "Acoustic", cover: "https://images.unsplash.com/photo-1459749411177-042180ce673c?w=400&h=400&fit=crop" },
  { id: "3", title: "Lo-Fi Beats", author: "Relaxation", cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=400&fit=crop" },
];

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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showWelcome, setShowWelcome] = useState(false);
  const [downloadModal, setDownloadModal] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dailyPick, setDailyPick] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [history, setHistory] = useState<Track[]>([]);
  const [quality, setQuality] = useState("320kbps");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [offlineUrl, setOfflineUrl] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

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

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const playNext = () => {
    // Basic implementation: play a random trending song if no playlist is active
    if (trendingTracks.length > 0) {
      const idx = Math.floor(Math.random() * trendingTracks.length);
      setCurrentTrack(trendingTracks[idx]);
      setIsPlaying(true);
    }
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

    const fetchDailyPick = async (retries = 3) => {
      try {
        const res = await fetch("/api/daily-pick");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data) setDailyPick(data);
      } catch (err) {
        console.error("Daily pick fetch failed", err);
        if (retries > 0) {
          console.log(`Retrying daily pick fetch... (${retries} left)`);
          setTimeout(() => fetchDailyPick(retries - 1), 2000);
        }
      }
    };

    fetchDailyPick();
    
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
        if (u.email === 'akewusholaabdulbakri101@gmail.com') {
          setIsAdmin(true);
        } else {
          try {
            const adminDoc = await getDocs(query(collection(db, "admins"), where("email", "==", u.email)));
            setIsAdmin(!adminDoc.empty);
          } catch {
            setIsAdmin(false);
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

  // Trending Loader
  useEffect(() => {
    const fetchTrending = async (retries = 3) => {
      try {
        const res = await fetch("/api/trending");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data)) {
          setTrendingTracks(data);
        }
      } catch (err) {
        console.error("Failed to fetch trending", err);
        if (retries > 0) {
          console.log(`Retrying trending fetch... (${retries} left)`);
          setTimeout(() => fetchTrending(retries - 1), 2000);
        }
      }
    };
    fetchTrending();
    const interval = setInterval(() => fetchTrending(0), 5 * 60 * 1000);
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery) return;
    setShowSuggestions(false);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
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
    } catch (err: any) {
      console.error("Download failed", err);
      setErrorMessage("Download failed: YouTube blocked the request. Try streaming instead.");
      setDownloading(null);
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
        
        {/* Sidebar */}
        <aside className="w-64 backdrop-blur-xl bg-white/5 border-r border-white/10 flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-magenta rounded-full flex items-center justify-center">
              <Star size={16} color="black" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white italic">Nova MusicFlow</span>
          </div>

          <nav className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold px-2">Menu</p>
              <SidebarItem icon={<Home size={20} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
              <SidebarItem icon={<TrendingUp size={20} />} label="Trending" active={activeTab === "trending"} onClick={() => setActiveTab("trending")} />
              <SidebarItem icon={<VideoIcon size={20} />} label="Videos" active={activeTab === "videos"} onClick={() => setActiveTab("videos")} />
              <SidebarItem icon={<Mic2 size={20} />} label="Identify (Shazam)" active={activeTab === "shazam"} onClick={() => setActiveTab("shazam")} />
              <SidebarItem icon={<Download size={20} />} label="Downloader" active={activeTab === "downloader"} onClick={() => setActiveTab("downloader")} />
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
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] uppercase font-bold text-white/30">Theme</span>
              <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-white/40 hover:text-white"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
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
        <main className="flex-1 flex flex-col p-8 overflow-y-auto overflow-x-hidden relative">
          
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
            </form>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-16">
                {/* Daily Pick Section */}
                {dailyPick && (
                  <section className="relative overflow-hidden p-1 bg-gradient-to-br from-magenta via-purple-600 to-blue-600 rounded-[3.5rem] shadow-2xl">
                    <div className="bg-[#070708] rounded-[3.2rem] p-10 flex flex-col md:flex-row items-center gap-10">
                      <div className="w-52 h-52 shrink-0 rounded-3xl overflow-hidden shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        {dailyPick.thumbnail ? (
                          <img src={dailyPick.thumbnail} className="w-full h-full object-cover" alt="daily" />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" /></div>
                        )}
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2">
                          <Star className="text-magenta fill-magenta" size={20} />
                          <span className="text-xs font-black uppercase tracking-[0.4em] text-white/40">Daily Frequency Pick</span>
                        </div>
                        <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white">{dailyPick.title}</h2>
                        <p className="text-white/30 font-bold uppercase tracking-widest text-sm">{dailyPick.author}</p>
                        <div className="flex gap-4 pt-4">
                          <button 
                            onClick={() => { setCurrentTrack({ ...dailyPick, cover: dailyPick.thumbnail, artist: dailyPick.author }); setIsPlaying(true); }}
                            className="px-10 py-4 mixed-gradient text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                          >
                            Stream & Listen Today
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Hero Section */}
                <div className="relative group overflow-hidden rounded-[4rem] border border-white/10 aspect-[21/9] bg-[#1A1A1A] shadow-2xl">
                  <img src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=1200" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[8s]" alt="Hero" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                  <div className="absolute bottom-12 left-12 z-20 space-y-6">
                    <span className="bg-magenta text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-[0.3em] font-display italic">Editor's Choice</span>
                    <div className="space-y-1">
                      <h2 className="text-7xl font-black text-white leading-none uppercase italic tracking-tighter">Hyper Pop</h2>
                      <p className="text-white/40 text-2xl font-black uppercase italic tracking-widest">Next-Gen Audio Experience</p>
                    </div>
                    <button className="mixed-gradient text-white px-16 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-110 active:scale-95 transition-all shadow-2xl">Start Listening</button>
                  </div>
                </div>

                {/* Smart Recommendations */}
                {recommendations.length > 0 && (
                  <section className="space-y-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-magenta/10 border border-magenta/20 flex items-center justify-center"><Sparkles size={24} className="text-magenta"/></div>
                       <div>
                          <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Smart Flow</h3>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 italic">Because you listened to {currentTrack?.artist}</p>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-8">
                      {recommendations.map((t) => (
                        <div 
                          key={t.id} 
                          onClick={() => { setCurrentTrack(t); setIsPlaying(true); }}
                          className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group"
                        >
                        {t.cover ? (
                          <img src={t.cover} className="w-16 h-16 rounded-xl object-cover shrink-0" alt="r" />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><MusicIcon className="text-white/20" size={16} /></div>
                        )}
                          <div className="min-w-0">
                             <p className="text-sm font-bold text-white truncate">{t.title}</p>
                             <p className="text-[10px] text-white/30 truncate mt-1">{t.artist}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Trending Section */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl mixed-gradient flex items-center justify-center shadow-lg"><TrendingUp size={24} color="white"/></div>
                       <div>
                          <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Trending Now</h3>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 italic">Global Hits</p>
                       </div>
                    </div>
                    <button onClick={() => setActiveTab("trending")} className="text-[10px] text-white/40 hover:text-magenta uppercase font-black tracking-widest transition-colors">View More</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
                    {trendingTracks.filter(t => t.type === 'track').slice(0, 6).map((t) => (
                      <div 
                        key={t.id} 
                        onClick={() => { setCurrentTrack({ ...t, cover: t.thumbnail, artist: t.author }); setIsPlaying(true); }}
                        className="group cursor-pointer space-y-4"
                      >
                        <div className="relative aspect-square rounded-3xl overflow-hidden shadow-xl border border-white/5">
                          <img src={t.thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                            <Play fill="white" size={32} stroke="none" />
                          </div>
                        </div>
                        <div className="px-1">
                           <p className="text-xs font-black text-white truncate uppercase italic tracking-tight">{t.title}</p>
                           <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1 font-black italic">{t.author}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* New Releases (Playlists/Albums) */}
                <section className="space-y-8">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40"><Layers size={24} /></div>
                      <div>
                         <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none text-magenta">Trending Albums</h3>
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 italic">Best Collections</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {trendingTracks.filter(t => t.type === 'album').slice(0, 3).map(album => (
                        <div 
                          key={album.id}
                          onClick={() => handleAlbumClick(album)}
                          className="relative h-64 rounded-[2.5rem] overflow-hidden group cursor-pointer border border-white/10 shadow-2xl"
                        >
                           <img src={album.thumbnail} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-[10s]" />
                           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                           <div className="absolute inset-0 flex flex-col justify-end p-8 space-y-2">
                              <span className="w-fit px-3 py-1 bg-magenta/20 text-magenta text-[8px] font-black uppercase tracking-widest rounded-full border border-magenta/30">{album.category}</span>
                              <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white">{album.title}</h4>
                              <p className="text-xs text-white/40 font-black uppercase tracking-widest">{album.author}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </section>

                {/* Genres / For You */}
                <section className="space-y-10">
                   <div className="text-center">
                      <h3 className="text-4xl font-black italic uppercase tracking-tighter text-white/10">Music Genres</h3>
                   </div>
                   <div className="flex flex-wrap justify-center gap-4">
                      {["Afrobeats", "UK Drill", "Asian Hits", "K-Pop", "Amapiano", "Hip Hop", "Latin", "Lo-Fi", "Synthwave", "Phonk"].map(genre => (
                        <button 
                          key={genre}
                          onClick={() => { setSearchQuery(genre); handleSearch(); }}
                          className="px-10 py-5 rounded-3xl border border-white/10 bg-white/5 hover:bg-magenta hover:text-white hover:border-magenta font-black uppercase tracking-widest text-[10px] italic transition-all shadow-lg active:scale-95"
                        >
                           {genre}
                        </button>
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
                      <h3 className="text-5xl font-black italic uppercase tracking-tighter leading-none">Featured Artists</h3>
                    </div>
                  </div>
                  <div className="flex gap-8 overflow-x-auto no-scrollbar pb-6 -mx-4 px-4">
                    {[
                      { id: 27, name: 'Daft Punk', img: 'https://e-cdns-images.dzcdn.net/images/artist/f2bc007e9133c9484f380a9370f37d50/500x500.jpg' },
                      { id: 13, name: 'Eminem', img: 'https://e-cdns-images.dzcdn.net/images/artist/19543ad22da6e03946014e5cae285a8a/500x500.jpg' },
                      { id: 1, name: 'The Beatles', img: 'https://e-cdns-images.dzcdn.net/images/artist/0bf0f45532298c440a77519a868424a7/500x500.jpg' },
                      { id: 412, name: 'Queen', img: 'https://e-cdns-images.dzcdn.net/images/artist/Queen/500x500.jpg' },
                      { id: 119, name: 'Metallica', img: 'https://e-cdns-images.dzcdn.net/images/artist/Metallica/500x500.jpg' },
                      { id: 5092, name: 'Pink Floyd', img: 'https://e-cdns-images.dzcdn.net/images/artist/PinkFloyd/500x500.jpg' },
                      { id: 144227, name: 'Drake', img: 'https://e-cdns-images.dzcdn.net/images/artist/Drake/500x500.jpg' },
                      { id: 1045, name: 'Coldplay', img: 'https://e-cdns-images.dzcdn.net/images/artist/080df105c973022c6019bd375f928aad/500x500.jpg' }
                    ].map(art => (
                      <div 
                        key={art.id} 
                        onClick={() => handleArtistClick(art)}
                        className="w-44 shrink-0 group cursor-pointer space-y-4"
                      >
                        <div className="relative aspect-square rounded-full overflow-hidden border-2 border-white/5 group-hover:border-magenta transition-all shadow-2xl">
                          <img src={art.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={art.name} />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                            <ArrowRight className="text-white" />
                          </div>
                        </div>
                        <p className="text-center font-black italic uppercase tracking-tighter text-sm group-hover:text-magenta transition-colors">{art.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-[0.4em] text-magenta mb-2">Recommended for you</p>
                      <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">Trending Albums</h2>
                    </div>
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
                    {["Trending", "Afrobeats", "UK Drill", "Asian", "Hip Hop", "Drill", "Amapiano", "Electronic", "Albums"].map((cat) => (
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
                  {trendingTracks.filter(t => trendingCategory === "Trending" ? true : t.category === trendingCategory).map((t) => (
                    <div 
                      key={t.id} 
                      onClick={() => { 
                        if (t.type === 'album') { handleAlbumClick(t); }
                        else { setCurrentTrack({ ...t, cover: t.thumbnail, artist: t.author }); setIsPlaying(true); }
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
      <footer className="h-24 backdrop-blur-3xl bg-black/80 border-t border-white/10 flex items-center justify-between px-10 relative z-[90]">
        <div className="flex items-center gap-5 w-1/4">
          {currentTrack ? (
            <>
              <div className="w-14 h-14 bg-white/5 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                <img src={currentTrack.cover} className="w-full h-full object-cover" alt="current" />
              </div>
              <div className="max-w-[180px]">
                <p className="text-sm font-bold text-white truncate leading-tight">{currentTrack.title}</p>
                <p className="text-[10px] text-white/40 truncate mt-1 uppercase tracking-widest font-black italic">{currentTrack.artist}</p>
              </div>
              <button className="text-pink hover:scale-110 transition-transform">
                <Heart size={18} fill="currentColor" />
              </button>
            </>
          ) : (
            <div className="text-white/20 text-[10px] font-black uppercase tracking-widest italic">Choose a track to play</div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 w-2/4 max-w-2xl px-16">
          <div className="flex items-center gap-8">
            <Shuffle size={18} className="text-white/40 cursor-pointer hover:text-magenta transition-colors" />
            <SkipBack size={22} className="text-white cursor-pointer hover:scale-110 transition-all" />
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-12 h-12 mixed-gradient rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(255,0,255,0.3)] hover:scale-110 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
            </button>
            <SkipForward size={22} className="text-white cursor-pointer hover:scale-110 transition-all" />
            <Repeat size={18} className="text-white/40 cursor-pointer hover:text-neon-blue transition-colors" />
          </div>
          <div className="flex items-center gap-4 w-full px-4">
            <span className="text-[10px] text-white/30 font-mono font-bold">{formatTime(currentTime)}</span>
            <div 
              onClick={seek}
              className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer relative overflow-hidden group"
            >
              <div 
                className="absolute top-0 left-0 h-full mixed-gradient rounded-full" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <div className="absolute top-0 left-0 w-full h-full group-hover:bg-white/5 transition-colors" />
            </div>
            <span className="text-[10px] text-white/30 font-mono font-bold">{formatTime(duration)}</span>
          </div>
        </div>

        <audio 
          ref={audioRef}
          src={currentTrack ? (currentTrack.isOffline ? (offlineUrl || undefined) : `/api/stream?url=${encodeURIComponent(currentTrack.url)}`) : undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={playNext}
          onError={() => {
            setIsPlaying(false);
            setErrorMessage("Stream failed. Possible YouTube blocking or invalid link.");
          }}
        />

        <div className="flex items-center justify-end gap-6 w-1/4">
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
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [users, setUsers] = useState<any[]>([
    { id: 1, name: "John Doe", email: "john@nova.com", plan: "Premium", joinDate: "2026-05-01" },
    { id: 2, name: "Jane Smith", email: "jane@nova.com", plan: "Free", joinDate: "2026-05-10" },
    { id: 3, name: "Alex Ross", email: "alex@nova.com", plan: "Premium", joinDate: "2026-05-12" },
  ]);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setStats(data))
      .catch(err => console.error("Admin stats fetch failed", err));
    const q = query(collection(db, "admins"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const addAdmin = async () => {
     if (!newAdminEmail) return;
     await addDoc(collection(db, "admins"), { email: newAdminEmail });
     setNewAdminEmail("");
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
           <AdminTabBtn active={activeSubTab === 'content'} icon={<MusicIcon size={14} />} label="Content" onClick={() => setActiveSubTab('content')} />
           <AdminTabBtn active={activeSubTab === 'config'} icon={<Settings size={14} />} label="System" onClick={() => setActiveSubTab('config')} />
        </div>
      </div>

      <div className="relative min-h-[500px]">
        {activeSubTab === 'dash' && (
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard label="Total Pulse" value={stats?.totalUsers || '0'} trend="+12.5%" icon={<Users className="text-magenta" size={20}/>}/>
                 <StatCard label="Live Streams" value={stats?.totalStreams || '0'} trend="+40%" icon={<Activity className="text-neon-blue" size={20}/>}/>
                 <StatCard label="Net Revenue" value={`$${stats?.revenue || '0'}`} trend="+18.2%" icon={<DollarSign className="text-green-400" size={20}/>}/>
                 <StatCard label="Active Now" value={stats?.dailyActive || '0'} trend="+2.3%" icon={<Cpu className="text-magenta" size={20}/>}/>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 bg-white/5 border border-white/10 p-8 rounded-[3rem] h-[400px] flex flex-col items-center justify-center text-white/10 gap-6">
                    <BarChart3 size={64} />
                    <p className="font-black uppercase tracking-[0.5em] text-[10px] text-white/30 text-center">Real-time Traffic Telemetry Processing...</p>
                    <div className="flex gap-2 items-end">
                       {[40, 70, 45, 90, 65, 80, 55, 30, 95].map((h, i) => (
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
                    <h3 className="font-black uppercase italic tracking-widest text-white/20 text-[10px]">Resource Saturation</h3>
                    <div className="space-y-8">
                       <UsageBar label="Global Storage" value={76} hint={stats?.storageUsed || '0GB'} color="bg-magenta shadow-[0_0_20px_rgba(255,0,255,0.4)]" />
                       <UsageBar label="CDN Transmit" value={34} hint={stats?.bandwidth || '0TB'} color="bg-neon-blue shadow-[0_0_20px_rgba(0,255,255,0.4)]" />
                       <UsageBar label="Core Clusters" value={12} hint="Optimal" color="bg-green-400" />
                       <UsageBar label="API Latecy" value={5} hint="4ms" color="bg-white" />
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
                       <th className="px-8 py-6 italic">Protocol</th>
                       <th className="px-8 py-6 italic">Nexus Join</th>
                       <th className="px-8 py-6 italic">Status</th>
                       <th className="px-8 py-6 italic">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                       <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-black italic text-xs">{u.name[0]}</div>
                                <div>
                                   <p className="text-sm font-bold text-white">{u.name}</p>
                                   <p className="text-[10px] text-white/30 font-black">{u.email}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                             <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${u.plan === 'Premium' ? 'bg-magenta/20 text-magenta border border-magenta/20' : 'bg-white/10 text-white/40'}`}>
                                {u.plan}
                             </span>
                          </td>
                          <td className="px-8 py-6 text-[10px] font-mono text-white/40">{u.joinDate}</td>
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(0,255,0,0.5)]"></div>
                                <span className="text-[10px] font-black uppercase text-white/80">Sync'd</span>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                             <button className="text-white/20 hover:text-magenta transition-colors"><ShieldCheck size={18} /></button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-16">
      <div className="relative h-[400px] rounded-[4rem] overflow-hidden group shadow-2xl border border-white/10">
        {artist.info.picture_xl ? (
          <img src={artist.info.picture_xl} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[10s]" />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center"><UserIcon className="text-white/20" size={64} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        <div className="absolute bottom-12 left-12 space-y-4">
           <div className="flex items-center gap-3">
              <ShieldCheck className="text-magenta" size={24} />
              <span className="text-xs font-black uppercase tracking-[0.4em] text-white/60 italic">Verified Artist</span>
           </div>
           <h2 className="text-8xl font-black uppercase italic tracking-tighter text-white leading-none">{artist.info.name}</h2>
           <div className="flex gap-6 items-center">
              <span className="text-white font-black text-xl italic uppercase tracking-tighter">{artist.info.nb_fan.toLocaleString()} Dedicated Fans</span>
              <div className="w-1.5 h-1.5 bg-magenta rounded-full" />
              <span className="text-white/40 font-black text-xs uppercase tracking-widest">{artist.albums.length} Full Albums</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
         <div className="lg:col-span-2 space-y-10">
            <div className="flex items-center justify-between">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter">Popular Tracks</h3>
              <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">{artist.tracks.length} Anthems</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {artist.tracks.map((t: any, i: number) => (
                 <div 
                   key={t.id} 
                   className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-[1.8rem] hover:bg-white/10 transition-all group cursor-pointer"
                 >
                    <div onClick={() => onPlay({ 
                      id: t.id, 
                      title: t.title, 
                      artist: artist.info.name, 
                      cover: t.album?.cover_medium, 
                      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.info.name + ' ' + t.title + ' official audio')}`
                    })} className="flex flex-1 items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                        {t.album?.cover_small ? (
                          <img src={t.album?.cover_small} className="w-full h-full object-cover" alt="t" />
                        ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={16} /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="font-bold text-white italic truncate text-sm uppercase tracking-tight">{t.title}</p>
                         <p className="text-[10px] text-white/30 uppercase font-black truncate mt-1">{t.album?.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={(e) => { e.stopPropagation(); onDownload({ id: t.id, title: t.title, author: artist.info.name, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.info.name + ' ' + t.title + ' official audio')}`, thumbnail: t.album?.cover_medium, duration: t.duration }, "mp3"); }}
                         className="p-2 hover:bg-magenta/20 rounded-lg text-white/20 hover:text-magenta transition-all"
                         title="Download Audio"
                       >
                         <Download size={14} />
                       </button>
                       <button 
                         onClick={(e) => { e.stopPropagation(); onDownload({ id: t.id, title: t.title, author: artist.info.name, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.info.name + ' ' + t.title + ' official audio')}`, thumbnail: t.album?.cover_medium, duration: t.duration }, "mp4"); }}
                         className="p-2 hover:bg-blue-500/20 rounded-lg text-white/20 hover:text-blue-500 transition-all"
                         title="Download Video"
                       >
                         <VideoIcon size={14} />
                       </button>
                       <Play size={14} className="text-white/20 group-hover:text-magenta transition-colors" onClick={() => onPlay({ id: t.id, title: t.title, artist: artist.info.name, cover: t.album?.cover_medium, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(artist.info.name + ' ' + t.title + ' official audio')}` })} />
                    </div>
                 </div>
               ))}
            </div>
         </div>
         <div className="space-y-10">
            <div className="p-10 bg-white/5 border border-white/10 rounded-[3rem] space-y-6">
               <h3 className="text-xs font-black uppercase italic tracking-widest text-magenta">Identity Bio</h3>
               <p className="text-sm font-bold text-white/60 leading-relaxed italic">{artist.bio || "No official bio available for this entity."}</p>
               <div className="pt-4 flex flex-wrap gap-2">
                  {artist.info.genres?.data?.map((g: any) => (
                    <span key={g.id} className="px-4 py-2 bg-white/5 border border-white/10 text-[9px] uppercase font-black tracking-widest rounded-full text-white/60">{g.name}</span>
                  )) || ["General", "Artist"].map(g => <span key={g} className="px-4 py-2 bg-white/5 border border-white/10 text-[9px] uppercase font-black tracking-widest rounded-full">{g}</span>)}
               </div>
            </div>

            <div className="space-y-6">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black uppercase italic tracking-widest text-white/20">Studio Discography</h3>
                  <span className="text-[10px] text-white/20 font-black">{artist.albums.length}</span>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {artist.albums.map((a: any) => (
                    <div 
                      key={a.id} 
                      onClick={() => onAlbum({ id: a.id, title: a.title, thumbnail: a.cover_medium, author: artist.info.name })} 
                      className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-magenta/40 transition-all cursor-pointer group"
                    >
                       <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                         {a.cover_small ? (
                           <img src={a.cover_small} className="w-full h-full object-cover" alt="a" />
                         ) : (
                           <div className="w-full h-full bg-white/5 flex items-center justify-center"><MusicIcon className="text-white/20" size={12} /></div>
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate uppercase italic">{a.title}</p>
                          <p className="text-[9px] text-white/40 uppercase font-black mt-1 tracking-widest">{a.release_date.split('-')[0]} • {a.genre_id === 0 ? 'Single' : 'Album'}</p>
                       </div>
                       <ChevronRight size={14} className="text-white/10 group-hover:text-magenta transition-colors" />
                    </div>
                  ))}
               </div>
            </div>
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
      className={`flex items-center space-x-4 transition-all cursor-pointer px-4 py-3 rounded-2xl ${active ? "bg-white/10 text-white shadow-xl" : "text-white/50 hover:text-white hover:bg-white/5"}`}
    >
      {icon}
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </div>
  );
}

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
