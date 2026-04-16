import LoginModal from '@/components/LoginModal';
import MainContent from '@/components/MainContent';
import Player from '@/components/Player';
import UserSidebar from '@/components/UserSidebar';
import PlaylistSidebar from '@/components/PlaylistSidebar';

export default function Home() {
  return (
    <main className="min-h-screen relative pb-32">
      <LoginModal />
      <UserSidebar />
      <div className="xl:pl-64 xl:pr-72 w-full transition-all duration-300 min-h-screen">
        <MainContent />
      </div>
      <PlaylistSidebar />
      <Player />
    </main>
  );
}
