/**
 * 學員端多語言介面（繁體中文／越南文／印尼文），涵蓋整個測驗流程的按鈕、
 * 訊息與結果頁文字。越南文/印尼文為初版機器輔助翻譯，正式上線前建議
 * 請母語人士審閱用詞（尤其是「鎖定」「審核」這類制度性詞彙）。
 */

export type LangCode = 'zh-TW' | 'vi' | 'id'

const dict = {
  loading: { 'zh-TW': '載入中…', vi: 'Đang tải…', id: 'Memuat…' },
  back_home: { 'zh-TW': '返回首頁', vi: 'Về trang chủ', id: 'Kembali ke beranda' },
  logout: { 'zh-TW': '登出', vi: 'Đăng xuất', id: 'Keluar' },

  exam_reminder_title: { 'zh-TW': '應考提醒', vi: 'Nhắc nhở thi', id: 'Pengingat Ujian' },
  exam_due_message: {
    'zh-TW': '您需要參加「{title}」',
    vi: 'Bạn cần tham gia "{title}"',
    id: 'Anda perlu mengikuti "{title}"',
  },
  exam_start_button: { 'zh-TW': '開始測驗', vi: 'Bắt đầu thi', id: 'Mulai Ujian' },
  exam_resume_button: { 'zh-TW': '繼續作答', vi: 'Tiếp tục làm bài', id: 'Lanjutkan Ujian' },
  exam_attempts_left: {
    'zh-TW': '本輪剩餘作答次數：{n}',
    vi: 'Số lần làm bài còn lại: {n}',
    id: 'Sisa kesempatan ujian: {n}',
  },
  exam_none_due: { 'zh-TW': '目前沒有應考義務', vi: 'Hiện tại không có bài thi nào', id: 'Saat ini tidak ada ujian yang harus diikuti' },
  exam_all_completed: {
    'zh-TW': '您已完成所有階段的測驗',
    vi: 'Bạn đã hoàn thành tất cả các giai đoạn thi',
    id: 'Anda telah menyelesaikan semua tahap ujian',
  },
  exam_pending_review: {
    'zh-TW': '您的測驗成績正在審核中，請耐心等候',
    vi: 'Kết quả thi của bạn đang được xem xét, vui lòng chờ',
    id: 'Hasil ujian Anda sedang ditinjau, mohon tunggu',
  },
  exam_flagged: {
    'zh-TW': '您的測驗結果需要進一步確認，請聯繫管理者',
    vi: 'Kết quả thi của bạn cần được xác minh thêm, vui lòng liên hệ quản trị viên',
    id: 'Hasil ujian Anda memerlukan verifikasi lebih lanjut, silakan hubungi admin',
  },
  exam_not_due_yet: {
    'zh-TW': '尚未到應考時間，將於 {date} 後開放',
    vi: 'Chưa đến thời gian thi, sẽ mở sau ngày {date}',
    id: 'Belum waktunya ujian, akan dibuka setelah {date}',
  },
  exam_locked: {
    'zh-TW': '已鎖定，將於 {date} 後解鎖',
    vi: 'Đã bị khóa, sẽ mở khóa sau {date}',
    id: 'Terkunci, akan dibuka setelah {date}',
  },

  question_progress: { 'zh-TW': '第 {current} / {total} 題', vi: 'Câu {current} / {total}', id: 'Soal {current} / {total}' },
  submit_button: { 'zh-TW': '送出測驗', vi: 'Nộp bài', id: 'Kirim Jawaban' },
  submit_confirm: {
    'zh-TW': '還有 {n} 題尚未作答，確定要送出嗎？',
    vi: 'Còn {n} câu chưa trả lời, bạn có chắc muốn nộp bài không?',
    id: 'Masih ada {n} soal yang belum dijawab, yakin ingin mengirim?',
  },
  single_choice_hint: { 'zh-TW': '（單選）', vi: '（Chọn một）', id: '（Pilih satu）' },
  multiple_choice_hint: { 'zh-TW': '（複選）', vi: '（Chọn nhiều）', id: '（Pilih lebih dari satu）' },

  result_passed: { 'zh-TW': '恭喜及格', vi: 'Chúc mừng, đạt', id: 'Selamat, Lulus' },
  result_failed: { 'zh-TW': '未達及格分數', vi: 'Chưa đạt điểm đậu', id: 'Belum Mencapai Nilai Kelulusan' },
  result_score: { 'zh-TW': '得分：{score} 分', vi: 'Điểm: {score}', id: 'Nilai: {score}' },
  result_retry_hint: {
    'zh-TW': '請重新進行第 {n} 次測驗',
    vi: 'Vui lòng làm bài thi lần thứ {n}',
    id: 'Silakan lakukan ujian ke-{n}',
  },
  result_locked_hint: {
    'zh-TW': '已連續 3 次未通過，鎖定至 {date} 才能再次測驗',
    vi: 'Đã thi trượt 3 lần liên tiếp, bị khóa đến {date} mới có thể thi lại',
    id: 'Sudah gagal 3 kali berturut-turut, terkunci hingga {date} baru bisa ujian lagi',
  },
  result_pending_review_note: {
    'zh-TW': '此次成績待管理者審核確認後正式生效',
    vi: 'Kết quả này sẽ chính thức có hiệu lực sau khi quản trị viên xác nhận',
    id: 'Hasil ini akan berlaku resmi setelah dikonfirmasi oleh admin',
  },
  result_back_to_status: { 'zh-TW': '返回應考狀態', vi: 'Về trạng thái thi', id: 'Kembali ke Status Ujian' },

  error_generic: { 'zh-TW': '發生錯誤，請稍後再試', vi: 'Đã xảy ra lỗi, vui lòng thử lại sau', id: 'Terjadi kesalahan, silakan coba lagi nanti' },
} as const

export type TranslationKey = keyof typeof dict

export function translate(lang: LangCode, key: TranslationKey, vars?: Record<string, string | number>): string {
  const entry = dict[key]
  let text: string = entry[lang] ?? entry['zh-TW']
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}
