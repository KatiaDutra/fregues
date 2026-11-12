// fluxo-pedido.js
// Roteiro da montagem do pedido, etapa por etapa:
// burger, ponto da carne, adicionais, combo, outros itens, entrega, pagamento, nome, resumo e envio.

import { perguntar, perguntarVarios, perguntarTexto, botResponde, PedidoCancelado } from "./conversa.js";
import { atualizarResumo, definirEtapa, adicionarMensagem } from "./ui.js";
import { statusDaLoja } from "./horario.js";
import {
  criarPedido, formatarPreco, precoDoCombo, precoDoItem, agruparItens, resumoCurto,
  calcularSubtotal, calcularTaxa, calcularTotal, faltaParaMinimo, opcoesDePagamento, descreverPagamento,
} from "./pedido.js";
import { montarMensagem, criarLink } from "./whatsapp.js";
import { normalizarTelefone, gerarIdDoCliente, temPremio, criarCartaoFidelidade } from "./fidelidade.js";

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
  const { noPedido, noRecebimento } = loja.pagamento;
  const momentos = [];
  if (noPedido.length) momentos.push({ id: "pedido", rotulo: "Pagar agora" });
  if (noRecebimento.length) {
    momentos.push({ id: "recebimento", rotulo: pedido.entrega.tipo === "entrega" ? "Pagar na entrega" : "Pagar na retirada" });
  }

  // Se a loja só aceita um momento, não precisa perguntar
  pedido.momentoPagamento = momentos.length > 1
    ? (await perguntar("Quer pagar agora ou no recebimento?", momentos)).id
    : momentos[0].id;

  const formas = opcoesDePagamento(loja, pedido.momentoPagamento).map((forma) => ({ id: forma, rotulo: forma }));
  pedido.pagamento = formas.length > 1 ? (await perguntar("Qual forma de pagamento?", formas)).rotulo : formas[0].rotulo;
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

// ---------- Fidelidade ----------

const PULAR = { id: "pular", rotulo: "Pular", secundaria: true };

async function carregarBanco() {
  try {
    return await import("./banco.js");
  } catch (erro) {
    console.error("Banco indisponível:", erro);
    return null;
  }
}

// Pede o telefone para o cartão fidelidade e, se houver prêmio, oferece usar agora
async function identificarCliente() {
  let resposta = await perguntarTexto(
    "Quer juntar selos no cartão fidelidade? Me passa seu WhatsApp com DDD. Ele fica guardado de forma protegida e só serve para o cartão.",
    [PULAR]
  );

  let telefone = typeof resposta === "string" ? normalizarTelefone(resposta) : null;
  while (typeof resposta === "string" && !telefone) {
    resposta = await perguntarTexto("Não reconheci esse número. Digite com DDD, por exemplo 51 99999-0000.", [PULAR]);
    telefone = typeof resposta === "string" ? normalizarTelefone(resposta) : null;
  }
  if (!telefone) return;

  pedido.clienteId = await gerarIdDoCliente(telefone, loja.loja.id);

  const banco = await carregarBanco();
  if (!banco) return;

  let selos = 0;
  try {
    selos = await banco.buscarSelos(loja, pedido.clienteId);
  } catch (erro) {
    console.error(erro);
    return;
  }

  if (!temPremio(selos, loja)) {
    await botResponde(selos
      ? `Você já tem ${selos} selos. Este pedido vale mais um, que entra no cartão quando o pagamento for confirmado.`
      : "Bem-vindo ao cartão fidelidade! Seu primeiro selo entra no cartão quando o pagamento for confirmado.");
    return;
  }

  const usar = await perguntar(`Você tem um prêmio: ${loja.fidelidade.premio}! Quer usar neste pedido?`, [
    { id: "sim", rotulo: "Quero usar agora" },
    { id: "nao", rotulo: "Guardar para depois", secundaria: true },
  ]);
  if (usar.id === "sim") {
    pedido.usaPremio = true;
    pedido.itens.push({ tipo: "premio", id: "premio", nome: `Prêmio fidelidade: ${loja.fidelidade.premio}`, preco: 0 });
    atualizarBarra();
  }
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
  detalhes.textContent = `${entrega} Pagamento: ${descreverPagamento(pedido)}.`;

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
  if (pedido.itens[indice].tipo === "premio") pedido.usaPremio = false;
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
    const banco = await carregarBanco();
    if (!banco) return null;
    const id = await banco.salvarPedido(pedido, loja);
    return { banco, id, numero: banco.numeroDoPedido(id) };
  } catch (erro) {
    console.error("Não foi possível salvar o pedido no banco:", erro);
    return null;
  }
}

// ---------- Pagamento no ato ----------

// Chave Pix com botão de copiar. O cliente paga e manda o comprovante na conversa do WhatsApp.
function criarInstrucoesPix() {
  const bloco = document.createDocumentFragment();
  const texto = document.createElement("p");
  texto.textContent = "Para pagar, use a chave Pix abaixo e envie o comprovante na conversa do WhatsApp:";

  const chave = document.createElement("div");
  chave.className = "chave-pix";
  const valor = document.createElement("code");
  valor.textContent = loja.pagamento.chavePix;
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "chave-pix__copiar";
  botao.textContent = "Copiar";
  botao.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(loja.pagamento.chavePix);
      botao.textContent = "Copiada!";
    } catch {
      botao.textContent = "Selecione e copie";
    }
    setTimeout(() => (botao.textContent = "Copiar"), 2500);
  });
  chave.append(valor, botao);

  const recebedor = document.createElement("small");
  recebedor.textContent = `Recebedor: ${loja.pagamento.recebedorPix}`;

  bloco.append(texto, chave, recebedor);
  return bloco;
}

async function orientarPagamento() {
  if (pedido.momentoPagamento !== "pedido") return;

  if (pedido.pagamento === "Pix" && loja.pagamento.chavePix) {
    await botResponde(criarInstrucoesPix());
  } else {
    await botResponde(`A loja vai te mandar o ${pedido.pagamento.toLowerCase()} pelo WhatsApp.`);
  }
  await botResponde("Assim que a loja confirmar o pagamento, seu pedido vai para a cozinha. Eu te aviso por aqui!");
}

// ---------- Acompanhamento ----------

const MENSAGENS_DE_STATUS = {
  recebido: (dados) => dados.momentoPagamento === "pedido"
    ? "Pagamento confirmado! Seu pedido já está na fila da cozinha."
    : "A loja recebeu seu pedido. Assim que começar o preparo, eu te aviso por aqui.",
  preparando: () => "Seu pedido está sendo preparado! 👨‍🍳",
  pronto: (dados) => (dados.entrega.tipo === "entrega" ? "Seu pedido está pronto e já vai sair para entrega! 🛵" : "Seu pedido está pronto para retirada no balcão!"),
  finalizado: () => "Pedido concluído. Bom apetite! 🍔",
  cancelado: () => "O pagamento não foi confirmado e a loja cancelou o pedido. Se já pagou ou tiver alguma dúvida, fale com a loja pelo WhatsApp.",
};

// Escuta o pedido no banco e avisa o cliente a cada mudança.
// O selo só aparece quando o pedido foi concluído E o admin confirmou o pagamento,
// seja qual for a ordem em que essas duas coisas acontecerem.
function acompanhar(registro) {
  let ultimoStatus = null;
  let avisouSeloPendente = false;

  const parar = registro.banco.acompanharPedido(loja.loja.id, registro.id, (dados) => {
    if (dados.status !== ultimoStatus) {
      ultimoStatus = dados.status;
      const mensagem = MENSAGENS_DE_STATUS[dados.status];
      if (mensagem) adicionarMensagem("bot", mensagem(dados));
    }

    if (dados.status === "cancelado") {
      parar();
      return;
    }
    if (dados.status !== "finalizado") return;

    const pago = dados.situacaoPagamento === "confirmado";
    if (!dados.clienteId) {
      parar();
    } else if (pago) {
      parar();
      mostrarSeloGanho(registro.banco, dados.clienteId);
    } else if (dados.situacaoPagamento === "pendente" && !avisouSeloPendente) {
      avisouSeloPendente = true;
      adicionarMensagem("bot", "Seu selo entra no cartão fidelidade assim que a loja confirmar o pagamento.");
    }
  });
}

// O selo foi registrado junto com a confirmação do pagamento: mostra o cartão atualizado
async function mostrarSeloGanho(banco, clienteId) {
  try {
    const selos = await banco.buscarSelos(loja, clienteId);
    definirEtapa(3);
    const bloco = document.createDocumentFragment();
    const texto = document.createElement("p");
    texto.textContent = "Pagamento confirmado. Você ganhou mais um selo!";
    bloco.append(texto, criarCartaoFidelidade(selos, loja));
    adicionarMensagem("bot", bloco);
  } catch (erro) {
    console.error(erro);
  }
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
    await identificarCliente();

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

      if (pedido.itens.filter((item) => item.tipo !== "premio").length === 0 && !pedido.usaPremio) {
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

    await orientarPagamento();

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
