-- 0002: 學員專屬欄位
-- 對應工單 05（.scratch/edu-exam-v2/issues/05-staff-management-import.md）
-- 與 profiles（帳號/角色通用欄位）分開，只有 role = 'staff' 的帳號才有對應資料列。

create type training_stage as enum ('1m', '3m', '1y');

create table staff_detail (
  profile_id    uuid primary key references profiles(id) on delete cascade,
  name_native   text,                          -- 母語姓名（選填，如中文音譯）
  lang_code     text not null default 'zh-TW', -- zh-TW / vi / id
  birth_date    date,
  hire_date     date not null,
  current_stage training_stage,
  department    text,
  updated_at    timestamptz not null default now()
);

create trigger staff_detail_set_updated_at
  before update on staff_detail
  for each row execute function set_updated_at();

alter table staff_detail enable row level security;

-- 本人可讀自己的受訓資料
create policy staff_detail_read_self on staff_detail
  for select to authenticated using (profile_id = auth.uid());

-- 全域角色（系統管理者/平台管理者/管理者）可讀全部
create policy staff_detail_read_global on staff_detail
  for select to authenticated using (auth_is_global_viewer());

-- 機構管理者可讀自己機構學員的受訓資料
create policy staff_detail_read_own_institution on staff_detail
  for select to authenticated using (
    auth_role() = 'institution_manager'
    and exists (
      select 1 from profiles p
      where p.id = staff_detail.profile_id
        and p.institution_id = auth_institution_id()
    )
  );

-- 寫入限平台管理者/系統管理者（機構管理者無寫入權限，呼應 ADR 0013）
create policy staff_detail_write on staff_detail
  for all to authenticated using (auth_can_write()) with check (auth_can_write());
