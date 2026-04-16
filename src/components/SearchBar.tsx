'use client';

import { useState } from 'react';
import { Search, X, Menu, ListMusic } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function SearchBar() {
  const { searchQuery, setSearchQuery, profile, setIsMobileUserOpen, setIsMobilePlaylistOpen } = useAppStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  if (!profile) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localQuery.trim());
  };

  const handleClear = () => {
    setLocalQuery('');
    setSearchQuery('');
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-4 xl:mt-8 px-4 xl:px-6 flex items-center gap-3">
      <button 
        onClick={() => setIsMobileUserOpen(true)}
        className="xl:hidden p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="User" className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10" />
        ) : (
          <Menu className="w-6 h-6 text-[#1d1d1f] dark:text-white" />
        )}
      </button>

      <form onSubmit={handleSubmit} className="relative flex items-center flex-1 max-w-md xl:ml-auto">
        <Search className="absolute left-4 w-5 h-5 text-[#86868b]" />
        <input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="搜索歌曲、歌手、专辑..."
          className="w-full pl-12 pr-10 py-2.5 xl:py-3 rounded-full bg-[#e5e5ea] dark:bg-[#1c1c1e] border-none outline-none focus:ring-2 focus:ring-[#0071e3]/50 transition-shadow text-[#1d1d1f] dark:text-white placeholder-[#86868b] text-sm xl:text-base"
        />
        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 p-1 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      <button 
        onClick={() => setIsMobilePlaylistOpen(true)}
        className="xl:hidden p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors bg-[#e5e5ea] dark:bg-[#1c1c1e]"
      >
        <ListMusic className="w-5 h-5 text-[#1d1d1f] dark:text-white" />
      </button>
    </div>
  );
}
