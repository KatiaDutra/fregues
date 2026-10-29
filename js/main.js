// main.js
// Ponto de entrada da página do cliente: carrega a loja, aplica o tema e inicia o chat.
import { carregarConfiguracao } from "./config.js";
import { aplicarTema, aplicarIcone } from "./tema.js";
import { statusDaLoja } from "./horario.js";
import { configurarAvatar } from "./ui.js";
import { iniciarConversa, responderTexto } from "./bot.js";

function preencherCabecalho(loja) {
  document.title = `${loja.loja.nome} | Atendimento`;
  document.querySelector("#nome-da-loja").textContent = loja.loja.nome;
  document.querySelector("#avatar-da-loja").src = loja.loja.avatar;

  const status = statusDaLoja(loja.horario);
  const elementoStatus = document.querySelector("#status-da-loja");
  elementoStatus.textContent = status.resumo;
  elementoStatus.classList.toggle("status--fechado", !status.aberta);
}

function ativarCampoDeTexto() {
  const formulario = document.querySelector("#formulario-mensagem");
  const campo = document.querySelector("#campo-mensagem");

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = "";
    responderTexto(texto);
  });
}

async function iniciar() {
  try {
    const loja = await carregarConfiguracao();
    aplicarTema(loja.tema);
    aplicarIcone(loja.loja.avatar);
    configurarAvatar(loja.loja.avatar);
    preencherCabecalho(loja);
    ativarCampoDeTexto();
    iniciarConversa(loja);
  } catch (erro) {
    console.error(erro);
    document.querySelector("#mensagens").textContent =
      "Não foi possível carregar o atendimento. Recarregue a página para tentar de novo.";
  }
}

iniciar();
