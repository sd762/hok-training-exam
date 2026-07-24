-- 0001: 帳號、角色與機構基礎 schema
-- 對應工單 02（.scratch/edu-exam-v2/issues/02-supabase-schema-reset.md）
-- 相關決策：ADR 0008（統一帳號代碼登入）、0009（機構清單資料化）、0013（五層角色）

-- ---------------------------------------------------------------------------
-- 角色定義（ADR 0013 五層角色）
-- ---------------------------------------------------------------------------
create type user_role as enum (
  'super_admin',          -- 系統管理者：可管理其他管理者帳號
  'platform_admin',       -- 平台管理者：建檔/匯入/審查及格作答
  'viewer_admin',         -- 管理者：純查看全機構，不能新增修改任何資料
  'institution_manager',  -- 機構管理者：只看自己機構，不能審查
  'staff'                 -- 學員：只看自己
);

-- ---------------------------------------------------------------------------
-- 機構（ADR 0009：改為可維護資料，不再寫死於程式碼）
-- ---------------------------------------------------------------------------
create table institution_category (
  id          bigint generated always as identity primary key,
  name        text not null unique,          -- 護理之家／法人館／養護機構
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table institution (
  id          bigint generated always as identity primary key,
  category_id bigint not null references institution_category(id) on delete restrict,
  name        text not null,                 -- 1館／清安／清風…
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (category_id, name)
);

-- ---------------------------------------------------------------------------
-- 帳號（ADR 0008：所有角色一律以帳號代碼登入，email 僅為聯絡資料）
-- 身分本體在 auth.users；此表存放角色與所屬機構等業務屬性。
-- 學員的受訓相關欄位（到職日、語言別、受訓階段等）另見工單 05。
-- ---------------------------------------------------------------------------
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  account_code   text not null unique,       -- 工號或管理者帳號代碼（登入用）
  display_name   text not null,
  role           user_role not null,
  institution_id bigint references institution(id) on delete restrict,
  contact_email  text,                       -- 通知信收件地址，非登入帳號
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- 機構管理者與學員必須隸屬某個機構；全域角色則不需要
  constraint profiles_institution_required check (
    role in ('super_admin', 'platform_admin', 'viewer_admin')
    or institution_id is not null
  )
);

create index profiles_institution_idx on profiles (institution_id);
create index profiles_role_idx on profiles (role);

-- updated_at 自動維護
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS 輔助函式
-- 必須是 security definer：政策若直接查詢 profiles 判斷角色，會觸發 profiles
-- 自身的 RLS 而無限遞迴。此函式繞過 RLS 取得當前使用者的角色/機構。
-- ---------------------------------------------------------------------------
create or replace function auth_role()
returns user_role
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() and is_active $$;

create or replace function auth_institution_id()
returns bigint
language sql stable security definer set search_path = public
as $$ select institution_id from profiles where id = auth.uid() and is_active $$;

-- 可查看全部機構資料的角色
create or replace function auth_is_global_viewer()
returns boolean
language sql stable
as $$ select auth_role() in ('super_admin', 'platform_admin', 'viewer_admin') $$;

-- 可寫入業務資料的角色（管理者為純查看，不含在內）
create or replace function auth_can_write()
returns boolean
language sql stable
as $$ select auth_role() in ('super_admin', 'platform_admin') $$;

-- ---------------------------------------------------------------------------
-- RLS：全部啟用，未明確授予的一律拒絕
-- ---------------------------------------------------------------------------
alter table institution_category enable row level security;
alter table institution          enable row level security;
alter table profiles             enable row level security;

-- 機構清單：已登入者皆可讀（各處下拉選單需要），僅可寫入角色能異動
create policy institution_category_read on institution_category
  for select to authenticated using (true);
create policy institution_category_write on institution_category
  for all to authenticated using (auth_can_write()) with check (auth_can_write());

create policy institution_read on institution
  for select to authenticated using (true);
create policy institution_write on institution
  for all to authenticated using (auth_can_write()) with check (auth_can_write());

-- 帳號：本人可讀自己；全域角色可讀全部；機構管理者可讀自己機構的成員
create policy profiles_read_self on profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_read_global on profiles
  for select to authenticated using (auth_is_global_viewer());

create policy profiles_read_own_institution on profiles
  for select to authenticated using (
    auth_role() = 'institution_manager'
    and institution_id = auth_institution_id()
  );

-- 帳號異動：僅可寫入角色。管理者帳號（三種全域角色）的建立/修改限系統管理者。
create policy profiles_write on profiles
  for all to authenticated
  using (
    auth_can_write()
    and (role in ('institution_manager', 'staff') or auth_role() = 'super_admin')
  )
  with check (
    auth_can_write()
    and (role in ('institution_manager', 'staff') or auth_role() = 'super_admin')
  );
