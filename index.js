import { getContext } from '../../../extensions.js';

const EXT_NAME  = 'avatar-position';
const STORAGE_KEY = 'avp_settings';

const DEFAULTS = {
    user: { top: 0, left: 0, objX: 50, objY: 50 },
    char: {}
};

// ── 存储 ────────────────────────────────────────────
function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(DEFAULTS); }
    catch { return structuredClone(DEFAULTS); }
}
function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

// ── 应用样式 ─────────────────────────────────────────
function applyStyle() {
    const data     = load();
    const charName = getContext()?.name2;
    const c = (charName && data.char?.[charName]) || { top: 0, left: 0, objX: 50, objY: 50 };
    const u = data.user || DEFAULTS.user;

    let el = document.getElementById('avp-injected-style');
    if (!el) { el = document.createElement('style'); el.id = 'avp-injected-style'; document.head.appendChild(el); }

    el.textContent = `
        #chat .mes.me .avatar        { position:relative; top:${u.top}px; left:${u.left}px; }
        #chat .mes.me .avatar img    { object-position:${u.objX}% ${u.objY}%; }
        #chat .mes:not(.me) .avatar  { position:relative; top:${c.top}px; left:${c.left}px; }
        #chat .mes:not(.me) .avatar img { object-position:${c.objX}% ${c.objY}%; }
    `;
}

// ── 读当前草稿（未保存的预览值）─────────────────────
let _draft = null;   // { who:'user'|'char', type:'pos'|'obj', top, left, objX, objY }

function getDraftBase(who) {
    const data     = load();
    const charName = getContext()?.name2;
    if (who === 'user') return { ...DEFAULTS.user, ...data.user };
    return { top:0, left:0, objX:50, objY:50, ...(charName && data.char?.[charName]) };
}

// ── 临时预览（不写 localStorage）────────────────────
function previewDraft(draft) {
    const data     = load();
    const charName = getContext()?.name2;
    let el = document.getElementById('avp-injected-style');
    if (!el) { el = document.createElement('style'); el.id = 'avp-injected-style'; document.head.appendChild(el); }

    const u = draft.who === 'user' ? draft : { ...DEFAULTS.user, ...data.user };
    const c = draft.who === 'char' ? draft : { top:0, left:0, objX:50, objY:50, ...(charName && data.char?.[charName]) };

    el.textContent = `
        #chat .mes.me .avatar        { position:relative; top:${u.top}px; left:${u.left}px; }
        #chat .mes.me .avatar img    { object-position:${u.objX}% ${u.objY}%; }
        #chat .mes:not(.me) .avatar  { position:relative; top:${c.top}px; left:${c.left}px; }
        #chat .mes:not(.me) .avatar img { object-position:${c.objX}% ${c.objY}%; }
    `;
}

// ── 1. 扩展设置里的入口按钮 ──────────────────────────
function createSettingsButton() {
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

// ── 2. 选择弹窗 ──────────────────────────────────────
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
                                <span class="avp-opt-icon">↔↕</span>
                                <span class="avp-opt-label">头像的位置</span>
                                <span class="avp-opt-sub">top / left</span>
                            </button>
                            <button class="avp-option-btn" data-who="char" data-type="obj">
                                <span class="avp-opt-icon">⊡</span>
                                <span class="avp-opt-label">图片显示位置</span>
                                <span class="avp-opt-sub">object-position</span>
                            </button>
                        </div>
                    </div>
                    <div class="avp-divider"></div>
                    <div class="avp-section">
                        <div class="avp-section-tag user-tag">USER</div>
                        <div class="avp-option-group">
                            <button class="avp-option-btn" data-who="user" data-type="pos">
                                <span class="avp-opt-icon">↔↕</span>
                                <span class="avp-opt-label">头像的位置</span>
                                <span class="avp-opt-sub">top / left</span>
                            </button>
                            <button class="avp-option-btn" data-who="user" data-type="obj">
                                <span class="avp-opt-icon">⊡</span>
                                <span class="avp-opt-label">图片显示位置</span>
                                <span class="avp-opt-sub">object-position</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);

    $('body').append(overlay);

    // 点外部关闭
    $('#avp-modal-close, #avp-modal-overlay').on('click', function(e) {
        if (e.target === this) closeModal();
    });
    $('#avp-modal').on('click', e => e.stopPropagation());

    // 选择选项
    $('.avp-option-btn').on('click', function() {
        const who  = $(this).data('who');
        const type = $(this).data('type');
        closeModal();
        showChatOverlay(who, type);
    });

    // 动画入场
    requestAnimationFrame(() => overlay.addClass('avp-visible'));
}

function closeModal() {
    $('#avp-modal-overlay').removeClass('avp-visible');
    setTimeout(() => $('#avp-modal-overlay').remove(), 260);
}

// ── 3. Chat 内悬浮滑块面板 ───────────────────────────
function showChatOverlay(who, type) {
    $('#avp-chat-overlay').remove();

    const base    = getDraftBase(who);
    _draft        = { who, type, ...base };
    const isPos   = type === 'pos';
    const whoLabel = who === 'char' ? 'CHAR' : 'USER';
    const typeLabel = isPos ? '位置偏移' : '图片焦点';

    const sliderA = isPos
        ? { id:'avp_s_a', label:'Top',    min:-100, max:100, val:base.top,  unit:'px' }
        : { id:'avp_s_a', label:'X 轴',   min:0,    max:100, val:base.objX, unit:'%'  };
    const sliderB = isPos
        ? { id:'avp_s_b', label:'Left',   min:-100, max:100, val:base.left, unit:'px' }
        : { id:'avp_s_b', label:'Y 轴',   min:0,    max:100, val:base.objY, unit:'%'  };

    const panel = $(`
        <div id="avp-chat-overlay">
            <div id="avp-chat-panel">
                <div class="avp-panel-header">
                    <div class="avp-panel-tags">
                        <span class="avp-tag ${who}-tag">${whoLabel}</span>
                        <span class="avp-tag-label">${typeLabel}</span>
                    </div>
                    <button class="avp-close-btn" id="avp-overlay-close">✕</button>
                </div>
                <div class="avp-slider-block">
                    <div class="avp-slider-row">
                        <span class="avp-slider-label">${sliderA.label}</span>
                        <input type="range" id="${sliderA.id}" min="${sliderA.min}" max="${sliderA.max}" step="1" value="${sliderA.val}">
                        <span class="avp-slider-val" id="${sliderA.id}_val">${sliderA.val}${sliderA.unit}</span>
                    </div>
                    <div class="avp-slider-row">
                        <span class="avp-slider-label">${sliderB.label}</span>
                        <input type="range" id="${sliderB.id}" min="${sliderB.min}" max="${sliderB.max}" step="1" value="${sliderB.val}">
                        <span class="avp-slider-val" id="${sliderB.id}_val">${sliderB.val}${sliderB.unit}</span>
                    </div>
                </div>
                <div class="avp-panel-footer">
                    <button class="avp-btn-ghost" id="avp-overlay-reset">重置</button>
                    <button class="avp-btn-ghost" id="avp-overlay-cancel">取消</button>
                    <button class="avp-btn-save" id="avp-overlay-save">保存</button>
                </div>
                <div class="avp-panel-status" id="avp-panel-status"></div>
            </div>
        </div>
    `);

    $('body').append(panel);

    // 拖动手柄
    let dragging = false, startX = 0, startY = 0;
    let panelX = 0, panelY = 0;
    const $p = $('#avp-chat-panel');

    $('#avp-chat-panel .avp-panel-header').on('mousedown touchstart', function(e) {
        dragging = true;
        const pt = e.touches ? e.touches[0] : e;
        const rect = $p[0].getBoundingClientRect();
        startX = pt.clientX - rect.left;
        startY = pt.clientY - rect.top;
        $p.css('transition', 'none');
    });
    $(document).on('mousemove.avp touchmove.avp', function(e) {
        if (!dragging) return;
        const pt = e.touches ? e.touches[0] : e;
        panelX = pt.clientX - startX;
        panelY = pt.clientY - startY;
        $p.css({ left: panelX + 'px', top: panelY + 'px', transform: 'none', bottom: 'auto', right: 'auto' });
    });
    $(document).on('mouseup.avp touchend.avp', () => { dragging = false; });

    // 滑块实时预览
    const unitA = sliderA.unit, unitB = sliderB.unit;
    $(`#${sliderA.id}`).on('input', function() {
        $(`#${sliderA.id}_val`).text(this.value + unitA);
        updateDraftFromSliders(isPos, unitA, unitB);
        previewDraft(_draft);
    });
    $(`#${sliderB.id}`).on('input', function() {
        $(`#${sliderB.id}_val`).text(this.value + unitB);
        updateDraftFromSliders(isPos, unitA, unitB);
        previewDraft(_draft);
    });

    // 保存
    $('#avp-overlay-save').on('click', () => {
        const data = load();
        if (who === 'user') {
            data.user = { top:_draft.top, left:_draft.left, objX:_draft.objX, objY:_draft.objY };
        } else {
            const charName = getContext()?.name2;
            if (!charName) return overlayStatus('请先选择角色', '#f87171');
            if (!data.char) data.char = {};
            data.char[charName] = { top:_draft.top, left:_draft.left, objX:_draft.objX, objY:_draft.objY };
        }
        save(data);
        applyStyle();
        overlayStatus('已保存 ✓', '#4ade80');
        setTimeout(closeChatOverlay, 900);
    });

    // 重置
    $('#avp-overlay-reset').on('click', () => {
        const reset = isPos
            ? { top:0, left:0, objX:_draft.objX, objY:_draft.objY }
            : { top:_draft.top, left:_draft.left, objX:50, objY:50 };
        _draft = { ..._draft, ...reset };
        $(`#${sliderA.id}`).val(isPos ? reset.top  : reset.objX);
        $(`#${sliderB.id}`).val(isPos ? reset.left : reset.objY);
        $(`#${sliderA.id}_val`).text((isPos ? reset.top  : reset.objX) + unitA);
        $(`#${sliderB.id}_val`).text((isPos ? reset.left : reset.objY) + unitB);
        previewDraft(_draft);
    });

    // 取消
    $('#avp-overlay-cancel').on('click', () => {
        applyStyle();   // 还原
        closeChatOverlay();
    });
    $('#avp-overlay-close').on('click', () => {
        applyStyle();
        closeChatOverlay();
    });

    requestAnimationFrame(() => panel.addClass('avp-visible'));
}

function updateDraftFromSliders(isPos, unitA, unitB) {
    const a = Number($('#avp_s_a').val());
    const b = Number($('#avp_s_b').val());
    if (isPos) { _draft.top = a; _draft.left = b; }
    else       { _draft.objX = a; _draft.objY = b; }
}

function closeChatOverlay() {
    $(document).off('mousemove.avp touchmove.avp mouseup.avp touchend.avp');
    $('#avp-chat-overlay').removeClass('avp-visible');
    setTimeout(() => $('#avp-chat-overlay').remove(), 260);
}

function overlayStatus(msg, color) {
    $('#avp-panel-status').text(msg).css('color', color);
}

// ── 初始化 ───────────────────────────────────────────
jQuery(async () => {
    createSettingsButton();
    applyStyle();
    document.addEventListener('characterSelected', () => { applyStyle(); });
});
