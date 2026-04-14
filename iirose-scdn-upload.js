(function() {
    'use strict';
    
    if (window.__SCDN_LOADER__) return;
    window.__SCDN_LOADER__ = true;
    
    const CONFIG = {
        REMOTE_SCRIPT_URL: 'https://github.com/Lezhengan/iirose-scdn-upload/blob/main/function.js',
        VERSION_URL: 'https://github.com/Lezhengan/iirose-scdn-upload/blob/main/version.json',
        CACHE_KEY: 'scdn_func_cache',
        CACHE_VER_KEY: 'scdn_func_ver',
        CACHE_TIME_KEY: 'scdn_func_time',
        CACHE_MAX_AGE: 24 * 60 * 60 * 1000,
        FORCE_REFRESH: 7 * 24 * 60 * 60 * 1000,
        DEBUG: false,
        TARGET_SETTINGS_KEY: "imgCleaner_userSettings_v1.6.0"
    };
    
    const log = (...args) => CONFIG.DEBUG && console.log('[Loader]', ...args);
    const error = (...args) => console.error('[Loader]', ...args);
    
    const Cache = {
        get: (key) => {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (Date.now() - data.timestamp > CONFIG.CACHE_MAX_AGE) return null;
                return data.value;
            } catch (e) { return null; }
        },
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), value }));
            } catch (e) {}
        },
        remove: (key) => {
            try { localStorage.removeItem(key); } catch (e) {}
        }
    };
    
    const fetchScript = (url, onSuccess, onError) => {
        const fetchUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        fetch(fetchUrl, { cache: 'no-store' })
            .then(response => {
                if (response.status === 200) {
                    return response.text();
                }
                throw new Error('HTTP ' + response.status);
            })
            .then(onSuccess)
            .catch(onError);
    };
    
    const executeScript = (code) => {
        try {
            if (window.__SCDN_FUNC__) return true;
            window.__SCDN_FUNC__ = true;
            const script = document.createElement('script');
            script.textContent = code;
            document.head.appendChild(script);
            document.head.removeChild(script);
            log('Function script executed successfully');
            return true;
        } catch (e) {
            error('Script execution failed:', e);
            return false;
        }
    };
    
    const fallback = (reason) => {
        console.warn('[scdn.io] Offline mode:', reason);
        const cached = Cache.get(CONFIG.CACHE_KEY);
        if (cached && executeScript(cached)) return;
    };
    
    const compareVersion = (v1, v2) => {
        const a = v1.split('.').map(Number);
        const b = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const diff = (a[i] || 0) - (b[i] || 0);
            if (diff !== 0) return diff > 0 ? 1 : -1;
        }
        return 0;
    };
    
    const checkVersion = () => {
        if (!CONFIG.VERSION_URL) return;
        fetchScript(CONFIG.VERSION_URL, (text) => {
            try {
                const versionInfo = JSON.parse(text);
                const currentVer = Cache.get(CONFIG.CACHE_VER_KEY);
                if (versionInfo.version && (!currentVer || compareVersion(versionInfo.version, currentVer) > 0)) {
                    log('New version available:', versionInfo.version);
                    Cache.set(CONFIG.CACHE_VER_KEY, versionInfo.version);
                    Cache.remove(CONFIG.CACHE_KEY);
                }
            } catch (e) {}
        }, () => {});
    };
    
    
    const cleanOldSettings = () => {
        try {
            const prefix = "imgCleaner_userSettings_";
            const targetKey = CONFIG.TARGET_SETTINGS_KEY;
            
            // 倒序遍历，避免删除时索引错乱
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                // 匹配前缀 且 不是目标键 → 删除
                if (key && key.startsWith(prefix) && key !== targetKey) {
                    console.log(`[SCDN Loader] Removing old settings: ${key}`);
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.error('[SCDN Loader] Clean settings failed:', e);
        }
    };
    
    const init = () => {
        log('Loader starting');
        
        // 在初始化最开始执行清理
        cleanOldSettings();
        
        const lastCheck = Cache.get(CONFIG.CACHE_TIME_KEY);
        const forceRefresh = !lastCheck || (Date.now() - lastCheck > CONFIG.FORCE_REFRESH);
        
        if (forceRefresh) {
            Cache.remove(CONFIG.CACHE_KEY);
            Cache.set(CONFIG.CACHE_TIME_KEY, Date.now());
        }
        
        // 优先使用缓存
        if (!forceRefresh) {
            const cached = Cache.get(CONFIG.CACHE_KEY);
            if (cached && executeScript(cached)) {
                log('Using cached script');
                checkVersion();
                return;
            }
        }
        
        // 下载远程脚本
        log('Downloading remote script');
        fetchScript(CONFIG.REMOTE_SCRIPT_URL,
            (code) => {
                if (executeScript(code)) {
                    Cache.set(CONFIG.CACHE_KEY, code);
                    log('Script cached');
                }
            },
            (err) => {
                error('Download failed:', err);
                fallback(err.message);
            }
        );
        
        checkVersion();
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 调试命令
    window.SCDNDebug = {
        clear: () => {
            [CONFIG.CACHE_KEY, CONFIG.CACHE_VER_KEY, CONFIG.CACHE_TIME_KEY].forEach(Cache.remove);
            log('Cache cleared');
        },
        reload: () => {
            Cache.remove(CONFIG.CACHE_KEY);
            init();
        },
        info: () => {
            console.log({
                cached: !!Cache.get(CONFIG.CACHE_KEY),
                version: Cache.get(CONFIG.CACHE_VER_KEY)
            });
        }
    };
})();


console.log('URL替换')

// 替换上传url
Constant.URL.uploadedPrefixImg = ''


function replaceImageUrlsRecursive(node) {
    // 这里是近期发现的新bug，加在函数里面可以避免上传头像出问题
    if (node.tagName === 'IMG') {
        if (node.src.startsWith('blob:') || node.src.startsWith('data:')) {
            return; // 到这里头像部分就结束了
        }
    }

    if (node.tagName === 'IMG') {
        // 链接替换，是防止旧有的本地的链接设置的
        node.src = node.src.replace('http://r.iirose.com/https://img.scdn.io/', 'https://img.scdn.io/');
        // 火狐适配
        node.src = node.src.replace('https://r.iirose.com/https://img.scdn.io/', 'https://img.scdn.io/');
        
        
        if (!node.src.includes('#e')) {
            node.src += '#e';
        }
    }

    // 递归检查子节点
    if (node.childNodes && node.childNodes.length > 0) {
        for (var i = 0; i < node.childNodes.length; i++) {
            replaceImageUrlsRecursive(node.childNodes[i]);
        }
    }
}

// 使用 MutationObserver 监听 DOM 变化
var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        // 检查每个新增的节点
        mutation.addedNodes.forEach(function (node) {
            // 递归替换图片链接
            replaceImageUrlsRecursive(node);
        });
    });
});

// 配置 MutationObserver
var observerConfig = {
    childList: true,
    subtree: true
};

// 开始监听
observer.observe(document.body, observerConfig);


function replaceImageUrlsAll () {
    // 获取所有图片元素
    var images = document.querySelectorAll('img');

    // 替换图片链接
    images.forEach(function (img) {
        img.src = img.src.replace('http://r.iirose.com/https://img.scdn.io/', 'https://img.scdn.io/');
    });
    
    // 替换图片链接
    images.forEach(function (img) {
        img.src = img.src.replace('https://r.iirose.com/https://img.scdn.io/', 'https://img.scdn.io/');
    });
}

// 初始化时替换一次图片链接
replaceImageUrlsAll();
