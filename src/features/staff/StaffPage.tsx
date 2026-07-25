import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Upload } from 'lucide-react'
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">學員管理</h1>
          <p className="mt-1 text-sm text-ink-muted">
            在職學員只能停用不能刪除；已停用者可以刪除。
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

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-surface-muted text-left text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-medium">工號</th>
              <th className="px-4 py-2 font-medium">姓名</th>
              <th className="px-4 py-2 font-medium">國籍</th>
              <th className="px-4 py-2 font-medium">到職日</th>
              <th className="px-4 py-2 font-medium">已合格階段</th>
              <th className="px-4 py-2 font-medium">機構</th>
              <th className="px-4 py-2 font-medium">狀態</th>
              <th className="px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {staff.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-ink-muted">
                  尚無學員資料
                </td>
              </tr>
            )}
            {staff.map((row) => (
              <tr key={row.id} className={row.is_active ? '' : 'text-ink-muted'}>
                <td className="px-4 py-2">{row.account_code}</td>
                <td className="px-4 py-2">{row.display_name}</td>
                <td className="px-4 py-2">{LANG_LABELS[row.lang_code] ?? row.lang_code}</td>
                <td className="px-4 py-2">{row.hire_date}</td>
                <td className="px-4 py-2">
                  {row.current_stage ? STAGE_LABELS[row.current_stage] : '尚未設定'}
                </td>
                <td className="px-4 py-2">{row.institution_name ?? '-'}</td>
                <td className="px-4 py-2">
                  {row.is_active ? (
                    <span className="text-status-pass">在職</span>
                  ) : (
                    <span>已停用</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                      編輯
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleResetPassword(row)}>
                      重設密碼
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleToggleActive(row)}>
                      {row.is_active ? '停用' : '啟用'}
                    </Button>
                    {!row.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(row)}>
                        刪除
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

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
