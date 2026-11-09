/**
 * 全网主流自媒体与平台情报侦察模块 (Intel Scout)
 * 支持免登录与低风控采集：
 * 1. 哔哩哔哩 (Bilibili) 实时热门全站榜单 & 视频元数据
 * 2. 知乎 (Zhihu) 全站热榜榜单与热点解析
 * 3. 新浪微博 (Weibo) 实时热搜榜
 * 4. GitHub 热门技术趋势搜索
 * 5. 全网网页深度无广告 Markdown 提炼清洗 (Jina / Direct)
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * 获取 B站 实时全站热门视频列表
 */
export async function getBilibiliHotList(limit = 10) {
  try {
    const res = await fetch('https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all', {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!res.ok) throw new Error(`Bilibili API 响应异常: HTTP ${res.status}`);
    const data = await res.json();
    const list = data?.data?.list || [];
    return list.slice(0, limit).map((item, idx) => ({
      rank: idx + 1,
      bvid: item.bvid,
      title: item.title,
      author: item.owner?.name || '未知UP主',
      views: item.stat?.view ? (item.stat.view > 10000 ? `${(item.stat.view / 10000).toFixed(1)}万` : item.stat.view) : '0',
      danmaku: item.stat?.danmaku || 0,
      url: `https://www.bilibili.com/video/${item.bvid}`
    }));
  } catch (err) {
    console.error('[Intel Scout] B站热门榜单获取失败:', err.message);
    return [];
  }
}

/**
 * 获取知乎全站实时热榜
 */
export async function getZhihuHotList(limit = 10) {
  try {
    const res = await fetch('https://api.zhihu.com/topstory/hot-lists/total?limit=' + limit, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!res.ok) throw new Error(`知乎 API 响应异常: HTTP ${res.status}`);
    const data = await res.json();
    const list = data?.data || [];
    return list.slice(0, limit).map((item, idx) => ({
      rank: idx + 1,
      title: item.target?.title || '未知问题',
      detail: item.target?.excerpt || '',
      hotScore: item.detail_text || '',
      url: item.target?.id ? `https://www.zhihu.com/question/${item.target.id}` : ''
    }));
  } catch (err) {
    console.error('[Intel Scout] 知乎热榜获取失败:', err.message);
    return [];
  }
}

/**
 * 获取微博实时热搜榜
 */
export async function getWeiboHotSearch(limit = 10) {
  try {
    const res = await fetch('https://weibo.com/ajax/side/hotSearch', {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://weibo.com/'
      }
    });
    if (!res.ok) throw new Error(`微博 API 响应异常: HTTP ${res.status}`);
    const data = await res.json();
    const realtime = data?.data?.realtime || [];
    return realtime.slice(0, limit).map((item, idx) => ({
      rank: idx + 1,
      word: item.word,
      hotIndex: item.num ? (item.num > 10000 ? `${(item.num / 10000).toFixed(1)}万` : item.num) : '置顶热搜',
      category: item.category || '综合',
      url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(item.word)}%23`
    }));
  } catch (err) {
    console.error('[Intel Scout] 微博热搜获取失败:', err.message);
    return [];
  }
}

/**
 * 获取 B站 指定视频的深度元数据
 */
export async function getBilibiliVideoDetail(bvid) {
  try {
    const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== 0) throw new Error(data.message || '查询失败');
    const v = data.data;
    return {
      bvid: v.bvid,
      title: v.title,
      description: v.desc,
      author: v.owner?.name,
      publishDate: new Date(v.pubdate * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      views: v.stat?.view,
      likes: v.stat?.like,
      coins: v.stat?.coin,
      favorites: v.stat?.favorite,
      coverUrl: v.pic
    };
  } catch (err) {
    console.error('[Intel Scout] B站视频详情获取失败:', err.message);
    return null;
  }
}

/**
 * 全网网页内容深度清洗与提炼 (转化为干净 Markdown)
 */
export async function fetchWebPageMarkdown(targetUrl) {
  if (!targetUrl || !targetUrl.startsWith('http')) return null;
  try {
    // 优先借助 Jina Reader 代理进行专业无广告正文提取
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    const res = await fetch(jinaUrl, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Accept': 'text/markdown'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const text = await res.text();
      return text.slice(0, 10000); // 截取前 10000 字符防止超长
    }
  } catch (err) {
    console.warn('[Intel Scout] Jina Reader 提炼超时，回退至原生获取:', err.message);
  }

  // 回退原生抓取
  try {
    const rawRes = await fetch(targetUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000)
    });
    if (!rawRes.ok) return null;
    const rawHtml = await rawRes.text();
    // 简单正则过滤 HTML 标签与多余空格
    const cleanText = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleanText.slice(0, 5000);
  } catch (fallbackErr) {
    console.error('[Intel Scout] 网页抓取失败:', fallbackErr.message);
    return null;
  }
}
