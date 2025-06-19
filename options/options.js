// options/options.js

/**
 * OptionsController类管理扩展选项页面的UI交互、
 * 设置的加载、保存、测试连接、清除缓存和重置功能。
 */
class OptionsController {
    constructor() {
        this.elements = {
            youtubeApiKeyInput: document.getElementById('youtubeApiKey'),
            toggleApiKeyVisibilityButton: document.getElementById('toggleApiKeyVisibility'),
            testConnectionButton: document.getElementById('testConnectionButton'),
            apiKeyStatus: document.getElementById('apiKeyStatus'),
            autoAnalyzeCheckbox: document.getElementById('autoAnalyze'),
            collectCommentsCheckbox: document.getElementById('collectComments'),
            cacheTimeInput: document.getElementById('cacheTime'),
            clearCacheButton: document.getElementById('clearCacheButton'),
            themeSelect: document.getElementById('themeSelect'),
            languageSelect: document.getElementById('languageSelect'),
            exportDataButton: document.getElementById('exportDataButton'),
            resetSettingsButton: document.getElementById('resetSettingsButton'),
            saveSettingsButton: document.getElementById('saveSettingsButton'),
            notificationDiv: document.getElementById('notification')
        };

        this.init(); // 初始化控制器
    }

    /**
     * 初始化函数：加载设置并设置所有事件监听器。
     */
    async init() {
        await this.loadSettings();
        this.setupEventListeners();
    }

    /**
     * 从Chrome存储加载用户设置并填充到UI中。
     */
    async loadSettings() {
        try {
            const settings = await chrome.storage.sync.get([
                'youtubeApiKey',
                'autoAnalyze',
                'collectComments',
                'cacheTime',
                'theme',
                'language'
            ]);

            this.elements.youtubeApiKeyInput.value = settings.youtubeApiKey || '';
            this.elements.autoAnalyzeCheckbox.checked = settings.autoAnalyze !== undefined ? settings.autoAnalyze : true; // 默认开启
            this.elements.collectCommentsCheckbox.checked = settings.collectComments !== undefined ? settings.collectComments : false;
            this.elements.cacheTimeInput.value = settings.cacheTime !== undefined ? settings.cacheTime : 1; // 默认缓存1小时
            this.elements.themeSelect.value = settings.theme || 'light';
            this.elements.languageSelect.value = settings.language || 'zh-CN';

            this.updateStatus('', '', this.elements.apiKeyStatus); // 清除初始状态
            console.log("Options: Settings loaded.");
        } catch (error) {
            console.error("Options: Error loading settings:", error);
            this.showNotification("加载设置失败。", "error");
        }
    }

    /**
     * 设置所有UI元素的事件监听器。
     */
    setupEventListeners() {
        this.elements.toggleApiKeyVisibilityButton.addEventListener('click', () => this.toggleApiKeyVisibility());
        this.elements.testConnectionButton.addEventListener('click', () => this.testConnection());
        this.elements.clearCacheButton.addEventListener('click', () => this.clearCache());
        this.elements.exportDataButton.addEventListener('click', () => this.exportData());
        this.elements.resetSettingsButton.addEventListener('click', () => this.resetSettings());
        this.elements.saveSettingsButton.addEventListener('click', () => this.saveSettings());
    }

    /**
     * 切换API密钥输入框的可见性（明文/密文）。
     */
    toggleApiKeyVisibility() {
        const input = this.elements.youtubeApiKeyInput;
        const button = this.elements.toggleApiKeyVisibilityButton;
        if (input.type === 'password') {
            input.type = 'text';
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.06 18.06 0 0 1 5.36-5.06M2 2l20 20M15.02 15.02a3.04 3.04 0 0 1-4.24-4.24M7.94 7.94A10.07 10.07 0 0 1 12 4c7 0 10 7 10 7a18.06 18.06 0 0 1-2.07 2.91"/></svg>`; // Eye-off icon
            button.title = '隐藏API密钥';
        } else {
            input.type = 'password';
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`; // Eye icon
            button.title = '显示API密钥';
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
     * 测试YouTube Data API连接。
     */
    async testConnection() {
        const apiKey = this.elements.youtubeApiKeyInput.value.trim();
        if (!apiKey) {
            this.updateStatus('请输入API密钥进行测试。', 'error', this.elements.apiKeyStatus);
            return;
        }

        this.updateStatus('正在测试连接...', 'loading', this.elements.apiKeyStatus);
        this.elements.testConnectionButton.disabled = true;

        try {
            // 发送一个简单的API请求来测试密钥的有效性（例如：获取热门视频）
            const testUrl = `https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${apiKey}`;
            const response = await fetch(testUrl);
            const data = await response.json();

            if (response.ok && !data.error) {
                this.updateStatus('API密钥有效！连接成功。', 'success', this.elements.apiKeyStatus);
            } else {
                const errorMessage = data.error ? data.error.message : '未知错误';
                this.updateStatus(`API密钥无效或连接失败: ${errorMessage}`, 'error', this.elements.apiKeyStatus);
            }
        } catch (error) {
            console.error("Options: Connection test error:", error);
            this.updateStatus(`网络错误或无法连接到API: ${error.message}`, 'error', this.elements.apiKeyStatus);
        } finally {
            this.elements.testConnectionButton.disabled = false;
        }
    }

    /**
     * 保存所有当前的设置到Chrome存储。
     */
    async saveSettings() {
        const settings = {
            youtubeApiKey: this.elements.youtubeApiKeyInput.value.trim(),
            autoAnalyze: this.elements.autoAnalyzeCheckbox.checked,
            collectComments: this.elements.collectCommentsCheckbox.checked,
            cacheTime: parseInt(this.elements.cacheTimeInput.value) || 0, // 确保是数字
            theme: this.elements.themeSelect.value,
            language: this.elements.languageSelect.value
        };

        try {
            await chrome.storage.sync.set(settings);
            // 通知background script API密钥已更新，以便它重新加载密钥并清除缓存
            await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiKey: settings.youtubeApiKey });
            this.showNotification("设置已保存！", "success");
            console.log("Options: Settings saved:", settings);
        } catch (error) {
            console.error("Options: Error saving settings:", error);
            this.showNotification("保存设置失败。", "error");
        }
    }

    /**
     * 清除缓存中的所有API数据。
     */
    async clearCache() {
        // 通知background script清除其内部缓存
        try {
            await chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' });
            this.showNotification("缓存已清除！", "success");
            console.log("Options: Cache clear request sent.");
        } catch (error) {
            console.error("Options: Error clearing cache:", error);
            this.showNotification("清除缓存失败。", "error");
        }
    }

    /**
     * 导出所有分析过的数据。
     * TODO: 需要实现数据存储功能（例如使用IndexedDB或Chrome Storage的local存储）
     * 才能真正导出数据。目前仅为占位功能。
     */
    async exportData() {
        // 假设这里我们会从Chrome Storage或其他本地存储中获取所有分析数据
        // 例如：const allAnalyzedData = await chrome.storage.local.get('analyzedData');

        // 目前只是一个示例，如果未来有实际数据，需要从storage中获取
        const dummyData = {
            message: "此功能将在未来版本中完善，届时将导出所有收集到的分析数据。",
            example: {
                videoId: "dummyVideo123",
                title: "示例视频标题",
                views: 1234567,
                comments: 890
            },
            timestamp: new Date().toISOString()
        };

        const filename = `youtube_analyzer_data_${Date.now()}.json`;
        const blob = new Blob([JSON.stringify(dummyData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 使用chrome.downloads API下载文件
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true // 弹出保存对话框
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error("Options: Download failed:", chrome.runtime.lastError);
                this.showNotification("导出数据失败。", "error");
            } else {
                this.showNotification("数据导出已开始！", "success");
            }
            URL.revokeObjectURL(url); // 释放URL对象
        });
    }


    /**
     * 重置所有设置到默认值。
     * 包括API密钥、自动分析、收集评论、缓存时间、主题、语言。
     */
    async resetSettings() {
        // 使用 confirm 替代 alert/window.confirm
        const isConfirmed = await this.showConfirmationModal("您确定要重置所有设置吗？这将清除所有API密钥、设置和缓存数据。");

        if (isConfirmed) {
            try {
                await chrome.storage.sync.clear(); // 清除所有同步存储的数据
                // 也清除本地存储，如果用于存储分析数据
                // await chrome.storage.local.clear();

                // 重新加载默认设置到UI
                await this.loadSettings();
                // 通知background script API密钥已更新（为空）并清除缓存
                await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiKey: '' });
                this.showNotification("所有设置已重置为默认值！", "success");
                console.log("Options: All settings reset.");
            } catch (error) {
                console.error("Options: Error resetting settings:", error);
                this.showNotification("重置设置失败。", "error");
            }
        }
    }

    /**
     * 显示自定义通知。
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型 ('success', 'error')
     * @param {number} duration - 通知显示时间 (毫秒)
     */
    showNotification(message, type = 'success', duration = 3000) {
        const notification = this.elements.notificationDiv;
        notification.textContent = message;
        notification.className = `notification show ${type}`; // 添加类型类

        // 移除旧的计时器
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        // 隐藏通知
        this.notificationTimeout = setTimeout(() => {
            notification.className = 'notification';
        }, duration);
    }

    /**
     * 显示自定义确认模态框（替代window.confirm）。
     * @param {string} message - 模态框消息
     * @returns {Promise<boolean>} - 用户是否确认
     */
    showConfirmationModal(message) {
        return new Promise(resolve => {
            const modalOverlay = document.createElement('div');
            modalOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;

            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                text-align: center;
                max-width: 400px;
                font-family: 'Inter', sans-serif;
                color: #333;
            `;

            const messagePara = document.createElement('p');
            messagePara.textContent = message;
            messagePara.style.marginBottom = '25px';
            messagePara.style.fontSize = '16px';
            messagePara.style.lineHeight = '1.5';

            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'center';
            buttonContainer.style.gap = '15px';

            const confirmButton = document.createElement('button');
            confirmButton.textContent = '确定';
            confirmButton.className = 'btn btn-danger';
            confirmButton.style.margin = '0'; // Override default btn margin

            const cancelButton = document.createElement('button');
            cancelButton.textContent = '取消';
            cancelButton.className = 'btn btn-secondary';
            cancelButton.style.margin = '0'; // Override default btn margin

            confirmButton.addEventListener('click', () => {
                document.body.removeChild(modalOverlay);
                resolve(true);
            });

            cancelButton.addEventListener('click', () => {
                document.body.removeChild(modalOverlay);
                resolve(false);
            });

            buttonContainer.appendChild(cancelButton);
            buttonContainer.appendChild(confirmButton);
            modalContent.appendChild(messagePara);
            modalContent.appendChild(buttonContainer);
            modalOverlay.appendChild(modalContent);
            document.body.appendChild(modalOverlay);
        });
    }
}

// 实例化OptionsController，启动选项页逻辑
new OptionsController();
