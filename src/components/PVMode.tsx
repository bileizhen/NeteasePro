'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause } from 'lucide-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';

type LyricLine = {
  time: number;
  duration: number;
  text: string;
  translation?: string;
  words?: { time: number; duration: number; text: string }[];
};

type PVModeProps = {
  lyrics: LyricLine[];
  progress: number;
  currentSong: any;
  onClose: () => void;
  dominantColor: string;
};

// A deterministic random function based on a seed
function sfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
    let t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

export default function PVMode({ lyrics, progress, currentSong, onClose, dominantColor }: PVModeProps) {
  const { isPlaying, setIsPlaying } = useAppStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Particle System
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: any[] = [];

    const initParticles = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // 随机生成 80-120 个点粒子
      const count = Math.floor(Math.random() * 40) + 80;
      particles = Array.from({ length: count }).map(() => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8 - 0.2, // 默认带有一点向上的微风漂浮感
        baseOpacity: Math.random() * 0.4 + 0.1,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulseOffset: Math.random() * Math.PI * 2
      }));
    };

    initParticles();
    window.addEventListener('resize', initParticles);

    let time = 0;
    const render = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;

        // 边界循环
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        // 闪烁脉冲效果
        const currentOpacity = p.baseOpacity + Math.sin(time * p.pulseSpeed + p.pulseOffset) * 0.2;

        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, currentOpacity)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', initParticles);
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Find current lyric index
  const currentIndex = useMemo(() => {
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (progress >= lyrics[i].time) return i;
    }
    return -1;
  }, [progress, lyrics]);

  const currentLine = currentIndex !== -1 ? lyrics[currentIndex] : null;
  const nextLine = currentIndex !== -1 && currentIndex + 1 < lyrics.length ? lyrics[currentIndex + 1] : null;

  // 智能分词与时间戳模拟（当没有原生逐字歌词时）
  const displayWords = useMemo(() => {
    if (!currentLine) return [];
    
    // 如果已经有原生逐字歌词，直接使用（但必须把结尾的空格 trim 掉，否则会影响绝对定位时的排版）
    if (currentLine.words && currentLine.words.length > 0) {
      return currentLine.words.map(w => ({
        ...w,
        text: w.text.trim()
      }));
    }

    // 否则，进行智能分词模拟
    const text = currentLine.text.trim();
    if (!text) return [];

    let segments: string[] = [];
    try {
      // 优先尝试使用现代浏览器的 Intl.Segmenter API，支持中日文智能分词
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      const rawSegments = Array.from(segmenter.segment(text))
        .filter(s => s.segment.trim().length > 0)
        .map(s => s.segment);
      
      // 将独立的标点符号合并到上一个词汇中，避免标点符号单独占位
      const mergedSegments: string[] = [];
      for (const seg of rawSegments) {
        if (seg.match(/^[.,!?。，！？、～~]+$/) && mergedSegments.length > 0) {
          mergedSegments[mergedSegments.length - 1] += seg;
        } else {
          mergedSegments.push(seg);
        }
      }
      segments = mergedSegments;
    } catch (e) {
      // 降级方案：按空格分词（英文），如果没有空格，就逐字拆分（中日文）
      segments = text.split(/\s+/);
      if (segments.length === 1) {
        segments = Array.from(text);
      }
    }

    // 为合成的词分配假的时间戳（基于该句子的总持续时间平分）
    // 如果没有提供原生 duration，我们计算到下一句的时间差
    let lineDuration = currentLine.duration || (nextLine ? nextLine.time - currentLine.time : 4);
    
    // 如果下一句歌词在很久以后（比如间奏长达 30 秒），不能把这句歌词的持续时间拉长到 30 秒
    // 我们强制限制这句歌词的“展示持续时间”最长不超过 8 秒，或者每个字/词平均不超过 1.5 秒
    const maxAllowedDuration = Math.min(8, segments.length * 1.5);
    lineDuration = Math.min(lineDuration, maxAllowedDuration);
    
    // 如果歌曲速度太快（整句时间很短，或者词汇很多），我们需要压缩动画表现，防止词汇还没出完就切句了
    // 强制至少留出 10% 的缓冲时间给最后一句展示
    const safeDuration = lineDuration * 0.9; 
    const timePerSegment = safeDuration / Math.max(1, segments.length);

    return segments.map((seg, i) => ({
      text: seg,
      time: currentLine.time + (i * timePerSegment),
      duration: timePerSegment
    }));
  }, [currentLine, nextLine]);

  // Extract logic for generating line style into a reusable function
  const generateLineStyle = (index: number, lineText: string | undefined, songId: number, wordsCount: number) => {
    if (index === -1 || !lineText) return null;
    
    // Generate a more robust pseudo-random seed to avoid clustering
    // Mix songId, line index, and the string length/char codes to get a high variance seed
    let stringHash = 0;
    for (let i = 0; i < lineText.length; i++) {
      stringHash = (stringHash << 5) - stringHash + lineText.charCodeAt(i);
      stringHash |= 0;
    }
    const seed = (songId || 0) + (index * 9999) + Math.abs(stringHash);
    const rand = sfc32(seed, seed * 2, seed * 3, seed * 4);
    
    // We should call rand() a few times initially to "warm up" the PRNG
    // as SFC32 sometimes has low variance on the first few calls with similar seeds.
    rand(); rand(); rand();
    
    // Check if the text is mostly English (Latin characters) to prevent weird vertical rotation
    const textLength = lineText.trim().length;
    const englishCharCount = lineText.match(/[a-zA-Z]/g)?.length || 0;
    const isMostlyEnglish = textLength > 0 && (englishCharCount / textLength) > 0.3;

    // Layout Mode: Normal paragraph, Directional scattered, or Center Burst
    const layoutModeRoll = rand();
    let layoutMode = 'paragraph';
    let direction = ['LTR', 'TTB', 'DIAGONAL'][Math.floor(rand() * 3)];
    
    // Check if the text is exceptionally long (e.g. > 15 characters)
    // If it is, force it into a DIAGONAL scattered mode to prevent it from spilling out of the screen
    // and disable vertical mode entirely for long sentences
    const isLongSentence = textLength > 15;
    
    if (isLongSentence) {
      layoutMode = 'directional';
      direction = 'DIAGONAL';
    } else if (layoutModeRoll > 0.75) {
      // 恢复 center-burst (中心爆发) 的概率到 25%，保证一场歌里能出现好几次，但又不会每句都是
      layoutMode = 'center-burst';
    } else if (layoutModeRoll > 0.35) {
      // 40% 的概率使用方向性散落 (directional)
      layoutMode = 'directional';
    }
    // 剩下的 35% 使用常规段落模式 (paragraph)
    
    // If it's mostly English OR a very long sentence, disable vertical mode
    const isVertical = (isMostlyEnglish || isLongSentence) ? false : (rand() > 0.6); // 40% chance of vertical text for Chinese
    
    // If scattered or burst, always center the parent container so we can predictably scatter around the center
    const alignX = (layoutMode === 'directional' || layoutMode === 'center-burst') ? 'center' : ['flex-start', 'center', 'flex-end'][Math.floor(rand() * 3)];
    const alignY = (layoutMode === 'directional' || layoutMode === 'center-burst') ? 'center' : ['flex-start', 'center', 'flex-end'][Math.floor(rand() * 3)];
    
    const size = rand() > 0.8 ? 'text-7xl md:text-9xl' : rand() > 0.5 ? 'text-6xl md:text-8xl' : 'text-5xl md:text-7xl';
    
    // Split by spaces to keep English words intact, or fallback to characters if no spaces
    const words = lineText.split(/\s+/).filter(Boolean);
    const useWordSplit = words.length > 1;
    
    let splitParts: string[] = [];
    const shouldSplit = lineText.length > 8 && rand() > 0.5;
    
    if (shouldSplit) {
      if (useWordSplit) {
        const splitIndex = Math.ceil(words.length / 2);
        splitParts = [
          words.slice(0, splitIndex).join(' '),
          words.slice(splitIndex).join(' ')
        ];
      } else {
        const splitIndex = Math.floor(lineText.length / 2);
        splitParts = [
          lineText.slice(0, splitIndex),
          lineText.slice(splitIndex)
        ];
      }
    }

    const variants = [
      // 原有平滑/故障风格
      { initial: { scale: 1.5, opacity: 0, filter: 'blur(20px)' }, animate: { scale: 1, opacity: 1, filter: 'blur(0px)' }, exit: { scale: 0.9, opacity: 0, filter: 'blur(10px)' } },
      { initial: { x: -100, opacity: 0, skewX: 20 }, animate: { x: 0, opacity: 1, skewX: 0 }, exit: { x: 100, opacity: 0, skewX: -20 } },
      { initial: { y: 100, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -100, opacity: 0 } },
      { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.2, opacity: 0 } },
      { initial: { rotate: -10, scale: 2, opacity: 0 }, animate: { rotate: 0, scale: 1, opacity: 1 }, exit: { rotate: 10, scale: 0.5, opacity: 0 } },
      
      // 新增：3D 翻转/景深风格
      { initial: { rotateX: 90, opacity: 0 }, animate: { rotateX: 0, opacity: 1 }, exit: { rotateX: -90, opacity: 0 } },
      { initial: { rotateY: 90, opacity: 0 }, animate: { rotateY: 0, opacity: 1 }, exit: { rotateY: -90, opacity: 0 } },
      
      // 新增：字间距扩展 (Tracking Expand)
      { initial: { letterSpacing: '-0.5em', opacity: 0 }, animate: { letterSpacing: isVertical ? '0em' : '0.1em', opacity: 1 }, exit: { letterSpacing: '0.5em', opacity: 0 } },
      
      // 新增：强烈冲撞放大 (Hard Zoom)
      { initial: { scale: 3, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0, opacity: 0 } },
      
      // 新增：斜切滑入/出
      { initial: { x: 100, opacity: 0, skewX: -20 }, animate: { x: 0, opacity: 1, skewX: 0 }, exit: { x: -100, opacity: 0, skewX: 20 } },
      { initial: { y: -100, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 100, opacity: 0 } },
      
      // 新增：细微位移+高斯模糊淡入
      { initial: { x: -20, opacity: 0, filter: 'blur(5px)' }, animate: { x: 0, opacity: 1, filter: 'blur(0px)' }, exit: { x: 20, opacity: 0, filter: 'blur(5px)' } },
    ];
    
    const animation = variants[Math.floor(rand() * variants.length)];
    const colorChance = rand();
    let textColor = 'text-white';
    if (colorChance > 0.85) textColor = 'text-red-500';
    else if (colorChance > 0.7) textColor = 'text-[#0071e3]';
    
    const wordPositions = Array.from({ length: wordsCount || 1 }).map((_, i) => {
      if (layoutMode === 'paragraph') {
        return { x: '0vw', y: '0vh', rotate: 0, scale: 1 };
      }
      
      if (layoutMode === 'center-burst') {
        // 在 center-burst 模式下，散落位置就是最后整句呈现时的排版位置
        // 这里返回 0，真正的坐标变化和排列逻辑我们会在渲染组件里通过 CSS 控制
        return { x: '0vw', y: '0vh', rotate: 0, scale: 1 };
      }

      const progress = wordsCount > 1 ? i / (wordsCount - 1) : 0.5; // 0.0 to 1.0
      
      let x = 0;
      let y = 0;
      
      const jitterX = (rand() - 0.5) * 15; // -7.5 to 7.5
      const jitterY = (rand() - 0.5) * 15; 
      
      if (direction === 'LTR') {
        x = (progress - 0.5) * 50 + jitterX; // -25vw to 25vw
        y = jitterY * 1.5;
      } else if (direction === 'TTB') {
        x = jitterX * 1.5;
        y = (progress - 0.5) * 50 + jitterY; // -25vh to 25vh
      } else if (direction === 'DIAGONAL') {
        // Top-left to bottom-right
        x = (progress - 0.5) * 40 + jitterX;
        y = (progress - 0.5) * 40 + jitterY;
      }

      // Constrain to safe boundaries
      x = Math.max(-30, Math.min(30, x));
      y = Math.max(-30, Math.min(30, y));

      return {
        x: x + 'vw',
        y: y + 'vh',
        rotate: (rand() * 30 - 15),
        scale: rand() * 0.4 + 0.8
      };
    });

    return {
      isVertical, alignX, alignY, size, shouldSplit, splitParts, animation, textColor,
      layoutMode, direction,
      // 更多样化的背景几何图形
      bgShapes: Array.from({ length: Math.floor(rand() * 3) + 2 }).map(() => {
        const type = ['square', 'circle', 'line'][Math.floor(rand() * 3)];
        return {
          type,
          x: rand() * 100,
          y: rand() * 100,
          size: rand() * 50 + 20, // 20vw to 70vw
          opacity: rand() * 0.08 + 0.02,
          rotate: rand() * 360,
          thickness: Math.floor(rand() * 3) + 1
        };
      }),
      wordPositions
    };
  };

  // Generate random style properties based on the line index to keep it stable
  const lineStyle = useMemo(() => {
    return generateLineStyle(currentIndex, currentLine?.text, currentSong?.id || 0, displayWords.length);
  }, [currentIndex, currentSong?.id, currentLine?.text, displayWords.length]);

  // Pre-calculate next line style and words for pre-rendering
  const nextLineData = useMemo(() => {
    if (!nextLine || !nextLine.text) return null;
    
    let segments: string[] = [];
    const text = nextLine.text.trim();
    if (nextLine.words && nextLine.words.length > 0) {
      segments = nextLine.words.map(w => w.text);
    } else {
      try {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
        segments = Array.from(segmenter.segment(text))
          .filter(s => s.segment.trim().length > 0)
          .map(s => s.segment);
      } catch (e) {
        segments = text.split(/\s+/);
        if (segments.length === 1) segments = Array.from(text);
      }
    }
    
    const style = generateLineStyle(currentIndex + 1, nextLine.text, currentSong?.id || 0, segments.length);
    return { segments, style };
  }, [currentIndex, nextLine, currentSong?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[200] bg-[#0a0a0c] text-white flex flex-col overflow-hidden font-serif select-none"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 50%, ${dominantColor.replace(/[\d.]+\)$/g, '0.1)')} 0%, transparent 70%)`
      }}
    >
      {/* Dynamic Background Noise / Grid */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className="absolute inset-0 opacity-5 pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      <canvas ref={particleCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />

      {/* Decorative Background Shapes bound to current line */}
      <AnimatePresence mode="wait">
        {lineStyle && (
          <motion.div key={`bg-${currentIndex}`} className="absolute inset-0 pointer-events-none overflow-hidden">
            {lineStyle.bgShapes.map((shape, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, rotate: shape.rotate - 90, opacity: 0 }}
                animate={{ scale: 1, rotate: shape.rotate, opacity: shape.opacity }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute border-white"
                style={{
                  left: `${shape.x}%`,
                  top: `${shape.y}%`,
                  width: `${shape.size}vw`,
                  height: shape.type === 'line' ? `${shape.thickness}px` : `${shape.size}vw`,
                  borderRadius: shape.type === 'circle' ? '50%' : '0',
                  borderWidth: shape.type === 'line' ? '0' : `${shape.thickness}px`,
                  backgroundColor: shape.type === 'line' ? 'white' : 'transparent',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-4">
          <img src={currentSong.al.picUrl + '?param=100y100'} alt="Album" className="w-10 h-10 rounded shadow-lg" />
          <div>
            <h3 className="text-sm font-bold truncate max-w-[200px]">{currentSong.name}</h3>
            <p className="text-xs text-white/60 truncate max-w-[200px]">{currentSong.ar?.map((a: any) => a.name).join(', ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white text-xs font-sans uppercase tracking-widest">
            {isFullscreen ? 'Exit FS' : 'Fullscreen'}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Typography Area */}
      <div className="flex-1 flex relative p-12 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentLine && lineStyle ? (
            <motion.div
              key={currentIndex}
              className="absolute inset-12 flex"
              style={{
                justifyContent: lineStyle.alignX,
                alignItems: lineStyle.alignY,
              }}
            >
              <motion.div
                initial={lineStyle.animation.initial}
                animate={lineStyle.animation.animate}
                exit={lineStyle.animation.exit}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={clsx(
                  "font-black tracking-widest leading-none flex gap-4 mix-blend-screen",
                  lineStyle.size,
                  lineStyle.textColor,
                  lineStyle.isVertical ? "flex-row" : "flex-col"
                )}
                style={{
                  writingMode: lineStyle.isVertical ? 'vertical-rl' : 'horizontal-tb',
                  textOrientation: 'mixed',
                  textShadow: '0 0 40px rgba(255,255,255,0.2), 0 0 100px rgba(255,255,255,0.1)',
                  whiteSpace: lineStyle.layoutMode === 'paragraph' ? 'normal' : (lineStyle.isVertical ? 'nowrap' : 'normal')
                }}
              >
                {displayWords.length > 0 && (
                  <div className={clsx(
                    "w-full h-full",
                    (lineStyle.layoutMode === 'paragraph' || lineStyle.layoutMode === 'center-burst') ? "text-center" : "relative"
                  )}>
                    {displayWords.map((w, i) => {
                      // 词汇是否已经到达出现时间
                      const isWordActive = progress >= w.time;
                      
                      const isCurrentWord = isWordActive && (i === displayWords.length - 1 || progress < displayWords[i+1].time);
                      const isPastWord = isWordActive && !isCurrentWord;
                      const isSentenceComplete = progress >= displayWords[displayWords.length - 1].time;

                      const isAccent = w.duration > 0.8 || w.text.length >= 4;
                      
                      // 如果时间特别短，比如小于 0.15 秒，我们就必须加快动画执行，否则就会出现“跟不上”的拖沓感
                      const fastMode = w.duration < 0.2;
                      const transitionDuration = fastMode ? 0.1 : (isCurrentWord ? 0.3 : 0.8);
                      
                      // 取出预先生成的随机位置
                      const pos = lineStyle.wordPositions[i % lineStyle.wordPositions.length];
                      
                      let initialStyle: any = {};
                      let animateStyle: any = {};
                      let exitStyle: any = {};
                      let containerClass = "inline-block mx-2 my-1";
                      let customStyle: any = {
                        writingMode: lineStyle.isVertical ? 'vertical-rl' : 'horizontal-tb',
                        textOrientation: 'mixed',
                      };
                      
                      if (lineStyle.layoutMode === 'paragraph') {
                        initialStyle = { opacity: 0, scale: 0.9 };
                        animateStyle = isCurrentWord ? {
                          opacity: 1, scale: isAccent ? 1.2 : 1, filter: 'blur(0px)',
                          textShadow: isAccent ? '0 0 50px currentColor, 0 0 20px currentColor' : '0 0 30px currentColor'
                        } : isPastWord ? {
                          opacity: 1, scale: 1, filter: 'blur(0px)', textShadow: 'none'
                        } : { opacity: 0, scale: 0.9 };
                      } else if (lineStyle.layoutMode === 'directional') {
                        containerClass = "absolute top-1/2 left-1/2 origin-center transform -translate-x-1/2 -translate-y-1/2";
                        customStyle.marginLeft = pos.x;
                        customStyle.marginTop = pos.y;
                        
                        initialStyle = { opacity: 0, scale: 0, rotate: pos.rotate - 30 };
                        animateStyle = isCurrentWord ? {
                          opacity: 1, scale: pos.scale * (isAccent ? 1.5 : 1.2), rotate: pos.rotate, filter: 'blur(0px)',
                          textShadow: isAccent ? '0 0 50px currentColor, 0 0 20px currentColor' : '0 0 30px currentColor'
                        } : isPastWord ? {
                          opacity: 0.85, scale: pos.scale, rotate: pos.rotate, filter: 'blur(0px)', textShadow: 'none'
                        } : { opacity: 0, scale: 0, rotate: pos.rotate - 30 };
                      } else if (lineStyle.layoutMode === 'center-burst') {
                        // 新增：Center Burst 模式
                        // 当前播放的词：绝对定位在屏幕正中央，超大号显示
                        // 播放过的词：在整句还没唱完时，先消失。当最后一个词唱完时，整句话作为段落重新显示出来
                        if (!isSentenceComplete) {
                          containerClass = "absolute top-1/2 left-1/2 origin-center transform -translate-x-1/2 -translate-y-1/2";
                          initialStyle = { opacity: 0, scale: 3, filter: 'blur(20px)' };
                          animateStyle = isCurrentWord ? {
                            opacity: 1, scale: 1.5, filter: 'blur(0px)', textShadow: '0 0 50px currentColor, 0 0 20px currentColor'
                          } : {
                            opacity: 0, scale: 0, filter: 'blur(10px)'
                          };
                        } else {
                          // 整句唱完后，切回 inline-block 排列，作为一个完整的段落展示
                          containerClass = "inline-block mx-2 my-1";
                          initialStyle = { opacity: 0, scale: 1.5 };
                          animateStyle = {
                            opacity: 1, scale: 1, filter: 'blur(0px)', textShadow: 'none', transition: { delay: i * 0.05, duration: 0.5 }
                          };
                        }
                      }

                      return (
                        <motion.div
                          key={i}
                          initial={initialStyle}
                          animate={animateStyle}
                          transition={{ 
                            duration: transitionDuration, 
                            ease: isCurrentWord ? "easeOut" : "easeInOut"
                          }}
                          className={clsx(
                            containerClass,
                            "font-black tracking-widest mix-blend-screen whitespace-nowrap",
                            lineStyle.size,
                            isAccent ? "text-[#0071e3] dark:text-[#0071e3]" : lineStyle.textColor
                          )}
                          style={customStyle}
                        >
                          {w.text}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl font-black tracking-widest"
            >
              {isPlaying ? '♪' : 'II'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Pre-render container for the NEXT line to avoid initial render lag on fast songs */}
        {nextLineData && nextLineData.style && (
          <div className="absolute inset-0 pointer-events-none opacity-0 overflow-hidden" aria-hidden="true">
            <div className={clsx(
              "font-black tracking-widest leading-none mix-blend-screen",
              nextLineData.style.size,
              nextLineData.style.isVertical ? "flex-row" : "flex-col"
            )} style={{ writingMode: nextLineData.style.isVertical ? 'vertical-rl' : 'horizontal-tb' }}>
              {nextLineData.segments.map((w, i) => (
                <div key={i} className="whitespace-nowrap">{w}</div>
              ))}
            </div>
          </div>
        )}

        {/* Small Translation Overlay */}
        <AnimatePresence>
          {currentLine?.translation && (
            <motion.div
              key={`trans-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-12 left-12 right-12 text-center text-white/50 text-sm md:text-base font-sans tracking-widest"
            >
              {currentLine.translation}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next Line Preview (Faded) */}
        <AnimatePresence>
          {nextLine && (
            <motion.div
              key={`next-${currentIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-6 right-12 text-right text-white/30 text-xs md:text-sm font-sans tracking-widest max-w-[50%]"
            >
              NEXT: {nextLine.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Progress Bar & Controls */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-10 hover:h-12 transition-all duration-300 group flex items-center px-6">
        <div 
          className="absolute bottom-0 left-0 h-1 group-hover:h-full bg-white/40 group-hover:bg-white/10 transition-all origin-left"
          style={{ width: `${(progress / currentSong.dt) * 100 * 1000}%` }}
        />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity w-full flex justify-center gap-8 relative z-20">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
