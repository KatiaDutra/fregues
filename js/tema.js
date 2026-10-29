// tema.js
// Aplica as cores e fontes da loja na página.
// Cada loja tem o próprio tema no arquivo de configuração (white-label).

export function aplicarTema(tema) {
  const raiz = document.documentElement.style;

  raiz.setProperty("--cor-fundo", tema.fundo);
  raiz.setProperty("--cor-principal", tema.principal);
  raiz.setProperty("--cor-texto-sobre-principal", tema.textoSobrePrincipal);
  raiz.setProperty("--cor-destaque", tema.destaque);
  raiz.setProperty("--cor-texto", tema.texto);
  raiz.setProperty("--cor-alerta", tema.alerta);
  raiz.setProperty("--fonte-titulos", `"${tema.fonteTitulos}", system-ui, sans-serif`);
  raiz.setProperty("--fonte-texto", `"${tema.fonteTexto}", system-ui, sans-serif`);
}

// Usa o avatar da loja como ícone da aba do navegador.
export function aplicarIcone(caminhoDoAvatar) {
  const icone = document.querySelector('link[rel="icon"]');
  if (icone) {
    icone.href = caminhoDoAvatar;
  }
}
