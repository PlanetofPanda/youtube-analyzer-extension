/**
 * YouTube API Client
 * 封装与YouTube Data API的所有交互逻辑，提供统一的接口。
 */

class YouTubeApiClient {
    constructor() {
        this.apiKey = null;
        this.cache = {};
        this.BASE_URL = 'https://www.googleapis.com/youtube/v3';
    }

    /**
     * 初始化API客户端，加载API密钥。
     * @returns {Promise<void>}
     */
    async init() {
        try {
            const result = await chrome.storage.sync.get('youtubeApiKey');
            this.apiKey = result.youtubeApiKey || null;
            console.log("API Client: Initialized with API key:", this.apiKey ? "****** (masked)" : "None");
        } catch (error) {
            console.error("API Client: Error initializing:", error);
            throw error;
        }
    }

    /**
     * 设置API密钥。
     * @param {string} apiKey - YouTube Data API密钥
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        console.log("API Client: API key updated");
    }

    /**
     * 清除缓存。
     */
    clearCache() {
        this.cache = {};
        console.log("API Client: Cache cleared");
    }

    /**
     * 执行API请求，支持缓存。
     * @param {string} endpoint - API端点，例如 'videos', 'channels'
     * @param {Object} params - 请求参数
     * @returns {Promise<Object>} - API响应数据
     */
    async request(endpoint, params = {}) {
        if (!this.apiKey) {
            throw new Error("YouTube API Key is not set. Please set it in the extension options.");
        }

        // 构建完整的URL（不包括API密钥）
        const queryParams = new URLSearchParams(params).toString();
        const url = `${this.BASE_URL}/${endpoint}?${queryParams}`;
        
        // 构建用于缓存的键（包含所有参数但不包括API密钥）
        const cacheKey = url;

        // 检查缓存是否有效
        const result = await chrome.storage.sync.get('cacheTime');
        const cacheTimeMs = (parseInt(result.cacheTime) || 0) * 3600000;

        if (cacheTimeMs > 0 && this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp < cacheTimeMs)) {
            console.log("API Client: Using cached data for:", endpoint);
            return this.cache[cacheKey].data;
        }

        // 构建带API密钥的完整URL
        const fullUrl = `${url}&key=${this.apiKey}`;

        try {
            console.log("API Client: Fetching data from:", endpoint);
            const response = await fetch(fullUrl);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Client: Request failed:", errorData);
                throw new Error(errorData.error ? errorData.error.message : `API request failed with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 缓存结果（如果启用缓存）
            if (cacheTimeMs > 0) {
                this.cache[cacheKey] = { data, timestamp: Date.now() };
            }
            
            return data;
        } catch (error) {
            console.error("API Client: Fetch error:", error);
            throw error;
        }
    }

    /**
     * 获取频道数据。
     * @param {string} channelId - 频道ID
     * @returns {Promise<Object>} - 频道数据
     */
    async getChannelData(channelId) {
        console.log("API Client: Fetching channel data for ID:", channelId);
        const data = await this.request('channels', {
            part: 'snippet,statistics,brandingSettings',
            id: channelId
        });
        
        if (data.items && data.items.length > 0) {
            return data.items[0];
        }
        throw new Error("Channel not found or no data available.");
    }

    /**
     * 获取视频数据。
     * @param {string} videoId - 视频ID
     * @returns {Promise<Object>} - 视频数据
     */
    async getVideoData(videoId) {
        console.log("API Client: Fetching video data for ID:", videoId);
        const data = await this.request('videos', {
            part: 'snippet,statistics,contentDetails,topicDetails',
            id: videoId
        });
        
        if (data.items && data.items.length > 0) {
            return data.items[0];
        }
        throw new Error("Video not found or no data available.");
    }

    /**
     * 获取趋势视频列表。
     * @param {string} regionCode - 地区代码，例如 'US', 'GB'
     * @param {string} category - 视频类别ID，例如 '10' (Music)
     * @returns {Promise<Object[]>} - 趋势视频列表
     */
    async getTrendingVideos(regionCode = 'US', category = '') {
        console.log(`API Client: Fetching trending videos for region: ${regionCode}, category: ${category}`);
        const params = {
            part: 'snippet,statistics',
            chart: 'mostPopular',
            maxResults: 20,
            regionCode: regionCode
        };
        
        // 如果提供了类别，添加到请求参数中
        if (category) {
            params.videoCategoryId = category;
        }
        
        const data = await this.request('videos', params);
        
        if (data.items && data.items.length > 0) {
            return data.items;
        }
        throw new Error("No trending videos found.");
    }

    /**
     * 获取视频评论。
     * @param {string} videoId - 视频ID
     * @param {number} maxResults - 最大返回结果数量
     * @returns {Promise<Object[]>} - 评论数据
     */
    async getVideoComments(videoId, maxResults = 20) {
        console.log("API Client: Fetching comments for video ID:", videoId);
        const data = await this.request('commentThreads', {
            part: 'snippet',
            videoId: videoId,
            maxResults: maxResults
        });
        
        if (data.items) {
            return data.items.map(item => ({
                author: item.snippet.topLevelComment.snippet.authorDisplayName,
                text: item.snippet.topLevelComment.snippet.textDisplay,
                likeCount: item.snippet.topLevelComment.snippet.likeCount,
                publishedAt: item.snippet.topLevelComment.snippet.publishedAt
            }));
        }
        return [];
    }

    /**
     * 获取视频类别列表。
     * @param {string} regionCode - 地区代码，例如 'US', 'GB'
     * @returns {Promise<Object[]>} - 视频类别列表
     */
    async getVideoCategories(regionCode = 'US') {
        console.log("API Client: Fetching video categories for region:", regionCode);
        const data = await this.request('videoCategories', {
            part: 'snippet',
            regionCode: regionCode
        });
        
        if (data.items) {
            return data.items.map(item => ({
                id: item.id,
                title: item.snippet.title
            }));
        }
        return [];
    }

    /**
     * 搜索YouTube内容。
     * @param {string} query - 搜索关键词
     * @param {string} type - 内容类型 ('video', 'channel', 'playlist')
     * @param {number} maxResults - 最大返回结果数量
     * @returns {Promise<Object[]>} - 搜索结果
     */
    async searchContent(query, type = 'video', maxResults = 20) {
        console.log(`API Client: Searching for "${query}" with type "${type}"`);
        const data = await this.request('search', {
            part: 'snippet',
            q: query,
            type: type,
            maxResults: maxResults
        });
        
        if (data.items) {
            return data.items.map(item => ({
                id: type === 'video' ? item.id.videoId : (type === 'channel' ? item.id.channelId : item.id.playlistId),
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : null,
                channelTitle: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt
            }));
        }
        return [];
    }
}

// 导出单例实例
const youTubeApiClient = new YouTubeApiClient();
export default youTubeApiClient;