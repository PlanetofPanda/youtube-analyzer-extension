class YouTubeContentScript {
  constructor() {
    this.init();
  }

  init() {
    // 等待页面加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.setupPageAnalysis();
      });
    } else {
      this.setupPageAnalysis();
    }

    // 监听URL变化（YouTube是单页应用）
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => this.setupPageAnalysis(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  setupPageAnalysis() {
    if (this.isVideoPage()) {
      this.addVideoAnalysisButton();
    } else if (this.isChannelPage()) {
      this.addChannelAnalysisButton();
    }
  }

  isVideoPage() {
    return location.pathname === '/watch';
  }

  isChannelPage() {
    return location.pathname.includes('/channel/') || 
           location.pathname.includes('/c/') || 
           location.pathname.includes('/@');
  }

  addVideoAnalysisButton() {
    // 检查是否已经添加了按钮
    if (document.getElementById('yt-analyzer-btn')) return;

    // 查找视频操作按钮区域
    const actionsContainer = document.querySelector('#actions-inner');
    if (!actionsContainer) return;

    // 创建分析按钮
    const analyzeBtn = document.createElement('button');
    analyzeBtn.id = 'yt-analyzer-btn';
    analyzeBtn.className = 'yt-analyzer-button';
    analyzeBtn.innerHTML = '📊 数据分析';
    analyzeBtn.style.cssText = `
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      margin-left: 8px;
      cursor: pointer;
      font-size: 14px;
    `;

    analyzeBtn.addEventListener('click', () => {
      this.showVideoAnalysis();
    });

    actionsContainer.appendChild(analyzeBtn);
  }

  addChannelAnalysisButton() {
    // 类似的逻辑，为频道页面添加分析按钮
    if (document.getElementById('yt-channel-analyzer-btn')) return;

    const headerContainer = document.querySelector('#channel-header-container');
    if (!headerContainer) return;

    const analyzeBtn = document.createElement('button');
    analyzeBtn.id = 'yt-channel-analyzer-btn';
    analyzeBtn.className = 'yt-analyzer-button';
    analyzeBtn.innerHTML = '📈 频道分析';
    analyzeBtn.style.cssText = `
      background: #ff4444;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      margin: 8px;
      cursor: pointer;
      font-size: 14px;
    `;

    analyzeBtn.addEventListener('click', () => {
      this.showChannelAnalysis();
    });

    headerContainer.appendChild(analyzeBtn);
  }

  async showVideoAnalysis() {
    const videoId = new URLSearchParams(location.search).get('v');
    if (!videoId) return;

    // 创建分析面板
    this.createAnalysisPanel('正在分析视频数据...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getVideoData',
        videoId: videoId
      });

      if (response.success) {
        this.updateAnalysisPanel(this.formatVideoAnalysis(response.data));
      } else {
        this.updateAnalysisPanel(`<div class="error">分析失败: ${response.error}</div>`);
      }
    } catch (error) {
      this.updateAnalysisPanel(`<div class="error">分析失败: ${error.message}</div>`);
    }
  }

  createAnalysisPanel(content) {
    // 移除已存在的面板
    const existingPanel = document.getElementById('yt-analysis-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'yt-analysis-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      font-family: Arial, sans-serif;
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #333;">视频分析</h3>
        <button onclick="this.parentElement.parentElement.remove()" style="border: none; background: none; font-size: 18px; cursor: pointer;">×</button>
      </div>
      <div id="analysis-content">${content}</div>
    `;

    document.body.appendChild(panel);
  }

  updateAnalysisPanel(content) {
    const contentDiv = document.getElementById('analysis-content');
    if (contentDiv) {
      contentDiv.innerHTML = content;
    }
  }

  formatVideoAnalysis(data) {
    return `
      <div class="video-analysis">
        <h4 style="margin: 0 0 8px 0; color: #333;">${data.title}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
          <div style="text-align: center; padding: 8px; background: #f5f5f5; border-radius: 4px;">
            <div style="font-weight: bold; color: #666;">观看次数</div>
            <div style="font-size: 14px; color: #333;">${this.formatNumber(data.viewCount)}</div>
          </div>
          <div style="text-align: center; padding: 8px; background: #f5f5f5; border-radius: 4px;">
            <div style="font-weight: bold; color: #666;">点赞数</div>
            <div style="font-size: 14px; color: #333;">${this.formatNumber(data.likeCount)}</div>
          </div>
        </div>
        <div style="font-size: 12px; color: #666;">
          发布时间: ${new Date(data.publishedAt).toLocaleDateString()}
        </div>
      </div>
    `;
  }

  formatNumber(num) {
    if (!num) return '0';
    const number = parseInt(num);
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + 'M';
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + 'K';
    }
    return number.toLocaleString();
  }
}

// 初始化内容脚本
new YouTubeContentScript();