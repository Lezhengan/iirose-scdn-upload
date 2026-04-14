# iirose-scdn-upload
IIRose 平台专用 SCDN（https://img.scdn.io/） 图床 图片上传 / 链接净化工具，自动处理图片上传、URL 修复

使用请在iirose官网
### **首先：打开左侧侧栏，选择"工具" > "终端"。**

### 然后：在终端中输入 js， 回车后在框内输入如下链接， 并点击确定。
~~~javascript
https://cdn.jsdelivr.net/gh/Lezhengan/iirose-scdn-upload@main/iirose-scdn-upload.js
/*开发已经完成了，目前设置的是首次打开与更新后必定设置为花园图床，需要您打开悬浮窗更改
~~~
### 最后：等待载入成功后，页面右侧将自动显示悬浮控制图标，首次使用需确认用户协议。

点击面板右上角可收起/展开，支持切换图床模式、自定义主题色与透明度，所有设置自动保存。

由于第三方图床限制，图片 60 天无访问会自动删除，且为公开图床，隐私无法保证，请不要上传任何包含隐私的图片



# *核心代码 → @Chara2580
~~~javascript
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
~~~
