/** @typedef {import('@types/function/script').Script} Script */
/** @typedef {import('@types/function/script').ScriptTree} ScriptTree */

function getExtensionFolder() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const match = import.meta.url.match(/\/third-party\/([^/]+)\//);
      if (match) return match[1];
    }
  } catch {
    /* ignore */
  }
  return 'CharacterCardDirector';
}

const EXT_FOLDER = getExtensionFolder();
const EXT_NAME = '角色卡编排器';
const CLEANUP_KEY = '__wbSwipeQrCleanup';
const INIT_DONE_KEY = '__wbSwipeQrInitDone';
const RETURN_BTN_CLASS = 'wb-sq-return-directory-mes';
const DIRECTORY_SENTINEL = '<!--WB_SQ_OPENING_DIRECTORY v1-->';
const EXT_KEY = 'worldbook_swipe_qr_switch';
const MAX_ATTEMPTS = 60;
const RETRY_MS = 500;

/** @type {ReturnType<typeof setInterval> | null} */
let return_btn_timer = null;

function findChatPage() {
  for (const win of [window, window.parent, window.top].filter(Boolean)) {
    try {
      const $ = win.jQuery || win.$;
      if ($ && win.document?.querySelector('#chat')) {
        return { win, $, doc: win.document };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function syncReturnDirectoryButtonBootstrap() {
  if (typeof window.__wbSqSyncReturnDirectory === 'function') {
    window.__wbSqSyncReturnDirectory();
    return true;
  }

  const ctx = findChatPage();
  if (!ctx) return false;

  const getChatMessagesFn = typeof getChatMessages === 'function' ? getChatMessages : ctx.win.getChatMessages;
  const getCharDataFn = typeof getCharData === 'function' ? getCharData : ctx.win.getCharData;
  const setChatMessagesFn = typeof setChatMessages === 'function' ? setChatMessages : ctx.win.setChatMessages;
  if (typeof getChatMessagesFn !== 'function' || typeof setChatMessagesFn !== 'function') return false;

  const msg0 = getChatMessagesFn(0, { include_swipes: true })?.[0];
  if (!msg0 || (msg0.swipe_id ?? 0) <= 0) {
    ctx.$(`.${RETURN_BTN_CLASS}`, ctx.doc).remove();
    return false;
  }

  let directory_enabled = false;
  let has_bindings = false;
  try {
    const data = typeof getCharDataFn === 'function' ? getCharDataFn('current') : null;
    const ext = data?.data?.extensions?.[EXT_KEY] || data?.extensions?.[EXT_KEY];
    if (ext?.opening_directory?.enabled === true) directory_enabled = true;
    if (data?.first_mes && String(data.first_mes).includes(DIRECTORY_SENTINEL)) directory_enabled = true;
    const bindings = ext?.swipe_bindings || {};
    const rules = ext?.swipe_prefix_rules || {};
    if (Object.keys(bindings).length > 0 || Object.keys(rules).length > 0) has_bindings = true;
  } catch {
    /* ignore */
  }
  if (!directory_enabled) {
    for (const text of msg0.swipes ?? []) {
      if (String(text || '').includes(DIRECTORY_SENTINEL)) {
        directory_enabled = true;
        break;
      }
    }
  }
  if (!directory_enabled && !has_bindings) {
    ctx.$(`.${RETURN_BTN_CLASS}`, ctx.doc).remove();
    return false;
  }

  const $edit = ctx.$('#chat .mes[mesid="0"] .mes_edit', ctx.doc).first();
  if (!$edit.length) return false;
  if ($edit.next(`.${RETURN_BTN_CLASS}`).length) return true;

  ctx.$(`.${RETURN_BTN_CLASS}`, ctx.doc).remove();
  ctx
    .$('<div>')
    .addClass(`${RETURN_BTN_CLASS} mes_button interactable`)
    .attr({
      title: directory_enabled ? '返回开场白目录' : '返回第一个开局（Swipe #0）',
      tabindex: '0',
      role: 'button',
    })
    .append(ctx.$('<i>').addClass('fa-solid fa-list'))
    .on('click', event => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      Promise.resolve(setChatMessagesFn([{ message_id: 0, swipe_id: 0 }], { refresh: 'affected' }));
    })
    .insertAfter($edit);
  return true;
}

function startReturnDirectoryButtonWatcher() {
  if (return_btn_timer) clearInterval(return_btn_timer);
  if (window[INIT_DONE_KEY]) {
    if (typeof window.__wbSqSyncReturnDirectory === 'function') {
      window.__wbSqSyncReturnDirectory();
    }
    return;
  }
  syncReturnDirectoryButtonBootstrap();
  return_btn_timer = setInterval(() => {
    if (window[INIT_DONE_KEY] || typeof window.__wbSqSyncReturnDirectory === 'function') {
      clearInterval(return_btn_timer);
      return_btn_timer = null;
      if (typeof window.__wbSqSyncReturnDirectory === 'function') {
        window.__wbSqSyncReturnDirectory();
      }
      return;
    }
    syncReturnDirectoryButtonBootstrap();
  }, 1500);
}

function stopReturnDirectoryButtonWatcher() {
  if (return_btn_timer) clearInterval(return_btn_timer);
  return_btn_timer = null;
  // 不删除返回目录按钮：角色卡独立脚本可能仍在运行，由脚本自行维护
}

/** @returns {Record<string, Function> | null} */
function getTavernHelper() {
  const th = window.TavernHelper;
  if (!th || typeof th !== 'object') return null;
  return th;
}

function getThFn(name) {
  const th = getTavernHelper();
  if (th && typeof th[name] === 'function') return th[name].bind(th);
  const globalFn = window[name];
  if (typeof globalFn === 'function') return globalFn;
  return null;
}

function isTavernHelperReady() {
  return typeof getThFn('getVariables') === 'function';
}

function installThGlobalsOnWindow() {
  const w = window;
  const th = w.TavernHelper;
  if (!th || typeof th !== 'object') return false;

  const CORE = [
    'getVariables',
    'insertOrAssignVariables',
    'replaceVariables',
    'getWorldbook',
    'updateWorldbookWith',
    'getCharWorldbookNames',
    'getChatMessages',
    'setChatMessages',
    'getCurrentCharacterName',
    'getCharData',
    'getCharacter',
    'updateCharacterWith',
    'triggerSlash',
  ];

  for (const name of CORE) {
    const val = th[name];
    if (typeof val === 'function' && typeof w[name] !== 'function') {
      w[name] = val.bind(th);
    }
  }

  for (const key of Object.keys(th)) {
    const val = th[key];
    if (typeof val !== 'function') continue;
    if (typeof w[key] === 'function') continue;
    w[key] = val.bind(th);
  }

  const findSt = () => {
    for (const win of [w, w.parent, w.top].filter(Boolean)) {
      try {
        if (win?.SillyTavern) return win.SillyTavern;
      } catch {
        /* ignore */
      }
    }
    return w.SillyTavern;
  };

  const st = findSt();
  if (st?.eventSource) {
    const es = st.eventSource;
    const pairs = [
      ['eventOn', 'on'],
      ['eventOnce', 'once'],
      ['eventClearEvent', 'removeListener'],
      ['eventEmit', 'emit'],
    ];
    for (const [globalName, sourceName] of pairs) {
      const fn = es[sourceName];
      if (typeof fn === 'function' && typeof w[globalName] !== 'function') {
        w[globalName] = fn.bind(es);
      }
    }
  }
  if (st?.eventTypes && w.tavern_events == null) {
    w.tavern_events = st.eventTypes;
  }

  return CORE.every(name => typeof w[name] === 'function');
}

function cleanupExtensionDom() {
  jQuery(
    '#wb-sq-modal, #wb-sq-style, #wb-sq-ext-menu-btn, #wb-sq-prefix-bar, .wb-sq-prefix-bar, .wb-sq-mes-btn',
  ).remove();

  const cleanup = window[CLEANUP_KEY];
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch (e) {
      console.warn('[CharacterCardDirector] cleanup 失败', e);
    }
  }
  delete window[CLEANUP_KEY];
  delete window[INIT_DONE_KEY];
}

function cleanupExtensionDomFully() {
  cleanupExtensionDom();
  stopReturnDirectoryButtonWatcher();
  const ctx = findChatPage();
  if (ctx) ctx.$(`.${RETURN_BTN_CLASS}`, ctx.doc).remove();
}

let loading = false;

async function loadAndInit() {
  if (window[INIT_DONE_KEY] || loading) return;
  loading = true;
  try {
    installThGlobalsOnWindow();
    const mod = await import(`./index.js`);
    if (typeof mod.installTavernHelperGlobals === 'function') {
      mod.installTavernHelperGlobals();
    }
    if (typeof mod.initWorldbookDirector !== 'function') {
      throw new Error('index.js 缺少 initWorldbookDirector');
    }
    mod.initWorldbookDirector({ extensionId: EXT_FOLDER });
    window[INIT_DONE_KEY] = true;
  } finally {
    loading = false;
  }
}

function onTavernHelperReady() {
  installThGlobalsOnWindow();
  startReturnDirectoryButtonWatcher();
  loadAndInit().catch(e => {
    console.error('[CharacterCardDirector] 加载失败', e);
    const detail = e instanceof Error ? e.message : String(e ?? '未知错误');
    toastr.error(
      `角色卡编排器加载失败：${detail}。若已启用酒馆助手仍失败，请刷新或重新安装本拓展。`,
      EXT_NAME,
    );
  });
}

function waitForTavernHelper(attempt = 0) {
  if (isTavernHelperReady()) {
    onTavernHelperReady();
    return;
  }
  if (attempt >= MAX_ATTEMPTS) {
    toastr.warning('未检测到酒馆助手接口。请安装并启用「酒馆助手 (JS-Slash-Runner)」后刷新。', EXT_NAME);
    return;
  }
  setTimeout(() => waitForTavernHelper(attempt + 1), RETRY_MS);
}

export async function onDelete() {
  cleanupExtensionDomFully();
}

export async function onDisable() {
  cleanupExtensionDom();
  // 拓展 UI 关闭后仍保留返回目录按钮兜底（角色卡独立脚本未启用时）
  startReturnDirectoryButtonWatcher();
}

export async function onEnable() {
  waitForTavernHelper();
}

// onEnable + 首次加载时 jQuery ready 均可能触发；loadAndInit 内去重
jQuery(() => {
  waitForTavernHelper();
});
