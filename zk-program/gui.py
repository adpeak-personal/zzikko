import tkinter as tk
from tkinter import ttk
from browser import BrowserController
from profiles import get_profiles

NAVER_LOGIN_URL = "https://nid.naver.com/nidlogin.login"
NAVER_GREEN = "#03C75A"


class App:
    def __init__(self):
        self._status_var = None  # _build_ui 전에 초기화 필요
        self.root = tk.Tk()
        self.root.title("zzikko")
        self.root.geometry("480x330")
        self.root.resizable(False, False)
        self.root.configure(bg="#f5f5f5")
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

        self.controller = BrowserController(on_status=self._set_status)
        self._profiles = get_profiles()

        self._build_ui()

    def _set_status(self, msg: str):
        # 백그라운드 스레드에서 호출되므로 root.after로 메인 스레드에서 업데이트
        self.root.after(0, lambda: self._status_var.set(f"● {msg}"))

    def _build_ui(self):
        root = self.root

        # 타이틀 바
        title_bar = tk.Frame(root, bg="#222222", height=40)
        title_bar.pack(fill=tk.X)
        tk.Label(title_bar, text="zzikko  크롬 자동화", bg="#222222", fg="white",
                 font=("Arial", 11, "bold")).pack(side=tk.LEFT, padx=15, pady=8)

        # 본문
        body = tk.Frame(root, bg="#f5f5f5", padx=16, pady=14)
        body.pack(fill=tk.BOTH, expand=True)

        # ── 왼쪽: 프로필 패널 ──────────────────────────────
        left = tk.LabelFrame(body, text=" 프로필 ", bg="#f5f5f5",
                             font=("Arial", 9, "bold"), fg="#555555",
                             padx=8, pady=8, relief=tk.GROOVE)
        left.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 12))

        canvas = tk.Canvas(left, width=148, height=180, bg="#f5f5f5",
                           highlightthickness=0)
        scrollbar = ttk.Scrollbar(left, orient="vertical", command=canvas.yview)
        inner = tk.Frame(canvas, bg="#f5f5f5")
        inner.bind("<Configure>",
                   lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self._profile_var = tk.StringVar()
        profile_names = list(self._profiles.keys())
        for name in profile_names:
            tk.Radiobutton(
                inner, text=name, variable=self._profile_var, value=name,
                bg="#f5f5f5", activebackground="#e8e8e8",
                font=("Arial", 10), anchor="w", cursor="hand2"
            ).pack(fill=tk.X, pady=2)
        if profile_names:
            self._profile_var.set(profile_names[0])

        # ── 오른쪽: 로그인 입력 패널 ────────────────────────
        right = tk.LabelFrame(body, text=" 로그인 정보 ", bg="#f5f5f5",
                              font=("Arial", 9, "bold"), fg="#555555",
                              padx=14, pady=12, relief=tk.GROOVE)
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        tk.Label(right, text="아이디", bg="#f5f5f5",
                 font=("Arial", 9), fg="#666666").pack(anchor="w")
        self._id_var = tk.StringVar()
        tk.Entry(right, textvariable=self._id_var,
                 font=("Arial", 11), relief=tk.FLAT,
                 bg="white", highlightthickness=1,
                 highlightbackground="#cccccc",
                 highlightcolor=NAVER_GREEN).pack(fill=tk.X, ipady=5, pady=(2, 10))

        tk.Label(right, text="비밀번호", bg="#f5f5f5",
                 font=("Arial", 9), fg="#666666").pack(anchor="w")
        self._pw_var = tk.StringVar()
        tk.Entry(right, textvariable=self._pw_var, show="●",
                 font=("Arial", 11), relief=tk.FLAT,
                 bg="white", highlightthickness=1,
                 highlightbackground="#cccccc",
                 highlightcolor=NAVER_GREEN).pack(fill=tk.X, ipady=5, pady=(2, 16))

        tk.Button(
            right, text="브라우저 열기",
            command=self._open_browser,
            font=("Arial", 11, "bold"),
            bg=NAVER_GREEN, fg="white",
            activebackground="#02b350", activeforeground="white",
            relief=tk.FLAT, cursor="hand2", pady=7
        ).pack(fill=tk.X)

        # ── 하단 상태 바 ────────────────────────────────────
        self._status_var = tk.StringVar(value="● 대기 중")
        status_bar = tk.Frame(root, bg="#e0e0e0", height=24)
        status_bar.pack(fill=tk.X, side=tk.BOTTOM)
        tk.Label(status_bar, textvariable=self._status_var,
                 bg="#e0e0e0", fg="#444444",
                 font=("Arial", 9), anchor="w").pack(side=tk.LEFT, padx=10, pady=3)

    def _open_browser(self):
        if not self.controller.is_running:
            selected = self._profile_var.get()
            profile_dir = self._profiles.get(selected, "Default")
            self.controller.set_profile(profile_dir)
            self.controller.start()
        self._goto_when_ready(NAVER_LOGIN_URL)

    def _goto_when_ready(self, url: str, attempts: int = 0):
        if self.controller._ready.is_set():
            self.controller.goto(url)
        elif not self.controller.is_running and attempts > 0:
            pass  # 스레드가 죽음 → _on_status에 이미 에러 표시됨
        elif attempts < 300:  # 최대 30초 대기
            self.root.after(100, lambda: self._goto_when_ready(url, attempts + 1))
        else:
            self._set_status("브라우저 시작 실패 (시간 초과)")

    def _on_close(self):
        self.controller.close()
        self.root.destroy()

    def run(self):
        self.root.mainloop()
