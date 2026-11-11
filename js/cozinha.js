// cozinha.js
// Painel da cozinha: login, pedidos em tempo real e mudança de status.
// Esta é uma tela de gestão, então usa a marca do Freguês, não a da loja.

import { app } from "./firebase.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { carregarConfiguracao } from "./config.js";
import { acompanharPedidosRecentes, mudarStatus, numeroDoPedido } from "./banco.js";
import { formatarPreco } from "./pedido.js";

const auth = getAuth(app);
let loja = null;
let pedidos = [];
let pararDeOuvir = null;
let primeiraCarga = true;

const telaLogin = document.querySelector("#tela-login");
const telaQuadro = document.querySelector("#tela-quadro");
const botaoSair = document.querySelector("#botao-sair");
const aviso = document.querySelector("#aviso");

// Próximo passo de cada status, com o texto do botão
const PROXIMO_PASSO = {
  recebido: { status: "preparando", rotulo: "Começar preparo" },
  preparando: { status: "pronto", rotulo: "Marcar como pronto" },
  pronto: { status: "finalizado", rotulo: "Finalizar" },
};

// ---------- Login ----------

const MENSAGENS_DE_ERRO = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Esse e-mail não parece válido.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet.",
};

document.querySelector("#formulario-login").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const erro = document.querySelector("#erro-login");
  erro.textContent = "";

  try {
    await signInWithEmailAndPassword(auth, document.querySelector("#email").value, document.querySelector("#senha").value);
  } catch (falha) {
    erro.textContent = MENSAGENS_DE_ERRO[falha.code] ?? "Não foi possível entrar. Tente de novo.";
  }
});

botaoSair.addEventListener("click", () => signOut(auth));

// ---------- Aviso sonoro ----------

// Um "plim" curto feito pelo navegador, sem precisar de arquivo de som
function tocarAviso() {
  try {
    const audio = new AudioContext();
    [880, 1175].forEach((frequencia, i) => {
      const nota = audio.createOscillator();
      const volume = audio.createGain();
      nota.frequency.value = frequencia;
      volume.gain.setValueAtTime(0.2, audio.currentTime + i * 0.18);
      volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + i * 0.18 + 0.4);
      nota.connect(volume).connect(audio.destination);
      nota.start(audio.currentTime + i * 0.18);
      nota.stop(audio.currentTime + i * 0.18 + 0.4);
    });
  } catch {
    // Se o navegador bloquear o som, o painel continua funcionando
  }
}

// ---------- Quadro ----------

function tempoDecorrido(data) {
  if (!data) return "agora";
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  return `há ${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function criarCartao(pedido) {
  const cartao = criarElemento("article", "cartao");
  const criadoEm = pedido.criadoEm?.toDate();

  // Cabeçalho: número, hora e tempo de espera
  const topo = criarElemento("header", "cartao__topo");
  topo.append(criarElemento("strong", "cartao__numero", `#${numeroDoPedido(pedido.id)}`));
  const hora = criadoEm ? criadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  topo.append(criarElemento("span", "cartao__hora", `${hora} · ${tempoDecorrido(criadoEm)}`));
  cartao.append(topo);

  cartao.append(criarElemento("p", "cartao__cliente", pedido.cliente));

  // Itens
  const lista = criarElemento("ul", "cartao__itens");
  pedido.itens.forEach((item) => {
    const linha = criarElemento("li");
    linha.append(criarElemento("strong", "", `${item.quantidade}x ${item.titulo}`));
    item.detalhes.forEach((detalhe) => linha.append(criarElemento("small", "", detalhe)));
    lista.append(linha);
  });
  cartao.append(lista);

  // Entrega e pagamento
  const entrega = pedido.entrega.tipo === "entrega"
    ? `Entrega: ${pedido.entrega.endereco}, ${pedido.entrega.bairro}`
    : "Retirada no balcão";
  cartao.append(criarElemento("p", "cartao__info", entrega));
  const troco = pedido.troco ? `, troco para ${formatarPreco(pedido.troco)}` : "";
  cartao.append(criarElemento("p", "cartao__info", `${pedido.pagamento}${troco} · Total ${formatarPreco(pedido.total)}`));

  // Botão para avançar o status
  const passo = PROXIMO_PASSO[pedido.status];
  const botao = criarElemento("button", "botao-principal", passo.rotulo);
  botao.type = "button";
  botao.addEventListener("click", async () => {
    botao.disabled = true;
    try {
      await mudarStatus(loja.loja.id, pedido.id, passo.status);
    } catch (erro) {
      console.error(erro);
      botao.disabled = false;
      mostrarAviso("Não foi possível atualizar o pedido. Confira a conexão.");
    }
  });
  cartao.append(botao);

  return cartao;
}

function desenharQuadro() {
  ["recebido", "preparando", "pronto"].forEach((status) => {
    const doStatus = pedidos.filter((p) => p.status === status);
    document.querySelector(`#contador-${status}`).textContent = doStatus.length;

    const lista = document.querySelector(`#lista-${status}`);
    lista.replaceChildren(...doStatus.map(criarCartao));
    if (doStatus.length === 0) lista.append(criarElemento("p", "coluna__vazia", "Nenhum pedido aqui."));
  });
}

function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.hidden = false;
  setTimeout(() => (aviso.hidden = true), 5000);
}

function comecarAOuvir() {
  primeiraCarga = true;
  pararDeOuvir = acompanharPedidosRecentes(
    loja.loja.id,
    (lista, novos) => {
      pedidos = lista;
      desenharQuadro();
      if (!primeiraCarga && novos > 0) {
        tocarAviso();
        mostrarAviso(novos === 1 ? "Novo pedido!" : `${novos} pedidos novos!`);
      }
      primeiraCarga = false;
    },
    (erro) => {
      console.error(erro);
      mostrarAviso("Sem permissão para ver os pedidos. Confira as regras do Firestore e o UID da cozinha.");
    }
  );
}

// O tempo de espera dos cartões é atualizado a cada 30 segundos
setInterval(() => {
  if (pedidos.length) desenharQuadro();
}, 30000);

// ---------- Início ----------

async function iniciar() {
  loja = await carregarConfiguracao();
  document.querySelector("#nome-da-loja").textContent = `Cozinha · ${loja.loja.nome}`;

  onAuthStateChanged(auth, (usuario) => {
    const logado = Boolean(usuario);
    telaLogin.hidden = logado;
    telaQuadro.hidden = !logado;
    botaoSair.hidden = !logado;

    if (logado) {
      comecarAOuvir();
    } else if (pararDeOuvir) {
      pararDeOuvir();
      pararDeOuvir = null;
    }
  });
}

iniciar();
