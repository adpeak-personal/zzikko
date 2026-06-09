import subprocess
import threading
import queue
import time
import os
from typing import Callable
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from profiles import CHROME_USER_DATA_DIR

_STOP = object()


class BrowserController:
    def __init__(self, on_status: Callable[[str], None] | None = None):
        self._queue = queue.Queue()
        self._thread = None
        self._profile_dir = "Default"
        self._ready = threading.Event()
        self._on_status = on_status or (lambda msg: print(f"[Status] {msg}"))

    def set_profile(self, profile_dir: str):
        self._profile_dir = profile_dir

    @property
    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self):
        if self.is_running:
            return
        self._ready.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):

        subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True)
        time.sleep(1.5)
        lock_file = os.path.join(CHROME_USER_DATA_DIR, "SingletonLock")
        if os.path.exists(lock_file):
            os.remove(lock_file)
            print('[BrowserController] SingletonLock 삭제됨')
        print('[BrowserController] Starting browser thread...')
        
        print(CHROME_USER_DATA_DIR)
        print(self._profile_dir)
        try:
            with sync_playwright() as p:
                # 2. launch() 대신 launch_persistent_context()를 사용합니다.
                context = p.chromium.launch_persistent_context(
                    user_data_dir=CHROME_USER_DATA_DIR,
                    channel="chrome",
                    args=[f"--profile-directory={self._profile_dir}"],
                    headless=False,
                    timeout=15000,
                )
                print('브라우저 시작 되었음?')                
                # 3. 기존에는 browser.new_page() 였지만, 여기서는 context에서 바로 엽니다.
                page = context.pages[0] if context.pages else context.new_page()
                print(page)
                
                # 웹사이트로 이동 (로그인 정보가 유지되는지 확인해보세요!)
                page.goto('https://naver.com')
                print("현재 페이지 제목:", page.title())

                # 테스트용으로 잠시 띄워두기
                page = context.pages[0] if context.pages else context.new_page()
                page.goto("https://google.com")
                page.wait_for_timeout(5000)
                
                context.close()

        except PlaywrightTimeoutError as e:
            print(e)
            print("❌ 에러: 브라우저 실행 타임아웃! (크롬이 이미 실행 중이거나 경로 문제일 수 있습니다.)")
        except Exception as e:
            print(f"❌ 알 수 없는 에러 발생: {e}")
        # try:
        #     self._on_status("Chrome 시작 중...")
        #     with sync_playwright() as p:
        #         context = p.chromium.launch_persistent_context(
        #             user_data_dir=CHROME_USER_DATA_DIR,
        #             channel="chrome",
        #             args=[f"--profile-directory={self._profile_dir}"],
        #             ignore_default_args=["--no-sandbox"],
        #             headless=False,
        #         )
        #         self._ready.set()
        #         self._on_status("연결 완료")

        #         while True:
        #             try:
        #                 task = self._queue.get(timeout=0.3)
        #                 if task is _STOP:
        #                     break
        #                 try:
        #                     task(context)
        #                 except Exception as e:
        #                     print(f"[Task 오류] {e}")
        #             except queue.Empty:
        #                 pass

        #         context.close()
        # except Exception as e:
        #     msg = str(e).splitlines()[0]  # 첫 줄만 (Playwright 에러는 길어서)
        #     self._on_status(f"오류: {msg}")
        #     print(f"[BrowserController 오류] {e}")
        # finally:
        #     self._ready.clear()
        #     while not self._queue.empty():
        #         try:
        #             self._queue.get_nowait()
        #         except queue.Empty:
        #             break

    def goto(self, url: str):
        def navigate(context):
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded")
            page.bring_to_front()
        self._queue.put(navigate)

    def close(self):
        if self.is_running:
            self._queue.put(_STOP)
            self._thread.join(timeout=5)
