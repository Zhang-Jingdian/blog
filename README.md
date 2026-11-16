# 博客系统

个人博客的单仓：一个 API、一个管理后台、一个静态站点，加一个两者共用的包。

## 结构

| 路径              | 职责                                      | 技术栈                                   |
| ----------------- | ----------------------------------------- | ---------------------------------------- |
| `apps/api`        | 公开接口（文章/分类/标签/文件）+ 后台接口 | Hono + Drizzle + Cloudflare D1/R2 + Void |
| `apps/admin`      | 文章、分类、标签、媒体管理                | Vue 3 + Vite                             |
| `apps/website`    | 对外站点，构建期从 API 拉数据             | Astro（静态输出）                        |
| `packages/shared` | 两个前端共用：markdown 渲染、响应包装类型 | TypeScript，源码直接引用                 |

测试跟着应用走（`apps/*/test`、`packages/*/test`），由根 `vitest.config.ts` 统一跑，改接口时断言就在隔壁。

## 快速开始

```bash
vp install   # 拉依赖并链接 workspace 包
vp run dev   # 依次启动 api → admin → website
```

每个服务都等到上一个端口真正监听后才启动，所以 admin 的代理和 website 的服务端取数不会打到死端口。日志按服务名加前缀，Ctrl+C 一次全部停掉；任一端口被占用时直接报错退出（不会让 Vite 偷偷换端口，从而破坏代理和 CORS 白名单）。

| 应用           | 端口 | 地址                                           |
| -------------- | ---- | ---------------------------------------------- |
| `apps/api`     | 5173 | http://localhost:5173                          |
| `apps/admin`   | 5174 | http://localhost:5174（把 `/api` 代理到 5173） |
| `apps/website` | 4321 | http://localhost:4321                          |

单独启动某个应用：

```bash
vp run dev:api
vp run dev:admin
vp run dev:website
```

## 常用命令

| 命令              | 作用                                                |
| ----------------- | --------------------------------------------------- |
| `vp run dev`      | 启动全部应用（按依赖顺序）                          |
| `vp check`        | 格式化 + lint + 类型检查                            |
| `vp test`         | 跑全部测试（`vp test run` 跑一次就退出）            |
| `vp run -r build` | 构建三个应用                                        |
| `vp run ready`    | 提交前自检：格式化 + lint + 类型 + 测试（离线可跑） |

`vp run -r build` 里 **website 的构建需要 API 在线**（`getStaticPaths` 阶段会拉全量文章），因此没有并进 `ready`。离线时先 `vp run dev:api`，或只构建单个应用：`vp run api#build`。

## 环境变量

| 变量                | 应用    | 默认值                  | 说明                             |
| ------------------- | ------- | ----------------------- | -------------------------------- |
| `ADMIN_ORIGIN`      | api     | `http://localhost:5174` | CORS 允许的后台来源              |
| `VITE_API_BASE_URL` | website | `http://localhost:5173` | API 地址，生产由 CI 注入         |
| `VITE_SITE_URL`     | website | `http://localhost:4321` | canonical / sitemap 用的站点地址 |
| `VITE_API_BASE_URL` | admin   | 空（走 Vite 代理）      | 生产由 CI 注入 API Worker 地址   |

**`apps/api` 只能有 `.env`**：Void 的 `void/env` 在同时发现 `.env` 和 `.env.example` 时会直接拒绝启动，所以这个应用没有示例文件，变量定义见 `apps/api/env.ts`。

## `apps/api` 的目录约定

```
routes/      文件路径即 URL（routes/api/posts/[slug].ts → /api/posts/:slug）
middleware/  按文件名数字前缀顺序执行
db/          Drizzle schema 与 migrations
src/lib/     业务逻辑（校验、slug、上传、导出…）
```

前三项是 Void 的框架约定，不是随意摆放；改动前先看 `node_modules/void/docs/`。只有 `src/lib/` 可以自由重组。

## 部署

`.github/workflows/deploy.yml` 按应用分别部署到 Cloudflare；`ci.yml` 在 PR 上跑 `vp check` 和 `vp test`。
