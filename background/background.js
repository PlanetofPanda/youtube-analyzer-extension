// background/background.js
import youTubeApiClient from '../libs/api-client.js';
import dataProcessor from '../libs/data-processor.js';
import chartUtils from '../libs/chart-utils.js';
import contextUtils from '../libs/context-utils.js';

// 初始化状态跟踪，防止重复初始化
let isInitialized = false;
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;
let lastInitAttemptTime = 0;
const INIT_COOLDOWN_MS = 30000; // 30秒冷却时间

// 全局变量来持有 YouTubeAnalyzer 实例，确保所有事件监听器都可以访问它
let youtubeAnalyzerInstance = null;

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

self.addEventListener('activate', (event) => {
    console.log("Service Worker: 'activate' event triggered.");
    event.waitUntil(
        (async () => {
            console.log("Service Worker: 'activate' - Claiming clients.");
            await self.clients.claim(); // 激活后立即控制所有页面

            // 检查是否已初始化或冷却时间是否已过
            const now = Date.now();
            if (isInitialized) {
                console.log("Service Worker: Already initialized, skipping initialization.");
                return;
            }
            
            if (initializationAttempts >= MAX_INITIALIZATION_ATTEMPTS) {
                console.warn(`Service Worker: Maximum initialization attempts (${MAX_INITIALIZATION_ATTEMPTS}) reached. Waiting for manual restart.`);
                return;
            }
            
            if (now - lastInitAttemptTime < INIT_COOLDOWN_MS && lastInitAttemptTime !== 0) {
                console.log(`Service Worker: Initialization cooldown period (${INIT_COOLDOWN_MS}ms) not elapsed. Skipping initialization.`);
                return;
            }
            
            // 更新初始化尝试计数和时间
            initializationAttempts++;
            lastInitAttemptTime = now;

            // 尝试初始化
            try {
                // 简化的上下文验证，针对Service Worker环境
                if (typeof chrome === 'undefined' || !chrome.runtime) {
                    throw new Error("Basic Chrome API not available during Service Worker activation.");
                }
                
                console.log("Service Worker: 'activate' - Instantiating YouTubeAnalyzer.");
                
                // 单例模式：确保只有一个实例
                if (!youtubeAnalyzerInstance) {
                    youtubeAnalyzerInstance = new YouTubeAnalyzer();
                }
                
                console.log("Service Worker: 'activate' - Calling youtubeAnalyzerInstance.init().");
                await youtubeAnalyzerInstance.init(); // 等待初始化完成
                
                // 标记初始化完成
                isInitialized = true;
                console.log("Service Worker: 'activate' - Initialization complete. Service Worker fully ready.");
            } catch (error) {
                console.error("Service Worker: 'activate' - CRITICAL INITIALIZATION FAILURE:", error);
                isInitialized = false; // 重置初始化状态，允许下次尝试
            }
        })().catch(error => {
            console.error("Service Worker: 'activate' - Unhandled Promise Rejection:", error);
        })
    );
});

console.log("YouTube Analyzer Background Service Worker: Version 6.0 Loaded! (With Listener Flag Fix)");

/**
 * YouTubeAnalyzer类现在使用api-client.js库来处理API交互，
 * 并增加了使用data-processor.js的数据分析功能。
 * 它仍然负责消息处理和事件协调。
 * 添加了防止重复初始化和更可靠的上下文验证。
 */
class YouTubeAnalyzer {
    constructor() {
        console.log("Background: YouTubeAnalyzer constructor: Initializing with API client and context validation.");
        this.messageHandler = null;
        this.contextValidator = null;
        this.isListenerActive = false;
    }

    /**
     * 初始化函数：初始化API客户端、设置消息监听器和上下文验证。
     */
    async init() {
        console.log("Background: init() method entered.");

        try {
            // 简化的验证，针对Service Worker环境
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                throw new Error("Basic Chrome API not available during initialization.");
            }
            
            console.log("Background: init() - Initializing YouTube API client.");
            await youTubeApiClient.init();
            
            console.log("Background: init() - Setting up message listener.");
            // 使用安全的方式添加消息监听器，并存储引用以便后续可能的移除
            this.addSafeMessageListener();
            console.log("Background: init() - Message listener set up successfully.");
            
            // 设置轻量级上下文验证，仅在Service Worker环境下需要
            this.setupContextValidation();

        } catch (error) {
            console.error("Background: Critical Initialization Error caught in init():", error);
            throw error; 
        }
        console.log("Background: init() method finished successfully.");
    }
    
    /**
     * 设置轻量级上下文验证，减少检查频率，避免重复初始化
     */
    setupContextValidation() {
        // 如果已经有验证器，先清除它
        if (this.contextValidator) {
            clearInterval(this.contextValidator);
            this.contextValidator = null;
            console.log("Background: Cleared existing context validator");
        }
        
        // 创建一个新的验证器，使用更长的间隔
        this.contextValidator = setInterval(() => {
            // 简化的验证，仅检查基本API是否可用
            const isValid = typeof chrome !== 'undefined' && !!chrome.runtime;
            console.log(`Background: Context validation check - Context valid: ${isValid}, Listener active: ${this.isListenerActive}`);
            
            if (!isValid && this.isListenerActive) {
                console.warn("Background: Basic Chrome API no longer available, cleanup required");
                this.cleanupInvalidContext();
            }
        }, 120000); // 每120秒检查一次，进一步降低频率
        
        console.log("Background: New context validator created with 120s interval");
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
            console.log("Background: Context validator cleared during cleanup");
        }
        
        // 重置初始化状态，但保持尝试计数，避免不必要的重启
        isInitialized = false;
        console.log("Background: Initialization state reset, ready for next activation if needed");
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
            this.isListenerActive = true; // 关键修复：设置监听器激活标志
            console.log("Background: Message listener safely added and marked as active.");
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
            this.isListenerActive = false; // 关键修复：清除监听器激活标志
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