class PopupController {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.setupEventListeners();
      this.loadCurrentPageData();
    });
  }

  setupEventListeners() {
    // 分析当前视频按钮
    document.getElementById('analyzeVideo').addEventListener('click', () => {
      this.analyzeCurrentVideo();
    });

    // 查看趋势按钮
    document.getElementById('viewTrends').addEventListener('click', () => {
      this.loadTrendingVideos();
    });

    // 设置按钮
    document.getElementById('openSettings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async loadCurrentPageData() {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url.includes('youtube.com/watch')) {
        const videoId = this.extractVideoId(tab.url);
        if (videoId) {
          this.showVideoAnalysis(videoId);
        }
      } else if (tab.url.includes('youtube.com/channel') || tab.url.includes('youtube.com/c/')) {
        const channelId = this.extractChannelId(tab.url);
        if (channelId) {
          this.showChannelAnalysis(channelId);
        }
      }
    } catch (error) {
      this.showError('无法获取当前页面信息');
    }
  }

  extractVideoId(url) {
    const match = url.match(/[?&]v=([^&#]+)/);
    return match ? match[1] : null;
  }

  extractChannelId(url) {
    // 简化的频道ID提取，实际可能需要更复杂的逻辑
    const match = url.match(/channel\/([^\/]+)|\/c\/([^\/]+)/);
    return match ? (match[1] || match[2]) : null;
  }

  async analyzeCurrentVideo() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const videoId = this.extractVideoId(tab.url);
    
    if (!videoId) {
      this.showError('请在YouTube视频页面使用此功能');
      return;
    }

    this.showLoading('正在分析视频数据...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getVideoData',
        videoId: videoId
      });

      if (response.success) {
        this.displayVideoData(response.data);
      } else {
        this.showError(response.error);
      }
    } catch (error) {
      this.showError('分析失败：' + error.message);
    }
  }

  async loadTrendingVideos() {
    this.showLoading('获取热门视频...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTrendingVideos'
      });

      if (response.success) {
        this.displayTrendingVideos(response.data);
      } else {
        this.showError(response.error);
      }
    } catch (error) {
      this.showError('获取失败：' + error.message);
    }
  }

  displayVideoData(data) {
    const container = document.getElementById('dataContainer');
    container.innerHTML = `
      <div class="video-analysis">
        <h3>${data.title}</h3>
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
        </div>
        ${data.tags.length > 0 ? `
          <div class="tags-section">
            <h4>标签</h4>
            <div class="tags">
              ${data.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  displayTrendingVideos(videos) {
    const container = document.getElementById('dataContainer');
    container.innerHTML = `
      <div class="trending-videos">
        <h3>热门视频</h3>
        ${videos.map((video, index) => `
          <div class="video-item">
            <span class="rank">#${index + 1}</span>
            <div class="video-info">
              <div class="video-title">${video.title}</div>
              <div class="video-stats">
                ${this.formatNumber(video.viewCount)} 次观看
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  showLoading(message) {
    document.getElementById('dataContainer').innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }

  showError(message) {
    document.getElementById('dataContainer').innerHTML = `
      <div class="error">
        <p>错误: ${message}</p>
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

// 初始化弹窗控制器
new PopupController();