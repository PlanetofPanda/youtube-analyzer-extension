// background/background.js
import youTubeApiClient from '../libs/api-client.js';
import dataProcessor from '../libs/data-processor.js';
import contextUtils from '../libs/context-utils.js';

// Define initialization states
const INIT_STATE = {
  PENDING: 'PENDING', // Not initialized
  INITIALIZING: 'INITIALIZING', // Initialization in progress
  SUCCESS: 'SUCCESS', // Initialized successfully
  FAILED: 'FAILED', // Initialization failed
};

class BackgroundController {
  constructor() {
    this.initState = INIT_STATE.PENDING;
    this.messageQueue = [];
    this.initPromise = null;

    this.initialize();
    this.setupListeners();
  }

  /**
   * Main initialization logic.
   */
  initialize() {
    // Prevent re-initialization if already in progress or successful
    if (this.initState === INIT_STATE.INITIALIZING || this.initState === INIT_STATE.SUCCESS) {
      return this.initPromise;
    }

    this.initState = INIT_STATE.INITIALIZING;
    console.log("Background: Starting initialization...");

    this.initPromise = (async () => {
      try {
        if (!contextUtils.isExtensionContextValid()) {
          throw new Error("Extension context is invalid at initialization time.");
        }
        await youTubeApiClient.init();
        this.initState = INIT_STATE.SUCCESS;
        console.log("Background: Initialization successful.");
        this.processMessageQueue();
      } catch (error) {
        this.initState = INIT_STATE.FAILED;
        console.error("Background: Initialization failed:", error);
        // Reject queued messages with an error
        this.processMessageQueue(error);
      }
    })();

    return this.initPromise;
  }

  /**
   * Sets up all chrome extension event listeners.
   */
  setupListeners() {
    // Listen for messages from other parts of the extension
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Required to indicate async response
    });

    // Optional: Listen for when the extension is installed or updated
    chrome.runtime.onInstalled.addListener(details => {
      console.log(`Extension installed or updated. Reason: ${details.reason}`);
      this.initialize();
    });
  }

  /**
   * Processes the message queue.
   * If an error is provided, it rejects all queued messages.
   * @param {Error} [error=null] - An error to reject messages with.
   */
  processMessageQueue(error = null) {
    console.log(`Processing ${this.messageQueue.length} queued messages.`);
    while (this.messageQueue.length > 0) {
      const { request, sender, sendResponse } = this.messageQueue.shift();
      if (error) {
        sendResponse({ success: false, error: `Initialization failed: ${error.message}` });
      } else {
        this.routeMessage(request, sender, sendResponse);
      }
    }
  }

  /**
   * Handles all incoming messages.
   */
  async handleMessage(request, sender, sendResponse) {
    // If the API key is being saved, we need to re-initialize.
    // This is a special case that bypasses the queue.
    if (request.type === 'SAVE_API_KEY') {
      console.log("Background: Received SAVE_API_KEY request. Re-initializing...");
      this.initState = INIT_STATE.PENDING; // Reset state
      this.routeMessage(request, sender, sendResponse);
      this.initialize(); // Trigger re-initialization
      return;
    }

    // If not initialized, queue the message.
    if (this.initState !== INIT_STATE.SUCCESS) {
      console.log(`Background: Queuing message of type ${request.type} (state: ${this.initState})`);
      this.messageQueue.push({ request, sender, sendResponse });

      // If initialization hasn't started, kick it off.
      if (this.initState === INIT_STATE.PENDING || this.initState === INIT_STATE.FAILED) {
        this.initialize();
      }
      return;
    }

    // If already initialized, process the message directly.
    this.routeMessage(request, sender, sendResponse);
  }

  /**
   * Routes the message to the appropriate handler based on its type.
   * This is called either directly if initialized, or after initialization for queued messages.
   */
  async routeMessage(request, sender, sendResponse) {
    console.log("Background: Routing message:", request.type, "from", sender.tab ? sender.tab.url : "extension");

    // Ensure API key exists for most requests
    if (request.type !== 'SAVE_API_KEY' && !youTubeApiClient.apiKey) {
        sendResponse({ success: false, error: "YouTube API Key is not set. Please set it in the extension options." });
        return;
    }

    try {
      let responseData;
      switch (request.type) {
        case 'GET_CHANNEL_DATA':
          responseData = await youTubeApiClient.getChannelData(request.channelId);
          sendResponse({ success: true, data: responseData });
          break;

        case 'GET_VIDEO_DATA':
          responseData = await youTubeApiClient.getVideoData(request.videoId);
          sendResponse({ success: true, data: responseData });
          break;

        case 'GET_TRENDING_VIDEOS':
          responseData = await youTubeApiClient.getTrendingVideos(request.regionCode, request.category);
          sendResponse({ success: true, data: responseData });
          break;

        case 'GET_VIDEO_COMMENTS':
            responseData = await youTubeApiClient.getVideoComments(request.videoId, request.maxResults);
            sendResponse({ success: true, data: responseData });
            break;

        case 'ANALYZE_VIDEO_DATA':
            const videoData = await youTubeApiClient.getVideoData(request.videoId);
            if (!videoData) throw new Error("Video data not found for analysis.");
            
            const analysis = {
                rawData: videoData,
                kpis: dataProcessor.calculateVideoKPIs(videoData),
                tagAnalysis: dataProcessor.analyzeVideoTags(videoData),
                titleAnalysis: dataProcessor.analyzeTitleEffectiveness(videoData.snippet.title),
                descriptionAnalysis: dataProcessor.analyzeDescriptionEffectiveness(videoData.snippet.description)
            };
            sendResponse({ success: true, data: analysis });
            break;

        case 'SAVE_API_KEY':
          await youTubeApiClient.setApiKey(request.apiKey);
          await chrome.storage.sync.set({ youtubeApiKey: request.apiKey });
          youTubeApiClient.clearCache();
          console.log("Background: API Key saved and updated.");
          sendResponse({ success: true });
          break;

        case 'CLEAR_CACHE':
          youTubeApiClient.clearCache();
          sendResponse({ success: true });
          break;

        default:
          console.warn("Unknown message type:", request.type);
          sendResponse({ success: false, error: "Unknown message type" });
          break;
      }
    } catch (error) {
      console.error(`Background: Error handling message '${request.type}':`, error);
      sendResponse({ success: false, error: error.message || "An unknown error occurred." });
    }
  }
}

// Instantiate the controller to start the background script
new BackgroundController();
