/**
 * 單一快照的組成圖（甜甜圈圖）——只用在「這一個群體現在的組成佔比」這種任務，
 * 例如單一機構的國籍佔比、單一機構的及格/不及格佔比。
 *
 * 依 dataviz 技能規則：圓餅/甜甜圈屬於「全兩兩相鄰」形式，色票只驗證過前3色在
 * 這種形式下兩兩都夠區分，故這裡最多收 3 個切片；超過的類別要先在呼叫端折疊成
 * 「其他」。也因為如此，這個元件不能拿來比較「很多機構之間」的組成——那種跨群組
 * 比較的任務要用長條圖（見 BarChart 的 stacked 模式），不是很多個圓餅圖並排。
 */
export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

const R = 15.91549430918954 // 圓周長剛好是 100，百分比可以直接當弧長使用
const CIRCUMFERENCE = 2 * Math.PI * R

export function DonutChart({
  slices,
  valueSuffix = '',
  centerLabel,
}: {
  slices: DonutSlice[]
  valueSuffix?: string
  centerLabel?: string
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  if (total <= 0) {
    return <p className="text-sm text-ink-muted">無資料可繪圖</p>
  }

  let cumulativePct = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 42 42" className="size-full -rotate-90">
          <circle cx="21" cy="21" r={R} fill="transparent" stroke="var(--color-surface-muted)" strokeWidth="6" />
          {slices.map((s) => {
            if (s.value <= 0) return null
            const pct = (s.value / total) * 100
            const dash = (pct / 100) * CIRCUMFERENCE
            const offset = -((cumulativePct / 100) * CIRCUMFERENCE)
            cumulativePct += pct
            return (
              <circle
                key={s.key}
                cx="21"
                cy="21"
                r={R}
                fill="transparent"
                stroke={s.color}
                strokeWidth="6"
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={offset}
              >
                <title>
                  {s.label}：{s.value}
                  {valueSuffix}（{Math.round(pct)}%）
                </title>
              </circle>
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold text-ink">{total}</span>
          {centerLabel && <span className="text-[10px] text-ink-muted">{centerLabel}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
          return (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              <span className="text-ink">{s.label}</span>
              <span className="tabular-nums text-ink-muted">
                {s.value}
                {valueSuffix}（{pct}%）
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
