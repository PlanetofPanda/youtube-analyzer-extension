// background/background.js
import youTubeApiClient from '../libs/api-client.js';
import dataProcessor from '../libs/data-processor.js';
import chartUtils from '../libs/chart-utils.js';
import contextUtils from '../libs/context-utils.js';

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
                // 验证扩展上下文是否有效
                if (!contextUtils.isExtensionContextValid()) {
                    throw new Error("Extension context is invalid during Service Worker activation.");
                }
                
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

console.log("YouTube Analyzer Background Service Worker: Version 4.0 Loaded! (With Context Validation)"); // 更新版本信息

/**
 * YouTubeAnalyzer类现在使用api-client.js库来处理API交互，
 * 并增加了使用data-processor.js的数据分析功能。
 * 它仍然负责消息处理和事件协调。
 * 新增使用context-utils.js来保护扩展上下文。
 */
class YouTubeAnalyzer {
    constructor() {
        console.log("Background: YouTubeAnalyzer constructor: Initializing with API client and context validation.");
        this.messageHandler = null;
        this.contextValidator = null;
    }

    /**
     * 初始化函数：初始化API客户端、设置消息监听器和上下文验证。
     */
    async init() {
        console.log("Background: init() method entered.");

        try {
            // 首先验证扩展上下文是否有效
            if (!contextUtils.isExtensionContextValid()) {
                throw new Error("Extension context is invalid during initialization.");
            }
            
            console.log("Background: init() - Initializing YouTube API client.");
            await youTubeApiClient.init();
            
            console.log("Background: init() - Setting up message listener.");
            // 使用安全的方式添加消息监听器，并存储引用以便后续可能的移除
            this.addSafeMessageListener();
            console.log("Background: init() - Message listener set up successfully.");
            
            // 设置定期上下文验证
            this.setupContextValidation();

        } catch (error) {
            console.error("Background: Critical Initialization Error caught in init():", error);
            throw error; 
        }
        console.log("Background: init() method finished successfully.");
    }
    
    /**
     * 设置定期上下文验证
     */
    setupContextValidation() {
        this.contextValidator = contextUtils.createContextValidator(() => {
            console.warn("Background: Extension context became invalid, attempting recovery...");
            
            // 尝试清理和恢复
            this.cleanupInvalidContext();
            
            // 尝试重新初始化（如果适用）
            setTimeout(() => {
                if (contextUtils.isExtensionContextValid()) {
                    console.log("Background: Context appears valid again, re-initializing...");
                    this.addSafeMessageListener();
                    this.setupContextValidation();
                }
            }, 5000);
        }, 10000); // 每10秒检查一次
    }
    
    /**
     * 清理无效上下文资源
     */
    cleanupInvalidContext() {
        console.log("Background: Cleaning up resources due to invalid context.");
        
        // 安全地移除消息监听器
        this.removeSafeMessageListener();
        
        // 清除上下文验证定时器
        if (this.contextValidator) {
            clearInterval(this.contextValidator);
            this.contextValidator = null;
        }
    }
    
    /**
     * 安全地添加消息监听器
     */
    addSafeMessageListener() {
        // 首先移除现有的消息监听器（如果有）
        this.removeSafeMessageListener();
        
        // 使用绑定的处理方法
        const boundHandler = this.handleMessage.bind(this);
        
        // 安全地添加监听器
        if (contextUtils.isExtensionContextValid()) {
            chrome.runtime.onMessage.addListener(boundHandler);
            this.messageHandler = boundHandler;
            console.log("Background: Message listener safely added.");
        } else {
            console.warn("Background: Cannot add message listener, context is invalid.");
        }
    }
    
    /**
     * 安全地移除消息监听器
     */
    removeSafeMessageListener() {
        if (this.messageHandler) {
            contextUtils.safeExecute(() => {
                chrome.runtime.onMessage.removeListener(this.messageHandler);
                console.log("Background: Message listener safely removed.");
            });
            this.messageHandler = null;
        }
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
        // 使用上下文验证工具检查扩展上下文是否有效
        if (!contextUtils.isExtensionContextValid()) {
            console.warn("Background: Ignoring message due to invalid extension context:", request.type);
            sendResponse({ success: false, error: "Extension context is invalid. Please reload the extension." });
            return false;
        }
        
        // 确保 API 客户端已初始化并且有API密钥
        if (!youTubeApiClient.apiKey) {
            console.warn("Background: Received message before API client is fully initialized.", request.type);
            sendResponse({ success: false, error: "Extension not fully initialized. Please try again." });
            return false;
        }

        console.log("Background: Received message:", request.type, "from", sender.tab ? sender.tab.url : "extension");
        try {
            let responseData;
            switch (request.type) {
                case 'GET_CHANNEL_DATA':
                    responseData = await contextUtils.safeExecute(
                        async () => await youTubeApiClient.getChannelData(request.channelId),
                        null
                    );
                    if (responseData) {
                        sendResponse({ success: true, data: responseData });
                    } else {
                        sendResponse({ success: false, error: "Failed to fetch channel data due to context issue." });
                    }
                    break;

                case 'GET_VIDEO_DATA':
                    responseData = await contextUtils.safeExecute(
                        async () => await youTubeApiClient.getVideoData(request.videoId),
                        null
                    );
                    if (responseData) {
                        sendResponse({ success: true, data: responseData });
                    } else {
                        sendResponse({ success: false, error: "Failed to fetch video data due to context issue." });
                    }
                    break;

                case 'GET_TRENDING_VIDEOS':
                    responseData = await contextUtils.safeExecute(
                        async () => await youTubeApiClient.getTrendingVideos(request.regionCode, request.category),
                        null
                    );
                    if (responseData) {
                        sendResponse({ success: true, data: responseData });
                    } else {
                        sendResponse({ success: false, error: "Failed to fetch trending videos due to context issue." });
                    }
                    break;

                case 'GET_VIDEO_COMMENTS':
                    responseData = await contextUtils.safeExecute(
                        async () => await youTubeApiClient.getVideoComments(request.videoId, request.maxResults),
                        null
                    );
                    if (responseData) {
                        sendResponse({ success: true, data: responseData });
                    } else {
                        sendResponse({ success: false, error: "Failed to fetch video comments due to context issue." });
                    }
                    break;

                case 'ANALYZE_VIDEO_DATA':
                    try {
                        // 使用上下文验证工具执行复杂操作
                        const result = await contextUtils.safeExecute(async () => {
                            const videoData = await youTubeApiClient.getVideoData(request.videoId);
                            if (!videoData) return null;
                            
                            const videoKPIs = dataProcessor.calculateVideoKPIs(videoData);
                            const tagAnalysis = dataProcessor.analyzeVideoTags(videoData);
                            const titleAnalysis = dataProcessor.analyzeTitleEffectiveness(videoData.snippet.title);
                            const descriptionAnalysis = dataProcessor.analyzeDescriptionEffectiveness(videoData.snippet.description);
                            
                            return {
                                rawData: videoData,
                                kpis: videoKPIs,
                                tagAnalysis: tagAnalysis,
                                titleAnalysis: titleAnalysis,
                                descriptionAnalysis: descriptionAnalysis
                            };
                        }, null);
                        
                        if (result) {
                            sendResponse({ success: true, data: result });
                        } else {
                            sendResponse({ success: false, error: "Failed to analyze video data due to context issue." });
                        }
                    } catch (error) {
                        console.error("Background: Error in ANALYZE_VIDEO_DATA:", error);
                        sendResponse({ success: false, error: error.message || "Failed to analyze video data." });
                    }
                    break;

                case 'ANALYZE_CHANNEL_DATA':
                    try {
                        // 使用上下文验证工具执行复杂操作
                        const result = await contextUtils.safeExecute(async () => {
                            const channelData = await youTubeApiClient.getChannelData(request.channelId);
                            if (!channelData) return null;
                            
                            const channelKPIs = dataProcessor.calculateChannelKPIs(channelData);
                            
                            return {
                                rawData: channelData,
                                kpis: channelKPIs
                            };
                        }, null);
                        
                        if (result) {
                            sendResponse({ success: true, data: result });
                        } else {
                            sendResponse({ success: false, error: "Failed to analyze channel data due to context issue." });
                        }
                    } catch (error) {
                        console.error("Background: Error in ANALYZE_CHANNEL_DATA:", error);
                        sendResponse({ success: false, error: error.message || "Failed to analyze channel data." });
                    }
                    break;

                case 'ANALYZE_COMMENTS':
                    try {
                        // 使用上下文验证工具执行复杂操作
                        const result = await contextUtils.safeExecute(async () => {
                            const comments = await youTubeApiClient.getVideoComments(request.videoId, request.maxResults || 50);
                            if (!comments) return null;
                            
                            const sentimentAnalysis = await dataProcessor.analyzeCommentSentiment(comments);
                            
                            return {
                                comments: comments,
                                sentimentAnalysis: sentimentAnalysis
                            };
                        }, null);
                        
                        if (result) {
                            sendResponse({ success: true, data: result });
                        } else {
                            sendResponse({ success: false, error: "Failed to analyze comments due to context issue." });
                        }
                    } catch (error) {
                        console.error("Background: Error in ANALYZE_COMMENTS:", error);
                        sendResponse({ success: false, error: error.message || "Failed to analyze comments." });
                    }
                    break;

                case 'SAVE_API_KEY':
                    try {
                        await contextUtils.safeExecute(async () => {
                            youTubeApiClient.setApiKey(request.apiKey);
                            await chrome.storage.sync.set({ youtubeApiKey: request.apiKey });
                            console.log("Background: API Key saved and updated.");
                            youTubeApiClient.clearCache();
                        });
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error("Background: Error saving API key:", error);
                        sendResponse({ success: false, error: error.message || "Failed to save API key." });
                    }
                    break;

                case 'CLEAR_CACHE':
                    try {
                        contextUtils.safeExecute(() => {
                            youTubeApiClient.clearCache();
                        });
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error("Background: Error clearing cache:", error);
                        sendResponse({ success: false, error: error.message || "Failed to clear cache." });
                    }
                    break;

                default:
                    console.warn("Unknown message type:", request.type);
                    sendResponse({ success: false, error: "Unknown message type" });
                    break;
            }
        } catch (error) {
            console.error("Background: Error handling message '"+ request.type +"':", error);
            sendResponse({ success: false, error: error.message || "An unknown error occurred during message handling." });
            
            // 如果出现错误，检查是否是由于上下文无效
            if (error.message && (
                error.message.includes("Extension context invalidated") ||
                error.message.includes("Cannot read properties of undefined") ||
                error.message.includes("chrome is not defined")
            )) {
                // 执行额外的上下文无效处理
                this.cleanupInvalidContext();
            }
        }
        return true;
    }
}