"""
CampusMate PWA 정적 파일 회귀 테스트

frontend-web/dist 빌드 결과물에 PWA 설치에 필요한 파일이 포함되고,
백엔드가 루트 경로에서 이를 서비스하는지 확인한다.
(lifespan을 실행하지 않아 RAG 초기화 없이 정적 파일만 검사한다.)
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.main import app

DIST = Path(__file__).resolve().parent.parent / "frontend-web" / "dist"

pytestmark = pytest.mark.skipif(
    not (DIST / "index.html").is_file(), reason="frontend-web/dist 빌드 결과물이 없습니다"
)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_index_links_manifest(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert 'rel="manifest"' in resp.text
    assert resp.headers["cache-control"] == "no-cache"


def test_manifest_is_installable(client):
    manifest = client.get("/manifest.json").json()
    assert manifest["display"] == "standalone"
    assert manifest["start_url"] == "/"
    sizes = {icon["sizes"] for icon in manifest["icons"]}
    assert {"192x192", "512x512"} <= sizes
    for icon in manifest["icons"]:
        assert client.get(icon["src"]).status_code == 200


def test_service_worker_served_at_root(client):
    resp = client.get("/sw.js")
    assert resp.status_code == 200
    assert "javascript" in resp.headers["content-type"]


def test_service_worker_skips_api(client):
    """서비스 워커가 공지 데이터(API) 응답을 캐시하지 않아야 한다."""
    assert '"/api/"' in client.get("/sw.js").text


def test_api_routes_take_precedence(client):
    assert client.get("/openapi.json").status_code == 200
