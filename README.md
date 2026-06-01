# 📸🎬 Photo & Video Transfer

A **local-only**, **offline-capable** LAN transfer tool.
Send photos and videos from your Android phone (or any device) to your Mac over Wi-Fi — no cloud, no internet, no accounts.

---

## How It Works

```
Android Phone  ──Wi-Fi──►  FastAPI Server (Mac)  ──►  ~/PhotoTransfers/YYYY-MM-DD/
```

Your Mac runs a tiny web server. Every device on the same Wi-Fi network can open
it in a browser and upload photos and videos directly. Nothing leaves your local network.

---

## Requirements

| Requirement | Version      |
|-------------|--------------|
| Python      | 3.10+        |
| macOS       | Any modern   |
| Network     | All devices on the same Wi-Fi |

---

## Installation

### 1. Download the project

```bash
# Unzip the downloaded archive, then:
cd photo-transfer
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate        # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Running the Server

```bash
# Make sure your venv is active
source .venv/bin/activate

python main.py
```

You will see a banner like:

```
╔══════════════════════════════════════════════╗
║       📸🎬  Photo & Video Transfer           ║
╠══════════════════════════════════════════════╣
║                                              ║
║   On your Android phone, open:               ║
║                                              ║
║     http://192.168.1.42:8000                 ║
║                                              ║
║   Files will be saved to:                    ║
║     /Users/you/PhotoTransfers                ║
║                                              ║
║   No internet. No cloud. LAN only. ✓         ║
╚══════════════════════════════════════════════╝
```

---

## Sending Photos & Videos from Android

1. Make sure your phone and Mac are on the **same Wi-Fi network**.
2. Open the URL shown in the banner in your phone's browser (Chrome recommended).
3. Tap **🖼️ Select Photos** to pick images — opens Google Photos / gallery.
4. Tap **🎬 Select Videos** to pick videos — opens the Files app filtered to videos.
5. You can tap both buttons to build a mixed queue before uploading.
6. Tap **⬆ Transfer to Mac** and watch the per-file progress.

> **Why two buttons?**
> Android Chrome ignores a combined `accept="image/*,video/*"` attribute and
> silently shows photos only. Two separate inputs — one with `accept="image/*"`,
> one with `accept="video/*"` — each open the correct native picker.

---

## Supported File Types

| Type   | Extensions                          |
|--------|-------------------------------------|
| Images | `.jpg` `.jpeg` `.png`               |
| Videos | `.mp4` `.mov` `.avi` `.mkv` `.webm` `.3gp` `.m4v` |

To add more types, edit `ALLOWED_EXTENSIONS` and `ALLOWED_MIME_TYPES` in `main.py`.

---

## Where Files Are Saved

```
~/PhotoTransfers/
└── 2026-06-01/
    ├── IMG_0001.jpg
    ├── IMG_0001(1).jpg     ← collision-safe, original never overwritten
    ├── IMG_0002.png
    └── VID_20260601.mp4
```

- A date folder is created automatically for each day.
- Duplicate filenames get `(1)`, `(2)`, … appended — originals are **never overwritten**.
- A `transfers.log` (newline-delimited JSON) records every transfer locally.

---

## Per-file Size Limit

| Limit | Value |
|-------|-------|
| Per file | 4 GB |
| Total batch | Unlimited |

Long 4K videos are handled. The server reads files in chunks so RAM usage stays low.

---

## Bulk Uploads

- Select up to 200+ photos or videos in one session.
- Files are uploaded in batches of 10 per HTTP request so Android does not run out of memory.
- The progress bar and per-file queue show live status for every file.
- Photos and video previews (thumbnails) are shown before uploading; only the first 50 are rendered to keep the browser responsive.

---

## Desktop Features

Open `http://localhost:8000` on your Mac to see:

- Total files received (live-updating)
- Recent transfers list with file size and timestamp
- Storage folder path
- Server IP address to share with other devices

Desktop browsers also support **drag and drop** — drag files directly onto the drop zone.

---

## Finding Your Local IP (manual)

If the auto-detection shows `127.0.0.1`, find your IP manually:

**macOS:**
```bash
ipconfig getifaddr en0      # Wi-Fi
# or
ifconfig | grep "inet " | grep -v 127
```

**Windows:**
```cmd
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter
```

**Linux:**
```bash
hostname -I
```

Then open `http://<your-ip>:8000` on your phone.

---

## Configuration

All settings are at the top of `main.py`:

```python
TRANSFER_ROOT = Path.home() / "PhotoTransfers"   # Save location
MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024           # 4 GB per file
```

To change the port:

```python
# Bottom of main.py
uvicorn.run("main:app", host="0.0.0.0", port=8080, ...)
```

---

## Stopping the Server

Press `Ctrl+C` in the terminal.

---

## Supported Devices & Browsers

| Device        | Browser                              |
|---------------|--------------------------------------|
| Android       | Chrome ✓, Samsung Internet ✓, Firefox ✓ |
| iPhone / iPad | Safari ✓, Chrome ✓                  |
| Mac           | Safari ✓, Chrome ✓, Firefox ✓       |
| Windows       | Chrome ✓, Edge ✓, Firefox ✓         |
| Linux         | Any modern browser ✓                 |

All devices must be on the same Wi-Fi network.

---

## Troubleshooting

### Phone can't reach the server

- Confirm both devices are on the **same Wi-Fi network** (not a guest network).
- Check macOS Firewall: **System Settings → Network → Firewall** → allow incoming connections for Python.
- If your router uses **AP Isolation / Client Isolation**, devices cannot talk to each other — disable it in your router settings.
- Try pinging the Mac's IP from your phone using a ping app.

### Videos not showing in the picker

- Use the **🎬 Select Videos** button, not the photos button.
- On some Android versions the Files app may open instead of the gallery — navigate to your DCIM folder.
- If videos still do not appear, try Samsung Internet or Firefox instead of Chrome.

### `127.0.0.1` shown instead of real IP

- Your Mac may have multiple network interfaces. Run `ipconfig getifaddr en0` and use that IP.

### Large video upload is slow

- A 1 GB video over a typical home Wi-Fi (50 Mbps upload) takes about 2–3 minutes. This is normal.
- Stay close to the router for best speed.
- Ensure no other devices are saturating the network.

### Port 8000 already in use

```bash
# Find what is using port 8000
lsof -i :8000

# Then change the port in main.py to e.g. 8080
```

### Permission denied saving files

- The server saves to `~/PhotoTransfers/`. Ensure your user account has write access to your home directory.

---

## Security Notes

- **LAN only.** The server binds to `0.0.0.0` (all interfaces) but your home router blocks external access by default.
- **No authentication.** Anyone on your Wi-Fi can upload files. Use on trusted networks only.
- **No encryption (HTTP).** Traffic is unencrypted within your LAN. Do not use on public Wi-Fi.
- **No telemetry.** Zero external requests of any kind.
- For extra security, bind to your specific LAN IP only:
  ```python
  uvicorn.run("main:app", host="192.168.1.42", port=8000, ...)
  ```

---

## Project Structure

```
photo-transfer/
│
├── main.py                  ← FastAPI server
├── requirements.txt         ← Python dependencies
├── README.md
│
├── static/
│   ├── style.css            ← Styles (dark/light mode, mobile-first)
│   └── app.js               ← Upload logic, preview, progress
│
├── templates/
│   └── index.html           ← Single-page UI
│
└── uploads/                 ← Placeholder (actual saves go to ~/PhotoTransfers)
```

---

## License

MIT — do whatever you want with it. No warranty.