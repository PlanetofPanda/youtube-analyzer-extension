// popup/popup.js

/**
 * PopupController类管理Popup页面的UI交互和与background script的通信。
 */
class PopupController {
    constructor() {
        this.elements = {
            analyzeCurrentVideoButton: document.getElementById('analyzeCurrentVideoButton'),
            currentVideoStatus: document.getElementById('currentVideoStatus'),
            currentVideoData: document.getElementById('currentVideoData'),
            regionSelect: document.getElementById('regionSelect'),
            categorySelect: document.getElementById('categorySelect'),
            loadTrendingVideosButton: document.getElementById('loadTrendingVideosButton'),
            trendingVideosList: document.getElementById('trendingVideosList'),
            openOptionsButton: document.getElementById('openOptionsButton')
        };
        this.initEventListeners(); // 初始化事件监听器
        this.checkAPIKeyStatus(); // 检查API密钥设置状态
    }

    /**
     * 初始化所有UI元素的事件监听器。
     */
    initEventListeners() {
        this.elements.analyzeCurrentVideoButton.addEventListener('click', () => this.analyzeCurrentVideo());
        this.elements.loadTrendingVideosButton.addEventListener('click', () => this.loadTrendingVideos());
        this.elements.openOptionsButton.addEventListener('click', () => this.openOptionsPage());
    }

    /**
     * 检查API密钥是否已设置，并根据情况显示提示。
     */
    async checkAPIKeyStatus() {
        try {
            // 使用防御性编程，确保storage API调用成功
            let result;
            try {
                result = await chrome.storage.sync.get('youtubeApiKey');
                // 确保result是一个有效对象
                if (!result) {
                    throw new Error("无法访问存储API");
                }
            } catch (storageError) {
                console.error("Storage access error:", storageError);
                this.updateStatus('访问存储API时发生错误，请重试。', 'error', this.elements.currentVideoStatus);
                this.updateStatus('访问存储API时发生错误，请重试。', 'error', this.elements.trendingVideosList);
                this.elements.analyzeCurrentVideoButton.disabled = true;
                this.elements.loadTrendingVideosButton.disabled = true;
                return;
            }
            
            const apiKey = result.youtubeApiKey;
            if (!apiKey) {
                this.updateStatus('请在设置中输入您的YouTube API密钥。', 'error', this.elements.currentVideoStatus);
                this.updateStatus('请在设置中输入您的YouTube API密钥。', 'error', this.elements.trendingVideosList);
                this.elements.analyzeCurrentVideoButton.disabled = true;
                this.elements.loadTrendingVideosButton.disabled = true;
            } else {
                this.elements.analyzeCurrentVideoButton.disabled = false;
                this.elements.loadTrendingVideosButton.disabled = false;
                this.updateStatus('', 'success', this.elements.currentVideoStatus); // 清除提示
                this.updateStatus('', 'success', this.elements.trendingVideosList); // 清除提示
            }
        } catch (error) {
            console.error("Error checking API key status:", error);
            this.updateStatus('检查API密钥时发生错误。', 'error', this.elements.currentVideoStatus);
            this.updateStatus('检查API密钥时发生错误。', 'error', this.elements.trendingVideosList);
        }
    }

    /**
     * 更新状态消息显示。
     * @param {string} message - 要显示的消息
     * @param {string} type - 消息类型 ('loading', 'success', 'error')
     * @param {HTMLElement} targetElement - 要更新的DOM元素
     */
    updateStatus(message, type, targetElement) {
        targetElement.textContent = message;
        targetElement.className = `status-message ${type}-message`;
    }

    /**
     * 重试发送消息到后台脚本，处理"接收端不存在"错误
     * @param {Object} message - 要发送的消息对象
     * @param {number} maxRetries - 最大重试次数
     * @param {number} delay - 重试之间的延迟（毫秒）
     * @returns {Promise<Object>} - 后台脚本的响应
     */
    async sendMessageWithRetry(message, maxRetries = 3, delay = 500) {
        let lastError = null;
        
        // 添加时间戳，帮助诊断
        const messageWithTimestamp = {
            ...message,
            _timestamp: Date.now()
        };
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`尝试发送消息到后台 (尝试 ${attempt + 1}/${maxRetries + 1})`, messageWithTimestamp);
                
                // 检查扩展上下文是否有效
                if (!chrome || !chrome.runtime) {
                    throw new Error("扩展上下文无效，请重新加载扩展");
                }
                
                const response = await chrome.runtime.sendMessage(messageWithTimestamp);
                console.log(`收到后台响应 (尝试 ${attempt + 1})`, response);
                
                // 如果响应是undefined，可能是后台脚本没有正确响应
                if (response === undefined) {
                    throw new Error("未收到后台响应，可能是服务未准备好");
                }
                
                return response;
            } catch (error) {
                lastError = error;
                console.warn(`消息发送失败 (尝试 ${attempt + 1})`, error);
                
                // 特别处理"接收端不存在"错误
                if (error.message && error.message.includes("Receiving end does not exist")) {
                    console.log(`后台服务未准备好，等待 ${delay}ms 后重试...`);
                    
                    // 如果不是最后一次尝试，则等待后重试
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        // 每次重试增加延迟
                        delay = Math.min(delay * 1.5, 3000); // 最大延迟3秒
                        continue;
                    }
                }
                
                // 如果是其他错误或已达到最大重试次数，则抛出错误
                throw error;
            }
        }
        
        // 这一行通常不会执行，因为循环内部会抛出错误或返回响应
        throw lastError;
    }

    /**
     * 分析当前活动标签页的YouTube视频数据。
     */
    async analyzeCurrentVideo() {
        this.updateStatus('正在获取视频数据...', 'loading', this.elements.currentVideoStatus);
        this.elements.analyzeCurrentVideoButton.disabled = true;
        this.elements.currentVideoData.innerHTML = `<p class="placeholder">正在加载...</p>`;

        try {
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.startsWith('https://www.youtube.com/watch')) { // 已更正
                this.updateStatus('当前不是YouTube视频页面。', 'error', this.elements.currentVideoStatus);
                this.elements.currentVideoData.innerHTML = `<p class="placeholder">请在YouTube视频页面上使用此功能。</p>`;
                return;
            }

            const urlParams = new URLSearchParams(new URL(tab.url).search);
            const videoId = urlParams.get('v');

            if (!videoId) {
                this.updateStatus('无法获取视频ID。', 'error', this.elements.currentVideoStatus);
                this.elements.currentVideoData.innerHTML = `<p class="placeholder">无法识别视频ID。</p>`;
                return;
            }

            // 使用防御性编程处理消息发送和响应
            let response;
            try {
                // 使用重试机制向background script发送消息请求视频数据
                this.updateStatus('正在连接到后台服务...', 'loading', this.elements.currentVideoStatus);
                
                response = await this.sendMessageWithRetry({
                    type: 'GET_VIDEO_DATA',
                    videoId: videoId
                });
                
                // 检查response是否为undefined
                if (response === undefined) {
                    throw new Error("未收到后台服务响应，请确保扩展正常运行");
                }
            } catch (messageError) {
                console.error("Message sending error:", messageError);
                this.displayVideoData(null); // 清空数据
                
                // 提供更友好的错误消息，特别是针对连接问题
                let errorMessage = messageError.message;
                if (messageError.message.includes("Receiving end does not exist")) {
                    errorMessage = "无法连接到后台服务，请尝试重新加载扩展或刷新页面";
                }
                
                this.updateStatus(`通信错误: ${errorMessage}`, 'error', this.elements.currentVideoStatus);
                return;
            }

            // 安全地检查response属性
            if (response && response.success) {
                this.displayVideoData(response.data);
                this.updateStatus('视频数据加载成功！', 'success', this.elements.currentVideoStatus);
            } else {
                this.displayVideoData(null); // 清空数据
                const errorMsg = response && response.error ? response.error : '未知错误';
                this.updateStatus(`错误: ${errorMsg}`, 'error', this.elements.currentVideoStatus);
            }
        } catch (error) {
            console.error("Error analyzing current video:", error);
            this.displayVideoData(null); // 清空数据
            this.updateStatus(`通信错误: ${error.message}`, 'error', this.elements.currentVideoStatus);
        } finally {
            this.elements.analyzeCurrentVideoButton.disabled = false;
        }
    }

    /**
     * 在Popup中显示视频数据。
     * @param {object} data - 视频数据对象
     */
    displayVideoData(data) {
        const videoDataContainer = this.elements.currentVideoData;
        if (!data || !data.snippet || !data.statistics) {
            videoDataContainer.innerHTML = `<p class="placeholder">无数据或数据格式不正确。</p>`;
            return;
        }

        const title = data.snippet.title;
        const channelTitle = data.snippet.channelTitle;
        const publishedAt = new Date(data.snippet.publishedAt).toLocaleDateString();
        const viewCount = parseInt(data.statistics.viewCount || 0).toLocaleString();
        const likeCount = parseInt(data.statistics.likeCount || 0).toLocaleString();
        const commentCount = parseInt(data.statistics.commentCount || 0).toLocaleString();

        let tagsHtml = '';
        if (data.snippet.tags && data.snippet.tags.length > 0) {
            tagsHtml = `
                <div style="margin-top: 10px;">
                    <strong>标签:</strong>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px;">
                        ${data.snippet.tags.map(tag => `<span style="background-color: #e0e0e0; padding: 3px 6px; border-radius: 3px; font-size: 11px;">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        videoDataContainer.innerHTML = `
            <h3>${title}</h3>
            <p><strong>频道:</strong> ${channelTitle}</p>
            <p><strong>发布日期:</strong> ${publishedAt}</p>
            <div style="display: flex; justify-content: space-around; margin: 10px 0; padding: 8px; background-color: #f0f0f0; border-radius: 5px;">
                <div style="text-align: center;">
                    <p style="font-size: 12px; margin: 0;">观看量</p>
                    <p style="font-weight: bold; font-size: 15px; color: #065fd4;">${viewCount}</p>
                </div>
                <div style="text-align: center;">
                    <p style="font-size: 12px; margin: 0;">点赞数</p>
                    <p style="font-weight: bold; font-size: 15px; color: #27ae60;">${likeCount}</p>
                </div>
                <div style="text-align: center;">
                    <p style="font-size: 12px; margin: 0;">评论数</p>
                    <p style="font-weight: bold; font-size: 15px; color: #f39c12;">${commentCount}</p>
                </div>
            </div>
            ${tagsHtml}
        `;
    }

    /**
     * 加载YouTube趋势视频列表。
     */
    async loadTrendingVideos() {
        this.updateStatus('正在加载趋势视频...', 'loading', this.elements.trendingVideosList);
        this.elements.loadTrendingVideosButton.disabled = true;
        this.elements.trendingVideosList.innerHTML = `<p class="placeholder">正在加载...</p>`;

        const regionCode = this.elements.regionSelect.value;
        const category = this.elements.categorySelect.value;

        try {
            // 使用防御性编程处理消息发送和响应
            let response;
            try {
                this.updateStatus('正在连接到后台服务...', 'loading', this.elements.trendingVideosList);
                
                // 使用重试机制向background script发送消息请求趋势视频
                response = await this.sendMessageWithRetry({
                    type: 'GET_TRENDING_VIDEOS',
                    regionCode: regionCode,
                    category: category
                });
                
                // 检查response是否为undefined
                if (response === undefined) {
                    throw new Error("未收到后台服务响应，请确保扩展正常运行");
                }
            } catch (messageError) {
                console.error("Message sending error:", messageError);
                this.displayTrendingVideos([]); // 清空列表
                
                // 提供更友好的错误消息，特别是针对连接问题
                let errorMessage = messageError.message;
                if (messageError.message.includes("Receiving end does not exist")) {
                    errorMessage = "无法连接到后台服务，请尝试重新加载扩展或刷新页面";
                }
                
                this.updateStatus(`通信错误: ${errorMessage}`, 'error', this.elements.trendingVideosList);
                return;
            }

            // 安全地检查response属性
            if (response && response.success && response.data && response.data.length > 0) {
                this.displayTrendingVideos(response.data);
                this.updateStatus('趋势视频加载成功！', 'success', this.elements.trendingVideosList);
            } else {
                this.displayTrendingVideos([]); // 清空列表
                const errorMsg = response && response.error ? response.error : '未知错误或没有可用数据';
                this.updateStatus(`没有找到趋势视频或: ${errorMsg}`, 'error', this.elements.trendingVideosList);
            }
        } catch (error) {
            console.error("Error loading trending videos:", error);
            this.displayTrendingVideos([]); // 清空列表
            this.updateStatus(`通信错误: ${error.message}`, 'error', this.elements.trendingVideosList);
        } finally {
            this.elements.loadTrendingVideosButton.disabled = false;
        }
    }

    /**
     * 在Popup中显示趋势视频列表。
     * @param {object[]} videos - 趋势视频数组
     */
    displayTrendingVideos(videos) {
        const trendingVideosList = this.elements.trendingVideosList;
        if (!videos || videos.length === 0) {
            trendingVideosList.innerHTML = `<p class="placeholder">没有找到趋势视频。</p>`;
            return;
        }

        trendingVideosList.innerHTML = ''; // 清空现有内容

        videos.forEach(video => {
            if (!video.snippet || !video.statistics) return; // 确保数据完整

            const videoId = video.id;
            const title = video.snippet.title;
            const channelTitle = video.snippet.channelTitle;
            const thumbnailUrl = video.snippet.thumbnails.medium ? video.snippet.thumbnails.medium.url : 'https://placehold.co/120x67/cccccc/ffffff?text=NoImg'; // 缩略图
            const viewCount = parseInt(video.statistics.viewCount || 0).toLocaleString();
            const likeCount = parseInt(video.statistics.likeCount || 0).toLocaleString();

            const videoItem = document.createElement('div');
            videoItem.className = 'video-item';
            videoItem.innerHTML = `
                <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" title="${title}"> <img src="${thumbnailUrl}" alt="${title}">
                </a>
                <div class="video-item-details">
                    <h3>
                        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">${title}</a> </h3>
                    <p>${channelTitle}</p>
                    <p class="stats">观看量: ${viewCount} | 点赞数: ${likeCount}</p>
                </div>
            `;
            trendingVideosList.appendChild(videoItem);
        });
    }

    /**
     * 打开扩展的选项页面。
     */
    openOptionsPage() {
        chrome.runtime.openOptionsPage();
    }
}

// 实例化PopupController，启动Popup逻辑
new PopupController();