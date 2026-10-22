/* =====================================================================
   CẤU HÌNH CÂY TRI ÂN — mọi thông tin và chữ hiển thị nằm ở file này
   ---------------------------------------------------------------------
   - Chỉ sửa phần nằm trong dấu ngoặc kép "...".
   - Giữ nguyên dấu phẩy ở cuối mỗi dòng.
   - Các từ trong ngoặc nhọn {…} sẽ được thay tự động:
       {company} tên công ty      {event} tên sự kiện
       {date}    ngày sinh nhật   {n}     một con số
       {next}    tên giai đoạn tiếp theo của cây
       {to}      người nhận       {url}   đường link trang web
   ===================================================================== */
window.SITE_CONFIG = {

  /* ---------- Thông tin chung ---------- */
  company: {
    name: "VinRobotics",
    logo: "assets/logo-vinrobotics.png"
  },
  event: {
    title: "Cây",                 // phần chữ đen của tên sự kiện
    titleHighlight: "Tri Ân",     // phần chữ đỏ của tên sự kiện
    birthday: "2026-11-21T00:00:00+07:00"   // thời điểm sinh nhật, giờ Việt Nam
  },

  /* ---------- Kết nối máy chủ (Google Apps Script) ----------
     Để trống = bản xem trước, hiển thị lời chúc mẫu và không lưu. */
  backend: {
    apiUrl: ""
  },

  /* ---------- Phòng ban (mỗi phòng một màu lá, theo thứ tự) ---------- */
  departments: [
    "Ban Giám đốc",
    "Hành chính – Nhân sự",
    "Kế toán",
    "Kinh doanh",
    "Marketing",
    "IT",
    "Vận hành",
    "Chăm sóc khách hàng"
  ],

  /* ---------- Thời gian (giây) ---------- */
  timing: {
    refresh: 45,      // bao lâu tải lời chúc mới một lần
    spotlight: 6,     // bao lâu tự bật một lời chúc trên cây
    slide: 9          // mỗi lời chúc ở chế độ trình chiếu
  },

  /* ---------- Các giai đoạn lớn của cây ----------
     min = số lời chúc tối thiểu để cây đạt giai đoạn đó (tăng dần). */
  stages: [
    { min: 0,   name: "Hạt mầm" },
    { min: 5,   name: "Mầm non" },
    { min: 15,  name: "Cây non" },
    { min: 40,  name: "Cây nhỏ" },
    { min: 80,  name: "Cây đang lớn" },
    { min: 150, name: "Cây trưởng thành" },
    { min: 250, name: "Đại thụ nở hoa" }
  ],

  /* ---------- Gợi ý câu mở đầu trong form gửi ---------- */
  ideas: {
    company: ["Cảm ơn {company} vì ", "Điều em trân trọng nhất ở công ty là ", "Chúc {company} tuổi mới ", "Kỷ niệm đáng nhớ nhất của em ở đây là "],
    dept:    ["Cảm ơn cả phòng vì ", "Làm việc cùng mọi người, em học được ", "Chúc cả team tuổi mới "],
    person:  ["Cảm ơn anh/chị vì đã ", "Em rất ngưỡng mộ cách anh/chị ", "Chúc anh/chị luôn "]
  },

  /* ---------- Chữ hiển thị trên trang ---------- */
  text: {
    pageTitle:        "{event} · Mừng sinh nhật {company}",
    subtitle:         "Mừng sinh nhật {company} · {date}",
    previewLabel:     "Bản xem trước",
    previewText:      "đang hiển thị lời chúc mẫu, lời chúc gửi thử chưa được lưu",

    countdownBefore:  "Còn",
    countdownAfter:   "",          // chữ sau đồng hồ, ví dụ "đến sinh nhật {date}"; để trống để ẩn
    countdownToday:   "Hôm nay là sinh nhật {company}! 🎉",
    unitDay: "ngày", unitHour: "giờ", unitMinute: "phút", unitSecond: "giây",

    btnSend:          "Gửi lời chúc",
    btnShow:          "Trình chiếu",

    legendCompany:    "Cả công ty",

    statusCount:      "lời chúc đã được gửi",
    statusNext:       "Thêm {n} lời chúc để cây thành “{next}”",
    statusDone:       "Cây đã thành đại thụ. Cảm ơn tất cả mọi người!",
    tapHint:          "Chạm vào một chiếc lá để đọc lời chúc",

    emptyTitle:       "Cây đang chờ lời chúc đầu tiên",
    emptyText:        "Mỗi lời cảm ơn sẽ mọc thành một chiếc lá. Bạn có muốn là người gieo hạt đầu tiên?",
    emptyButton:      "Gieo lời chúc đầu tiên",

    feedTitle:        "Lời chúc mới nhất",
    feedLive:         "Trực tiếp",
    feedEmpty:        "Chưa có lời chúc nào. Hãy là người đầu tiên!",
    feedSearchPlaceholder: "Tìm tên người nhận hoặc nội dung lời chúc",
    feedAllDepts:     "Tất cả phòng ban",
    feedResults:      "Kết quả lọc",
    feedCount:        "{n} lời chúc",
    feedReset:        "Xóa bộ lọc",
    feedLoading:      "Đang tải thêm lời chúc…",
    feedNoMatch:      "Chưa có lời chúc nào khớp. Bạn thử từ khóa khác nhé.",

    toCompany:        "Gửi {company}",
    toDept:           "Gửi {to}",
    toPerson:         "Gửi {to}",
    cardPrev:         "‹ Trước",
    cardNext:         "Sau ›",
    cardPeekHint:     "Chạm để đọc tiếp",

    formTitle:        "Gửi một lời chúc",
    formPrivacy:      "Hoàn toàn giấu tên. Hệ thống không lưu tên, email hay thiết bị của bạn. Lời chúc sẽ mọc thành lá sau khi Ban tổ chức duyệt.",
    formTo:           "Bạn muốn gửi tới",
    optCompany:       "Cả công ty",      optCompanySub: "thành một bông hoa",
    optDept:          "Một phòng ban",   optDeptSub:    "lá theo màu phòng",
    optPerson:        "Một đồng nghiệp", optPersonSub:  "ghi tên người nhận",
    deptLabel:        "Phòng ban",
    nameLabel:        "Tên đồng nghiệp",
    namePlaceholder:  "Ví dụ: chị Lan, anh Minh team R&D",
    msgLabel:         "Lời cảm ơn, lời chúc của bạn",
    msgPlaceholder:   "Một điều bạn muốn cảm ơn, một kỷ niệm đáng nhớ, hay lời chúc cho chặng đường mới…",
    ideasHint:        "Bấm một gợi ý để bắt đầu nhanh.",
    btnLater:         "Để sau",
    btnSubmit:        "Gửi lời chúc",
    btnSubmitting:    "Đang gửi…",
    errName:          "Vui lòng nhập tên đồng nghiệp.",
    errShort:         "Lời chúc cần ít nhất 5 ký tự.",
    errSend:          "Gửi chưa thành công, bạn thử lại giúp nhé.",

    doneTitle:        "Cảm ơn bạn đã gửi yêu thương!",
    doneText:         "Lời chúc sẽ mọc thành một chiếc lá trên cây sau khi Ban tổ chức duyệt, thường trong ngày.",
    donePreviewText:  "Bản xem trước: lời chúc mọc lên cây ngay để bạn xem thử, nhưng chưa được lưu.",
    btnInvite:        "Mời đồng nghiệp cùng gửi",
    btnAgain:         "Gửi thêm",
    btnViewTree:      "Xem cây",
    inviteText:       "Cùng gửi lời cảm ơn giấu tên tới {company} trên {event}: {url}",
    inviteCopied:     "Đã sao chép lời mời. Dán vào nhóm chat của team nhé!",

    gateHello:        "Chào bạn 👋",
    gateText:         "Nhập mã PIN trong email hoặc nhóm chat nội bộ để vào xem và gửi lời chúc.",
    gatePreviewText:  "Bản xem trước: nhập mã bất kỳ để xem thử.",
    pinPlaceholder:   "Mã PIN",
    gateButton:       "Vào xem {event}",
    gateChecking:     "Đang kiểm tra…",
    gateFoot:         "Lời chúc được gửi hoàn toàn giấu tên.",
    pinWrong:         "Mã PIN chưa đúng, bạn kiểm tra lại giúp nhé.",
    pinChanged:       "Mã PIN đã thay đổi, bạn nhập lại giúp nhé.",
    netError:         "Chưa kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.",

    showTitle:        "{event} · Mừng sinh nhật {company}",
    showExit:         "Thoát (Esc)",
    showCount:        "{n} lời chúc",
    showEmpty:        "Chưa có lời chúc nào để trình chiếu.",

    toastNewOne:      "🍃 Một lời chúc vừa gửi tới {to}",
    toastNewMany:     "🍃 {n} lời chúc mới vừa mọc lên cây",
    loadError:        "Chưa tải được lời chúc, sẽ thử lại sau ít phút."
  },

  /* ---------- Lời chúc mẫu (chỉ dùng cho bản xem trước) ---------- */
  previewSamples: {
    count: 72,
    names: ["chị Lan", "anh Minh", "em Hoa", "anh Tuấn", "chị Thu", "anh Đức", "em Vy", "chị Ngọc"],
    texts: [
      "Cảm ơn {company} đã cho em một môi trường được học hỏi mỗi ngày. Chúc công ty tuổi mới bứt phá!",
      "Cảm ơn anh chị đã kiên nhẫn hướng dẫn em những ngày đầu đi làm.",
      "Chúc công ty ngày càng vững mạnh, đưa robot Việt ra thế giới.",
      "Cảm ơn team đã cùng nhau chạy deadline mà vẫn luôn giữ được nụ cười.",
      "Cảm ơn chị đã lắng nghe và động viên em đúng lúc nhất.",
      "Mỗi ngày đi làm đều có lý do để mỉm cười vì có mọi người. Sinh nhật vui vẻ!",
      "Cảm ơn phòng IT đã cứu laptop của em không biết bao nhiêu lần.",
      "Chúc cả nhà sức khỏe, hạnh phúc và thêm nhiều dự án thành công.",
      "Cảm ơn anh vì những buổi cà phê góp ý rất thật lòng.",
      "Tự hào là một phần của {company}. Cùng nhau đi thêm thật nhiều năm nữa nhé!",
      "Cảm ơn phòng Kế toán luôn chu đáo và đúng hẹn, mọi người tuyệt vời!",
      "Kỷ niệm đáng nhớ nhất là đêm demo sản phẩm đầu tiên. Cảm ơn cả team!"
    ]
  }
};
