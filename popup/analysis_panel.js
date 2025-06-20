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

        // --- 新增：观察内容变化以调整 iframe 大小 ---
        this.resizeObserver = new ResizeObserver(() => {
            this.requestPanelResize();
        });
        this.resizeObserver.observe(this.panelContentDiv); // 观察内容区域的变化

        // 也在初始加载和内容变化后请求调整大小
        window.addEventListener('load', () => this.requestPanelResize());
        // 对于动态内容，你可能需要在渲染新内容后调用 requestPanelResize()
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
                case 'RESIZE_PANEL_ACK': // 新增：父窗口确认调整大小
                    console.log("Analysis Panel: Parent confirmed resize.");
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
                e.message.includes