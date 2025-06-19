class PopupController {
  constructor() {
    this.currentTab = 'current';
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.setupEventListeners();
      this.loadCurrentPageData();
      this.updateStatus('就绪');
    });
  }

  setupEventListeners() {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // 分析当前视频按钮
    document.getElementById('analyzeVideo').addEventListener('click', () => {
      this.analyzeCurrentVideo();
    });

    // 分析频道按钮
    document.getElementById('analyzeChannel').addEventListener('click', () => {
      this.analyzeCurrentChannel();
    });

    // 查看趋势按钮
    document.getElementById('viewTrends').addEventListener('click', () => {
      this.loadTrendingVideos();
    });

    // 搜索趋势按钮
    document.getElementById('searchTrends').addEventListener('click', () => {
      this.searchTrends();
    });

    // 工具按钮
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('compareVideos').addEventListener('click', () => {
      this.compareVideos();
    });

    document.getElementById('keywordAnalysis').addEventListener('click', () => {
      this.keywordAnalysis();
    });

    // 设置按钮
    document.getElementById('openSettings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  switchTab(tabName) {
    // 更新标签按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    this.currentTab = tabName;
  }

  updateStatus(message, type = 'ready') {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    
    statusText.textContent = message;
    
    statusDot.className = 'status-dot';
    if (type === 'loading') {
      statusDot.style.background = '#ffc107';
    } else if (type === 'error') {
      statusDot.style.background = '#dc3545';
    } else {
      statusDot.style.background = '#28a745';
    }
  }

  async loadCurrentPageData() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url.includes('youtube.com/watch')) {
        const videoId = this.extractVideoId(tab.url);
        if (videoId) {
          this.showQuickPreview('video', videoId);
        }
      } else if (tab.url.includes('youtube.com/channel') || tab.url.includes('youtube.com/c/') || tab.url.includes('youtube.com/@')) {
        const channelId = this.extractChannelId(tab.url);
        if (channelId) {
          this.showQuickPreview('channel', channelId);
        }
      } else {
        this.showMessage('请在YouTube页面使用此插件');
      }
    } catch (error) {
      this.showError('无法获取当前页面信息');
    }
  }

  showQuickPreview(type, id) {
    const container = document.getElementById('dataContainer');
    container.innerHTML = `
      <div class="quick-preview">
        <div class="preview-header">
          <span class="preview-icon">${type === 'video' ? '🎬' : '📺'}</span>
          <span class="preview-text">检测到 ${type === 'video' ? 'YouTube视频' : 'YouTube频道'}</span>
        </div>
        <p class="preview-hint">点击上方按钮开始分析</p>
      </div>
    `;
  }

  showMessage(message) {
    const container = document.getElementById('dataContainer');
    container.innerHTML = `
      <div class="placeholder">
        <span class="placeholder-icon">ℹ️</span>
        <p>${message}</p>
      </div>
    `;
  }

  extractVideoId(url) {
    const match = url.match(/[?&]v=([^&#]+)/);
    return match ? match[1] : null;
  }

  extractChannelId(url) {
    // 提取频道ID的逻辑
    let match = url.match(/channel\/([^\/]+)/);
    if (match) return match[1];
    
    match = url.match(/\/c\/([^\/]+)/);
    if (match) return match[1];
    
    match = url.match(/\/@([^\/]+)/);
    if (match) return match[1];
    
    return null;
  }

  async analyzeCurrentVideo() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const videoId = this.extractVideoId(tab.url);
    
    if (!videoId) {
      this.showError('请在YouTube视频页面使用此功能');
      return;
    }

    this.showLoading('正在分析视频数据...');
    this.updateStatus('分析中...', 'loading');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getVideoData',
        videoId: videoId
      });

      if (response.success) {
        this.displayVideoData(response.data);
        this.updateStatus('分析完成');
      } else {
        this.showError(response.error);
        this.updateStatus('分析失败', 'error');
      }
    } catch (error) {
      this.showError('分析失败：' + error.message);
      this.updateStatus('分析失败', 'error');
    }
  }

  async analyzeCurrentChannel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const channelId = this.extractChannelId(tab.url);
    
    if (!channelId) {
      this.showError('请在YouTube频道页面使用此功能');
      return;
    }

    this.showLoading('正在分析频道数据...');
    this.updateStatus('分析中...', 'loading');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getChannelData',
        channelId: channelId
      });

      if (response.success) {
        this.displayChannelData(response.data);
        this.updateStatus('分析完成');
      } else {
        this.showError(response.error);
        this.updateStatus('分析失败', 'error');
      }
    } catch (error) {
      this.showError('分析失败：' + error.message);
      this.updateStatus('分析失败', 'error');
    }
  }

  async loadTrendingVideos() {
    this.showTrendsLoading('获取热门视频...');
    this.updateStatus('获取中...', 'loading');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTrendingVideos'
      });

      if (response.success) {
        this.displayTrendingVideos(response.data);
        this.updateStatus('获取完成');
      } else {
        this.showTrendsError(response.error);
        this.updateStatus('获取失败', 'error');
      }
    } catch (error) {
      this.showTrendsError('获取失败：' + error.message);
      this.updateStatus('获取失败', 'error');
    }
  }

  async searchTrends() {
    // 这里可以添加搜索特定关键词的趋势功能
    this.showTrendsMessage('搜索趋势功能开发中...');
  }

  displayVideoData(data) {
    const container = document.getElementById('dataContainer');
    container.innerHTML = `
      <div class="video-analysis">
        <h3>${data.title}</h3>
        <div class="channel-info">
          <span class="channel-name">频道: ${data.channelTitle}</span>
          <span class="publish-date">发布: ${new Date(data.publishedAt).toLocaleDateString()}</span>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">观看次数</span>
            <span class="stat-value">${this.formatNumber(data.viewCount)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">点赞数</span>
            <span class="stat-value">${this.formatNumber(data.likeCount)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">评论数</span>
            <span class="stat-value">${this.formatNumber(data.commentCount)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">互动率</span>
            <span class="stat-value">${this.calculateEngagementRate(data)}%</span>
          </div>
        </div>
        ${data.tags && data.tags.length > 0 ? `
          <div class="tags-section">
            <h4>标签</h4>
            <div class="tags">
              ${data.tags.slice(0, 10).map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  displayChannelData(data) {
    const container = document.getElementById('dataContainer');
    container.innerHTML = `
      <div class="channel-analysis">
        <h3>${data.title}</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">订阅者</span>
            <span class="stat-value">${this.formatNumber(data.subscriberCount)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总观看</span>
            <span class="stat-value">${this.formatNumber(data.viewCount)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">视频数</span>
            <span class="stat-value">${this.formatNumber(data.videoCount)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均观看</span>
            <span class="stat-value">${this.formatNumber(Math.round(data.viewCount / data.videoCount))}</span>
          </div>
        </div>
      </div>
    `;