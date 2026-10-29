// pedido.js
// Regras do pedido: itens, adicionais, combos, taxa de entrega e total.
// Todos os preços são calculados aqui, a partir da configuração da loja.
// A IA nunca define preços.
// A montagem do pedido entra na semana 2.

export function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
