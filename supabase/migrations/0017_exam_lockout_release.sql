-- 0017: 管理者提前解除學員的 7 日重考管制
--
-- 7 日管制原本由 take-exam 依「同一考科連續 3 次 failed」即時計算，並沒有
-- 可以安全清除的 lock 欄位。不可為了解鎖而刪除或竄改 attempt，否則會破壞
-- 成績與監考稽核紀錄。因此另存一筆解除紀錄，後續重考輪次只計算解除時間後
-- 的失敗作答；舊紀錄仍完整保留。

create table exam_lockout_release (
  id                 bigint generated always as identity primary key,
  staff_id           uuid not null references profiles(id) on delete cascade,
  exam_def_id        bigint not null references exam_def(id) on delete restrict,
  released_at        timestamptz not null default now(),
  released_by        uuid references profiles(id) on delete set null,
  prior_locked_until timestamptz not null,
  reason             text not null default '管理者提前解除考試管制',

  -- 同一輪鎖定只能解除一次，避免連點或重送造成重複稽核紀錄。
  unique (staff_id, exam_def_id, prior_locked_until)
);

create index exam_lockout_release_staff_exam_idx
  on exam_lockout_release (staff_id, exam_def_id, released_at desc);
create index exam_lockout_release_exam_def_idx
  on exam_lockout_release (exam_def_id);
create index exam_lockout_release_released_by_idx
  on exam_lockout_release (released_by);

-- take-exam 與管理頁都會以學員＋考科查找最新作答；原本只有 staff_id 單欄索引，
-- 資料累積後仍需掃描該學員所有考科紀錄。補上符合實際篩選及排序順序的索引。
create index attempt_staff_exam_submitted_idx
  on attempt (staff_id, exam_def_id, submitted_at desc)
  where submitted_at is not null;
create index attempt_staff_exam_started_idx
  on attempt (staff_id, exam_def_id, started_at desc);

alter table exam_lockout_release enable row level security;

-- 本表是唯讀稽核軌跡，瀏覽器不需直接存取；讀取與新增一律由已驗證管理者的
-- admin-users Edge Function 以 service_role 執行。明確撤銷 Data API 權限，避免
-- 新版 Supabase 專案的預設授權差異造成意外暴露。
revoke all on table exam_lockout_release from public, anon, authenticated;
revoke all on sequence exam_lockout_release_id_seq from public, anon, authenticated;
grant select, insert on table exam_lockout_release to service_role;
grant usage, select on sequence exam_lockout_release_id_seq to service_role;

comment on table exam_lockout_release is
  '管理者提前解除 7 日重考管制的不可變稽核紀錄；不修改既有 attempt。';
