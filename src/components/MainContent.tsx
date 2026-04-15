'use client';

import { useAppStore } from '@/store/useAppStore';
import PlaylistView from '@/components/PlaylistView';
import SearchView from '@/components/SearchView';
import SearchBar from '@/components/SearchBar';

export default function MainContent() {
  const { searchQuery } = useAppStore();

  return (
    <>
      <SearchBar />
      {searchQuery ? <SearchView /> : <PlaylistView />}
    </>
  );
}
