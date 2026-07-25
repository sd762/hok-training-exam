-- 0006: 鏡頭監考事件與快照儲存
-- 對應工單 09（.scratch/edu-exam-v2/issues/09-webcam-proctoring.md）、ADR 0005（2026-07-25 修訂）

create type proctoring_event_type as enum ('warning', 'scheduled');

create table proctoring_event (
  id           bigint generated always as identity primary key,
  attempt_id   bigint not null references attempt(id) on delete cascade,
  event_type   proctoring_event_type not null,
  storage_path text not null,
  occurred_at  timestamptz not null default now()
);

create index proctoring_event_attempt_idx on proctoring_event (attempt_id);

alter table proctoring_event enable row level security;

-- 讀取：機構管理者（限自己機構）／全域角色（系統管理者/平台管理者/管理者）
create policy proctoring_event_read_global on proctoring_event
  for select to authenticated using (auth_is_global_viewer());
create policy proctoring_event_read_own_institution on proctoring_event
  for select to authenticated using (
    auth_role() = 'institution_manager' and exists (
      select 1 from attempt a join profiles p on p.id = a.staff_id
      where a.id = proctoring_event.attempt_id and p.institution_id = auth_institution_id()
    )
  );
-- 刻意不開放任何 insert/update/delete policy：只有 Edge Function 的 service_role 能寫入，
-- 前端（含平台管理者）都不能直接新增/竄改監考事件紀錄

-- 中止作答的原因標記（NULL＝正常評分不合格，'proctoring_violations'＝監考累計3次警告自動中止）
alter table attempt add column aborted_reason text;

-- 監考快照儲存桶：非公開，沒有任何 client 端可用的政策，僅 service_role（Edge Function）存取
insert into storage.buckets (id, name, public)
values ('proctoring', 'proctoring', false)
on conflict (id) do nothing;
