// conversa.js
// Ferramentas da conversa: o bot "digitando", perguntas com opções e perguntas abertas.
// As perguntas devolvem uma Promise, então o fluxo do pedido pode ser escrito
// em ordem, com await, como um roteiro: pergunta, espera a resposta, segue.

import { adicionarMensagem, mostrarDigitando, mostrarOpcoes, mostrarSelecao, limparOpcoes } from "./ui.js";

// Pergunta que está esperando resposta do cliente (ou null)
let pendente = null;

export class PedidoCancelado extends Error {}

// Remove acentos e símbolos e deixa minúsculo: "Cardápio!" vira "cardapio".
export function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function contemPalavra(textoNormalizado, palavra) {
  return ` ${textoNormalizado} `.includes(` ${palavra} `);
}

function esperar(milissegundos) {
  return new Promise((resolver) => setTimeout(resolver, milissegundos));
}

// O bot "digita" antes de responder, para a conversa parecer natural.
export async function botResponde(conteudo) {
  const pararDeDigitar = mostrarDigitando();
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  await esperar(reduzirMovimento ? 150 : 650);
  pararDeDigitar();
  adicionarMensagem("bot", conteudo);
}

function concluir(valor) {
  const pergunta = pendente;
  pendente = null;
  limparOpcoes();
  pergunta.resolver(valor);
}

// Pergunta com botões. Devolve a opção escolhida.
export async function perguntar(conteudo, opcoes) {
  if (conteudo) await botResponde(conteudo);

  return new Promise((resolver, rejeitar) => {
    pendente = { tipo: "opcoes", opcoes, resolver, rejeitar };
    mostrarOpcoes(opcoes, (opcao) => {
      adicionarMensagem("cliente", opcao.rotulo);
      concluir(opcao);
    });
  });
}

// Pergunta com várias opções marcáveis. Devolve a lista de ids marcados.
export async function perguntarVarios(conteudo, opcoes, rotuloConfirmar, aoMudar = () => {}) {
  if (conteudo) await botResponde(conteudo);

  return new Promise((resolver, rejeitar) => {
    const controle = mostrarSelecao(opcoes, rotuloConfirmar, aoMudar, (marcadas) => {
      const nomes = opcoes.filter((o) => marcadas.includes(o.id)).map((o) => o.rotulo);
      adicionarMensagem("cliente", nomes.length ? nomes.join(", ") : "Sem adicionais");
      concluir(marcadas);
    });
    pendente = { tipo: "varios", opcoes, controle, resolver, rejeitar };
  });
}

// Pergunta aberta: o cliente responde digitando. Devolve o texto.
// Pode ter botões de atalho (como "Pular"); nesse caso, devolve a opção clicada.
export async function perguntarTexto(conteudo, atalhos = []) {
  if (conteudo) await botResponde(conteudo);

  return new Promise((resolver, rejeitar) => {
    pendente = { tipo: "texto", opcoes: atalhos, resolver, rejeitar };
    if (atalhos.length) {
      mostrarOpcoes(atalhos, (opcao) => {
        adicionarMensagem("cliente", opcao.rotulo);
        concluir(opcao);
      });
    } else {
      limparOpcoes();
    }
  });
}

export function haPerguntaPendente() {
  return pendente !== null;
}

export function cancelarPergunta() {
  if (!pendente) return;
  const pergunta = pendente;
  pendente = null;
  limparOpcoes();
  pergunta.rejeitar(new PedidoCancelado());
}

// Procura a opção que mais combina com o que o cliente digitou.
// "quero o smash" encontra "Smash Duplo".
function encontrarOpcao(texto, opcoes) {
  const palavras = normalizar(texto).split(" ").filter((p) => p.length >= 3);
  let melhor = null;
  let maiorPontuacao = 0;

  opcoes.forEach((opcao) => {
    const rotulo = normalizar(opcao.rotulo);
    const pontuacao = palavras.filter((p) => contemPalavra(rotulo, p)).length;
    if (pontuacao > maiorPontuacao) {
      melhor = opcao;
      maiorPontuacao = pontuacao;
    }
  });

  return melhor;
}

const PALAVRAS_DE_CONFIRMAR = ["pronto", "nenhum", "nenhuma", "nao", "sem", "so isso", "ok"];

// Recebe o texto digitado quando existe uma pergunta esperando resposta.
// Devolve true se o texto foi usado como resposta.
export async function responderPendente(texto) {
  if (pendente.tipo === "texto") {
    // Digitar o nome de um atalho ("pular") vale como clicar nele
    const atalho = pendente.opcoes.find((o) => normalizar(o.rotulo) === normalizar(texto));
    concluir(atalho ?? texto);
    return true;
  }

  const textoNormalizado = normalizar(texto);
  const opcao = encontrarOpcao(texto, pendente.opcoes);

  if (pendente.tipo === "varios") {
    if (opcao) {
      pendente.controle.alternar(opcao.id);
      return true;
    }
    if (PALAVRAS_DE_CONFIRMAR.some((p) => contemPalavra(textoNormalizado, p))) {
      pendente.controle.confirmar();
      return true;
    }
    return false;
  }

  if (opcao) {
    concluir(opcao);
    return true;
  }
  return false;
}
