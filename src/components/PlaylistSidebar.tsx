'use client';

import { useAppStore } from '@/store/useAppStore';
import { Play, ListMusic } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

export default function PlaylistSidebar() {
  const { playlist, currentSong, isPlaying, setIsPlaying, setCurrentSong, playMode, isMobilePlaylistOpen, setIsMobilePlaylistOpen } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [displaySongs, setDisplaySongs] = useState<any[]>([]);

  useEffect(() => {
    if (!playlist.length || !currentSong) {
      setDisplaySongs(playlist);
      return;
    }

    if (playMode === 'shuffle') {
      const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
      if (currentIndex === -1) {
        setDisplaySongs(playlist.slice(0, 11));
        return;
      }
      
      const arr = [];
      const total = playlist.length;
      
      // 如果歌单太短（不足11首），没必要用前后5首的切片逻辑强制凑出11首导致重复
      if (total <= 11) {
        setDisplaySongs(playlist);
      } else {
        // 显示前后5首，共11首
        for (let i = -5; i <= 5; i++) {
          const idx = (currentIndex + i + total) % total;
          arr.push(playlist[idx]);
        }
        setDisplaySongs(arr);
      }
    } else {
      // 非随机模式，直接展示完整的播放列表，不做截断和循环
      setDisplaySongs(playlist);
    }
  }, [playlist, currentSong, playMode]);

  // Auto-scroll to current song when it changes
  useEffect(() => {
    if (currentSong && scrollRef.current && playMode !== 'shuffle') {
      const activeElement = scrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentSong?.id, playMode]);

  if (!playlist.length) return null;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobilePlaylistOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-sm"
          onClick={() => setIsMobilePlaylistOpen(false)}
        />
      )}

      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className={clsx(
          "fixed right-0 top-0 bottom-24 w-72 p-6 flex flex-col border-l border-black/5 dark:border-white/10 z-50 bg-[#f5f5f7] dark:bg-[#121212] transition-transform duration-300 xl:translate-x-0 xl:bg-transparent xl:dark:bg-transparent",
          isMobilePlaylistOpen ? "translate-x-0 shadow-2xl" : "translate-x-full"
        )}
      >
      <div className="flex items-center gap-2 mb-6 text-[#1d1d1f] dark:text-[#f5f5f7]">
        <ListMusic className="w-5 h-5" />
        <h2 className="text-lg font-semibold">当前播放列表</h2>
        <span className="text-xs text-[#86868b] ml-auto font-medium">{playlist.length} 首</span>
      </div>

      <div 
        ref={scrollRef} 
        className={clsx(
          "flex-1 overflow-y-auto overflow-x-hidden space-y-1.5 pr-2 custom-scrollbar -mr-4 relative",
          playMode === 'shuffle' && playlist.length > 11 && "mask-image-linear-y"
        )}
      >
        {displaySongs.map((song, index) => {
          const isShuffleModeAndLongList = playMode === 'shuffle' && playlist.length > 11;
          const isCurrent = isShuffleModeAndLongList ? index === 5 : currentSong?.id === song.id;

          let opacityClass = 'opacity-100';
          if (isShuffleModeAndLongList) {
            const distance = Math.abs(index - 5);
            opacityClass = distance > 0 
              ? distance === 1 ? 'opacity-90'
              : distance === 2 ? 'opacity-75'
              : distance === 3 ? 'opacity-50'
              : distance === 4 ? 'opacity-30'
              : 'opacity-10'
              : 'opacity-100';
          }

          return (
            <div 
              key={song.id + '-' + index}
              data-active={isCurrent}
              onClick={() => {
                if (isCurrent) {
                  setIsPlaying(!isPlaying);
                } else {
                  setCurrentSong(song);
                  setIsPlaying(true);
                }
              }}
              className={clsx(
                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all group",
                isCurrent 
                  ? "bg-black/5 dark:bg-white/10" 
                  : "hover:bg-black/5 dark:hover:bg-white/5",
                opacityClass
              )}
            >
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center relative">
                {isCurrent ? (
                  <div className="flex items-end gap-0.5 h-3 w-3">
                    <motion.div className="w-0.5 bg-[#0071e3] rounded-full" animate={{ height: isPlaying ? ["3px", "8px", "3px"] : "3px" }} transition={{ repeat: Infinity, duration: 0.8 }} />
                    <motion.div className="w-0.5 bg-[#0071e3] rounded-full" animate={{ height: isPlaying ? ["6px", "12px", "6px"] : "6px" }} transition={{ repeat: Infinity, duration: 1.2 }} />
                    <motion.div className="w-0.5 bg-[#0071e3] rounded-full" animate={{ height: isPlaying ? ["4px", "8px", "4px"] : "4px" }} transition={{ repeat: Infinity, duration: 0.9 }} />
                  </div>
                ) : (
                  <span className="text-xs font-medium text-[#86868b] hidden">
                    {index + 1}
                  </span>
                )}
                <Play className={clsx("w-3 h-3 text-[#1d1d1f] dark:text-white hidden group-hover:block", isCurrent && "hidden")} />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <span className={clsx("truncate text-sm font-medium", isCurrent ? "text-[#0071e3]" : "text-[#1d1d1f] dark:text-[#f5f5f7]")}>
                  {song.name}
                </span>
                <span className={clsx("truncate text-xs text-[#86868b]", opacityClass === 'opacity-10' && "hidden")}>
                  {song.ar?.map((a: any) => a.name).join(', ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
    </>
  );
}
