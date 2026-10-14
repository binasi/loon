/**
 * WorkBuddy 每日自动签到
 *
 * WorkBuddy（腾讯云代码助手推出的 AI Agent 办公工具）按日发放免费额度的签到脚本。
 * 由于该产品采用微信/QQ/腾讯云扫码等第三方登录，无法用账号密码自动登录，
 * 因此采用「抓取一次认证信息（Cookie / Bearer Token）+ 每天定时重放签到请求」方案：
 *   ① workbuddy.cookie.js：登录态下自动截获并保存认证信息（需 MitM）
 *   ② 本脚本：每天按 cron 用保存的认证信息请求「签到接口」
 *
 * 签到接口 URL 无法远程探测，需你登录后抓包一次（F12 → Network → 点签到 → Copy as cURL /
 * 复制 URL + 请求方法 + 必要 body），填入插件「签到接口URL」即可。
 *
 * 输入方式（三选一）：
 *   ① 插件参数模式（推荐）：插件中填 sign_url，认证值留空自动读抓取脚本缓存，或手动粘贴
 *   ② 字符串参数模式：把 Cookie 串（或 "Bearer xxx"）作为 $argument 直接传入
 *
 * @Author: binasi <https://github.com/binasi/loon>
 * @Updated: 2026-10-14
 *
 * ===== Loon（3.5.1+）=====
 * [Argument]
 * sign_url = input,"",tag=签到接口URL,desc=必填：抓包得到的签到接口完整 URL
 * sign_method = select,POST,GET,tag=请求方法,desc=默认 POST
 * auth_mode = select,cookie,token,tag=认证方式,desc=cookie=完整Cookie串；token=Authorization Bearer
 * auth_value = input,"",tag=认证值(选填),desc=留空自动读抓取脚本缓存
 * extra_headers = input,"",tag=额外请求头(JSON),desc=选填，如 {"x-sign":"abc"}；接口带签名/风控头时填
 * body = input,"",tag=请求体(选填),desc=POST 时原样发送；留空则不发送 body
 * cron = input,"0 9 * * *",tag=签到时间,desc=Cron 表达式，默认每天 09:00
 * debug = switch,false,tag=调试模式,desc=记录请求与响应详情
 *
 * [Script]
 * cron ${cron} then script("https://raw.githubusercontent.com/binasi/loon/main/workbuddy/workbuddy.js", {${sign_url}, ${sign_method}, ${auth_mode}, ${auth_value}, ${extra_headers}, ${body}, ${debug}}) with tag="WorkBuddy签到", timeout=120
 */

const SCRIPT_VERSION = "2026-10-14.r1";

// ===== 【抓包后适配：改这里】 =====
const CONFIG = {
  name: "WorkBuddy",          // 通知标题
  storeKey: "workbuddy_auth", // 与 workbuddy.cookie.js 保持一致
  signUrl: "",                // 默认签到接口 URL（用插件参数优先；此处留给字符串参数模式兜底）
  signMethod: "POST",         // 默认请求方法
  authMode: "cookie"          // 默认认证方式
};
// =====================================

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let finished = false;
function done() {
  if (!finished) {
    finished = true;
    $done();
  }
}

function log(msg) {
  console.log("[" + CONFIG.name + "] " + msg);
}

function notify(title, content) {
  $notification.post(CONFIG.name, title, content);
}

// ---------- 工具 ----------
function headerOf(headers, name) {
  if (!headers) return "";
  const lower = String(name).toLowerCase();
  for (const k in headers) {
    if (String(k).toLowerCase() === lower) {
      const v = headers[k];
      return v === null || v === undefined ? "" : String(v);
    }
  }
  return "";
}

function originOf(url) {
  const m = /^(https?:\/\/[^/]+)/.exec(url || "");
  return m ? m[1] : "";
}

function httpRequest(method, options) {
  return new Promise(function (resolve) {
    const cb = function (error, response, data) {
      resolve({ error: error, response: response, data: data });
    };
    if (method === "GET") $httpClient.get(options, cb);
    else $httpClient.post(options, cb);
  });
}

// ---------- 参数解析 ----------
function parseArgument() {
  const arg = typeof $argument !== "undefined" ? $argument : null;

  if (arg && typeof arg === "object") {
    return {
      mode: "plugin",
      signUrl: (arg.sign_url || CONFIG.signUrl || "").toString().trim(),
      signMethod: (arg.sign_method || CONFIG.signMethod).toString().toUpperCase(),
      authMode: (arg.auth_mode || CONFIG.authMode).toString().toLowerCase(),
      authValue: (arg.auth_value || "").toString().trim(),
      extraHeaders: (arg.extra_headers || "").toString().trim(),
      body: (arg.body || "").toString(),
      debug: !!arg.debug
    };
  }

  if (typeof arg === "string" && arg.trim()) {
    const v = arg.trim();
    return {
      mode: "plugin",
      signUrl: CONFIG.signUrl,
      signMethod: CONFIG.signMethod,
      authMode: /^Bearer\s+/i.test(v) ? "token" : "cookie",
      authValue: v,
      extraHeaders: "",
      body: "",
      debug: false
    };
  }

  return {
    mode: "plugin",
    signUrl: CONFIG.signUrl,
    signMethod: CONFIG.signMethod,
    authMode: CONFIG.authMode,
    authValue: "",
    extraHeaders: "",
    body: "",
    debug: false
  };
}

function resolveAuth(cfg) {
  let cookie = "";
  let token = "";

  if (cfg.authValue) {
    if (/^Bearer\s+/i.test(cfg.authValue)) token = cfg.authValue.replace(/^Bearer\s+/i, "");
    else if (cfg.authMode === "token") token = cfg.authValue;
    else cookie = cfg.authValue;
  } else {
    const raw = $persistentStore.read(CONFIG.storeKey) || "";
    try {
      const o = JSON.parse(raw);
      cookie = o.cookie || "";
      token = o.token || "";
    } catch (e) {
      cookie = raw; // 兼容旧格式：直接存的 Cookie 串
    }
  }

  if (cfg.authMode === "token") return token ? token : cookie;
  return cookie ? cookie : token;
}

// ---------- 响应判定 ----------
function classify(status, body, text) {
  const msg = (body &&
    (body.message || body.msg || body.error_msg || body.errorMessage || body.desc || body.reason) ||
    "").toString();

  // 1) 登录态失效
  if (status === 401 || status === 403 ||
    /未登录|请先登录|登录已失效|未授权|登录过期|请重新登录|token.*(invalid|expired|失效|无效)/i.test(msg)) {
    return { title: "⚠️ 认证已失效", content: "请重新打开 WorkBuddy 并保持登录，触发自动抓取（或手动更新认证值）" };
  }

  // 2) 今日已签到
  if (/已签到|已经签到|重复签到|今日已签|already[ -]?sign|repeat/i.test(msg)) {
    return { title: "ℹ️ 今日已签到", content: msg || "今天已经签到过了" };
  }

  // 3) 成功
  const ok = !!(body &&
    (body.success === true || body.code === 0 || body.code === 200 || body.ret === 0 || body.retcode === 0));
  if (ok) {
    const d = body.data || {};
    const bonus = (d.bonus !== undefined && d.bonus !== null) ? d.bonus
      : (d.points !== undefined && d.points !== null) ? d.points
      : (d.amount !== undefined && d.amount !== null) ? d.amount
      : (d.integral !== undefined && d.integral !== null) ? d.integral
      : "";
    return { title: "✅ 签到成功", content: msg || (String(bonus) !== "" ? "获得 " + bonus : "签到成功") };
  }

  // 4) 其他失败
  return { title: "❌ 签到失败", content: msg || "HTTP " + status + "：" + String(text).slice(0, 160) };
}

// ---------- 签到 ----------
async function doSign(cfg) {
  const auth = resolveAuth(cfg);
  if (!auth) {
    notify("🚫 未获取到认证信息", "请在插件「认证值」手动粘贴 Cookie/Token，或用 workbuddy.cookie.js 抓取一次");
    return;
  }

  const origin = originOf(cfg.signUrl);
  const headers = {
    "Accept": "application/json",
    "User-Agent": UA
  };
  if (origin) {
    headers["Referer"] = origin + "/";
    headers["Origin"] = origin;
  }
  if (cfg.authMode === "token") headers["Authorization"] = "Bearer " + auth;
  else headers["Cookie"] = auth;

  // 额外请求头（签名/风控头等）
  if (cfg.extraHeaders) {
    try {
      const extra = JSON.parse(cfg.extraHeaders);
      if (extra && typeof extra === "object") {
        for (const k in extra) headers[k] = String(extra[k]);
      }
    } catch (e) {
      notify("❌ 配置错误", "extra_headers 不是合法 JSON：\n" + cfg.extraHeaders);
      return;
    }
  }

  const options = { url: cfg.signUrl, headers: headers, timeout: 15000 };
  if (cfg.signMethod === "POST" && cfg.body) options.body = cfg.body;

  if (cfg.debug) {
    log("请求 " + cfg.signMethod + " " + cfg.signUrl);
    log("认证方式 " + cfg.authMode + " | 认证值长度 " + auth.length + " | Body: " + (options.body || "(无)"));
  }

  const r = await httpRequest(cfg.signMethod, options);
  if (r.error) {
    notify("❌ 网络请求失败", String(r.error));
    return;
  }

  const status = r.response && r.response.status ? r.response.status : 0;
  let body = null;
  try { body = JSON.parse(r.data); } catch (e) {}
  if (cfg.debug) log("HTTP " + status + " | " + String(r.data).slice(0, 300));

  const s = classify(status, body, r.data);
  notify(s.title, s.content);
}

// ---------- 主流程 ----------
async function run() {
  log("脚本版本 " + SCRIPT_VERSION);
  const cfg = parseArgument();

  if (!cfg.signUrl) {
    notify("🚫 未配置签到接口", "请先登录 WorkBuddy，用 F12 抓一次「签到」请求，把接口 URL 填入插件「签到接口URL」（详见 README）");
    return done();
  }
  if (cfg.debug) log("签到接口 " + cfg.signMethod + " " + cfg.signUrl + " | 模式 " + cfg.authMode);

  await doSign(cfg);
  done();
}

run();