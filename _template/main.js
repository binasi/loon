/**
 * <站点显示名> 每日签到 · 模板
 *
 * 适配新站点只需改两处：
 *   ① 下方 CONFIG 里的域名、接口路径、通知标题
 *   ② 若登录参数不是 username/password，改 doLogin 里的 body（见 TODO 注释）
 *
 * 输入方式（三选一，自动识别）：
 *   ① 插件多账号参数 accounts（JSON 数组）→ 批量签到
 *   ② 插件单账号参数 username / password
 *   ③ 字符串参数 = 完整 Cookie 或本地缓存 Cookie（配合 <name>.cookie.js 备用方案）
 *
 * @Author: <你的名字> <https://github.com/<你的ID>/<你的仓库>>
 * @Updated: 2026-09-20
 *
 * ===== Loon（3.5.1+）=====
 * [Argument]
 * username = input,"",tag=账号,desc=<站点> 账号或邮箱（单账号）
 * password = input,"",tag=密码,desc=<站点> 登录密码（单账号）
 * accounts = input,"",tag=多账号(JSON),desc=选填；填写后优先；格式 [{"username":"a","password":"b"},...]
 * debug = switch,false,tag=调试模式,desc=仅记录请求状态与判定结果
 *
 * [Script]
 * cron "0 9 * * *" then script("https://raw.githubusercontent.com/<你的ID>/<你的仓库>/main/<name>/<name>.js", {${username}, ${password}, ${accounts}, ${debug}}) with tag="<站点显示名>签到", timeout=300
 */

const SCRIPT_VERSION = "2026-09-20.r1";

// ===== 【适配新站点：改这里】 =====
const CONFIG = {
  name: "<站点显示名>",                    // 通知标题用，如 "肖恩AI签到"
  base: "https://<example.com>",           // 站点地址（不带末尾斜杠）
  loginPath: "/api/<xxx>/login",           // 登录接口路径
  signinPath: "/api/<xxx>/signin",         // 签到接口路径
  refererLogin: "/login",                   // 登录页 Referer
  refererSign: "/dashboard",                // 签到页 Referer
  storeKey: "<name>_cookie"                 // 本地缓存 Cookie 的键（每个站点唯一）
};
// =====================================

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

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

// ---------- 参数解析 ----------
function parseArgument() {
  const arg = typeof $argument !== "undefined" ? $argument : null;

  if (arg && typeof arg === "object") {
    const debug = !!arg.debug;
    const raw = arg.accounts ? String(arg.accounts).trim() : "";
    if (raw) {
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length) {
          const accounts = list
            .filter((a) => a && a.username && a.password)
            .map((a) => ({ username: String(a.username).trim(), password: String(a.password) }));
          if (accounts.length) return { mode: "login", accounts: accounts, debug: debug };
        }
        return { mode: "error", message: "多账号 JSON 为空或格式不正确", debug: debug };
      } catch (e) {
        return { mode: "error", message: "多账号 JSON 解析失败：" + e.message, debug: debug };
      }
    }
    const u = arg.username ? String(arg.username).trim() : "";
    const p = arg.password ? String(arg.password) : "";
    if (u && p) return { mode: "login", accounts: [{ username: u, password: p }], debug: debug };
    return { mode: "none" };
  }

  if (typeof arg === "string" && arg.trim()) {
    return { mode: "cookie", cookie: arg.trim(), debug: false };
  }

  const saved = $persistentStore.read(CONFIG.storeKey) || "";
  if (saved) return { mode: "cookie", cookie: String(saved), debug: false };

  return { mode: "none" };
}

// ---------- 响应头工具 ----------
function headerOf(headers, name) {
  if (!headers) return "";
  const lower = String(name).toLowerCase();
  for (const k in headers) {
    if (String(k).toLowerCase() === lower) {
      const v = headers[k];
      if (Array.isArray(v)) return v.join("; ");
      return v === null || v === undefined ? "" : String(v);
    }
  }
  return "";
}

const COOKIE_ATTRS = [
  "path", "domain", "expires", "max-age", "samesite",
  "secure", "httponly", "priority", "version", "comment"
];

function extractCookie(raw) {
  if (!raw) return "";
  const text = Array.isArray(raw) ? raw.join("; ") : String(raw);
  const re = /([A-Za-z0-9_\-.]+)=([^;,]*)/g;
  const out = [];
  const seen = {};
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const value = m[2].trim();
    if (COOKIE_ATTRS.indexOf(name.toLowerCase()) !== -1) continue;
    if (!value) continue;
    if (seen[name]) continue;
    seen[name] = true;
    out.push(name + "=" + value);
  }
  return out.join("; ");
}

function httpPost(options) {
  return new Promise(function (resolve) {
    $httpClient.post(options, function (error, response, data) {
      resolve({ error: error, response: response, data: data });
    });
  });
}

// ---------- 登录 ----------
async function doLogin(username, password, debug) {
  // TODO: 若登录参数名不是 username/password，改这里的 body
  const r = await httpPost({
    url: CONFIG.base + CONFIG.loginPath,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Referer": CONFIG.base + CONFIG.refererLogin,
      "Origin": CONFIG.base,
      "User-Agent": UA
    },
    body: JSON.stringify({ username: username, password: password }),
    timeout: 15000
  });

  if (r.error) return { ok: false, message: "网络请求失败：" + r.error };

  const status = r.response && r.response.status ? r.response.status : 0;
  let body = null;
  try { body = JSON.parse(r.data); } catch (e) {}

  const cookie = extractCookie(headerOf(r.response && r.response.headers, "Set-Cookie"));
  if (debug) log("登录 [" + username + "] HTTP " + status + " | Set-Cookie 长度 " + cookie.length);

  if (!body || body.success !== true) {
    return { ok: false, message: (body && body.message) || "HTTP " + status };
  }
  if (!cookie) return { ok: false, message: "登录成功但响应头未返回 Set-Cookie" };
  return { ok: true, cookie: cookie };
}

// ---------- 签到 ----------
async function doSignIn(cookie, debug) {
  const r = await httpPost({
    url: CONFIG.base + CONFIG.signinPath,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Referer": CONFIG.base + CONFIG.refererSign,
      "Origin": CONFIG.base,
      "Cookie": cookie,
      "User-Agent": UA
    },
    timeout: 15000
  });

  if (r.error) return { title: "❌ 网络请求失败", content: String(r.error) };

  const status = r.response && r.response.status ? r.response.status : 0;
  let body = null;
  try { body = JSON.parse(r.data); } catch (e) {}
  if (debug) log("签到 HTTP " + status + " | " + String(r.data).slice(0, 200));

  if (!body) {
    return { title: "❌ 响应解析失败", content: "HTTP " + status + "\n" + String(r.data).slice(0, 120) };
  }

  const msg = body.message || "";
  if (body.success) {
    const bonus = body.data && body.data.bonus !== undefined && body.data.bonus !== null ? body.data.bonus : "";
    return { title: "✅ 签到成功", content: msg || (bonus !== "" ? "获得 +" + bonus + " 额度" : "签到成功") };
  }
  if (status === 401 || /请先登录|未登录|登录已失效|未授权/.test(msg)) {
    return { title: "⚠️ 登录已失效", content: "请检查插件中填写的账号与密码" };
  }
  if (/已签到|已经签到/.test(msg)) {
    return { title: "ℹ️ 今日已签到", content: msg || "今天已经签到过了，明天再来" };
  }
  return { title: "❌ 签到失败", content: msg || "HTTP " + status };
}

function maskAccount(username) {
  if (!username) return "(未知)";
  if (username.indexOf("@") !== -1) {
    const parts = username.split("@");
    const name = parts[0];
    return (name.length > 2 ? name.slice(0, 2) : name) + "***@" + parts[1];
  }
  return username.length > 2 ? username.slice(0, 2) + "***" : username;
}

// ---------- 主流程 ----------
async function run() {
  log("脚本版本 " + SCRIPT_VERSION);
  const cfg = parseArgument();

  if (cfg.mode === "error") { notify("❌ 配置错误", cfg.message); return done(); }
  if (cfg.mode === "none") { notify("🚫 未配置账号", "请在插件设置中填写账号与密码（多账号填 accounts）"); return done(); }
  if (cfg.mode === "cookie") {
    const s = await doSignIn(cfg.cookie, cfg.debug);
    notify(s.title, s.content);
    return done();
  }

  const accounts = cfg.accounts;
  const results = [];
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const prefix = accounts.length > 1 ? "[" + (i + 1) + "/" + accounts.length + "] " : "";
    log(prefix + "开始账号: " + acc.username);

    const lr = await doLogin(acc.username, acc.password, cfg.debug);
    if (!lr.ok) {
      results.push({ username: acc.username, title: "❌ 登录失败", content: lr.message });
      continue;
    }
    if (accounts.length === 1) $persistentStore.write(lr.cookie, CONFIG.storeKey);

    const s = await doSignIn(lr.cookie, cfg.debug);
    results.push({ username: acc.username, title: s.title, content: s.content });
  }

  if (results.length === 1) {
    notify(results[0].title, results[0].content);
  } else {
    const body = results
      .map(function (r) { return "👤 " + maskAccount(r.username) + "\n" + r.title + "\n" + r.content; })
      .join("\n\n");
    notify("签到汇总（" + results.length + " 个账号）", body);
  }
  done();
}

run();