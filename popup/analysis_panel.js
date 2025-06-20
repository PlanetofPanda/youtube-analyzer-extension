// popup/analysis_panel.js
import contextUtils from '../libs/context-utils.js';

/**
 * AnalysisPanelController 类管理 iframe 内部的 UI 显示逻辑。
 * 它监听来自父窗口（content script）的消息，并渲染接收到的数据。
 * 现在使用contextUtils库来增强上下文安全性。
 */
class AnalysisPanelController {
    constructor() {
        this.panelContentDiv = document.getElementById('panelContent');
        this.closeButton = document.getElementById('closePanelButton');
        this.messageListener = null;
        this.contextValidator = null;
        
        // 首先验证扩展上下文是否有效
        if (!contextUtils.isExtensionContextValid()) {
            this.displayStatus("扩展上下文无效，请刷新页面或重新加载扩展。", "error");
            console.error("Analysis Panel: Extension context is invalid during initialization.");
            return;
        }
        
        this.initEventListeners();
        console.log("Analysis Panel: Controller initialized, listening for messages from parent.");
        
        // 设置定期上下文验证，当上下文变为无效时进行处理
        this.setupContextValidation();
    }

    /**
     * 设置定期上下文验证
     */
    setupContextValidation() {
        this.contextValidator = contextUtils.createContextValidator(() => {
            console.warn("Analysis Panel: Extension context became invalid, cleaning up resources.");
            this.displayStatus("扩展上下文已失效，请刷新页面或重启扩展。", "error");
            
            // 移除事件监听器，防止产生更多错误
            if (this.messageListener) {
                this.messageListener.remove();
                this.messageListener = null;
            }
            
            // 清除定时器本身
            if (this.contextValidator) {
                clearInterval(this.contextValidator);
                this.contextValidator = null;
            }
        }, 3000); // 每3秒检查一次
    }

    /**
     * 初始化事件监听器。
     */
    initEventListeners() {
        // 使用安全的事件监听器添加方法
        this.messageListener = contextUtils.addSafeEventListener(
            window, 
            'message', 
            this.handleMessage.bind(this)
        );

        // 关闭按钮的点击事件
        this.closeButton.addEventListener('click', () => this.closePanel());
    }

    /**
     * 处理来自父窗口的消息。
     * @param {MessageEvent} event - 消息事件对象
     */
    handleMessage(event) {
        try {
            // 检查消息来源，确保是来自我们的 Chrome 扩展程序
            // Chrome 扩展的 origin 格式为 chrome-extension://<EXTENSION_ID>
            const expectedOriginPrefix = 'chrome-extension://';
            if (!event.origin.startsWith(expectedOriginPrefix)) {
                console.warn("Analysis Panel: Message received from unexpected origin:", event.origin);
                return;
            }

            // 安全地提取数据
            let type, data, messageContent;
            try {
                ({ type, data, message: messageContent } = event.data);
            } catch (e) {
                console.warn("Analysis Panel: Error extracting message data:", e);
                return;
            }

            console.log("Analysis Panel: Received message from parent:", type, data || messageContent);

            // 处理各种消息类型
            switch (type) {
                case 'LOADING':
                    this.displayStatus(messageContent, 'loading');
                    break;
                case 'ERROR':
                    this.displayStatus(messageContent, 'error');
                    break;
                case 'VIDEO_DATA':
                    this.displayVideoData(data);
                    break;
                case 'CHANNEL_DATA':
                    this.displayChannelData(data);
                    break;
                case 'ENHANCED_VIDEO_DATA':
                    this.displayEnhancedVideoData(data);
                    break;
                case 'ENHANCED_CHANNEL_DATA':
                    this.displayEnhancedChannelData(data);
                    break;
                default:
                    console.warn("Analysis Panel: Unknown message type:", type);
                    this.displayStatus("未知数据类型。", 'error');
                    break;
            }
        } catch (e) {
            // 捕获任何可能的错误，防止脚本崩溃
            console.error("Analysis Panel: Critical error in handleMessage:", e);
            this.displayStatus("处理消息时发生错误。", "error");
            
            // 如果错误是由于上下文无效引起的，执行清理
            if (e.message && (
                e.message.includes("Extension context invalidated") ||
                e.message.includes("Cannot read properties of undefined") ||
                e.message.includes("chrome is not defined")
            )) {
                this.handleInvalidContext();
            }
        }
    }

    /**
     * 处理无效上下文情况
     */
    handleInvalidContext() {
        console.warn("Analysis Panel: Detected invalid context, cleaning up...");
        
        // 移除事件监听器
        if (this.messageListener) {
            this.messageListener.remove();
            this.messageListener = null;
        }
        
        // 清除上下文验证定时器
        if (this.contextValidator) {
            clearInterval(this.contextValidator);
            this.contextValidator = null;
        }
        
        // 显示错误消息
        this.displayStatus("扩展上下文已失效，请刷新页面或重启扩展。", "error");
    }

    /**
     * 显示状态消息（加载中、错误）。
     * @param {string} msg - 消息文本
     * @param {string} type - 消息类型 ('loading', 'error')
     */
    displayStatus(msg, type) {
        if (!this.panelContentDiv) return;
        
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
        if (!this.panelContentDiv) return;
        
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
     * 在面板中显示增强的视频数据。
     * @param {object} data - 包含原始数据和分析结果的增强视频数据对象
     */
    displayEnhancedVideoData(data) {
        if (!this.panelContentDiv) return;
        
        if (!data || !data.rawData || !data.rawData.snippet) {
            this.displayStatus("无效的视频数据。", "error");
            return;
        }

        // 使用原始数据的基本显示
        this.displayVideoData(data.rawData);

        // 添加增强的分析内容
        const videoData = data.rawData;
        const kpis = data.kpis || {};
        const tagAnalysis = data.tagAnalysis || {};
        const titleAnalysis = data.titleAnalysis || {};
        const descriptionAnalysis = data.descriptionAnalysis || {};
        
        // 从这里开始，使用增强的数据添加更丰富的内容
        // 这部分会根据实际的数据处理库输出格式进行调整
        
        // 示例：添加性能评分和建议
        let enhancedContent = `
            <div class="analysis-section">
                <h4>性能分析</h4>
                <div class="performance-score">
                    <div class="score-circle" style="background: conic-gradient(#4CAF50 ${(kpis.performanceScore || 0) * 3.6}deg, #f0f0f0 0deg);">
                        <span>${Math.round(kpis.performanceScore || 0)}</span>
                    </div>
                    <div class="score-details">
                        <p>整体表现评分</p>
                        <p class="score-description">${this.getPerformanceDescription(kpis.performanceScore || 0)}</p>
                    </div>
                </div>
                
                <div class="metrics-container">
                    <div class="metric-item">
                        <span class="metric-label">观众留存率</span>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${kpis.retentionRate || 0}%;"></div>
                        </div>
                        <span class="metric-value">${kpis.retentionRate || 0}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">互动率</span>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${kpis.engagementRate || 0}%;"></div>
                        </div>
                        <span class="metric-value">${kpis.engagementRate || 0}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">点赞/观看比</span>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${(kpis.likeToViewRatio || 0) * 100}%;"></div>
                        </div>
                        <span class="metric-value">${((kpis.likeToViewRatio || 0) * 100).toFixed(2)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h4>优化建议</h4>
                <div class="suggestions-list">
                    ${this.generateSuggestionsList(titleAnalysis, tagAnalysis, descriptionAnalysis)}
                </div>
            </div>
        `;
        
        // 将增强内容附加到面板
        this.panelContentDiv.innerHTML += enhancedContent;
    }

    /**
     * 生成优化建议列表
     */
    generateSuggestionsList(titleAnalysis, tagAnalysis, descriptionAnalysis) {
        const suggestions = [];
        
        // 标题建议
        if (titleAnalysis) {
            if (titleAnalysis.length < 40) {
                suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">📏</span> 标题较短 (${titleAnalysis.length}字符)，建议扩展到40-60字符以提高SEO。</div>`);
            }
            if (titleAnalysis.keywords && titleAnalysis.keywords.length > 0) {
                suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">🔑</span> 标题中检测到的关键词: ${titleAnalysis.keywords.join(', ')}。</div>`);
            }
        }
        
        // 标签建议
        if (tagAnalysis) {
            if (tagAnalysis.count < 10) {
                suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">🏷️</span> 标签数量较少 (${tagAnalysis.count})，建议使用10-15个相关标签。</div>`);
            }
            if (tagAnalysis.popular && tagAnalysis.popular.length > 0) {
                suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">⭐</span> 热门标签: ${tagAnalysis.popular.join(', ')}。</div>`);
            }
        }
        
        // 描述建议
        if (descriptionAnalysis) {
            if (descriptionAnalysis.length < 200) {
                suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">📋</span> 描述较短 (${descriptionAnalysis.length}字符)，建议扩展到至少200字符。</div>`);
            }
            if (!descriptionAnalysis.hasLinks && descriptionAnalysis.length > 0) {
                suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">🔗</span> 描述中未检测到链接，添加相关链接可提高用户互动。</div>`);
            }
        }
        
        // 如果没有建议
        if (suggestions.length === 0) {
            suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">👍</span> 您的视频设置已经很好了！继续保持。</div>`);
        }
        
        return suggestions.join('');
    }

    /**
     * 根据性能评分返回描述文本
     */
    getPerformanceDescription(score) {
        if (score >= 90) return "优秀";
        if (score >= 70) return "良好";
        if (score >= 50) return "一般";
        if (score >= 30) return "需改进";
        return "较差";
    }

    /**
     * 在面板中显示频道数据。
     * @param {object} data - 频道数据对象
     */
    displayChannelData(data) {
        if (!this.panelContentDiv) return;
        
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
     * 在面板中显示增强的频道数据。
     * @param {object} data - 包含原始数据和分析结果的增强频道数据对象
     */
    displayEnhancedChannelData(data) {
        if (!this.panelContentDiv) return;
        
        if (!data || !data.rawData || !data.rawData.snippet) {
            this.displayStatus("无效的频道数据。", "error");
            return;
        }

        // 使用原始数据的基本显示
        this.displayChannelData(data.rawData);

        // 添加增强的分析内容
        const channelData = data.rawData;
        const kpis = data.kpis || {};
        
        // 示例：添加频道性能分析
        let enhancedContent = `
            <div class="analysis-section">
                <h4>频道性能</h4>
                <div class="performance-score">
                    <div class="score-circle" style="background: conic-gradient(#4CAF50 ${(kpis.channelScore || 0) * 3.6}deg, #f0f0f0 0deg);">
                        <span>${Math.round(kpis.channelScore || 0)}</span>
                    </div>
                    <div class="score-details">
                        <p>频道整体评分</p>
                        <p class="score-description">${this.getPerformanceDescription(kpis.channelScore || 0)}</p>
                    </div>
                </div>
                
                <div class="metrics-container">
                    <div class="metric-item">
                        <span class="metric-label">平均视频播放量</span>
                        <span class="metric-value">${kpis.avgViewsPerVideo?.toLocaleString() || 0}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">订阅者转化率</span>
                        <span class="metric-value">${kpis.subscriberConversionRate || 0}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">月均增长率</span>
                        <span class="metric-value">${kpis.monthlyGrowthRate || 0}%</span>
                    </div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h4>增长预测</h4>
                <div class="growth-forecast">
                    <div class="forecast-item">
                        <span class="forecast-label">30天内预计增长</span>
                        <span class="forecast-value">+${kpis.projectedSubsIn30Days || 0} 订阅者</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">90天内预计增长</span>
                        <span class="forecast-value">+${kpis.projectedSubsIn90Days || 0} 订阅者</span>
                    </div>
                </div>
            </div>
            
            <div class="analysis-section">
                <h4>频道优化建议</h4>
                <div class="suggestions-list">
                    ${this.generateChannelSuggestions(kpis)}
                </div>
            </div>
        `;
        
        // 将增强内容附加到面板
        this.panelContentDiv.innerHTML += enhancedContent;
    }

    /**
     * 生成频道优化建议
     */
    generateChannelSuggestions(kpis) {
        const suggestions = [];
        
        // 根据KPI生成建议
        if (kpis.uploadFrequency < 1) {
            suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">📅</span> 上传频率较低 (${kpis.uploadFrequency.toFixed(2)}次/周)，增加上传频率可提高频道曝光。</div>`);
        }
        
        if (kpis.viewsToSubsRatio < 0.1) {
            suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">👁️</span> 观看量与订阅者比例较低，考虑优化视频标题和缩略图以增加点击率。</div>`);
        }
        
        if (kpis.commentEngagementRate < 0.5) {
            suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">💬</span> 评论互动率较低，在视频中鼓励观众留言可提高互动。</div>`);
        }
        
        // 如果没有建议
        if (suggestions.length === 0) {
            suggestions.push(`<div class="suggestion-item"><span class="suggestion-icon">🌟</span> 您的频道表现出色！继续保持当前的内容策略。</div>`);
        }
        
        return suggestions.join('');
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
        // 使用安全的postMessage方法
        const success = contextUtils.safePostMessage(
            window.parent, 
            { type: 'CLOSE_PANEL' }, 
            contextUtils.safeGetExtensionUrl('') || '*'
        );
        
        if (success) {
            console.log("Analysis Panel: 'CLOSE_PANEL' message sent to parent.");
        } else {
            console.warn("Analysis Panel: Failed to send 'CLOSE_PANEL' message. Extension context may be invalid.");
            
            // 如果发送失败，也许可以尝试一些备用方法，例如用户提示
            this.displayStatus("无法关闭面板。请刷新页面或重启扩展。", "error");
        }
    }
}

// 确保上下文有效后再实例化控制器
if (contextUtils.isExtensionContextValid()) {
    // 实例化 AnalysisPanelController
    new AnalysisPanelController();
} else {
    console.error("Analysis Panel: Cannot initialize. Extension context is invalid.");
    // 显示错误消息
    document.getElementById('panelContent').innerHTML = 
        `<p class="placeholder error-message">扩展上下文无效，请刷新页面或重新加载扩展。</p>`;
}