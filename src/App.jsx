import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase, API_BASE } from './supabase.js';

/* ============================================================
   УТИЛИТЫ
   ============================================================ */
const GAMES = [
  { id: 'crash', title: 'Crash', tag: 'Rocket', desc: 'Ускорение, коэффициент и звёздный след. Наблюдайте за ростом множителя и заберите выплату до краша.', accent: '#8b5cf6' },
  { id: 'mines', title: 'Mines', tag: 'Grid', desc: 'Открывайте безопасные клетки, избегайте мин и фиксируйте результат.', accent: '#22d3ee' },
];

const ACCENTS = ['#8b5cf6', '#22d3ee', '#38bdf8', '#a78bfa', '#f472b6'];

function cn(...args) {
  return args.filter(Boolean).join(' ');
}

function formatBalance(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('ru-RU');
}

function generateIdempotencyKey() {
  return `djg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ============================================================
   SVG ИКОНКИ (inline, без внешних библиотек)
   ============================================================ */
const Icon = {
  Logo: () => (
    <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path d="M8 6h10c8 0 14 6 14 14s-6 14-14 14H8V6Z" stroke="url(#lg)" strokeWidth="3" />
      <path d="M16 12v16h3c5 0 8-3 8-8s-3-8-8-8h-3Z" fill="url(#lg)" opacity="0.6" />
    </svg>
  ),
  Home: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  Games: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="12" rx="4" /><path d="M8 11v4M6 13h4M15 12h.01M18 15h.01" />
    </svg>
  ),
  Activity: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  ),
  Star: ({ filled }) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9L12 3Z" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" />
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  Logout: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Rocket: () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2" />
      <path d="M12 15 9 12l7-7c1.5-1.5 4-1.5 4-1.5s0 2.5-1.5 4l-7 7Z" />
      <path d="m9 12-4 1-1-1 1-4 2-2 5 5-3 1Z" /><circle cx="15" cy="9" r="1" />
    </svg>
  ),
  Grid: () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
};

/* ============================================================
   БАЗОВЫЕ КОМПОНЕНТЫ
   ============================================================ */
function Spinner({ label }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label && <span className="muted small">{label}</span>}
    </div>
  );
}

function EmptyState({ title, text, icon }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <Icon.Star filled={false} />}</div>
      <h4>{title}</h4>
      <p className="muted">{text}</p>
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className={cn('toast', toast.type === 'error' && 'toast-error', toast.type === 'success' && 'toast-success')}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
        >
          <span>{toast.message}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Icon.Close />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   ЭКРАН АВТОРИЗАЦИИ
   ============================================================ */
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname || email.split('@')[0] } },
        });
        if (signUpError) throw signUpError;
        onAuth?.('Регистрация успешна. Проверьте почту, если требуется подтверждение.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />
      <motion.div className="auth-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="brand brand-lg">
          <Icon.Logo />
          <div>
            <strong>D.J.G.</strong>
            <span>Premium Game Arena</span>
          </div>
        </div>
        <h2>{mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}</h2>
        <p className="muted">
          {mode === 'login' ? 'Войдите, чтобы продолжить.' : 'Зарегистрируйтесь, чтобы начать.'}
        </p>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label className="field">
              <span>Никнейм</span>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Neo" autoComplete="nickname" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <button className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
        </button>
      </motion.div>
    </div>
  );
}

/* ============================================================
   МОДАЛЬНОЕ ОКНО
   ============================================================ */
function Modal({ open, onClose, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            className={cn('modal', wide && 'modal-wide')}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close icon-btn" onClick={onClose} aria-label="Закрыть">
              <Icon.Close />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================
   ИГРА CRASH (клиентская визуализация + серверный результат)
   ============================================================ */
function CrashGame({ onFinish, notify }) {
  const [phase, setPhase] = useState('idle'); // idle | running | crashed
  const [multiplier, setMultiplier] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  const [cashed, setCashed] = useState(false);
  const [history, setHistory] = useState([]);
  const rafRef = useRef(null);
  const crashPointRef = useRef(null);
  const startRef = useRef(null);

  const start = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Сессия не найдена');
      const res = await fetch(`${API_BASE}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ gameType: 'crash' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось начать раунд');

      setSessionId(data.sessionId);
      // Сервер вернул состояние, но crashPoint не должен использоваться для принятия решения на клиенте.
      // Клиент только визуализирует рост и завершает раунд при cashout.
      crashPointRef.current = data.state.crashPoint;
      setPhase('running');
      setMultiplier(1);
      setCashed(false);
      startRef.current = performance.now();

      const tick = (now) => {
        const elapsed = (now - startRef.current) / 1000;
        const m = 1 + Math.pow(elapsed, 1.4) * 0.35;
        // Визуальный рост продолжается, но сервер уже зафиксировал crashPoint.
        // Клиент не может «выиграть» после краша, потому что cashout проверяется на сервере.
        setMultiplier(Number(m.toFixed(2)));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const cashout = async () => {
    if (phase !== 'running' || cashed) return;
    setCashed(true);
    cancelAnimationFrame(rafRef.current);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/game/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, multiplier }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ошибка кэшаута');
      setPhase('crashed');
      setHistory((h) => [{ id: sessionId, multiplier: result.multiplier ?? multiplier, won: result.won }, ...h].slice(0, 5));
      onFinish?.();
      notify(result.won ? `Кэшаут на ×${result.multiplier}` : `Краш на ×${result.crashPoint}`, result.won ? 'success' : 'error');
    } catch (err) {
      notify(err.message, 'error');
      setCashed(false);
    }
  };

  const reset = () => {
    cancelAnimationFrame(rafRef.current);
    setPhase('idle');
    setMultiplier(1);
    setSessionId(null);
    setCashed(false);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="game crash-game">
      <div className="crash-visual">
        <div className="stars" />
        <motion.div
          className="rocket"
          animate={{ y: phase === 'running' ? [-10, 10, -10] : 0, rotate: phase === 'crashed' ? 45 : -45 }}
          transition={{ repeat: phase === 'running' ? Infinity : 0, duration: 1.6 }}
        >
          <Icon.Rocket />
        </motion.div>
        <div className={cn('multiplier', phase === 'crashed' && 'multiplier-dead')}>×{multiplier.toFixed(2)}</div>
        <div className="crash-trail" />
      </div>

      <div className="game-controls">
        {phase === 'idle' && (
          <button className="btn btn-primary" onClick={start}>Запустить раунд</button>
        )}
        {phase === 'running' && (
          <button className="btn btn-success" onClick={cashout} disabled={cashed}>
            {cashed ? 'Обработка…' : `Забрать ×${multiplier.toFixed(2)}`}
          </button>
        )}
        {phase === 'crashed' && (
          <button className="btn" onClick={reset}>Новый раунд</button>
        )}
      </div>

      {history.length > 0 && (
        <div className="mini-history">
          <span className="muted small">История раундов</span>
          <div className="chips">
            {history.map((h) => (
              <span key={h.id} className={cn('chip', h.won ? 'chip-win' : 'chip-lose')}>
                ×{Number(h.multiplier).toFixed(2)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ИГРА MINES
   ============================================================ */
function MinesGame({ onFinish, notify }) {
  const [size, setSize] = useState(5);
  const [mineCount, setMineCount] = useState(3);
  const [sessionId, setSessionId] = useState(null);
  const [revealed, setRevealed] = useState([]);
  const [mines, setMines] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | active | lost | won
  const [multiplier, setMultiplier] = useState(1);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ gameType: 'mines', config: { size, mines: mineCount } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось начать игру');
      setSessionId(data.sessionId);
      setRevealed([]);
      setMines([]);
      setMultiplier(1);
      setStatus('active');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const reveal = async (index) => {
    if (status !== 'active' || revealed.includes(index)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/game/mines/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, cellIndex: index }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка хода');
      setRevealed(data.revealed);
      if (data.hitMine) {
        setMines(data.mines);
        setStatus('lost');
        onFinish?.();
        notify('Вы наступили на мину', 'error');
      } else {
        setMultiplier(data.multiplier);
      }
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const cashout = async () => {
    if (status !== 'active' || !sessionId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/game/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, multiplier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка кэшаута');
      setStatus('won');
      onFinish?.();
      notify(`Результат зафиксирован на ×${data.multiplier}`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const reset = () => {
    setSessionId(null);
    setRevealed([]);
    setMines([]);
    setStatus('idle');
    setMultiplier(1);
  };

  const cells = Array.from({ length: size * size });

  return (
    <div className="game mines-game">
      <div className="mines-header">
        <div className="field-row">
          <label className="field field-inline">
            <span>Поле</span>
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} disabled={status === 'active'}>
              {[3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}×{s}</option>)}
            </select>
          </label>
          <label className="field field-inline">
            <span>Мин</span>
            <select value={mineCount} onChange={(e) => setMineCount(Number(e.target.value))} disabled={status === 'active'}>
              {Array.from({ length: Math.min(size * size - 1, 10) }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mines-multiplier">×{multiplier.toFixed(2)}</div>
      </div>

      <div className="mines-grid" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {cells.map((_, i) => {
          const isRevealed = revealed.includes(i);
          const isMine = status === 'lost' && mines.includes(i);
          const isSafeRevealed = isRevealed && !isMine;
          return (
            <button
              key={i}
              className={cn('mine-cell', isSafeRevealed && 'mine-cell-safe', isMine && 'mine-cell-mine', !isRevealed && status === 'active' && 'mine-cell-active')}
              onClick={() => reveal(i)}
              disabled={status !== 'active' || isRevealed}
            >
              {isMine ? '💥' : isSafeRevealed ? '💎' : ''}
            </button>
          );
        })}
      </div>

      <div className="game-controls">
        {status === 'idle' && <button className="btn btn-primary" onClick={start} disabled={loading}>{loading ? 'Создание…' : 'Начать игру'}</button>}
        {status === 'active' && <button className="btn btn-success" onClick={cashout}>Забрать ×{multiplier.toFixed(2)}</button>}
        {(status === 'lost' || status === 'won') && <button className="btn" onClick={reset}>Новая игра</button>}
      </div>
    </div>
  );
}

/* ============================================================
   НАСТРОЙКИ
   ============================================================ */
function SettingsPage({ profile, preferences, onSave, notify }) {
  const [form, setForm] = useState(() => ({
    background_url: preferences?.background_url || '',
    overlay_opacity: preferences?.overlay_opacity ?? 0.65,
    accent_color: preferences?.accent_color || '#8b5cf6',
    particles_enabled: preferences?.particles_enabled ?? true,
    animations_intensity: preferences?.animations_intensity || 'normal',
    sounds_enabled: preferences?.sounds_enabled ?? false,
    card_density: preferences?.card_density || 'comfortable',
  }));
  const [uploading, setUploading] = useState(false);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const uploadBackground = async (file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      notify('Разрешены только JPEG, PNG и WebP', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Максимальный размер файла — 5 MB', 'error');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/bg-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('backgrounds').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('backgrounds').getPublicUrl(path);
      update('background_url', pub.publicUrl);
      notify('Фон загружен', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    try {
      const { error } = await supabase.from('user_preferences').update(form).eq('user_id', profile.id);
      if (error) throw error;
      await onSave(form);
      notify('Настройки сохранены', 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Настройки</h1>
        <p className="muted">Персонализируйте D.J.G. под себя.</p>
      </div>

      <div className="settings-grid">
        <section className="card settings-section">
          <h3>Фон</h3>
          <div className="field">
            <span>Загрузить изображение</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadBackground(e.target.files?.[0])} />
            {uploading && <span className="muted small">Загрузка…</span>}
          </div>
          <label className="field">
            <span>Затемнение: {Math.round(form.overlay_opacity * 100)}%</span>
            <input type="range" min="0" max="1" step="0.05" value={form.overlay_opacity} onChange={(e) => update('overlay_opacity', Number(e.target.value))} />
          </label>
          {form.background_url && (
            <button className="link-btn" onClick={() => update('background_url', '')}>Убрать фон</button>
          )}
        </section>

        <section className="card settings-section">
          <h3>Акцент</h3>
          <div className="accent-row">
            {ACCENTS.map((c) => (
              <button
                key={c}
                className={cn('accent-dot', form.accent_color === c && 'accent-dot-active')}
                style={{ background: c }}
                onClick={() => update('accent_color', c)}
                aria-label={`Акцент ${c}`}
              />
            ))}
          </div>
          <label className="field">
            <span>Плотность карточек</span>
            <select value={form.card_density} onChange={(e) => update('card_density', e.target.value)}>
              <option value="compact">Компактная</option>
              <option value="comfortable">Комфортная</option>
              <option value="spacious">Просторная</option>
            </select>
          </label>
        </section>

        <section className="card settings-section">
          <h3>Эффекты</h3>
          <label className="toggle-row">
            <span>Частицы</span>
            <input type="checkbox" checked={form.particles_enabled} onChange={(e) => update('particles_enabled', e.target.checked)} />
          </label>
          <label className="toggle-row">
            <span>Звуки</span>
            <input type="checkbox" checked={form.sounds_enabled} onChange={(e) => update('sounds_enabled', e.target.checked)} />
          </label>
          <label className="field">
            <span>Интенсивность анимаций</span>
            <select value={form.animations_intensity} onChange={(e) => update('animations_intensity', e.target.value)}>
              <option value="low">Низкая</option>
              <option value="normal">Нормальная</option>
              <option value="high">Высокая</option>
            </select>
          </label>
        </section>
      </div>

      <div className="page-actions">
        <button className="btn btn-primary" onClick={save}>Сохранить настройки</button>
      </div>
    </div>
  );
}

/* ============================================================
   АДМИН-ПАНЕЛЬ
   ============================================================ */
function AdminPage({ profile, notify }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [balanceForm, setBalanceForm] = useState({ operationType: 'add', amount: 100, reason: '' });
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState([]);

  const loadStats = useCallback(async () => {
    const [{ count: userCount }, { count: sessionCount }, { count: resultCount }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('game_sessions').select('*', { count: 'exact', head: true }),
      supabase.from('game_results').select('*', { count: 'exact', head: true }),
    ]);
    const { data: balances } = await supabase.from('user_balances').select('balance');
    const totalBalance = (balances || []).reduce((sum, b) => sum + Number(b.balance || 0), 0);
    setStats({ userCount, sessionCount, resultCount, totalBalance });
  }, []);

  const loadAudit = useCallback(async () => {
    const { data } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(8);
    setAudit(data || []);
  }, []);

  const loadUsers = useCallback(async (q) => {
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(30);
    if (q) query = query.or(`nickname.ilike.%${q}%,telegram_id.eq.${Number(q) || 0},status.eq.${q}`);
    const { data } = await query;
    setUsers(data || []);
  }, []);

  useEffect(() => {
    loadStats();
    loadAudit();
    loadUsers('');
  }, [loadStats, loadAudit, loadUsers]);

  const changeBalance = async () => {
    if (!selected) return;
    if (!balanceForm.reason.trim()) {
      notify('Укажите причину изменения баланса', 'error');
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE}/api/admin/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          userId: selected.id,
          operationType: balanceForm.operationType,
          amount: balanceForm.operationType === 'reset' ? 0 : Number(balanceForm.amount),
          reason: balanceForm.reason.trim(),
          idempotencyKey: generateIdempotencyKey(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка изменения баланса');
      notify(data.result?.skipped ? 'Операция уже была применена' : 'Баланс обновлён', 'success');
      setSelected(null);
      await Promise.all([loadUsers(search), loadAudit()]);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async (user) => {
    setBusy(true);
    try {
      const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
      if (error) throw error;
      notify(`Пользователь ${newStatus === 'blocked' ? 'заблокирован' : 'разблокирован'}`, 'success');
      await loadUsers(search);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (profile.role !== 'admin') {
    return <div className="page"><EmptyState title="Доступ запрещён" text="Раздел доступен только администраторам." /></div>;
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Админ-панель</h1>
        <p className="muted">Управление пользователями и балансами.</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="card stat-card"><span className="muted">Пользователи</span><strong>{stats.userCount ?? '—'}</strong></div>
          <div className="card stat-card"><span className="muted">Игровые сессии</span><strong>{stats.sessionCount ?? '—'}</strong></div>
          <div className="card stat-card"><span className="muted">Результаты</span><strong>{stats.resultCount ?? '—'}</strong></div>
          <div className="card stat-card"><span className="muted">Суммарный баланс</span><strong>{formatBalance(stats.totalBalance)}</strong></div>
        </div>
      )}

      <div className="card">
        <div className="admin-toolbar">
          <input className="input" placeholder="Поиск: никнейм, Telegram ID или статус" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" onClick={() => loadUsers(search)}>Найти</button>
        </div>
        <div className="admin-list">
          {users.length === 0 && <p className="muted">Пользователи не найдены.</p>}
          {users.map((u) => (
            <div key={u.id} className="admin-row">
              <div>
                <strong>{u.nickname}</strong>
                <div className="muted small">Telegram ID: {u.telegram_id || '—'} · {u.status} · {u.role}</div>
              </div>
              <div className="admin-actions">
                <button className="btn btn-sm" onClick={() => setSelected(u)}>Баланс</button>
                <button className="btn btn-sm btn-danger" onClick={() => toggleBlock(u)} disabled={busy}>
                  {u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Последние действия администраторов</h3>
        {audit.length === 0 ? <p className="muted">Пока нет записей.</p> : audit.map((a) => (
          <div key={a.id} className="audit-row">
            <span className="chip">{a.action}</span>
            <span className="muted small">{new Date(a.created_at).toLocaleString('ru-RU')}</span>
            <code className="small">{JSON.stringify(a.payload)}</code>
          </div>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="admin-balance-form">
            <h3>Изменить баланс: {selected.nickname}</h3>
            <div className="field-row">
              <label className="field">
                <span>Операция</span>
                <select value={balanceForm.operationType} onChange={(e) => setBalanceForm((f) => ({ ...f, operationType: e.target.value }))}>
                  <option value="add">Добавить</option>
                  <option value="subtract">Списать</option>
                  <option value="set">Установить</option>
                  <option value="reset">Обнулить</option>
                </select>
              </label>
              {balanceForm.operationType !== 'reset' && (
                <label className="field">
                  <span>Сумма</span>
                  <input type="number" min="0" value={balanceForm.amount} onChange={(e) => setBalanceForm((f) => ({ ...f, amount: e.target.value }))} />
                </label>
              )}
            </div>
            <label className="field">
              <span>Причина (обязательно)</span>
              <textarea rows={3} value={balanceForm.reason} onChange={(e) => setBalanceForm((f) => ({ ...f, reason: e.target.value }))} />
            </label>
            <div className="modal-actions">
              <button className="btn" onClick={() => setSelected(null)}>Отмена</button>
              <button className="btn btn-primary" onClick={changeBalance} disabled={busy}>{busy ? 'Сохранение…' : 'Подтвердить'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   ГЛАВНОЕ ПРИЛОЖЕНИЕ
   ============================================================ */
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('home');
  const [activeGame, setActiveGame] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'info') => setToast({ message, type }), []);

  // --- Auth state ---
  useEffect(() => {
    let alive = true;

    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(s);
      if (s?.user) await loadUserData(s.user.id);
      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) loadUserData(s.user.id);
      else {
        setProfile(null);
        setPreferences(null);
        setBalance(null);
        setFavorites([]);
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async (userId) => {
    const [{ data: p }, { data: pref }, { data: b }, { data: fav }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_balances').select('balance').eq('user_id', userId).maybeSingle(),
      supabase.from('favorites').select('game_id').eq('user_id', userId),
    ]);
    setProfile(p || null);
    setPreferences(pref || null);
    setBalance(b?.balance ?? 0);
    setFavorites((fav || []).map((f) => f.game_id));
  };

  const refreshBalance = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('user_balances').select('balance').eq('user_id', profile.id).maybeSingle();
    setBalance(data?.balance ?? 0);
  }, [profile?.id]);

  const toggleFavorite = async (gameId) => {
    if (!profile) return;
    const isFav = favorites.includes(gameId);
    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id', profile.id).eq('game_id', gameId);
      setFavorites((f) => f.filter((x) => x !== gameId));
    } else {
      await supabase.from('favorites').insert({ user_id: profile.id, game_id: gameId });
      setFavorites((f) => [...f, gameId]);
    }
  };

  const accent = preferences?.accent_color || '#8b5cf6';
  const overlay = preferences?.overlay_opacity ?? 0.65;

  // --- Style variables ---
  const appStyle = useMemo(
    () => ({
      '--accent': accent,
      '--bg-image': preferences?.background_url ? `url(${preferences.background_url})` : 'none',
      '--overlay': overlay,
    }),
    [accent, preferences?.background_url, overlay]
  );

  if (loading) {
    return (
      <div className="boot-screen" style={appStyle}>
        <Spinner label="Загрузка D.J.G." />
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <AuthScreen onAuth={(msg) => notify(msg, 'success')} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  const isAdmin = profile?.role === 'admin';

  const NavItem = ({ id, label, icon }) => (
    <button className={cn('nav-item', tab === id && 'nav-item-active')} onClick={() => setTab(id)}>
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="app" style={appStyle}>
      {preferences?.particles_enabled && <div className="particles" aria-hidden />}
      <div className="app-overlay" />

      <header className="topbar">
        <div className="brand" onClick={() => setTab('home')}>
          <Icon.Logo />
          <div>
            <strong>D.J.G.</strong>
            <span>Premium Game Arena</span>
          </div>
        </div>

        <nav className="nav">
          <NavItem id="home" label="Главная" icon={<Icon.Home />} />
          <NavItem id="games" label="Игры" icon={<Icon.Games />} />
          <NavItem id="activity" label="Активность" icon={<Icon.Activity />} />
          <NavItem id="favorites" label="Избранное" icon={<Icon.Star filled={false} />} />
          {isAdmin && <NavItem id="admin" label="Админ" icon={<Icon.Settings />} />}
        </nav>

        <div className="topbar-right">
          <div className="balance-pill">
            <span className="muted small">Баланс</span>
            <strong>{formatBalance(balance)}</strong>
          </div>
          <button className="icon-btn" onClick={() => setTab('notifications')} aria-label="Уведомления">
            <Icon.Bell />
          </button>
          <button className="icon-btn" onClick={() => setTab('settings')} aria-label="Настройки">
            <Icon.Settings />
          </button>
          <div className="avatar" title={profile?.nickname}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : (profile?.nickname?.[0] || 'U').toUpperCase()}
          </div>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} aria-label="Выйти">
            <Icon.Logout />
          </button>
        </div>
      </header>

      <main className="main">
        {tab === 'home' && (
          <div className="page">
            <section className="hero card">
              <div>
                <span className="hero-kicker">D.J.G. ORIGINALS</span>
                <h1>Играйте в премиальной <em>тёмной</em> арене.</h1>
                <p className="muted">
                  Crash и Mines с серверной фиксацией результатов. Настройте фон, акцент и плотность интерфейса.
                  Виртуальный баланс изменяется только администратором.
                </p>
                <div className="hero-actions">
                  <button className="btn btn-primary" onClick={() => setTab('games')}>Открыть игры</button>
                  <button className="btn" onClick={() => setTab('settings')}>Настроить вид</button>
                </div>
              </div>
              <div className="hero-orbit">
                <div className="orbit-ring" />
                <div className="orbit-core">D.J.G.</div>
              </div>
            </section>

            <section>
              <div className="section-head"><h2>Популярные игры</h2></div>
              <div className="game-grid">
                {GAMES.map((g) => (
                  <GameCard key={g.id} game={g} onPlay={() => setActiveGame(g.id)} isFav={favorites.includes(g.id)} onFav={() => toggleFavorite(g.id)} />
                ))}
              </div>
            </section>

            {favorites.length > 0 && (
              <section>
                <div className="section-head"><h2>Избранное</h2></div>
                <div className="game-grid">
                  {GAMES.filter((g) => favorites.includes(g.id)).map((g) => (
                    <GameCard key={g.id} game={g} onPlay={() => setActiveGame(g.id)} isFav onFav={() => toggleFavorite(g.id)} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="section-head"><h2>Ваша статистика</h2></div>
              <div className="stats-grid">
                <div className="card stat-card"><span className="muted">Баланс</span><strong>{formatBalance(balance)}</strong></div>
                <div className="card stat-card"><span className="muted">Статус</span><strong>{profile?.status === 'active' ? 'Активен' : 'Заблокирован'}</strong></div>
                <div className="card stat-card"><span className="muted">Роль</span><strong>{profile?.role || 'user'}</strong></div>
              </div>
            </section>
          </div>
        )}

        {tab === 'games' && (
          <div className="page">
            <div className="page-head"><h1>Игры</h1><p className="muted">Все доступные режимы D.J.G.</p></div>
            <div className="game-grid">
              {GAMES.map((g) => (
                <GameCard key={g.id} game={g} onPlay={() => setActiveGame(g.id)} isFav={favorites.includes(g.id)} onFav={() => toggleFavorite(g.id)} />
              ))}
            </div>
          </div>
        )}

        {tab === 'activity' && <ActivityPage profile={profile} />}
        {tab === 'favorites' && (
          <div className="page">
            <div className="page-head"><h1>Избранное</h1><p className="muted">Ваши отмеченные игры.</p></div>
            {favorites.length === 0 ? (
              <EmptyState title="Пока пусто" text="Добавьте игру в избранное на главной или на странице игр." />
            ) : (
              <div className="game-grid">
                {GAMES.filter((g) => favorites.includes(g.id)).map((g) => (
                  <GameCard key={g.id} game={g} onPlay={() => setActiveGame(g.id)} isFav onFav={() => toggleFavorite(g.id)} />
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'notifications' && <NotificationsPage profile={profile} />}
        {tab === 'settings' && profile && <SettingsPage profile={profile} preferences={preferences} onSave={setPreferences} notify={notify} />}
        {tab === 'admin' && profile && <AdminPage profile={profile} notify={notify} />}
      </main>

      <Modal open={!!activeGame} onClose={() => setActiveGame(null)} wide>
        {activeGame === 'crash' && <CrashGame onFinish={refreshBalance} notify={notify} />}
        {activeGame === 'mines' && <MinesGame onFinish={refreshBalance} notify={notify} />}
      </Modal>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ============================================================
   ВСПОМОГАТЕЛЬНЫЕ СТРАНИЦЫ
   ============================================================ */
function GameCard({ game, onPlay, isFav, onFav }) {
  return (
    <article className={cn('card game-card', `game-card-${game.id}`)} style={{ '--game-accent': game.accent }}>
      <div className="game-card-top">
        <div className="game-icon">{game.id === 'crash' ? <Icon.Rocket /> : <Icon.Grid />}</div>
        <button className={cn('icon-btn fav-btn', isFav && 'fav-btn-active')} onClick={onFav} aria-label="В избранное">
          <Icon.Star filled={isFav} />
        </button>
      </div>
      <span className="game-tag">{game.tag}</span>
      <h3>{game.title}</h3>
      <p className="muted small">{game.desc}</p>
      <button className="btn btn-primary btn-block" onClick={onPlay}>Играть</button>
    </article>
  );
}

function ActivityPage({ profile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: sessions }, { data: results }] = await Promise.all([
        supabase.from('game_sessions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(15),
        supabase.from('game_results').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(15),
      ]);
      setRows([...(sessions || []), ...(results || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="page">
      <div className="page-head"><h1>Активность</h1><p className="muted">Ваши игровые сессии и результаты.</p></div>
      {loading ? <Spinner label="Загрузка активности" /> : rows.length === 0 ? (
        <EmptyState title="Нет активности" text="Сыграйте первый раунд, чтобы увидеть историю." />
      ) : (
        <div className="card activity-list">
          {rows.map((r) => (
            <div key={`${r.id}-${r.created_at}`} className="activity-row">
              <span className="chip">{r.game_type || r.result?.game_type || 'game'}</span>
              <span className="muted small">{new Date(r.created_at).toLocaleString('ru-RU')}</span>
              <code className="small">{JSON.stringify(r.result || { status: r.status })}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationsPage({ profile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(30);
      setItems(data || []);
      setLoading(false);
    })();
  }, [profile]);

  const markRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="page">
      <div className="page-head"><h1>Уведомления</h1><p className="muted">Системные сообщения и события.</p></div>
      {loading ? <Spinner label="Загрузка уведомлений" /> : items.length === 0 ? (
        <EmptyState title="Уведомлений нет" text="Здесь появятся важные события." />
      ) : (
        <div className="card notifications-list">
          {items.map((n) => (
            <div key={n.id} className={cn('notification-row', !n.read && 'notification-unread')} onClick={() => markRead(n.id)}>
              <div>
                <strong>{n.title}</strong>
                <p className="muted small">{n.body}</p>
                <span className="muted small">{new Date(n.created_at).toLocaleString('ru-RU')}</span>
              </div>
              {!n.read && <span className="dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
