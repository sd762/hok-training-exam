/**
 * 通用長條圖——類別色（國籍/狀態）依固定順序帶入，僅供本系統報表使用。
 * 系統目前只有淺色模式（見 index.css 說明），故不處理深色配色。
 *
 * stacked=false（預設）：並排比較——各數列是各自獨立的數值（例如各國籍的及格率），
 * 彼此加總沒有意義，不能疊在一起看。
 * stacked=true：組成佔比——各數列加總起來就是這組的總數（例如各機構的國籍人數組成），
 * 疊在一起才看得出「佔比」，見 dataviz 技能 choosing-a-form.md 的 Part-to-whole 規則。
 */
export interface BarSeries {
  key: string
  label: string
  color: string
}

export interface BarChartProps {
  groups: { key: string; label: string }[]
  series: BarSeries[]
  values: Record<string, Record<string, number | null | undefined>>
  valueSuffix?: string
  maxValue?: number
  /** 依數值決定單一長條顏色（例如及格門檻紅/綠），優先於 series.color；用於狀態編碼而非類別身分 */
  colorForValue?: (groupKey: string, seriesKey: string, value: number) => string
  stacked?: boolean
  /** 只在 stacked 模式下有作用：多群組要比較大小時用直立柱狀（vertical），單純看組成比例用橫向（預設） */
  orientation?: 'horizontal' | 'vertical'
}

export function BarChart({
  groups,
  series,
  values,
  valueSuffix = '',
  maxValue,
  colorForValue,
  stacked = false,
  orientation = 'horizontal',
}: BarChartProps) {
  if (groups.length === 0) {
    return <p className="text-sm text-ink-muted">無資料可繪圖</p>
  }

  const legend = series.length > 1 && (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
          {s.label}
        </div>
      ))}
    </div>
  )

  if (stacked && orientation === 'vertical') {
    const totals = groups.map((g) => series.reduce((sum, s) => sum + (values[g.key]?.[s.key] ?? 0), 0))
    const computedMax = maxValue ?? Math.max(1, ...totals)
    const chartHeight = 160

    return (
      <div className="space-y-4">
        {legend}
        <div className="flex items-end gap-4 overflow-x-auto pb-1">
          {groups.map((g, gi) => {
            const total = totals[gi]
            const totalPx = computedMax > 0 ? Math.max((total / computedMax) * chartHeight, total > 0 ? 4 : 0) : 0
            return (
              <div key={g.key} className="flex shrink-0 flex-col items-center gap-1" style={{ minWidth: 56 }}>
                <span className="text-[10px] tabular-nums text-ink-muted">
                  {total}
                  {valueSuffix}
                </span>
                <div
                  className="flex w-10 flex-col-reverse overflow-hidden rounded-t-md bg-surface-muted sm:w-12"
                  style={{ height: chartHeight }}
                >
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: totalPx }}>
                    {series.map((s, si) => {
                      const v = values[g.key]?.[s.key] ?? 0
                      if (v <= 0) return null
                      const segPct = total > 0 ? (v / total) * 100 : 0
                      const color = colorForValue?.(g.key, s.key, v) ?? s.color
                      const showLabel = segPct >= 14
                      return (
                        <div
                          key={s.key}
                          className="flex w-full items-center justify-center overflow-hidden"
                          style={{
                            height: `${segPct}%`,
                            backgroundColor: color,
                            borderTop: si < series.length - 1 ? '2px solid var(--color-surface)' : 'none',
                          }}
                          title={`${s.label}：${v}${valueSuffix}（占${Math.round(segPct)}%）`}
                        >
                          {showLabel && <span className="text-[10px] font-medium text-white">{v}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <span className="w-16 truncate text-center text-[11px] font-medium text-ink" title={g.label}>
                  {g.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (stacked) {
    const totals = groups.map((g) => series.reduce((sum, s) => sum + (values[g.key]?.[s.key] ?? 0), 0))
    const computedMax = maxValue ?? Math.max(1, ...totals)

    return (
      <div className="space-y-4">
        {legend}
        <div className="space-y-3">
          {groups.map((g, gi) => {
            const total = totals[gi]
            const totalPct = computedMax > 0 ? Math.max((total / computedMax) * 100, total > 0 ? 2 : 0) : 0
            return (
              <div key={g.key}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-medium text-ink">{g.label}</span>
                  <span className="tabular-nums text-ink-muted">
                    {total}
                    {valueSuffix}
                  </span>
                </div>
                <div className="h-5 overflow-hidden rounded-full bg-surface-muted" style={{ width: `${totalPct}%`, minWidth: total > 0 ? '2%' : 0 }}>
                  <div className="flex h-full w-full">
                    {series.map((s, si) => {
                      const v = values[g.key]?.[s.key] ?? 0
                      if (v <= 0) return null
                      const segPct = total > 0 ? (v / total) * 100 : 0
                      const color = colorForValue?.(g.key, s.key, v) ?? s.color
                      const showLabel = segPct >= 14
                      return (
                        <div
                          key={s.key}
                          className="flex h-full items-center justify-center overflow-hidden"
                          style={{
                            width: `${segPct}%`,
                            backgroundColor: color,
                            borderRight: si < series.length - 1 ? '2px solid var(--color-surface)' : 'none',
                          }}
                          title={`${s.label}：${v}${valueSuffix}（占${Math.round(segPct)}%）`}
                        >
                          {showLabel && <span className="text-[10px] font-medium text-white">{v}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const computedMax =
    maxValue ?? Math.max(1, ...groups.flatMap((g) => series.map((s) => values[g.key]?.[s.key] ?? 0)))

  return (
    <div className="space-y-4">
      {legend}
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-1 text-xs font-medium text-ink">{g.label}</div>
            <div className="space-y-0.5">
              {series.map((s) => {
                const v = values[g.key]?.[s.key] ?? 0
                const pct = computedMax > 0 ? Math.max((v / computedMax) * 100, v > 0 ? 2 : 0) : 0
                const color = colorForValue?.(g.key, s.key, v) ?? s.color
                return (
                  <div key={s.key} className="flex items-center gap-2" title={`${s.label}：${v}${valueSuffix}`}>
                    <div className="h-2 flex-1 rounded-full bg-surface-muted">
                      <div
                        className="h-2 rounded-full transition-[width]"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                      {v}
                      {valueSuffix}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
