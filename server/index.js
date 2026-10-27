import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = process.env.PORT || 10000;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[D.J.G. Server] Не заданы SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Аутентификация запроса: извлекает JWT из заголовка Authorization,
 * проверяет его через Supabase Auth и возвращает пользователя.
 * Никогда не доверяем userId или role из тела запроса.
 */
async function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new Error('UNAUTHORIZED');

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error('UNAUTHORIZED');

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, status')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) throw new Error('PROFILE_NOT_FOUND');
  if (profile.status === 'blocked') throw new Error('ACCOUNT_BLOCKED');

  return { user: data.user, profile };
}

// Middleware: только администратор
async function requireAdmin(req, res, next) {
  try {
    const { profile } = await authenticate(req);
    if (profile.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    req.adminProfile = profile;
    next();
  } catch (err) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : 403;
    res.status(status).json({ error: err.message });
  }
}

// ------------------------------------------------------------
// АДМИН: изменение баланса
// ------------------------------------------------------------
app.post('/api/admin/balance', requireAdmin, async (req, res) => {
  try {
    const { userId, operationType, amount, reason, idempotencyKey } = req.body;

    if (!userId || !operationType || !reason || !idempotencyKey) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }
    if (!['add', 'subtract', 'set', 'reset'].includes(operationType)) {
      return res.status(400).json({ error: 'INVALID_OPERATION' });
    }
    const numAmount = Number(amount);
    if (operationType !== 'reset' && (!Number.isFinite(numAmount) || numAmount < 0)) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    const { data, error } = await supabaseAdmin.rpc('apply_balance_change', {
      p_admin_id: req.adminProfile.id,
      p_user_id: userId,
      p_operation_type: operationType,
      p_amount: operationType === 'reset' ? 0 : Math.floor(numAmount),
      p_reason: reason,
      p_idempotency_key: idempotencyKey,
    });

    if (error) throw error;
    res.json({ ok: true, result: data });
  } catch (err) {
    console.error('[admin/balance]', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ------------------------------------------------------------
// ИГРЫ: серверная логика
// ------------------------------------------------------------
app.post('/api/game/start', async (req, res) => {
  try {
    const { user } = await authenticate(req);
    const { gameType, config } = req.body;

    if (!['crash', 'mines'].includes(gameType)) {
      return res.status(400).json({ error: 'INVALID_GAME' });
    }

    let state;
    if (gameType === 'crash') {
      // Сервер генерирует точку краша. Клиент не знает её до завершения раунда.
      const crashPoint = Math.max(1.01, 1 + Math.random() * 9);
      state = { crashPoint, startedAt: Date.now() };
    } else if (gameType === 'mines') {
      const size = Math.min(Math.max(Number(config?.size) || 5, 3), 8);
      const mineCount = Math.min(Math.max(Number(config?.mines) || 3, 1), size * size - 1);
      const total = size * size;
      const mineSet = new Set();
      while (mineSet.size < mineCount) {
        mineSet.add(Math.floor(Math.random() * total));
      }
      state = { size, mineCount, mines: Array.from(mineSet), revealed: [] };
    }

    const { data: session, error } = await supabaseAdmin
      .from('game_sessions')
      .insert({
        user_id: user.id,
        game_type: gameType,
        state,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ sessionId: session.id, state });
  } catch (err) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.post('/api/game/cashout', async (req, res) => {
  try {
    const { user } = await authenticate(req);
    const { sessionId, multiplier } = req.body;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    }

    // Проверяем множитель: он не может превышать crashPoint (для crash)
    let result;
    if (session.game_type === 'crash') {
      const crashPoint = Number(session.state?.crashPoint);
      const safeMultiplier = Math.min(Number(multiplier) || 1, crashPoint);
      if (Number(multiplier) > crashPoint) {
        result = { won: false, crashPoint, multiplier: crashPoint, reason: 'crashed' };
      } else {
        result = { won: true, crashPoint, multiplier: safeMultiplier };
      }
    } else {
      result = { won: true, multiplier: Number(multiplier) || 1 };
    }

    const { error: updateError } = await supabaseAdmin
      .from('game_sessions')
      .update({ status: result.won ? 'won' : 'lost', closed_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    await supabaseAdmin.from('game_results').insert({
      session_id: sessionId,
      user_id: user.id,
      game_type: session.game_type,
      result,
    });

    res.json(result);
  } catch (err) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.post('/api/game/mines/reveal', async (req, res) => {
  try {
    const { user } = await authenticate(req);
    const { sessionId, cellIndex } = req.body;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    }

    const state = session.state;
    const mines = new Set(state.mines);
    const revealed = new Set(state.revealed);

    if (revealed.has(cellIndex)) {
      return res.status(400).json({ error: 'ALREADY_REVEALED' });
    }

    let hitMine = false;
    if (mines.has(cellIndex)) {
      hitMine = true;
      revealed.add(cellIndex);

      await supabaseAdmin
        .from('game_sessions')
        .update({ status: 'lost', state: { ...state, revealed: Array.from(revealed) }, closed_at: new Date().toISOString() })
        .eq('id', sessionId);

      await supabaseAdmin.from('game_results').insert({
        session_id: sessionId,
        user_id: user.id,
        game_type: 'mines',
        result: { won: false, hitMine: true, cellIndex },
      });

      return res.json({ hitMine: true, mines: state.mines, revealed: Array.from(revealed) });
    }

    revealed.add(cellIndex);
    const safeRevealed = revealed.size;
    const totalSafe = state.size * state.size - state.mineCount;
    const multiplier = safeRevealed > 0 ? 1 + (safeRevealed / totalSafe) * 2 : 1;

    await supabaseAdmin
      .from('game_sessions')
      .update({ state: { ...state, revealed: Array.from(revealed) } })
      .eq('id', sessionId);

    res.json({ hitMine: false, cellIndex, revealed: Array.from(revealed), multiplier: Number(multiplier.toFixed(2)) });
  } catch (err) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[D.J.G. Server] listening on ${PORT}`);
});
