// admin.js
// Painel do administrador: confere e confirma os pagamentos.
// É o único perfil que mexe em pagamento e o único que registra selos de fidelidade:
// o selo nasce junto com a confirmação, então pedido não pago não gera selo.

import { carregarConfiguracao } from "./config.js";
import { acompanharPedidosRecentes, confirmarPagamento, marcarNaoPago, cancelarPedido, numeroDoPedido } from "./banco.js";
import { formatarPreco, descreverPagamento } from "./pedido.js";
import { protegerPainel, tocarAviso, tempoDecorrido, criarElemento } from "./acesso.js";

const HORAS_DE_HISTORICO = 7 * 24;

let loja = null;
let pedidos = [];
let pararDeOuvir = null;
let idsAguardando = null; // para tocar o aviso só quando chega um pedido novo esperando pagamento

const aviso = document.querySelector("#aviso");
const dialogo = document.querySelector("#dialogo");

const STATUS_DO_PREPARO = {
  aguardando_pagamento: "Esperando seu ok",
  recebido: "Na fila da cozinha",
  preparando: "Em preparo",
  pronto: "Pronto",
  finalizado: "Entregue",
  cancelado: "Cancelado",
};

// ---------- Filas ----------
// Cada pedido aparece em uma única fila, conforme a situação do pagamento

function filaDoPedido(pedido) {
  // Pedidos feitos antes da Versão 3 não têm pagamento controlado (e já geraram selo): ficam de fora
  if (!pedido.situacaoPagamento) return null;
  if (pedido.situacaoPagamento === "confirmado") return "pagos";
  if (pedido.situacaoPagamento === "nao_pago") return pedido.status === "cancelado" ? null : "nao-pagos";
  if (pedido.status === "aguardando_pagamento") return "aguardando";
  return "receber";
}

const ACOES = {
  aguardando: [
    { id: "confirmar", rotulo: "Confirmar pagamento", principal: true },
    { id: "cancelar", rotulo: "Cancelar pedido" },
  ],
  receber: [
    { id: "confirmar", rotulo: "Confirmar pagamento", principal: true },
    { id: "nao-pago", rotulo: "Não pago" },
  ],
  "nao-pagos": [{ id: "confirmar", rotulo: "Recebi depois", principal: true }],
  pagos: [],
};

// ---------- Confirmação ----------

function perguntar(titulo, texto, rotuloConfirmar) {
  document.querySelector("#dialogo-titulo").textContent = titulo;
  document.querySelector("#dialogo-texto").textContent = texto;
  document.querySelector("#dialogo-confirmar").textContent = rotuloConfirmar;
  dialogo.returnValue = "";
  dialogo.showModal();
  return new Promise((resolver) => {
    dialogo.addEventListener("close", () => resolver(dialogo.returnValue === "confirmar"), { once: true });
  });
}

function textoDaConfirmacao(pedido) {
  const partes = [`${pedido.cliente}, ${formatarPreco(pedido.total)} em ${pedido.pagamento}.`];
  if (pedido.status === "aguardando_pagamento") partes.push("O pedido será liberado para a cozinha.");
  if (pedido.clienteId) partes.push(pedido.usaPremio ? "O prêmio será descontado e o selo deste pedido, registrado." : "O selo de fidelidade será registrado.");
  partes.push("Essa confirmação não pode ser desfeita.");
  return partes.join(" ");
}

async function executar(acao, pedido) {
  const numero = `#${numeroDoPedido(pedido.id)}`;

  if (acao === "confirmar") {
    if (!(await perguntar(`Confirmar o pagamento do pedido ${numero}?`, textoDaConfirmacao(pedido), "Confirmar pagamento"))) return;
    const alerta = await confirmarPagamento(loja, pedido);
    mostrarAviso(alerta ?? `Pagamento do pedido ${numero} confirmado.`);
  }

  if (acao === "nao-pago") {
    const texto = `${pedido.cliente} não pagou ${formatarPreco(pedido.total)}. O pedido vai para a lista de não pagos e não gera selo. Se o cliente pagar depois, é só confirmar por lá.`;
    if (!(await perguntar(`Marcar o pedido ${numero} como não pago?`, texto, "Marcar como não pago"))) return;
    await marcarNaoPago(loja.loja.id, pedido.id);
    mostrarAviso(`Pedido ${numero} marcado como não pago.`);
  }

  if (acao === "cancelar") {
    const texto = `O pagamento de ${pedido.cliente} não foi feito. O pedido é cancelado e não chega à cozinha. Avise o cliente pelo WhatsApp.`;
    if (!(await perguntar(`Cancelar o pedido ${numero}?`, texto, "Cancelar pedido"))) return;
    await cancelarPedido(loja.loja.id, pedido.id);
    mostrarAviso(`Pedido ${numero} cancelado.`);
  }
}

// ---------- Desenho ----------

function quando(data) {
  if (!data) return "agora";
  const hoje = new Date().toDateString() === data.toDateString();
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return hoje ? `${hora}, ${tempoDecorrido(data)}` : `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${hora}`;
}

function criarLinha(pedido, fila) {
  const linha = criarElemento("li", "pedido");

  const identificacao = criarElemento("div", "pedido__identificacao");
  identificacao.append(criarElemento("strong", "pedido__numero", `#${numeroDoPedido(pedido.id)}`));
  identificacao.append(criarElemento("span", "pedido__cliente", pedido.cliente));
  identificacao.append(criarElemento("small", "pedido__hora", quando(pedido.criadoEm?.toDate())));
  linha.append(identificacao);

  const pagamento = criarElemento("div", "pedido__pagamento");
  pagamento.append(criarElemento("strong", "pedido__total", formatarPreco(pedido.total)));
  pagamento.append(criarElemento("span", "", descreverPagamento(pedido)));
  linha.append(pagamento);

  const situacao = criarElemento("div", "pedido__situacao");
  situacao.append(criarElemento("span", `preparo preparo--${pedido.status}`, STATUS_DO_PREPARO[pedido.status]));
  if (pedido.clienteId) situacao.append(criarElemento("span", "etiqueta", pedido.usaPremio ? "Usando prêmio" : "Cartão fidelidade"));
  linha.append(situacao);

  const acoes = ACOES[fila];
  if (acoes.length) {
    const botoes = criarElemento("div", "pedido__acoes");
    acoes.forEach((acao) => {
      const botao = criarElemento("button", acao.principal ? "botao-principal" : "botao-secundario", acao.rotulo);
      botao.type = "button";
      botao.addEventListener("click", async () => {
        botoes.querySelectorAll("button").forEach((b) => (b.disabled = true));
        try {
          await executar(acao.id, pedido);
        } catch (erro) {
          console.error(erro);
          mostrarAviso("Não foi possível atualizar o pedido. Confira a conexão.");
        }
        botoes.querySelectorAll("button").forEach((b) => (b.disabled = false));
      });
      botoes.append(botao);
    });
    linha.append(botoes);
  }

  return linha;
}

function desenharFilas() {
  const filas = { aguardando: [], receber: [], "nao-pagos": [], pagos: [] };
  pedidos.forEach((pedido) => {
    const fila = filaDoPedido(pedido);
    if (fila) filas[fila].push(pedido);
  });
  // Pagos: os mais recentes primeiro. Nas outras, os mais antigos primeiro, porque esperam há mais tempo.
  filas.pagos.reverse();

  const VAZIAS = {
    aguardando: "Nenhum pedido esperando pagamento.",
    receber: "Nada a receber agora.",
    "nao-pagos": "Nenhum pedido sem pagamento.",
    pagos: "Nenhum pagamento confirmado nos últimos 7 dias.",
  };

  Object.entries(filas).forEach(([fila, lista]) => {
    document.querySelector(`#contador-${fila}`).textContent = lista.length;
    const elemento = document.querySelector(`#lista-${fila}`);
    elemento.replaceChildren(...lista.map((pedido) => criarLinha(pedido, fila)));
    if (lista.length === 0) elemento.append(criarElemento("li", "fila__vazia", VAZIAS[fila]));
  });
}

function desenharCaixa() {
  const hoje = new Date().toDateString();
  const doDia = pedidos.filter((p) => p.criadoEm && p.criadoEm.toDate().toDateString() === hoje && p.status !== "cancelado");
  const somar = (lista) => formatarPreco(lista.reduce((total, p) => total + p.total, 0));

  document.querySelector("#total-recebido").textContent = somar(doDia.filter((p) => filaDoPedido(p) === "pagos"));
  document.querySelector("#total-a-receber").textContent = somar(doDia.filter((p) => filaDoPedido(p) === "receber"));
  document.querySelector("#total-aguardando").textContent = somar(doDia.filter((p) => filaDoPedido(p) === "aguardando"));
  document.querySelector("#total-nao-pagos").textContent = somar(doDia.filter((p) => filaDoPedido(p) === "nao-pagos"));
  document.querySelector("#quantidade-pedidos").textContent = doDia.length;
}

function desenhar() {
  desenharFilas();
  desenharCaixa();
}

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.hidden = false;
  setTimeout(() => (aviso.hidden = true), 5000);
}

function avisarNovos(lista) {
  const aguardando = lista.filter((p) => p.status === "aguardando_pagamento").map((p) => p.id);
  if (idsAguardando) {
    const novos = aguardando.filter((id) => !idsAguardando.has(id)).length;
    if (novos > 0) {
      tocarAviso();
      mostrarAviso(novos === 1 ? "Pedido novo esperando pagamento!" : `${novos} pedidos novos esperando pagamento!`);
    }
  }
  idsAguardando = new Set([...(idsAguardando ?? []), ...aguardando]);
}

function comecarAOuvir() {
  if (pararDeOuvir) return;
  idsAguardando = null;
  pararDeOuvir = acompanharPedidosRecentes(
    loja.loja.id,
    (lista) => {
      pedidos = lista;
      desenhar();
      avisarNovos(lista);
    },
    (erro) => {
      console.error(erro);
      mostrarAviso("Sem permissão para ver os pedidos. Confira as regras do Firestore e os papéis da equipe.");
    },
    HORAS_DE_HISTORICO
  );
}

function pararDeAcompanhar() {
  if (pararDeOuvir) pararDeOuvir();
  pararDeOuvir = null;
}

// Os tempos de espera são atualizados a cada 30 segundos (sem redesenhar com o diálogo aberto)
setInterval(() => {
  if (pedidos.length && !dialogo.open) desenhar();
}, 30000);

// ---------- Início ----------

async function iniciar() {
  loja = await carregarConfiguracao();
  document.querySelector("#nome-da-loja").textContent = `Pagamentos de ${loja.loja.nome}`;
  document.querySelector("#data-de-hoje").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  protegerPainel("admin", comecarAOuvir, pararDeAcompanhar);
}

iniciar();
