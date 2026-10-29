// ui.js
// Tudo o que mexe na tela do chat fica aqui: mensagens, "digitando", opções e jornada.
// Textos digitados pelo cliente entram sempre com textContent, nunca com innerHTML,
// para evitar que alguém injete código na página.

const areaDeMensagens = document.querySelector("#mensagens");
const areaDeOpcoes = document.querySelector("#opcoes");
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

export function mostrarOpcoes(opcoes, aoEscolher) {
  limparOpcoes();

  opcoes.forEach((opcao) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "opcao";
    botao.textContent = opcao.rotulo;
    botao.addEventListener("click", () => aoEscolher(opcao));
    areaDeOpcoes.append(botao);
  });

  // As opções ocupam espaço na tela, então a conversa precisa rolar de novo.
  rolarParaOFim();
}

export function limparOpcoes() {
  areaDeOpcoes.replaceChildren();
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
