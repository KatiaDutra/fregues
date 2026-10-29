// config.js
// Carrega o arquivo de configuração da loja (cardápio, horários, regras).
// Trocando o arquivo, o Freguês passa a atender outro negócio.

const ARQUIVO_DA_LOJA = "config/ze-burger.json";

export async function carregarConfiguracao() {
  const resposta = await fetch(ARQUIVO_DA_LOJA);

  if (!resposta.ok) {
    throw new Error("Não foi possível carregar a configuração da loja.");
  }

  return resposta.json();
}
