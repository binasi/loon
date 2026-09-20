# Loon 脚本与插件合集

个人自用的 [Loon](https://nsloon.app)（iOS / tvOS 网络工具）脚本与插件仓库。

所有脚本均基于 **Loon 3.5.1+ 新版语法**：

- `[Script]`：`request/response/cron/network-changed/generic ... then script(...)`
- `[Rewrite]`：`request/response if <条件> then <action>`
- 插件最低 `#!loon_version = 3.5.1(978)`

## 目录结构

```
.
├── README.md
└── scripts/                 # 脚本
    └── <脚本名>/
        ├── <脚本名>.js          # 主脚本
        ├── <脚本名>.cookie.js   # Cookie 抓取(可选)
        └── README.md            # 该脚本的使用说明
```

> 计划后续增加 `plugins/` 目录用于存放 Loon 插件（`.plugin`）。

## 脚本列表

| 脚本 | 说明 | 类型 |
|---|---|---|
| [supxh](./scripts/supxh/) | 肖恩AI（免费大模型 API）每日签到 + Cookie 自动抓取 | Request / Cron |

## 使用说明

每个脚本目录下都有独立的 `README.md`，包含抓取步骤、Loon 配置与已知限制。请先阅读对应说明再使用。

## 免责声明

本仓库脚本仅供个人学习与自用。使用者需自行承担使用风险，并遵守相关服务的使用条款。