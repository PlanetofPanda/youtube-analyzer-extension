// content/content.js

console.log("YouTube Analyzer Content Script: Version 6.0 Loaded! (Enhanced Analysis Capabilities)"); // Update version info

/**
 * ContentScriptManager class is responsible for injecting UI elements onto YouTube pages,
 * observing DOM changes, and communicating with the background script to fetch data.
 */
class ContentScriptManager {
    constructor() {
        this.analysisIframe = null; // Reference to the iframe element
        this.observer = null; // Reference to the MutationObserver

        // Bind the message handler once for adding/removing the listener
        this.handleIframeMessageBound = this.handleIframeMessage.bind(this);
        
        // Add the message listener
        try {
            window.addEventListener('message', this.handleIframeMessageBound);
            console.log("Content Script: Message listener added in constructor.");
        } catch (e) {
            console.error("Content Script: Failed to add message listener (context issue at constructor?):", e);
        }

        this.init(); // Initialize the manager
    }

    /**
     * Initialization function: Sets up URL change observer, iframe injection, and button injection.
     */
    init() {
        console.log("Content Script: Initializing...");
        try {
            this.injectAnalysisIframe(); // Inject the iframe
            this.observeUrlChanges();    // Observe DOM changes to detect URL changes (for YouTube SPA)
            this.addButtonsToPage();     // Attempt to inject buttons on the current page load
        } catch (e) {
            console.error("Content Script: Error during init():", e);
        }
    }

    /**
     * Handles messages from the iframe, e.g., panel close requests.
     * @param {MessageEvent} event - Message event object
     */
    handleIframeMessage(event) {
        // Wrap the entire function in a try-catch as the ultimate defense
        try {
            // !!! ULTIMATE DEFENSE AGAINST "Extension context invalidated" !!!
            // This check must be the very first thing. If 'chrome' is undefined or its runtime is gone,
            // it means the extension context for this content script is dead.
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                console.warn("Content Script: Context invalidated during message handling. Removing listener.");
                // Remove the listener immediately to prevent further errors from this dead context
                try {
                    window.removeEventListener('message', this.handleIframeMessageBound);
                } catch (error) {
                    console.error("Content Script: Failed to remove message listener:", error);
                }
                return; // Exit function early
            }

            // If we get here, chrome.runtime exists, but it could still become invalid at any point
            let expectedOrigin;
            try {
                expectedOrigin = chrome.runtime.getURL(''); 
            } catch (e) {
                // This catch is for cases where chrome.runtime.getURL itself throws the invalidation error.
                console.warn("Content Script: Failed to get extension URL (context issue). Removing listener. Error:", e);
                try {
                    window.removeEventListener('message', this.handleIframeMessageBound);
                } catch (error) {
                    console.error("Content Script: Failed to remove message listener:", error);
                }
                return;
            }

            // Second defensive check - the extension context could become invalid between checks
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                console.warn("Content Script: Context invalidated after URL check. Removing listener.");
                try {
                    window.removeEventListener('message', this.handleIframeMessageBound);
                } catch (error) {
                    console.error("Content Script: Failed to remove message listener:", error);
                }
                return;
            }

            // Ensure this.analysisIframe exists and its contentWindow property is accessible
            if (!this.analysisIframe || !this.analysisIframe.contentWindow) {
                console.warn("Content Script: Ignoring message: Analysis iframe not ready or accessible.");
                return;
            }
            
            // Strict check for message source: must come from our iframe and origin must match
            if (event.source !== this.analysisIframe.contentWindow || !event.origin.startsWith(expectedOrigin)) {
                // If the message is not from our iframe or origin doesn't match, ignore it
                return;
            }

            // Third defensive check - context could become invalid at any time
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                console.warn("Content Script: Context invalidated before processing message. Removing listener.");
                try {
                    window.removeEventListener('message', this.handleIframeMessageBound);
                } catch (error) {
                    console.error("Content Script: Failed to remove message listener:", error);
                }
                return;
            }

            // Extract message data safely
            let type, data, messageContent;
            try {
                ({ type, data, message: messageContent } = event.data);
                console.log("Content Script: Received message from our iframe:", type, data || messageContent);
            } catch (e) {
                console.warn("Content Script: Error extracting message data:", e);
                return;
            }

            // Process the message
            if (type === 'CLOSE_PANEL') {
                console.log("Content Script: Received CLOSE_PANEL message from iframe.");
                try {
                    this.hideAnalysisIframe();
                } catch (e) {
                    console.error("Content Script: Error hiding analysis iframe:", e);
                }
            }
        } catch (e) {
            // Master error handler - catches any unexpected errors, including context invalidation
            console.error("Content Script: Critical error in handleIframeMessage (possible context invalidation):", e);
            try {
                window.removeEventListener('message', this.handleIframeMessageBound);
            } catch (removeError) {
                console.error("Content Script: Failed to remove message listener after error:", removeError);
            }
        }
    };


    /**
     * Creates and injects the analysis panel iframe.
     */
    injectAnalysisIframe() {
        try {
            // Check context validity BEFORE accessing chrome.runtime for iframe.src
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                console.error("Content Script: Cannot inject iframe: Extension context is invalid at injection time.");
                return;
            }

            if (document.getElementById('youtube-analyzer-iframe')) {
                this.analysisIframe = document.getElementById('youtube-analyzer-iframe');
                this.hideAnalysisIframe(); // Ensure initial state is hidden
                console.log("Content Script: Reusing existing analysis iframe.");
                return;
            }

            const iframe = document.createElement('iframe');
            iframe.id = 'youtube-analyzer-iframe';
            try {
                iframe.src = chrome.runtime.getURL('popup/analysis_panel.html'); 
            } catch (e) {
                console.error("Content Script: Failed to set iframe src. Extension context may be invalid.", e);
                return; // If src cannot be set, stop injection
            }
            iframe.frameBorder = '0';
            iframe.allow = 'clipboard-write; clipboard-read;';

            iframe.style.cssText = `
                display: block !important;
                position: fixed !important;
                top: 10px !important;
                right: 10px !important;
                width: 550px !important;
                min-height: 50px !important;
                max-height: calc(100vh - 20px) !important;
                height: auto !important;
                overflow: auto !important;
                background-color: rgba(255, 255, 255, 0.98) !important;
                border: 1px solid #065fd4 !important;
                border-radius: 8px !important;
                box-shadow: 0 4px 18px rgba(0,0,0,0.25) !important;
                z-index: 2147483647 !important;
                transition: all 0.3s ease-in-out !important;
                opacity: 0 !important;
                transform: translateX(100%) !important;
            `;

            document.body.appendChild(iframe);
            this.analysisIframe = iframe; // Assign immediately after appendChild

            iframe.onload = () => {
                console.log("Content Script: Analysis iframe loaded.");
            };

            console.log("Content Script: Analysis iframe injected into page.");
        } catch (e) {
            console.error("Content Script: Error injecting analysis iframe:", e);
        }
    };

    /**
     * Shows the analysis iframe.
     */
    showAnalysisIframe() {
        if (this.analysisIframe) {
            this.analysisIframe.style.opacity = '1';
            this.analysisIframe.style.transform = 'translateX(0%)';
            console.log("Content Script: Analysis iframe shown.");
        }
    };

    /**
     * Hides the analysis iframe.
     */
    hideAnalysisIframe() {
        if (this.analysisIframe) {
            this.analysisIframe.style.opacity = '0';
            this.analysisIframe.style.transform = 'translateX(100%)';
            console.log("Content Script: Analysis iframe hidden.");
        }
    };

    /**
     * Uses MutationObserver to watch for body DOM changes to detect URL changes.
     */
    observeUrlChanges() {
        let lastUrl = location.href;
        // Disconnect existing observer if any before creating a new one
        if (this.observer) {
            this.observer.disconnect();
            console.log("Content Script: Existing MutationObserver disconnected.");
        }
        
        const observer = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                console.log("Content Script: URL changed to:", url);
                this.hideAnalysisIframe();
                this.addButtonsToPage(); 
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        this.observer = observer; // Store observer reference
    };

    /**
     * Determines which analysis buttons to add based on the current URL.
     */
    addButtonsToPage() {
        if (window.location.pathname.startsWith('/watch')) {
            this.addVideoAnalysisButton();
        } else if (window.location.pathname.startsWith('/channel/') || window.location.pathname.startsWith('/user/')) {
            this.addChannelAnalysisButton();
        }
    };

    /**
     * Gets the video ID from the URL.
     */
    getVideoIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    };

    /**
     * Gets the channel ID from the URL.
     */
    getChannelIdFromUrl() {
        const path = window.location.pathname;
        let channelId = null;
        if (path.startsWith('/channel/')) {
            channelId = path.split('/')[2];
        } else if (path.startsWith('/user/')) {
            channelId = path.split('/')[2];
            console.warn("Content Script: '/user/' URLs provide username, not direct channel ID. API might require conversion.");
        }
        return channelId;
    };

    /**
     * Injects an "Analyze Video" button onto the video page.
     */
    addVideoAnalysisButton() {
        let targetElement = document.querySelector('ytd-watch-metadata #above-the-fold #top-row');
        if (!targetElement) {
            targetElement = document.querySelector('#actions-inner #segmented-like-button');
            if (targetElement) targetElement = targetElement.parentElement;
        }
        if (!targetElement) {
            targetElement = document.querySelector('#actions #top-level-buttons-computed');
        }

        if (!targetElement || document.getElementById('youtube-analyzer-video-button')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'youtube-analyzer-video-button';
        button.textContent = '分析视频';
        button.style.cssText = `
            background-color: #065fd4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            transition: background-color 0.3s ease;
            white-space: nowrap;
        `;
        button.onmouseover = () => button.style.backgroundColor = '#044cbd';
        button.onmouseout = () => button.style.backgroundColor = '#065fd4';

        if (targetElement.firstChild) {
            targetElement.insertBefore(button, targetElement.firstChild);
        } else {
            targetElement.appendChild(button);
        }
        
        button.onclick = () => this.analyzeVideoAndSendToIframe(button);
        console.log("Content Script: 'Analyze Video' button added.");
    };

    /**
     * Injects an "Analyze Channel" button onto the channel page.
     */
    addChannelAnalysisButton() {
        let targetElement = document.querySelector('ytd-c4-tabbed-header-renderer #buttons #buttons-inner');
        
        if (!targetElement) {
            targetElement = document.querySelector('ytd-channel-about-metadata-renderer #right-column #subscribe-button');
             if (targetElement) targetElement = targetElement.parentElement;
        }

        if (!targetElement || document.getElementById('youtube-analyzer-channel-button')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'youtube-analyzer-channel-button';
        button.textContent = '分析频道';
        button.style.cssText = `
            background-color: #065fd4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            transition: background-color 0.3s ease;
            white-space: nowrap;
        `;
        button.onmouseover = () => button.style.backgroundColor = '#044cbd';
        button.onmouseout = () => button.style.backgroundColor = '#065fd4';

        targetElement.appendChild(button);
        
        button.onclick = () => this.analyzeChannelAndSendToIframe(button);
        console.log("Content Script: 'Analyze Channel' button added.");
    };

    /**
     * Analyzes a video and sends its data to the iframe.
     * @param {HTMLElement} button - The button that triggered the analysis
     */
    async analyzeVideoAndSendToIframe(button) {
        const videoId = this.getVideoIdFromUrl();
        if (!videoId) {
            this.sendDataToIframe({ type: 'ERROR', message: "无法获取视频ID。" });
            this.showAnalysisIframe();
            return;
        }

        button.textContent = '分析中...';
        button.disabled = true;
        this.sendDataToIframe({ type: 'LOADING', message: "正在获取和分析视频数据..." });
        this.showAnalysisIframe();

        try {
            // 使用增强的视频分析API
            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_VIDEO_DATA',
                videoId: videoId
            });

            if (response.success) {
                this.sendDataToIframe({ type: 'ENHANCED_VIDEO_DATA', data: response.data });
            } else {
                this.sendDataToIframe({ type: 'ERROR', message: `分析视频数据失败: ${response.error}` });
            }
        } catch (error) {
            this.sendDataToIframe({ type: 'ERROR', message: `通信错误: ${error.message}` });
        } finally {
            button.textContent = '分析视频';
            button.disabled = false;
        }
    };

    /**
     * Analyzes a channel and sends its data to the iframe.
     * @param {HTMLElement} button - The button that triggered the analysis
     */
    async analyzeChannelAndSendToIframe(button) {
        const channelId = this.getChannelIdFromUrl();
        if (!channelId) {
            this.sendDataToIframe({ type: 'ERROR', message: "无法获取频道ID。" });
            this.showAnalysisIframe();
            return;
        }

        button.textContent = '分析中...';
        button.disabled = true;
        this.sendDataToIframe({ type: 'LOADING', message: "正在获取和分析频道数据..." });
        this.showAnalysisIframe();

        try {
            // 使用增强的频道分析API
            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_CHANNEL_DATA',
                channelId: channelId
            });

            if (response.success) {
                this.sendDataToIframe({ type: 'ENHANCED_CHANNEL_DATA', data: response.data });
            } else {
                this.sendDataToIframe({ type: 'ERROR', message: `分析频道数据失败: ${response.error}` });
            }
        } catch (error) {
            this.sendDataToIframe({ type: 'ERROR', message: `通信错误: ${error.message}` });
        } finally {
            button.textContent = '分析频道';
            button.disabled = false;
        }
    };

    /**
     * Sends data to the iframe via postMessage.
     * @param {object} data - The data object to send
     */
    sendDataToIframe(data) {
        // !!! ULTIMATE DEFENSE AGAINST "Extension context invalidated" !!!
        // Wrap the entire function body in a try-catch as the ultimate safeguard.
        try {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id || !this.analysisIframe || !this.analysisIframe.contentWindow) {
                console.warn("Content Script: Cannot send data. Extension or iframe context is invalid.");
                return;
            }
            const iframeOrigin = chrome.runtime.getURL('');
            this.analysisIframe.contentWindow.postMessage(data, iframeOrigin);
            console.log("Content Script: Data sent to iframe:", data);
        } catch (e) {
            console.error("Content Script: Error sending data to iframe (likely context invalidation):", e);
        }
    };
}

// Instantiate ContentScriptManager to start listening and injecting
new ContentScriptManager();