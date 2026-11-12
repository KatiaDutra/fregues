// banco.js
// Leitura e gravação dos pedidos no Firestore.
// Caminho dos pedidos: lojas/{id da loja}/pedidos/{id do pedido}

import { db } from "./firebase.js";
import {
  collection, addDoc, doc, getDoc, setDoc, onSnapshot, updateDoc, query, where, orderBy, limit, serverTimestamp, Timestamp, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { agruparItens, calcularSubtotal, calcularTaxa, calcularTotal } from "./pedido.js";
import { selosValidos } from "./fidelidade.js";

// Etapas do pedido, na ordem em que a cozinha avança.
// Antes delas, o pedido pago no ato fica em "aguardando_pagamento" até o ok do admin,
// e pode terminar em "cancelado" se o cliente não pagar.
export const STATUS = ["recebido", "preparando", "pronto", "finalizado"];

// Situação do pagamento, controlada só pelo admin
export const SITUACAO_PAGAMENTO = ["pendente", "confirmado", "nao_pago"];

// Número curto para o cliente e a cozinha se referirem ao pedido
export function numeroDoPedido(id) {
  return id.slice(0, 5).toUpperCase();
}

function pedidosDaLoja(lojaId) {
  return collection(db, "lojas", lojaId, "pedidos");
}

export async function salvarPedido(pedido, loja) {
  const dados = {
    cliente: pedido.cliente,
    itens: agruparItens(pedido, loja).map((grupo) => ({
      quantidade: grupo.quantidade,
      titulo: grupo.descricao.titulo,
      detalhes: grupo.descricao.detalhes,
      precoTotal: grupo.precoTotal,
    })),
    subtotal: calcularSubtotal(pedido, loja),
    taxa: calcularTaxa(pedido),
    total: calcularTotal(pedido, loja),
    entrega: pedido.entrega,
    pagamento: pedido.pagamento,
    momentoPagamento: pedido.momentoPagamento,
    situacaoPagamento: "pendente",
    troco: pedido.troco ?? null,
    clienteId: pedido.clienteId ?? null,
    usaPremio: pedido.usaPremio === true,
    // Pago no ato: só vai para a cozinha depois que o admin confirmar
    status: pedido.momentoPagamento === "pedido" ? "aguardando_pagamento" : "recebido",
    criadoEm: serverTimestamp(),
  };

  const referencia = await addDoc(pedidosDaLoja(loja.loja.id), dados);
  return referencia.id;
}

// O cliente acompanha só o próprio pedido, pelo id
export function acompanharPedido(lojaId, id, aoMudar) {
  return onSnapshot(doc(db, "lojas", lojaId, "pedidos", id), (documento) => {
    if (documento.exists()) aoMudar(documento.data());
  });
}

// A equipe acompanha os pedidos recentes em tempo real:
// a cozinha olha as últimas 24 horas, e o admin, os últimos dias.
export function acompanharPedidosRecentes(lojaId, aoMudar, aoFalhar, horas = 24) {
  const inicio = Timestamp.fromDate(new Date(Date.now() - horas * 60 * 60 * 1000));
  const consulta = query(pedidosDaLoja(lojaId), where("criadoEm", ">=", inicio), orderBy("criadoEm"));

  return onSnapshot(
    consulta,
    (resultado) => {
      const pedidos = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
      const novos = resultado.docChanges().filter((m) => m.type === "added").length;
      aoMudar(pedidos, novos);
    },
    aoFalhar
  );
}

export function mudarStatus(lojaId, id, status) {
  return updateDoc(doc(db, "lojas", lojaId, "pedidos", id), { status, atualizadoEm: serverTimestamp() });
}

// ---------- Fidelidade ----------
// Cartões ficam em lojas/{id da loja}/clientes/{id protegido do cliente}

// Quantos selos válidos o cliente tem (0 se ainda não tem cartão)
export async function buscarSelos(loja, clienteId) {
  const cartao = await getDoc(doc(db, "lojas", loja.loja.id, "clientes", clienteId));
  if (!cartao.exists()) return 0;
  return selosValidos(cartao.data().selos ?? [], loja.fidelidade.validadeDosSelosEmDias).length;
}

// ---------- Equipe ----------
// Cada pessoa da equipe tem um documento em equipe/{uid}, criado à mão no console,
// com a lista de papéis: ["admin"], ["cozinha"] ou os dois.

export async function buscarPapeis(uid) {
  const documento = await getDoc(doc(db, "equipe", uid));
  return documento.exists() ? documento.data().papeis ?? [] : [];
}

// ---------- Pagamento (somente o admin) ----------

// O admin confirma o pagamento e, na mesma operação, registra o selo do cliente.
// Se o pedido usou o prêmio, os selos do prêmio são descontados aqui também.
// Pedido pago no ato: a confirmação libera o pedido para a cozinha.
// Devolve um aviso para o admin, ou null se deu tudo certo.
export async function confirmarPagamento(loja, pedido) {
  const lojaId = loja.loja.id;
  const referenciaPedido = doc(db, "lojas", lojaId, "pedidos", pedido.id);
  const mudancas = { situacaoPagamento: "confirmado", pagamentoAtualizadoEm: serverTimestamp() };
  if (pedido.status === "aguardando_pagamento") {
    mudancas.status = "recebido";
    mudancas.atualizadoEm = serverTimestamp();
  }

  if (!pedido.clienteId) {
    await updateDoc(referenciaPedido, mudancas);
    return null;
  }

  const referenciaCartao = doc(db, "lojas", lojaId, "clientes", pedido.clienteId);

  return runTransaction(db, async (transacao) => {
    const cartao = await transacao.get(referenciaCartao);
    let selos = selosValidos(cartao.exists() ? cartao.data().selos ?? [] : [], loja.fidelidade.validadeDosSelosEmDias);
    let aviso = null;

    if (pedido.usaPremio) {
      if (selos.length >= loja.fidelidade.selosParaPremio) {
        selos = selos.slice(loja.fidelidade.selosParaPremio); // remove os selos mais antigos
      } else {
        aviso = `O pedido #${numeroDoPedido(pedido.id)} usou o prêmio, mas o cliente não tinha selos suficientes.`;
      }
    }

    selos.push(Timestamp.now());
    transacao.set(referenciaCartao, { nome: pedido.cliente.split(" ")[0], selos, atualizadoEm: serverTimestamp() });
    transacao.update(referenciaPedido, mudancas);
    return aviso;
  });
}

// O admin entrega o pedido (motoboy ou balcão). A hora da entrega conta o tempo
// até o pedido de avaliação, para o cliente comer com calma antes.
export function marcarEntregue(lojaId, id) {
  return updateDoc(doc(db, "lojas", lojaId, "pedidos", id), {
    status: "finalizado",
    entregueEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

// Pagamento no recebimento que não aconteceu: o pedido fica marcado e não gera selo
export function marcarNaoPago(lojaId, id) {
  return updateDoc(doc(db, "lojas", lojaId, "pedidos", id), {
    situacaoPagamento: "nao_pago",
    pagamentoAtualizadoEm: serverTimestamp(),
  });
}

// Pedido pago no ato que não foi pago: é cancelado antes de chegar à cozinha
export function cancelarPedido(lojaId, id) {
  return updateDoc(doc(db, "lojas", lojaId, "pedidos", id), {
    status: "cancelado",
    situacaoPagamento: "nao_pago",
    atualizadoEm: serverTimestamp(),
    pagamentoAtualizadoEm: serverTimestamp(),
  });
}

// ---------- Avaliações (pós-venda) ----------
// Ficam em lojas/{id da loja}/avaliacoes/{id do pedido}: o id da avaliação é o do pedido,
// então cada pedido aceita uma única avaliação.

export async function buscarPedido(lojaId, id) {
  const documento = await getDoc(doc(db, "lojas", lojaId, "pedidos", id));
  return documento.exists() ? { id: documento.id, ...documento.data() } : null;
}

export async function jaAvaliado(lojaId, pedidoId) {
  return (await getDoc(doc(db, "lojas", lojaId, "avaliacoes", pedidoId))).exists();
}

export function salvarAvaliacao(lojaId, pedido, nota, comentario) {
  return setDoc(doc(db, "lojas", lojaId, "avaliacoes", pedido.id), {
    nota,
    comentario: comentario || null,
    cliente: pedido.cliente,
    criadoEm: serverTimestamp(),
  });
}

// O admin acompanha as avaliações mais recentes em tempo real
export function acompanharAvaliacoes(lojaId, aoMudar, aoFalhar) {
  const consulta = query(collection(db, "lojas", lojaId, "avaliacoes"), orderBy("criadoEm", "desc"), limit(100));
  return onSnapshot(
    consulta,
    (resultado) => aoMudar(resultado.docs.map((d) => ({ id: d.id, ...d.data() }))),
    aoFalhar
  );
}
