'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { LogOut, MapPin, Calendar, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function UserSidebar() {
  const { profile, cookie, logout, isMobileUserOpen, setIsMobileUserOpen } = useAppStore();
  const [userDetail, setUserDetail] = useState<any>(null);

  useEffect(() => {
    if (profile?.userId && cookie) {
      fetch('/api/user/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: profile.userId, cookie }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.code === 200) {
            setUserDetail(data);
          }
        })
        .catch(console.error);
    }
  }, [profile, cookie]);

  if (!profile) return null;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileUserOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-sm"
          onClick={() => setIsMobileUserOpen(false)}
        />
      )}
      
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={clsx(
          "fixed left-0 top-0 bottom-24 w-64 p-6 flex flex-col border-r border-black/5 dark:border-white/10 z-50 overflow-y-auto custom-scrollbar bg-[#f5f5f7] dark:bg-[#121212] transition-transform duration-300 xl:translate-x-0 xl:bg-transparent",
          isMobileUserOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
      <div className="flex flex-col items-center gap-4 text-center mt-4">
        <div className="relative">
          <img 
            src={profile.avatarUrl + '?param=200y200'} 
            alt={profile.nickname} 
            className="w-24 h-24 rounded-full shadow-lg border-2 border-white/10 object-cover"
          />
          {userDetail?.profile?.vipType === 11 && (
            <span className="absolute bottom-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-[#1d1d1f]">
              VIP
            </span>
          )}
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-center gap-2">
            {profile.nickname}
            {userDetail?.level && (
              <span className="text-[10px] font-bold bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md text-[#86868b]">
                Lv.{userDetail.level}
              </span>
            )}
          </h2>
        </div>

        {userDetail && (
          <div className="flex items-center gap-4 text-sm mt-2">
            <div className="flex flex-col items-center">
              <span className="font-semibold text-[#1d1d1f] dark:text-white">{userDetail.profile?.eventCount || 0}</span>
              <span className="text-xs text-[#86868b]">动态</span>
            </div>
            <div className="w-px h-6 bg-black/5 dark:bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="font-semibold text-[#1d1d1f] dark:text-white">{userDetail.profile?.follows || 0}</span>
              <span className="text-xs text-[#86868b]">关注</span>
            </div>
            <div className="w-px h-6 bg-black/5 dark:bg-white/10"></div>
            <div className="flex flex-col items-center">
              <span className="font-semibold text-[#1d1d1f] dark:text-white">{userDetail.profile?.followeds || 0}</span>
              <span className="text-xs text-[#86868b]">粉丝</span>
            </div>
          </div>
        )}

        {userDetail?.profile?.signature && (
          <p className="text-xs text-[#86868b] mt-2 line-clamp-3 text-center px-2">
            {userDetail.profile.signature}
          </p>
        )}
      </div>

      <div className="mt-8 flex-1">
        {userDetail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-[#86868b]">
              <Headphones className="w-4 h-4 text-[#1d1d1f] dark:text-white" />
              <span>累计听歌：{userDetail.listenSongs} 首</span>
            </div>
            {userDetail.profile?.birthday > 0 && (
              <div className="flex items-center gap-3 text-sm text-[#86868b]">
                <Calendar className="w-4 h-4 text-[#1d1d1f] dark:text-white" />
                <span>生日：{new Date(userDetail.profile.birthday).toLocaleDateString()}</span>
              </div>
            )}
            {userDetail.profile?.createTime > 0 && (
              <div className="flex items-center gap-3 text-sm text-[#86868b]">
                <MapPin className="w-4 h-4 text-[#1d1d1f] dark:text-white" />
                <span>村龄：{Math.floor((Date.now() - userDetail.profile.createTime) / (1000 * 60 * 60 * 24 * 365))} 年</span>
              </div>
            )}
          </div>
        )}
      </div>

      <button 
        onClick={logout}
        className="mt-6 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors w-full"
      >
        <LogOut className="w-4 h-4" />
        退出登录
      </button>
    </motion.div>
    </>
  );
}
