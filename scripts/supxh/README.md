# 肖恩AI 每日签到

自动完成「肖恩AI」（free.supxh.xin，免费大模型 API 站）的每日签到，领取 1000~3000 额度。

> 新用户注册立得 5000 点；每日签到再领 1000~3000 点。

## 文件

| 文件 | 说明 |
|---|---|
| `supxh.cookie.js` | **Cookie 抓取**（Request 脚本）：自动抓取并保存登录 Cookie，免手动复制 |
| `supxh.js` | **签到**（Cron 脚本）：定时签到领额度 |

两个脚本共用本地存储键 `supxh_cookie`，抓取脚本存、签到脚本读，无需人工干预。

## 使用步骤

### 1. 部署脚本

把两个 `.js` 放到同一目录（如 `supxh/`），或使用远程地址引用。

### 2. 配置 Loon

> 需 Loon 3.5.1(978)+ 且开启 MitM 并已信任证书。

```ini
[Script]
# 自动抓 Cookie：登录态下访问 dashboard 时截获 /api/user|invite|models 请求的 Cookie
request if ${url} ~= /^https:\/\/free\.supxh\.xin\/api\/(user|invite|models)\// then script("supxh/supxh.cookie.js") with tag="肖恩AI Cookie", timeout=20

# 每日自动签到
cron "30 8 * * *" then script("supxh/supxh.js") with tag="肖恩AI签到", timeout=30

[MitM]
hostname = %APPEND% free.supxh.xin
```

- 签到脚本**参数留空**即可，会自动读取抓取脚本保存的 Cookie。
- 定时表达式 `30 8 * * *` 表示每天 08:30，Loon 使用设备本地时区（BOSS 为 Asia/Shanghai）。

### 3. 抓取 Cookie（首次 / Cookie 过期时）

1. 确保 Loon 已开启、MitM 已装证书、设备流量走 Loon。
2. 用浏览器或 Safari 打开 https://free.supxh.xin/dashboard 并保持**已登录**。
3. 脚本会自动抓取、校验并保存 Cookie，成功后弹出通知「✅ 抓取成功」。

## 维护记录

| 日期 | 变更 |
|---|---|
| 2026-09-20 | 新建，适配 free.supxh.xin 网页版每日签到；新增 Cookie 自动抓取脚本 |

## 已知限制

- **依赖登录 Cookie**：Cookie 过期后签到会推送「Cookie 已失效」提示，重新登录并打开一次 dashboard 即可自动重抓。
- **需 MitM**：抓 Cookie 依赖 MitM 解密 HTTPS，需已安装并信任 Loon 证书。
- **签到额度当天有效**：今日签到额度当日未用部分次日清零；注册/邀请/兑换获得的固定额度长期保留。
- **一天一次**：当日已签到会返回「今天已经签到过了」并正常提示，不算失败。