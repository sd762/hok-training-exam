/**
 * 通用分組長條圖——類別色（國籍/狀態）依固定順序帶入，僅供本系統報表使用。
 * 系統目前只有淺色模式（見 index.css 說明），故不處理深色配色。
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
}

export function BarChart({ groups, series, values, valueSuffix = '', maxValue, colorForValue }: BarChartProps) {
  const computedMax =
    maxValue ??
    Math.max(
      1,
      ...groups.flatMap((g) => series.map((s) => values[g.key]?.[s.key] ?? 0)),
    )

  if (groups.length === 0) {
    return <p className="text-sm text-ink-muted">無資料可繪圖</p>
  }

  return (
    <div className="space-y-4">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
            </div>
          ))}
        </div>
      )}

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
