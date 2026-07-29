-- 0016: 不及格細分「測驗未達標／考試紀律違規」+ 新增應考次數分布報表
--
-- 使用者反饋：考測結果分析裡「不及格」太籠統，看不出來是真的分數不夠，還是被
-- 監考機制中止（人臉消失3次／切換視窗2次）。這兩種原因其實已經記錄在
-- attempt.aborted_reason 欄位（工單09就有，見 0006_proctoring.sql）：
--   null                    → 正常評分不合格（測驗未達標）
--   'proctoring_violations' → 人臉消失3次自動中止
--   'tab_switch'            → 切換視窗2次自動中止
-- 不用新增欄位，只要在報表層把這兩種原因合併成「考試紀律違規」、跟「測驗未達標」
-- 分開顯示即可。report_exam_results 的 status 欄位因此從原本的
-- confirmed_passed/pending_review/flagged/failed/voided，多拆出
-- failed_score（測驗未達標）跟 failed_violation（考試紀律違規）取代原本的 failed。
--
-- 同時新增 report_attempt_distribution：應考次數分布（1次/2次/3次/4次以上，
-- 依最終結果分組上色），取代原本只有單一平均數（avg_attempts）看不出分布形狀的問題。

drop function if exists report_exam_results(bigint, int, int, int, training_stage, text);

create or replace function report_exam_results(
  p_institution_id bigint default null,
  p_year int default null,
  p_half int default null,
  p_quarter int default null,
  p_stage_code training_stage default null,
  p_lang_code text default null
)
returns table (
  institution_id    bigint,
  institution_name  text,
  stage_code        text,
  lang_code         text,
  status            text,
  staff_count       bigint,
  avg_score         numeric,
  avg_attempts      numeric,
  total_attempts    bigint,
  attempt_pass_rate numeric
)
language sql stable
as $$
  with filtered as (
    select
      a.staff_id,
      p.institution_id,
      e.stage_code,
      a.lang_code,
      a.status,
      a.aborted_reason,
      a.score,
      a.submitted_at
    from attempt a
    join profiles p on p.id = a.staff_id
    join exam_def e on e.id = a.exam_def_id
    where a.submitted_at is not null
      and (p_institution_id is null or p.institution_id = p_institution_id)
      and (p_year is null or date_part('year', a.submitted_at) = p_year)
      and (p_half is null or ceil(date_part('month', a.submitted_at) / 6.0) = p_half)
      and (p_quarter is null or ceil(date_part('month', a.submitted_at) / 3.0) = p_quarter)
      and (p_stage_code is null or e.stage_code = p_stage_code)
      and (p_lang_code is null or a.lang_code = p_lang_code)
  ),
  ranked as (
    select
      f.*,
      row_number() over (
        partition by f.staff_id, f.stage_code
        order by
          case f.status
            when 'confirmed_passed' then 1
            when 'pending_review' then 2
            when 'flagged' then 2
            when 'failed' then 3
            when 'voided' then 4
            else 5
          end,
          f.submitted_at desc
      ) as rn,
      count(*) over (partition by f.staff_id, f.stage_code) as attempt_count
    from filtered f
  ),
  final_status as (
    select
      *,
      case
        when status = 'failed' and aborted_reason is not null then 'failed_violation'
        when status = 'failed' then 'failed_score'
        else status::text
      end as display_status
    from ranked where rn = 1
  ),
  group_attempt_stats as (
    select
      institution_id,
      stage_code,
      lang_code,
      count(*) as total_attempts,
      round((count(*) filter (where status = 'confirmed_passed'))::numeric / count(*) * 100, 1) as attempt_pass_rate
    from filtered
    group by institution_id, stage_code, lang_code
  )
  select
    i.id,
    i.name,
    fs.stage_code::text,
    fs.lang_code,
    fs.display_status,
    count(*) as staff_count,
    round(avg(fs.score), 1) as avg_score,
    round(avg(fs.attempt_count)::numeric, 1) as avg_attempts,
    gas.total_attempts,
    gas.attempt_pass_rate
  from final_status fs
  left join institution i on i.id = fs.institution_id
  left join group_attempt_stats gas
    on gas.institution_id is not distinct from fs.institution_id
   and gas.stage_code = fs.stage_code
   and gas.lang_code = fs.lang_code
  group by i.id, i.name, fs.stage_code, fs.lang_code, fs.display_status, gas.total_attempts, gas.attempt_pass_rate
  order by i.name, fs.stage_code, fs.lang_code, fs.display_status
$$;

grant execute on function report_exam_results(bigint, int, int, int, training_stage, text) to authenticated;

-- 應考次數分布：同一套「每人每階段取最終結果」邏輯，改成依「總共考了幾次」分桶，
-- 而不是依機構/狀態分組——用來看「大家平均要考幾次才有結果」的分布形狀，
-- 不是只看一個平均數字。
create or replace function report_attempt_distribution(
  p_institution_id bigint default null,
  p_year int default null,
  p_half int default null,
  p_quarter int default null,
  p_stage_code training_stage default null,
  p_lang_code text default null
)
returns table (
  attempt_bucket text,
  status         text,
  staff_count    bigint
)
language sql stable
as $$
  with filtered as (
    select
      a.staff_id,
      p.institution_id,
      e.stage_code,
      a.lang_code,
      a.status,
      a.aborted_reason,
      a.submitted_at
    from attempt a
    join profiles p on p.id = a.staff_id
    join exam_def e on e.id = a.exam_def_id
    where a.submitted_at is not null
      and (p_institution_id is null or p.institution_id = p_institution_id)
      and (p_year is null or date_part('year', a.submitted_at) = p_year)
      and (p_half is null or ceil(date_part('month', a.submitted_at) / 6.0) = p_half)
      and (p_quarter is null or ceil(date_part('month', a.submitted_at) / 3.0) = p_quarter)
      and (p_stage_code is null or e.stage_code = p_stage_code)
      and (p_lang_code is null or a.lang_code = p_lang_code)
  ),
  ranked as (
    select
      f.*,
      row_number() over (
        partition by f.staff_id, f.stage_code
        order by
          case f.status
            when 'confirmed_passed' then 1
            when 'pending_review' then 2
            when 'flagged' then 2
            when 'failed' then 3
            when 'voided' then 4
            else 5
          end,
          f.submitted_at desc
      ) as rn,
      count(*) over (partition by f.staff_id, f.stage_code) as attempt_count
    from filtered f
  ),
  final_status as (
    select
      *,
      case
        when attempt_count = 1 then '1次'
        when attempt_count = 2 then '2次'
        when attempt_count = 3 then '3次'
        else '4次以上'
      end as attempt_bucket,
      case
        when status = 'failed' and aborted_reason is not null then 'failed_violation'
        when status = 'failed' then 'failed_score'
        else status::text
      end as display_status
    from ranked where rn = 1
  )
  select attempt_bucket, display_status, count(*) as staff_count
  from final_status
  group by attempt_bucket, display_status
  order by attempt_bucket, display_status
$$;

grant execute on function report_attempt_distribution(bigint, int, int, int, training_stage, text) to authenticated;
