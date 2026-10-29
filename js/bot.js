// bot.js
// Conversa com o cliente: acolhimento, perguntas frequentes e respostas rápidas.
// Nesta etapa o bot entende texto livre por palavras-chave.
// Na semana 2, a IA (ia.js) passa a entender frases mais livres.

import { adicionarMensagem, mostrarDigitando, mostrarOpcoes, limparOpcoes, definirEtapa } from "./ui.js";
import { statusDaLoja, descreverDias } from "./horario.js";
import { formatarPreco } from "./pedido.js";

let loja = null;

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

// Remove acentos e deixa minúsculo: "Cardápio" vira "cardapio".
function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
}

function contemPalavra(textoNormalizado, palavra) {
  return ` ${textoNormalizado} `.replace(/\s+/g, " ").includes(` ${palavra} `);
}

function esperar(milissegundos) {
  return new Promise((resolver) => setTimeout(resolver, milissegundos));
}

// O bot "digita" antes de responder, para a conversa parecer natural.
async function botResponde(conteudo) {
  const pararDeDigitar = mostrarDigitando();
  const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  await esperar(reduzirMovimento ? 150 : 700);
  pararDeDigitar();
  adicionarMensagem("bot", conteudo);
}

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

function respostaPedido() {
  const status = statusDaLoja(loja.horario);
  if (!status.aberta) {
    return `No momento estamos fechados. ${status.resumo.replace("Fechado, a", "A")}. Enquanto isso, você pode dar uma olhada no cardápio!`;
  }
  return "A montagem do pedido por aqui chega em breve. Enquanto isso, dá uma olhada no cardápio!";
}

const RESPOSTAS = {
  saudacao: () => "Oi! Em que posso ajudar?",
  pedido: respostaPedido,
  cardapio: respostaCardapio,
  horario: respostaHorario,
  entrega: respostaEntrega,
  pagamento: respostaPagamento,
};

// ---------- Fluxo da conversa ----------

async function responder(idDaResposta) {
  limparOpcoes();
  await botResponde(RESPOSTAS[idDaResposta]());
  mostrarOpcoes(OPCOES_PRINCIPAIS, escolherOpcao);
}

function escolherOpcao(opcao) {
  adicionarMensagem("cliente", opcao.rotulo);
  responder(opcao.id);
}

export async function responderTexto(texto) {
  adicionarMensagem("cliente", texto);
  limparOpcoes();
  const textoNormalizado = normalizar(texto);

  // 1. Dúvidas cadastradas pela loja na configuração
  const duvida = loja.duvidas.find((d) => d.palavras.some((p) => contemPalavra(textoNormalizado, normalizar(p))));
  if (duvida) {
    await botResponde(duvida.resposta);
    mostrarOpcoes(OPCOES_PRINCIPAIS, escolherOpcao);
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
  mostrarOpcoes(OPCOES_PRINCIPAIS, escolherOpcao);
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

  mostrarOpcoes(OPCOES_PRINCIPAIS, escolherOpcao);
}
