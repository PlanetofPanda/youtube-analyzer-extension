/**
 * context-utils.js
 * 提供一套跨组件的一致性扩展上下文验证工具，
 * 有效防止"Extension context invalidated"错误。
 */

const contextUtils = {
    /**
     * 检查扩展上下文是否有效
     * @returns {boolean} 如果扩展上下文有效则返回true，否则返回false
     */
    isExtensionContextValid() {
        try {
            // 基本检查：chrome和chrome.runtime是否存在
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
                console.warn("Context Utils: Extension context is invalid - basic check failed.");
                return false;
            }

            // 更严格的检查：尝试调用一个无害的runtime API方法
            try {
                chrome.runtime.getURL('');
                return true;
            } catch (e) {
                console.warn("Context Utils: Extension context is invalid - runtime API check failed:", e.message);
                return false;
            }
        } catch (e) {
            // 捕获任何可能的错误，防止脚本崩溃
            console.error("Context Utils: Critical error during context validation:", e);
            return false;
        }
    },

    /**
     * 安全地执行一个依赖扩展上下文的函数
     * @param {Function} fn 要执行的函数
     * @param {any} fallbackValue 上下文无效时返回的默认值
     * @param {Function} cleanupFn 上下文无效时执行的清理函数（可选）
     * @returns {any} 函数执行结果或fallbackValue
     */
    safeExecute(fn, fallbackValue = null, cleanupFn = null) {
        if (!this.isExtensionContextValid()) {
            if (typeof cleanupFn === 'function') {
                try {
                    cleanupFn();
                } catch (e) {
                    console.error("Context Utils: Error in cleanup function:", e);
                }
            }
            return fallbackValue;
        }

        try {
            return fn();
        } catch (e) {
            console.error("Context Utils: Error executing function:", e);
            
            // 如果错误是由于上下文无效引起的，执行清理函数
            if (e.message && (
                e.message.includes("Extension context invalidated") || 
                e.message.includes("Cannot read properties of undefined") ||
                e.message.includes("chrome is not defined")
            )) {
                if (typeof cleanupFn === 'function') {
                    try {
                        cleanupFn();
                    } catch (cleanupError) {
                        console.error("Context Utils: Error in cleanup function:", cleanupError);
                    }
                }
            }
            return fallbackValue;
        }
    },

    /**
     * 安全地获取扩展URL
     * @param {string} path 路径（相对于扩展根目录）
     * @returns {string|null} 扩展URL或null（如果上下文无效）
     */
    safeGetExtensionUrl(path = '') {
        return this.safeExecute(() => chrome.runtime.getURL(path), null);
    },

    /**
     * 创建上下文验证的定期检查，当上下文无效时调用回调函数
     * @param {Function} invalidCallback 上下文无效时的回调函数
     * @param {number} intervalMs 检查间隔（毫秒）
     * @returns {number} 定时器ID，可用于清除定时器
     */
    createContextValidator(invalidCallback, intervalMs = 5000) {
        let previousState = this.isExtensionContextValid();
        
        return setInterval(() => {
            const currentState = this.isExtensionContextValid();
            
            // 状态从有效变为无效时触发回调
            if (previousState && !currentState) {
                try {
                    invalidCallback();
                } catch (e) {
                    console.error("Context Utils: Error in invalid context callback:", e);
                }
            }
            
            previousState = currentState;
        }, intervalMs);
    },

    /**
     * 为window.postMessage添加上下文验证
     * @param {Window} targetWindow 目标窗口
     * @param {Object} data 要发送的数据
     * @param {string} targetOrigin 目标源
     * @returns {boolean} 发送是否成功
     */
    safePostMessage(targetWindow, data, targetOrigin) {
        return this.safeExecute(() => {
            targetWindow.postMessage(data, targetOrigin);
            return true;
        }, false);
    },

    /**
     * 添加事件监听器，并返回一个包含移除函数的对象
     * @param {EventTarget} target 事件目标
     * @param {string} type 事件类型
     * @param {Function} listener 监听器函数
     * @returns {Object} 包含remove方法的对象
     */
    addSafeEventListener(target, type, listener) {
        this.safeExecute(() => {
            target.addEventListener(type, listener);
        });

        return {
            remove: () => {
                this.safeExecute(() => {
                    target.removeEventListener(type, listener);
                });
            }
        };
    }
};

export default contextUtils;