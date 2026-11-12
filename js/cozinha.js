// cozinha.js
// Painel da cozinha: pedidos liberados em tempo real e avanço do preparo.
// A cozinha não mexe em pagamento nem em selos: isso é do admin.
// Esta é uma tela de gestão, então usa a marca do Freguês, não a da loja.

import { carregarConfiguracao } from "./config.js";
import { acompanharPedidosRecentes, mudarStatus, numeroDoPedido } from "./banco.js";
import { formatarPreco, descreverPagamento } from "./pedido.js";
import { protegerPainel, tocarAviso, tempoDecorrido, criarElemento } from "./acesso.js";

const COLUNAS = ["recebido", "preparando", "pronto"];

let loja = null;
let pedidos = [];
let pararDeOuvir = null;
let idsConhecidos = null; // pedidos já vistos pela cozinha, para tocar o aviso só nos novos

const aviso = document.querySelector("#aviso");

// Próximo passo de cada status, com o texto do botão
const PROXIMO_PASSO = {
  recebido: { status: "preparando", rotulo: "Começar preparo" },
  preparando: { status: "pronto", rotulo: "Marcar como pronto" },
};
// Depois do "pronto", a entrega fica com o admin, que lida com o motoboy e com o balcão

// ---------- Quadro ----------

// Na cozinha, o que importa sobre o pagamento é: já está pago ou precisa cobrar?
function etiquetaDePagamento(pedido) {
  if (pedido.situacaoPagamento === "confirmado") return criarElemento("span", "etiqueta etiqueta--pago", "Pago");
  const onde = pedido.entrega.tipo === "entrega" ? "na entrega" : "na retirada";
  return criarElemento("span", "etiqueta etiqueta--cobrar", `Cobrar ${onde}`);
}

function criarCartao(pedido) {
  const cartao = criarElemento("article", "cartao");
  const criadoEm = pedido.criadoEm?.toDate();

  // Cabeçalho: número, hora e tempo de espera
  const topo = criarElemento("header", "cartao__topo");
  topo.append(criarElemento("strong", "cartao__numero", `#${numeroDoPedido(pedido.id)}`));
  const hora = criadoEm ? criadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  topo.append(criarElemento("span", "cartao__hora", `${hora}, ${tempoDecorrido(criadoEm)}`));
  cartao.append(topo);

  cartao.append(criarElemento("p", "cartao__cliente", pedido.cliente));

  // Etiquetas: pagamento e fidelidade
  const etiquetas = criarElemento("div", "cartao__etiquetas");
  etiquetas.append(etiquetaDePagamento(pedido));
  if (pedido.clienteId) etiquetas.append(criarElemento("span", "etiqueta", "Cartão fidelidade"));
  if (pedido.usaPremio) etiquetas.append(criarElemento("span", "etiqueta etiqueta--premio", "Usando prêmio"));
  cartao.append(etiquetas);

  // Itens
  const lista = criarElemento("ul", "cartao__itens");
  pedido.itens.forEach((item) => {
    const linha = criarElemento("li");
    linha.append(criarElemento("strong", "", `${item.quantidade}x ${item.titulo}`));
    item.detalhes.forEach((detalhe) => linha.append(criarElemento("small", "", detalhe)));
    lista.append(linha);
  });
  cartao.append(lista);

  // Entrega e pagamento
  const entrega = pedido.entrega.tipo === "entrega"
    ? `Entrega: ${pedido.entrega.endereco}, ${pedido.entrega.bairro}`
    : "Retirada no balcão";
  cartao.append(criarElemento("p", "cartao__info", entrega));
  cartao.append(criarElemento("p", "cartao__info", `${descreverPagamento(pedido)}. Total ${formatarPreco(pedido.total)}`));

  // Pedido pronto: a cozinha só espera o admin marcar a entrega
  const passo = PROXIMO_PASSO[pedido.status];
  if (!passo) {
    const espera = pedido.entrega.tipo === "entrega" ? "Aguardando entrega" : "Aguardando retirada";
    cartao.append(criarElemento("p", "cartao__espera", espera));
    return cartao;
  }

  // Botão para avançar o status
  const botao = criarElemento("button", "botao-principal", passo.rotulo);
  botao.type = "button";
  botao.addEventListener("click", async () => {
    botao.disabled = true;
    try {
      await mudarStatus(loja.loja.id, pedido.id, passo.status);
    } catch (erro) {
      console.error(erro);
      botao.disabled = false;
      mostrarAviso("Não foi possível atualizar o pedido. Confira a conexão.");
    }
  });
  cartao.append(botao);

  return cartao;
}

function desenharQuadro() {
  COLUNAS.forEach((status) => {
    const doStatus = pedidos.filter((p) => p.status === status);
    document.querySelector(`#contador-${status}`).textContent = doStatus.length;

    const lista = document.querySelector(`#lista-${status}`);
    lista.replaceChildren(...doStatus.map(criarCartao));
    if (doStatus.length === 0) lista.append(criarElemento("p", "coluna__vazia", "Nenhum pedido aqui."));
  });
}

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.hidden = false;
  setTimeout(() => (aviso.hidden = true), 5000);
}

// Pedidos que acabaram de chegar à cozinha: novos pagos no recebimento,
// ou pagos no ato que o admin acabou de liberar
function avisarNovos(lista) {
  const visiveis = lista.filter((p) => COLUNAS.includes(p.status)).map((p) => p.id);
  if (idsConhecidos) {
    const novos = visiveis.filter((id) => !idsConhecidos.has(id)).length;
    if (novos > 0) {
      tocarAviso();
      mostrarAviso(novos === 1 ? "Novo pedido!" : `${novos} pedidos novos!`);
    }
  }
  idsConhecidos = new Set([...(idsConhecidos ?? []), ...visiveis]);
}

function comecarAOuvir() {
  if (pararDeOuvir) return;
  idsConhecidos = null;
  pararDeOuvir = acompanharPedidosRecentes(
    loja.loja.id,
    (lista) => {
      pedidos = lista;
      desenharQuadro();
      avisarNovos(lista);
    },
    (erro) => {
      console.error(erro);
      mostrarAviso("Sem permissão para ver os pedidos. Confira as regras do Firestore e os papéis da equipe.");
    }
  );
}

function pararDeAcompanhar() {
  if (pararDeOuvir) pararDeOuvir();
  pararDeOuvir = null;
}

// O tempo de espera dos cartões é atualizado a cada 30 segundos
setInterval(() => {
  if (pedidos.length) desenharQuadro();
}, 30000);

// ---------- Início ----------

async function iniciar() {
  loja = await carregarConfiguracao();
  document.querySelector("#nome-da-loja").textContent = `Cozinha de ${loja.loja.nome}`;
  protegerPainel("cozinha", comecarAOuvir, pararDeAcompanhar);
}

iniciar();
