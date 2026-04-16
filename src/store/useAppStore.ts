import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  userId: number;
  nickname: string;
  avatarUrl: string;
}

interface Song {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al: { id: number; name: string; picUrl: string };
  dt: number;
}

interface AppState {
  cookie: string | null;
  profile: UserProfile | null;
  currentSong: Song | null;
  playlist: Song[];
  isPlaying: boolean;
  searchQuery: string;
  playMode: 'sequence' | 'loop' | 'shuffle';
  originalPlaylist: Song[];
  isInitialLoading: boolean;
  setCookie: (cookie: string) => void;
  setProfile: (profile: UserProfile) => void;
  setCurrentSong: (song: Song) => void;
  setPlaylist: (playlist: Song[]) => void;
  addToPlaylist: (song: Song) => void;
  addMultipleToPlaylist: (songs: Song[]) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSearchQuery: (query: string) => void;
  setPlayMode: (mode: 'sequence' | 'loop' | 'shuffle') => void;
  setIsInitialLoading: (isLoading: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      cookie: null,
      profile: null,
      currentSong: null,
      playlist: [],
      originalPlaylist: [],
      isPlaying: false,
      searchQuery: '',
      playMode: 'sequence',
      isInitialLoading: false,
      setCookie: (cookie) => set({ cookie }),
      setProfile: (profile) => set({ profile }),
      setCurrentSong: (song) => set({ currentSong: song }),
      setPlaylist: (playlist) => set((state) => {
        if (state.playMode === 'shuffle') {
          if (playlist.length === 0) return { playlist: [], originalPlaylist: [] };
          
          const shuffled = [...playlist].sort(() => 0.5 - Math.random());
          
          // 如果有正在播放的歌，确保它在洗牌后列表的第一位（后续逻辑在UI层截取前后）
          const currentSongId = state.currentSong?.id;
          if (currentSongId) {
             const currentIndex = shuffled.findIndex(s => s.id === currentSongId);
             if (currentIndex !== -1 && currentIndex !== 0) {
                 const song = shuffled.splice(currentIndex, 1)[0];
                 shuffled.unshift(song);
             }
          }
          return { playlist: shuffled, originalPlaylist: playlist };
        }
        return { playlist, originalPlaylist: playlist };
      }),
      addToPlaylist: (song) => set((state) => {
        if (!state.playlist.find(s => s.id === song.id)) {
          return { 
            playlist: [...state.playlist, song],
            originalPlaylist: [...state.originalPlaylist, song]
          };
        }
        return state;
      }),
      addMultipleToPlaylist: (songs) => set((state) => {
        const existingIds = new Set(state.playlist.map(s => s.id));
        const toAdd = songs.filter(s => !existingIds.has(s.id));
        if (toAdd.length > 0) {
          return { 
            playlist: [...state.playlist, ...toAdd],
            originalPlaylist: [...state.originalPlaylist, ...toAdd]
          };
        }
        return state;
      }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setPlayMode: (mode) => set((state) => {
        if (mode === 'shuffle' && state.playMode !== 'shuffle' && state.originalPlaylist.length > 0) {
           const shuffled = [...state.originalPlaylist].sort(() => 0.5 - Math.random());
           
           if (state.currentSong) {
              const currentId = state.currentSong.id;
              const currentIndex = shuffled.findIndex(s => s.id === currentId);
              
              if (currentIndex !== -1 && currentIndex !== 0) {
                  // 把当前正在播放的歌曲移动到随机队列的开头，避免立刻切歌
                  const song = shuffled.splice(currentIndex, 1)[0];
                  shuffled.unshift(song);
              } else if (currentIndex === -1) {
                  const originalCurrent = state.originalPlaylist.find(s => s.id === currentId);
                  if (originalCurrent) {
                      shuffled.unshift(originalCurrent);
                  }
              }
           }
           
           return { playMode: mode, playlist: shuffled };
        } else if (mode !== 'shuffle' && state.playMode === 'shuffle') {
           return { playMode: mode, playlist: state.originalPlaylist };
        }
        return { playMode: mode };
      }),
      setIsInitialLoading: (isLoading) => set({ isInitialLoading: isLoading }),
      logout: () => set({ cookie: null, profile: null, currentSong: null, playlist: [], originalPlaylist: [], isPlaying: false, searchQuery: '', playMode: 'sequence', isInitialLoading: false }),
    }),
    {
      name: 'netease-pro-storage',
      partialize: (state) => ({ cookie: state.cookie, profile: state.profile }),
    }
  )
);
