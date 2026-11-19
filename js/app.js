// app.js
// O Freguês como aplicativo (PWA): registra o service worker e oferece a instalação.
// O cliente instala o chat com o ícone e o nome da loja; a equipe instala os painéis com a marca do Freguês.

export function registrarApp() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch((erro) => console.error("Service worker não registrado:", erro));
}

// O manifesto do chat vem da configuração da loja (white-label)
export function aplicarApp(loja) {
  const cabeca = document.head;
  const manifesto = Object.assign(document.createElement("link"), { rel: "manifest", href: loja.app.manifesto });
  cabeca.append(manifesto);

  const iconeIphone = document.querySelector('link[rel="apple-touch-icon"]');
  if (iconeIphone && loja.app.iconeIphone) iconeIphone.href = loja.app.iconeIphone;

  const corDoTopo = document.querySelector('meta[name="theme-color"]');
  if (corDoTopo) corDoTopo.content = loja.tema.principal;
}

// O navegador avisa quando o app pode ser instalado; aí o botão aparece.
// No iPhone esse aviso não existe: lá se instala pelo menu Compartilhar > Adicionar à Tela de Início.
export function oferecerInstalacao(botao) {
  if (!botao) return;
  let convite = null;

  window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    convite = evento;
    botao.hidden = false;
  });

  botao.addEventListener("click", async () => {
    if (!convite) return;
    botao.hidden = true;
    convite.prompt();
    await convite.userChoice;
    convite = null;
  });

  window.addEventListener("appinstalled", () => {
    botao.hidden = true;
  });
}
