"""Demo clipboard entries for ClipFlow Pro screenshots and videos.

A short, tidy set: text, a link, code, JSON, a currency line, several
languages and scripts (including right-to-left), symbols and emoji.
Nothing here is real user data.
"""

# (text, pinned, starred). Listed oldest -> newest.
DEMO_ENTRIES = [
    ("Welcome to ClipFlow Pro — your GNOME clipboard history", True, False),
    ("https://github.com/nickotmazgin/clipflow-pro", True, False),
    ("git log --oneline --graph -n 20", False, True),
    ('{"app": "ClipFlow Pro", "version": "1.5.3", "gnome": "45–50"}', False, False),
    ("Invoice #2026-1017 · Total €1,249.90 · Due 31/10/2026", False, True),
    ("Bonjour · ¡Hola! · Hallo · Привет · こんにちは · 你好", False, False),
    ("שלום עולם · مرحبا بالعالم · नमस्ते दुनिया", False, False),
    ("π ≈ 3.14159 · √2 ≈ 1.41421 · ✅ 🚀 📋", False, False),
]
