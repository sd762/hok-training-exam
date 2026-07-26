import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/auth/useAuth'
import { fetchCategories, fetchInstitutions } from '@/features/institutions/api'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import { ROLE_LABELS, type UserRole } from '@/lib/roles'
import {
  createOrUpdateAdmin,
  deleteAdmin,
  fetchAdmins,
  resetAdminPassword,
  setAdminActive,
  type AdminRow,
  type ManagedRole,
} from './api'
import { AdminFormModal } from './AdminFormModal'

const GLOBAL_ROLES: ManagedRole[] = ['super_admin', 'platform_admin', 'viewer_admin']

export default function AdminsPage() {
  const { profile } = useAuth()
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [categories, setCategories] = useState<InstitutionCategory[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminRow | 'new' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isSuperAdmin = profile?.role === 'super_admin'
  // 平台管理者只能建立/修改機構管理者；系統管理者四種角色都能指派（呼應 admin-users Edge Function 的權限檢查）
  const assignableRoles: ManagedRole[] = isSuperAdmin
    ? ['super_admin', 'platform_admin', 'viewer_admin', 'institution_manager']
    : ['institution_manager']

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [adminRows, cats, insts] = await Promise.all([
        fetchAdmins(),
        fetchCategories(),
        fetchInstitutions(),
      ])
      setAdmins(adminRows)
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

  // 平台管理者不能動系統管理者/平台管理者/管理者這三種全域角色的帳號，只能動機構管理者——
  // 跟後端 admin-users 的 canManageTargetRole 對齊，避免點了按鈕才發現被 403 擋下
  function canManage(row: AdminRow): boolean {
    if (isSuperAdmin) return true
    return !GLOBAL_ROLES.includes(row.role)
  }

  async function handleToggleActive(row: AdminRow) {
    try {
      await setAdminActive(row.id, !row.is_active)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '狀態切換失敗')
    }
  }

  async function handleDelete(row: AdminRow) {
    if (!confirm(`確定要刪除帳號「${row.display_name}」（${row.account_code}）嗎？此動作無法復原。`)) return
    try {
      await deleteAdmin(row.account_code)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除失敗')
    }
  }

  async function handleResetPassword(row: AdminRow) {
    try {
      const result = await resetAdminPassword(row.account_code)
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
          <h1 className="text-xl font-semibold">管理者帳號</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isSuperAdmin
              ? '系統管理者可以建立/編輯系統管理者、平台管理者、管理者、機構管理者這四種帳號。'
              : '平台管理者只能建立/編輯機構管理者帳號；其他三種全域角色帳號只有系統管理者能異動。'}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden />
          新增管理者帳號
        </Button>
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
              <th className="px-4 py-2 font-medium">帳號代碼</th>
              <th className="px-4 py-2 font-medium">姓名</th>
              <th className="px-4 py-2 font-medium">角色</th>
              <th className="px-4 py-2 font-medium">機構</th>
              <th className="px-4 py-2 font-medium">狀態</th>
              <th className="px-4 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {admins.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                  尚無管理者帳號
                </td>
              </tr>
            )}
            {admins.map((row) => {
              const editable = canManage(row)
              return (
                <tr key={row.id} className={row.is_active ? '' : 'text-ink-muted'}>
                  <td className="px-4 py-2">{row.account_code}</td>
                  <td className="px-4 py-2">{row.display_name}</td>
                  <td className="px-4 py-2">{ROLE_LABELS[row.role as UserRole]}</td>
                  <td className="px-4 py-2">{row.institution_name ?? '-'}</td>
                  <td className="px-4 py-2">
                    {row.is_active ? <span className="text-status-pass">在職</span> : <span>已停用</span>}
                  </td>
                  <td className="px-4 py-2">
                    {editable ? (
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
                    ) : (
                      <span className="text-xs text-ink-muted">僅系統管理者可異動</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {editing && (
        <AdminFormModal
          editing={editing === 'new' ? null : editing}
          assignableRoles={assignableRoles}
          categories={categories}
          institutions={institutions}
          onSubmit={async (input) => {
            const result = await createOrUpdateAdmin(input)
            if (result.created && result.password) {
              setNotice(`${input.display_name}（${input.account_code}）已建立，預設密碼：${result.password}，請提醒對方登入後盡快修改`)
            }
            await reload()
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
