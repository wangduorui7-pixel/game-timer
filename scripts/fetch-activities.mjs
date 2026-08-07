#!/usr/bin/env node
/**
 * 活动数据抓取脚本（自动更新核心）
 * - 米哈游三家（原神/崩铁/绝区零）直接调官方公告 API，实时解析
 * - 鸣潮（库洛）：官网资讯静态 JSON（ArticleMenu），含 startTime / 分类
 * - 终末地（鹰角）：web-news 公告接口（bulletin），含 displayTime / 分类 tab
 * 三者均为实时抓取；任一失败自动回退 public/activities.backup.json（标记 stale）。
 * 输出标准 {snapshots:[...]}，前端 STATIC_MODE 直接读取。
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

// 无明确结束时间时，按分类给一个“有效窗口”，避免活动一抓就显示“已结束”
const WINDOW_MS = { activity: 14 * DAY, gacha: 21 * DAY, version: 30 * DAY, notice: 7 * DAY };

const GAME_IDS = ['genshin', 'starrail', 'zzz', 'wuwa', 'endfield'];

// 分类关键词：祈愿/卡池 → gacha；版本更新/修复/维护/补偿等纯资讯 → 归为 version（看板默认隐藏，但保留数据不删除）
const GACHA_KW = /祈愿|卡池|概率\s*UP|跃迁|寻访|特许|复刻|返场|角色\s*UP|武器\s*UP|限定\s*UP|概率提升/i;
const INFO_KW =
  /版本更新说明|更新修复|修复与优化|修复公告|维护公告|停服|停机维护|补偿说明|问题修复|bug\s*修复|故障说明|更新公告|版本更新|例行维护|临时维护|已知问题|问题说明|优化说明|游戏优化|版本优化|玩法优化/i;
const isGachaText = (t) => GACHA_KW.test(t || '');
const isPureInfo = (t) => INFO_KW.test(t || '');

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
// 米哈游以「分组频道 type_label」为主信号、标题兜底；默认倾向展示，避免把真实活动误删为公告
function classifyMihoyo(groupType, title) {
  const g = groupType || '';
  if (/活动/.test(g)) return 'activity';
  if (/祈愿|卡池/.test(g)) return 'gacha';
  if (isGachaText(title)) return 'gacha';
  if (isPureInfo(title)) return 'version'; // 纯资讯：看板默认隐藏，但保留数据
  return 'activity'; // 默认展示（星铁「公告」分组下的真实活动都在此）
}

/** 从文本里尝试解析日期区间，返回最晚日期的 ms（北京时间 23:59:59）；解析不到返回 0 */
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

/** 结束时间：优先用文本解析出的区间末日，否则用分类默认窗口 */
function deriveEndTime(start, category, text) {
  const parsed = parseDateRange(text);
  if (parsed && parsed > start) return parsed;
  return start + (WINDOW_MS[category] || WINDOW_MS.notice);
}

/** 从 HTML 里取第一张图作为 banner */
function firstImg(html) {
  const m = (html || '').match(/<img[^>]+src=["']([^"']+)["']/i) || (html || '').match(/<img[^>]+data-src=["']([^"']+)["']/i);
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
      const end = parseTime(a.end_time);
      acts.push({
        id: hashId(game, title, a.start_time),
        game,
        title,
        type: g.type_label || a.type_label || '',
        category: classifyMihoyo(g.type_label, title),
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
function classifyWuwa(articleType) {
  // 52 = 版本内容说明 / 活动说明（头部重磅，默认展示）
  // 51 = 角色档案 / 资讯（默认隐藏，可在筛选器开启）
  if (articleType === 52) return 'activity';
  if (articleType === 51) return 'notice';
  return 'notice';
}
function wuwaTypeLabel(articleType) {
  return articleType === 52 ? '版本内容' : articleType === 51 ? '角色档案' : '资讯';
}
export async function fetchWuwa() {
  const r = await fetch(WUWA_ARTICLES, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const list = await r.json();
  if (!Array.isArray(list)) throw new Error('unexpected shape');
  const acts = [];
  for (const a of list) {
    const start = parseTime(a.startTime);
    const category = classifyWuwa(a.articleType);
    const text = `${a.articleTitle}\n${a.articleDesc}\n${a.articleContent}`;
    const end = deriveEndTime(start, category, text);
    // 过滤过旧公告（结束超过 30 天前），保持看板清爽
    if (end < Date.now() - 30 * DAY) continue;
    acts.push({
      id: hashId('wuwa', `${a.articleId}|${a.articleTitle}`, a.startTime),
      game: 'wuwa',
      title: stripHtml(a.articleTitle),
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
function classifyEndfield(tab, title) {
  if (tab === 'events') return 'activity';
  if (/寻访|特许|概率提升|卡池|凭证/.test(title)) return 'gacha';
  if (isPureInfo(title)) return 'version'; // 纯版本/维护/补偿说明：看板默认隐藏，但保留数据
  // 其余（含 news 分组）默认展示，避免误删真实活动
  return 'activity';
}
export async function fetchEndfield() {
  const r = await fetch(ENDFIELD_BULLETIN, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`code=${j.code}`);
  const acts = [];
  for (const it of j?.data?.list || []) {
    const start = (it.displayTime || 0) * 1000;
    const category = classifyEndfield(it.tab, it.title || '');
    const text = `${it.title}\n${it.brief}`;
    const end = deriveEndTime(start, category, text);
    // 过滤过旧公告（结束超过 30 天前），保持看板清爽
    if (end < Date.now() - 30 * DAY) continue;
    acts.push({
      id: hashId('endfield', `${it.cid}|${it.title}`, String(start)),
      game: 'endfield',
      title: stripHtml(it.title),
      type: it.tab || '公告',
      category,
      banner: it.cover || (it.extraCover || undefined),
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
