import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { LangCode, QuestionInput, QuestionRow } from './api'

interface OptionDraft {
  text: string
  correct: boolean
}

export function QuestionFormModal({
  editing,
  examDefId,
  langCode,
  onSubmit,
  onClose,
}: {
  editing: QuestionRow | null
  examDefId: number
  langCode: LangCode
  onSubmit: (input: QuestionInput) => Promise<void>
  onClose: () => void
}) {
  const [qType, setQType] = useState<'single' | 'multiple'>(editing?.q_type ?? 'single')
  const [score, setScore] = useState(editing?.score ?? 4)
  const [text, setText] = useState(editing?.text ?? '')
  const [explanation, setExplanation] = useState(editing?.explanation ?? '')
  const [options, setOptions] = useState<OptionDraft[]>(
    editing
      ? editing.options.map((t, i) => ({ text: t, correct: editing.answer.includes(i) }))
      : [{ text: '', correct: false }, { text: '', correct: false }],
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  function toggleCorrect(index: number) {
    setOptions((prev) =>
      prev.map((o, i) =>
        i === index ? { ...o, correct: !o.correct } : qType === 'single' ? { ...o, correct: false } : o,
      ),
    )
  }

  function addOption() {
    setOptions((prev) => [...prev, { text: '', correct: false }])
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!text.trim()) {
      setError('題目內容為必填')
      return
    }
    const filled = options.filter((o) => o.text.trim())
    if (filled.length < 2) {
      setError('選項至少需要 2 個')
      return
    }
    const answer = options.reduce<number[]>((acc, o, i) => (o.text.trim() && o.correct ? [...acc, i] : acc), [])
    if (answer.length === 0) {
      setError('請至少勾選一個正確答案')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        id: editing?.id,
        exam_def_id: examDefId,
        lang_code: langCode,
        q_type: qType,
        score,
        text: text.trim(),
        options: options.map((o) => o.text.trim()).filter(Boolean),
        answer,
        explanation: explanation.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={editing ? '編輯題目' : '新增題目'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium">題型</span>
            <Select value={qType} onChange={(e) => setQType(e.target.value as 'single' | 'multiple')}>
              <option value="single">單選</option>
              <option value="multiple">複選</option>
            </Select>
          </label>
          <label className="w-28">
            <span className="mb-1 block text-sm font-medium">配分</span>
            <Input type="number" min={1} value={score} onChange={(e) => setScore(Number(e.target.value))} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">題目內容</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
          />
        </label>

        <div className="space-y-2">
          <span className="block text-sm font-medium">選項（勾選正確答案）</span>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type={qType === 'single' ? 'radio' : 'checkbox'}
                checked={option.correct}
                onChange={() => toggleCorrect(index)}
                aria-label={`第 ${index + 1} 個選項為正解`}
              />
              <Input
                value={option.text}
                onChange={(e) => updateOption(index, { text: e.target.value })}
                placeholder={`選項 ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeOption(index)}
                disabled={options.length <= 2}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="size-4" aria-hidden />
            新增選項
          </Button>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">解析（選填）</span>
          <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </label>

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
