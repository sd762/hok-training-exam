-- 0011: 報表補上「國籍」篩選維度、新增年齡分布、移除人力留任分析
--
-- 使用者反饋兩點：① 留任分析是HR的事，這系統的報表應聚焦國籍/年齡與考試結果，
-- 不做人資留任追蹤；② 報表要能從「全院總況→機構/國籍比較→單一機構/單一國籍
-- 深入」這個範圍逐層縮小的角度看，不是四個互不相關的資料分頁。
--
-- 做法：每個函式都同時開放「機構」與「國籍」兩個篩選參數，兩個都不填＝全院
-- 總況（同時看得到跨機構、跨國籍的分組比較）；只填機構＝單一機構深入；只填
-- 國籍＝單一國籍深入；兩個都填＝該機構裡該國籍的細節。不用另外蓋新分頁。

drop function if exists report_retention(bigint);
drop function if exists report_staff_summary(bigint);
drop function if exists report_exam_results(bigint, int, int, int, training_stage);

create or replace function report_staff_summary(
  p_institution_id bigint default null,
  p_lang_code text default null
)
returns table (
  institution_id   bigint,
  institution_name text,
  lang_code        text,
  total_count      bigint,
  active_count     bigint,
  avg_age          numeric
)
language sql stable
as $$
  select
    i.id,
    i.name,
    sd.lang_code,
    count(*),
    count(*) filter (where p.is_active),
    round((avg(date_part('year', age(current_date, sd.birth_date))) filter (where sd.birth_date is not null))::numeric, 1)
  from profiles p
  join staff_detail sd on sd.profile_id = p.id
  left join institution i on i.id = p.institution_id
  where p.role = 'staff'
    and (p_institution_id is null or p.institution_id = p_institution_id)
    and (p_lang_code is null or sd.lang_code = p_lang_code)
  group by i.id, i.name, sd.lang_code
  order by i.name, sd.lang_code
$$;

create or replace function report_exam_results(
  p_institution_id bigint default null,
  p_year int default null,
  p_half int default null,
  p_quarter int default null,
  p_stage_code training_stage default null,
  p_lang_code text default null
)
returns table (
  institution_id   bigint,
  institution_name text,
  stage_code       text,
  lang_code        text,
  status           text,
  attempt_count    bigint,
  avg_score        numeric
)
language sql stable
as $$
  select
    i.id,
    i.name,
    e.stage_code::text,
    a.lang_code,
    a.status::text,
    count(*),
    round(avg(a.score), 1)
  from attempt a
  join profiles p on p.id = a.staff_id
  join exam_def e on e.id = a.exam_def_id
  left join institution i on i.id = p.institution_id
  where a.submitted_at is not null
    and (p_institution_id is null or p.institution_id = p_institution_id)
    and (p_year is null or date_part('year', a.submitted_at) = p_year)
    and (p_half is null or ceil(date_part('month', a.submitted_at) / 6.0) = p_half)
    and (p_quarter is null or ceil(date_part('month', a.submitted_at) / 3.0) = p_quarter)
    and (p_stage_code is null or e.stage_code = p_stage_code)
    and (p_lang_code is null or a.lang_code = p_lang_code)
  group by i.id, i.name, e.stage_code, a.lang_code, a.status
  order by i.name, e.stage_code, a.lang_code, a.status
$$;

create or replace function report_age_distribution(
  p_institution_id bigint default null,
  p_lang_code text default null
)
returns table (
  lang_code  text,
  age_bucket text,
  count      bigint
)
language sql stable
as $$
  select
    sd.lang_code,
    case
      when age(current_date, sd.birth_date) < interval '30 years' then '20-29'
      when age(current_date, sd.birth_date) < interval '40 years' then '30-39'
      when age(current_date, sd.birth_date) < interval '50 years' then '40-49'
      when age(current_date, sd.birth_date) < interval '60 years' then '50-59'
      else '60+'
    end as age_bucket,
    count(*) as count
  from profiles p
  join staff_detail sd on sd.profile_id = p.id
  where p.role = 'staff'
    and p.is_active
    and sd.birth_date is not null
    and (p_institution_id is null or p.institution_id = p_institution_id)
    and (p_lang_code is null or sd.lang_code = p_lang_code)
  group by sd.lang_code, age_bucket
  order by age_bucket, sd.lang_code
$$;

grant execute on function report_staff_summary(bigint, text) to authenticated;
grant execute on function report_exam_results(bigint, int, int, int, training_stage, text) to authenticated;
grant execute on function report_age_distribution(bigint, text) to authenticated;
