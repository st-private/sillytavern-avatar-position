import { getContext } from '../../../extensions.js';

const EXT_NAME  = 'avatar-position';
const STORAGE_KEY = 'avp_settings';

const DEFAULTS = {
    user: { top: 0, left: 0, objX: 50, objY: 50 },
    char: {}
};

// ── 工具函数 ────────────────────────────────────────────
function getCurrentTheme() {
    return jQuery('#style_file').val() || 'default';
}

function load() {
    try {
        const allData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        const theme = getCurrentTheme();
        return allData[theme] || structuredClone(DEFAULTS);
    }
    catch { return structuredClone(DEFAULTS); }
}

function save(currentThemeData) {
    try {
        const allData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        const theme = getCurrentTheme();
        allData[theme] = currentThemeData;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
    } catch (e) {
        console.error("AVP Save Error:", e);
    }
}

// ── 应用样式 ─────────────────────────────────────────
function applyStyle() {
    const data = load();
    const charName = getContext()?.name2;
    const c = (charName && data.char?.[charName]) || { top: 0, left: 0, objX: 50, objY: 50 };
    const u = data.user || DEFAULTS.user;

    let el = document.getElementById('avp-injected-style');
    if (!el) { el = document.createElement('style'); el.id = 'avp-injected-style'; document.head.appendChild(el); }

    el.textContent = `
        #chat .mes[is_user="true"] .avatar      { transform: translate(${u.left}px, ${u.top}px); }
        #chat .mes[is_user="true"] .avatar img  { object-position:${u.objX}% ${u.objY}%; }
        #chat .mes[is_user="false"] .avatar     { transform: translate(${c.left}px, ${c.top}px); }
        #chat .mes[is_user="false"] .avatar img { object-position:${c.objX}% ${c.objY}%; }
    `;
}

let _draft = null;

function previewDraft(draft) {
    const data = load();
    const charName = getContext()?.name2;
    let el = document.getElementById('avp-injected-style');
    if (!el) { el = document.createElement('style'); el.id = 'avp-injected-style'; document.head.appendChild(el); }

    const u = draft.who === 'user' ? draft : { ...DEFAULTS.user, ...data.user };
    const c = draft.who === 'char' ? draft : { top:0, left:0, objX:50, objY:50, ...(charName && data.char?.[charName]) };

    el.textContent = `
        #chat .mes[is_user="true"] .avatar      { transform: translate(${u.left}px, ${u.top}px); }
        #chat .mes[is_user="true"] .avatar img  { object-position:${u.objX}% ${u.objY}%; }
        #chat .mes[is_user="false"] .avatar     { transform: translate(${c.left}px, ${c.top}px); }
        #chat .mes[is_user="false"] .avatar img { object-position:${c.objX}% ${c.objY}%; }
    `;
}

function getDraftBase(who) {
    const data = load();
    const charName = getContext()?.name2;
    if (who === 'user') return { ...DEFAULTS.user, ...data.user };
    return { top:0, left:0, objX:50, objY:50, ...(charName && data.char?.[charName]) };
}

// ── UI 控制 ──────────────────────────────────────────
function createSettingsButton() {
    $('#avp-settings-entry').remove(); // 核心：防止出现两个按钮
    const wrap = $(`
        <div id="avp-settings-entry">
            <div class="avp-entry-label">Avatar Position</div>
            <button id="avp-open-modal" class="avp-btn-primary">
                <span class="avp-btn-icon">⊹</span> 调整头像
            </button>
        </div>
    `);
    $('#extensions_settings').append(wrap);
    $('#avp-open-modal').on('click', showModal);
}

function showModal() {
    $('#avp-modal-overlay').remove();
    const overlay = $(`
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
                            <button class="avp-option-btn" data-who="char" data-type="pos">
                                <span class="avp-opt-icon">↔↕</span><span class="avp-opt-label">位置偏移</span>
                            </button>
                            <button class="avp-option-btn" data-who="char" data-type="obj">
                                <span class="avp-opt-icon">⊡</span><span class="avp-opt-label">图片焦点</span>
                            </button>
                        </div>
                    </div>
                    <div class="avp-divider"></div>
                    <div class="avp-section">
                        <div class="avp-section-tag user-tag">USER</div>
                        <div class="avp-option-group">
                            <button class="avp-option-btn" data-who="user" data-type="pos">
                                <span class="avp-opt-icon">↔↕</span><span class="avp-opt-label">位置偏移</span>
                            </button>
                            <button class="avp-option-btn" data-who="user" data-type="obj">
                                <span class="avp-opt-icon">⊡</span><span class="avp-opt-label">图片焦点</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);
    $('body').append(overlay);
    $('#avp-modal-close, #avp-modal-overlay').on('click', function(e) { if (e.target === this) closeModal(); });
    $('.avp-option-btn').on('click', function() {
        const who = $(this).data('who');
        const type = $(this).data('type');
        closeModal();
        showChatOverlay(who, type);
    });
    requestAnimationFrame(() => overlay.addClass('avp-visible'));
}

function closeModal() {
    $('#avp-modal-overlay').removeClass('avp-visible');
    setTimeout(() => $('#avp-modal-overlay').remove(), 260);
}

function showChatOverlay(who, type) {
    $('#avp-chat-overlay').remove();
    const base = getDraftBase(who);
    _draft = { who, type, ...base };
    const isPos = type === 'pos';
    
    const sliderA = isPos ? { id:'avp_s_a', label:'Top', min:-200, max:200, val:base.top, unit:'px' } : { id:'avp_s_a', label:'X 轴', min:0, max:100, val:base.objX, unit:'%' };
    const sliderB = isPos ? { id:'avp_s_b', label:'Left', min:-200, max:200, val:base.left, unit:'px' } : { id:'avp_s_b', label:'Y 轴', min:0, max:100, val:base.objY, unit:'%' };

    const panel = $(`
        <div id="avp-chat-overlay">
            <div id="avp-chat-panel">
                <div class="avp-panel-header">
                    <div class="avp-panel-tags"><span class="avp-tag ${who}-tag">${who.toUpperCase()}</span></div>
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
                    <button class="avp-btn-save" id="avp-overlay-save">保存到当前主题</button>
                </div>
                <div class="avp-panel-status" id="avp-panel-status"></div>
            </div>
        </div>
    `);

    $('body').append(panel);

    // 拖动逻辑
    let dragging = false, startX, startY;
    const $p = $('#avp-chat-panel');
    $p.find('.avp-panel-header').on('mousedown touchstart', function(e) {
        dragging = true;
        const pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX - $p.offset().left;
        startY = pt.clientY - $p.offset().top;
        $p.css('transition', 'none');
    });
    $(document).on('mousemove.avp touchmove.avp', function(e) {
        if (!dragging) return;
        const pt = e.touches ? e.touches[0] : e;
        $p.css({ left: (pt.clientX - startX) + 'px', top: (pt.clientY - startY) + 'px', bottom: 'auto', right: 'auto', transform: 'none' });
    });
    $(document).on('mouseup.avp touchend.avp', () => dragging = false);

    // 实时预览
    $(`#${sliderA.id}, #${sliderB.id}`).on('input', function() {
        const val = Number(this.value);
        if (this.id === 'avp_s_a') { 
            isPos ? _draft.top = val : _draft.objX = val;
            $(`#${sliderA.id}_val`).text(val + sliderA.unit);
        } else {
            isPos ? _draft.left = val : _draft.objY = val;
            $(`#${sliderB.id}_val`).text(val + sliderB.unit);
        }
        previewDraft(_draft);
    });

    $('#avp-overlay-save').on('click', () => {
        const data = load();
        if (who === 'user') {
            data.user = { top:_draft.top, left:_draft.left, objX:_draft.objX, objY:_draft.objY };
        } else {
            const charName = getContext()?.name2;
            if (!charName) return $('#avp-panel-status').text('未识别到角色').css('color', '#f87171');
            if (!data.char) data.char = {};
            data.char[charName] = { top:_draft.top, left:_draft.left, objX:_draft.objX, objY:_draft.objY };
        }
        save(data);
        applyStyle();
        $('#avp-panel-status').text('已绑定到当前主题 ✓').css('color', '#4ade80');
        setTimeout(closeChatOverlay, 800);
    });

    $('#avp-overlay-reset').on('click', () => {
        const reset = isPos ? { top:0, left:0 } : { objX:50, objY:50 };
        Object.assign(_draft, reset);
        $(`#${sliderA.id}`).val(isPos ? 0 : 50);
        $(`#${sliderB.id}`).val(isPos ? 0 : 50);
        $(`#${sliderA.id}_val`).text((isPos ? 0 : 50) + sliderA.unit);
        $(`#${sliderB.id}_val`).text((isPos ? 0 : 50) + sliderB.unit);
        previewDraft(_draft);
    });

    $('#avp-overlay-close').on('click', () => { applyStyle(); closeChatOverlay(); });
    requestAnimationFrame(() => panel.addClass('avp-visible'));
}

function closeChatOverlay() {
    $(document).off('.avp');
    $('#avp-chat-overlay').remove();
}

// ── 初始化 ───────────────────────────────────────────
jQuery(async () => {
    createSettingsButton();
    applyStyle();
    document.addEventListener('characterSelected', applyStyle);
    $(document).on('change', '#style_file', () => setTimeout(applyStyle, 150));
});