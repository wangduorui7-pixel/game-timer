import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog } from 'tdesign-react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Link2Off,
  Loader2,
  Lock,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { BindingInfo, GameId, Provider } from '../../shared/types';
import { GAME_META, PROVIDER_META } from '../../shared/types';
import { formatAgo, formatDateTime } from '../theme/tokens';

export interface AccountBindingDialogProps {
  open: boolean;
  onClose: () => void;
  bindings: BindingInfo[];
  loading: boolean;
  /** 拉取绑定状态本身失败的原因（不是某一家凭据失效） */
  error: string | null;
  bind: (provider: Provider, credential: string) => Promise<BindingInfo>;
  unbind: (provider: Provider) => Promise<void>;
  /** 绑定/解绑成功后通知外部重新拉任务 */
  onChanged?: () => void;
}

/* ------------------------------------------------------------ 凭据获取指引 */

interface Guide {
  /** 输入框占位与说明 */
  placeholder: string;
  /** 「需要什么」一句话 */
  need: string;
  pc: string[];
  mobile: string[];
  tip?: string;
}

const GUIDES: Record<Provider, Guide> = {
  mihoyo: {
    need: '米游社 Cookie，至少含成对的 ltoken_v2 + ltuid_v2（推荐），或 cookie_token_v2 + account_id_v2',
    placeholder:
      '粘贴形如：ltoken_v2=v2_xxxxx; ltuid_v2=123456789; cookie_token_v2=xxxxx; account_id_v2=123456789',
    pc: [
      '用 Chrome / Edge 打开 https://www.miyoushe.com 并登录（扫码或短信验证码均可）。',
      '按 F12 打开开发者工具，切到「Console / 控制台」标签。',
      '输入 document.cookie 后回车，右键复制输出的那一整行字符串。',
      '若控制台禁止粘贴，改走「Application / 应用」→ Storage → Cookies → https://www.miyoushe.com，手动找到 ltoken_v2、ltuid_v2（或 cookie_token_v2、account_id_v2），按「键=值; 键=值」拼成一行。',
      '回到本页粘贴进上面的输入框，点「绑定」。',
    ],
    mobile: [
      '方式 A（推荐，不用电脑）：装一个支持书签脚本的浏览器（Via / Alook / X 浏览器均可），打开 https://www.miyoushe.com 并登录。',
      '新建一个书签，网址填 javascript:prompt("复制 Cookie", document.cookie) ，保存。',
      '停留在米游社已登录页面时点这条书签，弹窗里会出现完整 Cookie，长按全选复制。',
      '方式 B：安卓可用 Kiwi 浏览器，它自带桌面版开发者工具，操作同上面的 PC 步骤。',
      '方式 C：用抓包工具（Stream / HttpCanary）抓 api-takumi.mihoyo.com 的任意请求，复制其请求头里的 Cookie。',
      '拿到后回到本页（手机上直接长按输入框粘贴，或点「从剪贴板粘贴」）。',
    ],
    tip: 'Cookie 大约 30 天过期，过期后按同样步骤重新取一次即可。多余字段可以一起粘贴，服务端只挑需要的键。',
  },
  kuro: {
    need: '库街区登录 token（形如 eyJhbGciOiJIUzI1NiJ9.xxx.yyy 的 JWT）',
    placeholder:
      '粘贴形如：eyJhbGciOiJIUzI1NiJ9.eyJjcmVhdGVkIjoxNzAwMDAwMDAwMDAwLCJ1c2VySWQiOjEwMDAwMDAwfQ.xxxxxx',
    pc: [
      '用 Chrome / Edge 打开 https://www.kurobbs.com 并用手机号 + 验证码登录。',
      '按 F12 打开开发者工具，切到「Network / 网络」，然后刷新页面。',
      '在请求列表里点任意一条发往 api.kurobbs.com 的请求。',
      '看右侧「Headers / 标头」→「Request Headers / 请求标头」，找到 token: eyJhbGciOi... 这一行。',
      '复制 token: 后面那一整串（不含 token: 前缀），粘贴到上面的输入框。',
    ],
    mobile: [
      '方式 A（不用抓包）：手机浏览器（Kiwi / Via 的桌面模式）打开 www.kurobbs.com 登录，Kiwi 可直接开开发者工具，按 PC 步骤取 token。',
      '方式 B（库街区 App）：App 内没有查看 token 的入口，需要抓包 —— 安装 Stream（iOS）或 HttpCanary / Reqable（安卓），开启 HTTPS 解密并安装信任证书。',
      '开着抓包打开库街区 App，随便进一个「数据坞 / 我的角色」页面产生请求。',
      '在抓包记录里找 api.kurobbs.com 的请求，展开请求头，长按复制 token 字段的值。',
      '回到本页粘贴。',
    ],
    tip: '也接受 token=xxx 的键值串或 {"token":"xxx"} 的 JSON，直接整段粘过来即可。token 失效后重新登录库街区再取一次。',
  },
  hypergryph: {
    need: '鹰角通行证 token（web-api.hypergryph.com/account/info/hg 返回 JSON 里的 content 字段）',
    placeholder:
      '粘贴 content 里那串 token，或直接把整段 {"status":0,"msg":"OK","data":{"content":"xxx"}} 贴进来',
    pc: [
      '浏览器打开 https://www.skland.com（森空岛）并用鹰角通行证登录。',
      '登录成功后，在同一个浏览器里直接访问 https://web-api.hypergryph.com/account/info/hg 。',
      '页面会显示一段 JSON：{"status":0,"msg":"OK","data":{"content":"xxxxxxxx"}}',
      '复制 content 引号里的那串字符（整段 JSON 一起复制也行，服务端会自动提取）。',
      '粘贴到上面的输入框，点「绑定」。',
    ],
    mobile: [
      '手机端步骤和电脑完全一样，任何浏览器都能做，不需要抓包。',
      '手机浏览器打开 https://www.skland.com 登录鹰角通行证。',
      '同一浏览器新开标签访问 https://web-api.hypergryph.com/account/info/hg 。',
      '长按页面上的 JSON 文本全选复制。',
      '回到本页，点「从剪贴板粘贴」或长按输入框粘贴，再点「绑定」。',
    ],
    tip: '这串 token 取出后请尽快绑定；若提示已失效，重新打开上面那个链接再取一次即可。也支持粘贴 cred=xxx; token=yyy 形式的森空岛凭据。',
  },
};

/** 卡片主题色沿用该家覆盖的第一款游戏，复用 [data-game] 的 --ga 体系 */
function themeGame(provider: Provider): GameId {
  return PROVIDER_META[provider].games[0];
}

/* ------------------------------------------------------------------ 子组件 */

function GuideSteps({ icon, title, steps }: { icon: ReactNode; title: string; steps: string[] }) {
  return (
    <div className="gt-bind__path">
      <div className="gt-bind__pathhead">
        {icon}
        {title}
      </div>
      <ol className="gt-bind__steps">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

interface CardProps {
  info: BindingInfo;
  bind: (provider: Provider, credential: string) => Promise<BindingInfo>;
  unbind: (provider: Provider) => Promise<void>;
  onChanged?: () => void;
}

function BindingCard({ info, bind, unbind, onChanged }: CardProps) {
  const provider = info.provider;
  const meta = PROVIDER_META[provider];
  const guide = GUIDES[provider];

  const [credential, setCredential] = useState('');
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unbinding, setUnbinding] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [pasteHint, setPasteHint] = useState('');
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // 未绑定、或凭据失效时，默认就把输入区摊开，少一次点击
  const showForm = editing || !info.bound;

  /**
   * 手机端虚拟键盘会把聚焦的输入框顶出可视区。
   * 这里在聚焦后延迟一帧把输入框滚到弹窗可视区中部，
   * 配合 CSS 的 scroll-margin 双保险。
   */
  const handleFocus = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
  }, []);

  const handlePaste = useCallback(async () => {
    setPasteHint('');
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setCredential(text.trim());
        setErr('');
        taRef.current?.focus();
      } else {
        setPasteHint('剪贴板是空的');
      }
    } catch {
      // 权限被拒 / 浏览器不支持：静默降级，提示用户手动长按粘贴
      setPasteHint('浏览器未授权读取剪贴板，请长按输入框手动粘贴');
    }
  }, []);

  const handleBind = useCallback(async () => {
    const value = credential.trim();
    if (!value) {
      setErr('请先粘贴凭据');
      taRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setErr('');
    setOk('');
    try {
      const next = await bind(provider, value);
      setCredential('');
      setEditing(false);
      setOk(`已绑定 ${next.nickname ?? ''}`.trim());
      onChanged?.();
    } catch (e) {
      // 后端返回的中文原因原样展示，例如「Cookie 已失效，请重新登录米游社复制新的 Cookie」
      setErr(e instanceof Error ? e.message : '绑定失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [bind, credential, onChanged, provider]);

  const handleUnbind = useCallback(async () => {
    setUnbinding(true);
    setErr('');
    setOk('');
    try {
      await unbind(provider);
      setCredential('');
      setEditing(false);
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '解绑失败，请稍后重试');
    } finally {
      setUnbinding(false);
    }
  }, [onChanged, provider, unbind]);

  const state = !info.bound ? 'unbound' : info.valid ? 'bound' : 'invalid';
  const statusText = state === 'bound' ? '已绑定' : state === 'invalid' ? '凭据已失效' : '未绑定';

  return (
    <section className="gt-bindcard" data-game={themeGame(provider)} data-state={state}>
      <header className="gt-bindcard__head">
        <div className="gt-bindcard__name">
          <span className="gt-bindcard__dot" aria-hidden="true" />
          {meta.name}
        </div>
        <span className="gt-bindcard__status" data-state={state}>
          {state === 'bound' ? (
            <CheckCircle2 size={13} />
          ) : state === 'invalid' ? (
            <AlertTriangle size={13} />
          ) : null}
          {statusText}
        </span>
      </header>

      <div className="gt-bindcard__games">
        {meta.games.map((g) => (
          <span key={g} className="gt-bindcard__gchip" data-game={g}>
            {GAME_META[g].short}
          </span>
        ))}
      </div>

      {/* 已绑定：账号信息 */}
      {info.bound && (
        <dl className="gt-bindinfo">
          <div>
            <dt>昵称</dt>
            <dd>{info.nickname || '—'}</dd>
          </div>
          <div>
            <dt>UID</dt>
            <dd className="tabular">{info.uid || '—'}</dd>
          </div>
          <div>
            <dt>等级</dt>
            <dd className="tabular">{info.level != null ? `Lv.${info.level}` : '—'}</dd>
          </div>
          <div>
            <dt>区服</dt>
            <dd>{info.region || '—'}</dd>
          </div>
          <div className="gt-bindinfo__wide">
            <dt>凭据</dt>
            <dd className="gt-bindinfo__mask">{info.masked || '已加密保存'}</dd>
          </div>
          <div className="gt-bindinfo__wide">
            <dt>最后同步</dt>
            <dd>
              {info.lastSyncAt
                ? `${formatDateTime(info.lastSyncAt)} · ${formatAgo(info.lastSyncAt)}`
                : '尚未同步'}
            </dd>
          </div>
        </dl>
      )}

      {/* 失效原因（来自后端的中文文案） */}
      {info.bound && !info.valid && info.error && (
        <div className="gt-bindalert" role="alert">
          <AlertTriangle size={15} className="gt-bindalert__icon" />
          <span>{info.error}</span>
        </div>
      )}

      {/* 本次操作的报错（后端 400 的中文原因） */}
      {err && (
        <div className="gt-bindalert" role="alert">
          <AlertTriangle size={15} className="gt-bindalert__icon" />
          <span>{err}</span>
        </div>
      )}

      {ok && (
        <div className="gt-bindalert gt-bindalert--ok" role="status">
          <CheckCircle2 size={15} className="gt-bindalert__icon" />
          <span>{ok}</span>
        </div>
      )}

      {/* 操作区 */}
      {showForm ? (
        <div className="gt-bindform">
          <label className="gt-bindform__label" htmlFor={`gt-cred-${provider}`}>
            凭据
            <span className="gt-bindform__need">{guide.need}</span>
          </label>
          <textarea
            id={`gt-cred-${provider}`}
            ref={taRef}
            className="gt-bindta"
            value={credential}
            onChange={(e) => {
              setCredential(e.target.value);
              if (err) setErr('');
            }}
            onFocus={handleFocus}
            rows={4}
            spellCheck={false}
            autoComplete="off"
            placeholder={guide.placeholder}
          />
          <div className="gt-bindform__row">
            <button type="button" className="gt-bindbtn" onClick={() => void handlePaste()}>
              <ClipboardPaste size={16} />
              从剪贴板粘贴
            </button>
            <button
              type="button"
              className="gt-bindbtn gt-bindbtn--primary"
              onClick={() => void handleBind()}
              disabled={submitting}
            >
              {submitting ? <Loader2 size={16} className="gt-bindspin" /> : <ShieldCheck size={16} />}
              {submitting ? '校验中…' : info.bound ? '重新绑定' : '绑定'}
            </button>
            {info.bound && (
              <button
                type="button"
                className="gt-bindbtn"
                onClick={() => {
                  setEditing(false);
                  setCredential('');
                  setErr('');
                }}
              >
                取消
              </button>
            )}
          </div>
          {pasteHint && <div className="gt-bindform__hint">{pasteHint}</div>}
          <div className="gt-bindform__hint">
            绑定时会真的去调一次官方接口校验，成功才会保存。
          </div>
        </div>
      ) : (
        <div className="gt-bindform__row">
          <button type="button" className="gt-bindbtn" onClick={() => setEditing(true)}>
            <RefreshCw size={16} />
            重新绑定
          </button>
          <button
            type="button"
            className="gt-bindbtn gt-bindbtn--danger"
            onClick={() => void handleUnbind()}
            disabled={unbinding}
          >
            {unbinding ? <Loader2 size={16} className="gt-bindspin" /> : <Link2Off size={16} />}
            {unbinding ? '解绑中…' : '解绑'}
          </button>
        </div>
      )}

      {/* 图文步骤 */}
      <details className="gt-binddetails">
        <summary>
          怎么拿到{meta.name.split(' · ')[1] ?? meta.name}的凭据？（PC / 手机分开写了）
        </summary>
        <div className="gt-binddetails__body">
          <GuideSteps icon={<Monitor size={14} />} title="PC 浏览器" steps={guide.pc} />
          <GuideSteps icon={<Smartphone size={14} />} title="手机端" steps={guide.mobile} />
          {guide.tip && <p className="gt-bind__tip">{guide.tip}</p>}
          <a
            className="gt-bind__site"
            href={meta.site}
            target="_blank"
            rel="noreferrer noopener"
          >
            打开 {meta.site}
          </a>
        </div>
      </details>
    </section>
  );
}

/* -------------------------------------------------------------------- 主体 */

export function AccountBindingDialog({
  open,
  onClose,
  bindings,
  loading,
  error,
  bind,
  unbind,
  onChanged,
}: AccountBindingDialogProps) {
  // 打开时锁滚动交给 tdesign 的 preventScrollThrough；这里只在关闭时清理内部态
  const [mountKey, setMountKey] = useState(0);
  useEffect(() => {
    if (open) setMountKey((k) => k + 1);
  }, [open]);

  return (
    <Dialog
      visible={open}
      onClose={onClose}
      className="gt-dialog gt-dialog--bind"
      header={false}
      footer={false}
      closeBtn={false}
      placement="center"
      width={620}
      destroyOnClose
      preventScrollThrough
    >
      <div className="gt-dlg gt-bind" key={mountKey}>
        <div className="gt-dlg__glow" aria-hidden="true" />

        <div className="gt-dlg__head gt-bind__head">
          <div className="min-w-0">
            <div className="gt-dlg__title">账号绑定</div>
            <div className="gt-dlg__sub">
              绑定后自动同步每日 / 周常 / 深渊类真实完成度，公告活动仍是手动勾选
            </div>
          </div>
          <button
            type="button"
            className="gt-bind__close"
            onClick={onClose}
            aria-label="关闭"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="gt-dlg__body gt-bind__body">
          {error && (
            <div className="gt-bindalert" role="alert">
              <AlertTriangle size={15} className="gt-bindalert__icon" />
              <span>{error}</span>
            </div>
          )}

          {loading && bindings.every((b) => !b.bound) && (
            <div className="gt-bind__loading">
              <Loader2 size={15} className="gt-bindspin" />
              正在读取绑定状态…
            </div>
          )}

          {bindings.map((b) => (
            <BindingCard
              key={b.provider}
              info={b}
              bind={bind}
              unbind={unbind}
              onChanged={onChanged}
            />
          ))}

          <div className="gt-bindsafe">
            <Lock size={15} className="gt-bindsafe__icon" />
            <div>
              <strong>凭据安全说明</strong>
              <p>
                凭据经 AES-256-GCM 加密后仅存放在本站自己的服务器数据库里，接口永不回传明文，
                页面上只展示掩码。服务端只做只读查询，不会替你签到或改动任何游戏内数据，也不会转发给第三方。
              </p>
              <p>
                但请注意：这类凭据等同于你的账号登录态，<strong>切勿分享给任何人</strong>。
                不想用了随时点「解绑」，记录会立即从数据库删除。
              </p>
            </div>
          </div>
        </div>

        <div className="gt-dlg__foot gt-bind__foot">
          <button type="button" className="gt-btn" style={{ flex: 1 }} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </Dialog>
  );
}
