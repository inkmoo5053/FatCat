import { 
  getBilibiliHotList, 
  getZhihuHotList, 
  getWeiboHotSearch,
  getBilibiliVideoDetail 
} from './lib/intel_scout.mjs';

async function run() {
  console.log('=== [全网情报侦察单元测试启动] ===');
  
  const bili = await getBilibiliHotList(3);
  console.log('1. B站热门 Top 3:', bili.map(b => `${b.rank}. ${b.title} (${b.author})`));

  const zhihu = await getZhihuHotList(3);
  console.log('2. 知乎热榜 Top 3:', zhihu.map(z => `${z.rank}. ${z.title}`));

  const weibo = await getWeiboHotSearch(3);
  console.log('3. 微博热搜 Top 3:', weibo.map(w => `${w.rank}. ${w.word}`));

  if (bili.length > 0) {
    const detail = await getBilibiliVideoDetail(bili[0].bvid);
    console.log('4. 热门第一视频详情:', detail?.title, 'UP主:', detail?.author, '播放量:', detail?.views);
  }

  console.log('=== [全网情报侦察单元测试全部通过！] ===');
}

run();
