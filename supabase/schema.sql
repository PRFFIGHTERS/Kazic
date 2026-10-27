-- ============================================================
-- D.J.G. — Supabase Schema
-- Выполнить в SQL Editor проекта Supabase
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id  bigint UNIQUE,
  nickname     text NOT NULL DEFAULT 'Player',
  avatar_url   text,
  role         text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

-- Админ видит все профили
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 2. USER PREFERENCES
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id             uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  background_url      text,
  overlay_opacity     numeric NOT NULL DEFAULT 0.65 CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),
  accent_color        text NOT NULL DEFAULT '#8b5cf6',
  particles_enabled   boolean NOT NULL DEFAULT true,
  animations_intensity text NOT NULL DEFAULT 'normal' CHECK (animations_intensity IN ('low', 'normal', 'high')),
  sounds_enabled      boolean NOT NULL DEFAULT false,
  card_density        text NOT NULL DEFAULT 'comfortable' CHECK (card_density IN ('compact', 'comfortable', 'spacious')),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_own" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. USER BALANCES
CREATE TABLE IF NOT EXISTS public.user_balances (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balances_select_own" ON public.user_balances
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE только через service_role (сервер). Явно запрещаем для клиентов.
-- Политик INSERT/UPDATE для anon/authenticated нет — значит, запрещено.

-- 4. BALANCE TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id          uuid NOT NULL REFERENCES public.profiles(id),
  user_id           uuid NOT NULL REFERENCES public.profiles(id),
  operation_type    text NOT NULL CHECK (operation_type IN ('add', 'subtract', 'set', 'reset')),
  previous_balance  bigint NOT NULL,
  delta             bigint NOT NULL,
  new_balance       bigint NOT NULL CHECK (new_balance >= 0),
  reason            text NOT NULL,
  idempotency_key   text NOT NULL UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_tx_user ON public.balance_transactions(user_id, created_at DESC);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balance_tx_select_own" ON public.balance_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "balance_tx_admin_select" ON public.balance_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- INSERT только service_role

-- 5. GAME SESSIONS
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_type   text NOT NULL CHECK (game_type IN ('crash', 'mines')),
  state       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON public.game_sessions(user_id, created_at DESC);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON public.game_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE только service_role

-- 6. GAME RESULTS
CREATE TABLE IF NOT EXISTS public.game_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_type   text NOT NULL,
  result      jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_results_user ON public.game_results(user_id, created_at DESC);

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "results_select_own" ON public.game_results
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT только service_role

-- 7. FAVORITES
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id  text NOT NULL,
  PRIMARY KEY (user_id, game_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_own" ON public.favorites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 9. ADMIN AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       uuid NOT NULL REFERENCES public.profiles(id),
  action         text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id),
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_only" ON public.admin_audit_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 10. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_admin_only" ON public.system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- 11. ТРИГГЕР: автосоздание профиля, настроек и баланса при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, telegram_id, nickname)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data ->> 'telegram_id')::bigint,
    COALESCE(NEW.raw_user_meta_data ->> 'nickname', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_balances (user_id, balance) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. ТРИГГЕР: обновление updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_prefs_updated ON public.user_preferences;
CREATE TRIGGER trg_prefs_updated
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_balances_updated ON public.user_balances;
CREATE TRIGGER trg_balances_updated
  BEFORE UPDATE ON public.user_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. RPC для атомарного изменения баланса (вызывается только сервером с service_role)
CREATE OR REPLACE FUNCTION public.apply_balance_change(
  p_admin_id        uuid,
  p_user_id         uuid,
  p_operation_type  text,
  p_amount          bigint,
  p_reason          text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_previous bigint;
  v_new      bigint;
  v_delta    bigint;
  v_exists   boolean;
BEGIN
  -- Проверка идемпотентности
  SELECT EXISTS (
    SELECT 1 FROM public.balance_transactions WHERE idempotency_key = p_idempotency_key
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate_idempotency_key');
  END IF;

  -- Блокировка строки баланса
  SELECT balance INTO v_previous
  FROM public.user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Баланс пользователя не найден';
  END IF;

  -- Расчёт нового баланса
  IF p_operation_type = 'add' THEN
    v_new := v_previous + p_amount;
  ELSIF p_operation_type = 'subtract' THEN
    v_new := v_previous - p_amount;
  ELSIF p_operation_type = 'set' THEN
    v_new := p_amount;
  ELSIF p_operation_type = 'reset' THEN
    v_new := 0;
  ELSE
    RAISE EXCEPTION 'Неизвестный тип операции: %', p_operation_type;
  END IF;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'Баланс не может быть отрицательным';
  END IF;

  v_delta := v_new - v_previous;

  UPDATE public.user_balances
  SET balance = v_new, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.balance_transactions (
    admin_id, user_id, operation_type, previous_balance, delta, new_balance, reason, idempotency_key
  ) VALUES (
    p_admin_id, p_user_id, p_operation_type, v_previous, v_delta, v_new, p_reason, p_idempotency_key
  );

  INSERT INTO public.admin_audit_logs (admin_id, action, target_user_id, payload)
  VALUES (
    p_admin_id,
    'balance_change',
    p_user_id,
    jsonb_build_object(
      'operation_type', p_operation_type,
      'previous_balance', v_previous,
      'delta', v_delta,
      'new_balance', v_new,
      'reason', p_reason,
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN jsonb_build_object(
    'skipped', false,
    'previous_balance', v_previous,
    'new_balance', v_new,
    'delta', v_delta
  );
END;
$$;
