/**
 * 肖恩AI 每日签到 · 免费大模型API,每日签到领 1000~3000 额度
 *
 * 抓取:浏览器登录 https://free.supxh.xin → 开发者工具(F12) → Application/Network → 复制完整 Cookie
 * 签到:cron 每日定时 POST /api/user/signin(凭 Cookie),通知本次获得额度
 *
 * @Author: MaYIHEI <https://github.com/MaYIHEI/paperclip>
 * @Channel: Telegram 频道 https://t.me/mayihei
 * @Updated: 2026-09-20
 *
 * ===== Loon(3.5.1+) =====
 * [Script]
 * cron "30 8 * * *" then script("supxh/supxh.js", "你的完整Cookie") with tag="肖恩AI签到", timeout=30
 */

const SCRIPT_VERSION = "2026-09-20.r1";
const BASE_URL = "https://free.supxh.xin";
const STORE_KEY = "supxh_cookie";

console.log("[INFO] 脚本版本 " + SCRIPT_VERSION);

// ---------- 1. 读取 Cookie:优先脚本参数, 其次本地已保存 ----------
let cookie = "";
if (typeof $argument !== "undefined" && $argument !== null && String($argument).trim() !== "") {
  cookie = String($argument).trim();
}
if (cookie) {
  $persistentStore.write(cookie, STORE_KEY); // 参数留档, 之后可改由本地读取
} else {
  cookie = $persistentStore.read(STORE_KEY) || "";
}

// ---------- 2. 无 Cookie 直接提示 ----------
if (!cookie) {
  $notification.post(
    "肖恩AI签到",
    "❌ 缺少 Cookie",
    "请在脚本参数中填入登录 free.supxh.xin 后的完整 Cookie"
  );
  $done();
} else {
  doSignIn(cookie);
}

// ---------- 3. 发起签到 ----------
function doSignIn(cookie) {
  $httpClient.post(
    {
      url: BASE_URL + "/api/user/signin",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Referer": BASE_URL + "/dashboard",
        "Origin": BASE_URL,
        "Cookie": cookie,
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
      },
      timeout: 15000
    },
    function (error, response, data) {
      if (error) {
        console.log("[ERROR] " + error);
        $notification.post("肖恩AI签到", "❌ 网络请求失败", String(error));
        return $done();
      }

      const status = response && response.status ? response.status : 0;
      let body = null;
      try {
        body = JSON.parse(data);
      } catch (e) {}

      console.log("[DEBUG] HTTP " + status + " | " + String(data).slice(0, 300));

      if (!body) {
        $notification.post(
          "肖恩AI签到",
          "❌ 响应解析失败",
          "HTTP " + status + "\n" + String(data).slice(0, 150)
        );
        return $done();
      }

      const msg = body.message || "";

      if (body.success && body.data) {
        const bonus =
          body.data.bonus !== undefined && body.data.bonus !== null ? body.data.bonus : "";
        const content = msg || (bonus !== "" ? "签到成功，获得 +" + bonus + " 额度" : "签到成功");
        $notification.post("肖恩AI签到", "✅ 签到成功", content);
      } else if (status === 401 || /请先登录|未登录|登录已失效|未授权|token/i.test(msg)) {
        $notification.post(
          "肖恩AI签到",
          "⚠️ Cookie 已失效",
          "请重新登录 free.supxh.xin 获取新 Cookie 并更新脚本参数"
        );
      } else if (/已签到|已经签到/.test(msg)) {
        $notification.post("肖恩AI签到", "ℹ️ 今日已签到", msg || "今天已经签到过了，明天再来");
      } else {
        $notification.post("肖恩AI签到", "❌ 签到失败", msg || "HTTP " + status);
      }

      $done();
    }
  );
}