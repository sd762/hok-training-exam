import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Institution, InstitutionCategory } from '@/features/institutions/api'
import { bulkImportStaff } from './api'
import { downloadStaffTemplate, parseStaffExcel, type ParseResult } from './excel'

export function StaffImportModal({
  categories,
  institutions,
  onDone,
  onClose,
}: {
  categories: InstitutionCategory[]
  institutions: Institution[]
  onDone: () => Promise<void>
  onClose: () => void
}) {
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<
    { account_code: string; status: string; message?: string }[] | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setResults(null)
    try {
      const result = await parseStaffExcel(file, categories, institutions)
      setParsed(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '檔案解析失敗')
    } finally {
      event.target.value = ''
    }
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const res = await bulkImportStaff(parsed.rows)
      setResults(res)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title="批次匯入學員" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">工號重複的資料會更新既有學員，不會重複建立。</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => downloadStaffTemplate(categories, institutions)}
          >
            下載範本
          </Button>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-brand-700"
        />

        {error && <p className="text-sm text-status-fail">{error}</p>}

        {parsed && !results && (
          <Card className="max-h-64 overflow-y-auto p-4 text-sm">
            <p className="font-medium">
              解析出 {parsed.rows.length} 筆可匯入資料
              {parsed.errors.length > 0 && `，${parsed.errors.length} 筆有問題`}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-status-fail">
                {parsed.errors.map((e) => (
                  <li key={e.rowNumber}>
                    第 {e.rowNumber} 列：{e.message}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {results && (
          <Card className="max-h-64 overflow-y-auto p-4 text-sm">
            <ul className="space-y-1">
              {results.map((r) => (
                <li
                  key={r.account_code}
                  className={
                    r.status === 'error'
                      ? 'text-status-fail'
                      : r.status === 'created'
                        ? 'text-status-pass'
                        : 'text-ink-muted'
                  }
                >
                  {r.account_code}：
                  {r.status === 'created' ? '已新增' : r.status === 'updated' ? '已更新' : r.message}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {results ? '關閉' : '取消'}
          </Button>
          {!results && (
            <Button
              type="button"
              onClick={handleImport}
              loading={importing}
              disabled={!parsed || parsed.rows.length === 0}
            >
              匯入 {parsed?.rows.length ?? 0} 筆
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
