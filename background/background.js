// background/background.js

// 全局Service Worker错误处理
self.onerror = function(message, source, lineno, colno, error) {
    console.error("Service Worker Global Error:", {
        message: message,
        source: source,
        lineno: lineno,
        colno: colno,
        error: error ? error.stack : "No stack trace available"
    });
};

// Service Worker生命周期日志
self.addEventListener('install', (event) => {
    console.log("Service Worker: 'install' event triggered.");
    event.waitUntil(self.skipWaiting()); // 强制新版本Service Worker立即激活
});

// 全局变量来持有 YouTubeAnalyzer 实例，确保所有事件监听器都可以访问它
let youtubeAnalyzerInstance;

self.addEventListener('activate', (event) => {
    console.log("Service Worker: 'activate' event triggered.");
    event.waitUntil(
        (async () => {
            console.log("Service Worker: 'activate' - Claiming clients.");
            await self.clients.claim(); // 激活后立即控制所有页面

            // 再次尝试更细粒度的错误捕获
            try {
                console.log("Service Worker: 'activate' - Instantiating YouTubeAnalyzer.");
                youtubeAnalyzerInstance = new YouTubeAnalyzer();
                
                console.log("Service Worker: 'activate' - Calling youtubeAnalyzerInstance.init(). (Pre-await)");
                await youtubeAnalyzerInstance.init(); // 等待初始化完成
                console.log("Service Worker: 'activate' - youtubeAnalyzerInstance.init() has resolved.");

                console.log("Service Worker: 'activate' - Initialization complete. Service Worker fully ready.");
            } catch (error) {
                console.error("Service Worker: 'activate' - CRITICAL INITIALIZATION FAILURE:", error);
                // 确保这里能捕获到错误信息，并可能通过一个持久化的存储机制记录下来
                // 重新抛出错误，以便 Service Worker 状态能正确反映问题
                throw error;
            }
        })().catch(error => {
            console.error("Service Worker: 'activate' - Unhandled Promise Rejection or Top-level Error:", error);
            // 最终的捕获，确保即使Promise链断裂也能记录
        })
    );
});

console.log("YouTube Analyzer Background Service Worker: Version 2.6 Loaded! (Ultra Debugging)"); // 更新版本信息

/**
 * YouTubeAnalyzer类用于处理与YouTube Data API的交互，
 * 包括获取频道数据、视频数据和趋势视频。
 * 它还管理API密钥和数据缓存。
 */
class YouTubeAnalyzer {
    constructor() {
        this.apiKey = null; // YouTube Data API密钥
        this.cache = {};    // 数据缓存，用于存储API响应，避免重复请求
        console.log("Background: YouTubeAnalyzer constructor: Properties initialized. (Line 57)"); // 精确行号
    }

    /**
     * 初始化函数：加载API密钥并设置消息监听器。
     */
    async init() {
        console.log("Background: init() method entered. (Line 63)"); // 精确行号

        try {
            console.log("Background: init() - Step 1: Attempting to load API key from storage. (Line 66)"); // 精确行号
            const result = await chrome.storage.sync.get('youtubeApiKey');
            console.log("Background: init() - Step 2: API Key load result received. (Line 68)"); // 精确行号
            this.apiKey = result.youtubeApiKey || null;
            console.log("Background: init() - Step 3: API Key value processed:", this.apiKey ? "****** (masked)" : "None", "(Line 70)"); // 精确行号

            console.log("Background: init() - Step 4: Setting up message listener. (Line 72)"); // 精确行号
            chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
            console.log("Background: init() - Step 5: Message listener set up successfully. (Line 74)"); // 精确行号

        } catch (error) {
            console.error("Background: Critical Initialization Error caught in init():", error, "(Line 77)"); // 精确行号
            throw error; 
        }
        console.log("Background: init() method finished successfully. (Line 80)"); // 精确行号
    }

    /**
     * 处理来自其他部分（如popup或content script）的消息。
     * Service Worker 消息监听器。
     * @param {object} request - 消息请求对象
     * @param {object} sender - 发送者信息
     * @param {function} sendResponse - 响应函数
     * @returns {boolean} - 如果异步处理响应，返回true
     */
    async handleMessage(request, sender, sendResponse) {
        // 确保 Service Worker 实例已初始化，否则拒绝请求
        if (!youtubeAnalyzerInstance || !youtubeAnalyzerInstance.apiKey) {
            console.warn("Background: Received message before analyzer instance is fully initialized.", request.type);
            sendResponse({ success: false, error: "Extension not fully initialized. Please try again." });
            return false;
        }

        console.log("Background: Received message:", request.type, "from", sender.tab ? sender.tab.url : "extension");
        try {
            let responseData;
            switch (request.type) {
                case 'GET_CHANNEL_DATA':
                    responseData = await youtubeAnalyzerInstance.getChannelData(request.channelId);
                    sendResponse({ success: true, data: responseData });
                    break;

                case 'GET_VIDEO_DATA':
                    responseData = await youtubeAnalyzerInstance.getVideoData(request.videoId);
                    sendResponse({ success: true, data: responseData });
                    break;

                case 'GET_TRENDING_VIDEOS':
                    responseData = await youtubeAnalyzerInstance.getTrendingVideos(request.regionCode, request.category);
                    sendResponse({ success: true, data: responseData });
                    break;

                case 'SAVE_API_KEY':
                    await youtubeAnalyzerInstance.saveApiKey(request.apiKey);
                    sendResponse({ success: true });
                    break;

                case 'CLEAR_CACHE':
                    youtubeAnalyzerInstance.clearCache();
                    sendResponse({ success: true });
                    break;

                default:
                    console.warn("Unknown message type:", request.type);
                    sendResponse({ success: false, error: "Unknown message type" });
                    break;
            }
        } catch (error) {
            console.error("Background: Error handling message '"+ request.type +"':", error);
            sendResponse({ success: false, error: error.message || "An unknown error occurred during message handling." });
        }
        return true;
    }

    /**
     * 保存API密钥到Chrome存储。
     * @param {string} apiKey - 要保存的API密钥
     */
    async saveApiKey(apiKey) {
        try {
            this.apiKey = apiKey;
            await chrome.storage.sync.set({ youtubeApiKey: apiKey });
            console.log("Background: API Key saved and updated.");
            this.clearCache();
        } catch (error) {
            console.error("Background: Error saving API key:", error);
            throw error;
        }
    }

    /**
     * 清除缓存中的所有数据。
     */
    clearCache() {
        this.cache = {};
        console.log("Background: Cache cleared.");
    }

    /**
     * 执行YouTube Data API请求。
     * @param {string} url - API请求的URL
     * @returns {Promise<object>} - API响应数据
     */
    async makeApiRequest(url) {
        if (!this.apiKey) {
            throw new Error("YouTube API Key is not set. Please set it in the extension options.");
        }

        const result = await chrome.storage.sync.get('cacheTime');
        const cacheTimeMs = (parseInt(result.cacheTime) || 0) * 3600000;

        if (cacheTimeMs > 0 && this.cache[url] && (Date.now() - this.cache[url].timestamp < cacheTimeMs)) {
            console.log("Background: Using cached data for:", url);
            return this.cache[url].data;
        }

        try {
            const response = await fetch(`${url}&key=${this.apiKey}`);
            if (!response.ok) {
                const errorData = await response.json();
                console.error("Background: API request failed:", errorData);
                throw new Error(errorData.error ? errorData.error.message : `API request failed with status: ${response.status}`);
            }
            const data = await response.json();
            if (cacheTimeMs > 0) {
                this.cache[url] = { data, timestamp: Date.now() };
            }
            return data;
        } catch (error) {
            console.error("Background: Fetch error:", error);
            throw error;
        }
    }

    /**
     * 获取指定频道ID的频道数据。
     * @param {string} channelId - 频道ID
     * @returns {Promise<object>} - 频道数据
     */
    async getChannelData(channelId) {
        console.log("Background: Fetching channel data for ID:", channelId);
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${channelId}`;
        const data = await this.makeApiRequest(url);
        if (data.items && data.items.length > 0) {
            return data.items[0];
        }
        throw new Error("Channel not found or no data available.");
    }

    /**
     * 获取指定视频ID的视频数据。
     * @param {string} videoId - 视频ID
     * @returns {Promise<object>} - 视频数据
     */
    async getVideoData(videoId) {
        console.log("Background: Fetching video data for ID:", videoId);
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,topicDetails&id=${videoId}`;
        const data = await this.makeApiRequest(url);
        if (data.items && data.items.length > 0) {
            return data.items[0];
        }
        throw new Error("Video not found or no data available.");
    }

    /**
     * 获取YouTube趋势视频列表。
     * @param {string} regionCode - 地区代码，例如 'US', 'GB'
     * @param {string} category - 视频类别ID，例如 '10' (Music)
     * @returns {Promise<object[]>} - 趋势视频列表
     */
    async getTrendingVideos(regionCode = 'US', category = '') {
        console.log(`Background: Fetching trending videos for region: ${regionCode}, category: ${category}`);
        let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&regionCode=${regionCode}`;
        if (category) {
            url += `&videoCategoryId=${category}`;
        }
        const data = await this.makeApiRequest(url);
        if (data.items && data.items.length > 0) {
            return data.items;
        }
        throw new Error("No trending videos found.");
    }

    /**
     * 获取视频评论（仅限部分API可访问的公开评论）。
     * 注意：YouTube Data API v3对评论访问有限制，
     * 通常只能获取少量顶级评论，且有配额限制。
     * 更全面的评论抓取可能需要内容脚本配合DOM操作或后端服务。
     * @param {string} videoId - 视频ID
     * @returns {Promise<object[]>} - 评论数据
     */
    async getVideoComments(videoId) {
        console.log("Background: Fetching comments for video ID:", videoId);
        const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=20`; // 示例：获取前20条
        const data = await this.makeApiRequest(url);
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
}
