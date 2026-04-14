(function() {
    'use strict';
    
    const CONFIG = {
        TARGET_KEY: 'file_upload.php',
        NEW_API: 'https://img.scdn.io/api/v1.php',
        CDN_DOMAIN: 'esaimg.cdn1.vip', 
        FORMAT: 'auto' 
    };

    const cleanPrefix = () => {
        const target = window.Constant || (typeof Constant !== 'undefined' ? Constant : null);
        if (target && target.URL) {
            target.URL.uploadedPrefixImg = '';
        }
    };
    cleanPrefix();
    setInterval(cleanPrefix, 2000); 

    const _open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.includes(CONFIG.TARGET_KEY)) {
            this._isTarget = true;
        }
        return _open.apply(this, arguments);
    };

    const _send = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function(data) {
        if (this._isTarget && data instanceof FormData) {
            const xhr = this;
            const file = data.get('file') || [...data.values()].find(v => v instanceof File);
            
            const fd = new FormData();
            fd.append('image', file);
            fd.append('outputFormat', CONFIG.FORMAT);
            fd.append('cdn_domain', CONFIG.CDN_DOMAIN);

            fetch(CONFIG.NEW_API, { method: "POST", body: fd, mode: 'cors' })
                .then(res => res.json())
                .then(json => {
                    if (json.success && json.url) {
                        const finalUrl = json.url + '#e'; 
                        Object.defineProperties(xhr, {
                            readyState: { value: 4, configurable: true },
                            status: { value: 200, configurable: true },
                            responseText: { value: finalUrl, configurable: true },
                            response: { value: finalUrl, configurable: true }
                        });
                        xhr.dispatchEvent(new Event('readystatechange'));
                        xhr.dispatchEvent(new Event('load'));
                        xhr.dispatchEvent(new Event('loadend'));
                    }
                })
                .catch(() => {});
            return;
        }
        return _send.apply(this, arguments);
    };
})();