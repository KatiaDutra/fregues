// exportacao.js
// Transforma as vendas do Firestore em arquivos para planilha, Power BI ou o Centraliza.
// CSV no padrão brasileiro (ponto e vírgula, vírgula decimal e acentos em UTF-8),
// que o Excel abre direto com dois cliques.

// ---------- Períodos ----------

export const PERIODOS = {
  hoje: "Hoje",
  "7dias": "Últimos 7 dias",
  mes: "Este mês",
  "mes-passado": "Mês passado",
};

// Devolve { inicio, fim, rotulo }, com o fim excluído
export function calcularPeriodo(chave, hoje = new Date()) {
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const amanha = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1);
  const intervalos = {
    hoje: [dia, amanha],
    "7dias": [new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() - 6), amanha],
    mes: [new Date(dia.getFullYear(), dia.getMonth(), 1), amanha],
    "mes-passado": [new Date(dia.getFullYear(), dia.getMonth() - 1, 1), new Date(dia.getFullYear(), dia.getMonth(), 1)],
  };
  const [inicio, fim] = intervalos[chave];
  return { inicio, fim, rotulo: PERIODOS[chave] };
}

// ---------- Formatação ----------

const dataBR = (data) => data.toLocaleDateString("pt-BR");
const horaBR = (data) => data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataArquivo = (data) => data.toLocaleDateString("sv-SE"); // 2026-11-19
const numeroBR = (valor) => valor.toFixed(2).replace(".", ",");

// Campo de CSV: entre aspas quando tem separador, aspas ou quebra de linha
function campo(valor) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return /[;"\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

function montarCsv(cabecalho, linhas) {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(campo).join(";")).join("\r\n");
  return "﻿" + conteudo; // a marca BOM faz o Excel reconhecer os acentos
}

const ROTULO_MOMENTO = { pedido: "No pedido", recebimento: "No recebimento" };
const ROTULO_ENTREGA = { entrega: "Entrega", retirada: "Retirada" };

// ---------- Arquivos ----------

// Uma linha por venda: bom para faturamento, ticket médio e formas de pagamento
export function csvDeVendas(vendas) {
  const cabecalho = ["numero", "data", "hora", "cliente", "cartao_fidelidade", "tipo_entrega", "bairro",
    "forma_pagamento", "momento_pagamento", "subtotal", "taxa_entrega", "total", "usou_premio"];
  const linhas = vendas.map((venda) => {
    const data = venda.data.toDate();
    return [venda.numero, dataBR(data), horaBR(data), venda.cliente, venda.clienteId ? "Sim" : "Não",
      ROTULO_ENTREGA[venda.tipoEntrega] ?? venda.tipoEntrega, venda.bairro ?? "",
      venda.formaPagamento, ROTULO_MOMENTO[venda.momentoPagamento] ?? venda.momentoPagamento,
      numeroBR(venda.subtotal), numeroBR(venda.taxaEntrega), numeroBR(venda.total), venda.usouPremio ? "Sim" : "Não"];
  });
  return montarCsv(cabecalho, linhas);
}

// Uma linha por item vendido: bom para curva ABC, produtos mais vendidos e baixa de estoque
export function csvDeItens(vendas) {
  const cabecalho = ["numero", "data", "produto_id", "categoria", "produto", "detalhes", "combo",
    "quantidade", "preco_unitario", "total"];
  const linhas = vendas.flatMap((venda) => {
    const data = dataBR(venda.data.toDate());
    return venda.itens.map((item) => [venda.numero, data, item.produtoId ?? "", item.categoria ?? "", item.nome,
      item.detalhes.join(" | "), item.combo ? "Sim" : "Não", item.quantidade,
      numeroBR(item.precoUnitario), numeroBR(item.total)]);
  });
  return montarCsv(cabecalho, linhas);
}

// O contrato de dados completo, com datas no padrão ISO, para outros sistemas
export function jsonDoContrato(vendas, loja, periodo) {
  const paraIso = (valor) => (valor?.toDate ? valor.toDate().toISOString() : valor);
  return JSON.stringify({
    contrato: "fregues.vendas",
    versao: 1,
    loja: { id: loja.loja.id, nome: loja.loja.nome },
    periodo: { inicio: periodo.inicio.toISOString(), fim: periodo.fim.toISOString() },
    geradoEm: new Date().toISOString(),
    vendas: vendas.map(({ id, ...venda }) => ({ ...venda, data: paraIso(venda.data), pagoEm: paraIso(venda.pagoEm) })),
  }, null, 2);
}

export function nomeDoArquivo(loja, tipo, periodo, extensao) {
  const fimIncluido = new Date(periodo.fim.getTime() - 1);
  return `${loja.loja.id}-${tipo}-${dataArquivo(periodo.inicio)}-a-${dataArquivo(fimIncluido)}.${extensao}`;
}

// Entrega o arquivo para o navegador baixar
export function baixar(conteudo, nome, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
