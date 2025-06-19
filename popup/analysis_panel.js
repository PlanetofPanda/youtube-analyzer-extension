// popup/analysis_panel.js

/**
 * AnalysisPanelController 类管理 iframe 内部的 UI 显示逻辑。
 * 它监听来自父窗口（content script）的消息，并渲染接收到的数据。
 */
class AnalysisPanelController {
    constructor() {
        this.panelContentDiv = document.getElementById('panelContent');
        this.closeButton = document.getElementById('closePanelButton');
        this.initEventListeners();
        console.log("Analysis Panel: Controller initialized, listening for messages from parent.");
    }

    /**
     * 初始化事件监听器。
     */
    initEventListeners() {
        // 监听来自父窗口（content script）的消息
        window.addEventListener('message', this.handleMessage.bind(this));
        // 关闭按钮的点击事件
        this.closeButton.addEventListener('click', () => this.closePanel());
    }

    /**
     * 处理来自父窗口的消息。
     * @param {MessageEvent} event - 消息事件对象
     */
    handleMessage(event) {
        // 检查消息来源，确保是来自我们的 Chrome 扩展程序
        // Chrome 扩展的 origin 格式为 chrome-extension://<EXTENSION_ID>
        const expectedOriginPrefix = 'chrome-extension://';
        if (!event.origin.startsWith(expectedOriginPrefix)) {
            console.warn("Analysis Panel: Message received from unexpected origin:", event.origin);
            return;
        }

        const { type, data, message } = event.data;
        console.log("Analysis Panel: Received message from parent:", type, data || message);

        switch (type) {
            case 'LOADING':
                this.displayStatus(message, 'loading');
                break;
            case 'ERROR':
                this.displayStatus(message, 'error');
                break;
            case 'VIDEO_DATA':
                this.displayVideoData(data);
                break;
            case 'CHANNEL_DATA':
                this.displayChannelData(data);
                break;
            default:
                console.warn("Analysis Panel: Unknown message type:", type);
                this.displayStatus("未知数据类型。", 'error');
                break;
        }
    }

    /**
     * 显示状态消息（加载中、错误）。
     * @param {string} msg - 消息文本
     * @param {string} type - 消息类型 ('loading', 'error')
     */
    displayStatus(msg, type) {
        let className = '';
        if (type === 'loading') {
            className = 'loading-message';
        } else if (type === 'error') {
            className = 'error-message';
        }
        this.panelContentDiv.innerHTML = `<p class="placeholder ${className}">${msg}</p>`;
    }

    /**
     * 在面板中显示视频数据。
     * @param {object} data - 视频数据对象
     */
    displayVideoData(data) {
        if (!data || !data.snippet || !data.statistics) {
            this.displayStatus("无效的视频数据。", "error");
            return;
        }

        const title = data.snippet.title;
        const description = data.snippet.description;
        const publishedAt = new Date(data.snippet.publishedAt).toLocaleDateString();
        const viewCount = parseInt(data.statistics.viewCount || 0).toLocaleString();
        const likeCount = parseInt(data.statistics.likeCount || 0).toLocaleString();
        const commentCount = parseInt(data.statistics.commentCount || 0).toLocaleString();

        let tagsHtml = '';
        if (data.snippet.tags && data.snippet.tags.length > 0) {
            tagsHtml = `
                <div class="tags-container">
                    <h4>标签:</h4>
                    <div class="tags-list">
                        ${data.snippet.tags.map(tag => `<span class="tag-item">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        const htmlContent = `
            <h3>视频分析</h3>
            <h4>${title}</h4>
            <p style="font-size: 13px; color: #666; margin-bottom: 10px;">发布日期: ${publishedAt}</p>
            <div class="stats-grid">
                <div class="stats-item">
                    <p class="label">观看量</p>
                    <p class="value value-blue">${viewCount}</p>
                </div>
                <div class="stats-item">
                    <p class="label">点赞数</p>
                    <p class="value value-green">${likeCount}</p>
                </div>
                <div class="stats-item">
                    <p class="label">评论数</p>
                    <p class="value value-orange">${commentCount}</p>
                </div>
            </div>
            <p style="font-size: 14px; color: #555; line-height: 1.6; max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 10px; border-radius: 4px; background-color: #fff;">
                <strong>描述:</strong><br>${this.truncateDescription(description, 200)}
            </p>
            ${tagsHtml}
            <p style="font-size: 12px; color: #888; margin-top: 20px;">数据来自YouTube Data API。</p>
        `;
        this.panelContentDiv.innerHTML = htmlContent;
    }

    /**
     * 在面板中显示频道数据。
     * @param {object} data - 频道数据对象
     */
    displayChannelData(data) {
        if (!data || !data.snippet || !data.statistics) {
            this.displayStatus("无效的频道数据。", "error");
            return;
        }

        const title = data.snippet.title;
        const description = data.snippet.description;
        const publishedAt = new Date(data.snippet.publishedAt).toLocaleDateString();
        const subscriberCount = parseInt(data.statistics.subscriberCount || 0).toLocaleString();
        const viewCount = parseInt(data.statistics.viewCount || 0).toLocaleString();
        const videoCount = parseInt(data.statistics.videoCount || 0).toLocaleString();
        const channelThumbnail = data.snippet.thumbnails.default ? data.snippet.thumbnails.default.url : 'https://placehold.co/48x48/cccccc/ffffff?text=NoImg';

        const htmlContent = `
            <h3>频道分析</h3>
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <img src="${channelThumbnail}" alt="Channel Thumbnail" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 1px solid #eee;">
                <div>
                    <h4 style="margin: 0; color: #444;">${title}</h4>
                    <p style="font-size: 13px; color: #666; margin: 5px 0 0;">创建日期: ${publishedAt}</p>
                </div>
            </div>
            <div class="stats-grid">
                <div class="stats-item">
                    <p class="label">订阅者</p>
                    <p class="value value-blue">${subscriberCount}</p>
                </div>
                <div class="stats-item">
                    <p class="label">总观看量</p>
                    <p class="value value-green">${viewCount}</p>
                </div>
                <div class="stats-item">
                    <p class="label">视频数</p>
                    <p class="value value-orange">${videoCount}</p>
                </div>
            </div>
            <p style="font-size: 14px; color: #555; line-height: 1.6; max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 10px; border-radius: 4px; background-color: #fff;">
                <strong>描述:</strong><br>${this.truncateDescription(description, 200)}
            </p>
            <p style="font-size: 12px; color: #888; margin-top: 20px;">数据来自YouTube Data API。</p>
        `;
        this.panelContentDiv.innerHTML = htmlContent;
    }

    /**
     * 截断描述文本以适应面板空间。
     * @param {string} description - 完整描述文本
     * @param {number} maxLength - 最大长度
     * @returns {string} 截断后的文本
     */
    truncateDescription(description, maxLength) {
        if (!description) return '无描述。';
        if (description.length > maxLength) {
            return description.substring(0, maxLength) + '...';
        }
        return description;
    }

    /**
     * 关闭面板（通过向父窗口发送消息）。
     */
    closePanel() {
        // 向父窗口（content script）发送消息，让它隐藏 iframe
        console.log("Analysis Panel: Sending 'CLOSE_PANEL' message to parent.");
        // 注意：targetOrigin 必须是父窗口的 origin，即当前 YouTube 页面本身的 origin
        // 但为了安全和通用性，我们直接用 chrome.runtime.getURL('') 作为消息源
        // 并在父窗口中检查 event.source。这里不指定 targetOrigin 留空或设为 '*' 会更简单，
        // 但在父窗口精确检查 event.source 才是关键。
        window.parent.postMessage({ type: 'CLOSE_PANEL' }, chrome.runtime.getURL(''));
    }
}

// 实例化 AnalysisPanelController
new AnalysisPanelController();
