-- 0009: 到期通知紀錄與 SMTP 設定
-- 對應工單 11（.scratch/edu-exam-v2/issues/11-notification-keepalive-cron.md）、ADR 0003／0011

create table notification_log (
  id            bigint generated always as identity primary key,
  staff_id      uuid not null references profiles(id) on delete cascade,
  stage_code    training_stage not null,
  milestone_date date not null,
  sent_at       timestamptz not null default now(),
  recipients    text,
  status        text not null, -- sent / smtp_not_configured / no_managers / error:...
  unique (staff_id, stage_code)
);

create index notification_log_staff_idx on notification_log (staff_id);

alter table notification_log enable row level security;

create policy notification_log_read_global on notification_log
  for select to authenticated using (auth_is_global_viewer());
create policy notification_log_read_own_institution on notification_log
  for select to authenticated using (
    auth_role() = 'institution_manager' and exists (
      select 1 from profiles p where p.id = notification_log.staff_id and p.institution_id = auth_institution_id()
    )
  );
-- 刻意不開放任何 insert/update/delete policy：只有 check-notifications 這支
-- Edge Function 的 service_role 能寫入，避免任何角色能偽造通知紀錄

-- SMTP 寄信設定（key-value），只有可寫入角色能讀寫（含密碼，屬於系統層級設定而非個資）
create table system_setting (
  key   text primary key,
  value text
);

alter table system_setting enable row level security;

create policy system_setting_admin_all on system_setting
  for all to authenticated using (auth_can_write()) with check (auth_can_write());
