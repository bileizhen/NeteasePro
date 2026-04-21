'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Play, Pause, MoreVertical, Heart, Loader2, Download, X, Plus, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import confetti from 'canvas-confetti';

export default function PlaylistView() {
  const { profile, cookie, setCurrentSong, setPlaylist, addToPlaylist, addMultipleToPlaylist, currentSong, isPlaying, setIsPlaying, setIsInitialLoading, isInitialLoading, setCurrentPlaylistId } = useAppStore();
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playlistId, setPlaylistId] = useState<number | null>(null);
  const [openDownloadId, setOpenDownloadId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  useEffect(() => {
    // Check if this is the first login by checking localStorage
    const hasSeenWelcome = localStorage.getItem('has_seen_welcome');
    if (profile?.nickname && !hasSeenWelcome) {
      setShowWelcome(true);
      localStorage.setItem('has_seen_welcome', 'true');
      
      // Fire confetti from both sides
      const duration = 2500;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 150 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti({
          ...defaults, particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults, particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // We no longer auto hide after 2.5s, we wait for isInitialLoading to finish
      // The welcome screen will be hidden when both showWelcome is false (handled below) AND isInitialLoading is false
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [profile]);

  useEffect(() => {
    if (profile && cookie) {
      fetchPlaylist().then(() => {
        setShowWelcome(false); // Hide welcome screen after fetch completes
      });
    }
  }, [profile, cookie]);

  const fetchPlaylist = async () => {
    setLoading(true);
    setIsInitialLoading(true);
    try {
      // 1. 获取用户歌单列表
      const listRes = await fetch('/api/user/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: profile?.userId, limit: 1000, cookie }),
      }).then(res => res.json());

      const likePlaylistId = listRes.playlist?.[0]?.id;

      if (likePlaylistId) {
        setPlaylistId(likePlaylistId);
        // 2. 获取"我喜欢的音乐"详情
        const detailRes = await fetch('/api/playlist/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: likePlaylistId, cookie }),
        }).then(res => res.json());

        // 获取全部歌曲ID，并分批请求歌曲详情
        const trackIds = detailRes.playlist?.trackIds?.map((t: any) => t.id) || [];

        // 3. 获取歌曲详情
        if (trackIds.length > 0) {
          // 由于 song/detail 接口有时对一次性传入过多 ID 有限制，这里分成每次最多 500 个进行请求
          const chunkSize = 500;
          let allSongs: any[] = [];
          
          for (let i = 0; i < trackIds.length; i += chunkSize) {
            const chunkIds = trackIds.slice(i, i + chunkSize);
            const songRes = await fetch('/api/song/detail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: chunkIds.join(','), cookie }),
            }).then(res => res.json());
            
            if (songRes.songs) {
              allSongs = [...allSongs, ...songRes.songs];
            }
          }

          setSongs(allSongs);
        }
      }
    } catch (error) {
      console.error('Failed to fetch playlist', error);
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  };

  const handlePlay = (song: any) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentPlaylistId(playlistId);
      setCurrentSong(song);
      addToPlaylist(song);
      setIsPlaying(true);
    }
  };

  const handlePlayAll = () => {
    if (!songs.length) return;
    setCurrentPlaylistId(playlistId);
    setPlaylist(songs);
    setCurrentSong(songs[0]);
    setIsPlaying(true);
    useAppStore.getState().setPlayMode('sequence');
  };

  const handleAdd = (e: React.MouseEvent, song: any) => {
    e.stopPropagation();
    addToPlaylist(song);
  };

  const toggleSelectMode = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      setSelectedIds(new Set()); // clear selection when exiting
    }
    setOpenMenuId(null);
  };
  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(songs.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelection = (e: React.ChangeEvent<HTMLInputElement>, id: number) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (e.target.checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleBatchPlay = () => {
    const selectedSongs = songs.filter(s => selectedIds.has(s.id));
    if (selectedSongs.length > 0) {
      setCurrentPlaylistId(playlistId);
      setPlaylist(selectedSongs);
      setCurrentSong(selectedSongs[0]);
      setIsPlaying(true);
      setSelectedIds(new Set());
    }
  };

  const handleBatchAdd = () => {
    const selectedSongs = songs.filter(s => selectedIds.has(s.id));
    addMultipleToPlaylist(selectedSongs);
    setSelectedIds(new Set());
  };

  const handleBatchDownload = async () => {
    const selectedSongs = songs.filter(s => selectedIds.has(s.id));
    for (const song of selectedSongs) {
      try {
        const res = await fetch('/api/song/url/v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: song.id, level: 'exhigh', cookie }),
        }).then(r => r.json());
        
        let url = res.data?.[0]?.url;
        if (url) {
          // Ensure HTTPS is used for fetching to prevent Mixed Content blocked by browser
          url = url.replace(/^http:\/\//i, 'https://');
          
          await fetch(url)
            .then(response => {
              if (!response.ok) throw new Error('Network response was not ok');
              return response.blob();
            })
            .then(blob => {
              const objectUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = objectUrl;
              a.download = `${song.name}.mp3`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(objectUrl);
            });
        }
      } catch (error) {
        console.error(`Download error for ${song.name}:`, error);
      }
      // Small delay to avoid browser blocking multiple downloads
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setSelectedIds(new Set());
  };

  const handleDownload = async (e: any, song: any, level: string) => {
    e.stopPropagation();
    setOpenDownloadId(null);
    try {
      const res = await fetch('/api/song/url/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: song.id, level, cookie }),
      }).then(r => r.json());
      
      let url = res.data?.[0]?.url;
      if (url) {
        // Ensure HTTPS is used for fetching to prevent Mixed Content blocked by browser
        url = url.replace(/^http:\/\//i, 'https://');
        
        // 由于跨域限制，直接使用 a 标签 download 可能会直接在浏览器播放
        // 尝试通过 fetch 获取 blob 强制下载，如果失败则回退到新窗口打开
        fetch(url)
          .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.blob();
          })
          .then(blob => {
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `${song.name}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
          })
          .catch(() => {
            window.open(url, '_blank');
          });
      } else {
        alert('无法获取该音质的下载链接（可能需要VIP或暂无版权）');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('下载失败，请稍后重试');
    }
  };

  if (!profile) return null;

  return (
    <div className="w-full max-w-5xl mx-auto my-8 px-6 min-h-[70vh] flex flex-col">
      <AnimatePresence>
        {(showWelcome || isInitialLoading) && profile && (
          <motion.div
            key="welcome-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f5f5f7] dark:bg-black"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8, type: 'spring' }}
              className="flex flex-col items-center gap-6"
            >
              <img 
                src={profile.avatarUrl} 
                alt="Avatar" 
                className="w-24 h-24 rounded-full shadow-2xl border-4 border-white/10"
              />
              <div className="text-center space-y-2">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] dark:text-white">
                  欢迎你
                </h1>
                <p className="text-3xl md:text-4xl font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                  {profile.nickname}
                </p>
              </div>
              
              <AnimatePresence>
                {isInitialLoading && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col items-center mt-8 space-y-3"
                  >
                    <Loader2 className="w-8 h-8 text-[#0071e3] animate-spin" />
                    <p className="text-sm text-[#86868b] font-medium tracking-wide">正在加载您的音乐世界...</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 mb-8 md:mb-10 pb-6 md:pb-10">
        <div className="w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden shadow-md relative group bg-[#1d1d1f] dark:bg-[#f5f5f7] flex-shrink-0">
          {songs.length > 0 && songs[0].al?.picUrl ? (
            <img src={songs[0].al.picUrl + '?param=300y300'} alt="Playlist Cover" className="w-full h-full object-cover" />
          ) : (
            <Heart className="absolute inset-0 m-auto text-white dark:text-black w-12 h-12 md:w-16 md:h-16" fill="currentColor" />
          )}
        </div>
        <div className="flex flex-col gap-2 md:gap-3 items-center md:items-start text-center md:text-left">
          <span className="text-[10px] md:text-xs font-semibold tracking-widest text-[#86868b] uppercase">Playlist</span>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            我喜欢的音乐
          </h1>
          <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-[#86868b] mt-1 md:mt-2">
            <img src={profile.avatarUrl} alt="Avatar" className="w-5 h-5 md:w-6 md:h-6 rounded-full" />
            <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">{profile.nickname}</span>
            <span>•</span>
            <span>{songs.length} 首歌</span>
          </div>
          <div className="mt-3 md:mt-4 flex items-center gap-4">
            <button 
              onClick={handlePlayAll}
              className="flex items-center gap-2 bg-[#0071e3] hover:bg-[#0077ed] text-white px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base font-semibold transition-colors"
            >
              <Play className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" />
              播放
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#86868b] animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-24">
            <div className={clsx(
              "grid gap-2 md:gap-4 px-2 md:px-4 py-2 text-[10px] md:text-xs font-medium text-[#86868b] uppercase tracking-wider border-b border-black/5 dark:border-white/10 mb-2 md:mb-4 items-center",
              isSelectMode ? "grid-cols-[32px_auto_minmax(0,1fr)_auto] md:grid-cols-[32px_auto_minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]"
            )}>
              {isSelectMode && (
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={songs.length > 0 && selectedIds.size === songs.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#0071e3]"
                  />
                </div>
              )}
              <span className="w-6 md:w-8 text-center hidden md:block">#</span>
              <span className={clsx(isSelectMode ? "ml-0" : "ml-2 md:ml-0")}>Title</span>
              <span className="hidden md:block">Album</span>
              <span className="w-16 md:w-28 text-right">Time</span>
            </div>
            
            {songs.map((song, index) => {
              const isCurrent = currentSong?.id === song.id;
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.01, 0.5) }}
                  key={song.id}
                  id={`song-${song.id}`}
                  className={clsx(
                    "grid gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-3 rounded-xl items-center cursor-pointer transition-all group hover:bg-black/5 dark:hover:bg-white/5",
                    isSelectMode ? "grid-cols-[32px_auto_minmax(0,1fr)_auto] md:grid-cols-[32px_auto_minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]",
                    isCurrent && "bg-black/5 dark:bg-white/10",
                    isSelectMode && selectedIds.has(song.id) && "bg-black/5 dark:bg-white/10"
                  )}
                  onClick={() => {
                    if (isSelectMode) {
                      const newSet = new Set(selectedIds);
                      if (newSet.has(song.id)) newSet.delete(song.id);
                      else newSet.add(song.id);
                      setSelectedIds(newSet);
                    } else {
                      handlePlay(song);
                    }
                  }}
                >
                  {isSelectMode && (
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(song.id)}
                        onChange={(e) => toggleSelection(e, song.id)}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#0071e3]"
                      />
                    </div>
                  )}
                  <div className="w-6 md:w-8 text-center hidden md:flex justify-center relative">
                    {isCurrent && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-4 w-4">
                        <motion.div className="w-1 bg-[#1d1d1f] dark:bg-white rounded-full" animate={{ height: ["4px", "12px", "4px"] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                        <motion.div className="w-1 bg-[#1d1d1f] dark:bg-white rounded-full" animate={{ height: ["8px", "16px", "8px"] }} transition={{ repeat: Infinity, duration: 1.2 }} />
                        <motion.div className="w-1 bg-[#1d1d1f] dark:bg-white rounded-full" animate={{ height: ["6px", "10px", "6px"] }} transition={{ repeat: Infinity, duration: 0.9 }} />
                      </div>
                    ) : (
                      <span className="text-[#86868b] group-hover:hidden text-sm">{index + 1}</span>
                    )}
                    <Play className={clsx("w-4 h-4 text-[#1d1d1f] dark:text-white hidden group-hover:block", isCurrent && isPlaying && "hidden")} />
                  </div>
                  
                  <div className={clsx("flex items-center gap-3 md:gap-4 overflow-hidden", isSelectMode ? "ml-0" : "ml-2 md:ml-0")}>
                    <div className="w-10 h-10 md:w-10 md:h-10 rounded-md overflow-hidden flex-shrink-0 relative">
                      <img src={song.al.picUrl + '?param=80y80'} alt="Cover" className="w-full h-full object-cover border border-black/5 dark:border-white/10" />
                      {/* Mobile Playing Indicator Overlay */}
                      {isCurrent && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center md:hidden">
                          <div className="flex items-end gap-[2px] h-3 w-3">
                            <motion.div className="w-[2px] bg-white rounded-full" animate={{ height: ["3px", "8px", "3px"] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                            <motion.div className="w-[2px] bg-white rounded-full" animate={{ height: ["6px", "12px", "6px"] }} transition={{ repeat: Infinity, duration: 1.2 }} />
                            <motion.div className="w-[2px] bg-white rounded-full" animate={{ height: ["4px", "8px", "4px"] }} transition={{ repeat: Infinity, duration: 0.9 }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className={clsx("truncate font-medium text-[13px] md:text-sm", isCurrent ? "text-[#0071e3]" : "text-[#1d1d1f] dark:text-[#f5f5f7]")}>
                        {song.name}
                      </span>
                      <span className="truncate text-[11px] md:text-xs text-[#86868b]">
                        {song.ar.map((a: any) => a.name).join(', ')}
                      </span>
                    </div>
                  </div>

                  <span className="hidden md:block truncate text-sm text-[#86868b] group-hover:text-[#1d1d1f] dark:group-hover:text-[#f5f5f7] transition-colors">
                    {song.al.name}
                  </span>

                  <div className="w-16 md:w-28 text-right flex items-center justify-end gap-1 text-[11px] md:text-sm text-[#86868b] relative">
                    <span className="group-hover:hidden block mr-0 md:mr-2">
                      {Math.floor(song.dt / 60000)}:{String(Math.floor((song.dt % 60000) / 1000)).padStart(2, '0')}
                    </span>
                    <button 
                      onClick={(e) => handleAdd(e, song)}
                      className="hidden group-hover:flex items-center justify-center p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-[#1d1d1f] dark:text-white"
                      title="添加到播放列表"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOpenDownloadId(openDownloadId === song.id ? null : song.id); }}
                      className="hidden group-hover:flex items-center justify-center p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-[#1d1d1f] dark:text-white"
                      title="下载"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === song.id ? null : song.id);
                        setOpenDownloadId(null);
                      }}
                      className="hidden group-hover:flex items-center justify-center p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-[#1d1d1f] dark:text-white"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {openMenuId === song.id && (
                        <motion.div 
                          key={`more-menu-${song.id}`}
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-10 w-36 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-xl border border-black/10 dark:border-white/10 z-50 overflow-hidden flex flex-col py-1"
                        >
                          <button 
                            onClick={(e) => toggleSelectMode(e)} 
                            className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white"
                          >
                            多选
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {openDownloadId === song.id && (
                        <motion.div 
                          key={`download-menu-${song.id}`}
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-10 w-36 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-xl border border-black/10 dark:border-white/10 z-50 overflow-hidden flex flex-col py-1"
                        >
                          <div className="px-3 py-2 text-xs font-semibold text-left text-[#86868b] border-b border-black/5 dark:border-white/5 flex justify-between items-center">
                            下载音质
                            <X className="w-3 h-3 cursor-pointer hover:text-black dark:hover:text-white" onClick={(e) => { e.stopPropagation(); setOpenDownloadId(null); }} />
                          </div>
                          <button onClick={(e) => handleDownload(e, song, 'standard')} className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white">标准音质</button>
                          <button onClick={(e) => handleDownload(e, song, 'exhigh')} className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white">极高音质</button>
                          <button onClick={(e) => handleDownload(e, song, 'lossless')} className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white">无损音质</button>
                          <button onClick={(e) => handleDownload(e, song, 'hires')} className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white">Hi-Res音质</button>
                          <button onClick={(e) => handleDownload(e, song, 'jyeffect')} className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white">高清环绕声</button>
                          <button onClick={(e) => handleDownload(e, song, 'sky')} className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white">沉浸环绕声</button>
                          <button onClick={(e) => handleDownload(e, song, 'jymaster')} className="text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#1d1d1f] dark:text-white">超清母带</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 bg-[#1d1d1f] dark:bg-[#2c2c2e] text-white px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-2xl flex items-center gap-3 md:gap-6 z-50 max-w-[95vw] overflow-x-auto no-scrollbar"
          >
            <span className="font-medium text-[11px] md:text-sm whitespace-nowrap">已选择 {selectedIds.size} 项</span>
            <div className="w-px h-4 md:h-6 bg-white/20"></div>
            <button onClick={handleBatchPlay} className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-sm hover:text-[#0071e3] transition-colors whitespace-nowrap">
              <Play className="w-3.5 h-3.5 md:w-4 md:h-4" /> 播放
            </button>
            <button onClick={handleBatchAdd} className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-sm hover:text-[#0071e3] transition-colors whitespace-nowrap">
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> 添加
            </button>
            <button onClick={handleBatchDownload} className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-sm hover:text-[#0071e3] transition-colors whitespace-nowrap">
              <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> 下载
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setIsSelectMode(false); }} className="p-1 hover:bg-white/10 rounded-full transition-colors ml-1 md:ml-2">
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
