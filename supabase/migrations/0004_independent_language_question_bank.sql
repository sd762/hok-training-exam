-- 0004: 題庫改為三語言完全獨立（取代 0003 的一題多語言設計）
-- 對應 ADR 0015。0003 剛建立、尚無正式資料，直接重建 question_bank，
-- 刪除 question_translation。

drop table if exists question_translation;
drop table if exists question_bank;

create table question_bank (
  id           bigint generated always as identity primary key,
  exam_def_id  bigint not null references exam_def(id) on delete restrict,
  lang_code    text not null check (lang_code in ('zh-TW', 'vi', 'id')),
  q_type       text not null default 'single' check (q_type in ('single', 'multiple')),
  score        int not null default 4,
  text         text not null,
  options_json jsonb not null,       -- ["選項A", "選項B", ...]
  answer_json  jsonb not null,       -- 正確答案在 options_json 中的位置，如 [0] 或 [0,2]
  explanation  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index question_bank_exam_lang_idx on question_bank (exam_def_id, lang_code);

alter table question_bank enable row level security;

-- 只有平台管理者/系統管理者可讀寫，其餘角色（含學員）完全無權限（呼應 ADR 0007）
create policy question_bank_admin_all on question_bank
  for all to authenticated using (auth_can_write()) with check (auth_can_write());
