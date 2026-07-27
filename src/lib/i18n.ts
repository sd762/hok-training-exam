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
  your_answer_label: { 'zh-TW': '（您的作答）', vi: '（Câu trả lời của bạn）', id: '（Jawaban Anda）' },
  correct_answer_label: { 'zh-TW': '✓ 正解', vi: '✓ Đáp án đúng', id: '✓ Jawaban benar' },
  answer_correct: { 'zh-TW': '答對', vi: 'Đúng', id: 'Benar' },
  answer_incorrect: { 'zh-TW': '答錯', vi: 'Sai', id: 'Salah' },
  single_choice_hint: { 'zh-TW': '（單選）', vi: '（Chọn một）', id: '（Pilih satu）' },
  multiple_choice_hint: { 'zh-TW': '（複選）', vi: '（Chọn nhiều）', id: '（Pilih lebih dari satu）' },
  listen_hint: {
    'zh-TW': '請先播放音訊，再作答',
    vi: 'Vui lòng nghe âm thanh trước khi trả lời',
    id: 'Dengarkan audio terlebih dahulu sebelum menjawab',
  },

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

  consent_title: { 'zh-TW': '鏡頭監考同意書', vi: 'Đồng ý giám sát bằng camera', id: 'Persetujuan Pengawasan Kamera' },
  consent_body: {
    'zh-TW':
      '測驗期間將全程開啟您的鏡頭（含手機前鏡頭），並在無預警的情況下擷取畫面，用以確認作答者為本人。若畫面中連續偵測不到人臉，系統會顯示提醒；累積達到一定次數會自動中止本次測驗並計入一次失敗。請確認您已了解並同意，才能開始測驗。',
    vi: 'Trong suốt quá trình thi, camera của bạn (kể cả camera trước điện thoại) sẽ được bật liên tục và chụp ảnh màn hình bất kỳ lúc nào mà không báo trước, nhằm xác minh chính bạn là người làm bài. Nếu hệ thống không phát hiện khuôn mặt liên tục, sẽ có cảnh báo; nếu tích lũy đủ số lần, bài thi sẽ tự động bị hủy và tính là một lần trượt. Vui lòng xác nhận bạn đã hiểu và đồng ý trước khi bắt đầu.',
    id: 'Selama ujian, kamera Anda (termasuk kamera depan ponsel) akan aktif terus-menerus dan mengambil gambar layar sewaktu-waktu tanpa pemberitahuan, untuk memverifikasi bahwa Anda sendiri yang mengerjakan ujian. Jika sistem tidak mendeteksi wajah secara terus-menerus, akan muncul peringatan; jika mencapai jumlah tertentu, ujian akan otomatis dibatalkan dan dihitung sebagai satu kali gagal. Mohon konfirmasi Anda telah memahami dan menyetujui sebelum memulai ujian.',
  },
  consent_agree_button: { 'zh-TW': '我同意，開始測驗', vi: 'Tôi đồng ý, bắt đầu thi', id: 'Saya setuju, mulai ujian' },
  consent_decline_note: {
    'zh-TW': '不同意將無法開始測驗',
    vi: 'Nếu không đồng ý, bạn sẽ không thể bắt đầu thi',
    id: 'Jika tidak setuju, Anda tidak dapat memulai ujian',
  },
  camera_denied: {
    'zh-TW': '無法取得鏡頭權限，請允許瀏覽器使用鏡頭後再試一次',
    vi: 'Không thể truy cập camera, vui lòng cho phép trình duyệt sử dụng camera rồi thử lại',
    id: 'Tidak dapat mengakses kamera, mohon izinkan browser menggunakan kamera lalu coba lagi',
  },
  face_missing_warning: {
    'zh-TW': '偵測不到您的臉，請正對鏡頭',
    vi: 'Không phát hiện khuôn mặt của bạn, vui lòng nhìn thẳng vào camera',
    id: 'Wajah Anda tidak terdeteksi, mohon hadap kamera',
  },
  tab_switch_warning: {
    'zh-TW': '偵測到您離開了測驗畫面，這是第 1 次警告，再發生一次將直接中止測驗並計入一次失敗',
    vi: 'Phát hiện bạn rời khỏi màn hình thi, đây là cảnh báo lần 1, nếu tái phạm bài thi sẽ bị hủy ngay và tính là một lần trượt',
    id: 'Terdeteksi Anda meninggalkan layar ujian, ini adalah peringatan ke-1, jika terulang ujian akan langsung dibatalkan dan dihitung sebagai satu kali gagal',
  },
  aborted_title: { 'zh-TW': '測驗已中止', vi: 'Bài thi đã bị hủy', id: 'Ujian Dibatalkan' },
  aborted_body_face: {
    'zh-TW': '因多次偵測不到您的臉，本次測驗已自動中止，計入一次失敗。',
    vi: 'Do nhiều lần không phát hiện khuôn mặt của bạn, bài thi này đã tự động bị hủy và tính là một lần trượt.',
    id: 'Karena wajah Anda berulang kali tidak terdeteksi, ujian ini otomatis dibatalkan dan dihitung sebagai satu kali gagal.',
  },
  aborted_body_tab_switch: {
    'zh-TW': '因多次離開測驗畫面（切換視窗/離開頁面），本次測驗已自動中止，計入一次失敗。',
    vi: 'Do nhiều lần rời khỏi màn hình thi (chuyển cửa sổ/rời trang), bài thi này đã tự động bị hủy và tính là một lần trượt.',
    id: 'Karena berulang kali meninggalkan layar ujian (beralih jendela/keluar halaman), ujian ini otomatis dibatalkan dan dihitung sebagai satu kali gagal.',
  },

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
