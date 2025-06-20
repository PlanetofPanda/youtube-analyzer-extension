// content/content.js

console.log("YouTube Analyzer Content Script: Version 6.1 Loaded! (Enhanced Analysis Capabilities and Resizing)"); // 更新版本信息

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
            // 确保侦听器被安全且幂等地添加
            window.removeEventListener('message', this.handleIframeMessageBound); // 防止重复添加侦听器
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
     * Handles messages from the iframe, e.g., panel close requests, resize requests.
     * This function needs to be very robust to context invalidation.
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
            let type, data, messageContent, height; // Destructure 'height' for resize requests
            try {
                ({ type, data, message: messageContent, height } = event.data);
                console.log("Content Script: Received message from our iframe:", type, data || messageContent || `Height: ${height}`);
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
            } else if (type === 'RESIZE_PANEL') { // Handle resize request
                if (this.analysisIframe && typeof height === 'number') {
                    // Set a minimum height for the iframe and clamp to max-height for UI stability
                    const minAllowedHeight = 50; // As per existing CSS
                    // The max-height should be based on the viewport height
                    const maxAllowedHeight = window.innerHeight - 20; // 100vh - 20px buffer from original CSS

                    const clampedHeight = Math.min(maxAllowedHeight, Math.max(minAllowedHeight, height));

                    this.analysisIframe.style.height = `${clampedHeight}px`;
                    console.log(`Content Script: Iframe resized to ${clampedHeight}px.`);

                    // Optionally, send an acknowledgment back to the iframe
                    this.sendDataToIframe({ type: 'RESIZE_PANEL_ACK', newHeight: clampedHeight });
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
                height: 300px !important; /* Initial height, will be adjusted by JS */
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
                // Initial resize request after iframe content loads
                if (this.analysisIframe && this.analysisIframe.contentWindow) {
                    this.analysisIframe.contentWindow.postMessage({ type: 'INITIAL_RESIZE_REQUEST' }, chrome.runtime.getURL(''));
                }
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
        // Disconnect