// fidelidade.js
// Regras do cartão fidelidade que não dependem do banco:
// telefone, identificação protegida do cliente, contagem de selos e o desenho do cartão.

// Aceita "(51) 99999-0000", "51999990000" ou "+55 51 99999-0000"
export function normalizarTelefone(texto) {
  let numeros = texto.replace(/\D/g, "");
  if (numeros.startsWith("55") && numeros.length >= 12) numeros = numeros.slice(2);
  return numeros.length === 10 || numeros.length === 11 ? numeros : null;
}

// O telefone não é guardado no banco. Guardamos um "hash": um código gerado a partir
// do telefone, que sempre dá o mesmo resultado, mas não permite voltar ao número.
export async function gerarIdDoCliente(telefone, lojaId) {
  const bytes = new TextEncoder().encode(`${lojaId}:${telefone}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Só contam os selos dentro da validade
export function selosValidos(selos, validadeEmDias) {
  const limite = Date.now() - validadeEmDias * 24 * 60 * 60 * 1000;
  return selos.filter((selo) => selo.toDate().getTime() >= limite);
}

export function temPremio(quantidade, loja) {
  return quantidade >= loja.fidelidade.selosParaPremio;
}

// Desenho do cartão: um espaço para cada selo, preenchido com os já conquistados
export function criarCartaoFidelidade(quantidade, loja) {
  const total = loja.fidelidade.selosParaPremio;
  const cheios = Math.min(quantidade, total);

  const cartao = document.createElement("div");
  cartao.className = "cartao-fidelidade";

  const titulo = document.createElement("p");
  titulo.className = "cartao-fidelidade__titulo";
  titulo.textContent = `Cartão fidelidade ${loja.loja.nome}`;

  const selos = document.createElement("div");
  selos.className = "cartao-fidelidade__selos";
  selos.setAttribute("role", "img");
  selos.setAttribute("aria-label", `${cheios} de ${total} selos`);
  for (let i = 0; i < total; i++) {
    const espaco = document.createElement("span");
    espaco.className = i < cheios ? "selo selo--cheio" : "selo";
    // O selo preenchido leva o avatar da loja (white-label)
    if (i < cheios) espaco.style.backgroundImage = `url("${loja.loja.avatar}")`;
    selos.append(espaco);
  }

  const legenda = document.createElement("p");
  legenda.className = "cartao-fidelidade__legenda";
  legenda.textContent = temPremio(quantidade, loja)
    ? `Prêmio liberado: ${loja.fidelidade.premio}!`
    : `Faltam ${total - cheios} para: ${loja.fidelidade.premio}.`;

  const validade = document.createElement("small");
  validade.textContent = `Os selos valem ${loja.fidelidade.validadeDosSelosEmDias} dias.`;

  cartao.append(titulo, selos, legenda, validade);
  return cartao;
}
