// ui.js
// Tudo o que mexe na tela do chat fica aqui: mensagens, "digitando", opções, resumo e jornada.
// Textos digitados pelo cliente entram sempre com textContent, nunca com innerHTML,
// para evitar que alguém injete código na página.

const areaDeMensagens = document.querySelector("#mensagens");
const areaDeOpcoes = document.querySelector("#opcoes");
const barraDeResumo = document.querySelector("#resumo-pedido");
const etapasDaJornada = document.querySelectorAll(".jornada li");

let avatarDoBot = "";

export function configurarAvatar(caminho) {
  avatarDoBot = caminho;
}

// Rola até a última mensagem. Se ela for maior que a área visível
// (como o cardápio), mostra o começo dela em vez do fim.
function rolarParaOFim() {
  const ultima = areaDeMensagens.lastElementChild;
  if (!ultima) return;

  if (ultima.offsetHeight > areaDeMensagens.clientHeight - 40) {
    const distancia = ultima.getBoundingClientRect().top - areaDeMensagens.getBoundingClientRect().top;
    areaDeMensagens.scrollTop += distancia - 12;
  } else {
    areaDeMensagens.scrollTop = areaDeMensagens.scrollHeight;
  }
}

// autor: "bot" ou "cliente". conteudo: texto ou elemento HTML montado pelo bot.
export function adicionarMensagem(autor, conteudo) {
  const linha = document.createElement("div");
  linha.className = `mensagem mensagem--${autor}`;

  if (autor === "bot") {
    const avatar = document.createElement("img");
    avatar.src = avatarDoBot;
    avatar.alt = "";
    avatar.className = "mensagem__avatar";
    linha.append(avatar);
  }

  const balao = document.createElement("div");
  balao.className = "mensagem__balao";

  if (typeof conteudo === "string") {
    balao.textContent = conteudo;
  } else {
    balao.append(conteudo);
  }

  linha.append(balao);
  areaDeMensagens.append(linha);
  rolarParaOFim();
}

export function mostrarDigitando() {
  const indicador = document.createElement("div");
  indicador.className = "mensagem mensagem--bot digitando";
  indicador.setAttribute("aria-label", "Digitando");
  indicador.innerHTML = '<div class="mensagem__balao"><span></span><span></span><span></span></div>';
  areaDeMensagens.append(indicador);
  rolarParaOFim();
  return () => indicador.remove();
}

function criarBotao(opcao) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "opcao";
  botao.textContent = opcao.rotulo;

  // Preço ou informação extra aparece menor, ao lado do rótulo
  if (opcao.detalhe) {
    const detalhe = document.createElement("span");
    detalhe.className = "opcao__detalhe";
    detalhe.textContent = opcao.detalhe;
    botao.append(detalhe);
  }
  return botao;
}

export function mostrarOpcoes(opcoes, aoEscolher) {
  limparOpcoes();

  opcoes.forEach((opcao) => {
    const botao = criarBotao(opcao);
    if (opcao.secundaria) botao.classList.add("opcao--secundaria");
    botao.addEventListener("click", () => aoEscolher(opcao));
    areaDeOpcoes.append(botao);
  });

  // As opções ocupam espaço na tela, então a conversa precisa rolar de novo.
  rolarParaOFim();
}

// Opções que podem ser marcadas e desmarcadas (como os adicionais),
// com um botão para confirmar. Devolve funções para o bot controlar pelo texto.
export function mostrarSelecao(opcoes, rotuloConfirmar, aoMudar, aoConfirmar) {
  limparOpcoes();
  const marcadas = new Set();
  const botoes = new Map();

  const confirmar = criarBotao({ rotulo: rotuloConfirmar(marcadas) });
  confirmar.classList.add("opcao--confirmar");

  function alternar(id) {
    if (marcadas.has(id)) {
      marcadas.delete(id);
    } else {
      marcadas.add(id);
    }
    botoes.get(id).setAttribute("aria-pressed", marcadas.has(id));
    confirmar.firstChild.textContent = rotuloConfirmar(marcadas);
    aoMudar(marcadas);
  }

  opcoes.forEach((opcao) => {
    const botao = criarBotao(opcao);
    botao.classList.add("opcao--marcavel");
    botao.setAttribute("aria-pressed", "false");
    botao.addEventListener("click", () => alternar(opcao.id));
    botoes.set(opcao.id, botao);
    areaDeOpcoes.append(botao);
  });

  confirmar.addEventListener("click", () => aoConfirmar([...marcadas]));
  areaDeOpcoes.append(confirmar);
  rolarParaOFim();

  return { alternar, confirmar: () => aoConfirmar([...marcadas]) };
}

export function limparOpcoes() {
  areaDeOpcoes.replaceChildren();
}

// Barra com a quantidade de itens e o subtotal. texto = null esconde a barra.
export function atualizarResumo(texto) {
  barraDeResumo.hidden = !texto;
  barraDeResumo.textContent = texto ?? "";
}

export function definirEtapa(indice) {
  etapasDaJornada.forEach((etapa, i) => {
    if (i === indice) {
      etapa.setAttribute("aria-current", "step");
    } else {
      etapa.removeAttribute("aria-current");
    }
  });
}
