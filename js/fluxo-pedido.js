// fluxo-pedido.js
// Roteiro da montagem do pedido, etapa por etapa:
// burger, ponto da carne, adicionais, combo, outros itens, entrega, pagamento, nome, resumo e envio.

import { perguntar, perguntarVarios, perguntarTexto, botResponde, PedidoCancelado } from "./conversa.js";
import { atualizarResumo, definirEtapa, adicionarMensagem } from "./ui.js";
import { statusDaLoja } from "./horario.js";
import {
  criarPedido, formatarPreco, precoDoCombo, precoDoItem, agruparItens, resumoCurto,
  calcularSubtotal, calcularTaxa, calcularTotal, faltaParaMinimo,
} from "./pedido.js";
import { montarMensagem, criarLink } from "./whatsapp.js";

let loja = null;
let pedido = null;

const VOLTAR = { id: "voltar", rotulo: "Voltar", secundaria: true };

function atualizarBarra() {
  atualizarResumo(pedido.itens.length ? resumoCurto(pedido, loja) : null);
}

// ---------- Burger ----------

async function escolherBurger() {
  const opcoes = loja.cardapio.burgers.map((b) => ({ id: b.id, rotulo: b.nome, detalhe: formatarPreco(b.preco) }));
  const escolha = await perguntar("Qual burger vai ser?", opcoes);
  const burger = loja.cardapio.burgers.find((b) => b.id === escolha.id);

  const item = { tipo: "burger", id: burger.id, nome: burger.nome, preco: burger.preco, ponto: null, adicionais: [], combo: false };

  if (burger.pontoDaCarne) {
    const pontos = loja.cardapio.pontosDaCarne.map((p) => ({ id: p, rotulo: p }));
    item.ponto = (await perguntar("E o ponto da carne?", pontos)).rotulo;
  }

  // Adicionais: o botão de confirmar mostra o preço do burger atualizado
  const adicionais = loja.cardapio.adicionais.map((a) => ({ id: a.id, rotulo: a.nome, detalhe: `+ ${formatarPreco(a.preco)}` }));
  const rotuloConfirmar = (marcadas) => {
    if (marcadas.size === 0) return "Sem adicionais";
    const extra = loja.cardapio.adicionais.filter((a) => marcadas.has(a.id)).reduce((t, a) => t + a.preco, 0);
    return `Pronto: ${formatarPreco(burger.preco + extra)}`;
  };
  const marcadas = await perguntarVarios("Quer adicionais? Toque para marcar.", adicionais, rotuloConfirmar);
  item.adicionais = loja.cardapio.adicionais.filter((a) => marcadas.includes(a.id)).map(({ id, nome, preco }) => ({ id, nome, preco }));

  // Combo
  const combo = loja.cardapio.combo;
  const resposta = await perguntar(
    `Quer transformar em ${combo.nome}? ${combo.descricao}, com ${formatarPreco(combo.desconto)} de desconto.`,
    [
      { id: "sim", rotulo: "Quero o combo", detalhe: `+ ${formatarPreco(precoDoCombo(loja))}` },
      { id: "nao", rotulo: "Só o burger" },
    ]
  );
  item.combo = resposta.id === "sim";

  pedido.itens.push(item);
  atualizarBarra();
  await botResponde(`Anotado: ${item.nome}, ${formatarPreco(precoDoItem(item, loja))}.`);
}

// ---------- Outros itens ----------

const CATEGORIAS = [
  { id: "acompanhamentos", rotulo: "Acompanhamento" },
  { id: "bebidas", rotulo: "Bebida" },
  { id: "sobremesas", rotulo: "Sobremesa" },
];

async function escolherExtra(categoria) {
  const itens = loja.cardapio[categoria];
  const opcoes = itens.map((i) => ({ id: i.id, rotulo: i.nome, detalhe: formatarPreco(i.preco) }));
  const escolha = await perguntar(null, [...opcoes, VOLTAR]);
  if (escolha.id === "voltar") return;

  const item = itens.find((i) => i.id === escolha.id);
  pedido.itens.push({ tipo: "extra", id: item.id, nome: item.nome, preco: item.preco });
  atualizarBarra();
  await botResponde(`Anotado: ${item.nome}, ${formatarPreco(item.preco)}.`);
}

// Repete "mais alguma coisa?" até o cliente finalizar
async function adicionarMais() {
  while (true) {
    const escolha = await perguntar("Mais alguma coisa?", [
      { id: "burger", rotulo: "Outro burger" },
      ...CATEGORIAS,
      { id: "finalizar", rotulo: "Finalizar pedido", secundaria: true },
    ]);

    if (escolha.id === "finalizar") return;
    if (escolha.id === "burger") {
      await escolherBurger();
    } else {
      await escolherExtra(escolha.id);
    }
  }
}

// ---------- Entrega e pagamento ----------

async function escolherEntrega() {
  const opcoes = [{ id: "entrega", rotulo: "Entrega" }];
  if (loja.entrega.retiradaNoBalcao) opcoes.push({ id: "retirada", rotulo: "Retirar no balcão", detalhe: "sem taxa" });

  const tipo = await perguntar("Vai ser entrega ou retirada?", opcoes);

  if (tipo.id === "retirada") {
    pedido.entrega = { tipo: "retirada" };
    return;
  }

  const bairros = loja.entrega.bairros.map((b) => ({ id: b.nome, rotulo: b.nome, detalhe: `+ ${formatarPreco(b.taxa)}` }));
  const bairro = await perguntar("Para qual bairro?", bairros);
  const dados = loja.entrega.bairros.find((b) => b.nome === bairro.id);
  pedido.entrega = { tipo: "entrega", bairro: dados.nome, taxa: dados.taxa, endereco: null };
}

async function perguntarEndereco() {
  let endereco = await perguntarTexto("Qual é o endereço? Rua, número e complemento, se tiver.");
  while (endereco.trim().length < 5) {
    endereco = await perguntarTexto("Preciso do endereço completo, com rua e número.");
  }
  pedido.entrega.endereco = endereco.trim();
}

// Se não atingiu o pedido mínimo, oferece adicionar itens ou trocar para retirada
async function conferirMinimo() {
  let falta = faltaParaMinimo(pedido, loja);

  while (falta > 0) {
    const opcoes = [{ id: "mais", rotulo: "Adicionar itens" }];
    if (loja.entrega.retiradaNoBalcao) opcoes.push({ id: "retirada", rotulo: "Retirar no balcão" });

    const escolha = await perguntar(
      `Para entrega, o pedido mínimo é ${formatarPreco(loja.entrega.pedidoMinimo)}. Faltam ${formatarPreco(falta)}.`,
      opcoes
    );

    if (escolha.id === "retirada") {
      pedido.entrega = { tipo: "retirada" };
    } else {
      await adicionarMais();
    }
    falta = faltaParaMinimo(pedido, loja);
  }
}

function lerValor(texto) {
  const numero = Number(texto.replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

async function escolherPagamento() {
  const opcoes = loja.pagamento.map((forma) => ({ id: forma, rotulo: forma }));
  pedido.pagamento = (await perguntar("Como prefere pagar?", opcoes)).rotulo;
  pedido.troco = null;

  if (pedido.pagamento !== "Dinheiro") return;

  const precisa = await perguntar("Vai precisar de troco?", [
    { id: "sim", rotulo: "Sim" },
    { id: "nao", rotulo: "Não precisa" },
  ]);
  if (precisa.id === "nao") return;

  const total = calcularTotal(pedido, loja);
  let valor = lerValor(await perguntarTexto("Troco para quanto?"));
  while (valor <= total) {
    valor = lerValor(await perguntarTexto(`O valor precisa ser maior que o total de ${formatarPreco(total)}. Troco para quanto?`));
  }
  pedido.troco = valor;
}

// ---------- Resumo ----------

function criarResumo() {
  const bloco = document.createDocumentFragment();
  const titulo = document.createElement("p");
  titulo.textContent = "Confere o seu pedido:";

  const lista = document.createElement("ul");
  lista.className = "lista-cardapio";
  agruparItens(pedido, loja).forEach((grupo) => {
    const linha = document.createElement("li");
    const nome = document.createElement("strong");
    nome.textContent = `${grupo.quantidade}x ${grupo.descricao.titulo}`;
    const preco = document.createElement("span");
    preco.className = "preco";
    preco.textContent = formatarPreco(grupo.precoTotal);
    linha.append(nome, preco);
    grupo.descricao.detalhes.forEach((detalhe) => {
      const texto = document.createElement("small");
      texto.textContent = detalhe;
      linha.append(texto);
    });
    lista.append(linha);
  });

  const totais = document.createElement("ul");
  totais.className = "lista-cardapio lista-totais";
  const linhasDeTotal = [["Subtotal", calcularSubtotal(pedido, loja)]];
  if (pedido.entrega.tipo === "entrega") linhasDeTotal.push([`Entrega (${pedido.entrega.bairro})`, calcularTaxa(pedido)]);
  linhasDeTotal.push(["Total", calcularTotal(pedido, loja)]);
  linhasDeTotal.forEach(([rotulo, valor]) => {
    const linha = document.createElement("li");
    const nome = document.createElement(rotulo === "Total" ? "strong" : "span");
    nome.textContent = rotulo;
    const preco = document.createElement("span");
    preco.className = "preco";
    preco.textContent = formatarPreco(valor);
    linha.append(nome, preco);
    totais.append(linha);
  });

  const detalhes = document.createElement("p");
  const entrega = pedido.entrega.tipo === "entrega" ? `Entrega em ${pedido.entrega.endereco}, ${pedido.entrega.bairro}.` : "Retirada no balcão.";
  const troco = pedido.troco ? `, troco para ${formatarPreco(pedido.troco)}` : "";
  detalhes.textContent = `${entrega} Pagamento: ${pedido.pagamento}${troco}.`;

  bloco.append(titulo, lista, totais, detalhes);
  return bloco;
}

async function removerItem() {
  const grupos = agruparItens(pedido, loja);
  const opcoes = grupos.map((g, i) => ({ id: String(i), rotulo: g.descricao.titulo, detalhe: g.quantidade > 1 ? `${g.quantidade}x` : "" }));
  const escolha = await perguntar("Qual item quer remover?", [...opcoes, VOLTAR]);
  if (escolha.id === "voltar") return;

  // Remove uma unidade do item escolhido
  const indice = grupos[Number(escolha.id)].indices.at(-1);
  pedido.itens.splice(indice, 1);
  atualizarBarra();
}

function criarBotaoWhatsApp(link, numero) {
  const bloco = document.createDocumentFragment();
  const texto = document.createElement("p");
  const recebido = numero ? `Pedido #${numero} registrado! ` : "Pedido pronto! ";
  texto.textContent = loja.loja.demonstracao
    ? `${recebido}Como esta é uma demonstração, o WhatsApp vai abrir para você escolher para quem enviar.`
    : `${recebido}Toque no botão para enviar pelo WhatsApp da loja.`;
  const botao = document.createElement("a");
  botao.className = "botao-whatsapp";
  botao.href = link;
  botao.target = "_blank";
  botao.rel = "noopener";
  botao.textContent = "Enviar pelo WhatsApp";
  bloco.append(texto, botao);
  return bloco;
}

// ---------- Banco de dados e acompanhamento ----------

// O banco é carregado só quando o pedido é enviado. Se o Firebase estiver fora do ar,
// o restante do chat continua funcionando e o pedido segue pelo WhatsApp.
async function registrarPedido() {
  try {
    const banco = await import("./banco.js");
    const id = await banco.salvarPedido(pedido, loja);
    return { banco, id, numero: banco.numeroDoPedido(id) };
  } catch (erro) {
    console.error("Não foi possível salvar o pedido no banco:", erro);
    return null;
  }
}

const MENSAGENS_DE_STATUS = {
  recebido: () => "A loja recebeu seu pedido. Assim que começar o preparo, eu te aviso por aqui.",
  preparando: () => "Seu pedido está sendo preparado! 👨‍🍳",
  pronto: (entrega) => (entrega.tipo === "entrega" ? "Seu pedido está pronto e já vai sair para entrega! 🛵" : "Seu pedido está pronto para retirada no balcão!"),
  finalizado: () => "Pedido concluído. Bom apetite! 🍔",
};

// Escuta o pedido no banco e avisa o cliente a cada mudança de status
function acompanhar(registro) {
  let ultimoStatus = null;
  const parar = registro.banco.acompanharPedido(loja.loja.id, registro.id, (dados) => {
    if (dados.status === ultimoStatus) return;
    ultimoStatus = dados.status;
    adicionarMensagem("bot", MENSAGENS_DE_STATUS[dados.status](dados.entrega));
    if (dados.status === "finalizado") parar();
  });
}

// ---------- Fluxo completo ----------

export async function fazerPedido(configuracaoDaLoja) {
  loja = configuracaoDaLoja;
  pedido = criarPedido();
  definirEtapa(1);

  const status = statusDaLoja(loja.horario);
  if (!status.aberta) {
    if (!loja.loja.demonstracao) {
      await botResponde(`No momento estamos fechados. ${status.resumo.replace("Fechado, a", "A")}.`);
      definirEtapa(0);
      return;
    }
    await botResponde("A loja está fechada agora, mas como esta é uma demonstração, você pode testar o pedido normalmente.");
  }

  let enviado = false;

  try {
    await escolherBurger();
    await adicionarMais();
    await escolherEntrega();
    // O pedido mínimo é conferido antes do endereço, para não pedir dados à toa
    await conferirMinimo();
    if (pedido.entrega.tipo === "entrega") await perguntarEndereco();
    await escolherPagamento();
    pedido.cliente = (await perguntarTexto("Para finalizar, qual é o seu nome?")).trim();

    // Resumo: o cliente pode adicionar, remover ou enviar
    while (true) {
      await botResponde(criarResumo());
      const escolha = await perguntar(null, [
        { id: "enviar", rotulo: "Tudo certo, enviar" },
        { id: "mais", rotulo: "Adicionar itens", secundaria: true },
        { id: "remover", rotulo: "Remover item", secundaria: true },
        { id: "cancelar", rotulo: "Cancelar pedido", secundaria: true },
      ]);

      if (escolha.id === "enviar") break;
      if (escolha.id === "cancelar") throw new PedidoCancelado();
      if (escolha.id === "mais") await adicionarMais();
      if (escolha.id === "remover") await removerItem();

      if (pedido.itens.length === 0) {
        await botResponde("Seu pedido ficou vazio. Vamos começar de novo?");
        await escolherBurger();
        await adicionarMais();
      }
      await conferirMinimo();
      // O total pode ter mudado, então o troco é conferido de novo
      if (pedido.troco && pedido.troco <= calcularTotal(pedido, loja)) await escolherPagamento();
    }

    const registro = await registrarPedido();
    const link = criarLink(loja, montarMensagem(pedido, loja, registro?.numero));
    await botResponde(criarBotaoWhatsApp(link, registro?.numero));

    if (registro) {
      enviado = true;
      definirEtapa(2);
      acompanhar(registro);
    }
  } catch (erro) {
    if (erro instanceof PedidoCancelado) {
      await botResponde("Pedido cancelado. Quando quiser, é só começar de novo.");
    } else {
      console.error(erro);
      await botResponde("Algo deu errado com o pedido. Pode tentar de novo?");
    }
  }

  atualizarResumo(null);
  // Com o pedido enviado, a jornada fica em "Cozinha" enquanto o cliente acompanha o status
  if (!enviado) definirEtapa(0);
}
