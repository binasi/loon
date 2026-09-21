# 签到脚本模板使用指南

这套模板用于快速复制出一个「每日签到」脚本。**大多数网站/App 的签到都可以套这个骨架**，主要改接口即可。

## 模板文件

| 文件 | 作用 |
|---|---|
| `plugin.plugin` | Loon 插件（账号密码，主方案） |
| `main.js` | 签到主脚本（账号密码 + 多账号 + Cookie 兼容） |
| `cookie.js` | Cookie 抓取（**备用方案**，应对有验证码的站） |
| `README.md` | 本指南 |

## 判断走哪条路（先侦察）

| 该站登录情况 | 用哪个 |
|---|---|
| 无验证码、接口明文 JSON | 主方案：`plugin.plugin` + `main.js` |
| 有验证码/短信码，无法脚本登录 | 备用：`cookie.js`（手动登录一次抓 Cookie） |
| 接口有签名/加密/风控 | 建议放弃或深度抓包 |

## 使用步骤

1. **复制目录**：把 `_template/` 整个复制一份，改名为脚本名（小写，如 `mysite/`），文件重命名 `<name>.js`、`<name>.plugin`、`<name>.cookie.js`。
2. **改 `main.js` 顶部 `CONFIG`**：域名、登录接口路径、签到接口路径、通知标题、缓存键。
   - 若登录参数名不是 `username`/`password`，改 `doLogin` 里的 `body`（有 `TODO` 标注）。
3. **改 `plugin.plugin`**：脚本 URL、`#!name`、`#!desc`、`#!author`。
4. **改 `cookie.js` 顶部 `CONFIG`**（仅备用方案需要）：域名、校验接口、缓存键（与 main.js 一致）。
5. **占位符替换**：全局把 `<站点显示名>`、`<name>`、`<你的ID>`、`<你的仓库>`、`<example.com>` 等 `<...>` 占位符替换成实际值。
6. **测试**：`node --check <name>.js` 做语法检查；再推送、在 Loon 里实测一次。

## 常见适配点

- **登录接口**：不同站可能是 `POST /api/login`、`/user/login`、带 JSON/form、或需要先拿 `csrf`。改 `main.js` 的 `doLogin`。
- **签到接口**：可能是 `POST` 或 `GET`、需要额外参数。改 `main.js` 的 `doSignIn`。
- **返回结构**：本模板按 `{success, message, data:{bonus}}` 解析；若结构不同，改 `doSignIn` 的判定分支。

## 目录结构约定（本仓库）

```
<name>/
├── <name>.js          主脚本
├── <name>.plugin      插件（主方案）
├── <name>.cookie.js   Cookie 抓取（备用，可选）
└── README.md          该脚本说明
```