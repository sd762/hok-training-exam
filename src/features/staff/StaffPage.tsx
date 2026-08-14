import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, LockOpen, Plus, Search, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { fetchCategories, fetchInstitutions } from '@/features/institutions/api'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import {
  createOrUpdateStaff,
  deleteStaff,
  fetchStaff,
  LANG_LABELS,
  releaseStaffExamLockout,
  resetStaffPassword,
  setStaffActive,
  STAGE_LABELS,
  type StaffRow,
  type StaffExamStatus,
} from './api'
import { StaffFormModal } from './StaffFormModal'

// xlsx 套件體積不小，只有真正點「批次匯入」的人才需要下載，延後載入
const StaffImportModal = lazy(() =>
  import('./StaffImportModal').then((m) => ({ default: m.StaffImportModal })),
)

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [categories, setCategories] = useState<InstitutionCategory[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [openInstitutions, setOpenInstitutions] = useState<Set<number | 'none'>>(new Set())
  const [search, setSearch] = useState('')
  const [unlockingStaffId, setUnlockingStaffId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [staffRows, cats, insts] = await Promise.all([
        fetchStaff(),
        fetchCategories(),
        fetchInstitutions(),
      ])
      setStaff(staffRows)
      setCategories(cats)
      setInstitutions(insts)
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const searching = search.trim().length > 0

  // 搜尋比對工號/姓名/母語姓名，不分大小寫；有搜尋字串時只留下有符合的機構資料夾，並自動展開
  const visibleStaff = useMemo(() => {
    if (!searching) return staff
    const keyword = search.trim().toLowerCase()
    return staff.filter(
      (row) =>
        row.account_code.toLowerCase().includes(keyword) ||
        row.display_name.toLowerCase().includes(keyword) ||
        (row.name_native ?? '').toLowerCase().includes(keyword),
    )
  }, [staff, search, searching])

  // 依機構分資料夾：機構管理者要在幾十位學員裡找人時，先展開自己負責的機構就好，不用整張表滑來滑去
  const staffByInstitution = useMemo(() => {
    const map = new Map<number | 'none', StaffRow[]>()
    for (const row of visibleStaff) {
      const key = row.institution_id ?? 'none'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [visibleStaff])

  const institutionsByCategory = useMemo(() => {
    const map = new Map<number, Institution[]>()
    for (const inst of institutions) {
      const list = map.get(inst.category_id) ?? []
      list.push(inst)
      map.set(inst.category_id, list)
    }
    return map
  }, [institutions])

  function toggleInstitution(key: number | 'none') {
    setOpenInstitutions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleToggleActive(row: StaffRow) {
    try {
      await setStaffActive(row.id, !row.is_active)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '狀態切換失敗')
    }
  }

  async function handleDelete(row: StaffRow) {
    if (!confirm(`確定要刪除學員「${row.display_name}」（${row.account_code}）嗎？此動作無法復原。`)) return
    try {
      await deleteStaff(row.account_code)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗')
    }
  }

  async function handleResetPassword(row: StaffRow) {
    try {
      const result = await resetStaffPassword(row.account_code)
      setNotice(`${row.display_name}（${row.account_code}）密碼已重設為 ${result.new_password}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重設密碼失敗')
    }
  }

  async function handleReleaseLockout(row: StaffRow) {
    const lockedUntil = row.exam_status.locked_until
      ? formatDateTime(row.exam_status.locked_until)
      : '原管制期限'
    if (
      !confirm(
        `確定要提前解除「${row.display_name}」（${row.account_code}）的考試管制嗎？\n\n` +
          `目前管制至：${lockedUntil}\n` +
          '解除後會立即開放新一輪 3 次測考機會；原有失敗、分數及違規紀錄都會保留。',
      )
    ) return

    setError(null)
    setNotice(null)
    setUnlockingStaffId(row.id)
    try {
      const result = await releaseStaffExamLockout(row.id)
      setNotice(
        `${row.display_name}（${row.account_code}）的考試管制已解除，可立即重新測考（本輪 ${result.attempts_left} 次機會）。`,
      )
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除考試管制失敗')
    } finally {
      setUnlockingStaffId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-muted">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        載入中…
      </div>
    )
  }

  const unassigned = staffByInstitution.get('none') ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">學員管理</h1>
          <p className="mt-1 text-sm text-ink-muted">
            可查看每位學員目前考測狀況；連續 3 次未通過的 7 日管制可在此提前解除。原考測與違規紀錄仍會保留。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <Upload className="size-4" aria-hidden />
            批次匯入
          </Button>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            新增學員
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-status-fail/30 bg-status-fail/5 p-4 text-sm text-status-fail">
          {error}
        </Card>
      )}
      {notice && (
        <Card className="border-status-pass/30 bg-status-pass/5 p-4 text-sm text-status-pass">
          {notice}
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋工號／姓名／母語姓名"
          className="pl-9"
        />
      </div>

      {searching && visibleStaff.length === 0 && (
        <p className="text-sm text-ink-muted">找不到符合「{search.trim()}」的學員</p>
      )}

      <div className="space-y-6">
        {categories.map((category) => {
          const insts = institutionsByCategory.get(category.id) ?? []
          if (insts.length === 0) return null
          const visibleInsts = searching ? insts.filter((inst) => (staffByInstitution.get(inst.id) ?? []).length > 0) : insts
          if (visibleInsts.length === 0) return null
          return (
            <div key={category.id}>
              <h2 className="mb-2 text-sm font-semibold text-ink-muted">{category.name}</h2>
              <div className="space-y-2">
                {visibleInsts.map((inst) => (
                  <InstitutionFolder
                    key={inst.id}
                    title={inst.name}
                    rows={staffByInstitution.get(inst.id) ?? []}
                    open={searching || openInstitutions.has(inst.id)}
                    onToggle={() => toggleInstitution(inst.id)}
                    onEdit={setEditing}
                    onResetPassword={handleResetPassword}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    onReleaseLockout={handleReleaseLockout}
                    unlockingStaffId={unlockingStaffId}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {unassigned.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink-muted">未指定機構</h2>
            <InstitutionFolder
              title="未指定機構"
              rows={unassigned}
              open={searching || openInstitutions.has('none')}
              onToggle={() => toggleInstitution('none')}
              onEdit={setEditing}
              onResetPassword={handleResetPassword}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onReleaseLockout={handleReleaseLockout}
              unlockingStaffId={unlockingStaffId}
            />
          </div>
        )}
      </div>

      {editing && (
        <StaffFormModal
          editing={editing === 'new' ? null : editing}
          categories={categories}
          institutions={institutions}
          onSubmit={async (input) => {
            const result = await createOrUpdateStaff(input)
            if (result.created && result.password) {
              setNotice(`${input.display_name}（${input.account_code}）已建立，預設密碼：${result.password}，請提醒對方登入後盡快修改`)
            }
            await reload()
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {importing && (
        <Suspense fallback={null}>
          <StaffImportModal
            categories={categories}
            institutions={institutions}
            onDone={reload}
            onClose={() => setImporting(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

function InstitutionFolder({
  title,
  rows,
  open,
  onToggle,
  onEdit,
  onResetPassword,
  onToggleActive,
  onDelete,
  onReleaseLockout,
  unlockingStaffId,
}: {
  title: string
  rows: StaffRow[]
  open: boolean
  onToggle: () => void
  onEdit: (row: StaffRow) => void
  onResetPassword: (row: StaffRow) => void
  onToggleActive: (row: StaffRow) => void
  onDelete: (row: StaffRow) => void
  onReleaseLockout: (row: StaffRow) => void
  unlockingStaffId: string | null
}) {
  return (
    <Card className="overflow-hidden p-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface-muted"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-ink-muted" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
        )}
        <span className="font-medium">{title}</span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">{rows.length} 人</span>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-surface-muted text-left text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">工號</th>
                <th className="px-4 py-2 font-medium">姓名</th>
                <th className="px-4 py-2 font-medium">國籍</th>
                <th className="px-4 py-2 font-medium" title="用於國籍與年齡分布報表，沒填的話不會計入年齡分布統計">
                  出生年月日
                </th>
                <th className="px-4 py-2 font-medium">到職日</th>
                <th className="px-4 py-2 font-medium">已合格階段</th>
                <th className="min-w-52 px-4 py-2 font-medium">考測狀況</th>
                <th className="px-4 py-2 font-medium">狀態</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-ink-muted">
                    這個機構還沒有學員
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className={row.is_active ? '' : 'text-ink-muted'}>
                  <td className="px-4 py-2">{row.account_code}</td>
                  <td className="px-4 py-2">{row.display_name}</td>
                  <td className="px-4 py-2">{LANG_LABELS[row.lang_code] ?? row.lang_code}</td>
                  <td className="px-4 py-2">
                    {row.birth_date ?? <span className="text-status-fail">未填</span>}
                  </td>
                  <td className="px-4 py-2">{row.hire_date}</td>
                  <td className="px-4 py-2">
                    {row.current_stage ? STAGE_LABELS[row.current_stage] : '尚未設定'}
                  </td>
                  <td className="px-4 py-2">
                    <ExamStatusCell status={row.exam_status} />
                  </td>
                  <td className="px-4 py-2">
                    {row.is_active ? <span className="text-status-pass">在職</span> : <span>已停用</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(row)}>
                        編輯
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onResetPassword(row)}>
                        重設密碼
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onToggleActive(row)}>
                        {row.is_active ? '停用' : '啟用'}
                      </Button>
                      {row.exam_status.state === 'locked' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={unlockingStaffId === row.id}
                          onClick={() => onReleaseLockout(row)}
                          title="提前解除 7 日管制；原失敗與違規紀錄仍會保留"
                        >
                          {unlockingStaffId === row.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <LockOpen className="size-4" aria-hidden />
                          )}
                          解除考試管制
                        </Button>
                      )}
                      {!row.is_active && (
                        <Button size="sm" variant="ghost" onClick={() => onDelete(row)}>
                          刪除
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function ExamStatusCell({ status }: { status: StaffExamStatus }) {
  const stage = status.stage_code ? STAGE_LABELS[status.stage_code] : null
  let label: string
  let labelClass = 'text-ink-muted'

  switch (status.state) {
    case 'inactive':
      label = '帳號已停用'
      break
    case 'all_completed':
      label = '全部階段已完成'
      labelClass = 'text-status-pass'
      break
    case 'no_exam':
      label = stage ? `${stage}尚無有效測驗` : '受訓資料不完整'
      break
    case 'not_due_yet':
      label = `尚未到期（${status.due_date ?? '日期未定'}）`
      break
    case 'in_progress':
      label = '作答中'
      labelClass = 'text-brand-700'
      break
    case 'pending_review':
      label = '已通過，待管理者核對'
      labelClass = 'text-status-warning'
      break
    case 'flagged':
      label = '存疑，待處理'
      labelClass = 'text-status-violation'
      break
    case 'locked':
      label = `考試管制至 ${formatDateTime(status.locked_until)}`
      labelClass = 'font-semibold text-status-fail'
      break
    case 'ready':
      label = status.latest_status === 'failed' ? '上次未通過，可重考' : '可開始測考'
      labelClass = status.latest_status === 'failed' ? 'text-status-warning' : 'text-status-pass'
      break
  }

  return (
    <div className="space-y-0.5">
      {stage && <div className="text-xs text-ink-muted">目前應考：{stage}</div>}
      <div className={labelClass}>{label}</div>
      {(status.state === 'ready' || status.state === 'in_progress') && status.attempts_left !== null && (
        <div className="text-xs text-ink-muted">本輪剩餘 {status.attempts_left} 次機會</div>
      )}
      {status.latest_status === 'failed' && status.state !== 'locked' && (
        <div className="text-xs text-ink-muted">
          最近結果：{status.latest_failed_by_violation ? '違規中止' : '未達及格分數'}
          {status.latest_score !== null ? `（${status.latest_score} 分）` : ''}
        </div>
      )}
    </div>
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
