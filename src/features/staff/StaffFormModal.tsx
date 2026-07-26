import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import { DEPARTMENT_OPTIONS, LANG_LABELS, STAGE_LABELS, type StaffFormInput, type StaffRow } from './api'

export function StaffFormModal({
  editing,
  categories,
  institutions,
  onSubmit,
  onClose,
}: {
  editing: StaffRow | null
  categories: InstitutionCategory[]
  institutions: Institution[]
  onSubmit: (input: StaffFormInput) => Promise<void>
  onClose: () => void
}) {
  const initialInstitution = institutions.find((i) => i.id === editing?.institution_id)
  const [categoryId, setCategoryId] = useState<number | ''>(initialInstitution?.category_id ?? '')
  const [form, setForm] = useState<StaffFormInput>({
    account_code: editing?.account_code ?? '',
    display_name: editing?.display_name ?? '',
    institution_id: editing?.institution_id ?? null,
    name_native: editing?.name_native ?? '',
    lang_code: editing?.lang_code ?? 'zh-TW',
    birth_date: editing?.birth_date ?? '',
    hire_date: editing?.hire_date ?? '',
    current_stage: editing?.current_stage ?? undefined,
    department: editing?.department ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableInstitutions = institutions.filter((i) => i.category_id === categoryId)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!form.account_code || !form.display_name || !form.hire_date) {
      setError('工號、姓名、到職日為必填')
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
    <Modal title={editing ? '編輯學員' : '新增學員'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="工號">
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

        <Field label="母語姓名（選填）">
          <Input
            value={form.name_native}
            onChange={(e) => setForm({ ...form, name_native: e.target.value })}
          />
        </Field>

        <Field label="國籍">
          <Select
            value={form.lang_code}
            onChange={(e) => setForm({ ...form, lang_code: e.target.value })}
          >
            {Object.entries(LANG_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="出生年月日（選填，用於年齡分布報表）">
          <Input
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
          />
        </Field>

        <Field label="到職日">
          <Input
            type="date"
            value={form.hire_date}
            onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
            required
          />
        </Field>

        <Field label="已合格階段">
          <Select
            value={form.current_stage ?? ''}
            onChange={(e) =>
              setForm({ ...form, current_stage: (e.target.value || undefined) as never })
            }
          >
            <option value="">尚未設定</option>
            {Object.entries(STAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

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

        <Field label="部門（選填）">
          <Select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          >
            <option value="">未指定</option>
            {DEPARTMENT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
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
