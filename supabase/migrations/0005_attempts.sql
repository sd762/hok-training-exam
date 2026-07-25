-- 0005: 測驗作答紀錄
-- 對應工單 07（.scratch/edu-exam-v2/issues/07-grading-edge-function.md）
-- 呼應 ADR 0006（待核對/已確認通過/存疑保留三態）、ADR 0007（正解只有 Edge Function 能存取）、
-- ADR 0010（抽題輪替規則）。

create type attempt_status as enum ('in_progress', 'failed', 'pending_review', 'confirmed_passed', 'flagged');

create table attempt (
  id                 bigint generated always as identity primary key,
  staff_id           uuid not null references profiles(id) on delete cascade,
  exam_def_id        bigint not null references exam_def(id) on delete restrict,
  lang_code          text not null,
  status             attempt_status not null default 'in_progress',
  score              int,
  pass_score_at_time int not null,
  -- 完整快照（題目/選項/正確答案/作答內容），只有 Edge Function（service_role）寫入，
  -- 一般前端讀取到的是這個角色可見範圍內、已經評分完成的資料列
  detail_json        jsonb,
  started_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  reviewed_at        timestamptz,
  reviewed_by        uuid references profiles(id)
);

-- 正規化的單題作答結果，供之後報表（工單 12）直接 GROUP BY，不用每次解析 JSON
create table attempt_answer (
  id          bigint generated always as identity primary key,
  attempt_id  bigint not null references attempt(id) on delete cascade,
  question_id bigint references question_bank(id) on delete set null,
  exam_def_id bigint not null references exam_def(id) on delete restrict,
  lang_code   text not null,
  is_correct  boolean not null
);

create index attempt_staff_idx on attempt (staff_id);
create index attempt_exam_idx on attempt (exam_def_id, status);
create index attempt_answer_attempt_idx on attempt_answer (attempt_id);
create index attempt_answer_question_idx on attempt_answer (question_id);

alter table attempt enable row level security;
alter table attempt_answer enable row level security;

-- 讀取：本人／機構管理者（限自己機構）／全域角色（系統管理者/平台管理者/管理者）
create policy attempt_read_self on attempt
  for select to authenticated using (staff_id = auth.uid());
create policy attempt_read_global on attempt
  for select to authenticated using (auth_is_global_viewer());
create policy attempt_read_own_institution on attempt
  for select to authenticated using (
    auth_role() = 'institution_manager' and exists (
      select 1 from profiles p where p.id = attempt.staff_id and p.institution_id = auth_institution_id()
    )
  );
-- 刻意不開放任何 insert/update/delete policy：作答的建立、評分、狀態轉換
-- 全部只能透過 Edge Function 的 service_role 執行，任何角色都不能直接改動分數或狀態

create policy attempt_answer_read_global on attempt_answer
  for select to authenticated using (auth_is_global_viewer());
create policy attempt_answer_read_own_institution on attempt_answer
  for select to authenticated using (
    auth_role() = 'institution_manager' and exists (
      select 1 from attempt a join profiles p on p.id = a.staff_id
      where a.id = attempt_answer.attempt_id and p.institution_id = auth_institution_id()
    )
  );
