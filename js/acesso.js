// acesso.js
// Login da equipe, usado pelo painel da cozinha e pelo painel do admin.
// Depois de entrar, confere os papéis da pessoa em equipe/{uid}:
// quem não tem o papel daquela tela vê um aviso em vez dos dados.

import { app } from "./firebase.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { buscarPapeis } from "./banco.js";

const auth = getAuth(app);

const MENSAGENS_DE_ERRO = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-email": "Esse e-mail não parece válido.",
  "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet.",
};

// Links entre os painéis, para quem tem mais de um papel
const PAINEIS = {
  cozinha: { endereco: "cozinha.html", rotulo: "Cozinha" },
  admin: { endereco: "admin.html", rotulo: "Pagamentos" },
};

// papel: o papel exigido pela tela ("cozinha" ou "admin")
// aoEntrar(papeis): chamada quando a pessoa tem acesso
// aoSair(): chamada ao sair, para a tela parar de ouvir o banco
export function protegerPainel(papel, aoEntrar, aoSair) {
  const telaLogin = document.querySelector("#tela-login");
  const telaPainel = document.querySelector("#tela-painel");
  const telaSemAcesso = document.querySelector("#tela-sem-acesso");
  const botaoSair = document.querySelector("#botao-sair");
  const navegacao = document.querySelector("#navegacao-paineis");

  document.querySelector("#formulario-login").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const erro = document.querySelector("#erro-login");
    const botao = evento.submitter;
    erro.textContent = "";
    botao.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, document.querySelector("#email").value, document.querySelector("#senha").value);
    } catch (falha) {
      erro.textContent = MENSAGENS_DE_ERRO[falha.code] ?? "Não foi possível entrar. Tente de novo.";
    } finally {
      botao.disabled = false;
    }
  });

  botaoSair.addEventListener("click", () => signOut(auth));
  document.querySelector("#sair-sem-acesso")?.addEventListener("click", () => signOut(auth));

  function mostrar(tela) {
    telaLogin.hidden = tela !== "login";
    telaPainel.hidden = tela !== "painel";
    telaSemAcesso.hidden = tela !== "sem-acesso";
    botaoSair.hidden = tela === "login";
  }

  function desenharNavegacao(papeis) {
    if (!navegacao) return;
    const outros = papeis.filter((p) => p !== papel && PAINEIS[p]);
    navegacao.replaceChildren(
      ...outros.map((p) => {
        const link = document.createElement("a");
        link.href = PAINEIS[p].endereco;
        link.textContent = PAINEIS[p].rotulo;
        return link;
      })
    );
    navegacao.hidden = outros.length === 0;
  }

  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) {
      aoSair();
      desenharNavegacao([]);
      mostrar("login");
      return;
    }

    let papeis = [];
    try {
      papeis = await buscarPapeis(usuario.uid);
    } catch (erro) {
      console.error(erro);
    }

    desenharNavegacao(papeis);
    if (papeis.includes(papel)) {
      mostrar("painel");
      aoEntrar(papeis);
    } else {
      mostrar("sem-acesso");
    }
  });
}

// Um "plim" curto feito pelo navegador, sem precisar de arquivo de som
export function tocarAviso() {
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

export function tempoDecorrido(data) {
  if (!data) return "agora";
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  return `há ${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

export function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}
