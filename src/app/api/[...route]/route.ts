import { NextRequest, NextResponse } from 'next/server';

// Fix Next.js dynamic import issue with NeteaseCloudMusicApi
const login_qr_key = require('NeteaseCloudMusicApi/module/login_qr_key');
const login_qr_create = require('NeteaseCloudMusicApi/module/login_qr_create');
const login_qr_check = require('NeteaseCloudMusicApi/module/login_qr_check');
const login_status = require('NeteaseCloudMusicApi/module/login_status');
const user_playlist = require('NeteaseCloudMusicApi/module/user_playlist');
const playlist_detail = require('NeteaseCloudMusicApi/module/playlist_detail');
const song_url_v1 = require('NeteaseCloudMusicApi/module/song_url_v1');
const song_detail = require('NeteaseCloudMusicApi/module/song_detail');
const lyric = require('NeteaseCloudMusicApi/module/lyric');
const search = require('NeteaseCloudMusicApi/module/search');
const cloudsearch = require('NeteaseCloudMusicApi/module/cloudsearch');
const user_detail = require('NeteaseCloudMusicApi/module/user_detail');

const request = require('NeteaseCloudMusicApi/util/request');
const { cookieToJson } = require('NeteaseCloudMusicApi/util/index');

// 修复 Vercel Serverless 环境下写 /tmp/anonymous_token 的 ENOENT 报错
if (typeof process !== 'undefined') {
  // 覆盖全局的环境变量，告诉 NeteaseCloudMusicApi 不要去写本地文件缓存 token
  process.env.NO_ANONYMOUS_TOKEN = 'true';
}

const wrapRequest = (fn: any) => {
  return async (data: any) => {
    const cookie = typeof data.cookie === 'string' ? cookieToJson(data.cookie) : data.cookie || {};
    return fn({ ...data, cookie }, request);
  };
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const resolvedParams = await params;
  const route = resolvedParams.route.join('/');
  
  try {
    const body = await req.json().catch(() => ({}));
    // Priority: cookie from body > cookie from headers
    const cookie = body.cookie || req.headers.get('cookie') || '';
    
    const apiParams = {
      ...body,
      cookie,
      realIP: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '116.25.146.177',
      // Bypass network risk error (-460) by using linuxapi/eapi or avoiding specific flags
      os: 'pc',
    };

    let result;

    switch (route) {
      case 'login/qr/key':
        result = await wrapRequest(login_qr_key)(apiParams);
        break;
      case 'login/qr/create':
        result = await wrapRequest(login_qr_create)(apiParams);
        break;
      case 'login/qr/check':
        result = await wrapRequest(login_qr_check)(apiParams);
        break;
      case 'login/status':
        result = await wrapRequest(login_status)(apiParams);
        break;
      case 'user/playlist':
        result = await wrapRequest(user_playlist)(apiParams);
        break;
      case 'playlist/detail':
        result = await wrapRequest(playlist_detail)(apiParams);
        break;
      case 'song/url/v1':
        result = await wrapRequest(song_url_v1)(apiParams);
        break;
      case 'song/detail':
        result = await wrapRequest(song_detail)(apiParams);
        break;
      case 'lyric':
        result = await wrapRequest(lyric)(apiParams);
        break;
      case 'search':
        result = await wrapRequest(search)(apiParams);
        break;
      case 'cloudsearch':
        result = await wrapRequest(cloudsearch)(apiParams);
        break;
      case 'user/detail':
        result = await wrapRequest(user_detail)(apiParams);
        break;
      default:
        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }

    const responseBody = { ...result.body };
    if (result.cookie) {
      responseBody.cookie = result.cookie.join(';');
    }

    return NextResponse.json(responseBody, {
      status: result.status,
      headers: {
        'Set-Cookie': result.cookie?.join('; ') || '',
      }
    });
  } catch (error: any) {
    console.error(`API Error [${route}]:`, error);
    return NextResponse.json(
      { code: 500, message: error.body?.message || error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
