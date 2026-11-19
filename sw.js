// Service worker do Analor: guarda o app no aparelho para abrir sem internet depois da primeira visita.
// Ao publicar uma versão nova, troque o número em CACHE (acompanha src/versao.ts).
const CACHE = "analor-v0.4.2";
const API = "analor-api";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll(["./", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"]).then(() =>
          // opcional: a base de compostos em arquivo (só existe em alguns sites; se faltar, segue sem ela)
          c.add("./dados/identificar.json").catch(() => undefined),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== API && k !== "analor-fontes").map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// A página manda a lista do que já carregou na primeira visita, para o app abrir offline logo na segunda abertura.
self.addEventListener("message", (e) => {
  if (!e.data || e.data.tipo !== "guardar" || !Array.isArray(e.data.urls)) return;
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(e.data.urls.filter((u) => u.indexOf(self.location.origin) === 0).map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => undefined)))),
    ),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fontes do Google: guarda na primeira vez com internet e reutiliza depois.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open("analor-fontes").then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        }),
      ),
    );
    return;
  }

  // Base de compostos e abreviações (servidor do Analor): mostra o que está guardado e atualiza ao fundo.
  if (url.origin !== location.origin) {
    if (/\/(identificar|abrev)$/.test(url.pathname)) {
      e.respondWith(
        caches.open(API).then((c) =>
          c.match(req).then((hit) => {
            const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
            return hit || net;
          }),
        ),
      );
    }
    return;
  }

  // Arquivos do próprio app: rede primeiro (a versão nova aparece quando há internet); sem internet, usa o guardado.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("./"))),
  );
});
