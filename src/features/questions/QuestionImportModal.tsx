import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { ExamDef, LangCode } from './api'
import { bulkCreateQuestions } from './api'
import { downloadQuestionTemplate, parseQuestionFile, toQuestionInputs, type ParseResult } from './excel'

export function QuestionImportModal({
  currentExam,
  langCode,
  onDone,
  onClose,
}: {
  currentExam: ExamDef
  langCode: LangCode
  onDone: () => Promise<void>
  onClose: () => void
}) {
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [results, setResults] = useState<{ index: number; error?: string }[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setResults(null)
    try {
      setParsed(await parseQuestionFile(file))
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
      const res = await bulkCreateQuestions(toQuestionInputs(parsed.rows, currentExam.id, langCode))
      setResults(res)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title={`匯入題庫 － ${currentExam.title}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-muted">此檔案將建立為新題目，與其他語言的題庫互不相關。</p>
          <Button type="button" size="sm" variant="outline" onClick={() => downloadQuestionTemplate(langCode)}>
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
          <Card className="max-h-56 overflow-y-auto p-4 text-sm">
            <p className="font-medium">
              解析出 {parsed.rows.length} 題{parsed.errors.length > 0 && `，${parsed.errors.length} 列有問題`}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-status-fail">
                {parsed.errors.map((e) => (
                  <li key={e.rowNumber}>第 {e.rowNumber} 列：{e.message}</li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {results && (
          <Card className="max-h-56 overflow-y-auto p-4 text-sm">
            <p>
              成功 {results.filter((r) => !r.error).length} 題，失敗 {results.filter((r) => r.error).length} 題
            </p>
            <ul className="mt-2 space-y-1 text-status-fail">
              {results
                .filter((r) => r.error)
                .map((r) => (
                  <li key={r.index}>第 {parsed!.rows[r.index].rowNumber} 列：{r.error}</li>
                ))}
            </ul>
          </Card>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {results ? '關閉' : '取消'}
          </Button>
          {!results && (
            <Button type="button" onClick={handleImport} loading={importing} disabled={!parsed || parsed.rows.length === 0}>
              匯入 {parsed?.rows.length ?? 0} 題
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
