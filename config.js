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
    logo: "assets/logo-vinrobotics.svg"
  },
  event: {
    title: "Cây",                 // phần chữ đen của tên sự kiện
    titleHighlight: "Tri Ân",     // phần chữ đỏ của tên sự kiện
    birthday: "2026-11-21T00:00:00+07:00"   // thời điểm sinh nhật, giờ Việt Nam
  },

  /* ---------- Kết nối máy chủ (Google Apps Script) ----------
     Để trống = bản xem trước, hiển thị lời chúc mẫu và không lưu. */
  backend: {
    /* Máy chủ chính: Google Apps Script. Máy chủ dự phòng: Azure Functions.
       Ban tổ chức chuyển qua lại trong Quản trị → tab Máy chủ, mọi người tự theo trong khoảng 1–2 phút.
       Hai máy chủ tự đồng bộ 2 phút/lần (Azure chủ động), nên vào máy nào cũng thấy cùng một cây.
       Để trống cả hai thì web chạy bản xem trước. */
    apiUrl:   "https://script.google.com/macros/s/AKfycbwiJ4EybwQW5afgu4LjLXgBq3dXl_8fpdAg9HlJUtVNk5IaMaj7Bbh7mgVC71Kxkc3yaA/exec",
    azureUrl: "https://caytrian-vinrobotics.azurewebsites.net/api/cay",
    active:   "azure"      // máy chủ dùng khi chưa liên lạc được máy chủ nào
  },

  /* ---------- Phòng ban ----------
     Danh sách này điều khiển: dãy phòng ban dưới thẻ tổng số, ô "Phòng ban"
     trong form gửi, bộ lọc trong danh sách lời chúc và màu lá trên cây.
     - Thêm phòng: thêm một dòng "Tên phòng", (nhớ dấu phẩy).
     - Bớt phòng: xóa dòng đó. Lời chúc cũ gửi phòng đó vẫn hiện, lá đổi màu tự động.
     - Tự chọn màu lá: viết { name: "Tên phòng", color: "#2F7D57" },
       không ghi color thì màu được chọn tự động theo thứ tự. */
  /* Danh sách này là mặc định. Khi đã chạy máy chủ, Ban tổ chức sửa phòng ban, thứ tự, màu
     ngay trong trang Quản trị → tab Phòng ban; danh sách trên máy chủ sẽ được ưu tiên. */
  departments: [
    "Ban Giám đốc",
    "Hành chính – Nhân sự",
    "Kế toán",
    "Kinh doanh",
    "Marketing",
    { name: "IT", color: "#3D6FB6" },
    "Vận hành",
    "Chăm sóc khách hàng"
  ],

  /* ---------- Thời gian (giây) ---------- */
  timing: {
    refresh: 60,      // bao lâu tải lời chúc mới một lần (150 người cùng mở ≈ 2,5 lượt/giây lên máy chủ)
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
    headerTitle:      "Chào mừng sinh nhật {dateFull}",   // {dateFull} = ngày sinh nhật dạng dd/mm/yyyy, lấy từ event.birthday
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
    tapHint:          "Chạm vào một bông hoa, chiếc lá để đọc lời chúc",

    emptyTitle:       "Cây đang chờ lời chúc đầu tiên",
    emptyText:        "Mỗi lời cảm ơn sẽ mọc thành một chiếc lá. Bạn có muốn là người gieo hạt đầu tiên?",
    emptyButton:      "Gieo lời chúc đầu tiên",

    feedTitle:        "Lời chúc mới nhất",
    feedLive:         "Trực tiếp",
    feedEmpty:        "Chưa có lời chúc nào. Hãy là người đầu tiên!",
    feedSearchPlaceholder: "Tìm theo nội dung hoặc người gửi",
    feedAllDepts:     "Tất cả phòng ban",
    feedResults:      "Kết quả lọc",
    feedCount:        "{n} lời chúc",
    feedReset:        "Xóa bộ lọc",
    feedNewPill:      "↑ {n} lời chúc mới",
    feedLoading:      "Đang tải thêm lời chúc…",
    feedNoMatch:      "Chưa có lời chúc nào khớp. Bạn thử từ khóa khác nhé.",

    toCompany:        "Gửi {company}",
    toDept:           "Gửi {to}",
    toPerson:         "Gửi {to}",
    cardFrom:         "— {from}",
    feedFrom:         "✍ {from}",
    cardPrev:         "‹ Trước",
    cardNext:         "Sau ›",
    cardPeekHint:     "Chạm để đọc tiếp",

    formTitle:        "Gửi một lời chúc",
    formPrivacy:      "Account VGR của bạn sẽ hiện kèm lời chúc trên cây để mọi người biết ai đã gửi, và dùng để quay thưởng.",
    formPrivacyAnon:  "Bạn đang gửi ẩn danh: lời chúc không kèm tên hay account, không ai biết ai đã gửi, kể cả Ban tổ chức.",
    accLabel:         "Account VGR của bạn",
    accPlaceholder:   "Ví dụ: anhtt12",
    accHint:          "Bắt buộc. Hiện kèm lời chúc và dùng để nhận quà nếu trúng thưởng.",
    errAccount:       "Vui lòng nhập Account VGR (không dấu, không khoảng trắng).",
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
    doneText:         "Lời chúc của bạn đã mọc thành một chiếc lá trên cây. Cảm ơn bạn!",
    doneTextPending:  "Lời chúc sẽ mọc thành một chiếc lá trên cây sau khi Ban tổ chức duyệt.",
    donePreviewText:  "Bản xem trước: lời chúc mọc lên cây ngay để bạn xem thử, nhưng chưa được lưu.",
    btnInvite:        "Mời đồng nghiệp cùng gửi",
    btnAgain:         "Gửi thêm",
    btnViewTree:      "Xem cây",
    inviteText:       "Cùng gửi lời cảm ơn giấu tên tới {company} trên {event}: {url}",
    inviteTextNamed:  "Cùng gửi lời cảm ơn tới {company} trên {event}: {url}",
    inviteCopied:     "Đã sao chép lời mời. Dán vào nhóm chat của team nhé!",

    gateHello:        "Chào bạn 👋",
    gateText:         "Nhập mã PIN trong email hoặc nhóm chat nội bộ để vào xem và gửi lời chúc.",
    gatePreviewText:  "Bản xem trước: nhập mã bất kỳ để xem thử.",
    pinPlaceholder:   "Mã PIN",
    gateButton:       "Vào xem {event}",
    gateChecking:     "Đang kiểm tra…",
    gateFoot:         "Lời chúc được gửi hoàn toàn giấu tên.",
    gateFootNamed:    "Account VGR của bạn hiện kèm lời chúc để mọi người biết ai đã gửi.",
    pinWrong:         "Mã PIN chưa đúng, bạn kiểm tra lại giúp nhé.",
    pinChanged:       "Mã PIN đã thay đổi, bạn nhập lại giúp nhé.",
    netError:         "Chưa kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.",

    showTitle:        "{event} · Mừng sinh nhật {company}",
    showExit:         "Thoát (Esc)",
    showCount:        "{n} lời chúc",
    showEmpty:        "Chưa có lời chúc nào để trình chiếu.",

    toastNewOne:      "🍃 Một lời chúc vừa gửi tới {to}",
    toastNewMany:     "🍃 {n} lời chúc mới vừa mọc lên cây",
    featuredBadge:    "Tiêu biểu",
    showModeFeatured: "★ Tiêu biểu ({n})",
    showModeAll:      "Tất cả ({n})",

    /* Quản trị (Ban tổ chức) */
    gateAdminLink:    "Ban tổ chức? Đăng nhập quản trị",
    adminButton:      "Quản trị",
    adminLoginTitle:  "Đăng nhập quản trị",
    adminLoginText:   "Dành cho Ban tổ chức: duyệt lời chúc và chọn lời chúc tiêu biểu để trình chiếu.",
    adminPinPlaceholder: "Mã PIN quản trị",
    adminLoginButton: "Đăng nhập",
    adminTitle:       "Quản trị lời chúc",
    adminPreviewNote: "Bản xem trước: thay đổi chỉ lưu tạm trên trình duyệt này.",
    adminTabPending:  "Chờ duyệt",
    adminTabApproved: "Đã duyệt",
    adminTabFeatured: "Tiêu biểu",
    adminSearch:      "Tìm theo người nhận hoặc nội dung",
    adminApprove:     "Duyệt",
    adminFeature:     "Tiêu biểu",
    adminEmpty:       "Không có lời chúc nào ở mục này.",
    adminInfo:        "{n} lời chúc tiêu biểu sẽ được ưu tiên trình chiếu",
    adminShowFeatured:"Trình chiếu lời chúc tiêu biểu",
    adminLogout:      "Đăng xuất",
    adminTabDepts:    "Phòng ban",
    adminTabServer:   "Máy chủ",
    adminTabTrash:    "Đã xóa",
    adminTabList:     "Lời chúc",
    fAll: "Tất cả", fPending: "Chờ duyệt", fApproved: "Đã duyệt", fFeatured: "★ Tiêu biểu", fWon: "🎁 Trúng thưởng", fTrash: "🙈 Ẩn đi",
    stPending: "Chờ duyệt", stApproved: "Đã duyệt", stFeatured: "Tiêu biểu", stTrash: "Ẩn đi",
    adminExport:      "Xuất Excel (CSV)",
    adminExported:    "Đã xuất {n} lời chúc.",
    drawTitle:        "Quay thưởng",
    drawPrize:        "Tên giải",
    drawPrizeDefault: "Giải may mắn",
    drawRange:        "Lời chúc gửi trong khoảng",
    drawPre1h: "1 giờ qua", drawPreToday: "Hôm nay", drawPre7d: "7 ngày", drawPreAll: "Tất cả",
    drawOnlyApproved: "Chỉ lời chúc đã duyệt",
    drawInfo:         "{n} lời chúc hợp lệ từ {p} người. Đã loại {w} người từng trúng.",
    drawNoAcc:        "{n} lời chúc trong khoảng này không có Account VGR (gửi trước khi web có ô Account, hoặc máy chủ chưa cập nhật) nên không được quay.",
    drawNotApproved:  "{n} lời chúc chưa duyệt bị bỏ qua (bỏ tick \"Chỉ lời chúc đã duyệt\" để tính cả).",
    drawNoneInRange:  "Không có lời chúc nào trong khoảng thời gian này, thử bấm \"Tất cả\".",
    drawSpin:         "Quay",
    drawListTitle:    "Bảng kê lời chúc trong khoảng thời gian ({n} lời chúc, {k} được quay)",
    drawColTime: "Thời gian", drawColTo: "Gửi tới", drawColText: "Lời chúc", drawColStatus: "Trạng thái",
    drawStOk: "✓ Được quay", drawStNoAcc: "Không có account", drawStWon: "Người này đã trúng", drawStPending: "Chưa duyệt",
    drawUndo:         "Hủy kết quả này",
    drawUndone:       "Đã hủy kết quả, người này được quay lại.",
    drawWinners:      "Danh sách trúng thưởng",
    drawNoWinners:    "Chưa có ai trúng.",
    drawRemove:       "Hủy",
    adminTabPin:      "Mã PIN",
    adminTabTexts:    "Nội dung",
    adminTabBackup:   "Sao lưu",
    bkDownTitle:      "Tải bản sao lưu về máy",
    bkDownSub:        "Toàn bộ lời chúc (kể cả đã ẩn), Account VGR, giải thưởng, chế độ ẩn danh và nội dung chữ đã sửa. File .json, không chứa mã PIN. Nên tải 1 bản trước và sau buổi sinh nhật.",
    bkDownBtn:        "⬇ Tải bản sao lưu ngay",
    bkDownDone:       "Đã tải bản sao lưu {n} lời chúc.",
    bkRestTitle:      "Khôi phục",
    bkRestSub:        "Chọn file sao lưu (.json), hoặc bấm \"Dùng bản này\" ở một bản tự động bên dưới. Trước khi khôi phục, máy chủ luôn tự lưu lại hiện trạng để có thể quay lại.",
    bkPickFile:       "📂 Chọn file sao lưu…",
    bkBadFile:        "File không phải bản sao lưu của Cây Tri Ân.",
    bkPreview:        "Bản sao lưu \"{label}\" lúc {at}: {n} lời chúc ({live} đang hiện). Hiện có {cur} lời chúc; {miss} lời chúc trong bản sao lưu đang bị thiếu.",
    bkMerge:          "Gộp: chỉ thêm lại lời chúc bị mất",
    bkMergeSub:       "Giữ nguyên mọi lời chúc hiện có và các thay đổi gần đây. An toàn nhất.",
    bkReplace:        "Đưa về đúng như bản sao lưu",
    bkReplaceSub:     "Trạng thái duyệt, tiêu biểu, giải thưởng trở về như lúc sao lưu. Lời chúc gửi sau thời điểm đó sẽ bị chuyển sang \"Ẩn đi\" (không bị xóa).",
    bkWithSettings:   "Khôi phục cả chế độ ẩn danh và nội dung chữ",
    bkGo:             "Khôi phục",
    bkGoConfirm:      "Bấm lần nữa để khôi phục",
    bkDone:           "Đã khôi phục: thêm lại {a}, cập nhật {c}, chuyển sang ẩn {h} lời chúc. Máy chủ còn lại nhận trong vòng 2 phút.",
    bkOld:            "Máy chủ chưa cập nhật bản mới nên chưa dùng được (cần khởi động lại Azure / triển khai lại Google).",
    bkAutoTitle:      "Bản sao lưu tự động (trên Azure)",
    bkPolicy:         "Hiện đang tự sao lưu {m}/lần, chỉ khi dữ liệu có thay đổi (3 giờ/lần ngày thường, 1 giờ/lần quanh ngày sinh nhật). Giữ {k} bản gần nhất và 1 bản mỗi ngày trong {d} ngày.",
    bkNow:            "Sao lưu ngay lên máy chủ",
    bkNowDone:        "Đã sao lưu {n} lời chúc lên máy chủ.",
    bkNone:           "Chưa có bản sao lưu tự động nào. Bản đầu tiên sẽ được tạo trong vòng 1 giờ.",
    bkKindAuto: "Tự động", bkKindManual: "Bấm tay", bkKindBefore: "Trước khi khôi phục",
    bkRowInfo:        "{n} lời chúc ({live} đang hiện) · {kb} KB",
    bkGet:            "Tải về",
    bkUse:            "Dùng bản này…",
    adminTextsHint:   "Sửa chữ hiển thị trên trang, không cần sửa file. Các từ trong ngoặc nhọn được thay tự động: {company} tên công ty, {event} tên sự kiện, {dateFull} ngày sinh nhật, {n} con số, {next} giai đoạn tiếp theo, {to} người nhận, {from} người gửi, {url} đường link. Bấm ↺ để về chữ mặc định. Lưu xong, trang của mọi người tự cập nhật trong khoảng 1 phút.",
    adminTextsSearch: "Tìm chữ cần sửa",
    adminTextsAll:    "Hiện cả chữ trong khu quản trị",
    adminTextsSave:   "Lưu nội dung",
    adminTextsSaved:  "Đã lưu nội dung. Trang của mọi người tự cập nhật trong khoảng 1 phút.",
    adminTextsDirty:  "{n} chỗ chưa lưu",
    adminTextsClean:  "Chưa có thay đổi",
    adminTextsReset:  "Về chữ mặc định",
    adminTextsOld:    "Máy chủ chưa cập nhật bản mới nên chưa lưu được (cần khởi động lại Azure / triển khai lại Google).",
    adminPinHint:     "Hai loại mã PIN đổi riêng. Đổi xong có hiệu lực ngay trên cả hai máy chủ.",
    adminPinStaffTitle:"PIN nhân viên",
    adminPinStaffSub: "Mã cả công ty dùng để vào web. Nhân viên đang mở web sẽ được yêu cầu nhập mã mới.",
    adminPinCurrent:  "Đang dùng:",
    adminPinStaff:    "PIN nhân viên mới",
    adminPinStaffPh:  "4–40 ký tự, ví dụ VR2026",
    adminPinSaveStaff:"Đổi PIN nhân viên",
    adminPinAdminTitle:"PIN quản trị",
    adminPinAdminSub: "Chỉ Ban tổ chức biết. Phiên quản trị đang mở của bạn tự dùng mã mới.",
    adminPinAdmin:    "PIN quản trị mới",
    adminPinAdminPh:  "Ít nhất 8 ký tự",
    adminPinAdmin2Ph: "Nhập lại PIN quản trị mới",
    adminPinSaveAdmin:"Đổi PIN quản trị",
    adminPinSaving:   "Đang lưu…",
    adminPinNone:     "Bạn chưa nhập mã PIN mới.",
    adminPinStaffBad: "PIN nhân viên cần 4–40 ký tự.",
    adminPinAdminBad: "PIN quản trị cần ít nhất 8 ký tự.",
    adminPinMismatch: "Hai ô PIN quản trị chưa khớp nhau.",
    adminPinSame:     "PIN nhân viên và PIN quản trị phải khác nhau.",
    adminPinOldServer:"Máy chủ {name} đang chạy bản cũ, chưa có chức năng đổi PIN. Cần khởi động lại máy chủ để nạp bản mới.",
    adminPinSavedStaff:"Đã đổi PIN nhân viên trên cả hai máy chủ.",
    adminPinSavedAdmin:"Đã đổi PIN quản trị trên cả hai máy chủ.",
    adminPinSavedPartly:"Đã đổi ở máy chủ đang dùng. Máy chủ {name} chưa nhận, sẽ nhận ở lần đồng bộ kế tiếp.",
    adminAnon:        "Chế độ ẩn danh",
    adminAnonOn:      "Đang bật: không hỏi Account VGR, không lưu account, tên người gửi được ẩn trên cây và danh sách. Lời chúc gửi lúc này không tham gia quay thưởng.",
    adminAnonOff:     "Đang tắt: người gửi phải nhập Account VGR; account hiện kèm lời chúc trên cây, trong danh sách và dùng để quay thưởng.",
    toastAnonOn:      "Đã bật chế độ ẩn danh. Không hỏi Account VGR, tên người gửi được ẩn.",
    toastAnonOff:     "Đã tắt chế độ ẩn danh. Người gửi cần nhập Account VGR, tên hiện kèm lời chúc.",
    adminAnonOld:     "Máy chủ chưa cập nhật bản mới nên chưa đổi được (cần khởi động lại Azure / triển khai lại Google).",
    drawAnonWarn:     "Đang bật chế độ ẩn danh: lời chúc mới không có Account VGR nên không tham gia quay thưởng.",
    adminDelete:      "Ẩn đi",
    adminPurge:       "Xóa hẳn",
    adminPurgeConfirm:"Bấm lần nữa để xóa vĩnh viễn",
    adminPurged:      "Đã xóa hẳn khỏi cơ sở dữ liệu.",
    adminPurgeOld:    "Máy chủ chưa cập nhật bản mới nên chưa xóa hẳn được (cần khởi động lại Azure / triển khai lại Google).",
    adminRestore:     "Khôi phục",
    adminSyncOk:      "Hai máy chủ đã đồng bộ · {m} phút trước",
    adminSyncBad:     "Đồng bộ chưa chạy được ({m} phút trước): {err}",
    adminSyncNever:   "Chưa đồng bộ lần nào",
    adminSyncNow:     "Đồng bộ ngay",
    adminSyncing:     "Đang đồng bộ…",
    adminSyncDone:    "Đã đồng bộ: nhận {a}, gửi {b} lời chúc mới.",
    adminServerHint:  "Chọn máy chủ cả công ty đang dùng. Sau khi chuyển, mọi người tự chuyển theo trong khoảng 1–2 phút. Hai máy chủ tự đồng bộ lời chúc, phòng ban 2 phút/lần, nên người ở mạng chặn Google (tự dùng Azure) vẫn thấy cùng một cây. Nếu máy chủ đang dùng lỗi liên tục, trình duyệt tự chuyển sang máy còn lại.",
    adminServerActive:"Đang dùng",
    adminServerNotSet:"Chưa cài đặt",
    adminServerChecking:"Đang kiểm tra…",
    adminServerOk:    "Hoạt động tốt · phản hồi {ms} ms",
    adminServerCount: "{n} lời chúc",
    adminServerPin:   "Mã PIN quản trị ở máy chủ này khác, cần đặt giống nhau",
    adminServerDown:  "Không liên lạc được",
    adminServerSwitch:"Chuyển sang {name}",
    adminServerSwitching:"Đang chuyển…",
    adminServerSwitched:"Đã chuyển cả công ty sang máy chủ {name}.",
    adminServerSwitchedPartly:"Đã chuyển sang {name}. Máy chủ còn lại chưa ghi nhận được, người dùng vẫn tự theo khi máy chủ đó trả lời.",
    adminServerSwitchFail:"Chưa chuyển được sang {name}, bạn thử lại nhé.",
    adminServerInfo:  "Trình duyệt này đang dùng máy chủ {name}",
    adminDeptHint:    "Kéo ⋮⋮ hoặc bấm ↑ ↓ để đổi thứ tự (áp dụng cho dãy phòng ban, ô chọn khi gửi lời chúc và bộ lọc). Bấm ô màu để đổi màu lá. Đổi tên sẽ tự cập nhật các lời chúc cũ của phòng đó.",
    adminDeptAdd:     "+ Thêm phòng ban",
    adminDeptSave:    "Lưu phòng ban",
    adminDeptSaved:   "Đã lưu danh sách phòng ban.",
    adminDeptUnsaved: "Có thay đổi chưa lưu",
    adminDeptCount:   "{n} lời chúc",
    adminSaveError:   "Chưa lưu được, bạn thử lại nhé.",

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
