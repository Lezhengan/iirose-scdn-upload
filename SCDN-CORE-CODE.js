(function() {
    'use strict';

    const CONFIG = {
        TARGET_KEY: 'file_upload.php',
        NEW_API: 'https://img.scdn.io/api/v1.php',
        CDN_DOMAIN: 'img.scdn.io',
        FORMAT: 'auto',
        BLOCKED_ALERTS: ['Utils.sync', '_alert'],
        BLOCK_DURATION_MS: 3000
    };

    let isBlocking = false;
    const originals = new Map();

    const hijack = (path) => {
        if (originals.has(path)) return;
        const parts = path.split('.');
        let obj = window;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) return;
            obj = obj[parts[i]];
        }
        const key = parts[parts.length - 1];
        const orig = obj[key];
        if (typeof orig !== 'function') return;
        originals.set(path, orig);
        obj[key] = (...args) => isBlocking ? undefined : orig.apply(this, args);
    };

    const enableBlocking = () => {
        if (isBlocking) return;
        isBlocking = true;
        setTimeout(() => isBlocking = false, CONFIG.BLOCK_DURATION_MS);
    };

    CONFIG.BLOCKED_ALERTS.forEach(hijack);
    setInterval(() => CONFIG.BLOCKED_ALERTS.forEach(hijack), 2000);

    let isPrefixCleaningActive = false;
    const cleanPrefix = () => {
        const target = window.Constant || (typeof Constant !== 'undefined' ? Constant : null);
        if (target && target.URL) target.URL.uploadedPrefixImg = '';
    };

    const startPrefixCleaning = () => {
        if (isPrefixCleaningActive) return;
        isPrefixCleaningActive = true;
        cleanPrefix();
        setInterval(cleanPrefix, 2000);
    };

    const { open, send } = XMLHttpRequest.prototype;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.includes(CONFIG.TARGET_KEY)) this._isTarget = true;
        return open.call(this, method, url);
    };

    XMLHttpRequest.prototype.send = function(data) {
        if (!this._isTarget || !(data instanceof FormData)) return send.call(this, data);

        const xhr = this;
        const file = data.get('file') || [...data.values()].find(v => v instanceof File);

        xhr.addEventListener('readystatechange', (e) => {
            if (xhr.readyState === 4 && !xhr._processed) {
                if (xhr.status === 200) {
                    let originalRes = xhr.responseText;
                    if (originalRes && !originalRes.includes('#e')) {
                        e.stopImmediatePropagation();
                        xhr._processed = true;

                        const modifiedUrl = originalRes.trim() + '#e';
                        Object.defineProperties(xhr, {
                            responseText: { value: modifiedUrl },
                            response: { value: modifiedUrl }
                        });

                        xhr.dispatchEvent(new Event('readystatechange'));
                    }
                } 
                else if (xhr.status !== 200) {
                    e.stopImmediatePropagation();
                    xhr._processed = true;
                    
                    enableBlocking();
                    startPrefixCleaning();

                    const fd = new FormData();
                    fd.append('image', file);
                    fd.append('outputFormat', CONFIG.FORMAT);
                    fd.append('cdn_domain', CONFIG.CDN_DOMAIN);

                    fetch(CONFIG.NEW_API, { method: 'POST', body: fd, mode: 'cors' })
                        .then(res => res.json())
                        .then(json => {
                            if (json.success && json.url) {
                                const finalUrl = json.url.includes('#e') ? json.url : json.url + '#e';
                                Object.defineProperties(xhr, {
                                    readyState: { value: 4 },
                                    status: { value: 200 },
                                    responseText: { value: finalUrl },
                                    response: { value: finalUrl }
                                });
                                xhr.dispatchEvent(new Event('readystatechange'));
                                xhr.dispatchEvent(new Event('load'));
                                xhr.dispatchEvent(new Event('loadend'));
                            }
                        })
                        .catch(() => {
                            console.error('Fallback upload failed.');
                        });
                }
            }
        }, true);

        return send.call(this, data);
    };
})();
