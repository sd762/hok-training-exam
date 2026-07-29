import { useEffect, useState } from 'react'
import { ImageOff, Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import {
  AUDIO_QUESTION_LANGS,
  fetchUsedAudioPaths,
  fetchUsedImagePaths,
  getAudioPreviewUrl,
  getImagePreviewUrl,
  uploadQuestionAudio,
  uploadQuestionImage,
  type LangCode,
  type QuestionInput,
  type QuestionRow,
} from './api'

interface OptionDraft {
  text: string
  correct: boolean
  imagePath: string | null
  newImageFile: File | null
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
      ? editing.options.map((t, i) => ({
          text: t,
          correct: editing.answer.includes(i),
          imagePath: editing.option_images?.[i] ?? null,
          newImageFile: null,
        }))
      : [
          { text: '', correct: false, imagePath: null, newImageFile: null },
          { text: '', correct: false, imagePath: null, newImageFile: null },
        ],
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 音訊題（僅越南文/印尼文考）：可以選一個既有音檔重複使用，或上傳新檔案
  const supportsAudio = AUDIO_QUESTION_LANGS.includes(langCode)
  const [usedAudioPaths, setUsedAudioPaths] = useState<string[]>([])
  const [audioPath, setAudioPath] = useState<string | null>(editing?.audio_path ?? null)
  const [newAudioFile, setNewAudioFile] = useState<File | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [audioPreviewLoading, setAudioPreviewLoading] = useState(false)

  // 題目配圖（三語言都能用）
  const [usedImagePaths, setUsedImagePaths] = useState<string[]>([])
  const [imagePath, setImagePath] = useState<string | null>(editing?.image_path ?? null)
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!supportsAudio) return
    fetchUsedAudioPaths(examDefId).then(setUsedAudioPaths).catch(() => {})
  }, [supportsAudio, examDefId])

  useEffect(() => {
    fetchUsedImagePaths(examDefId).then(setUsedImagePaths).catch(() => {})
  }, [examDefId])

  async function handleAudioPreview() {
    if (newAudioFile) {
      setAudioPreviewUrl(URL.createObjectURL(newAudioFile))
      return
    }
    if (!audioPath) return
    setAudioPreviewLoading(true)
    try {
      setAudioPreviewUrl(await getAudioPreviewUrl(audioPath))
    } catch {
      setError('音檔預覽失敗')
    } finally {
      setAudioPreviewLoading(false)
    }
  }

  /** 圖片路徑跟簽名網址的對照表用同一個 state 快取，避免同一張圖重複發簽名網址請求 */
  async function resolveImagePreview(path: string) {
    if (imagePreviewUrls[path]) return
    try {
      const url = await getImagePreviewUrl(path)
      setImagePreviewUrls((prev) => ({ ...prev, [path]: url }))
    } catch {
      /* 預覽失敗就不顯示縮圖，不擋填表 */
    }
  }

  useEffect(() => {
    if (imagePath) void resolveImagePreview(imagePath)
    for (const o of options) if (o.imagePath) void resolveImagePreview(o.imagePath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePath, options.map((o) => o.imagePath).join(',')])

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
    setOptions((prev) => [...prev, { text: '', correct: false, imagePath: null, newImageFile: null }])
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
      let finalAudioPath = audioPath
      if (newAudioFile) {
        finalAudioPath = await uploadQuestionAudio(examDefId, newAudioFile)
      }
      let finalImagePath = imagePath
      if (newImageFile) {
        finalImagePath = await uploadQuestionImage(examDefId, newImageFile)
      }
      const finalOptionImages = await Promise.all(
        options
          .filter((o) => o.text.trim())
          .map(async (o) => (o.newImageFile ? await uploadQuestionImage(examDefId, o.newImageFile) : o.imagePath)),
      )
      const hasAnyOptionImage = finalOptionImages.some(Boolean)

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
        audio_path: finalAudioPath,
        image_path: finalImagePath,
        option_images: hasAnyOptionImage ? finalOptionImages : null,
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

        {supportsAudio && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <span className="block text-sm font-medium">音訊（選填——播放情境音效，問情境是什麼）</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={newAudioFile ? '' : (audioPath ?? '')}
                onChange={(e) => {
                  setAudioPath(e.target.value || null)
                  setNewAudioFile(null)
                  setAudioPreviewUrl(null)
                }}
                className="max-w-xs"
              >
                <option value="">不使用音訊 / 選擇已上傳的音檔</option>
                {usedAudioPaths.map((p) => (
                  <option key={p} value={p}>
                    {p.split('/').pop()}
                  </option>
                ))}
              </Select>
              <span className="text-xs text-ink-muted">或</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setNewAudioFile(file)
                  if (file) setAudioPath(null)
                  setAudioPreviewUrl(null)
                }}
                className="text-xs text-ink-muted file:mr-2 file:rounded-lg file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-xs"
              />
            </div>
            {(audioPath || newAudioFile) && (
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleAudioPreview} loading={audioPreviewLoading}>
                  預覽播放
                </Button>
                {audioPreviewUrl && <audio controls src={audioPreviewUrl} className="h-8" />}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-line p-3">
          <span className="block text-sm font-medium">題目配圖（選填——看圖回答下面的文字選項）</span>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={newImageFile ? '' : (imagePath ?? '')}
              onChange={(e) => {
                setImagePath(e.target.value || null)
                setNewImageFile(null)
              }}
              className="max-w-xs"
            >
              <option value="">不配圖 / 選擇已上傳的圖片</option>
              {usedImagePaths.map((p) => (
                <option key={p} value={p}>
                  {p.split('/').pop()}
                </option>
              ))}
            </Select>
            <span className="text-xs text-ink-muted">或</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setNewImageFile(file)
                if (file) setImagePath(null)
              }}
              className="text-xs text-ink-muted file:mr-2 file:rounded-lg file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-xs"
            />
          </div>
          <ImageThumb file={newImageFile} url={imagePath ? imagePreviewUrls[imagePath] : undefined} />
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
          <span className="block text-sm font-medium">
            選項（勾選正確答案；每個選項可以另外配一張圖片，用在「選項本身是圖片」的題目）
          </span>
          {options.map((option, index) => (
            <div key={index} className="space-y-1.5 rounded-lg border border-line p-2">
              <div className="flex items-center gap-2">
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
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <Select
                  value={option.newImageFile ? '' : (option.imagePath ?? '')}
                  onChange={(e) =>
                    updateOption(index, { imagePath: e.target.value || null, newImageFile: null })
                  }
                  className="max-w-[220px] py-1 text-xs"
                >
                  <option value="">此選項不配圖 / 選擇已上傳的圖片</option>
                  {usedImagePaths.map((p) => (
                    <option key={p} value={p}>
                      {p.split('/').pop()}
                    </option>
                  ))}
                </Select>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    updateOption(index, { newImageFile: file, imagePath: file ? null : option.imagePath })
                  }}
                  className="text-xs text-ink-muted file:mr-2 file:rounded-lg file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-xs"
                />
                <ImageThumb
                  file={option.newImageFile}
                  url={option.imagePath ? imagePreviewUrls[option.imagePath] : undefined}
                  small
                />
              </div>
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

/** 圖片縮圖：新選的檔案用 blob 網址立即預覽，已存在的圖片用簽名網址（載入前顯示灰底圖示） */
function ImageThumb({ file, url, small }: { file: File | null; url: string | undefined; small?: boolean }) {
  if (!file && !url) return null
  const src = file ? URL.createObjectURL(file) : url
  const size = small ? 'size-10' : 'size-16'
  if (!src) {
    return (
      <div className={`${size} flex items-center justify-center rounded border border-line bg-surface-muted`}>
        <ImageOff className="size-4 text-ink-muted" aria-hidden />
      </div>
    )
  }
  return <img src={src} alt="預覽" className={`${size} rounded border border-line object-cover`} />
}
