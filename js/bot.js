// bot.js
// Conversa com o cliente: acolhimento, perguntas frequentes e menu principal.
// O pedido em si fica em fluxo-pedido.js.
// Nesta etapa o bot entende texto livre por palavras-chave.

import { adicionarMensagem, mostrarOpcoes, limparOpcoes, definirEtapa } from "./ui.js";
import { botResponde, normalizar, contemPalavra, haPerguntaPendente, responderPendente, cancelarPergunta } from "./conversa.js";
import { statusDaLoja, descreverDias } from "./horario.js";
import { formatarPreco } from "./pedido.js";
import { fazerPedido } from "./fluxo-pedido.js";

let loja = null;
let fazendoPedido = false;

const OPCOES_PRINCIPAIS = [
  { id: "pedido", rotulo: "Fazer pedido" },
  { id: "cardapio", rotulo: "Ver cardápio" },
  { id: "horario", rotulo: "Horário" },
  { id: "entrega", rotulo: "Entrega e taxas" },
  { id: "pagamento", rotulo: "Formas de pagamento" },
];

// Palavras que levam a cada resposta quando o cliente digita.
// A saudação fica por último: em "boa noite, entregam no centro?",
// o assunto principal é a entrega, não o cumprimento.
const PALAVRAS_CHAVE = {
  pedido: ["pedir", "pedido", "quero", "fome"],
  cardapio: ["cardapio", "menu", "lanche", "lanches", "burger", "burgers", "hamburguer", "opcoes"],
  horario: ["horario", "abre", "abrem", "fecha", "fecham", "aberto", "funciona", "funcionamento"],
  entrega: ["entrega", "entregam", "entregar", "taxa", "bairro", "delivery", "frete"],
  pagamento: ["pagamento", "pagar", "pix", "cartao", "dinheiro", "troco"],
  saudacao: ["oi", "ola", "bom dia", "boa tarde", "boa noite", "e ai"],
};

// ---------- Respostas ----------

function criarLista(itens) {
  const lista = document.createElement("ul");
  lista.className = "lista-cardapio";

  itens.forEach((item) => {
    const linha = document.createElement("li");
    const nome = document.createElement("strong");
    nome.textContent = item.nome;
    const preco = document.createElement("span");
    preco.className = "preco";
    preco.textContent = formatarPreco(item.preco);
    linha.append(nome, preco);

    if (item.descricao) {
      const descricao = document.createElement("small");
      descricao.textContent = item.descricao;
      linha.append(descricao);
    }
    lista.append(linha);
  });

  return lista;
}

function respostaCardapio() {
  const bloco = document.createDocumentFragment();
  const intro = document.createElement("p");
  intro.textContent = "Estes são os nossos burgers:";
  const rodape = document.createElement("p");
  rodape.textContent = `Também temos acompanhamentos, bebidas e o ${loja.cardapio.combo.nome}.`;
  bloco.append(intro, criarLista(loja.cardapio.burgers), rodape);
  return bloco;
}

function respostaHorario() {
  const dias = descreverDias(loja.horario.diasDaSemana);
  const status = statusDaLoja(loja.horario);
  const agora = status.aberta ? "Estamos abertos agora!" : `Agora estamos fechados. ${status.resumo.replace("Fechado, a", "A")}.`;
  return `Funcionamos ${dias}, das ${loja.horario.abre} às ${loja.horario.fecha}. ${agora}`;
}

function respostaEntrega() {
  const bloco = document.createDocumentFragment();
  const intro = document.createElement("p");
  intro.textContent = "Entregamos nestes bairros:";
  const lista = criarLista(loja.entrega.bairros.map((b) => ({ nome: b.nome, preco: b.taxa })));
  const regras = document.createElement("p");
  const minimo = formatarPreco(loja.entrega.pedidoMinimo);
  regras.textContent = loja.entrega.retiradaNoBalcao
    ? `O pedido mínimo para entrega é ${minimo}. Se preferir, você também pode retirar no balcão, sem taxa.`
    : `O pedido mínimo para entrega é ${minimo}.`;
  bloco.append(intro, lista, regras);
  return bloco;
}

function respostaPagamento() {
  const formas = loja.pagamento;
  const texto = formas.length > 1 ? `${formas.slice(0, -1).join(", ")} ou ${formas.at(-1)}` : formas[0];
  return `Você pode pagar com ${texto}.`;
}

const RESPOSTAS = {
  saudacao: () => "Oi! Em que posso ajudar?",
  cardapio: respostaCardapio,
  horario: respostaHorario,
  entrega: respostaEntrega,
  pagamento: respostaPagamento,
};

// ---------- Fluxo da conversa ----------

function mostrarMenu() {
  mostrarOpcoes(OPCOES_PRINCIPAIS, escolherOpcao);
}

async function iniciarPedido() {
  fazendoPedido = true;
  await fazerPedido(loja);
  fazendoPedido = false;
  mostrarMenu();
}

async function responder(idDaResposta) {
  limparOpcoes();
  if (idDaResposta === "pedido") {
    await iniciarPedido();
    return;
  }
  await botResponde(RESPOSTAS[idDaResposta]());
  mostrarMenu();
}

function escolherOpcao(opcao) {
  adicionarMensagem("cliente", opcao.rotulo);
  responder(opcao.id);
}

export async function responderTexto(texto) {
  adicionarMensagem("cliente", texto);
  const textoNormalizado = normalizar(texto);

  // Durante o pedido, o texto responde à pergunta atual
  if (fazendoPedido) {
    if (contemPalavra(textoNormalizado, "cancelar")) {
      cancelarPergunta();
      return;
    }
    if (haPerguntaPendente() && !(await responderPendente(texto))) {
      await botResponde("Não encontrei essa opção. Escolha uma das opções abaixo, ou digite cancelar para desistir do pedido.");
    }
    return;
  }

  limparOpcoes();

  // 1. Dúvidas cadastradas pela loja na configuração
  const duvida = loja.duvidas.find((d) => d.palavras.some((p) => contemPalavra(textoNormalizado, normalizar(p))));
  if (duvida) {
    await botResponde(duvida.resposta);
    mostrarMenu();
    return;
  }

  // 2. Assuntos que o bot já conhece
  const assunto = Object.keys(PALAVRAS_CHAVE).find((chave) =>
    PALAVRAS_CHAVE[chave].some((palavra) => contemPalavra(textoNormalizado, palavra))
  );
  if (assunto) {
    await responder(assunto);
    return;
  }

  // 3. Não entendeu: oferece as opções
  await botResponde("Ainda não entendi essa. Pode escolher uma das opções abaixo?");
  mostrarMenu();
}

export async function iniciarConversa(configuracaoDaLoja) {
  loja = configuracaoDaLoja;
  definirEtapa(0);

  await botResponde(`Olá! Eu sou o ${loja.loja.atendente}, do ${loja.loja.nome}. 🍔`);

  const status = statusDaLoja(loja.horario);
  if (status.aberta) {
    await botResponde(`Estamos abertos até ${loja.horario.fecha}. Como posso ajudar?`);
  } else {
    await botResponde(`Agora estamos fechados. ${status.resumo.replace("Fechado, a", "A")}. Mas pode ver o cardápio e tirar dúvidas por aqui!`);
  }

  mostrarMenu();
}
