// pedido.js
// Regras do pedido: itens, adicionais, combo, taxa de entrega e total.
// Todos os preços são calculados aqui, a partir da configuração da loja.
// A IA nunca define preços.

export function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function criarPedido() {
  return {
    itens: [],
    entrega: null, // { tipo: "entrega", bairro, taxa, endereco } ou { tipo: "retirada" }
    pagamento: null,
    troco: null,
    cliente: null,
    clienteId: null, // id protegido do cartão fidelidade
    usaPremio: false,
  };
}

// Procura um item pelo id em todas as categorias do cardápio
export function buscarItem(loja, id) {
  const { burgers, adicionais, acompanhamentos, bebidas, sobremesas } = loja.cardapio;
  return [...burgers, ...adicionais, ...acompanhamentos, ...bebidas, ...sobremesas].find((item) => item.id === id);
}

// Quanto o combo acrescenta ao burger: soma dos itens do combo menos o desconto
export function precoDoCombo(loja) {
  const combo = loja.cardapio.combo;
  const soma = combo.itens.reduce((total, id) => total + buscarItem(loja, id).preco, 0);
  return soma - combo.desconto;
}

export function precoDoItem(item, loja) {
  if (item.tipo !== "burger") {
    return item.preco;
  }

  const adicionais = item.adicionais.reduce((total, adicional) => total + adicional.preco, 0);
  const combo = item.combo ? precoDoCombo(loja) : 0;
  return item.preco + adicionais + combo;
}

export function calcularSubtotal(pedido, loja) {
  return pedido.itens.reduce((total, item) => total + precoDoItem(item, loja), 0);
}

export function calcularTaxa(pedido) {
  return pedido.entrega?.tipo === "entrega" ? pedido.entrega.taxa : 0;
}

export function calcularTotal(pedido, loja) {
  return calcularSubtotal(pedido, loja) + calcularTaxa(pedido);
}

// Quanto falta para atingir o pedido mínimo de entrega (0 se já atingiu ou se é retirada)
export function faltaParaMinimo(pedido, loja) {
  if (pedido.entrega?.tipo !== "entrega") return 0;
  return Math.max(0, loja.entrega.pedidoMinimo - calcularSubtotal(pedido, loja));
}

// Texto de um item: título e detalhes (ponto, adicionais, combo)
export function descreverItem(item, loja) {
  const detalhes = [];

  if (item.tipo === "burger") {
    if (item.ponto) detalhes.push(item.ponto);
    if (item.adicionais.length) detalhes.push(`+ ${item.adicionais.map((a) => a.nome).join(", ")}`);
    if (item.combo) detalhes.push(`${loja.cardapio.combo.nome}: ${loja.cardapio.combo.descricao.toLowerCase()}`);
  }

  return { titulo: item.nome, detalhes };
}

// Junta itens iguais: dois refrigerantes viram "2x Refrigerante lata"
export function agruparItens(pedido, loja) {
  const grupos = new Map();

  pedido.itens.forEach((item, indice) => {
    const descricao = descreverItem(item, loja);
    const chave = JSON.stringify(descricao);

    if (!grupos.has(chave)) {
      grupos.set(chave, { descricao, quantidade: 0, precoUnitario: precoDoItem(item, loja), indices: [] });
    }

    const grupo = grupos.get(chave);
    grupo.quantidade += 1;
    grupo.indices.push(indice);
  });

  return [...grupos.values()].map((grupo) => ({ ...grupo, precoTotal: grupo.precoUnitario * grupo.quantidade }));
}

export function resumoCurto(pedido, loja) {
  const quantidade = pedido.itens.length;
  const palavra = quantidade === 1 ? "item" : "itens";
  return `Seu pedido: ${quantidade} ${palavra}, ${formatarPreco(calcularSubtotal(pedido, loja))}`;
}
