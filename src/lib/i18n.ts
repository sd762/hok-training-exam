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
  tab_switch_warning_acknowledge: {
    'zh-TW': '我知道了，繼續作答',
    vi: 'Tôi đã hiểu, tiếp tục làm bài',
    id: 'Saya mengerti, lanjutkan mengerjakan',
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

  // 使用說明頁——學員看得到的段落（帳號登入、應考流程），見 src/pages/HelpPage.tsx
  help_page_title: { 'zh-TW': '使用說明', vi: 'Hướng dẫn sử dụng', id: 'Panduan Penggunaan' },
  help_page_subtitle: {
    'zh-TW': '依你目前的角色只顯示相關的段落。',
    vi: 'Chỉ hiển thị các phần liên quan đến vai trò hiện tại của bạn.',
    id: 'Hanya menampilkan bagian yang terkait dengan peran Anda saat ini.',
  },
  help_section_login_title: { 'zh-TW': '帳號與登入', vi: 'Tài khoản và đăng nhập', id: 'Akun dan Login' },
  help_section_exam_title: {
    'zh-TW': '學員：如何應考',
    vi: 'Học viên: Cách tham gia thi',
    id: 'Peserta: Cara Mengikuti Ujian',
  },
  help_login_1: {
    'zh-TW': '登入一律用「帳號代碼」（學員是工號），不是 email。',
    vi: 'Đăng nhập luôn dùng "mã số nhân viên" (không phải email).',
    id: 'Login selalu menggunakan "nomor pegawai" (bukan email).',
  },
  help_login_2: {
    'zh-TW': '忘記密碼要請管理者重設，會恢復成預設密碼 000000。目前系統沒有自己修改密碼的功能。',
    vi: 'Quên mật khẩu thì nhờ quản trị viên đặt lại, mật khẩu sẽ về mặc định là 000000. Hiện tại hệ thống chưa có chức năng tự đổi mật khẩu.',
    id: 'Jika lupa kata sandi, minta admin untuk mereset, kata sandi akan kembali ke default 000000. Saat ini sistem belum memiliki fitur untuk mengubah kata sandi sendiri.',
  },
  help_login_3: {
    'zh-TW': '新建立的帳號預設密碼也是 000000。',
    vi: 'Tài khoản mới tạo cũng có mật khẩu mặc định là 000000.',
    id: 'Akun yang baru dibuat juga memiliki kata sandi default 000000.',
  },
  help_exam_1: {
    'zh-TW': '登入後首頁會顯示「目前應考測驗」提醒（如果有應考義務）。',
    vi: 'Sau khi đăng nhập, trang chủ sẽ hiển thị nhắc nhở "bài thi hiện tại" (nếu bạn có nghĩa vụ thi).',
    id: 'Setelah login, beranda akan menampilkan pengingat "ujian saat ini" (jika Anda memiliki kewajiban ujian).',
  },
  help_exam_2: {
    'zh-TW': '開考前會先看到鏡頭監考同意書，需要明確同意才能進入測驗畫面。',
    vi: 'Trước khi thi, bạn sẽ thấy bản đồng ý giám sát bằng camera, cần đồng ý rõ ràng mới vào được màn hình thi.',
    id: 'Sebelum ujian, Anda akan melihat persetujuan pengawasan kamera, harus menyetujui dengan jelas untuk masuk ke layar ujian.',
  },
  help_exam_3: {
    'zh-TW':
      '測驗全程鏡頭持續開啟：人臉消失超過3秒會警示，累積3次自動中止並計入一次失敗；切換視窗/離開頁面第1次警告，第2次直接中止並計入一次失敗。',
    vi: 'Camera sẽ bật liên tục trong suốt bài thi: nếu khuôn mặt biến mất quá 3 giây sẽ có cảnh báo, tích lũy đủ 3 lần sẽ tự động hủy bài thi và tính là một lần trượt; chuyển cửa sổ/rời trang lần 1 sẽ cảnh báo, lần 2 sẽ hủy ngay và tính là một lần trượt.',
    id: 'Kamera akan aktif terus selama ujian: jika wajah menghilang lebih dari 3 detik akan muncul peringatan, jika mencapai 3 kali akan otomatis membatalkan ujian dan dihitung sebagai satu kali gagal; beralih jendela/keluar halaman pertama kali akan diperingatkan, kedua kalinya langsung dibatalkan dan dihitung sebagai satu kali gagal.',
  },
  help_exam_4: {
    'zh-TW': '依序作答25題，題型有單選/複選；有些題目會附音訊（可以無限重聽）或圖片。',
    vi: 'Trả lời lần lượt 25 câu hỏi, có loại chọn một hoặc chọn nhiều; một số câu có kèm âm thanh (có thể nghe lại không giới hạn) hoặc hình ảnh.',
    id: 'Menjawab 25 soal secara berurutan, ada tipe pilihan tunggal/ganda; beberapa soal disertai audio (dapat diputar ulang tanpa batas) atau gambar.',
  },
  help_exam_5: {
    'zh-TW': '送出後立即看到分數與及格/不及格；不及格會顯示剩餘重考次數，同一輪3次都沒過要鎖定7天。',
    vi: 'Sau khi nộp bài sẽ thấy ngay điểm số và đạt/không đạt; nếu không đạt sẽ hiển thị số lần thi lại còn, nếu cả 3 lần trong một vòng đều không đạt sẽ bị khóa 7 ngày.',
    id: 'Setelah mengirim akan langsung melihat nilai dan lulus/tidak lulus; jika tidak lulus akan ditampilkan sisa kesempatan ujian, jika 3 kali dalam satu putaran tidak lulus akan terkunci selama 7 hari.',
  },
  help_exam_6: {
    'zh-TW': '及格後狀態先變「待核對」，等管理者審查確認「已確認通過」才正式算及格。',
    vi: 'Sau khi đạt, trạng thái sẽ chuyển thành "đang chờ xác nhận", phải đợi quản trị viên xét duyệt xác nhận "đã xác nhận đạt" mới chính thức tính là đạt.',
    id: 'Setelah lulus, status akan berubah menjadi "menunggu verifikasi", harus menunggu admin meninjau dan mengonfirmasi "telah dikonfirmasi lulus" baru resmi dihitung lulus.',
  },
  help_exam_7: {
    'zh-TW': '作答畫面語言依你的帳號國籍自動顯示，不用自己切換。',
    vi: 'Ngôn ngữ màn hình làm bài sẽ tự động hiển thị theo quốc tịch trong tài khoản của bạn, không cần tự chuyển đổi.',
    id: 'Bahasa layar ujian akan otomatis ditampilkan sesuai kewarganegaraan pada akun Anda, tidak perlu mengganti sendiri.',
  },
  help_exam_8: {
    'zh-TW': '作答到一半重新整理或關閉瀏覽器，重新登入可以繼續同一次未完成的測驗。',
    vi: 'Nếu làm bài đến giữa chừng mà tải lại trang hoặc đóng trình duyệt, đăng nhập lại có thể tiếp tục bài thi chưa hoàn thành đó.',
    id: 'Jika sedang mengerjakan ujian lalu me-refresh halaman atau menutup browser, login kembali dapat melanjutkan ujian yang belum selesai tersebut.',
  },
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
