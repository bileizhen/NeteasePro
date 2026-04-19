process.env.NO_ANONYMOUS_TOKEN = 'true';
const playmode = require('NeteaseCloudMusicApi/module/playmode_intelligence_list');
const request = require('NeteaseCloudMusicApi/util/request');
playmode({ id: 1813926556, pid: 0 }, request).then(res => {
  console.log(res.body.data.map(d => d.songInfo.name));
}).catch(console.error);
