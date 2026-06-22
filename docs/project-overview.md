# Cutia 项目全景

> 撰写日期：2026-06-22
> 用途：新入开发者学习指引 + 后续开发计划参考

---

## 1. 项目定位

**Cutia** 是一个隐私优先、开源、浏览器端运行的视频编辑器。核心卖点：

- **不上传** — 所有媒体处理在浏览器本地完成（FFmpeg.wasm、HuggingFace Transformers）
- **无水印** — 导出无任何品牌标记
- **免订阅** — 完全开源免费
- **多轨时间线** — 支持视频/音频/文字/贴图层叠

Fork 自 [opencut](https://github.com/msgbyte/opencut)，但已深度演进。

---

## 2. 技术栈全景

| 维度 | 选型 | 版本 |
|---|---|---|
| **框架** | Next.js (turbopack) | 16.1.3 |
| **UI 库** | React | 19.x |
| **语言** | TypeScript | 5.8 (strict) |
| **包管理器** | Bun | 1.2.18 |
| **Monorepo** | Turborepo | 2.7 |
| **状态管理** | Zustand | 5 |
| **样式** | Tailwind CSS | 4.1 |
| **组件库** | Radix UI + CVA + tailwind-merge | — |
| **图标** | HugeIcons + Lucide | — |
| **i18n** | `@i18next-toolkit/nextjs-approuter` | — |
| **ORM** | Drizzle | 0.44 |
| **数据库** | PostgreSQL (仅认证) | — |
| **缓存/限流** | Redis / Upstash | — |
| **视频渲染** | FFmpeg.wasm | 0.12 |
| **语音转文字** | HuggingFace Transformers | 3.8（浏览器端运行） |
| **音频处理** | wavesurfer.js | 7.12 |
| **认证** | Better Auth | 1.x |
| **动画** | Motion (Framer Motion) | 12 |
| **代码检查** | Biome（无 ESLint/Prettier） | — |
| **测试** | Bun test | 内置 |

---

## 3. 目录结构详解

```
cutia-cutvideo/
│
├── apps/web/                          # ★ 主应用
│   └── src/
│       ├── app/
│       │   ├── globals.css            # 全局 Tailwind 样式
│       │   ├── layout.tsx             # 根布局（html 标签）
│       │   ├── metadata.ts            # 全局 SEO 元数据
│       │   ├── robots.ts / sitemap.ts # SEO
│       │   ├── [locale]/              # ★ 所有页面（i18n URL 段策略）
│       │   │   ├── page.tsx           # 首页 (Landing Page)
│       │   │   ├── layout.tsx         # 语言布局（ThemeProvider + I18nProvider）
│       │   │   ├── editor/
│       │   │   │   └── [project_id]/
│       │   │   │       └── page.tsx   # ★ 编辑器入口（桌面/手机双布局分支）
│       │   │   ├── projects/
│       │   │   │   └── page.tsx       # 项目管理列表
│       │   │   ├── privacy/           # 隐私政策
│       │   │   ├── terms/             # 服务条款
│       │   │   ├── roadmap/           # 路线图
│       │   │   ├── playground/        # 零基础试用
│       │   │   ├── characters/        # AI 角色
│       │   │   └── why-not-capcut/    # SEO 落地页
│       │   └── api/                   # ★ API 路由（无 locale 前缀）
│       │       ├── ai/                # AI 生成代理
│       │       ├── auth/              # Better Auth
│       │       ├── health/            # 健康检查
│       │       ├── proxy/             # 代理
│       │       ├── sounds/            # Freesound 音效搜索
│       │       ├── tts/               # 文字转语音
│       │       └── upload/            # Cloudflare R2 上传
│       │
│       ├── core/                      # ★ 编辑器核心（单例模式）
│       │   ├── index.ts               #   EditorCore 单例
│       │   └── managers/              #   9 个 Manager
│       │       ├── playback-manager   #     播放控制
│       │       ├── timeline-manager   #     轨道/元素操作
│       │       ├── scenes-manager     #     场景管理
│       │       ├── project-manager    #     项目生命周期
│       │       ├── media-manager      #     媒体资产
│       │       ├── renderer-manager   #     FFmpeg.wasm 导出
│       │       ├── command-manager    #     撤销/重做 (Command Pattern)
│       │       ├── save-manager       #     IndexedDB 自动保存
│       │       ├── audio-manager      #     音频处理
│       │       └── selection-manager  #     多选管理
│       │
│       ├── components/
│       │   ├── ui/                    # ★ 通用 UI 组件库（~56 个组件）
│       │   │   ├── button.tsx, dialog.tsx, input.tsx ...
│       │   │   └── resizable.tsx       # react-resizable-panels 封装
│       │   ├── editor/                # ★ 桌面编辑器组件
│       │   │   ├── editor-header.tsx    #    顶部栏
│       │   │   ├── export-button.tsx    #    导出按钮（复杂逻辑）
│       │   │   ├── onboarding.tsx       #    新手指引（已注释）
│       │   │   ├── selection-box.tsx    #    选区框
│       │   │   ├── panels/              #    编辑器面板
│       │   │   │   ├── timeline/        #      时间线（核心面板，587行）
│       │   │   │   ├── preview/         #      实时预览
│       │   │   │   ├── properties/      #      元素属性编辑
│       │   │   │   ├── assets/          #      素材面板
│       │   │   │   └── agent/           #      AI Agent 面板
│       │   │   ├── dialogs/             #    对话框
│       │   │   │   ├── delete-project-dialog.tsx
│       │   │   │   ├── migration-dialog.tsx
│       │   │   │   ├── project-info-dialog.tsx
│       │   │   │   ├── rename-project-dialog.tsx
│       │   │   │   └── shortcuts-dialog.tsx
│       │   │   └── mobile/              # ★ 手机端编辑器（独立实现）
│       │   │       ├── mobile-editor-layout.tsx
│       │   │       ├── mobile-header.tsx
│       │   │       ├── mobile-preview.tsx
│       │   │       ├── mobile-toolbar.tsx
│       │   │       ├── mobile-timeline/
│       │   │       ├── mobile-drawer/   #  底部抽屉面板
│       │   │       └── hooks/           #  手机端专属 Hooks
│       │   ├── landing/               # 首页展示组件
│       │   └── providers/             # React Context 提供者
│       │
│       ├── stores/                    # ★ Zustand 状态管理（UI 状态）
│       │   ├── editor-store.ts          #    编辑器 UI 状态
│       │   ├── timeline-store.ts        #    时间线视图状态
│       │   ├── panel-store.ts           #    面板布局（含持久化）
│       │   ├── assets-panel-store.tsx
│       │   ├── keybindings-store.ts     #    快捷键绑定
│       │   ├── media-preview-store.ts
│       │   ├── sounds-store.ts          #    音效面板
│       │   ├── stickers-store.ts        #    贴纸面板
│       │   ├── character-store.ts       #    AI 角色
│       │   ├── agent-store.ts           #    AI Agent
│       │   ├── ai-settings-store.ts
│       │   ├── ai-generation-history-store.ts
│       │   ├── ai-image-generation-store.ts
│       │   └── ai-video-generation-store.ts
│       │
│       ├── services/                  # ★ 浏览器端"后端"服务
│       │   ├── storage/               #    持久化 + 迁移框架
│       │   │   ├── migrations/        #      版本迁移（v0→v1→v2→v3）
│       │   │   ├── runner.ts          #      迁移执行器
│       │   │   └── index.ts           #      入口 + DB 连接
│       │   ├── renderer/              #    FFmpeg.wasm 渲染管线
│       │   ├── transcription/         #    浏览器端语音转文字
│       │   ├── timeline-thumbnail/    #    时间线缩略图生成
│       │   ├── video-cache/           #    视频帧缓存
│       │   └── feedback/              #    用户反馈（Tianji）
│       │
│       ├── hooks/                     # ★ 自定义 Hooks
│       │   ├── actions/               #    编辑器操作
│       │   ├── timeline/              #    时间线 Hooks（拖拽、吸附、缩放等）
│       │   └── use-editor.ts          #    暴露 EditorCore 给组件
│       │
│       ├── types/                     # TypeScript 类型定义
│       │   ├── timeline.ts            #    核心类型（轨道、元素、变换、过渡）
│       │   ├── project.ts             #    项目类型
│       │   ├── editor.ts
│       │   ├── sounds.ts / stickers.ts / character.ts
│       │   └── ...
│       │
│       ├── constants/                 # 常量
│       ├── lib/                       # 工具函数（含导航封装）
│       ├── utils/                     # 工具函数
│       ├── middleware.ts              # i18n 中间件
│       └── i18n.config.ts             # i18n 配置（12 语言）
│
├── packages/
│   ├── ui/                            # 共享 UI 组件包
│   │   └── src/icons/                 #   仅 SVG 图标（brand.tsx, ui.tsx）
│   └── env/                           # 环境变量校验
│
├── docs/
│   └── superpowers/                   # 设计文档
│       ├── specs/
│       └── plans/
│
├── .github/                           # CI/CD 工作流
├── docker-compose.yaml                # Redis + PostgreSQL
├── Dockerfile                         # 生产构建
├── vercel.json                        # Vercel 部署配置
└── turbo.json                         # Turborepo 管道配置
```

---

## 4. 核心架构概念

### 4.1 EditorCore 单例

编辑器通过 `core/index.ts` 中的 `EditorCore` 单例编排，构造函数中实例化 9 个 Manager：

```
EditorCore
├── CommandManager    # 撤销/重做 (Command Pattern)
├── PlaybackManager   # 播放/暂停/跳转
├── TimelineManager   # 轨道/元素 CRUD
├── ScenesManager     # 场景切换
├── ProjectManager    # 项目加载/创建
├── MediaManager      # 媒体导入/解码
├── RendererManager   # FFmpeg.wasm 导出
├── SaveManager       # IndexedDB 自动保存
├── AudioManager      # 音频混音
└── SelectionManager  # 多元素选择
```

组件通过 `useEditor()` hook 访问。

### 4.2 状态分层

```
IndexedDB (持久化, SaveManager)
    ↕
EditorCore (单例、业务逻辑)
    ↕
Zustand Stores (UI 状态、面板布局、快捷键)
    ↕
React Components (UI 渲染)
```

### 4.3 桌面/手机双视图

编辑器在 `app/[locale]/editor/[project_id]/page.tsx` 通过 `useIsMobile()` 分支成两套独立的视图层。两者共享同一组 `core/`、`stores/`、`services/`、`types/`。

| 桌面 | 手机 |
|---|---|
| `panels/timeline/` | `mobile/mobile-timeline/` |
| `panels/preview/` | `mobile/mobile-preview.tsx` |
| `panels/properties/` | `mobile/mobile-drawer/mobile-properties-drawer.tsx` |
| `panels/assets/` | `mobile/mobile-drawer/mobile-assets-drawer.tsx` |
| `panels/agent/` | `mobile/mobile-drawer/mobile-ai-drawer.tsx` |
| `editor-header.tsx` | `mobile/mobile-header.tsx` |

### 4.4 i18n 策略

- URL 段：`/en/editor/xxx`、`/zh/editor/xxx`
- 组件内翻译：`useTranslation()` — 键必须是**字符串字面量**（不能是变量）
- 服务端翻译：`getTranslation(locale)`
- 非 React 环境：`i18next.t()` from `@/lib/i18n`
- `Link` 和 `useRouter` 必须从 `@/lib/navigation` 导入（不是 `next/link`）

### 4.5 存储迁移机制

当修改持久化类型（`TProject`、`TScene`、`TimelineTrack`、`TimelineElement` 等）时：
1. 递增 `CURRENT_PROJECT_VERSION`
2. 创建纯函数转换器 `vN-to-vM.ts`
3. 创建继承 `StorageMigration` 的迁移类
4. 注册到 `migrations` 数组
5. 添加测试（使用 fixture 数据）

---

## 5. 命令速查

```bash
# 安装
bun install

# 开发
bun run dev:web                       # 启动 web (localhost:4100, turbopack)

# 构建
bun run build:web                     # 生产构建

# 代码质量 (Biome)
bun run lint:web                      # 检查
bun run lint:web:fix                  # 自动修复
cd apps/web && bun run format         # 格式化

# 测试
bun test                              # 全部测试
bun test path/to/file.test.ts         # 单文件

# i18n
cd apps/web
bun run translation:extract           # 提取 t() 键
bun run translation:scan              # 扫描缺失
bun run translation:translate         # 自动翻译

# 数据库（可选的认证功能）
cd apps/web
bun run db:generate                   # 生成迁移
bun run db:migrate                    # 应用迁移
bun run db:push:local                 # 推送本地

# Docker
docker compose up redis serverless-redis-http -d  # 仅后端服务
docker compose up --build                        # 全栈
```

---

## 6. 新增页面/功能开发指南

### 新增页面

1. 在 `apps/web/src/app/[locale]/<page-name>/` 下创建 `page.tsx`
2. 纯展示用 Server Component（默认），交互用 Client Component（加 `"use client"`）
3. 使用 `@/lib/navigation` 的 `Link`/`useRouter`，不是 `next/link`
4. 翻译键用字符串字面量
5. 运行 `bun run translation:extract`

### 修改编辑器功能

1. 修改 `core/managers/` 中对应的 Manager（业务逻辑）
2. 修改 `stores/` 中对应 store（UI 状态，如需要）
3. **同时更新桌面和手机端组件**：
   - 桌面：`components/editor/panels/<panel>/`
   - 手机：`components/editor/mobile/` 中对应实现
4. 如果修改了持久化类型，必须创建存储迁移（见 4.5 节）

### 新增 API 路由

在 `apps/web/src/app/api/` 下创建，无 locale 前缀。

---

## 7. 维护风险（已知债务）

### 🔴 高风险

| 问题 | 详情 |
|---|---|
| **测试覆盖率极低** | 全项目仅 4 个测试文件（2 个存储迁移 + 1 个反馈服务 + 0 个组件/核心测试）。`EditorCore`、全部 Manager、命令模式均无测试 |
| **手机端严重滞后** | 手机端实现只有骨架（mobile-editor-layout.tsx 44 行），大量功能缺失。每次桌面改动需同时维护两套组件，成本翻倍 |
| **依赖膨胀** | 80+ 运行时依赖。`pg`/`postgres`/`drizzle-orm` 仅为可选的认证功能存在。FFmpeg.wasm + HuggingFace Transformers 大幅增加打包体积 |

### 🟡 中风险

| 问题 | 详情 |
|---|---|
| **死代码残留** | 编辑器页面有被注释的 `Onboarding` 引用；部分组件可能已不再使用 |
| **`packages/ui/` 空洞** | 仅有图标文件，没有实际共享组件，monorepo 分包未发挥复用价值 |
| **路径别名混用** | `@/` 对应 `src/` 但部分导入使用相对路径，一致性有待提高 |

### 🟢 低风险（开发体验）

| 问题 | 详情 |
|---|---|
| 项目 fork 自 opencut，但未在文档中明确追踪与上游的 diff | — |
| 缺少 Storybook 或类似组件浏览器 | — |
| e2e 测试（Playwright/Cypress）完全空白 | — |

---

## 8. 推荐开发路线

1. **短期**
   - 为核心 Manager 添加单元测试（先补 timeline 和 command 的）
   - 清理死代码（被注释的 Onboarding 等）
   - 填补手机端缺失功能（按面板逐个对齐）

2. **中期**
   - 将 `apps/web/src/components/ui/` 中的通用组件迁移到 `packages/ui/`
   - 建立 e2e 测试（Playwright）
   - 评估是否去掉 `pg`/`drizzle` 等仅认证依赖

3. **长期**
   - 模块联邦或微前端拆分（AI 面板可独立部署）
   - WASM 插件系统支持自定义特效/转场
