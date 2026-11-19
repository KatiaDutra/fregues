// sw.js
// Service worker do Freguês: é o que permite instalar o chat e os painéis como aplicativo
// e abrir as telas mesmo com a internet instável.
//
// Estratégia "rede primeiro": com internet, sempre busca a versão mais nova
// (cardápio e código atualizados na hora); sem internet, usa a cópia guardada.
// Pedidos, pagamentos e selos continuam passando pelo Firebase, que não é guardado aqui.

const VERSAO = "fregues-v5";

const ARQUIVOS_BASE = [
  "./",
  "index.html",
  "cozinha.html",
  "admin.html",
  "css/estilos.css",
  "css/cozinha.css",
  "css/admin.css",
  "js/main.js",
  "js/app.js",
  "js/config.js",
  "js/tema.js",
  "js/horario.js",
  "js/ui.js",
  "js/bot.js",
  "js/conversa.js",
  "js/fluxo-pedido.js",
  "js/pedido.js",
  "js/whatsapp.js",
  "js/fidelidade.js",
  "js/avaliacao.js",
  "js/firebase.js",
  "js/banco.js",
  "js/acesso.js",
  "js/cozinha.js",
  "js/admin.js",
  "js/exportacao.js",
  "config/ze-burger.json",
  "assets/img/favicon.ico",
  "assets/img/icone-redondo.png",
];

// Na instalação, guarda as telas principais. Um arquivo que falhar não impede a instalação.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => Promise.allSettled(ARQUIVOS_BASE.map((arquivo) => cache.add(arquivo))))
  );
  self.skipWaiting();
});

// Ao ativar uma versão nova, apaga as cópias das versões antigas
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== VERSAO).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  // Só arquivos do próprio site: Firebase, fontes e outros serviços seguem direto para a rede
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    fetch(pedido)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
        }
        return resposta;
      })
      .catch(async () => {
        // Sem internet: a cópia guardada (ignorando ?avaliar= e ?origem=), ou o chat para as navegações
        const guardado = await caches.match(pedido, { ignoreSearch: true });
        if (guardado) return guardado;
        if (pedido.mode === "navigate") return caches.match("index.html");
        return Response.error();
      })
  );
});
