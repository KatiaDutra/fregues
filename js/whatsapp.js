// whatsapp.js
// Monta o texto do pedido e o link wa.me, sem precisar da API paga do WhatsApp.

import { formatarPreco, agruparItens, calcularSubtotal, calcularTaxa, calcularTotal } from "./pedido.js";

export function montarMensagem(pedido, loja, numero = null) {
  const titulo = numero ? `*Novo pedido #${numero}: ${loja.loja.nome}*` : `*Novo pedido: ${loja.loja.nome}*`;
  const linhas = [titulo, `Cliente: ${pedido.cliente}`, ""];

  agruparItens(pedido, loja).forEach((grupo) => {
    linhas.push(`${grupo.quantidade}x ${grupo.descricao.titulo}: ${formatarPreco(grupo.precoTotal)}`);
    grupo.descricao.detalhes.forEach((detalhe) => linhas.push(`   ${detalhe}`));
  });

  linhas.push("", `Subtotal: ${formatarPreco(calcularSubtotal(pedido, loja))}`);

  if (pedido.entrega.tipo === "entrega") {
    linhas.push(`Taxa de entrega (${pedido.entrega.bairro}): ${formatarPreco(calcularTaxa(pedido))}`);
  }

  linhas.push(`*Total: ${formatarPreco(calcularTotal(pedido, loja))}*`, "");

  if (pedido.entrega.tipo === "entrega") {
    linhas.push(`Entrega: ${pedido.entrega.endereco}, ${pedido.entrega.bairro}`);
  } else {
    linhas.push("Retirada no balcão");
  }

  const troco = pedido.troco ? ` (troco para ${formatarPreco(pedido.troco)})` : "";
  linhas.push(`Pagamento: ${pedido.pagamento}${troco}`, "", "Pedido feito pelo Freguês");

  return linhas.join("\n");
}

// Na demonstração o número é fictício, então o link deixa a pessoa escolher o contato.
export function criarLink(loja, mensagem) {
  const texto = encodeURIComponent(mensagem);
  return loja.loja.demonstracao ? `https://wa.me/?text=${texto}` : `https://wa.me/${loja.loja.whatsapp}?text=${texto}`;
}
