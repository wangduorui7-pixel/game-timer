import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, Lock, User } from 'lucide-react';
import type { AuthResponse } from '../../shared/types';
// fe-core 提供，契约：
//   apiLogin(username, password)    -> Promise<AuthResponse>
//   apiRegister(username, password) -> Promise<AuthResponse>
import { apiLogin, apiRegister } from '../lib/api';
import { GlassDialog } from './GlassDialog';

export interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (auth: AuthResponse) => void;
}

type Mode = 'login' | 'register';

const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5-]{3,20}$/;

function validateUsername(v: string): string {
  const s = v.trim();
  if (!s) return '请输入用户名';
  if (s.length < 3 || s.length > 20) return '用户名需 3-20 位';
  if (!USERNAME_RE.test(s)) return '仅支持中英文、数字、下划线与连字符';
  return '';
}

function validatePassword(v: string): string {
  if (!v) return '请输入密码';
  if (v.length < 6) return '密码至少 6 位';
  return '';
}

export function AuthDialog({ open, onClose, onSuccess }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // 每次打开重置表单
  useEffect(() => {
    if (open) {
      setUsername('');
      setPassword('');
      setConfirm('');
      setTouched({});
      setServerError('');
      setSubmitting(false);
    }
  }, [open]);

  const errUsername = validateUsername(username);
  const errPassword = validatePassword(password);
  const errConfirm = mode === 'register' && confirm !== password ? '两次输入的密码不一致' : '';
  const invalid = !!errUsername || !!errPassword || !!errConfirm;

  const show = (field: string, err: string) => (touched[field] && err ? err : '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, password: true, confirm: true });
    setServerError('');
    if (invalid || submitting) return;

    setSubmitting(true);
    try {
      const fn = mode === 'login' ? apiLogin : apiRegister;
      const auth = await fn(username.trim(), password);
      onSuccess(auth);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg || (mode === 'login' ? '登录失败，请重试' : '注册失败，请重试'));
    } finally {
      setSubmitting(false);
    }
  };

  const seg = (
    <div className="gt-seg" role="tablist" aria-label="登录或注册">
      <span className="gt-seg__ind" data-i={mode === 'register' ? '1' : '0'} aria-hidden="true" />
      <button
        type="button"
        role="tab"
        className="gt-seg__btn"
        aria-selected={mode === 'login'}
        onClick={() => {
          setMode('login');
          setServerError('');
        }}
      >
        登录
      </button>
      <button
        type="button"
        role="tab"
        className="gt-seg__btn"
        aria-selected={mode === 'register'}
        onClick={() => {
          setMode('register');
          setServerError('');
        }}
      >
        注册
      </button>
    </div>
  );

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={mode === 'login' ? '欢迎回来' : '创建账号'}
      subtitle="登录后完成状态多端同步；不登录也能正常使用全部倒计时"
      headExtra={seg}
      footer={
        <>
          <button type="button" className="gt-btn" style={{ flex: 1 }} onClick={onClose}>
            稍后再说
          </button>
          <button
            type="submit"
            form="gt-auth-form"
            className="gt-btn gt-btn--primary"
            style={{ flex: 2 }}
            disabled={submitting}
          >
            {submitting && <span className="gt-spinner" />}
            {mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </>
      }
    >
      <form id="gt-auth-form" onSubmit={handleSubmit} noValidate className="contents">
        {serverError && (
          <div className="gt-alert" role="alert">
            <AlertCircle size={15} style={{ flex: 'none', marginTop: 1 }} />
            <span>{serverError}</span>
          </div>
        )}

        <div className="gt-field">
          <label className="gt-field__label" htmlFor="gt-auth-user">
            <User size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            用户名<span className="gt-field__req">*</span>
          </label>
          <input
            id="gt-auth-user"
            className="gt-input"
            value={username}
            autoComplete="username"
            placeholder="3-20 位，中英文 / 数字 / _ -"
            aria-invalid={!!show('username', errUsername)}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, username: true }))}
          />
          {show('username', errUsername) && (
            <span className="gt-field__err">{show('username', errUsername)}</span>
          )}
        </div>

        <div className="gt-field">
          <label className="gt-field__label" htmlFor="gt-auth-pwd">
            <Lock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            密码<span className="gt-field__req">*</span>
          </label>
          <input
            id="gt-auth-pwd"
            className="gt-input"
            type="password"
            value={password}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="至少 6 位"
            aria-invalid={!!show('password', errPassword)}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          />
          {show('password', errPassword) && (
            <span className="gt-field__err">{show('password', errPassword)}</span>
          )}
        </div>

        {mode === 'register' && (
          <div className="gt-field">
            <label className="gt-field__label" htmlFor="gt-auth-pwd2">
              确认密码<span className="gt-field__req">*</span>
            </label>
            <input
              id="gt-auth-pwd2"
              className="gt-input"
              type="password"
              value={confirm}
              autoComplete="new-password"
              placeholder="再输入一次"
              aria-invalid={!!show('confirm', errConfirm)}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
            />
            {show('confirm', errConfirm) && (
              <span className="gt-field__err">{show('confirm', errConfirm)}</span>
            )}
          </div>
        )}
      </form>
    </GlassDialog>
  );
}
