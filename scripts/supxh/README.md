# 肖恩AI 每日签到

自动完成「肖恩AI」（free.supxh.xin，免费大模型 API 站）的每日签到，领取 1000~3000 额度。

> 新用户注册立得 5000 点；每日签到再领 1000~3000 点。

## 文件

| 文件 | 说明 |
|---|---|
| `supxh.plugin` | **Loon 插件**（推荐）：设置里填账号密码即可，全自动 |
| `supxh.js` | 签到主脚本（三种输入模式，见下） |
| `supxh.cookie.js` | Cookie 自动抓取（可选，插件方式的替代方案） |

## 使用方式

### 方式一：插件（推荐，免抓包）⚡

在 Loon 中安装插件，然后在**插件设置**里填写账号与密码即可，脚本会自动登录获取 Cookie 再签到：

```
https://raw.githubusercontent.com/binasi/loon/main/plugins/supxh.plugin
```

插件参数：

| 参数 | 说明 |
|---|---|
| 账号 | 肖恩AI 账号或邮箱 |
| 密码 | 肖恩AI 登录密码 |
| 调试模式 | 开启后日志记录请求状态与判定结果 |

### 方式二：Cookie 自动抓取（无需提供密码）

若不想在插件里存密码，可用 `supxh.cookie.js`：开启 Loon 后正常登录访问一次网站，脚本自动截获并保存 Cookie。

### 方式三：手动填 Cookie

把完整 Cookie 作为字符串参数传入即可。

## Loon 配置

> 需 Loon 3.5.1(978)+，本仓库脚本使用新版 `[Script]` 语法。

**方式一（插件）**：直接安装 `plugins/supxh.plugin`，无需手写配置。

**方式二 / 三（自建配置）**：

```ini
[Script]
# 方式二：自动抓 Cookie（登录态下访问 dashboard 时截获）
request if ${url} ~= /^https:\/\/free\.supxh\.xin\/api\/(user|invite|models)\// then script("supxh/supxh.cookie.js") with tag="肖恩AI Cookie", timeout=20

# 方式三：字符串参数传 Cookie；若省略参数则读取本地缓存
cron "30 8 * * *" then script("supxh/supxh.js") with tag="肖恩AI签到", timeout=60

[MitM]
hostname = %APPEND% free.supxh.xin
```

## 维护记录

| 日期 | 变更 |
|---|---|
| 2026-09-20 | 新建，适配 free.supxh.xin 每日签到 |
| 2026-09-20 | 新增 Loon 插件（账号密码自动登录）与 Cookie 自动抓取 |

## 已知限制

- **账号密码需通过插件保存**：插件参数由 Loon 本地保管，请勿分享含参数的插件配置截图。
- **签到额度当天有效**：今日签到额度当日未用部分次日清零；注册/邀请/兑换获得的固定额度长期保留。
- **一天一次**：当日已签到会返回「今天已经签到过了」并正常提示，不算失败。
- **登录态失效**：登录 Cookie 过期后会自动重新登录（插件模式）；若仍失败，提示检查账号密码。