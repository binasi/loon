/**
 * 肖恩AI Cookie 抓取 · 自动抓取并保存登录 Cookie, 免手动复制
 *
 * 抓取:在 Loon 已开启(MitM 证书已装)状态下, 用浏览器/Safari 打开 https://free.supxh.xin/dashboard(已登录)
 *      脚本自动截获登录态请求的 Cookie → 校验有效后保存到本地
 * 签到:配合 supxh.js 使用(两脚本共用本地存储 supxh_cookie, 签到脚本参数可留空)
 *
 * @Author: MaYIHEI <https://github.com/MaYIHEI/paperclip>
 * @Channel: Telegram 频道 https://t.me/mayihei
 * @Updated: 2026-09-20
 *
 * ===== Loon(3.5.1+) =====
 * [Script]
 * request if ${url} ~= /^https:\/\/free\.supxh\.xin\/api\/(user|invite|models)\// then script("supxh/supxh.cookie.js") with tag="肖恩AI Cookie", timeout=20
 *
 * [MitM]
 * hostname = %APPEND% free.supxh.xin
 */

const BASE_URL = "https://free.supxh.xin";
const STORE_KEY = "supxh_cookie";

// ---------- 工具:大小写不敏感读取请求头 ----------
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

// ---------- 1. 取出本次请求的 Cookie ----------
const cookie = headerOf($request.headers, "Cookie");

if (!cookie) {
  console.log("[INFO] 本次请求无 Cookie 头, 放行");
  $done({});
} else if (($persistentStore.read(STORE_KEY) || "") === cookie) {
  // Cookie 与已保存一致, 无需重复校验/写入, 立即放行
  console.log("[INFO] Cookie 未变化, 放行");
  $done({});
} else {
  // ---------- 2. Cookie 有变化: 校验是否为有效登录态, 通过才保存 ----------
  // 注意: 本规则只匹配 /api/(user|invite|models)/, 不含 /api/auth/me,
  //       故此处自校验请求不会再次命中本脚本, 不存在递归。
  $httpClient.get(
    {
      url: BASE_URL + "/api/auth/me",
      headers: {
        "Cookie": cookie,
        "Accept": "application/json",
        "Referer": BASE_URL + "/dashboard"
      },
      timeout: 8000
    },
    function (error, response, data) {
      const status = response && response.status ? response.status : 0;
      let valid = false;
      try {
        const body = JSON.parse(data);
        valid = !!(body && body.success && body.data);
      } catch (e) {}

      if (valid) {
        $persistentStore.write(cookie, STORE_KEY);
        console.log("[INFO] 登录态有效(HTTP " + status + "), Cookie 已保存");
        $notification.post(
          "肖恩AI Cookie",
          "✅ 抓取成功",
          "登录 Cookie 已保存，签到脚本将自动使用"
        );
      } else {
        console.log("[INFO] 校验未通过(HTTP " + status + ")，未登录或 Cookie 无效，保留原有值不覆盖");
      }
      $done({});
    }
  );
}