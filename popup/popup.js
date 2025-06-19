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
            const result = await chrome.storage.sync.get('youtubeApiKey');
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
     * 分析当前活动标签页的YouTube视频数据。
     */
    async analyzeCurrentVideo() {
        this.updateStatus('正在获取视频数据...', 'loading', this.elements.currentVideoStatus);
        this.elements.analyzeCurrentVideoButton.disabled = true;
        this.elements.currentVideoData.innerHTML = `<p class="placeholder">正在加载...</p>`;

        try {
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.startsWith('https://www.youtube.com/watch')) {
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

            // 向background script发送消息请求视频数据
            const response = await chrome.runtime.sendMessage({
                type: 'GET_VIDEO_DATA',
                videoId: videoId
            });

            if (response.success) {
                this.displayVideoData(response.data);
                this.updateStatus('视频数据加载成功！', 'success', this.elements.currentVideoStatus);
            } else {
                this.displayVideoData(null); // 清空数据
                this.updateStatus(`错误: ${response.error}`, 'error', this.elements.currentVideoStatus);
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
            const response = await chrome.runtime.sendMessage({
                type: 'GET_TRENDING_VIDEOS',
                regionCode: regionCode,
                category: category
            });

            if (response.success && response.data && response.data.length > 0) {
                this.displayTrendingVideos(response.data);
                this.updateStatus('趋势视频加载成功！', 'success', this.elements.trendingVideosList);
            } else {
                this.displayTrendingVideos([]); // 清空列表
                this.updateStatus(`没有找到趋势视频或: ${response.error || '未知错误'}`, 'error', this.elements.trendingVideosList);
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
                <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" title="${title}">
                    <img src="${thumbnailUrl}" alt="${title}">
                </a>
                <div class="video-item-details">
                    <h3>
                        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">${title}</a>
                    </h3>
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

