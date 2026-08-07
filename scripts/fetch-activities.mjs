#!/usr/bin/env node
/**
 * 活动数据抓取脚本（自动更新核心）
 * - 米哈游三家（原神/崩铁/绝区零）直接调官方公告 API，实时解析
 * - 鸣潮（库洛）：官网资讯静态 JSON（ArticleMenu），含 startTime / 分类
 * - 终末地（鹰角）：web-news 公告接口（bulletin），含 displayTime / 分类 tab
 * 三者均为实时抓取；任一失败自动回退 public/activities.backup.json（标记 stale）。
 * 输出标准 {snapshots:[...]}，前端 STATIC_MODE 直接读取。
 *
 * 分类原则（用户诉求：只展示「本版本需要完成的活动 + 当前祈愿」，其余默认隐藏）：
 *   1) 祈愿/卡池/概率类 → gacha（最高优先级，先于活动判定）
 *   2) 纯资讯/运营/推广类（PV、周边、社媒、防沉迷、公平运营、问卷、版本说明等）→ version（看板默认隐藏，数据保留）
 *   3) 真正的限时玩法/活动 → activity（展示）
 *   4) 带书名号的标题兜底为 activity
 *   5) 其余默认隐藏（version），避免垃圾漏出
 * 米哈游三家公告混在同一「公告」频道、无法靠频道名区分，故统一以标题关键词判定。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'activities.json');
const BACKUP = path.join(PUBLIC, 'activities.backup.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const DAY = 86400000;
/** 仅保留当前版本窗口内的公告（约一个版本 ~6 周），避免把旧版本活动当「进行中」 */
const RECENCY_MS = 45 * DAY;
/** 无明确结束时间时，按发布时间顺延一个版本窗口作为有效截止，避免一抓就「已结束」 */
const ROLLING_WINDOW = 45 * DAY;

// 米哈游三家公告接口（无 Cookie 即可访问）
const MIHOYO = {
  genshin: 'https://hk4e-api.mihoyo.com/common/hk4e_cn/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_cn&lang=zh-cn&bundle_id=hk4e_cn&platform=pc&region=cn_gf01&level=55&uid=100000000',
  starrail: 'https://hkrpg-api.mihoyo.com/common/hkrpg_cn/announcement/api/getAnnList?game=hkrpg&game_biz=hkrpg_cn&lang=zh-cn&bundle_id=hkrpg_cn&platform=pc&region=prod_gf_cn&level=70&uid=100000000',
  zzz: 'https://announcement-api.mihoyo.com/common/nap_cn/announcement/api/getAnnList?game=nap&game_biz=nap_cn&lang=zh-cn&bundle_id=nap_cn&platform=pc&region=prod_gf_cn&level=60&uid=100000000',
};

// 鸣潮（库洛）官网资讯 JSON
const WUWA_ARTICLES = 'https://media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/zh/ArticleMenu.json';
// 终末地（鹰角）web-news 公告接口
const ENDFIELD_BULLETIN = 'https://web-news.hypergryph.com/api/bulletin?lang=zh-cn&code=endfield_web&page=1&pageSize=50';

const GAME_IDS = ['genshin', 'starrail', 'zzz', 'wuwa', 'endfield'];

/* ----------------------------- 分类关键词 ----------------------------- */
// 祈愿/卡池/概率类 → gacha（最高优先级）
const GACHA_KW =
  /祈愿|卡池|概率\s*UP|概率提升|跃迁|寻访|特许|唤取|复刻|返场|角色\s*UP|武器\s*UP|UP！|限定\s*UP|概率公示|概率up|概率ＵＰ/i;

// 纯资讯 / 运营 / 推广类 → 隐藏（看板默认不显示）
const JUNK_KW =
  /PV|音乐专辑|周边|优惠|上新|商城|手办|服饰|同人|画集|设定集|售卖|特卖|折扣|礼包|礼盒|小程序|企业微信|社媒|聚合|防沉迷|公平运营|运营声明|用户协议|隐私政策|社区|问卷|有奖|调研|内容一览|版本更新说明|更新维护|维护预告|游戏优化|已知问题|修复与优化|修复公告|问题修复|补偿说明|停机维护|停服|版本预下载|版本内容说明|版本资讯|版本前瞻|研发通讯|前瞻|新增关卡|任务说明|剧情说明|内容说明|无名勋礼|纪行|空月祝福|私募基金|封禁处理公示|处罚账号公示|处罚公示|打击代充|代充|不删档|不限量测试|招募|预下载|实名|健康|账号安全|安全公告|数据面板|实时数据|技术测试|云·终末地|云·鸣潮|玩家社区|研发终端|FAQ|谨防诈骗|诈骗|防诈/i;

// 真正的限时玩法 / 活动 → activity（展示）
const EVENT_KW =
  /活动|挑战|双倍|签到|秘境|竞速|答题|收集|探索|限时|联动|赛季|庆典|嘉年华|作战|试炼|远征|讨伐|竞演|对决|大作战|网页活动|连线|骇入|玩法|盛典|游赏|秘藏|材料.*双倍|兵器|征讨|悬赏|竞猜|解谜|募集|预约|肉鸽|塔防|跑酷|音游|征召|申领|复刻|模块|共创|同游|同行|共游|企划/i;

// 带书名号且非纯公告/说明的标题兜底为活动
const BRACKET_EVENT = /「[^」]{1,20}」/;
const BRACKET_EXCLUDE = /更新公告|版本说明|维护|预告|任务说明|内容说明|研发通讯/;

function classifyEvent(title, { bracketFallback = true } = {}) {
  const t = title || '';
  if (/内容一览|版本节目单|版本前瞻总览/.test(t)) return 'version'; // 版本总览非具体祈愿
  if (GACHA_KW.test(t)) return 'gacha';
  if (JUNK_KW.test(t)) return 'version';
  if (EVENT_KW.test(t)) return 'activity';
  if (bracketFallback && BRACKET_EVENT.test(t) && !BRACKET_EXCLUDE.test(t)) return 'activity';
  return 'version'; // 默认隐藏，避免垃圾漏出
}

function hashId(game, title, start) {
  return `${game}:${crypto.createHash('md5').update(`${title}|${start}`).digest('hex')}`;
}
function parseTime(s) {
  if (!s) return 0;
  const t = new Date(`${s.replace(' ', 'T')}+08:00`); // 北京时间
  return isNaN(t.getTime()) ? 0 : t.getTime();
}
function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
/** 滚动截止：以发布时间顺延一个版本窗口，且保证不早于“当前+3天” */
function rollingEnd(start) {
  return Math.max(start + ROLLING_WINDOW, Date.now() + 3 * DAY);
}
/** 从文本里尝试解析日期区间，返回最晚日期的 ms；解析不到返回 0 */
function parseDateRange(text) {
  if (!text) return 0;
  const re = /(20\d{2})[.\-/年](1[0-2]|0?[1-9])[.\-/月](3[01]|[12]\d|0?[1-9])日?/g;
  const hits = [];
  let m;
  while ((m = re.exec(text))) {
    const y = +m[1];
    const mo = +m[2];
    const d = +m[3];
    const t = new Date(Date.UTC(y, mo - 1, d, 15, 59, 59)); // UTC 15:59 => 北京 23:59
    if (!isNaN(t.getTime())) hits.push(t.getTime());
  }
  if (!hits.length) return 0;
  return hits.length >= 2 ? Math.max(...hits) : hits[0];
}
/** 结束时间：优先文本解析出的区间末日；鸣潮/终末地无明确结束时间则滚动顺延 */
function deriveEndTime(start, text) {
  const parsed = parseDateRange(text);
  if (parsed && parsed > start) return parsed;
  return rollingEnd(start);
}
/** 从 HTML 里取第一张图作为 banner */
function firstImg(html) {
  const m =
    (html || '').match(/<img[^>]+src=["']([^"']+)["']/i) ||
    (html || '').match(/<img[^>]+data-src=["']([^"']+)["']/i);
  return m ? m[1] : undefined;
}

/* ----------------------------- 米哈游 ----------------------------- */
async function fetchMihoyo(game, url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (j.retcode !== 0) throw new Error(`retcode=${j.retcode}`);
  const acts = [];
  for (const g of j?.data?.list || []) {
    for (const a of g.list || []) {
      const title = stripHtml(a.title);
      const start = parseTime(a.start_time);
      const endRaw = parseTime(a.end_time);
      const category = classifyEvent(title, { bracketFallback: false });
      // 米哈游接口自带 end_time，优先使用；缺失时滚动顺延，避免「已结束」
      const end = endRaw || rollingEnd(start);
      acts.push({
        id: hashId(game, title, a.start_time),
        game,
        title,
        type: g.type_label || a.type_label || '',
        category,
        banner: a.banner || undefined,
        url: a.url || undefined,
        startTime: start,
        endTime: end,
        permanent: false,
        source: 'api',
      });
    }
  }
  return acts;
}

/* ----------------------------- 鸣潮（库洛） ----------------------------- */
function wuwaTypeLabel(articleType) {
  return articleType === 52 ? '版本内容' : articleType === 51 ? '角色档案' : '资讯';
}
export async function fetchWuwa() {
  const r = await fetch(WUWA_ARTICLES, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const list = await r.json();
  if (!Array.isArray(list)) throw new Error('unexpected shape');
  const acts = [];
  const now = Date.now();
  for (const a of list) {
    const start = parseTime(a.startTime);
    if (start < now - RECENCY_MS) continue; // 仅保留当前版本窗口
    if (a.articleType === 51) continue; // 角色档案/研究员手记等非活动，直接跳过（等同隐藏）
    const title = stripHtml(a.articleTitle);
    const category = classifyEvent(title, { bracketFallback: true });
    const text = `${a.articleTitle}\n${a.articleDesc}\n${a.articleContent}`;
    const end = deriveEndTime(start, text);
    if (end < Date.now()) continue; // 已结束的旧活动不展示
    acts.push({
      id: hashId('wuwa', `${a.articleId}|${a.articleTitle}`, a.startTime),
      game: 'wuwa',
      title,
      type: wuwaTypeLabel(a.articleType),
      category,
      banner: firstImg(a.articleContent),
      url: `https://mc.kurogames.com/main/news/detail/${a.articleId}`,
      startTime: start,
      endTime: end,
      permanent: false,
      source: 'api',
    });
  }
  return acts;
}

/* ----------------------------- 终末地（鹰角） ----------------------------- */
export async function fetchEndfield() {
  const r = await fetch(ENDFIELD_BULLETIN, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`code=${j.code}`);
  const acts = [];
  const now = Date.now();
  for (const it of j?.data?.list || []) {
    const start = (it.displayTime || 0) * 1000;
    if (start < now - RECENCY_MS) continue; // 仅保留当前版本窗口
    const title = stripHtml(it.title);
    const category = classifyEvent(title, { bracketFallback: true });
    const text = `${it.title}\n${it.brief}`;
    const end = deriveEndTime(start, text);
    if (end < Date.now()) continue; // 已结束的旧活动不展示
    acts.push({
      id: hashId('endfield', `${it.cid}|${it.title}`, String(start)),
      game: 'endfield',
      title,
      type: it.tab || '公告',
      category,
      banner: it.cover || it.extraCover || undefined,
      url: `https://endfield.hypergryph.com/zh-cn/news/${it.cid}`,
      startTime: start,
      endTime: end,
      permanent: false,
      source: 'api',
    });
  }
  return acts;
}

/* ----------------------------- 主流程 ----------------------------- */
function loadBackup() {
  try {
    return JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const backup = loadBackup();
  const backupByGame = {};
  if (backup) for (const s of backup.snapshots || []) backupByGame[s.game] = s;

  const fetchers = { wuwa: fetchWuwa, endfield: fetchEndfield };
  const snapshots = [];
  for (const game of GAME_IDS) {
    const url = MIHOYO[game];
    if (url) {
      try {
        const acts = await fetchMihoyo(game, url);
        snapshots.push({ game, fetchedAt: Date.now(), ok: true, stale: false, activities: acts });
        console.log(`[${game}] 实时抓取 ${acts.length} 条（版本/公告类默认隐藏）`);
        continue;
      } catch (e) {
        console.log(`[${game}] 米哈游实时抓取失败：${e.message}，回退备份`);
      }
    } else if (fetchers[game]) {
      try {
        const acts = await fetchers[game]();
        snapshots.push({ game, fetchedAt: Date.now(), ok: true, stale: false, activities: acts });
        console.log(`[${game}] 实时抓取 ${acts.length} 条（版本/公告类默认隐藏）`);
        continue;
      } catch (e) {
        console.log(`[${game}] 实时抓取失败：${e.message}，回退备份`);
      }
    }
    // 抓取失败 → 备份兜底（保留全部，版本/公告类由看板默认隐藏）
    const b = backupByGame[game];
    if (b) snapshots.push({ ...b, stale: true, activities: b.activities });
    else snapshots.push({ game, fetchedAt: Date.now(), ok: false, stale: true, error: 'no data', activities: [] });
  }

  fs.writeFileSync(OUT, JSON.stringify({ snapshots }, null, 0));
  const total = snapshots.reduce((n, s) => n + s.activities.length, 0);
  console.log(`已写入 ${OUT} 总活动 ${total}`);
}

export { fetchMihoyo };

const isMain = process.argv[1] && process.argv[1].endsWith('fetch-activities.mjs');
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
