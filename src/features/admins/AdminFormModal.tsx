import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import { ROLE_LABELS, type UserRole } from '@/lib/roles'
import type { AdminFormInput, AdminRow, ManagedRole } from './api'

export function AdminFormModal({
  editing,
  assignableRoles,
  categories,
  institutions,
  onSubmit,
  onClose,
}: {
  editing: AdminRow | null
  /** 目前登入者能指派的角色——平台管理者只能指派機構管理者，系統管理者四種都能指派 */
  assignableRoles: ManagedRole[]
  categories: InstitutionCategory[]
  institutions: Institution[]
  onSubmit: (input: AdminFormInput) => Promise<void>
  onClose: () => void
}) {
  const initialInstitution = institutions.find((i) => i.id === editing?.institution_id)
  const [categoryId, setCategoryId] = useState<number | ''>(initialInstitution?.category_id ?? '')
  const [form, setForm] = useState<AdminFormInput>({
    account_code: editing?.account_code ?? '',
    display_name: editing?.display_name ?? '',
    role: editing?.role ?? assignableRoles[0],
    institution_id: editing?.institution_id ?? null,
    contact_email: editing?.contact_email ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableInstitutions = institutions.filter((i) => i.category_id === categoryId)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!form.account_code || !form.display_name) {
      setError('帳號代碼、姓名為必填')
      return
    }
    if (form.role === 'institution_manager' && !form.institution_id) {
      setError('機構管理者必須指定所屬機構')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(form)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={editing ? '編輯管理者帳號' : '新增管理者帳號'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="帳號代碼">
          <Input
            value={form.account_code}
            onChange={(e) => setForm({ ...form, account_code: e.target.value })}
            disabled={!!editing}
            required
          />
        </Field>

        <Field label="姓名">
          <Input
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            required
          />
        </Field>

        <Field label="角色">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as ManagedRole, institution_id: null })}
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r as UserRole]}
              </option>
            ))}
          </Select>
        </Field>

        {form.role === 'institution_manager' && (
          <>
            <Field label="機構類別">
              <Select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value ? Number(e.target.value) : '')
                  setForm({ ...form, institution_id: null })
                }}
              >
                <option value="">未指定</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="機構名稱">
              <Select
                value={form.institution_id ?? ''}
                onChange={(e) =>
                  setForm({ ...form, institution_id: e.target.value ? Number(e.target.value) : null })
                }
                disabled={!categoryId}
              >
                <option value="">未指定</option>
                {availableInstitutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}

        <Field label="聯絡信箱（選填，通知用，不是登入帳號）">
          <Input
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
        </Field>

        {error && <p className="text-sm text-status-fail">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={submitting}>
            儲存
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}
