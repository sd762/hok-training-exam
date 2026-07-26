import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { fetchCategories, fetchInstitutions } from '@/features/institutions/api'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import {
  createOrUpdateStaff,
  deleteStaff,
  fetchStaff,
  LANG_LABELS,
  resetStaffPassword,
  setStaffActive,
  STAGE_LABELS,
  type StaffRow,
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

  // 依機構分資料夾：機構管理者要在幾十位學員裡找人時，先展開自己負責的機構就好，不用整張表滑來滑去
  const staffByInstitution = useMemo(() => {
    const map = new Map<number | 'none', StaffRow[]>()
    for (const row of staff) {
      const key = row.institution_id ?? 'none'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [staff])

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
            在職學員只能停用不能刪除；已停用者可以刪除。點機構名稱展開/收合底下的學員名單。
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

      <div className="space-y-6">
        {categories.map((category) => {
          const insts = institutionsByCategory.get(category.id) ?? []
          if (insts.length === 0) return null
          return (
            <div key={category.id}>
              <h2 className="mb-2 text-sm font-semibold text-ink-muted">{category.name}</h2>
              <div className="space-y-2">
                {insts.map((inst) => (
                  <InstitutionFolder
                    key={inst.id}
                    title={inst.name}
                    rows={staffByInstitution.get(inst.id) ?? []}
                    open={openInstitutions.has(inst.id)}
                    onToggle={() => toggleInstitution(inst.id)}
                    onEdit={setEditing}
                    onResetPassword={handleResetPassword}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
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
              open={openInstitutions.has('none')}
              onToggle={() => toggleInstitution('none')}
              onEdit={setEditing}
              onResetPassword={handleResetPassword}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
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
            await createOrUpdateStaff(input)
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
}: {
  title: string
  rows: StaffRow[]
  open: boolean
  onToggle: () => void
  onEdit: (row: StaffRow) => void
  onResetPassword: (row: StaffRow) => void
  onToggleActive: (row: StaffRow) => void
  onDelete: (row: StaffRow) => void
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
                <th className="px-4 py-2 font-medium">到職日</th>
                <th className="px-4 py-2 font-medium">已合格階段</th>
                <th className="px-4 py-2 font-medium">狀態</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-muted">
                    這個機構還沒有學員
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className={row.is_active ? '' : 'text-ink-muted'}>
                  <td className="px-4 py-2">{row.account_code}</td>
                  <td className="px-4 py-2">{row.display_name}</td>
                  <td className="px-4 py-2">{LANG_LABELS[row.lang_code] ?? row.lang_code}</td>
                  <td className="px-4 py-2">{row.hire_date}</td>
                  <td className="px-4 py-2">
                    {row.current_stage ? STAGE_LABELS[row.current_stage] : '尚未設定'}
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
