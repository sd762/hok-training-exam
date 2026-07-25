import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import type { ExamDef, QuestionRow } from './api'
import { bulkCreateQuestions, bulkImportTranslations, fetchQuestions } from './api'
import {
  downloadQuestionTemplate,
  downloadTranslationTemplate,
  parseQuestionExcel,
  parseTranslationExcel,
  type ParsedQuestion,
  type ParsedTranslation,
} from './excel'

type Mode = 'create' | 'translate'

export function QuestionImportModal({
  examDefs,
  currentExam,
  onDone,
  onClose,
}: {
  examDefs: ExamDef[]
  currentExam: ExamDef
  onDone: () => Promise<void>
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>('create')
  const [langCode, setLangCode] = useState<'vi' | 'id'>('vi')

  return (
    <Modal title="題庫匯入" onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-line">
        <ModeTab active={mode === 'create'} onClick={() => setMode('create')}>
          批次建立中文題目
        </ModeTab>
        <ModeTab active={mode === 'translate'} onClick={() => setMode('translate')}>
          補充翻譯
        </ModeTab>
      </div>

      {mode === 'create' ? (
        <CreateImportPanel examDefs={examDefs} onDone={onDone} onClose={onClose} />
      ) : (
        <TranslateImportPanel
          currentExam={currentExam}
          langCode={langCode}
          setLangCode={setLangCode}
          onDone={onDone}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'border-b-2 border-brand-600 px-3 py-2 text-sm font-medium text-brand-600'
          : 'px-3 py-2 text-sm text-ink-muted hover:text-ink'
      }
    >
      {children}
    </button>
  )
}

function CreateImportPanel({
  examDefs,
  onDone,
  onClose,
}: {
  examDefs: ExamDef[]
  onDone: () => Promise<void>
  onClose: () => void
}) {
  const [parsed, setParsed] = useState<{ rows: ParsedQuestion[]; errors: { rowNumber: number; message: string }[] } | null>(null)
  const [results, setResults] = useState<{ index: number; error?: string }[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setResults(null)
    try {
      setParsed(await parseQuestionExcel(file, examDefs))
    } catch (err) {
      setError(err instanceof Error ? err.message : '檔案解析失敗')
    } finally {
      event.target.value = ''
    }
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return
    setImporting(true)
    try {
      const inputs = parsed.rows.map((r) => ({
        exam_def_id: r.examDefId,
        q_type: r.q_type,
        score: r.score,
        answer: r.answer,
        translations: r.translations,
      }))
      const res = await bulkCreateQuestions(inputs)
      setResults(res)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">依「受訓階段」欄位自動分配到對應考科，不限單一階段。</p>
        <Button type="button" size="sm" variant="outline" onClick={downloadQuestionTemplate}>
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
            解析出 {parsed.rows.length} 題可匯入{parsed.errors.length > 0 && `，${parsed.errors.length} 列有問題`}
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
          <ul className="mt-2 space-y-1">
            {results
              .filter((r) => r.error)
              .map((r) => (
                <li key={r.index} className="text-status-fail">
                  第 {parsed!.rows[r.index].rowNumber} 列：{r.error}
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
          <Button type="button" onClick={handleImport} loading={importing} disabled={!parsed || parsed.rows.length === 0}>
            匯入 {parsed?.rows.length ?? 0} 題
          </Button>
        )}
      </div>
    </div>
  )
}

function TranslateImportPanel({
  currentExam,
  langCode,
  setLangCode,
  onDone,
  onClose,
}: {
  currentExam: ExamDef
  langCode: 'vi' | 'id'
  setLangCode: (code: 'vi' | 'id') => void
  onDone: () => Promise<void>
  onClose: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [parsed, setParsed] = useState<{ rows: ParsedTranslation[]; errors: { rowNumber: number; message: string }[] } | null>(null)
  const [results, setResults] = useState<{ index: number; error?: string }[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownloadTemplate() {
    setDownloading(true)
    setError(null)
    try {
      const questions: QuestionRow[] = await fetchQuestions(currentExam.id)
      downloadTranslationTemplate(currentExam.title, langCode, questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : '下載範本失敗')
    } finally {
      setDownloading(false)
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setResults(null)
    try {
      setParsed(await parseTranslationExcel(file, langCode))
    } catch (err) {
      setError(err instanceof Error ? err.message : '檔案解析失敗')
    } finally {
      event.target.value = ''
    }
  }

  async function handleImport() {
    if (!parsed || parsed.rows.length === 0) return
    setImporting(true)
    try {
      const res = await bulkImportTranslations(
        parsed.rows.map((r) => ({
          questionId: r.questionId,
          text: r.text,
          options: r.options,
          explanation: r.explanation,
          lang_code: langCode,
        })),
      )
      setResults(res)
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        套用於目前選取的考科「{currentExam.title}」。範本會帶入現有中文題目供對照，未翻譯的列留空即可，不會被視為錯誤。
      </p>

      <div className="flex items-center gap-2">
        <Select value={langCode} onChange={(e) => setLangCode(e.target.value as 'vi' | 'id')} className="max-w-40">
          <option value="vi">越南文</option>
          <option value="id">印尼文</option>
        </Select>
        <Button type="button" size="sm" variant="outline" onClick={handleDownloadTemplate} loading={downloading}>
          下載翻譯範本
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
            解析出 {parsed.rows.length} 筆翻譯{parsed.errors.length > 0 && `，${parsed.errors.length} 列有問題`}
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
            成功 {results.filter((r) => !r.error).length} 筆，失敗 {results.filter((r) => r.error).length} 筆
          </p>
        </Card>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {results ? '關閉' : '取消'}
        </Button>
        {!results && (
          <Button type="button" onClick={handleImport} loading={importing} disabled={!parsed || parsed.rows.length === 0}>
            匯入 {parsed?.rows.length ?? 0} 筆翻譯
          </Button>
        )}
      </div>
    </div>
  )
}
