-- 0003: 測驗科目與題庫（多語言）
-- 對應工單 06（.scratch/edu-exam-v2/issues/06-question-bank-management.md）
-- 呼應 ADR 0007：question_bank / question_translation 只有平台管理者/系統管理者
-- 可直接讀寫（含正確答案），學員一律透過工單 07 的 Edge Function 取得不含解答的題目，
-- 這裡的 RLS 刻意不給 staff / institution_manager / viewer_admin 任何讀取權限。

create table exam_def (
  id              bigint generated always as identity primary key,
  stage_code      training_stage not null,
  title           text not null,
  pass_score      int not null default 80,
  validity_months int not null default 12,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table question_bank (
  id          bigint generated always as identity primary key,
  exam_def_id bigint not null references exam_def(id) on delete restrict,
  q_type      text not null default 'single' check (q_type in ('single', 'multiple')),
  score       int not null default 4,
  -- 正確答案的選項「位置」（語言中立，各語言選項順序一致，只需存一份）
  -- 例如 [0] 代表第 1 個選項為正解，[0,2] 代表複選第 1、3 個選項皆正解
  answer_json jsonb not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table question_translation (
  id           bigint generated always as identity primary key,
  question_id  bigint not null references question_bank(id) on delete cascade,
  lang_code    text not null,
  text         text not null,
  options_json jsonb not null, -- ["選項A", "選項B", ...]，順序需與 answer_json 的位置對應
  explanation  text,
  unique (question_id, lang_code)
);

create index question_bank_exam_def_idx on question_bank (exam_def_id);
create index question_translation_question_idx on question_translation (question_id);

alter table exam_def enable row level security;
alter table question_bank enable row level security;
alter table question_translation enable row level security;

-- exam_def：不含答案，已登入者皆可讀（學員/機構管理者選擇考科時需要），只有可寫角色能異動
create policy exam_def_read on exam_def
  for select to authenticated using (true);
create policy exam_def_write on exam_def
  for all to authenticated using (auth_can_write()) with check (auth_can_write());

-- question_bank / question_translation：只有平台管理者/系統管理者可讀寫，其餘角色（含學員）完全無權限
-- 沒有對應角色的 select policy＝預設拒絕，這是刻意的（呼應 ADR 0007）
create policy question_bank_admin_all on question_bank
  for all to authenticated using (auth_can_write()) with check (auth_can_write());

create policy question_translation_admin_all on question_translation
  for all to authenticated using (auth_can_write()) with check (auth_can_write());
