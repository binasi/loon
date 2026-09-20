/**
 * 肖恩AI 每日签到 · 免费大模型API，每日签到领 1000~3000 额度
 *
 * 抓取：无需手动抓包 —— 在 Loon 插件设置中填写账号与密码，脚本自动登录获取 Cookie
 * 签到：cron 每日定时自动登录 + 签到，通知本次获得额度
 *
 * 兼容三种输入：
 *   ① 插件对象参数 {username, password} → 自动登录（推荐）
 *   ② 字符串参数 = 完整 Cookie            → 直接用（旧用法）
 *   ③ 无参数                              → 读取本地缓存（由本脚本登录成功后写入）
 *
 * @Author: binasi <https://github.com/binasi/loon>
 * @Updated: 2026-09-20
 *
 * ===== Loon（3.5.1+）=====
 * [Argument]
 * username = input,"",tag=账号,desc=肖恩AI 账号或邮箱
 * password = input,"",tag=密码,desc=肖恩AI 登录密码
 * debug = switch,false,tag=调试模式,desc=仅记录请求状态与判定结果
 *
 * [Script]
 * cron "30 8 * * *" then script("https://raw.githubusercontent.com/binasi/loon/main/supxh/supxh.js", {${username}, ${password}, ${debug}}) with tag="肖恩AI签到", timeout=60
 */

const SCRIPT_VERSION = "2026-09-20.r2";
const BASE_URL = "https://free.supxh.xin";
const COOKIE_KEY = "supxh_cookie";
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
  console.log("[肖恩AI] " + msg);
}

// ---------- 参数解析 ----------
function parseArgument() {
  const arg = typeof $argument !== "undefined" ? $argument : null;

  // ① 插件对象参数：账号密码自动登录
  if (arg && typeof arg === "object") {
    const u = arg.username ? String(arg.username).trim() : "";
    const p = arg.password ? String(arg.password) : "";
    return { mode: "login", username: u, password: p, debug: !!arg.debug };
  }

  // ② 字符串参数：直接当 Cookie 用（向后兼容）
  if (typeof arg === "string" && arg.trim()) {
    return { mode: "cookie", cookie: arg.trim(), debug: false };
  }

  // ③ 无参数：读本地缓存
  const saved = $persistentStore.read(COOKIE_KEY) || "";
  if (saved) return { mode: "cookie", cookie: String(saved), debug: false };

  return { mode: "none" };
}

// ---------- 响应头工具：大小写不敏感、兼容数组 ----------
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

// Set-Cookie 属性名（需排除，它们不是 Cookie 名值对）
const COOKIE_ATTRS = [
  "path",
  "domain",
  "expires",
  "max-age",
  "samesite",
  "secure",
  "httponly",
  "priority",
  "version",
  "comment"
];

// 从 Set-Cookie 原文提取 "name=value; name2=value2"
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

// ---------- 登录 ----------
function doLogin(cfg, cb) {
  log("开始登录账号: " + cfg.username);
  $httpClient.post(
    {
      url: BASE_URL + "/api/auth/login",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Referer": BASE_URL + "/login",
        "Origin": BASE_URL,
        "User-Agent": UA
      },
      body: JSON.stringify({ username: cfg.username, password: cfg.password }),
      timeout: 15000
    },
    function (error, response, data) {
      if (error) {
        log("登录请求失败: " + error);
        return cb(null, "网络请求失败：" + error);
      }
      const status = response && response.status ? response.status : 0;
      let body = null;
      try {
        body = JSON.parse(data);
      } catch (e) {}

      const rawSetCookie = headerOf(response && response.headers, "Set-Cookie");
      const cookie = extractCookie(rawSetCookie);
      if (cfg.debug) {
        log("登录 HTTP " + status + " | Set-Cookie 原文长度 " + rawSetCookie.length);
      }

      if (!body || body.success !== true) {
        const msg = body && body.message ? body.message : "HTTP " + status;
        return cb(null, msg);
      }
      if (!cookie) {
        return cb(null, "登录成功但响应头未返回 Set-Cookie");
      }
      cb(cookie, null);
    }
  );
}

// ---------- 签到 ----------
function doSignIn(cookie, debug, cb) {
  $httpClient.post(
    {
      url: BASE_URL + "/api/user/signin",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Referer": BASE_URL + "/dashboard",
        "Origin": BASE_URL,
        "Cookie": cookie,
        "User-Agent": UA
      },
      timeout: 15000
    },
    function (error, response, data) {
      if (error) {
        log("签到请求失败: " + error);
        return cb("❌ 网络请求失败", String(error));
      }
      const status = response && response.status ? response.status : 0;
      let body = null;
      try {
        body = JSON.parse(data);
      } catch (e) {}
      if (debug) log("签到 HTTP " + status + " | " + String(data).slice(0, 200));

      if (!body) {
        return cb("❌ 响应解析失败", "HTTP " + status + "\n" + String(data).slice(0, 120));
      }

      const msg = body.message || "";
      if (body.success && body.data) {
        const bonus =
          body.data.bonus !== undefined && body.data.bonus !== null ? body.data.bonus : "";
        return cb("✅ 签到成功", msg || (bonus !== "" ? "获得 +" + bonus + " 额度" : "签到成功"));
      }
      if (status === 401 || /请先登录|未登录|登录已失效|未授权/.test(msg)) {
        return cb("⚠️ 登录已失效", "请检查插件中填写的账号与密码");
      }
      if (/已签到|已经签到/.test(msg)) {
        return cb("ℹ️ 今日已签到", msg || "今天已经签到过了，明天再来");
      }
      return cb("❌ 签到失败", msg || "HTTP " + status);
    }
  );
}

// ---------- 主流程 ----------
function run() {
  log("脚本版本 " + SCRIPT_VERSION);
  const cfg = parseArgument();

  if (cfg.mode === "none") {
    $notification.post("肖恩AI签到", "🚫 未配置账号", "请在 Loon 插件设置中填写账号与密码");
    return done();
  }

  if (cfg.mode === "cookie") {
    doSignIn(cfg.cookie, cfg.debug, function (title, content) {
      $notification.post("肖恩AI签到", title, content);
      done();
    });
    return;
  }

  // 登录模式
  doLogin(cfg, function (cookie, err) {
    if (!cookie) {
      $notification.post("肖恩AI签到", "❌ 登录失败", err || "请检查账号与密码");
      return done();
    }
    $persistentStore.write(cookie, COOKIE_KEY);
    log("登录成功，Cookie 已写入本地缓存");
    doSignIn(cookie, cfg.debug, function (title, content) {
      $notification.post("肖恩AI签到", title, content);
      done();
    });
  });
}

run();