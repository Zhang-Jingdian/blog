# 部署与配置规范

本文回答一个问题：**换一台电脑、换一个部署环境，如何从零把项目跑起来、初始化数据库、登录后台，并部署到生产。** 它是本项目「环境变量 + 部署流程」的正式清单，取代传统的 `.env.example`（Void 0.24 不支持该文件，见 [环境变量模型](#3-环境变量模型)）。

技术栈：pnpm monorepo + Vite+（`vp`）+ Void（直接部署到 Cloudflare）+ Drizzle + Better Auth。

---

## 1. 当前项目状态（诚实基线）

> 先看这张表，避免按「已完成」的预期去配置尚未存在的东西。

| App            | 技术                              | 现状                                                                                                                                                                                                   |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`     | Void + Drizzle + D1 + Better Auth | 认证 + 业务表 + seed 已完成；**posts CRUD 已实现**（公开只读 `/api/posts`、`/api/posts/:slug`、`/api/categories`；管理 `/api/admin/posts` 需登录会话）；纯 API Worker（无前端入口，产出仅 `dist/ssr`） |
| `apps/website` | Astro（静态）                     | 默认博客模板，**尚未接入 API**；`astro.config.mjs` 的 `site` 还是占位 `https://example.com`                                                                                                            |
| `apps/admin`   | Vue 3 SPA                         | 默认脚手架，**尚未接入 API，也尚未接入 void/Cloudflare 部署**（无 `void.config.ts`、无 `void` 依赖）                                                                                                   |

部署目标：`apps/api` 与 `apps/website` 已保存为「直接 Cloudflare」（`.void/project.json` = `{ "platform": "cloudflare" }`）；`apps/admin` 未配置。

---

## 2. 前置条件

- **Node** ≥ 22.18（根 `engines`；admin 要求 `^22.18.0 || >=24.12.0`）
- **pnpm** 12.8.1（根 `devEngines`）
- 一个 **Cloudflare 账号**（首次 `void deploy` 时浏览器登录并选择账号）
- Git

---

## 3. 环境变量模型

Void 0.24 用一套固定规则管理环境变量，**不要**照搬传统多文件方案（`.env.example` / `.env.local` / `.env.production` / `.dev.vars*` 都会被 dev/deploy 拒绝）。

| 概念           | Void 里的位置                                                | 说明                                                             |
| -------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 本地值         | 单个 `.env`（项目根，已 gitignore）                          | 本地开发 / 本地工具 / 「本地预览生产构建」共用这一个文件         |
| 生产 server 值 | `void secret put` / `void secret sync`（加密 Worker secret） | 非 `VITE_` 前缀的键；本地 `.env` 的值**永远不会**被部署          |
| 客户端公开值   | `VITE_` 前缀，走构建 shell 或 schema default                 | 会进浏览器产物，**永不**是 secret，永不通过 `.env`/secret 提供   |
| 声明与校验     | `env.ts`（`defineEnv` + `void/env`）                         | 被 git 跟踪的「变量清单 + 类型 + 必填性」；`void env check` 校验 |

要点：

- **`env.ts` 就是 Void 版的「配置清单」**。将来一旦出现运行时变量，就写进 `env.ts` 并用 `void/env` 读取；`void deploy` 会在部署前按 `env.ts` 校验必填项。
- **当前项目尚无运行时环境变量**（见下），所以还没有 `env.ts`。不要为了「看起来完整」而预先造变量；等真正用到时再加，模板见 [§11 演进](#11-环境变量演进)。
- 数据库是 D1 **binding**（由 Void 自动 provision，不是环境变量）；`BETTER_AUTH_SECRET` 由 Void 自动创建并复用（见下）。

---

## 4. 环境变量清单（按真实代码扫描结果）

下面只列**当前代码真正用到的变量**，不凭空添加。

### 4.1 自动管理（无需手动配置）

| 变量                 | 用途                               | 说明                                                                                                  |
| -------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Better Auth 会话签名密钥（Secret） | 生产：`void deploy` 首次自动创建、后续复用；本地 dev 无需配置；仅「本地预览生产构建」时在 `.env` 提供 |

### 4.2 Seed 专用（仅本地引导管理员）

| 变量             | 用途           | 必填 | Public/Secret                | 作用域                 | 说明                                   |
| ---------------- | -------------- | ---- | ---------------------------- | ---------------------- | -------------------------------------- |
| `ADMIN_EMAIL`    | 首个管理员邮箱 | 可选 | Secret（凭据性质，但仅本地） | 本地 `void db seed` 时 | 由 `db/seed.ts` 读取；邮箱已存在则跳过 |
| `ADMIN_PASSWORD` | 首个管理员密码 | 可选 | Secret                       | 本地 `void db seed` 时 | 不硬编码；只在命令行/本地 `.env` 提供  |

### 4.3 CI / 部署凭据（非应用 env，仅 CI 机器需要）

| 变量                           | 用途                                 | 必填 | Public/Secret |
| ------------------------------ | ------------------------------------ | ---- | ------------- |
| `CLOUDFLARE_API_TOKEN`         | CI 中无浏览器登录时的部署凭据        | 可选 | Secret        |
| `CLOUDFLARE_ACCOUNT_ID`        | token 能访问多账号时指定目标账号     | 可选 | 半公开        |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Worker 无 preview URL 时 CI 部署需要 | 可选 | 半公开        |

### 4.4 未来会引入（占位，**现在不要填**）

| 变量                        | 用途                          | Public/Secret | 何时引入                            |
| --------------------------- | ----------------------------- | ------------- | ----------------------------------- |
| `VITE_API_BASE_URL`         | website/admin 访问 API 的地址 | Public        | 前端接入 API 时（走构建 shell）     |
| `AUTH_GITHUB_CLIENT_ID`     | GitHub 社交登录 client id     | Public        | 启用社交登录时                      |
| `AUTH_GITHUB_CLIENT_SECRET` | GitHub 社交登录 client secret | Secret        | 启用社交登录时（`void secret put`） |

---

## 5. 从 clone 到本地跑起来

```sh
git clone <repo> && cd blog
vp install                                  # Vite+ 依赖安装（等价 pnpm install）

# 生成 Void 类型与配置（接入 void 的 app 各跑一次；admin 未接入无需跑）
cd apps/api && pnpm void prepare && cd ../..
cd apps/website && pnpm void prepare && cd ../..
```

本地 `.env`：当前**无必填项**。仅当需要「本地预览生产构建」时，在 `apps/api/.env` 里加一行 `BETTER_AUTH_SECRET=<随机串>`。

启动（三个终端，分别进入各 app 目录）：

```sh
pnpm --filter api dev      # vp dev，默认 5173（端口被占会静默向后漂移）
pnpm --filter website dev  # astro dev，默认 4321
pnpm --filter admin dev    # vp dev，默认 5173
```

---

## 6. 数据库初始化

```sh
cd apps/api
pnpm void db seed    # reset 本地库 + 重放全部迁移 + 跑 db/seed.ts
```

> `void db seed` 会 **reset 本地库**（删除数据后重放迁移）。它是「初始化/重建本地开发库」的命令，不是「向现有库追加数据」。已有迁移（含 auth 表）会在此步自动应用。

> 改了 `db/schema.ts` 才需要重新生成迁移：`pnpm void db generate` → 审阅并 commit 生成的 `db/migrations/*.sql`。**不要用 `void db push`**（它只改本地库、不写迁移历史，会让 dev server 报 "no Void migration history"）。

---

## 7. 管理员初始化

本地（生产环境请跳到 [§8](#8-生产部署-cloudflare)）：

```sh
cd apps/api
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<强密码>' pnpm void db seed
```

- `db/seed.ts` 幂等：邮箱已存在则跳过、不覆盖已有密码。
- 首次执行前确保已跑过 `void prepare`（生成 `.void/better-auth-schema.ts`）。

### 生产管理员引导（当前缺口，待定）

`void db seed` 只作用于**本地**库，无法用它给生产建管理员；且公开注册已关闭。**当前尚无文档化的生产引导路径**，可选方案（择一，均未实现）：

1. `void db execute --remote` 插入一条 `user` + `account`（密码 hash 需先在本地用 Better Auth 的 `hashPassword` 算好，格式为 scrypt `salt:hash`）；
2. 一个一次性、受保护的引导接口或迁移；
3. 临时打开注册 → 注册 → 再关闭。

此项列入 [§12 仍需人工处理](#12-仍需人工处理项)。

---

## 8. 生产部署（Cloudflare）

### 8.1 API

```sh
cd apps/api
pnpm void deploy    # 首次：浏览器登录 Cloudflare 选账号；之后复用
```

`void deploy` 会构建、provision 资源、应用 pending 迁移、发布并打印 URL。

- 生产 server secret：`pnpm void secret put <NAME>`（当前**无必填** server secret，`BETTER_AUTH_SECRET` 自动创建并复用）。
- 本地 `.env` 的值不会被部署。
- 首次部署成功后 **commit `void.lock.json`**（换机器/CI 复用）。

### 8.2 Website（Astro 静态）

```sh
cd apps/website
pnpm void deploy
```

> 部署前把 `astro.config.mjs` 的 `site: "https://example.com"` 改成真实域名。

### 8.3 Admin

尚未接入 void/Cloudflare，部署方式待定（见 §12）。

---

## 9. 域名

在 Cloudflare 控制台 → 对应 Worker → **Settings → Domains** 绑定自定义域名（DNS 与证书生效后即可访问）；或运行 `pnpm void domain --help` 查看 CLI 域名命令。

---

## 10. 更新部署

| 改了什么           | 动作                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| `db/schema.ts`     | `pnpm void db generate` → review/commit SQL → `pnpm void deploy`（自动应用迁移） |
| 本地 `.env`        | 直接改 `.env`，重跑 dev                                                          |
| 生产 server secret | `pnpm void secret put <NAME>` → `pnpm void deploy`                               |
| 客户端 `VITE_` 值  | 改构建 shell 变量或 schema default → `pnpm void deploy`                          |
| 前端/页面代码      | 直接 commit → `pnpm void deploy`                                                 |

CI 自动化（可选）：`pnpm void init --github` 生成 workflow；Cloudflare 需在仓库加 `CLOUDFLARE_API_TOKEN` secret。

---

## 11. 环境变量演进

当出现**第一个真正的运行时变量**时（例如前端接入 API），创建 `apps/api/env.ts`（或对应 app 的 `env.ts`）：

```ts
// apps/api/env.ts
import { defineEnv, url } from "void/env";

export default defineEnv({
  // 服务端键（非 VITE_ 前缀）→ 生产用 void secret put
  // VITE_API_BASE_URL: url(),   // 客户端公开值 → 构建 shell 提供
});
```

然后：

```sh
void env check          # 校验本地 .env + shell
void env check --remote # 校验远程 secret 名
void env types          # 重新生成 .void/env.d.ts
```

在代码里 `import { env } from 'void/env'` 读取。内置校验器：`string()` / `number()` / `boolean()` / `url()` / `email()` / `oneOf([...])` / `json<T>()`，均支持 `.optional()` 与 `.default()`。

---

## 12. 仍需人工处理 / 决策项

- [ ] **生产管理员引导方案**（§7 缺口，尚未实现）
- [ ] website 的 `astro.config.mjs` 占位域名 `https://example.com`
- [ ] admin 尚未接入 void/部署，也未接 API
- [ ] posts CRUD 已完成；但 tags / `post_links`（`[[ ]]` 双链）、CORS + Better Auth `trustedOrigins`（跨域 admin 调用）仍未实现
- [ ] `apps/api/docs/` 被 `apps/api/.gitignore` 的 `docs/` 忽略：`db.md` 是有价值的数据库设计文档但当前未入库；`deployemtOfFlareStackBlogWeb.md` 是他人文档，建议继续不入库
- [ ] **typescript 无法统一（有意为之）**：`apps/admin` 受 vue-tsc 3.3.12 限制必须用 TS 6（TS 7 会报 `ERR_PACKAGE_PATH_NOT_EXPORTED`），故 `apps/api` / `apps/admin` 显式 pin `~6.0.x`；`packages/utils`(`^7.0.2`) 与 Astro 用 TS 7。两套 TS 并存，别盲目对齐到 catalog 的 `^7.0.2`

---

## 13. 常见问题（void 0.24 实测坑）

- **只认单个 `.env`**：`.env.example` / `.env.local` / `.dev.vars*` 会让 `vp dev`/`void deploy` 拒绝启动。
- **`void` 无 `dev` 命令**：开发用 `vp dev`，构建用 `vp build`。
- **`void` 是本地二进制**：在 app 目录下用 `pnpm void <cmd>`（不是全局 `void`）。
- **`void db push` 不写迁移历史** → dev server 报 "no Void migration history"；改走 `void db generate` → `void db seed`。
- **`void db seed` 会 reset 本地库**，别把它当「追加数据」命令。
- **`.void/better-auth-schema.ts`、`.void/env.d.ts` 等是生成文件**：勿手改、勿提交；`void prepare` 重新生成。
- **`@better-auth/utils` 是传递依赖**：pnpm strict 下需在 `apps/api/package.json` 显式 pin devDependency `0.4.2`。
- import `.void/better-auth-schema.ts` 要带 **`.ts`** 扩展名。
- **typescript 不要盲目对齐 catalog**：catalog 是 `^7.0.2`，但 `apps/admin` 的 vue-tsc 3.3.12 只兼容 TS 6（升到 TS 7 报 `ERR_PACKAGE_PATH_NOT_EXPORTED: './lib/tsc'`），因此 api/admin 显式 pin `~6.0.x`；`packages/utils` 用 `^7.0.2`。两套 TS 并存是有意的。
- Better Auth 有 CSRF 校验：sign-in 请求必须带 `Origin` 头。
- 数据库时间戳两套：业务表 Unix 秒、auth 表 Unix 毫秒（详见 `apps/api/docs/db.md`）。
