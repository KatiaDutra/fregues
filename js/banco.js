// banco.js
// Leitura e gravação dos pedidos no Firestore.
// Caminho dos pedidos: lojas/{id da loja}/pedidos/{id do pedido}

import { db } from "./firebase.js";
import {
  collection, addDoc, doc, onSnapshot, updateDoc, query, where, orderBy, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { agruparItens, calcularSubtotal, calcularTaxa, calcularTotal } from "./pedido.js";

// Etapas do pedido, na ordem em que a cozinha avança
export const STATUS = ["recebido", "preparando", "pronto", "finalizado"];

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
    troco: pedido.troco ?? null,
    status: "recebido",
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

// A cozinha acompanha os pedidos das últimas 24 horas, em tempo real
export function acompanharPedidosRecentes(lojaId, aoMudar, aoFalhar) {
  const ontem = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const consulta = query(pedidosDaLoja(lojaId), where("criadoEm", ">=", ontem), orderBy("criadoEm"));

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
