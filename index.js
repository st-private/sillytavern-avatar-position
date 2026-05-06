import { getContext } from '../../../extensions.js';

// ── 常量 ─────────────────────────────────────────────
const STORAGE_KEY = 'avp_settings';
const ANIM_MS     = 260; // 与 CSS transition 保持同步

const DEFAULTS = { objX: 50, objY: 50 };

// ── 主题检测 ─────────────────────────────────────────
function getCurrentTheme() {
    const candidates = [
        jQuery('#style_file').val(),
        jQuery('#themes').val(),
    ];
    for (const val of candidates) {
        if (val && typeof val === 'string' && val.trim()) return val.trim();
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
        return allData[theme]
            ? structuredClone(allData[theme])
            : { user: { ...DEFAULTS }, char: {} };
    } catch (e) {
        console.error('[AVP] 读取失败:', e, {
            theme: getCurrentTheme(),
            raw: localStorage.getItem(STORAGE_KEY),
        });
        return { user: { ...DEFAULTS }, char: {} };
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
        #chat .mes[is_user="true"]  .avatar img { object-position: ${u.objX}% ${u.objY}% !important; }
        #chat .mes[is_user="false"] .avatar img { object-position: ${c.objX}% ${c.objY}% !important; }
    `;
}

function applyStyle() {
    const data     = load();
    const charName = getContext()?.name2;
    const u = { ...DEFAULTS, ...data.user };
    const c = { ...DEFAULTS, ...(charName ? (data.char?.[charName] ?? {}) : {}) };
    getOrCreateStyleEl().textContent = buildCSS(u, c);
}

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

// ── 动画关闭 ─────────────────────────────────────────
function animatedRemove($el) {
    $el.removeClass('avp-visible');
    let removed = false;
    const doRemove = () => { if (!removed) { removed = true; $el.remove(); } };
    $el.one('transitionend', doRemove);
    setTimeout(doRemove, ANIM_MS + 50);
}

// ── 设置入口按钮 ──────────────────────────────────────
function createSettingsButton() {
    jQuery('#avp-settings-entry').remove();
    const wrap = jQuery(`
        <div id="avp-settings-entry">
            <div class="avp-entry-label">Avatar Position</div>
            <button id="avp-open-modal" class="avp-btn-primary">
                <span class="avp-btn-icon">⊹</span> 调整头像焦点
            </button>
        </div>
    `);
    jQuery('#extensions_settings').append(wrap);
    jQuery('#avp-open-modal').on('click', showModal);
}

// ── 选择弹窗（仅选 CHAR / USER）─────────────────────
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
                    <div class="avp-who-row">
                        <button class="avp-who-btn char-btn" data-who="char">
                            <span class="avp-who-icon">🎭</span>
                            <span class="avp-section-tag char-tag">CHAR</span>
                            <span class="avp-who-desc">角色头像焦点</span>
                        </button>
                        <div class="avp-who-divider"></div>
                        <button class="avp-who-btn user-btn" data-who="user">
                            <span class="avp-who-icon">👤</span>
                            <span class="avp-section-tag user-tag">USER</span>
                            <span class="avp-who-desc">用户头像焦点</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `);
    jQuery('body').append(overlay);

    overlay.on('click', function (e) { if (e.target === this) closeModal(); });
    jQuery('#avp-modal-close').on('click', closeModal);
    jQuery('.avp-who-btn').on('click', function () {
        const who = jQuery(this).data('who');
        closeModal();
        showChatOverlay(who);
    });

    setTimeout(() => overlay.addClass('avp-visible'), 10);
}

function closeModal() {
    animatedRemove(jQuery('#avp-modal-overlay'));
}

// ── 调整面板 ─────────────────────────────────────────
function showChatOverlay(who) {
    jQuery('#avp-chat-overlay').remove();

    const data     = load();
    const charName = getContext()?.name2;

    const base = who === 'user'
        ? { ...DEFAULTS, ...data.user }
        : { ...DEFAULTS, ...(charName ? (data.char?.[charName] ?? {}) : {}) };

    const draft = { ...base }; // 局部变量，不污染模块作用域

    const panel = jQuery(`
        <div id="avp-chat-overlay">
            <div id="avp-chat-panel">
                <div class="avp-panel-header">
                    <div class="avp-panel-tags">
                        <span class="avp-tag ${who}-tag">${who.toUpperCase()}</span>
                        <span class="avp-panel-subtitle">图片焦点</span>
                    </div>
                    <button class="avp-close-btn" id="avp-overlay-close">✕</button>
                </div>
                <div class="avp-slider-block">
                    <div class="avp-slider-row">
                        <span class="avp-slider-label">X 轴</span>
                        <input type="range" id="avp_s_x" min="0" max="100" value="${draft.objX}">
                        <span class="avp-slider-val" id="avp_s_x_val">${draft.objX}%</span>
                    </div>
                    <div class="avp-slider-row">
                        <span class="avp-slider-label">Y 轴</span>
                        <input type="range" id="avp_s_y" min="0" max="100" value="${draft.objY}">
                        <span class="avp-slider-val" id="avp_s_y_val">${draft.objY}%</span>
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
        if (jQuery(e.target).closest('.avp-close-btn').length) return;
        dragging = true;
        const pt     = e.touches ? e.touches[0] : e;
        const offset = panel.find('#avp-chat-panel').offset();
        startX = pt.clientX - offset.left;
        startY = pt.clientY - offset.top;
        e.preventDefault();
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

    // ── 预览：draft 一方 + 存储另一方 ────────────────
    function buildPreview() {
        const latestData = load();
        const latestChar = getContext()?.name2;

        const u = who === 'user'
            ? { ...DEFAULTS, ...draft }
            : { ...DEFAULTS, ...latestData.user };

        const c = who === 'char'
            ? { ...DEFAULTS, ...draft }
            : { ...DEFAULTS, ...(latestChar ? (latestData.char?.[latestChar] ?? {}) : {}) };

        previewStyle(u, c);
    }

    const debouncedPreview = debounce(buildPreview, 16);

    // ── 滑块事件 ──────────────────────────────────────
    panel.find('#avp_s_x').on('input', function () {
        draft.objX = Number(this.value);
        panel.find('#avp_s_x_val').text(draft.objX + '%');
        debouncedPreview();
    });
    panel.find('#avp_s_y').on('input', function () {
        draft.objY = Number(this.value);
        panel.find('#avp_s_y_val').text(draft.objY + '%');
        debouncedPreview();
    });

    // ── 保存 ──────────────────────────────────────────
    panel.find('#avp-overlay-save').on('click', function () {
        const currentData = load();
        const payload = { objX: draft.objX, objY: draft.objY };

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
            panel.find('#avp-panel-status')
                .text(`已保存到主题: ${getCurrentTheme()} ✓`)
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
        draft.objX = 50;
        draft.objY = 50;
        panel.find('#avp_s_x').val(50);
        panel.find('#avp_s_y').val(50);
        panel.find('#avp_s_x_val').text('50%');
        panel.find('#avp_s_y_val').text('50%');
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

    // 角色切换事件
    // 如果你的 ST 版本支持 eventSource，可改为：
    //   import { eventSource, event_types } from '../../../../script.js';
    //   eventSource.on(event_types.CHARACTER_SELECTED, () => setTimeout(applyStyle, 100));
    document.addEventListener('characterSelected', () => setTimeout(applyStyle, 100));

    // 主题切换事件（同时监听两个候选选择器，兼容不同 ST 版本）
    // ⚠️ 在控制台运行以下代码确认你的 ST 用哪个选择器：
    //   console.log(jQuery('#style_file').val(), jQuery('#themes').val())
    jQuery(document).on('change', '#style_file, #themes', () => {
        console.log('[AVP] 主题切换为:', getCurrentTheme());
        setTimeout(applyStyle, 200);
    });
});