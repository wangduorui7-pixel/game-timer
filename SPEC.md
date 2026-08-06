# 五游活动倒计时台 — 团队共享契约

> 所有子 agent 必须严格遵守本文件。任何跨模块改动先改本文件再改代码。
> 项目根：`C:\Users\Lenovo\WorkBuddy\2026-08-06-17-49-42\game-timer`

## 0. 产品定义（已与用户确认，不得改需求）

- 查询 **原神 / 崩坏：星穹铁道 / 绝区零 / 鸣潮 / 明日方舟：终末地** 五款游戏的活动**截止时间**。
- 倒计时**精确到秒**，实时跳动。
- **登录可选**：
  - 未登录 → 显示公开活动倒计时，完成状态存 `localStorage`。
  - 登录后 → 显示每个活动是否已完成，完成状态存服务端、多端同步。
- **已完成的活动排到最底下**（独立分区，可折叠）。
- 进度条**只显示完成度**（已完成/未完成 → 0% / 100%，以及分组维度的 x/y 完成度）。**不要时间进度百分比条**。
- 用户可**自主选择显示哪些游戏**。
- 鸣潮 / 终末地：爬公告页拿剩余时间；同时提供**手动补录 + 手动标记已完成**入口。
- 数据源为**纯联网实时抓取**；抓取失败时**服务端返回最后一次成功缓存**，并告知"数据更新于 X 前"。
- **双主题可切换**（深色游戏风 / 明亮清爽），记住偏好。
- **手机 / 平板 / PC 三端**都必须好用。
- 界面尽量美观、动效丰富。

## 0.5 【第二轮需求】三家游戏账号绑定 → 真实完成度（本轮核心）

用户要求：**登录米哈游账号、库洛账号、鹰角账号，从而获取哪些活动已完成**，且 **PC 和手机端都能用**。

### 技术现实（已实测，2026-08-06）
三家**都没有开放 OAuth**，唯一可行路径是**用户手动粘贴凭据**。实测三家接口全部存活，只差凭据：

| 家 | 探测结果 | 需要的凭据 |
|---|---|---|
| 米哈游 | `getUserGameRolesByCookie` → `retcode:-100 登录状态失效，请重新登录`；`dailyNote` → `retcode:10001 Please login` | 米游社 Cookie（`cookie_token_v2`+`account_id_v2` 或 `ltoken_v2`+`ltuid_v2`）|
| 库洛 | `api.kurobbs.com/*` → `code:220 访问令牌不能为空 / 登录已过期` | 库街区 `token`（请求头 `token`）|
| 鹰角 | `zonai.skland.com/api/v1/*` → `401 code:10002 用户未登录`；`as.hypergryph.com/user/oauth2/v2/grant` → 400 参数校验（说明活着）| 森空岛 `cred`+`token`，或鹰角通行证 token 换 cred |

### 「已完成」的真实来源（不许编造，拿不到就诚实降级）
官方**不返回**「某个版本活动完成了百分之多少」。能拿到的真实可完成项是**日常/周常/深渊类**：
- 原神：每日委托 x/4、周本树脂折扣 x/3、参量质变仪、洞天宝钱、派遣 x/5、**深境螺旋**层数星数
- 崩铁：每日实训 x/500、开拓力、委托 x/4、**模拟宇宙**积分、**混沌回忆/虚构叙事/末日幻影**
- 绝区零：每日活跃 x/400、电量、刮刮乐、**式舆防卫战**
- 鸣潮（库街区）：数据坞角色数据、日常/活跃度（以实际接口返回为准）
- 终末地（森空岛）：以实际 binding 返回为准；**若森空岛尚未接入终末地，必须如实报告并降级为手动勾选**

### 交互要求
- 绑定入口在 Header 用户菜单 + 独立「账号绑定」抽屉/弹窗，**PC 和手机端都必须完整可用**（手机上弹窗不许裁切、输入框不许被键盘顶飞、粘贴按钮要大）。
- 每家绑定卡片要有**详细的凭据获取图文步骤**（分 PC 浏览器 F12 / 手机端两种路径说明）。
- 绑定后显示：账号昵称、UID、等级、绑定状态、最后同步时间、解绑按钮。
- 拉到真实数据后，在对应游戏区域显示**「账号任务」卡片组**（每日/周常/深渊各一张），带真实完成度进度条和 x/y 数字。
- 公告类活动仍保留**手动勾选**（官方无完成度接口，这是唯一诚实做法），UI 上要明确区分「账号同步」和「手动标记」两种来源。
- 凭据一律 **AES-256-GCM 加密落库**，接口**永不回传明文**，前端只展示掩码（如 `ltoken_v2=****abcd`）。
- 任何一家绑定失败/失效，**不得阻塞主流程**，只在该家卡片上显示「凭据已失效，请重新绑定」。

### 新增共享类型（追加到 `shared/types.ts`）
```ts
export type Provider = 'mihoyo' | 'kuro' | 'hypergryph';

export interface BindingInfo {
  provider: Provider;
  bound: boolean;
  nickname?: string;
  uid?: string;
  level?: number;
  region?: string;
  lastSyncAt?: number;
  valid: boolean;          // 凭据是否仍有效
  error?: string;          // 中文失效原因
}

export type TaskPeriod = 'daily' | 'weekly' | 'season' | 'permanent';

export interface AccountTask {
  id: string;              // `${game}:task:${key}`
  game: GameId;
  group: string;           // 「每日委托」「深境螺旋」…
  label: string;
  period: TaskPeriod;
  finished: number;
  total: number;
  done: boolean;           // finished >= total
  /** 该周期的重置时间 ms epoch，用于倒计时 */
  resetAt?: number;
  detail?: string;
}

export interface AccountSnapshot {
  game: GameId;
  provider: Provider;
  ok: boolean;
  syncedAt: number;
  error?: string;
  tasks: AccountTask[];
}
```

### 新增 API（backend 实现）
- `GET  /api/bindings` → `{ bindings: BindingInfo[] }`（三家状态，需登录）
- `POST /api/bindings/:provider` `{credential}` → `{binding: BindingInfo}`，立即校验凭据有效性，无效返回 400 + 中文原因
- `DELETE /api/bindings/:provider` → `{ok:true}`
- `GET  /api/account-tasks?games=...` → `{ snapshots: AccountSnapshot[] }`，缓存 5 分钟，失败降级返回 `ok:false`
- `POST /api/account-tasks/refresh` → 强制刷新

## 1. 技术栈（已由脚手架锁定，不要换）

Express 4 + better-sqlite3 + React 18 + Vite 5 + TypeScript + Tailwind 3。
`type: "module"`，服务端用 `tsx` 运行。后端 3001，前端 5173，Vite 代理 `/api`。

## 2. 目录与归属（严禁越界改别人的文件）

| 归属 | 目录/文件 |
|---|---|
| data-scout | `server/sources/**` |
| backend-dev | `server/index.ts` `server/db.ts` `server/auth.ts` `server/cache.ts` `server/mihoyo-note.ts` |
| fe-core | `src/main.tsx` `src/App.tsx` `src/pages/**` `src/hooks/**` `src/lib/**` `vite.config.ts` |
| fe-visual | `src/components/**` `src/index.css` `tailwind.config.js` `src/theme/**` |
| 共享（只读，仅 lead 可改） | `shared/types.ts` `SPEC.md` |

## 3. 共享数据类型（`shared/types.ts`，前后端共用）

```ts
export type GameId = 'genshin' | 'starrail' | 'zzz' | 'wuwa' | 'endfield';

export interface ActivityItem {
  id: string;            // 稳定 ID：`${game}:${sha1(title+startTime)}`，刷新后必须保持不变
  game: GameId;
  title: string;         // 纯文本，必须剥离 HTML 标签
  type: string;          // 活动 / 祈愿 / 公告 / 版本
  category: 'activity' | 'gacha' | 'notice' | 'version';
  banner?: string;       // 头图 URL，可空
  url?: string;          // 详情链接
  startTime: number;     // ms epoch
  endTime: number;       // ms epoch；永久活动用 0
  permanent: boolean;    // true = 长期开放，不参与倒计时排序
  source: 'api' | 'scrape' | 'manual';
}

export interface GameSnapshot {
  game: GameId;
  fetchedAt: number;     // ms epoch
  ok: boolean;           // 本次抓取是否成功
  stale: boolean;        // true = 本次抓取失败，返回的是缓存
  error?: string;        // 失败原因（用户可读中文）
  activities: ActivityItem[];
}
```

## 4. HTTP API 契约（backend-dev 实现，fe-core 消费）

所有响应 `application/json`。鉴权用 `Authorization: Bearer <token>`，**可选**——不带 token 的请求必须正常返回公开数据。

### 活动数据
- `GET /api/activities?games=genshin,zzz` → `{ snapshots: GameSnapshot[] }`
  - `games` 省略 = 全部五款。
  - 单个游戏抓取失败**不能**让整个请求 500，必须在该 snapshot 里 `ok:false stale:true` 返回缓存。
- `POST /api/activities/refresh` → 强制绕过缓存重抓，返回同上结构。

### 账号（可选登录）
- `POST /api/auth/register` `{username, password}` → `{token, user}`
- `POST /api/auth/login` `{username, password}` → `{token, user}`
- `GET /api/auth/me` → `{user}`
- 密码 `scrypt` 加盐哈希；token 为自签 HMAC-SHA256 JWT，有效期 30 天。

### 用户偏好（需登录）
- `GET /api/prefs` → `{ games: GameId[], theme: 'dark'|'light' }`
- `PUT /api/prefs` `{games?, theme?}` → 同上

### 完成状态（需登录；未登录走 localStorage）
- `GET /api/completions` → `{ [activityId: string]: number }`（value = 完成时间戳）
- `PUT /api/completions/:activityId` `{done: boolean}` → `{ok:true}`

### 手动补录（需登录，服务于鸣潮/终末地）
- `GET /api/manual` → `{ items: ActivityItem[] }`
- `POST /api/manual` `{game, title, endTime, startTime?, type?}` → `{item}`
- `DELETE /api/manual/:id` → `{ok:true}`
- 手动条目必须并入 `/api/activities` 对应游戏的 snapshot，`source:'manual'`。

### 米游社便笺（可选，需登录 + 绑定 Cookie）
- `POST /api/bind/mihoyo` `{cookie}` → `{ok:true, uidList}`；Cookie 用 AES-256-GCM 加密后落库，**永不回传明文**。
- `GET /api/note/:game` → `{ok, data}`，game ∈ genshin/starrail/zzz。抓不到就 `{ok:false}`，前端静默降级，**不得报错阻塞主流程**。

## 5. 数据源（data-scout 负责，已验证部分不要动）

### 已验证可用 ✅
| 游戏 | 接口 |
|---|---|
| 原神 | `https://hk4e-api.mihoyo.com/common/hk4e_cn/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_cn&lang=zh-cn&bundle_id=hk4e_cn&platform=pc&region=cn_gf01&level=55&uid=100000000` |
| 崩铁 | `https://hkrpg-api.mihoyo.com/common/hkrpg_cn/announcement/api/getAnnList?game=hkrpg&game_biz=hkrpg_cn&lang=zh-cn&bundle_id=hkrpg_cn&platform=pc&region=prod_gf_cn&level=70&uid=100000000` |
| 绝区零 | `https://announcement-api.mihoyo.com/common/nap_cn/announcement/api/getAnnList?game=nap&game_biz=nap_cn&lang=zh-cn&bundle_id=nap_cn&platform=pc&region=prod_gf_cn&level=60&uid=100000000` |

注意：`getAnnList` 的 `end_time` 是**服务器本地时间字符串**（`YYYY-MM-DD HH:mm:ss`，UTC+8），需按 **UTC+8** 解析成 epoch，不能用 `new Date(str)` 直接吃（会按本机时区解释）。
配套 `getAnnContent` 同域名同路径，可拿 banner 图。

### 待攻坚 ⚠️
- **鸣潮**：`aki-gm-resources.aki-game.com` 旧路径已 404；`api.kurobbs.com/forum/companyEvent/findEventList` 直接 GET 返回 `code:102`（需 POST + 特定 header/body）。需重新定位。
- **终末地**：`endfield.hypergryph.com` 为 Next.js，HTML 内可能含 `__NEXT_DATA__`；鹰角 `ak-conf.hypergryph.com` 那套是明日方舟本体的，终末地需另找。

抓不到时 **不许编造数据**：返回 `ok:false` + 中文原因，让前端引导用户手动补录。

## 6. 前端硬性验收点

1. 倒计时**每秒刷新**，格式 `3天 04:21:07`；< 24h 高亮告警；< 1h 脉冲动画；已过期显示"已结束"。
2. 使用**单一全局 ticker**（一个 `setInterval` 广播），禁止每张卡片各自开定时器。
3. 未登录可完整使用；点"登录"才要求账号。
4. 已完成活动移到底部独立折叠分区，带数量徽标。
5. 游戏筛选为多选 chip，选择即时生效并持久化。
6. 主题切换按钮在 Header，切换有过渡动画，刷新后保持。
7. 断点：`<640px` 单列、`640–1024px` 双列、`>1024px` 三列/四列。移动端点击热区 ≥44px。
8. 数据 stale 时顶部显示黄色横幅"数据更新于 X 前 · 点击重试"。
9. 骨架屏 loading，不能白屏闪烁。
10. `prefers-reduced-motion` 时关闭大动效。

## 6.5 组件契约（fe-visual 实现，fe-core 消费，双方都不许改签名）

全部位于 `src/components/`，全部 **named export**：

```ts
ActivityCard({ activity: ActivityItem; now: number; done: boolean;
               onToggleDone: (id: string, done: boolean) => void })
CountdownText({ endTime: number; now: number; permanent?: boolean; size?: 'sm'|'md'|'lg' })
GameFilterBar({ selected: GameId[]; onChange: (games: GameId[]) => void;
                counts: Record<GameId, number> })
AppHeader({ theme: 'dark'|'light'; onToggleTheme: () => void;
            user: PublicUser | null; onLoginClick: () => void; onLogout: () => void;
            onRefresh: () => void; refreshing: boolean; lastUpdated: number | null })
StaleBanner({ snapshots: GameSnapshot[]; onRetry: () => void })
CompletedSection({ activities: ActivityItem[]; now: number;
                   onToggleDone: (id: string, done: boolean) => void })
SkeletonGrid({ count?: number })
AuthDialog({ open: boolean; onClose: () => void; onSuccess: (auth: AuthResponse) => void })
ManualActivityDialog({ open: boolean; onClose: () => void;
                       onCreated: (item: ActivityItem) => void })
ParticleBackground({})
StatsBar({ total: number; done: number; urgent: number })
EmptyState({ title: string; hint?: string; action?: React.ReactNode })
```

CSS 变量在 `src/index.css` 的 `:root` / `[data-theme="light"]` 里定义，主题切换通过
`document.documentElement.dataset.theme` 驱动，Tailwind 走 `darkMode: ['selector','[data-theme="dark"]']`。

## 7. 交付前必须自检

- `npx tsc --noEmit` 零报错
- `npm run build` 成功
- 后端 `npm run server` 起得来，`curl /api/activities` 返回真实数据
- 三端断点手动验证
