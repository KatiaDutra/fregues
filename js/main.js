// main.js
// Ponto de entrada da página do cliente.
import { carregarConfiguracao } from "./config.js";

async function iniciar() {
  try {
    const loja = await carregarConfiguracao();
    document.title = `${loja.loja.nome} | Freguês`;
    console.log("Configuração carregada:", loja.loja.nome);
  } catch (erro) {
    console.error(erro);
  }
}

iniciar();
