class YouTubeAnalyzer {
  constructor() {
    this.apiKey = null;
    this.cache = new Map();
    this.init();
  }

  async init() {
    // 从存储中获取API密钥
    const result = await chrome.storage.sync.get(['youtube_api_key']);
    this.apiKey = result.youtube_api_key;
    
    // 监听来自popup和content script的消息
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'getChannelData':
          const channelData = await this.getChannelData(request.channelId);
          sendResponse({ success: true, data: channelData });
          break;
        case 'getVideoData':
          const videoData = await this.getVideoData(request.videoId);
          sendResponse({ success: true, data: videoData });
          break;
        case 'getTrendingVideos':
          const trendingData = await this.getTrendingVideos();
          sendResponse({ success: true, data: trendingData });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // 保持消息通道开放
  }

  async getChannelData(channelId) {
    const cacheKey = `channel_${channelId}`;
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
        return cached.data;
      }
    }

    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${this.apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const result = {
      channelId,
      title: data.items[0]?.snippet?.title,
      subscriberCount: data.items[0]?.statistics?.subscriberCount,
      videoCount: data.items[0]?.statistics?.videoCount,
      viewCount: data.items[0]?.statistics?.viewCount,
      timestamp: Date.now()
    };

    // 缓存结果
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  }

  async getVideoData(videoId) {
    const cacheKey = `video_${videoId}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) {
        return cached.data;
      }
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${this.apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const video = data.items[0];
    const result = {
      videoId,
      title: video?.snippet?.title,
      channelTitle: video?.snippet?.channelTitle,
      publishedAt: video?.snippet?.publishedAt,
      viewCount: video?.statistics?.viewCount,
      likeCount: video?.statistics?.likeCount,
      commentCount: video?.statistics?.commentCount,
      tags: video?.snippet?.tags || [],
      timestamp: Date.now()
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  }

  async getTrendingVideos() {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=10&key=${this.apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.items.map(video => ({
      videoId: video.id,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      viewCount: video.statistics.viewCount,
      likeCount: video.statistics.likeCount,
      publishedAt: video.snippet.publishedAt
    }));
  }
}

// 初始化分析器
const analyzer = new YouTubeAnalyzer();