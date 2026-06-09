import json
import os

CHROME_USER_DATA_DIR = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")


def get_profiles() -> dict[str, str]:
    """크롬 프로필 목록 반환 {표시 이름: 폴더명}"""
    local_state_path = os.path.join(CHROME_USER_DATA_DIR, "Local State")
    try:
        with open(local_state_path, encoding="utf-8") as f:
            data = json.load(f)
        cache = data.get("profile", {}).get("info_cache", {})
        return {info.get("name", folder): folder for folder, info in cache.items()}
    except Exception:
        return {"Default": "Default"}
