'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Play, Loader2, Download, X, MoreVertical, Search, Plus, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export default function SearchView() {
  const { profile, cookie, searchQuery, currentSong, isPlaying, setIsPlaying, setCurrentSong, setPlaylist, addToPlaylist, addMultipleToPlaylist } = useAppStore();
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDownloadId, setOpenDownloadId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  useEffect(() => {
    if (searchQuery && cookie) {
      fetchSearch();
    } else {
      setSongs([]);
    }
  }, [searchQuery, cookie]);

  const fetchSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cloudsearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: searchQuery, type: 1, limit: 50, cookie }),
      }).then(r => r.json());

      if (res.result?.songs) {
        setSongs(res.result.songs);
      } else {
        setSongs([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (song: any) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentSong(song);
      addToPlaylist(song);
      setIsPlaying(true);
    }
  };

  const handlePlayAll = () => {
    if (!songs.length) return;
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
      setSelectedIds(new Set());
    }
    setOpenMenuId(null);
  };

  const toggleAll = () => {
    if (selectedIds.size === songs.length && songs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(songs.map(s => s.id)));
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBatchPlay = () => {
    const selectedSongs = songs.filter(s => selectedIds.has(s.id));
    if (selectedSongs.length > 0) {
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
        
        const url = res.data?.[0]?.url;
        if (url) {
          await fetch(url)
            .then(response => response.blob())
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
      
      const url = res.data?.[0]?.url;
      if (url) {
        fetch(url)
          .then(response => response.blob())
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

  if (!profile || !searchQuery) return null;

  return (
    <div className="w-full max-w-5xl mx-auto my-8 px-6 min-h-[70vh] flex flex-col">
      <div className="flex items-center gap-4 mb-10 pb-6">
        <div className="w-12 h-12 rounded-xl bg-[#0071e3] flex items-center justify-center text-white shadow-md">
          <Search className="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-widest text-[#86868b] uppercase">Search Results</span>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
            &quot;{searchQuery}&quot;
          </h1>
          <div className="mt-4 flex items-center gap-4">
            <button 
              onClick={handlePlayAll}
              className="flex items-center gap-2 bg-[#0071e3] hover:bg-[#0077ed] text-white px-6 py-2.5 rounded-full font-semibold transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
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
        ) : songs.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#86868b] gap-4">
            <Search className="w-12 h-12 opacity-20" />
            <p>未找到相关歌曲</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-24">
            <div className={clsx(
              "grid gap-4 px-4 py-2 text-xs font-medium text-[#86868b] uppercase tracking-wider border-b border-black/5 dark:border-white/10 mb-4 items-center",
              isSelectMode ? "grid-cols-[32px_auto_minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]"
            )}>
              {isSelectMode && (
                <div className="flex justify-center">
                  <input 
                    type="checkbox" 
                    checked={songs.length > 0 && selectedIds.size === songs.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-[#0071e3]"
                  />
                </div>
              )}
              <span className="w-8 text-center">#</span>
              <span>Title</span>
              <span>Album</span>
              <span className="w-28 text-right">Time</span>
            </div>
            
            {songs.map((song, index) => {
              const isCurrent = currentSong?.id === song.id;
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.01 }}
                  key={song.id}
                  id={`song-${song.id}`}
                  className={clsx(
                    "grid gap-4 px-4 py-3 rounded-xl items-center cursor-pointer transition-all group hover:bg-black/5 dark:hover:bg-white/5",
                    isSelectMode ? "grid-cols-[32px_auto_minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]",
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
                  <div className="w-8 text-center flex justify-center relative">
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
                  
                  <div className="flex items-center gap-4 overflow-hidden">
                    <img src={song.al.picUrl + '?param=80y80'} alt="Cover" className="w-10 h-10 rounded-md object-cover border border-black/5 dark:border-white/10" />
                    <div className="flex flex-col overflow-hidden">
                      <span className={clsx("truncate font-medium text-sm", isCurrent ? "text-[#0071e3]" : "text-[#1d1d1f] dark:text-[#f5f5f7]")}>
                        {song.name}
                      </span>
                      <span className="truncate text-xs text-[#86868b]">
                        {song.ar.map((a: any) => a.name).join(', ')}
                      </span>
                    </div>
                  </div>

                  <span className="truncate text-sm text-[#86868b] group-hover:text-[#1d1d1f] dark:group-hover:text-[#f5f5f7] transition-colors">
                    {song.al.name}
                  </span>

                  <div className="w-28 text-right flex items-center justify-end gap-1 text-sm text-[#86868b] relative">
                    <span className="group-hover:hidden block mr-2">
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
            className="fixed bottom-28 left-1/2 -translate-x-1/2 bg-[#1d1d1f] dark:bg-[#2c2c2e] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50"
          >
            <span className="font-medium text-sm whitespace-nowrap">已选择 {selectedIds.size} 项</span>
            <div className="w-px h-6 bg-white/20"></div>
            <button onClick={handleBatchPlay} className="flex items-center gap-2 text-sm hover:text-[#0071e3] transition-colors whitespace-nowrap">
              <Play className="w-4 h-4" /> 播放
            </button>
            <button onClick={handleBatchAdd} className="flex items-center gap-2 text-sm hover:text-[#0071e3] transition-colors whitespace-nowrap">
              <Plus className="w-4 h-4" /> 添加到列表
            </button>
            <button onClick={handleBatchDownload} className="flex items-center gap-2 text-sm hover:text-[#0071e3] transition-colors whitespace-nowrap">
              <Download className="w-4 h-4" /> 下载
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setIsSelectMode(false); }} className="p-1 hover:bg-white/10 rounded-full transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
