/**
 * WorkBuddy 认证抓取（Cookie / Bearer Token）· 备用方案
 *
 * 用途：WorkBuddy 登录为微信/QQ/腾讯云扫码等第三方方式，无法用账号密码自动登录，
 *       因此在本脚本在「已登录」状态下自动截获 Cookie / Authorization 并保存，
 *       主脚本 workbuddy.js 每天定时复用该认证信息调用签到接口。
 *
 * 使用流程：开启 Loon（MitM 已装证书）→ 浏览器/客户端的 WorkBuddy 会话保持登录态，
 *           访问一次任意 /api/ 请求 → 收到「✅ 已保存认证信息」即成功。
 *
 * 配置说明：
 *   - HOST_REGEX：认证所在域名（覆盖 workbuddy.cn / workbuddy.ai / workbuddy.link / codebuddy.cn，
 *     若签到接口在别的域名，改这里）
 *   - PATH_REGEX：只关心 API 路径，避免营销页静态请求干扰
 *   - CHECK_URL：选填。填一个「未登录会报错」的接口（如 /api/user/info）会在保存前校验登录态，
 *     防止未登录的匿名 Cookie 覆盖有效认证值；留空 = 抓到即存
 *
 * @Author: binasi <https://github.com/binasi/loon>
 * @Updated: 2026-10-14
 *
 * ===== Loon（3.5.1+）=====
 * [Script]
 * request if ${url} ~= /(^|\.)(workbuddy\.(cn|ai|link)|codebuddy\.cn)(:\d+)?\/api\//i then script("https://raw.githubusercontent.com/binasi/loon/main/workbuddy/workbuddy.cookie.js") with tag="WorkBuddy认证抓取", timeout=20
 *
 * [MitM]
 * hostname = %APPEND% *.workbuddy.cn, *.workbuddy.ai, *.workbuddy.link, *.codebuddy.cn
 */

// ===== 【适配：改这里】 =====
const CONFIG = {
  // 匹配完整请求 URL（带路径）：域名后紧跟 /: 或结尾
  HOST_REGEX: /(^|\.)(workbuddy\.(cn|ai|link)|codebuddy\.cn)(:\d+)?(\/|$)/i,
  PATH_REGEX: /\/api\//i,
  CHECK_URL: "",           // 选填：校验登录态的接口，例如 "https://xxx.workbuddy.cn/api/user/info"
  STORE_KEY: "workbuddy_auth"  // 与 workbuddy.js 的 storeKey 保持一致
};
// =============================

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

function main() {
  const url = ($request && $request.url) || "";
  if (!CONFIG.HOST_REGEX.test(url) || !CONFIG.PATH_REGEX.test(url)) {
    $done({});
    return;
  }

  const cookie = headerOf($request.headers, "Cookie");
  const token = headerOf($request.headers, "Authorization").replace(/^Bearer\s+/i, "");
  if (!cookie && !token) {
    console.log("[workbuddy_auth] 本次请求无认证头，放行");
    $done({});
    return;
  }

  const auth = { cookie: cookie, token: token, url: url, ts: Date.now() };
  const raw = JSON.stringify(auth);

  // 只对比认证本体（cookie/token），url/时间戳变化不算“变了”，避免重复保存
  const savedRaw = $persistentStore.read(CONFIG.STORE_KEY) || "";
  let same = false;
  if (savedRaw) {
    try {
      const o = JSON.parse(savedRaw);
      same = (o.cookie || "") === cookie && (o.token || "") === token;
    } catch (e) {
      same = savedRaw === cookie; // 兼容旧格式：直接存的 Cookie 串
    }
  }
  if (same) {
    console.log("[workbuddy_auth] 认证信息未变化，放行");
    $done({});
    return;
  }

  const save = function (raw) {
    $persistentStore.write(raw, CONFIG.STORE_KEY);
    console.log("[workbuddy_auth] 认证信息已保存 (cookie " + cookie.length + "B, token " + token.length + "B)");
    $notification.post("WorkBuddy 认证", "✅ 已保存认证信息", "每天定时签到现在可以直接生效");
  };

  // 已配置校验接口：先验证登录态，通过才覆盖（避免未登录 Cookie 覆盖有效值）
  if (CONFIG.CHECK_URL) {
    const headers = { "Accept": "application/json" };
    if (cookie) headers["Cookie"] = cookie;
    if (token) headers["Authorization"] = "Bearer " + token;
    $httpClient.get(
      { url: CONFIG.CHECK_URL, headers: headers, timeout: 8000 },
      function (error, response, data) {
        if (!error && response && response.status && response.status >= 200 && response.status < 300) {
          save(raw);
        } else {
          console.log("[workbuddy_auth] 校验未通过 (HTTP " + (response && response.status) + ")，不覆盖已有值");
        }
        $done({});
      }
    );
    return;
  }

  save(raw);
  $done({});
}

main();