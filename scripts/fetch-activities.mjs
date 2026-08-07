#!/usr/bin/env node
/**
 * 活动数据抓取脚本（自动更新核心）
 * - 米哈游三家（原神/崩铁/绝区零）直接调官方公告 API，实时解析
 * - 鸣潮/终末地：当前复用 public/activities.backup.json 的快照兜底（标记 stale）
 *   后续可补库洛/鹰角公告接口，升级为全实时
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

// 米哈游三家公告接口（无 Cookie 即可访问）
const MIHOYO = {
  genshin: 'https://hk4e-api.mihoyo.com/common/hk4e_cn/announcement/api/getAnnList?game=hk4e&game_biz=hk4e_cn&lang=zh-cn&bundle_id=hk4e_cn&platform=pc&region=cn_gf01&level=55&uid=100000000',
  starrail: 'https://hkrpg-api.mihoyo.com/common/hkrpg_cn/announcement/api/getAnnList?game=hkrpg&game_biz=hkrpg_cn&lang=zh-cn&bundle_id=hkrpg_cn&platform=pc&region=prod_gf_cn&level=70&uid=100000000',
  zzz: 'https://announcement-api.mihoyo.com/common/nap_cn/announcement/api/getAnnList?game=nap&game_biz=nap_cn&lang=zh-cn&bundle_id=nap_cn&platform=pc&region=prod_gf_cn&level=60&uid=100000000',
};

const GAME_IDS = ['genshin', 'starrail', 'zzz', 'wuwa', 'endfield'];

function hashId(game, title, start) {
  return `${game}:${crypto.createHash('md5').update(`${title}|${start}`).digest('hex')}`;
}
function parseTime(s) {
  if (!s) return 0;
  const t = new Date(`${s.replace(' ', 'T')}+08:00`); // 米哈游时间为北京时间
  return isNaN(t.getTime()) ? 0 : t.getTime();
}
function stripHtml(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function classify(typeLabel) {
  const t = typeLabel || '';
  if (/活动/.test(t)) return 'activity';
  if (/祈愿|卡池|概率UP|跃迁/.test(t)) return 'gacha';
  if (/版本|更新说明/.test(t)) return 'version';
  return 'notice';
}

async function fetchMihoyo(game, url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (j.retcode !== 0) throw new Error(`retcode=${j.retcode}`);
  const acts = [];
  for (const g of j?.data?.list || []) {
    for (const a of g.list || []) {
      const start = parseTime(a.start_time);
      const end = parseTime(a.end_time);
      acts.push({
        id: hashId(game, a.title, a.start_time),
        game,
        title: stripHtml(a.title),
        type: a.type_label || '',
        category: classify(a.type_label),
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

  const snapshots = [];
  for (const game of GAME_IDS) {
    const url = MIHOYO[game];
    if (url) {
      try {
        const acts = await fetchMihoyo(game, url);
        snapshots.push({ game, fetchedAt: Date.now(), ok: true, stale: false, activities: acts });
        console.log(`[${game}] 实时抓取 ${acts.length} 条`);
        continue;
      } catch (e) {
        console.log(`[${game}] 实时抓取失败：${e.message}，回退备份`);
      }
    }
    // 鸣潮/终末地 或 抓取失败 → 备份兜底
    const b = backupByGame[game];
    if (b) snapshots.push({ ...b, stale: true });
    else snapshots.push({ game, fetchedAt: Date.now(), ok: false, stale: true, error: 'no data', activities: [] });
  }

  fs.writeFileSync(OUT, JSON.stringify({ snapshots }, null, 0));
  const total = snapshots.reduce((n, s) => n + s.activities.length, 0);
  console.log(`已写入 ${OUT} 总活动 ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
