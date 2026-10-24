"""Local application client; security regressions use the unmodified TestClient."""
from fastapi.testclient import TestClient


class LocalClient(TestClient):
    def __init__(self, app, **kwargs):
        kwargs.setdefault("base_url", "http://localhost")
        super().__init__(app, **kwargs)
        self.headers["X-LatentSpace-Token"] = self.get("/api/session").json()["token"]
