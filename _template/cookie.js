/**
 * <站点显示名> Cookie 抓取 · 备用方案模板
 *
 * 用途：当该站登录有验证码/短信码、无法账号密码自动登录时，
 *       用本脚本在「已登录」状态下自动截获 Cookie 并保存，主脚本(main)复用。
 *
 * 适配新站点只需改 CONFIG 里的域名、鉴权接口匹配、校验接口、缓存键。
 *
 * 使用流程：开启 Loon(MitM 已装证书) → 浏览器登录站点并进入会员页 → 自动抓取保存
 *
 * @Author: <你的名字> <https://github.com/<你的ID>/<你的仓库>>
 * @Updated: 2026-09-20
 *
 * ===== Loon（3.5.1+）=====
 * [Script]
 * request if ${url} ~= /^https:\/\/<example\.com>\/api\/(user|member|account)\// then script("https://raw.githubusercontent.com/<你的ID>/<你的仓库>/main/<name>/<name>.cookie.js") with tag="<站点显示名> Cookie", timeout=20
 *
 * [MitM]
 * hostname = %APPEND% <example.com>
 */

// ===== 【适配新站点：改这里】 =====
const CONFIG = {
  base: "https://<example.com>",           // 站点地址
  checkPath: "/api/<xxx>/me",              // 校验登录态的接口（成功返回 success:true + data）
  storeKey: "<name>_cookie"                 // 与主脚本 main.js 的 storeKey 保持一致
};
// =====================================

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

const cookie = headerOf($request.headers, "Cookie");

if (!cookie) {
  console.log("[" + CONFIG.storeKey + "] 本次请求无 Cookie 头，放行");
  $done({});
} else if (($persistentStore.read(CONFIG.storeKey) || "") === cookie) {
  console.log("[" + CONFIG.storeKey + "] Cookie 未变化，放行");
  $done({});
} else {
  // Cookie 有变化：校验是否有效登录态，通过才保存（避免未登录 Cookie 覆盖有效值）
  $httpClient.get(
    {
      url: CONFIG.base + CONFIG.checkPath,
      headers: { "Cookie": cookie, "Accept": "application/json" },
      timeout: 8000
    },
    function (error, response, data) {
      let valid = false;
      try {
        const body = JSON.parse(data);
        valid = !!(body && body.success && body.data);
      } catch (e) {}
      if (valid) {
        $persistentStore.write(cookie, CONFIG.storeKey);
        console.log("[" + CONFIG.storeKey + "] 登录态有效，Cookie 已保存");
        $notification.post("<站点显示名> Cookie", "✅ 抓取成功", "登录 Cookie 已保存，签到脚本将自动使用");
      } else {
        console.log("[" + CONFIG.storeKey + "] 校验未通过，不覆盖已有值");
      }
      $done({});
    }
  );
}