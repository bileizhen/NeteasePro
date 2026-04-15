'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppStore } from '@/store/useAppStore';

export default function LoginModal() {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrKey, setQrKey] = useState('');
  const [status, setStatus] = useState<number>(0);
  const [statusText, setStatusText] = useState('请使用网易云音乐APP扫码登录');
  const { setCookie, setProfile, cookie } = useAppStore();

  useEffect(() => {
    if (!cookie) {
      initQrCode();
    }
  }, [cookie]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (qrKey && !cookie) {
      timer = setInterval(checkQrStatus, 3000);
    }
    return () => clearInterval(timer);
  }, [qrKey, cookie]);

  const initQrCode = async () => {
    try {
      const keyRes = await fetch('/api/login/qr/key', { method: 'POST' }).then(res => res.json());
      if (keyRes.data?.unikey) {
        setQrKey(keyRes.data.unikey);
        const createRes = await fetch('/api/login/qr/create', {
          method: 'POST',
          body: JSON.stringify({ key: keyRes.data.unikey, qrimg: true }),
        }).then(res => res.json());
        setQrCodeUrl(createRes.data?.qrimg || '');
      }
    } catch (error) {
      setStatusText('获取二维码失败，请刷新重试');
    }
  };

  const checkQrStatus = async () => {
    try {
      const checkRes = await fetch('/api/login/qr/check', {
        method: 'POST',
        body: JSON.stringify({ key: qrKey, timestamp: Date.now() }),
      }).then(res => res.json());

      setStatus(checkRes.code);
      setStatusText(checkRes.message);

      if (checkRes.code === 803) {
        // 获取用户详情
        const statusRes = await fetch('/api/login/status', {
          method: 'POST',
          body: JSON.stringify({ cookie: checkRes.cookie }),
        }).then(res => res.json());
        
        if (statusRes.data?.profile) {
          setProfile({
            userId: statusRes.data.profile.userId,
            nickname: statusRes.data.profile.nickname,
            avatarUrl: statusRes.data.profile.avatarUrl,
          });
        }
        
        // 登录成功，最后再设置cookie，以便弹窗消失
        setCookie(checkRes.cookie);
      } else if (checkRes.code === 800) {
        // 二维码过期
        initQrCode();
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (cookie) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f5f5f7] dark:bg-black">
      <div className="bg-white dark:bg-[#1c1c1e] p-10 max-w-sm w-full flex flex-col items-center justify-center text-center rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-none border border-black/5 dark:border-white/10">
        <h2 className="text-2xl font-semibold mb-8 text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
          NeteasePro
        </h2>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 mb-8 relative group">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-gray-50 text-gray-400 rounded-xl">
              加载中...
            </div>
          )}
          {status === 800 && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm rounded-2xl">
              <button 
                onClick={initQrCode}
                className="px-6 py-2.5 bg-black text-white dark:bg-white dark:text-black rounded-full font-medium shadow-md hover:scale-105 transition-transform"
              >
                点击刷新
              </button>
            </div>
          )}
        </div>

        <p className={`text-sm font-medium transition-colors ${status === 802 ? 'text-[#0071e3]' : 'text-[#86868b]'}`}>
          {statusText}
        </p>
      </div>
    </div>
  );
}
