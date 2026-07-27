-- 0014: 音訊題（聽力題）
--
-- 使用者需求：越南文/印尼文題庫加入音訊題（播放情境音效，問「這是什麼情境」，
-- 一樣是單選/複選＋選項的作答方式）。台籍(zh-TW)不考音訊題。
--
-- 音效本身是情境音效（不是語音對話），vi/id 兩個獨立題目可能共用同一個音檔——
-- 這是 Storage 檔案層級的重複使用，不是資料庫層級的跨語言關聯，ADR 0015
-- 「三語言題庫完全獨立」的原則不變（vi、id 各自還是獨立一列，各自維護文字/選項/答案）。

alter table question_bank add column audio_path text;

-- 音訊檔案儲存桶：非公開。學員端播放一律由 take-exam Edge Function（service_role）
-- 簽發限時網址，不開放給學員角色直接讀取整個 bucket；後台平台管理者/系統管理者
-- 新增題目時需要直接從瀏覽器上傳/預覽音檔，所以開放 auth_can_write() 角色的
-- insert/select/delete（比照 question_bank 本身的權限邊界）。
insert into storage.buckets (id, name, public)
values ('question-audio', 'question-audio', false)
on conflict (id) do nothing;

create policy question_audio_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-audio' and auth_can_write());

create policy question_audio_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'question-audio' and auth_can_write());

create policy question_audio_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-audio' and auth_can_write());
