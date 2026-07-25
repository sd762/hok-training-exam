import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import {
  createCategory,
  createInstitution,
  fetchCategories,
  fetchInstitutions,
  renameInstitution,
  setInstitutionActive,
  type Institution,
  type InstitutionCategory,
} from './api'

export default function InstitutionsPage() {
  const [categories, setCategories] = useState<InstitutionCategory[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')

  const reload = useCallback(async () => {
    setError(null)
    try {
      const [cats, insts] = await Promise.all([fetchCategories(), fetchInstitutions()])
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

  const byCategory = useMemo(() => {
    const map = new Map<number, Institution[]>()
    for (const inst of institutions) {
      const list = map.get(inst.category_id) ?? []
      list.push(inst)
      map.set(inst.category_id, list)
    }
    return map
  }, [institutions])

  async function handleAddCategory(event: React.FormEvent) {
    event.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    try {
      await createCategory(name)
      setNewCategory('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增機構類別失敗')
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
      <div>
        <h1 className="text-xl font-semibold">機構管理</h1>
        <p className="mt-1 text-sm text-ink-muted">
          維護機構類別與其底下的機構名稱。停用的機構不會出現在指派學員的選單中，但既有資料仍會保留。
        </p>
      </div>

      {error && (
        <Card className="border-status-fail/30 bg-status-fail/5 p-4 text-sm text-status-fail">
          {error}
        </Card>
      )}

      {categories.map((category) => (
        <CategorySection
          key={category.id}
          category={category}
          institutions={byCategory.get(category.id) ?? []}
          onChanged={reload}
          onError={setError}
        />
      ))}

      <Card className="p-5">
        <h2 className="text-sm font-medium text-ink-muted">新增機構類別</h2>
        <form onSubmit={handleAddCategory} className="mt-3 flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="例如：養護機構"
            className="max-w-xs"
          />
          <Button type="submit" size="sm" disabled={!newCategory.trim()}>
            <Plus className="size-4" aria-hidden />
            新增類別
          </Button>
        </form>
      </Card>
    </div>
  )
}

function CategorySection({
  category,
  institutions,
  onChanged,
  onError,
}: {
  category: InstitutionCategory
  institutions: Institution[]
  onChanged: () => Promise<void>
  onError: (message: string) => void
}) {
  const [newName, setNewName] = useState('')

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await createInstitution(category.id, name)
      setNewName('')
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : '新增機構失敗')
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-medium">{category.name}</h2>

      <ul className="mt-3 divide-y divide-line">
        {institutions.length === 0 && (
          <li className="py-2 text-sm text-ink-muted">尚無機構</li>
        )}
        {institutions.map((inst) => (
          <InstitutionRow
            key={inst.id}
            institution={inst}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
      </ul>

      <form onSubmit={handleAdd} className="mt-4 flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`新增「${category.name}」底下的機構`}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={!newName.trim()}>
          <Plus className="size-4" aria-hidden />
          新增機構
        </Button>
      </form>
    </Card>
  )
}

function InstitutionRow({
  institution,
  onChanged,
  onError,
}: {
  institution: Institution
  onChanged: () => Promise<void>
  onError: (message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(institution.name)
  const [busy, setBusy] = useState(false)

  async function handleRename() {
    const next = name.trim()
    if (!next || next === institution.name) {
      setEditing(false)
      setName(institution.name)
      return
    }
    setBusy(true)
    try {
      await renameInstitution(institution.id, next)
      setEditing(false)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : '更名失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleActive() {
    setBusy(true)
    try {
      await setInstitutionActive(institution.id, !institution.is_active)
      await onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : '狀態切換失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 py-2">
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs py-1.5"
            autoFocus
          />
          <Button size="sm" onClick={handleRename} loading={busy}>
            儲存
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setName(institution.name)
            }}
          >
            取消
          </Button>
        </>
      ) : (
        <>
          <span className={institution.is_active ? '' : 'text-ink-muted line-through'}>
            {institution.name}
          </span>
          {!institution.is_active && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
              已停用
            </span>
          )}
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              更名
            </Button>
            <Button size="sm" variant="ghost" onClick={handleToggleActive} loading={busy}>
              {institution.is_active ? '停用' : '啟用'}
            </Button>
          </div>
        </>
      )}
    </li>
  )
}
