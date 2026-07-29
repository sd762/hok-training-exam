-- 0015: 圖片題（配圖題目 + 圖片選項）
--
-- 使用者需求：有些題目要配圖（看圖回答文字選項），有些選項本身就是圖片（在幾張圖片
-- 裡選正確的）。跟音訊題不同：三語言（zh-TW/vi/id）都能用，不限定語言；也不用像
-- 音訊題那樣保證25題裡有固定題數，隨機出現就好，抽題邏輯完全不用改。

alter table question_bank add column image_path text;
alter table question_bank add column option_images_json jsonb; -- 跟 options_json 等長的陣列，每格是圖片路徑或 null

-- 圖片儲存桶：非公開，規則跟 question-audio 一致——學員端一律由 take-exam Edge
-- Function（service_role）簽發限時網址；後台平台管理者/系統管理者直接從瀏覽器
-- 上傳/預覽，開放 auth_can_write() 角色的 insert/select/delete。
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', false)
on conflict (id) do nothing;

create policy question_images_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-images' and auth_can_write());

create policy question_images_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'question-images' and auth_can_write());

create policy question_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and auth_can_write());
