# 博客数据库设计（SQLite + D1 + Drizzle + Better Auth）

## 全局约定

- **时间戳两套并存**：业务表统一用 **Unix 秒**（Drizzle：`integer({ mode: 'timestamp' })`）；Better Auth 的 auth 表用 **Unix 毫秒**（`timestamp_ms`，Better Auth 原生约定）。需要互相比对时再转换（秒 × 1000 或 毫秒 / 1000）。
- `NN` = NOT NULL，`UQ` = UNIQUE，`PK` = PRIMARY KEY，`FK` = FOREIGN KEY。
- 表分两类：**auth 表**由 void 的 Better Auth 自动生成（`.void/better-auth-schema.ts`，见下）；**业务表**手写在 `db/schema.ts`。文末有汇总速查。

---

## 0. Auth 表（Better Auth，由 void 生成）

这 4 张表**不在 `db/schema.ts` 里**，由 void 根据 `auth.ts` + `better-auth` 自动生成（`void prepare` → `.void/better-auth-schema.ts`），字段名用 camelCase、时间用毫秒。表名单数：`user` / `session` / `account` / `verification`。

| 表           | 关键字段（非完整）                                                                                     | 说明                      |
| ------------ | ------------------------------------------------------------------------------------------------------ | ------------------------- |
| user         | id(PK text) · name · email(UQ) · emailVerified(bool) · image · createdAt/updatedAt                     | 用户                      |
| session      | id(PK) · token(UQ) · userId(FK→user.id CASCADE, 索引) · expiresAt · ipAddress · userAgent              | 会话                      |
| account      | id(PK) · providerId · accountId · userId(FK→user.id CASCADE, 索引) · access/refresh/idToken · password | OAuth / credential 绑定   |
| verification | id(PK) · identifier(索引) · value · expiresAt                                                          | 邮箱验证 / 重置密码 token |

> `user.email`、`session.token` 有唯一约束；`session.userId`、`account.userId`、`verification.identifier` 有索引。`account(provider_id, account_id)` 的联合唯一**不手动加**（Better Auth 默认如此，单人博客够用）。

---

## 1. posts

| 字段         | 类型    | 约束                         | 说明                                                      |
| ------------ | ------- | ---------------------------- | --------------------------------------------------------- |
| id           | INTEGER | PK AUTOINCREMENT             | 文章 ID                                                   |
| title        | TEXT    | NN                           | 标题                                                      |
| slug         | TEXT    | NN, UQ                       | URL Slug                                                  |
| description  | TEXT    |                              | 摘要描述                                                  |
| content      | TEXT    | NN                           | MDX 内容                                                  |
| cover_url    | TEXT    |                              | 封面图                                                    |
| status       | TEXT    | NN, 默认 'draft'             | 状态：draft / published                                   |
| category_id  | INTEGER | FK → categories.id, SET NULL | 分类                                                      |
| author_id    | TEXT    | NN                           | 作者，存 Better Auth 的 `user.id`（跨 schema，不建外键）  |
| published_at | INTEGER |                              | 首次发布时间（Unix 秒）；草稿可为空，也可保留历史发布时间 |
| created_at   | INTEGER | NN                           | 创建时间（Unix 秒）                                       |
| updated_at   | INTEGER | NN                           | 更新时间（Unix 秒）                                       |

| 类别 | 定义                                                      | 说明                                                                                    |
| ---- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 约束 | `UNIQUE(slug)`                                            | URL 唯一                                                                                |
| 约束 | `CHECK(status IN ('draft','published'))`                  | 限制状态取值                                                                            |
| 约束 | `CHECK((status = 'draft') OR (published_at IS NOT NULL))` | 已发布文章必须有发布时间；草稿不限制，`published_at` 记录首次发布时间，撤回为草稿时保留 |
| 约束 | `category_id → categories.id`，SET NULL                   | 删分类后文章变为未分类                                                                  |
| 索引 | `INDEX(status, published_at DESC)`                        | 首页文章列表；查询固定带 `status = 'published'`                                         |
| 索引 | `INDEX(category_id)`                                      | 按分类查文章                                                                            |

## 2. categories

| 字段        | 类型    | 约束             | 说明                |
| ----------- | ------- | ---------------- | ------------------- |
| id          | INTEGER | PK AUTOINCREMENT | 分类 ID             |
| name        | TEXT    | NN, UQ           | 分类名              |
| slug        | TEXT    | NN, UQ           | URL                 |
| description | TEXT    |                  | 描述                |
| created_at  | INTEGER | NN               | 创建时间（Unix 秒） |
| updated_at  | INTEGER | NN               | 更新时间（Unix 秒） |

| 类别 | 定义                           | 说明              |
| ---- | ------------------------------ | ----------------- |
| 约束 | `UNIQUE(name)`、`UNIQUE(slug)` | 分类名和 URL 唯一 |

## 3. tags

| 字段        | 类型    | 约束             | 说明                |
| ----------- | ------- | ---------------- | ------------------- |
| id          | INTEGER | PK AUTOINCREMENT | 标签 ID             |
| name        | TEXT    | NN, UQ           | 标签名              |
| slug        | TEXT    | NN, UQ           | URL                 |
| description | TEXT    |                  | 描述                |
| created_at  | INTEGER | NN               | 创建时间（Unix 秒） |
| updated_at  | INTEGER | NN               | 更新时间（Unix 秒） |

| 类别 | 定义                           | 说明              |
| ---- | ------------------------------ | ----------------- |
| 约束 | `UNIQUE(name)`、`UNIQUE(slug)` | 标签名和 URL 唯一 |

## 4. post_tags

| 字段    | 类型    | 约束                       | 说明 |
| ------- | ------- | -------------------------- | ---- |
| post_id | INTEGER | NN, FK → posts.id, CASCADE | 文章 |
| tag_id  | INTEGER | NN, FK → tags.id, CASCADE  | 标签 |

| 类别 | 定义                                                       | 说明                                                   |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------ |
| 约束 | `PK(post_id, tag_id)`                                      | 防止同一文章重复关联同一标签；插入时使用"忽略冲突"写法 |
| 约束 | `post_id → posts.id`，CASCADE；`tag_id → tags.id`，CASCADE | 删文章或标签时清理关联                                 |
| 索引 | `INDEX(tag_id)`                                            | 按标签查文章；按文章查标签直接走主键，无需另建         |

## 5. post_links（双链）

| 字段           | 类型    | 约束                       | 说明                     |
| -------------- | ------- | -------------------------- | ------------------------ |
| id             | INTEGER | PK AUTOINCREMENT           | 主键                     |
| source_post_id | INTEGER | NN, FK → posts.id, CASCADE | 当前文章                 |
| target_post_id | INTEGER | FK → posts.id, SET NULL    | 链接文章（未匹配时为空） |
| target_text    | TEXT    | NN                         | `[[ ]]` 里的原始文本     |
| created_at     | INTEGER | NN                         | 创建时间（Unix 秒）      |

| 类别 | 定义                                                                        | 说明                                                      |
| ---- | --------------------------------------------------------------------------- | --------------------------------------------------------- |
| 约束 | `UNIQUE(source_post_id, target_text)`                                       | 同一文章内重复的 `[[ ]]` 只保留一条；重建链接时先删后插   |
| 约束 | `CHECK(target_post_id IS NULL OR source_post_id != target_post_id)`         | 禁止文章链接到自己；重建链接时跳过自链接                  |
| 约束 | `source_post_id → posts.id`，CASCADE；`target_post_id → posts.id`，SET NULL | 删源文章时清理其出链；删目标文章后链接变为未匹配          |
| 索引 | `INDEX(target_post_id)`                                                     | 反向链接查询；新建或改名文章时按 `target_text` 回填该字段 |

## 6. settings

| 字段       | 类型    | 约束 | 说明                               |
| ---------- | ------- | ---- | ---------------------------------- |
| key        | TEXT    | PK   | 配置键                             |
| value      | TEXT    | NN   | 配置值（复杂配置可存 JSON 字符串） |
| created_at | INTEGER | NN   | 创建时间（Unix 秒）                |
| updated_at | INTEGER | NN   | 更新时间（Unix 秒）                |

| 类别 | 定义      | 说明       |
| ---- | --------- | ---------- |
| 约束 | `PK(key)` | 配置键唯一 |

---

## 汇总速查

### 约束（业务表）

| 表         | 类型     | 定义                                                                        |
| ---------- | -------- | --------------------------------------------------------------------------- |
| posts      | UNIQUE   | `UNIQUE(slug)`                                                              |
| posts      | CHECK    | `status IN ('draft','published')`                                           |
| posts      | CHECK    | `(status = 'draft') OR (published_at IS NOT NULL)`                          |
| posts      | 外键     | `category_id → categories.id`，SET NULL                                     |
| categories | UNIQUE   | `UNIQUE(name)`、`UNIQUE(slug)`                                              |
| tags       | UNIQUE   | `UNIQUE(name)`、`UNIQUE(slug)`                                              |
| post_tags  | 复合主键 | `PK(post_id, tag_id)`                                                       |
| post_tags  | 外键     | `post_id → posts.id`，CASCADE；`tag_id → tags.id`，CASCADE                  |
| post_links | UNIQUE   | `UNIQUE(source_post_id, target_text)`                                       |
| post_links | CHECK    | `CHECK(target_post_id IS NULL OR source_post_id != target_post_id)`         |
| post_links | 外键     | `source_post_id → posts.id`，CASCADE；`target_post_id → posts.id`，SET NULL |
| settings   | 主键     | `PK(key)`                                                                   |

### 索引（业务表）

| 表         | 索引                               | 用途         |
| ---------- | ---------------------------------- | ------------ |
| posts      | `INDEX(status, published_at DESC)` | 首页文章列表 |
| posts      | `INDEX(category_id)`               | 按分类查文章 |
| post_tags  | `INDEX(tag_id)`                    | 按标签查文章 |
| post_links | `INDEX(target_post_id)`            | 反向链接     |

> auth 表的约束/索引见第 0 节（由 void 生成）。
> UNIQUE 和主键会自动建立索引，因此 `post_links(source_post_id)` 已被 `UNIQUE(source_post_id, target_text)` 覆盖，`post_tags(post_id)` 已被复合主键覆盖，无需另建。

### 应用层约定

- 保存文章时：删除该文章旧的 `post_links`，解析 `[[ ]]` 后重新插入，跳过自链接。
- 新建文章或修改标题/slug 后：按 `target_text` 回填 `post_links.target_post_id`。
- 给文章打标签时：使用忽略冲突的插入。
- 首次发布时写入 `published_at`；再次发布不覆盖。
- `posts.author_id` 存 `user.id`，不建外键；**暂不提供删除用户功能**，因此「有文章的用户不能删」的约束暂时无需在应用层实现（单人博客）。
- 时间戳比对：业务表是秒、auth 表是毫秒，跨表比对时统一到同一单位再算。

## 运行 / 部署前必做

- [ ] `BETTER_AUTH_SECRET`：void 部署时自动创建并复用，**无需手动设置**；本地 dev 无需配置，仅「本地预览生产构建」时才需在 `.env` 里提供。
- [ ] 已关闭公开注册（`auth.ts` 里 `emailAndPassword.disableSignUp = true`）。
- [ ] 首个管理员账号通过 seed 脚本或一次性手段创建（注册入口已关，需引导账号）。
