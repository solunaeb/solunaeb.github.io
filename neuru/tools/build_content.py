#!/usr/bin/env python3
"""
널 사랑할고양 — 편지·음원 빌드 스크립트

  content/letters.txt        편지 원고 (이 파일 하나만 고치면 됩니다)
  content/music/day01.mp3    Day 1 음악 (day01 ~ day21, 없으면 대체 멜로디가 재생됨)
  content/photos/album/      첫 번째 서랍: 사진 앨범 (여러 장, 파일 이름 순서대로)
  content/photos/torch/      두 번째 서랍: 횃불 사진
  content/photos/buldak/     세 번째 서랍: 까르보 불닭볶음면 사진
  content/photos/frame.png   액자 사진 (jpg 도 가능)
  ※ 사진 파일 이름이 "01_첫 데이트.jpg" 라면 "첫 데이트" 가 설명으로 표시됩니다.

실행:  python tools/build_content.py
결과:  data/content.json, data/audio/dayNN.bin, data/build-info.js  (이 결과물만 GitHub 에 올라감)

필요 패키지:  pip install cryptography
"""
import base64, hashlib, json, os, re, sys, time
from pathlib import Path

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    sys.exit("cryptography 패키지가 필요합니다:  pip install cryptography")

ROOT = Path(__file__).resolve().parent.parent
LETTERS = ROOT / "content" / "letters.txt"
MUSIC = ROOT / "content" / "music"
OUT = ROOT / "data"
AUDIO_OUT = OUT / "audio"
PHOTOS = ROOT / "content" / "photos"
PHOTO_OUT = OUT / "photos"
IMG_EXT = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
TOTAL_DAYS = 21


def read_secret():
    cfg = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    m = re.search(r"CONTENT_SECRET\s*=\s*'([^']+)'", cfg)
    if not m:
        sys.exit("js/config.js 에서 CONTENT_SECRET 을 찾지 못했습니다.")
    return m.group(1)


SECRET = read_secret()


def key_for(tag: str) -> bytes:
    return hashlib.sha256(f"{SECRET}:{tag}".encode()).digest()


def seal(tag: str, data: bytes):
    iv = os.urandom(12)
    return iv, AESGCM(key_for(tag)).encrypt(iv, data, None)


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def parse_letters(text: str):
    blocks, current, name = {}, None, None
    for line in text.splitlines():
        m = re.match(r"^===\s*(DAY\s*(\d+)|FINALE)\s*===\s*$", line.strip(), re.I)
        if m:
            name = f"day{int(m.group(2))}" if m.group(2) else "finale"
            current = blocks.setdefault(name, [])
            continue
        if current is None:
            continue  # 첫 블록 이전(설명·주석)은 무시
        current.append(line)

    parsed = {}
    for name, lines in blocks.items():
        meta = {"title": "", "song": ""}
        i = 0
        # 머리말: 빈 줄 / "제목: ..." / "곡명: ..." / "---" 는 본문 앞에서만 인식
        while i < len(lines):
            s = lines[i].strip()
            mm = re.match(r"^(제목|곡명)\s*:\s*(.*)$", s)
            if not s:
                i += 1
            elif mm:
                meta["title" if mm.group(1) == "제목" else "song"] = mm.group(2).strip()
                i += 1
            elif s == "---":
                i += 1
                break
            else:
                break
        meta["text"] = "\n".join(lines[i:]).strip()
        parsed[name] = meta
    return parsed


def find_mp3(day: int):
    for cand in (f"day{day:02d}.mp3", f"day{day}.mp3", f"Day{day:02d}.mp3", f"Day{day}.mp3"):
        p = MUSIC / cand
        if p.exists():
            return p
    return None


def load_photo(path: Path):
    """사진을 읽어 (bytes, mime) 반환. Pillow 가 있으면 긴 변 1600px 로 줄여 용량을 아낌."""
    mime = IMG_EXT[path.suffix.lower()]
    data = path.read_bytes()
    try:
        from PIL import Image, ImageOps
        import io
        im = ImageOps.exif_transpose(Image.open(path))
        if max(im.size) > 1600 or len(data) > 1_500_000:
            im.thumbnail((1600, 1600))
            buf = io.BytesIO()
            if im.mode in ("RGBA", "LA", "P") and mime == "image/png":
                im.save(buf, "PNG", optimize=True)
            else:
                im.convert("RGB").save(buf, "JPEG", quality=86)
                mime = "image/jpeg"
            data = buf.getvalue()
    except ImportError:
        pass
    return data, mime


def caption_of(path: Path):
    return re.sub(r"^[\d\s._-]+", "", path.stem).strip()


def build_photos():
    PHOTO_OUT.mkdir(parents=True, exist_ok=True)
    for old in PHOTO_OUT.glob("*.bin"):
        old.unlink()
    result, report = {}, []
    for group in ("album", "torch", "buldak"):
        folder = PHOTOS / group
        files = sorted(p for p in folder.glob("*") if p.suffix.lower() in IMG_EXT) if folder.exists() else []
        items = []
        for i, f in enumerate(files, 1):
            data, mime = load_photo(f)
            src = f"./data/photos/{group}-{i:02d}.bin"
            iv, ct = seal("photo:" + src, data)
            (PHOTO_OUT / f"{group}-{i:02d}.bin").write_bytes(iv + ct)
            items.append({"src": src, "caption": caption_of(f), "type": mime})
        result[group] = items
        report.append(f"  사진 {group:7s} {len(items)}장")
    frame = None
    for ext in IMG_EXT:
        f = PHOTOS / f"frame{ext}"
        if f.exists():
            data, mime = load_photo(f)
            src = "./data/photos/frame.bin"
            iv, ct = seal("photo:" + src, data)
            (PHOTO_OUT / "frame.bin").write_bytes(iv + ct)
            frame = {"src": src, "caption": "", "type": mime}
            break
    result["frame"] = frame
    report.append("  액자         " + ("있음" if frame else "없음 (기본 풍경화)"))
    return result, report


def main():
    if not LETTERS.exists():
        sys.exit(f"{LETTERS} 파일이 없습니다.")
    letters = parse_letters(LETTERS.read_text(encoding="utf-8"))
    AUDIO_OUT.mkdir(parents=True, exist_ok=True)
    for old in AUDIO_OUT.glob("*.bin"):
        old.unlink()

    days, report = [], []
    for d in range(1, TOTAL_DAYS + 1):
        letter = letters.get(f"day{d}", {"title": "", "song": "", "text": ""})
        if not letter["text"]:
            letter["text"] = f"(Day {d} 편지가 아직 비어 있어요)"
        iv, ct = seal(f"day:{d}", json.dumps(letter, ensure_ascii=False).encode())
        entry = {"day": d, "iv": b64(iv), "data": b64(ct), "audio": None}

        mp3 = find_mp3(d)
        if mp3:
            aiv, act = seal(f"audio:{d}", mp3.read_bytes())
            (AUDIO_OUT / f"day{d:02d}.bin").write_bytes(aiv + act)
            entry["audio"] = f"./data/audio/day{d:02d}.bin"
        days.append(entry)
        report.append(f"  Day {d:2d}  글자 {len(letter['text']):5d}  음악 {'O ' + mp3.name if mp3 else '— (대체 멜로디)'}")

    finale = letters.get("finale", {"title": "", "song": "", "text": ""})
    fiv, fct = seal("finale", json.dumps(finale, ensure_ascii=False).encode())

    photos, photo_report = build_photos()
    build_id = hashlib.sha256(json.dumps(days).encode() + fct + json.dumps(photos).encode()).hexdigest()[:12]
    manifest = {"build": build_id, "days": days, "finale": {"iv": b64(fiv), "data": b64(fct)}, "photos": photos}
    files = [d["audio"] for d in days if d["audio"]] + [p["src"] for g in ("album", "torch", "buldak") for p in photos[g]]
    if photos["frame"]:
        files.append(photos["frame"]["src"])
    (OUT / "content.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    (OUT / "build-info.js").write_text(
        f"// 자동 생성 파일 — 수정하지 마세요\nself.CONTENT_BUILD = '{build_id}';\n"
        f"self.CONTENT_FILES = {json.dumps(files)};\n",
        encoding="utf-8",
    )

    print("빌드 완료 (" + time.strftime("%Y-%m-%d %H:%M") + ")  build=" + build_id)
    print("\n".join(report))
    print("  FINALE   " + ("작성됨" if finale["text"] else "비어 있음"))
    print("\n".join(photo_report))


if __name__ == "__main__":
    main()
