class OptionsController {
  constructor() {
    this.settings = {
      youtube_api_key: '',
      auto_analyze: true,
      collect_comments: false,
      cache_time: 5,
      theme: 'auto',
      language: 'zh-CN'
    };
    
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.loadSettings();
      this.setupEventListeners();
      this.updateStatus();
    });
  }

  setupEventListeners() {
    // API 密钥显示/隐藏
    document.getElementById('toggleApiKey').addEventListener('click', () => {
      this.toggleApiKeyVisibility();
    });

    // 测试连接
    document.getElementById('testConnection').addEventListener('click', () => {
      this.