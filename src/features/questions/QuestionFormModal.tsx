import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { QuestionInput, QuestionRow } from './api'

const LANG_TABS: { code: string; label: string; required: boolean }[] = [
  { code: 'zh-TW', label: '繁體中文', required: true },
  { code: 'vi', label: '越南文', required: false },
  { code: 'id', label: '印尼文', required: false },
]

interface OptionDraft {
  text: string
  correct: boolean
}

export function QuestionFormModal({
  editing,
  examDefId,
  onSubmit,
  onClose,
}: {
  editing: QuestionRow | null
  examDefId: number
  onSubmit: (input: QuestionInput) => Promise<void>
  onClose: () => void
}) {
  const [qType, setQType] = useState<'single' | 'multiple'>(editing?.q_type ?? 'single')
  const [score, setScore] = useState(editing?.score ?? 4)
  const [activeLang, setActiveLang] = useState('zh-TW')

  // 每個語言各自維護一份選項草稿；「正確與否」只在繁體中文（原始順序）上設定，
  // 其他語言的選項只是翻譯文字，位置必須跟繁體中文一一對應。
  const [optionsByLang, setOptionsByLang] = useState<Record<string, OptionDraft[]>>(() => {
    const init: Record<string, OptionDraft[]> = {}
    for (const { code } of LANG_TABS) {
      const t = editing?.translations[code]
      init[code] = t
        ? t.options.map((text, i) => ({ text, correct: editing!.answer.includes(i) }))
        : code === 'zh-TW'
          ? [{ text: '', correct: false }, { text: '', correct: false }]
          : []
    }
    return init
  })
  const [textByLang, setTextByLang] = useState<Record<string, string>>(() =>
    Object.fromEntries(LANG_TABS.map(({ code }) => [code, editing?.translations[code]?.text ?? ''])),
  )
  const [explanationByLang, setExplanationByLang] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      LANG_TABS.map(({ code }) => [code, editing?.translations[code]?.explanation ?? '']),
    ),
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const zhOptions = optionsByLang['zh-TW']

  function updateZhOption(index: number, patch: Partial<OptionDraft>) {
    setOptionsByLang((prev) => ({
      ...prev,
      'zh-TW': prev['zh-TW'].map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }))
    // 選項數量變動不影響其他語言（各語言選項數量可能因為還沒翻譯而暫時較少）
  }

  function toggleCorrect(index: number) {
    setOptionsByLang((prev) => ({
      ...prev,
      'zh-TW': prev['zh-TW'].map((o, i) =>
        i === index
          ? { ...o, correct: !o.correct }
          : qType === 'single'
            ? { ...o, correct: false } // 單選：選別的等於取消原本的
            : o,
      ),
    }))
  }

  function addOption() {
    setOptionsByLang((prev) => ({
      ...prev,
      'zh-TW': [...prev['zh-TW'], { text: '', correct: false }],
    }))
  }

  function removeOption(index: number) {
    setOptionsByLang((prev) => ({
      ...prev,
      'zh-TW': prev['zh-TW'].filter((_, i) => i !== index),
    }))
  }

  function updateLangOption(lang: string, index: number, text: string) {
    setOptionsByLang((prev) => {
      const list = [...(prev[lang] ?? [])]
      while (list.length <= index) list.push({ text: '', correct: false })
      list[index] = { ...list[index], text }
      return { ...prev, [lang]: list }
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!textByLang['zh-TW'].trim()) {
      setError('繁體中文題目為必填')
      return
    }
    const filledZh = zhOptions.filter((o) => o.text.trim())
    if (filledZh.length < 2) {
      setError('繁體中文選項至少需要 2 個')
      return
    }
    const answer = zhOptions.reduce<number[]>((acc, o, i) => (o.text.trim() && o.correct ? [...acc, i] : acc), [])
    if (answer.length === 0) {
      setError('請至少勾選一個正確答案')
      return
    }

    const translations: QuestionInput['translations'] = {}
    for (const { code } of LANG_TABS) {
      const text = textByLang[code].trim()
      if (!text) continue
      const options = zhOptions.map((_, i) => (optionsByLang[code]?.[i]?.text ?? '').trim())
      translations[code] = { text, options, explanation: explanationByLang[code].trim() || undefined }
    }

    setSubmitting(true)
    try {
      await onSubmit({
        id: editing?.id,
        exam_def_id: examDefId,
        q_type: qType,
        score,
        answer,
        translations,
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

        <div className="flex gap-1 border-b border-line">
          {LANG_TABS.map(({ code, label, required }) => (
            <button
              key={code}
              type="button"
              onClick={() => setActiveLang(code)}
              className={cn(
                'px-3 py-2 text-sm',
                activeLang === code
                  ? 'border-b-2 border-brand-600 font-medium text-brand-600'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {label}
              {required && ' *'}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            題目內容{activeLang === 'zh-TW' && '（必填）'}
          </span>
          <textarea
            value={textByLang[activeLang]}
            onChange={(e) => setTextByLang({ ...textByLang, [activeLang]: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200"
          />
        </label>

        <div className="space-y-2">
          <span className="block text-sm font-medium">
            選項{activeLang === 'zh-TW' ? '（正確答案的位置以繁體中文為準）' : '（順序需對應繁體中文）'}
          </span>
          {zhOptions.map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              {activeLang === 'zh-TW' ? (
                <>
                  <input
                    type={qType === 'single' ? 'radio' : 'checkbox'}
                    checked={zhOptions[index].correct}
                    onChange={() => toggleCorrect(index)}
                    aria-label={`第 ${index + 1} 個選項為正解`}
                  />
                  <Input
                    value={zhOptions[index].text}
                    onChange={(e) => updateZhOption(index, { text: e.target.value })}
                    placeholder={`選項 ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(index)}
                    disabled={zhOptions.length <= 2}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </>
              ) : (
                <Input
                  value={optionsByLang[activeLang]?.[index]?.text ?? ''}
                  onChange={(e) => updateLangOption(activeLang, index, e.target.value)}
                  placeholder={`對應第 ${index + 1} 個選項的翻譯`}
                />
              )}
            </div>
          ))}
          {activeLang === 'zh-TW' && (
            <Button type="button" variant="outline" size="sm" onClick={addOption}>
              <Plus className="size-4" aria-hidden />
              新增選項
            </Button>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">解析（選填）</span>
          <Input
            value={explanationByLang[activeLang]}
            onChange={(e) => setExplanationByLang({ ...explanationByLang, [activeLang]: e.target.value })}
          />
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
