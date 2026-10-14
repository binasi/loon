# WorkBuddy 每日自动签到

> WorkBuddy（腾讯云代码助手推出的 AI Agent 办公工具）每日签到的 Loon 自动脚本。
> 原理：登录一次后自动抓取 **Cookie / Bearer Token**，每天按 cron 定时重放「签到接口」请求，成功/失败/已签到都推送通知。

## 为什么这样做

WorkBuddy 的登录是微信/QQ/腾讯云扫码等第三方方式，**没有账号密码接口可脚本化登录**，
所以采用「抓取认证 + 定时重放」方案（与肖恩AI脚本的 Cookie 备用路一致）：

| 文件 | 作用 |
|---|---|
| `workbuddy.plugin` | Loon 插件（推荐，一键安装） |
| `workbuddy.js` | 主脚本：每天定时调用签到接口 |
| `workbuddy.cookie.js` | 认证抓取：已登录状态下自动截获 Cookie/Token 并保存 |

## ⚠️ 第一步：抓包拿到「签到接口 URL」（唯一必须手动的步骤）

接口无法远程探测，必须用你登录后的会话观察一次：

1. 电脑浏览器登录 **WorkBuddy 网页版**（`www.workbuddy.cn/app` 或你实际使用的入口）。
2. 按 `F12` 打开开发者工具 → `Network`（网络）标签。
3. 在页面上点一次「**每日签到**」（或类似按钮），
   在 Network 列表里按关键词过滤：`sign`、`checkin`、`punch`、`daily`、`task`。
4. 找到签到请求后：
   - 复制它的 **URL**（如 `https://xxx.workbuddy.cn/api/user/signin`）→ 填进插件「签到接口URL」；
   - 记下 **请求方法**（GET / POST）→ 插件「请求方法」选择对应项；
   - 若是 POST 且有请求体（Request Payload），复制到插件「请求体」；
   - 若该请求还带了签名/设备等额外头（`x-*`），以 JSON 复制到「额外请求头」，如 `{"x-device-id":"你的真实值"}`。
5. （可选，更省事）在 Network 里右键该请求 → `Copy as cURL`，把内容贴给我，我帮你解析出全部字段。

## 安装与使用

### 方式 A：插件（推荐）

1. Loon → 配置 → 插件 → 添加：
   `https://raw.githubusercontent.com/binasi/loon/main/workbuddy/workbuddy.plugin`
2. 把第一步抓到的 URL 填入「签到接口URL」，其余字段按需填。
3. 确保 **MitM 已开启、证书已信任**，然后正常打开 WorkBuddy 网页/客户端并保持登录。
   （插件内置抓取规则已覆盖 `*.workbuddy.cn / *.workbuddy.ai / *.workbuddy.link / *.codebuddy.cn` 的 `/api/` 请求）
4. 收到「✅ 已保存认证信息」通知即完成；之后每天到点自动签到。
5. 打开插件「调试模式」可手动触发一次，在 Loon 日志里看请求详情（不要长期开着 debug）。

### 方式 B：主配置手动贴（不装插件）

```ini
[Script]
# 认证抓取：保持登录态访问一次任意 /api/ 请求即可
request if ${url} ~= /(^|\.)(workbuddy\.(cn|ai|link)|codebuddy\.cn)(:\d+)?\/api\//i then script("https://raw.githubusercontent.com/binasi/loon/main/workbuddy/workbuddy.cookie.js") with tag="WorkBuddy认证抓取", timeout=20
# 每日签到（把 URL 换成你抓到的真实接口）
cron "0 9 * * *" then script("https://raw.githubusercontent.com/binasi/loon/main/workbuddy/workbuddy.js", {sign_url = "https://xxx.workbuddy.cn/api/user/signin", sign_method = "POST", auth_mode = "cookie", extra_headers = "", body = "", debug = false}) with tag="WorkBuddy签到", timeout=120

[MitM]
hostname = %APPEND% *.workbuddy.cn, *.workbuddy.ai, *.workbuddy.link, *.codebuddy.cn
```

> 注意：插件/Cron 的时区是 Loon 所用设备的本地时区（Asia/Shanghai），`cron "0 9 * * *"` = 每天 09:00。

## 常见问题

| 现象 | 处理 |
|---|---|
| 通知「未配置签到接口」 | 说明还没填接口 URL——必须抓包，见上 |
| 通知「认证已失效」 | Cookie/Token 过期了：重新打开 WorkBuddy 保持登录态访问一次，自动重抓；或手动粘贴新值 |
| 抓不到认证信息 | 检查 MitM 开关与证书信任；确认你请求的是 `/api/` 路径（静态页没有认证头） |
| 每天都签到失败但认证没失效 | 接口可能有 **签名/风控头**（`x-sign` 之类）或 body 不完整——用 `Copy as cURL` 对比补全「额外请求头」「请求体」；仍不行说明该接口有动态签名，脚本化不可行 |
| 想把抓取范围限定到某个域名 | 编辑 `workbuddy.cookie.js` 和插件脚本里的正则，把 `workbuddy\.(cn\|ai\|link)` 收窄 |

## 安全提醒

- 抓取的 Cookie/Token **等同你的登录凭据**，仅存于 Loon 本地 `$persistentStore`，不会外传；请勿把它贴到公开仓库/群聊。
- 请遵守 WorkBuddy 使用条款与所在组织规定；自动签到若被平台风控，风险自负。
- 本脚本仅供个人学习自用。

## 更新记录

- 2026-10-14 `r1`：初版。主脚本 + 认证抓取 + 插件（动态 cron、认证方式 cookie/token、额外请求头/请求体可配）。