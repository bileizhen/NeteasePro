const request = require('NeteaseCloudMusicApi/util/request');
const songUrl = require('NeteaseCloudMusicApi/module/song_url_v1');
songUrl({ id: 1813926556, level: 'standard' }, request).then(res => {
  console.log(res.body.data[0].url);
});
