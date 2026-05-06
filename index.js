import { getContext } from '../../../extensions.js';

// ── 常量 ─────────────────────────────────────────────
const STORAGE_KEY  = 'avp_settings';
const ANIM_MS      = 260; // 与 CSS transition 保持同步

const DEFAULTS = {
    pos: { top: 0, left: 0, objX: 50, objY: 50 },
};

// ── 主题检测 ─────────────────────────────────────────
// 兼容不同 ST 版本的选择器
function getCurrentTheme() {
    const candidates = [
        jQuery('#style_file').val(),
        jQuery('#themes').val(),
    ];
    for (const val of candidates) {
        if (val && typeof val === 'string' && val.trim()) {
            return val.trim();
        }
    }
    console.warn('[AVP] 无法检测当前主题，使用 "default"');
    return 'default';
}

// ── 存储 ─────────────────────────────────────────────
function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const allData = raw ? JSON.parse(raw) : {};
        const theme = getCurrentTheme();
        // 返回深拷贝，避免外部意外修改缓存对象
        return allData[theme]
            ? structuredClone(allData[theme])
            : { user: { ...DEFAULTS.pos }, char: {} };
    } catch (e) {
        console.error('[AVP] 读取失败:', e, {
            theme: getCurrentTheme(),
            raw: localStorage.getItem(STORAGE_KEY),
        });
        return { user: { ...DEFAULTS.pos }, char: {} };
    }
}

function save(themeData) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const allData = raw ? JSON.parse(raw) : {};
        const theme = getCurrentTheme();
        allData[theme] = themeData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
        return true;
    } catch (e) {
        console.error('[AVP] 保存失败:', e, { theme: getCurrentTheme() });
        return false;
    }
}

// ── 样式工具 ─────────────────────────────────────────
function getOrCreateStyleEl() {
    let el = document.getElementById('avp-injected-style');
    if (!el) {
        el = document.createElement('style');
        el.id = 'avp-injected-style';
        document.head.appendChild(el);
    }
    return el;
}

function buildCSS(u, c) {
    return `
        #chat .mes[is_user="true"]  .avatar     { transform: translate(${u.left}px, ${u.top}px) !important; }
        #chat .mes[is_user="true"]  .avatar img { object-position: ${u.objX}% ${u.objY}% !important; }
        #chat .mes[is_user="false"] .avatar     { transform: translate(${c.left}px, ${c.top}px) !important; }
        #chat .mes[is_user="false"] .avatar img { object-position: ${c.objX}% ${c.objY}% !important; }
    `;
}

// 从存储读取后应用到页面
function applyStyle() {
    const data     = load();
    const charName = getContext()?.name2;

    const u = { ...DEFAULTS.pos, ...data.user };
    // charName 有效时才尝试读取角色配置，否则回退默认值
    const c = { ...DEFAULTS.pos, ...(charName ? (data.char?.[charName] ?? {}) : {}) };

    getOrCreateStyleEl().textContent = buildCSS(u, c);
}

// 预览时直接传入 u/c，不读取存储
function previewStyle(u, c) {
    getOrCreateStyleEl().textContent = buildCSS(u, c);
}

// ── 防抖 ─────────────────────────────────────────────
function debounce(fn, ms) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// ── 动画关闭（使用 transitionend 兜底 setTimeout）────
function animatedRemove($el) {
    $el.removeClass('avp-visible');
    let removed = false;
    const doRemove = () => { if (!removed) { removed = true; $el.remove(); } };
    $el.one('transitionend', doRemove);
    setTimeout(doRemove, ANIM_MS + 50); // 兜底
}

// ── 设置入口按钮 ──────────────────────────────────────
function createSettingsButton() {
    jQuery('#avp-settings-entry').remove();
    const wrap = jQuery(`
        <div id="avp-settings-entry">
            <div class="avp-entry-label">Avatar Position</div>
            <button id="avp-open-modal" class="avp-btn-primary">
                <span class="avp-btn-icon">⊹</span> 调整头像
            </button>
        </div>
    `);
    jQuery('#extensions_settings').append(wrap);
    jQuery('#avp-open-modal').on('click', showModal);
}

// ── 选择弹窗 ─────────────────────────────────────────
function showModal() {
    jQuery('#avp-modal-overlay').remove();
    const overlay = jQuery(`
        <div id="avp-modal-overlay">
            <div id="avp-modal">
                <div class="avp-modal-header">
                    <span class="avp-modal-title">选择调整对象</span>
                    <button class="avp-close-btn" id="avp-modal-close">✕</button>
                </div>
                <div class="avp-modal-body">
                    <div class="avp-section">
                        <div class="avp-section-tag char-tag">CHAR</div>
                        <div class="avp-option-group">
                            <button class="avp-option-btn" data-who="char" data-type="pos">位置偏移</button>
                            <button class="avp-option-btn" data-who="char" data-type="obj">图片焦点</button>
                        </div>
                    </div>
                    <div class="avp-divider"></div>
                    <div class="avp-section">
                        <div class="avp-section-tag user-tag">USER</div>
                        <div class="avp-option-group">
                            <button class="avp-option-btn" data-who="user" data-type="pos">位置偏移</button>
                            <button class="avp-option-btn" data-who="user" data-type="obj">图片焦点</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    jQuery('body').append(overlay);

    overlay.on('click', function (e) { if (e.target === this) closeModal(); });
    jQuery('#avp-modal-close').on('click', closeModal);
    jQuery('.avp-option-btn').on('click', function () {
        const who  = jQuery(this).data('who');
        const type = jQuery(this).data('type');
        closeModal();
        showChatOverlay(who, type);
    });

    setTimeout(() => overlay.addClass('avp-visible'), 10);
}

function closeModal() {
    animatedRemove(jQuery('#avp-modal-overlay'));
}

// ── 调整面板 ─────────────────────────────────────────
function showChatOverlay(who, type) {
    jQuery('#avp-chat-overlay').remove();

    const data     = load();
    const charName = getContext()?.name2;

    // 当前 who 的初始值（来自已保存的数据，若无则用默认值）
    const base = who === 'user'
        ? { ...DEFAULTS.pos, ...data.user }
        : { ...DEFAULTS.pos, ...(charName ? (data.char?.[charName] ?? {}) : {}) };

    // draft 作为局部变量，不污染模块作用域
    const draft = { ...base };

    const isPos = type === 'pos';
    const sliderA = isPos
        ? { id: 'avp_s_a', label: 'Top',  min: -200, max: 200, val: base.top,  unit: 'px' }
        : { id: 'avp_s_a', label: 'X 轴', min: 0,    max: 100, val: base.objX, unit: '%'  };
    const sliderB = isPos
        ? { id: 'avp_s_b', label: 'Left', min: -200, max: 200, val: base.left, unit: 'px' }
        : { id: 'avp_s_b', label: 'Y 轴', min: 0,    max: 100, val: base.objY, unit: '%'  };

    const panel = jQuery(`
        <div id="avp-chat-overlay">
            <div id="avp-chat-panel">
                <div class="avp-panel-header">
                    <div class="avp-panel-tags">
                        <span class="avp-tag ${who}-tag">${who.toUpperCase()}</span>
                    </div>
                    <button class="avp-close-btn" id="avp-overlay-close">✕</button>
                </div>
                <div class="avp-slider-block">
                    <div class="avp-slider-row">
                        <span class="avp-slider-label">${sliderA.label}</span>
                        <input type="range" id="${sliderA.id}" min="${sliderA.min}" max="${sliderA.max}" value="${sliderA.val}">
                        <span class="avp-slider-val" id="${sliderA.id}_val">${sliderA.val}${sliderA.unit}</span>
                    </div>
                    <div class="avp-slider-row">
                        <span class="avp-slider-label">${sliderB.label}</span>
                        <input type="range" id="${sliderB.id}" min="${sliderB.min}" max="${sliderB.max}" value="${sliderB.val}">
                        <span class="avp-slider-val" id="${sliderB.id}_val">${sliderB.val}${sliderB.unit}</span>
                    </div>
                </div>
                <div class="avp-panel-footer">
                    <button class="avp-btn-ghost" id="avp-overlay-reset">重置</button>
                    <button class="avp-btn-save"  id="avp-overlay-save">保存到当前主题</button>
                </div>
                <div class="avp-panel-status" id="avp-panel-status"></div>
            </div>
        </div>
    `);

    jQuery('body').append(panel);

    // ── 拖动 ──────────────────────────────────────────
    let dragging = false, startX, startY;
    panel.find('.avp-panel-header').on('mousedown touchstart', function (e) {
        dragging = true;
        const pt     = e.touches ? e.touches[0] : e;
        const offset = panel.find('#avp-chat-panel').offset();
        startX = pt.clientX - offset.left;
        startY = pt.clientY - offset.top;
        e.preventDefault(); // 防止拖动时选中文字
    });
    jQuery(document).on('mousemove.avp touchmove.avp', function (e) {
        if (!dragging) return;
        const pt = e.touches ? e.touches[0] : e;
        panel.find('#avp-chat-panel').css({
            left: (pt.clientX - startX) + 'px',
            top:  (pt.clientY - startY) + 'px',
            bottom: 'auto', right: 'auto', transform: 'none',
        });
    });
    jQuery(document).on('mouseup.avp touchend.avp', () => { dragging = false; });

    // ── 预览（从 draft + 已保存数据合并，不多次 load）──
    function buildPreview() {
        // 重新 load 确保另一方用最新保存值
        const latestData  = load();
        const latestChar  = getContext()?.name2;

        const u = who === 'user'
            ? { ...DEFAULTS.pos, ...draft }
            : { ...DEFAULTS.pos, ...latestData.user };

        const c = who === 'char'
            ? { ...DEFAULTS.pos, ...draft }
            : { ...DEFAULTS.pos, ...(latestChar ? (latestData.char?.[latestChar] ?? {}) : {}) };

        previewStyle(u, c);
    }

    const debouncedPreview = debounce(buildPreview, 16);

    // ── 滑块事件 ──────────────────────────────────────
    panel.find('input[type="range"]').on('input', function () {
        const val = Number(this.value);
        if (this.id === sliderA.id) {
            isPos ? (draft.top  = val) : (draft.objX = val);
            panel.find(`#${sliderA.id}_val`).text(val + sliderA.unit);
        } else {
            isPos ? (draft.left = val) : (draft.objY = val);
            panel.find(`#${sliderB.id}_val`).text(val + sliderB.unit);
        }
        debouncedPreview();
    });

    // ── 保存 ──────────────────────────────────────────
    panel.find('#avp-overlay-save').on('click', function () {
        const currentData = load();
        const payload = {
            top:  draft.top,
            left: draft.left,
            objX: draft.objX,
            objY: draft.objY,
        };

        if (who === 'user') {
            currentData.user = payload;
        } else {
            const name = getContext()?.name2;
            if (!name) {
                panel.find('#avp-panel-status')
                    .text('错误：未找到角色名，请先选择角色')
                    .css('color', '#ff8888');
                return;
            }
            if (!currentData.char) currentData.char = {};
            currentData.char[name] = payload;
        }

        if (save(currentData)) {
            applyStyle();
            const theme = getCurrentTheme();
            panel.find('#avp-panel-status')
                .text(`已保存到主题: ${theme} ✓`)
                .css('color', '#4ade80');
            setTimeout(() => {
                jQuery(document).off('.avp');
                panel.remove();
            }, 800);
        } else {
            panel.find('#avp-panel-status')
                .text('保存失败，请检查控制台日志')
                .css('color', '#ff8888');
        }
    });

    // ── 重置 ──────────────────────────────────────────
    panel.find('#avp-overlay-reset').on('click', () => {
        const resetA = isPos ? 0 : 50;
        const resetB = isPos ? 0 : 50;
        if (isPos) { draft.top = 0; draft.left = 0; }
        else       { draft.objX = 50; draft.objY = 50; }
        panel.find(`#${sliderA.id}`).val(resetA);
        panel.find(`#${sliderB.id}`).val(resetB);
        panel.find(`#${sliderA.id}_val`).text(resetA + sliderA.unit);
        panel.find(`#${sliderB.id}_val`).text(resetB + sliderB.unit);
        buildPreview();
    });

    // ── 关闭（取消预览，恢复已保存状态）──────────────
    panel.find('#avp-overlay-close').on('click', () => {
        applyStyle();
        jQuery(document).off('.avp');
        panel.remove();
    });

    setTimeout(() => panel.addClass('avp-visible'), 10);
}

// ── 初始化 ───────────────────────────────────────────
jQuery(() => {
    createSettingsButton();
    applyStyle();

    // 角色切换事件（兼容两种注册方式）
    // 如果你的 ST 版本支持 eventSource，可改为：
    //   import { eventSource, event_types } from '../../../../script.js';
    //   eventSource.on(event_types.CHARACTER_SELECTED, () => setTimeout(applyStyle, 100));
    document.addEventListener('characterSelected', () => setTimeout(applyStyle, 100));

    // 主题切换事件（同时监听两个候选选择器，兼容不同 ST 版本）
    // ⚠️ 在控制台执行以下代码确认你的 ST 版本用的是哪个选择器：
    //   console.log(jQuery('#style_file').val(), jQuery('#themes').val())
    jQuery(document).on('change', '#style_file, #themes', () => {
        console.log('[AVP] 主题切换为:', getCurrentTheme());
        setTimeout(applyStyle, 200);
    });
});