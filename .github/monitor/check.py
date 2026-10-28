"""Giám sát Cây Tri Ân: chạy trên GitHub Actions mỗi 10 phút.
In bảng kết quả ra job summary; có lỗi thì exit 1 để workflow mở Issue cảnh báo (GitHub tự gửi email)."""
import json, os, re, time, urllib.request

PAGES = "https://trinhtunganh.github.io/cay-loi-chuc/"
try:
    cfg = urllib.request.urlopen(PAGES + "config.js", timeout=30).read().decode("utf-8")
except Exception:
    cfg = open("config.js", encoding="utf-8").read() if os.path.exists("config.js") else ""   # trang lỗi thì đọc bản trong repo
AZURE = (re.search(r'azureUrl:\s*"([^"]*)"', cfg) or [None, ""])[1]
GOOGLE = (re.search(r'apiUrl:\s*"([^"]*)"', cfg) or [None, ""])[1]
results, problems, warns = [], [], []

def get(url, timeout=25):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cay-tri-an-monitor"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "replace")
            return r.status, body, time.time() - t0
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), time.time() - t0
    except Exception as e:
        return 0, str(e), time.time() - t0

def row(name, ok, detail):
    results.append((("✅" if ok == True else "⚠️" if ok == "warn" else "❌"), name, detail))
    if ok is False: problems.append(f"{name}: {detail}")
    if ok == "warn": warns.append(f"{name}: {detail}")

# 1. Trang web
st, body, dt = get(PAGES)
row("Trang web (GitHub Pages)", st == 200 and "SITE_CONFIG" in body or st == 200 and "config.js" in body, f"HTTP {st}, {dt*1000:.0f} ms")

# 2. Azure (máy chủ chính): thử 2 lần để bỏ qua lần khởi động nguội
if AZURE:
    st, body, dt = get(AZURE + "?health")
    if st != 200 or dt > 8:
        time.sleep(5); st, body, dt = get(AZURE + "?health")
    try: h = json.loads(body)
    except Exception: h = {}
    if st != 200 or not h.get("ok"):
        row("Azure: phản hồi", False, f"HTTP {st}, {dt*1000:.0f} ms, {body[:120]}")
    else:
        row("Azure: phản hồi", True if dt < 3 else "warn", f"{dt*1000:.0f} ms" + (" (chậm)" if dt >= 3 else ""))
        if "wishes" not in h:
            row("Azure: phiên bản", "warn", "đang chạy bản cũ, cần Restart Function App để nạp bản mới (có giám sát chi tiết)")
        else:
            now = h["now"]
            results.append(("ℹ️", "Azure: số lời chúc đang hiện", str(h["wishes"])))
            results.append(("ℹ️", "Máy chủ cả công ty đang dùng", str(h.get("active") or "chưa chọn")))
            s = h.get("sync", {})
            if s.get("configured"):
                age = (now - s.get("at", 0)) / 60e3
                ok = s.get("status") == "ok" and age < 15
                row("Đồng bộ Azure ⇄ Google", ok if ok else ("warn" if h.get("active") == "azure" else False), f"{s.get('status') or 'chưa chạy'}, {age:.0f} phút trước")
            else:
                row("Đồng bộ Azure ⇄ Google", "warn", "chưa cài GOOGLE_URL / SYNC_KEY trên Azure")
            b = h.get("backup", {})
            if b.get("at"):
                age = (now - b["at"]) / 60e3; lim = b.get("everyMin", 180) * 2 + 60
                row("Sao lưu tự động", True if age < lim else "warn", f"bản mới nhất {age:.0f} phút trước (chu kỳ {b.get('everyMin')} phút, chỉ chụp khi có thay đổi)")
            else:
                row("Sao lưu tự động", "warn", "chưa có bản nào")
else:
    row("Azure", "warn", "config.js chưa có azureUrl")

# 3. Google (dự phòng)
if GOOGLE:
    st, body, dt = get(GOOGLE)
    ok = st == 200 and '"ok":true' in body.replace(" ", "")
    row("Google Apps Script (dự phòng)", True if ok and dt < 6 else "warn", f"HTTP {st}, {dt*1000:.0f} ms")

lines = ["## Giám sát Cây Tri Ân — " + time.strftime("%H:%M %d/%m/%Y", time.gmtime(time.time() + 7 * 3600)) + " (giờ VN)", "", "| | Kiểm tra | Kết quả |", "|---|---|---|"]
lines += [f"| {a} | {b} | {c} |" for a, b, c in results]
report = "\n".join(lines)
print(report)
# chú thích trên GitHub (đọc được qua API, kể cả khi không xem được log)
for a, b, c in results[:9]:
    lvl = "error" if a == "❌" else "warning" if a == "⚠️" else "notice"
    print(f"::{lvl} title={b}::{a} {c}".replace("\n", " "))
if os.environ.get("GITHUB_STEP_SUMMARY"):
    open(os.environ["GITHUB_STEP_SUMMARY"], "a").write(report + "\n")
open("report.md", "w").write(report + ("\n\n**Lỗi:**\n- " + "\n- ".join(problems) if problems else "") + ("\n\n**Lưu ý:**\n- " + "\n- ".join(warns) if warns else "") + "\n")
open("status.txt", "w").write("fail" if problems else "ok")
