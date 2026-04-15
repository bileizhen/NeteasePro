'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize2, Mic2, X, ChevronDown, Repeat, Shuffle, Repeat1, MonitorPlay } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import PVMode from './PVMode';

type LyricWord = {
  time: number;
  duration: number;
  text: string;
};

type LyricLine = {
  time: number;
  duration: number;
  text: string;
  translation?: string;
  words?: LyricWord[];
};

export default function Player() {
  const { currentSong, playlist, isPlaying, setIsPlaying, setCurrentSong, cookie, playMode, setPlayMode } = useAppStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [hasTranslation, setHasTranslation] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showPVMode, setShowPVMode] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const [shuffleHistory, setShuffleHistory] = useState<number[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [dominantColor, setDominantColor] = useState<string>('rgba(255,255,255,0.3)');

  useEffect(() => {
    if (currentSong?.al?.picUrl) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = currentSong.al.picUrl + '?param=50y50';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          setDominantColor(`rgba(${r}, ${g}, ${b}, 0.6)`);
        }
      };
    }
  }, [currentSong]);

  const initAudioContext = () => {
    if (!audioRef.current) return;
    
    if (!audioCtxRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContext();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      } catch (e) {
        console.error("AudioContext init failed", e);
      }
    }
    
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;

    // Pre-calculate 3 analogous colors based on the dominant color
    const rgbMatch = dominantColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    let baseR = 0, baseG = 113, baseB = 227; 
    if (rgbMatch) {
      baseR = parseInt(rgbMatch[1]);
      baseG = parseInt(rgbMatch[2]);
      baseB = parseInt(rgbMatch[3]);

      // Ensure the color is not too dark (black/dark gray will be invisible with 'lighter' blend mode)
      const brightness = (baseR * 299 + baseG * 587 + baseB * 114) / 1000;
      if (brightness < 50) {
        const boost = 50 - brightness;
        baseR = Math.min(255, Math.floor(baseR + boost * 1.5));
        baseG = Math.min(255, Math.floor(baseG + boost * 1.5));
        baseB = Math.min(255, Math.floor(baseB + boost * 1.5));
      }
    }

    const rgbToHsl = (r: number, g: number, b: number) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [h, s, l];
    };

    const hslToRgb = (h: number, s: number, l: number) => {
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    };

    const [h, s, l] = rgbToHsl(baseR, baseG, baseB);
    // Generate 3 colors: base, +40 deg, -40 deg
    const palette = [
      [baseR, baseG, baseB],
      hslToRgb((h + 40/360) % 1, s, l),
      hslToRgb((h - 40/360 + 1) % 1, s, l)
    ];

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!analyserRef.current || !isPlaying) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.save();
      
      // We will draw many overlapping radial gradients along the edges
      // This creates a smooth, cloud-like ambient light that pulses at different points
      
      const numPoints = 24; // Increased to 24 points per edge for smoother blending
      const stepX = canvas.width / numPoints;
      const stepY = canvas.height / numPoints;
      
      ctx.globalCompositeOperation = 'lighter'; // Blend the overlapping lights smoothly

      // Helper function to draw a localized ambient light bulb
      const drawAmbientPoint = (x: number, y: number, value: number | undefined, colorIndex: number) => {
        if (value === undefined || !isFinite(value) || isNaN(value) || value < 10) return; // Skip very quiet frequencies or invalid values
        
        let intensity = value / 255;
        if (!isFinite(intensity) || isNaN(intensity)) intensity = 0;

        let radius = 100 + (intensity * 250); // Increased base size to prevent point light source look
        if (!isFinite(radius) || radius <= 0) radius = 100; 
        
        const opacity = 0.03 + (intensity * 0.15); // Lower opacity to compensate for more overlapping points and larger radius

        const [r, g, b] = palette[colorIndex % 3];

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      };

      // Top Edge (using lower frequencies, bass)
      for (let i = 0; i <= numPoints; i++) {
        const dataIndex = Math.min(Math.floor((i / numPoints) * 20), bufferLength - 1); 
        drawAmbientPoint(i * stepX, 0, dataArray[dataIndex], i);
      }

      // Bottom Edge (using mid-low frequencies)
      for (let i = 0; i <= numPoints; i++) {
        const dataIndex = Math.min(Math.floor((i / numPoints) * 20) + 10, bufferLength - 1); 
        drawAmbientPoint(i * stepX, canvas.height, dataArray[dataIndex], i + 1);
      }

      // Left Edge (using mid frequencies)
      for (let i = 0; i <= numPoints; i++) {
        const dataIndex = Math.min(Math.floor((i / numPoints) * 20) + 20, bufferLength - 1); 
        drawAmbientPoint(0, i * stepY, dataArray[dataIndex], i + 2);
      }

      // Right Edge (using higher mid frequencies)
      for (let i = 0; i <= numPoints; i++) {
        const dataIndex = Math.min(Math.floor((i / numPoints) * 20) + 30, bufferLength - 1); 
        drawAmbientPoint(canvas.width, i * stepY, dataArray[dataIndex], i);
      }

      ctx.restore();
    };

    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isPlaying, dominantColor]);

  const fetchLyrics = async (id: number) => {
    try {
      const res = await fetch('/api/lyric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, cookie }),
      }).then(res => res.json());

      const lrc = res.lrc?.lyric || '';
      const tlyric = res.tlyric?.lyric || '';
      const yrc = res.yrc?.lyric || '';

      const parsedLines: LyricLine[] = [];

      if (yrc) {
        const regex = /\[(\d+),(\d+)\](.*)/g;
        let match;
        while ((match = regex.exec(yrc)) !== null) {
          const startMs = parseInt(match[1]);
          const durationMs = parseInt(match[2]);
          const wordsStr = match[3];
          
          const words: LyricWord[] = [];
          let lineText = '';
          
          const wordRegex = /\((\d+),(\d+),\d*\)([^\(]*)/g;
          // Note: sometimes format is (offset,duration,0)text
          // Let's just match any (time,time,...) and take the following text
          // Actually Netease format is: (0,500,0)我(500,500,0)是 or (0,500,我) ?
          // In some versions: [11000,2000](0,500,0)我(500,500,0)是
          // In other versions: [11000,2000](0,500,我)(500,500,是)
          // We will use a more robust regex for words.
          const wordSplit = wordsStr.split(/\((\d+),(\d+),\d*\)([^\(]*)/);
          
          for (let i = 1; i < wordSplit.length; i += 4) {
            const wOffset = parseInt(wordSplit[i]);
            const wDuration = parseInt(wordSplit[i+1]);
            const wText = wordSplit[i+3];
            
            if (wText) {
              words.push({
                time: (startMs + wOffset) / 1000,
                duration: wDuration / 1000,
                text: wText
              });
              lineText += wText;
            }
          }
          
          parsedLines.push({
            time: startMs / 1000,
            duration: durationMs / 1000,
            text: lineText,
            words: words.length > 0 ? words : undefined
          });
        }
      } 
      
      if (parsedLines.length === 0 && lrc) {
        const regex = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/g;
        let match;
        while ((match = regex.exec(lrc)) !== null) {
          const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
          parsedLines.push({
            time,
            duration: 0,
            text: match[3].trim()
          });
        }
      }

      if (tlyric) {
        let translationFound = false;
        const tMap = new Map<number, string>();
        const regex = /\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/g;
        let match;
        while ((match = regex.exec(tlyric)) !== null) {
          const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
          const text = match[3].trim();
          if (text) {
            tMap.set(Math.round(time * 10), text);
          }
        }
        
        parsedLines.forEach(line => {
          // 只给包含实际英文/内容的歌词匹配翻译，跳过纯中文的制作人员信息等
          // 通常制作人员信息不需要翻译，且它们的时间轴有时会跟后面第一句冲突
          if (line.text && !line.text.match(/^作词\s*:|^作曲\s*:|^编曲\s*:|^制作人\s*:/)) {
            const key = Math.round(line.time * 10);
            // 缩小匹配容差到 ±2 (0.2秒)，避免把前奏时间点的翻译错误匹配到制作人信息上
            for (let i = -2; i <= 2; i++) {
              if (tMap.has(key + i)) {
                line.translation = tMap.get(key + i);
                translationFound = true;
                break;
              }
            }
          }
        });
        setHasTranslation(translationFound);
      } else {
        setHasTranslation(false);
      }

      setLyrics(parsedLines.filter(l => l.text));
    } catch (error) {
      console.error(error);
      setLyrics([]);
      setHasTranslation(false);
    }
  };

  const fetchSongUrl = async (id: number) => {
    try {
      // 尝试获取最高音质
      const res = await fetch('/api/song/url/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, level: 'exhigh', cookie }),
      }).then(r => r.json());
      
      const songUrl = res.data?.[0]?.url;
      if (songUrl) {
        setUrl(songUrl);
      } else {
        // 降级尝试标准音质
        const standardRes = await fetch('/api/song/url/v1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, level: 'standard', cookie }),
        }).then(r => r.json());
        
        const standardUrl = standardRes.data?.[0]?.url;
        if (standardUrl) {
          setUrl(standardUrl);
        } else {
          setUrl('');
          alert('暂无版权或需要VIP');
          setIsPlaying(false);
          // 如果实在获取不到，延迟 1 秒后自动跳下一首，避免死循环
          setTimeout(() => handleNext(), 1000);
        }
      }
    } catch (error) {
      console.error('Failed to fetch song url', error);
      setUrl('');
      setTimeout(() => handleNext(), 1000);
    }
  };

  useEffect(() => {
    if (currentSong && cookie) {
      fetchSongUrl(currentSong.id);
      fetchLyrics(currentSong.id);
    }
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current && url) {
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // Ignore AbortError caused by rapid song switching
            if (error.name !== 'AbortError') {
              console.error('Audio playback failed:', error);
            }
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, url]);

  useEffect(() => {
    const updateProgress = () => {
      if (audioRef.current && isPlaying) {
        const currentTime = audioRef.current.currentTime;
        setProgress(currentTime);
        
        if (lyrics.length > 0) {
          let idx = lyrics.findIndex(l => l.time > currentTime + 0.5) - 1;
          if (idx < 0) idx = 0;
          
          if (idx !== currentLyricIndex) {
            setCurrentLyricIndex(idx);
            if (lyricsRef.current) {
              const activeEl = lyricsRef.current.children[0]?.children[idx] as HTMLElement;
              if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
        }
      }
      animationRef.current = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateProgress);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, lyrics, currentLyricIndex]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolume(vol);
    }
  };

  const handleNext = useCallback(() => {
    if (!playlist.length || !currentSong) return;
    
    if (playMode === 'loop') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentSong(playlist[nextIndex]);
    setIsPlaying(true);
  }, [playlist, currentSong, playMode, setCurrentSong, setIsPlaying]);

  const handlePrev = useCallback(() => {
    if (!playlist.length || !currentSong) return;

    const currentIndex = playlist.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentSong(playlist[prevIndex]);
    setIsPlaying(true);
  }, [playlist, currentSong, playMode, setCurrentSong, setIsPlaying]);

  const togglePlayMode = () => {
    const modes: ('sequence' | 'loop' | 'shuffle')[] = ['sequence', 'loop', 'shuffle'];
    const nextIndex = (modes.indexOf(playMode) + 1) % modes.length;
    setPlayMode(modes[nextIndex]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events when typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, isPlaying, setIsPlaying]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  return (
    <>
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 w-full h-full pointer-events-none z-40 transition-opacity duration-1000"
        style={{ opacity: isPlaying ? 1 : 0 }}
      />
      <AnimatePresence>
        {showLyrics && (
        <motion.div 
          key="lyrics-panel"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-30 bg-[#f5f5f7]/95 dark:bg-black/95 backdrop-blur-3xl flex flex-col pt-20 pb-40 px-6"
        >
          <div 
            className="flex-1 max-w-3xl mx-auto w-full overflow-y-auto no-scrollbar scroll-smooth relative" 
            ref={lyricsRef}
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
            }}
          >
            {lyrics.length > 0 ? (
              <div className="py-[35vh] flex flex-col gap-10">
                {lyrics.map((lyric, index) => {
                  const isActive = index === currentLyricIndex;
                  return (
                    <div 
                      key={index}
                      className={clsx(
                        "transition-all duration-500 origin-left tracking-tight cursor-pointer",
                        isActive ? "scale-105 opacity-100 blur-none" : "scale-100 opacity-30 hover:opacity-60 blur-[1px]"
                      )}
                      onClick={() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = lyric.time;
                          if (!isPlaying) setIsPlaying(true);
                        }
                      }}
                    >
                      <p className="text-3xl md:text-5xl font-bold leading-tight">
                        {lyric.words ? (
                          lyric.words.map((w, wi) => {
                            let fillRatio = 0;
                            if (isActive) {
                              if (progress >= w.time + w.duration) {
                                fillRatio = 1;
                              } else if (progress >= w.time) {
                                fillRatio = Math.max(0, Math.min(1, (progress - w.time) / w.duration));
                              }
                            }
                            
                            return (
                              <span key={wi} className="relative inline-block mr-1">
                                <span className={isActive ? "text-black/20 dark:text-white/20" : "text-[#1d1d1f] dark:text-white"}>
                                  {w.text}
                                </span>
                                {isActive && (
                                  <span 
                                    className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-[#1d1d1f] dark:text-white transition-[width] duration-75"
                                    style={{ width: `${fillRatio * 100}%` }}
                                  >
                                    {w.text}
                                  </span>
                                )}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[#1d1d1f] dark:text-white">{lyric.text || " "}</span>
                        )}
                      </p>
                      
                      <AnimatePresence>
                        {showTranslation && lyric.translation && (
                          <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={clsx("text-xl md:text-2xl font-medium mt-4", isActive ? "text-[#1d1d1f]/80 dark:text-white/80" : "text-[#1d1d1f] dark:text-white")}
                          >
                            {lyric.translation}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#86868b] font-medium text-xl">
                暂无歌词
              </div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* PV Mode Overlay */}
      <AnimatePresence>
        {showPVMode && (
          <PVMode 
            lyrics={lyrics}
            progress={progress}
            currentSong={currentSong}
            dominantColor={dominantColor}
            onClose={() => setShowPVMode(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        <motion.div 
          key="player-bar"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 w-fit z-50 px-4"
        >
          <div className="bg-[#1c1c1e] dark:bg-[#1c1c1e] rounded-[32px] p-2 pr-6 flex items-center shadow-2xl border border-white/10 relative overflow-hidden transition-all">
          <audio 
            ref={audioRef} 
            src={url || undefined} 
            crossOrigin="anonymous"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleNext}
            onPlay={() => {
              setIsPlaying(true);
              initAudioContext();
            }}
            onPause={() => setIsPlaying(false)}
            autoPlay={isPlaying}
          />

          <div className="flex items-center gap-3 w-[240px] flex-shrink-0 relative group pl-2">
            <div className={clsx(
              "w-12 h-12 rounded-full overflow-hidden shadow-md shrink-0 relative bg-black border-[2px] border-[#2c2c2e] p-1 flex items-center justify-center transition-all duration-500",
              isPlaying ? "animate-[spin_10s_linear_infinite]" : ""
            )}>
              <img src={currentSong.al.picUrl + '?param=100y100'} alt="Cover" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="flex flex-col overflow-hidden justify-center h-full cursor-pointer group-hover:opacity-80 transition-opacity" onClick={() => {
                const el = document.getElementById(`song-${currentSong.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Add a brief highlight effect
                  el.classList.add('bg-black/10', 'dark:bg-white/20');
                  setTimeout(() => el.classList.remove('bg-black/10', 'dark:bg-white/20'), 1500);
                }
              }}>
                <span className="truncate font-semibold text-base text-white/95 leading-tight" title="点击定位到歌曲">
                  {currentSong.name}
                </span>
                <span className="truncate text-xs text-[#86868b] mt-0.5">
                  {currentSong.ar.map((a: any) => a.name).join('/')}
                </span>
              </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 px-6 border-l border-white/5 border-r min-w-[360px]">
            <div className="flex items-center gap-6">
              <button 
                onClick={togglePlayMode} 
                className={clsx(
                  "transition-colors",
                  playMode !== 'sequence' ? "text-white" : "text-[#86868b] hover:text-white"
                )}
                title={playMode === 'sequence' ? "列表循环" : playMode === 'loop' ? "单曲循环" : "随机播放"}
              >
                {playMode === 'sequence' && <Repeat className="w-4 h-4" />}
                {playMode === 'loop' && <Repeat1 className="w-4 h-4" />}
                {playMode === 'shuffle' && <Shuffle className="w-4 h-4" />}
              </button>
              
              <button onClick={handlePrev} className="text-[#86868b] hover:text-white transition-colors">
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              
              <button 
                onClick={() => setIsPlaying(!isPlaying)} 
                className="w-10 h-10 flex items-center justify-center bg-white text-[#1c1c1e] rounded-full hover:scale-105 transition-transform shadow-sm"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-[1px]" />}
              </button>
              
              <button onClick={handleNext} className="text-[#86868b] hover:text-white transition-colors">
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              <button 
                onClick={() => setShowPVMode(true)}
                className={clsx(
                  "transition-colors hidden md:block",
                  showPVMode ? "text-white" : "text-[#86868b] hover:text-white"
                )}
                title="日式文字PV模式"
              >
                <MonitorPlay className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setShowLyrics(!showLyrics)}
                className={clsx(
                  "transition-colors",
                  showLyrics ? "text-white" : "text-[#86868b] hover:text-white"
                )}
                title="歌词"
              >
                <Mic2 className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showLyrics && hasTranslation && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8, width: 0, marginLeft: 0 }}
                    animate={{ opacity: 1, scale: 1, width: 'auto', marginLeft: 8 }}
                    exit={{ opacity: 0, scale: 0.8, width: 0, marginLeft: 0 }}
                    onClick={() => setShowTranslation(!showTranslation)}
                    className={clsx(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors whitespace-nowrap border",
                      showTranslation 
                        ? "bg-white text-[#1c1c1e] border-transparent" 
                        : "bg-transparent text-[#86868b] hover:text-white border-white/20 hover:border-white/50"
                    )}
                    title="切换翻译"
                  >
                    译
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            
            <div className="w-full flex items-center gap-3 text-[10px] font-medium text-[#86868b]">
              <span className="w-8 text-right">{formatTime(progress)}</span>
              <div className="flex-1 relative h-1 group cursor-pointer">
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100} 
                  value={progress}
                  onChange={handleProgressChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-100"
                    style={{ width: `${(progress / duration) * 100}%` }}
                  />
                </div>
              </div>
              <span className="w-8 text-left">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-[120px] justify-end pl-6">
            <div className="flex items-center gap-2 group w-full">
              <Volume2 className="w-4 h-4 text-[#86868b]" />
              <div className="w-full relative h-1 cursor-pointer hidden md:block">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[#86868b] rounded-full"
                    style={{ width: `${volume * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      </AnimatePresence>
    </>
  );
}

