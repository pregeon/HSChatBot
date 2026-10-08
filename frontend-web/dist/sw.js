// CampusMate 서비스 워커
// - 화면(HTML)은 네트워크 우선: 온라인이면 항상 최신 배포 화면, 오프라인이면 마지막 화면.
// - /assets/* 는 파일명에 해시가 붙어 내용이 바뀌지 않으므로 캐시 우선.
// - /api, /health 등 데이터 요청은 캐시하지 않는다 (공지 정보는 항상 최신이어야 함).
// 캐시 구조를 바꿀 때만 CACHE_VERSION을 올려 이전 캐시를 지운다.

const CACHE_VERSION = "campusmate-v1";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];
const NETWORK_ONLY = ["/api/", "/health", "/docs", "/redoc", "/openapi.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function putInCache(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => putInCache(request, res))),
    );
    return;
  }

  // no-cache: 브라우저 HTTP 캐시의 옛 파일 대신 서버에 재검증한다.
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((res) => putInCache(request, res))
      .catch(() =>
        caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("/") : undefined)),
      ),
  );
});
