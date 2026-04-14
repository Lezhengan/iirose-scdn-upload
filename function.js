(function() {
    'use strict';
    
    if (window.__SCDN_FUNC_EXEC__) return;
    window.__SCDN_FUNC_EXEC__ = true;
    
    // ==================== 隐私协议配置 ====================
    const PROTOCOL_CONFIG = {
        TOS_VERSION: "1.0.1",
        PRIVACY_VERSION: "1.0.1", 
        STORAGE_KEY: "commonSetting"
    };
    
    const TOS_TEXT = `scdn.io 图床插件 用户协议 版本：${PROTOCOL_CONFIG.TOS_VERSION}
欢迎使用 scdn.io 图床插件！使用前请您知悉：
 1. 本工具仅用于替换 IIROSE 图片上传链接。
 2. 本图床为公开服务，无隐私保护，请谨慎上传。
 3. 严禁上传违法、色情、侵权等违规内容。
 4. 插件免费使用，作者不承担法律责任。
 5. 可随时停用卸载，无数据残留。
继续使用即表示您已阅读并同意以上条款。`;

    const PRIVACY_TEXT = `scdn.io 公开图床插件 隐私政策
版本：${PROTOCOL_CONFIG.PRIVACY_VERSION}
1. 本图床为公开服务，所有图片链接可被任何人访问，无隐私保护。
2. 严禁上传隐私、敏感或个人信息，后果自负。
3. 单张图片连续 60 天无访问将自动清理。
4. 插件仅本地运行，不会收集您的任何个人信息。
5. 作者不保证永久存储，不承担图片丢失或泄露责任。

如不同意，请停止使用。`;

    // ==================== 图床插件配置 ====================
    const CONFIG = {
        TARGET_KEY: 'file_upload.php',
        NEW_API: 'https://img.scdn.io/api/v1.php',
        MY_DOMAIN: 'img.scdn.io'
    };

    // ==================== 用户设置持久化配置 ====================
    const SETTINGS_CONFIG = {
        STORAGE_KEY: "imgCleaner_userSettings_v1.6.0",
        VERSION: "1.8.0"
    };
    
    const DEFAULT_SETTINGS = {
        isCleaningEnabled: false,  // ← true=默认用新图床，false=默认用原始图床
        outputFormat: 'auto',
        uiConfig: {
            primaryColor: '#FFFFFF',
            accentColor: '#BA0D0D',
            opacity: 0.8,
            isMinimized: true
        }
    };

    let isCleaningEnabled = DEFAULT_SETTINGS.isCleaningEnabled; 
    let userOutputFormat = DEFAULT_SETTINGS.outputFormat;
    const UI_CONFIG = { ...DEFAULT_SETTINGS.uiConfig };

    // ==================== 设置持久化管理 ====================
    const saveUserSettings = () => {
        const settings = {
            version: SETTINGS_CONFIG.VERSION,
            updatedAt: Date.now(),
            isCleaningEnabled: isCleaningEnabled,
            outputFormat: userOutputFormat,
            uiConfig: { ...UI_CONFIG }
        };
        try {
            localStorage.setItem(SETTINGS_CONFIG.STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {}
    };

    const loadUserSettings = () => {
        try {
            const raw = localStorage.getItem(SETTINGS_CONFIG.STORAGE_KEY);
            if (!raw) return false;
            const saved = JSON.parse(raw);
            if (saved.version !== SETTINGS_CONFIG.VERSION) return false;
            if (typeof saved.isCleaningEnabled === 'boolean') {
                isCleaningEnabled = saved.isCleaningEnabled;
            }
            if (typeof saved.outputFormat === 'string') {
                userOutputFormat = saved.outputFormat;
            }
            if (saved.uiConfig && typeof saved.uiConfig === 'object') {
                Object.assign(UI_CONFIG, saved.uiConfig);
            }
            return true;
        } catch (e) {
            return false;
        }
    };

    const resetUserSettings = () => {
        try {
            localStorage.removeItem(SETTINGS_CONFIG.STORAGE_KEY);
            isCleaningEnabled = DEFAULT_SETTINGS.isCleaningEnabled;
            userOutputFormat = DEFAULT_SETTINGS.outputFormat;
            Object.assign(UI_CONFIG, DEFAULT_SETTINGS.uiConfig);
            return true;
        } catch (e) {
            return false;
        }
    };

    // ==================== 协议管理函数 ====================
    const saveAgreement = (type, version) => {
        let settings = localStorage.getItem(PROTOCOL_CONFIG.STORAGE_KEY);
        let data = settings ? JSON.parse(settings) : {
            TOS: { TOSVersion: PROTOCOL_CONFIG.TOS_VERSION, TOSAgree: false },
            Privacy: { PrivacyVersion: PROTOCOL_CONFIG.PRIVACY_VERSION, PrivacyAgree: false }
        };
        if (type === 'TOS') {
            data.TOS.TOSAgree = true;
            data.TOS.TOSVersion = version;
        } else if (type === 'Privacy') {
            data.Privacy.PrivacyAgree = true;
            data.Privacy.PrivacyVersion = version;
        }
        localStorage.setItem(PROTOCOL_CONFIG.STORAGE_KEY, JSON.stringify(data));
    };

    const checkProtocolStatus = () => {
        const settings = localStorage.getItem(PROTOCOL_CONFIG.STORAGE_KEY);
        if (!settings) return { tos: false, privacy: false };
        const data = JSON.parse(settings);
        return {
            tos: data.TOS?.TOSAgree && data.TOS.TOSVersion === PROTOCOL_CONFIG.TOS_VERSION,
            privacy: data.Privacy?.PrivacyAgree && data.Privacy.PrivacyVersion === PROTOCOL_CONFIG.PRIVACY_VERSION
        };
    };

    const showProtocolDialog = () => {
        if (!window.Utils || typeof window.Utils.sync !== 'function') {
            console.warn("原生弹窗接口不可用，跳过协议检查");
            initPlugin();
            return;
        }

        const status = checkProtocolStatus();
        
        const onPrivacyConfirm = () => {
            saveAgreement('Privacy', PROTOCOL_CONFIG.PRIVACY_VERSION);
            initPlugin();
        };

        const onTosConfirm = () => {
            saveAgreement('TOS', PROTOCOL_CONFIG.TOS_VERSION);
            window.Utils.sync(0, [PRIVACY_TEXT], onPrivacyConfirm);
        };

        if (!status.tos) {
            window.Utils.sync(0, [TOS_TEXT], onTosConfirm);
        } else if (!status.privacy) {
            window.Utils.sync(0, [PRIVACY_TEXT], onPrivacyConfirm);
        } else {
            initPlugin();
        }
    };

    // ==================== 图床核心功能 ====================
    // 进度事件分发
    const dispatchProgress = (fileName, percent, status) => {
        window.dispatchEvent(new CustomEvent('scdn:progress', {
            detail: { fileName, percent, status }
        }));
    };

    
    // 拦截上传请求
    const _open = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && url.includes(CONFIG.TARGET_KEY)) this._isTarget = true;
        return _open.apply(this, arguments);
    };

    const _send = window.XMLHttpRequest.prototype.send;
    window.XMLHttpRequest.prototype.send = function(data) {
		try {
            if (this._isTarget && data instanceof FormData && isCleaningEnabled) {
                const xhr = this;
                const file = data.get('file') || [...data.values()].find(v => v instanceof File);
                if (!file) return _send.apply(this, arguments);
                
                const fd = new FormData();
                fd.append('image', file);
                fd.append('outputFormat', userOutputFormat);
                fd.append('cdn_domain', CONFIG.MY_DOMAIN);

                const internalXhr = new XMLHttpRequest();
                internalXhr.open('POST', CONFIG.NEW_API.trim(), true);
                
                // 进度转发
                if (internalXhr.upload) {
                    internalXhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round(e.loaded / e.total * 100);
                            dispatchProgress(file.name, percent, 'uploading');
                            xhr.dispatchEvent(new ProgressEvent('progress', {
                                lengthComputable: true,
                                loaded: e.loaded,
                                total: e.total
                            }));
                        }
                    };
                }

                internalXhr.onload = () => {
                    try {
                        const json = JSON.parse(internalXhr.responseText);
                        if (json.success && json.url) {
                            const finalUrl = json.url.endsWith('#e') ? json.url : json.url + '#e';
                            dispatchProgress(file.name, 100, 'success');
                            Object.defineProperties(xhr, {
                                readyState: { value: 4, configurable: true },
                                status: { value: 200, configurable: true },
                                responseText: { value: finalUrl, configurable: true },
                                response: { value: finalUrl, configurable: true }
                            });
                            // 防双发：只触发 readystatechange
                            xhr.dispatchEvent(new Event('readystatechange'));
                            if (typeof xhr.onload === 'function') xhr.onload({ type: 'load', target: xhr });
                        } else {
                            dispatchProgress(file.name, 0, 'error');
                            _send.apply(xhr, [data]);
                        }
                    } catch(e) {
                        dispatchProgress(file.name, 0, 'error');
                        _send.apply(xhr, [data]);
                    }
                };
                
                internalXhr.onerror = () => {
                    dispatchProgress(file.name, 0, 'error');
                    _send.apply(xhr, [data]);
                };
                
                dispatchProgress(file.name, 0, 'starting');
                internalXhr.send(fd);
                return;
            }
            return _send.apply(this, arguments);
        } catch(e) {
            return _send.apply(this, arguments);
        }
    };

    // ==================== UI 悬浮窗（全量移动端触摸适配） ====================
    const initUI = () => {
        if (document.getElementById('img-cleaner-widget')) return;
        
        const container = document.createElement('div');
        container.id = 'img-cleaner-widget';
        
        const createStyle = (primary, accent, opacity) => `
            #img-cleaner-widget {
                position: fixed; top: 50%; right: 12px; transform: translateY(-50%);
                width: 280px; max-width: 92vw; background: ${primary}; border: 1px solid ${accent};
                border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.18);
                font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: ${accent}; z-index: 999999; transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                user-select: none; overflow: hidden; line-height: 1.5; opacity: ${opacity};
                touch-action: none; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none;
            }
            #img-cleaner-widget.minimized { width: 44px; height: 44px; border-radius: 50%; right: 8px; }
            #img-cleaner-widget.minimized .ic-content,
            #img-cleaner-widget.minimized .ic-title,
            #img-cleaner-widget.minimized .ic-toggle,
            #img-cleaner-widget.minimized .ic-settings { display: none; }
            #img-cleaner-widget.minimized .ic-header { padding: 0; justify-content: center; background: transparent; border-bottom: none; height: 44px; }
            #img-cleaner-widget.minimized .ic-status-dot { width: 44px; height: 44px; border-radius: 50%; box-shadow: 0 0 12px ${accent}80; background: ${primary}; border: 2px solid ${accent}; }
            .ic-header { padding: 14px 16px; background: ${primary}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${accent}40; }
            .ic-title { font-weight: 600; color: ${accent}; display: flex; align-items: center; gap: 8px; font-size: 14px; }
            .ic-status-dot { width: 10px; height: 10px; border-radius: 50%; background-color: ${accent}; box-shadow: 0 0 0 2px ${accent}30; transition: all 0.3s ease; flex-shrink: 0; }
            .ic-status-dot.off { background-color: #ef4444; box-shadow: 0 0 0 2px rgba(239,68,68,0.15); }
            .ic-toggle { font-size: 12px; color: ${accent}; transition: all 0.2s ease; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
            .ic-content { padding: 14px 16px; max-height: 65vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
            .ic-desc { margin-bottom: 10px; color: ${accent}; line-height: 1.5; font-size: 13px; }
            .ic-mode { font-size: 12px; color: ${accent}cc; margin: 0 0 14px 0; padding: 10px 12px; background: ${primary}90; border: 1px solid ${accent}30; border-radius: 8px; line-height: 1.6; }
            .ic-mode strong { color: ${accent}; font-weight: 500; }
            .ic-progress { margin: 10px 0; display: none; padding: 8px; background: ${primary}90; border-radius: 8px; border: 1px solid ${accent}30; }
            .ic-progress.active { display: block; }
            .ic-progress-bar { height: 5px; background: ${accent}25; border-radius: 3px; overflow: hidden; margin-bottom: 5px; }
            .ic-progress-fill { height: 100%; background: ${accent}; border-radius: 3px; width: 0%; transition: width 0.2s ease; }
            .ic-progress-text { font-size: 11px; color: ${accent}bb; display: flex; justify-content: space-between; }
            .ic-btn { width: 100%; min-height: 44px; padding: 0 14px; border: 1px solid ${accent}; border-radius: 10px; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.2s ease; background: ${primary}; color: ${accent}; -webkit-appearance: none; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
            .ic-btn:active { transform: scale(0.97); background: ${accent}15; }
            .ic-btn.active { background: ${accent}; color: ${primary}; }
            .ic-settings { margin-top: 14px; padding-top: 14px; border-top: 1px solid ${accent}30; }
            .ic-setting-item { margin-bottom: 12px; }
            .ic-setting-label { font-size: 12px; color: ${accent}bb; margin-bottom: 6px; display: block; }
            .ic-color-wrapper { display: flex; align-items: center; gap: 10px; }
            .ic-color-input { flex: 0 0 44px; height: 44px; padding: 4px; cursor: pointer !important; border: 1px solid ${accent}40; border-radius: 8px; background: ${primary}; }
            .ic-color-input::-webkit-color-swatch-wrapper { padding: 0; }
            .ic-color-input::-webkit-color-swatch { border: none; border-radius: 6px; }
            .ic-color-text { flex: 1; height: 44px; padding: 0 10px; border: 1px solid ${accent}40; border-radius: 8px; background: ${primary}90; color: ${accent}; font-size: 13px; font-family: monospace; outline: none; }
            .ic-color-text:focus { border-color: ${accent}; background: ${primary}; }
            .ic-opacity-input { width: 100%; height: 44px; -webkit-appearance: none; background: transparent; }
            .ic-opacity-input::-webkit-slider-thumb { -webkit-appearance: none; height: 26px; width: 26px; border-radius: 50%; background: ${accent}; cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.2); margin-top: -11px; }
            .ic-opacity-input::-webkit-slider-runnable-track { width: 100%; height: 5px; background: ${accent}30; border-radius: 3px; }
            .ic-select-input { width: 100%; min-height: 44px; padding: 0 10px; border: 1px solid ${accent}40; border-radius: 8px; background: ${primary}90; color: ${accent}; font-size: 13px; outline: none; -webkit-appearance: none; }
            .ic-footer { font-size: 11px; color: ${accent}70; text-align: right; margin-top: 12px; padding-top: 10px; border-top: 1px solid ${accent}20; }
            @media (max-width: 380px) { #img-cleaner-widget { width: 260px; right: 8px; } }
        `;

        const style = document.createElement('style');
        style.id = 'img-cleaner-style';
        style.textContent = createStyle(UI_CONFIG.primaryColor, UI_CONFIG.accentColor, UI_CONFIG.opacity);
        container.appendChild(style);

        container.innerHTML += `
            <div class="ic-header" id="ic-header">
                <div class="ic-title"><div class="ic-status-dot" id="ic-status-dot"></div><span>图床方案切换</span></div>
                <span class="ic-toggle" id="ic-toggle-text">▼</span>
            </div>
            <div class="ic-content" id="ic-content">
                <div class="ic-desc"><strong>当前模式：</strong><br><span id="ic-mode-text" style="color:${UI_CONFIG.accentColor}">新图床代理模式</span></div>
                <div class="ic-mode" id="ic-mode-desc">• 上传至 img.scdn.io</div>
                <div class="ic-progress" id="ic-progress">
                    <div class="ic-progress-bar"><div class="ic-progress-fill" id="ic-progress-fill"></div></div>
                    <div class="ic-progress-text"><span id="ic-progress-file">-</span><span id="ic-progress-status">准备</span></div>
                </div>
                <button class="ic-btn" id="ic-action-btn">切换回原始图床</button>
                <div class="ic-settings">
                    <div class="ic-setting-item" id="format-wrap">
                        <label class="ic-setting-label">输出格式</label>
                        <select class="ic-select-input" id="format-select">
                            <option value="webp_animated" ${userOutputFormat==='webp_animated'?'selected':''}>WebP 动图</option>
                            <option value="auto" ${userOutputFormat==='auto'?'selected':''}>Auto 自动</option>
                            <option value="webp" ${userOutputFormat==='webp'?'selected':''}>WebP 静态</option>
                            <option value="jpeg" ${userOutputFormat==='jpeg'?'selected':''}>JPEG</option>
                        </select>
                    </div>
                    <div class="ic-setting-item">
                        <label class="ic-setting-label">主色调</label>
                        <div class="ic-color-wrapper">
                            <input type="color" class="ic-color-input" id="primary-color" value="${UI_CONFIG.primaryColor}">
                            <input type="text" class="ic-color-text" id="primary-color-text" value="${UI_CONFIG.primaryColor}" maxlength="7" placeholder="#FFFFFF">
                        </div>
                    </div>
                    <div class="ic-setting-item">
                        <label class="ic-setting-label">强调色</label>
                        <div class="ic-color-wrapper">
                            <input type="color" class="ic-color-input" id="accent-color" value="${UI_CONFIG.accentColor}">
                            <input type="text" class="ic-color-text" id="accent-color-text" value="${UI_CONFIG.accentColor}" maxlength="7" placeholder="#BA0D0D">
                        </div>
                    </div>
                    <div class="ic-setting-item">
                        <label class="ic-setting-label">透明度 (${Math.round(UI_CONFIG.opacity * 100)}%)</label>
                        <input type="range" class="ic-opacity-input" id="opacity-slider" min="0.1" max="1" step="0.05" value="${UI_CONFIG.opacity}">
                    </div>
                    <div class="ic-setting-item" style="margin-top:12px;">
                        <button class="ic-btn" id="ic-reset-btn" style="min-height:36px;font-size:12px;padding:0 10px;background:transparent;">重置设置</button>
                    </div>
                </div>
                <div class="ic-footer">点击图标收纳/展开 | v1.8.0</div>
            </div>
        `;

        document.body.appendChild(container);

        //  DOM 元素引用
        const widget = document.getElementById('img-cleaner-widget');
        const statusDot = document.getElementById('ic-status-dot');
        const header = document.getElementById('ic-header');
        const actionBtn = document.getElementById('ic-action-btn');
        const resetBtn = document.getElementById('ic-reset-btn');
        const formatSelect = document.getElementById('format-select');
        const styleElement = document.getElementById('img-cleaner-style');
        const modeText = document.getElementById('ic-mode-text');
        const modeDesc = document.getElementById('ic-mode-desc');
        const progressWrap = document.getElementById('ic-progress');
        const progressFill = document.getElementById('ic-progress-fill');
        const progressFile = document.getElementById('ic-progress-file');
        const progressStatus = document.getElementById('ic-progress-status');
        const primaryColorInput = document.getElementById('primary-color');
        const primaryColorText = document.getElementById('primary-color-text');
        const accentColorInput = document.getElementById('accent-color');
        const accentColorText = document.getElementById('accent-color-text');
        const opacitySlider = document.getElementById('opacity-slider');

        //  阻止控件触摸时触发底层页面滚动
        widget.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        //  统一触摸/点击绑定器（消除移动端延迟 + 防冒泡）
        const bindTouch = (el, handler) => {
            el.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); handler(e); }, { passive: false });
            el.addEventListener('click', (e) => { e.stopPropagation(); handler(e); });
        };

        let isMinimized = UI_CONFIG.isMinimized;
        if (isMinimized) widget.classList.add('minimized');
        
        const toggleMinimized = () => {
            isMinimized = !isMinimized;
            widget.classList.toggle('minimized', isMinimized);
            UI_CONFIG.isMinimized = isMinimized;
            saveUserSettings();
        };

        //  绑定触摸事件
        bindTouch(statusDot, toggleMinimized);
        bindTouch(header, (e) => {
            // 点击输入框/按钮/下拉框时不折叠
            if (e.target.closest('.ic-btn, input, select, .ic-color-wrapper')) return;
            toggleMinimized();
        });
        bindTouch(actionBtn, () => {
            isCleaningEnabled = !isCleaningEnabled;
            updateUI();
            saveUserSettings();
        });
        bindTouch(resetBtn, () => {
            if (confirm('确定要重置所有自定义设置吗？')) {
                resetUserSettings();
                updateUI();
                styleElement.textContent = createStyle(UI_CONFIG.primaryColor, UI_CONFIG.accentColor, UI_CONFIG.opacity);
                primaryColorInput.value = primaryColorText.value = UI_CONFIG.primaryColor;
                accentColorInput.value = accentColorText.value = UI_CONFIG.accentColor;
                opacitySlider.value = UI_CONFIG.opacity;
                formatSelect.value = userOutputFormat;
                opacitySlider.previousElementSibling.textContent = `透明度 (${Math.round(UI_CONFIG.opacity * 100)}%)`;
            }
        });

        // 颜色验证逻辑
        const updateUIStyle = (primary, accent, opacity) => {
            styleElement.textContent = createStyle(primary, accent, opacity);
            modeText.style.color = accent;
            UI_CONFIG.primaryColor = primary; UI_CONFIG.accentColor = accent; UI_CONFIG.opacity = opacity;
        };
        const isValidColor = c => /^#[0-9A-Fa-f]{6}$/.test(c);
        const normalizeColor = c => c.toUpperCase();
        const updateColor = (c, isP) => {
            if (!isValidColor(c)) return false;
            c = normalizeColor(c);
            if (isP) { primaryColorInput.value = primaryColorText.value = c; updateUIStyle(c, UI_CONFIG.accentColor, UI_CONFIG.opacity); }
            else { accentColorInput.value = accentColorText.value = c; updateUIStyle(UI_CONFIG.primaryColor, c, UI_CONFIG.opacity); }
            saveUserSettings(); return true;
        };

        // 输入控件事件（保留原生触摸体验）
        primaryColorInput.addEventListener('input', e => updateColor(e.target.value, true));
        primaryColorText.addEventListener('change', e => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (!updateColor(v, true)) e.target.value = UI_CONFIG.primaryColor; });
        accentColorInput.addEventListener('input', e => updateColor(e.target.value, false));
        accentColorText.addEventListener('change', e => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (!updateColor(v, false)) e.target.value = UI_CONFIG.accentColor; });
        opacitySlider.addEventListener('input', e => {
            const o = parseFloat(e.target.value);
            opacitySlider.previousElementSibling.textContent = `透明度 (${Math.round(o * 100)}%)`;
            updateUIStyle(UI_CONFIG.primaryColor, UI_CONFIG.accentColor, o);
            saveUserSettings();
        });
        formatSelect.addEventListener('change', e => { userOutputFormat = e.target.value; saveUserSettings(); });

        // 进度监听
        window.addEventListener('scdn:progress', e => {
            const { fileName, percent, status } = e.detail;
            progressWrap.classList.add('active');
            progressFile.textContent = fileName?.slice(0, 12) || '-';
            progressFill.style.width = percent + '%';
            const map = { 'starting':'准备', 'uploading':`${percent}%`, 'success':'✅ 完成', 'error':'❌ 失败' };
            progressStatus.textContent = map[status] || status;
            progressStatus.style.color = status === 'success' ? '#22c55e' : status === 'error' ? '#ef4444' : UI_CONFIG.accentColor;
            if (status === 'success' || status === 'error') setTimeout(() => progressWrap.classList.remove('active'), 2000);
        });

        // UI 更新
        const updateUI = () => {
            document.getElementById('format-wrap').style.display = isCleaningEnabled ? 'block' : 'none';
            if (isCleaningEnabled) {
                statusDot.classList.remove('off');
                modeText.innerHTML = '新图床代理模式';
                modeText.style.color = UI_CONFIG.accentColor;
                modeDesc.innerHTML = '• 上传转发至 img.scdn.io';
                actionBtn.innerText = '切换回原始图床';
                actionBtn.classList.add('active');
            } else {
                statusDot.classList.add('off');
                modeText.innerHTML = '原始图床模式';
                modeText.style.color = '#ef4444';
                modeDesc.innerHTML = '• 直连 iirose.com';
                actionBtn.innerText = '启用新图床代理';
                actionBtn.classList.remove('active');
            }
        };

        updateUI();
        console.log('%c[图床脚本] 已启动', `color: ${UI_CONFIG.accentColor}; font-weight: 600;`);
    };

    const initPlugin = () => { loadUserSettings(); initUI(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showProtocolDialog);
    else showProtocolDialog();
})();