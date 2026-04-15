'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function SearchBar() {
  const { searchQuery, setSearchQuery, profile } = useAppStore();
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
    <div className="w-full max-w-5xl mx-auto mt-8 px-6">
      <form onSubmit={handleSubmit} className="relative flex items-center w-full max-w-md ml-auto">
        <Search className="absolute left-4 w-5 h-5 text-[#86868b]" />
        <input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="搜索歌曲、歌手、专辑..."
          className="w-full pl-12 pr-10 py-3 rounded-full bg-[#f5f5f7] dark:bg-[#1c1c1e] border-none outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow text-[#1d1d1f] dark:text-white placeholder-[#86868b]"
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
    </div>
  );
}
