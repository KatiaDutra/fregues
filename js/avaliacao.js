// avaliacao.js
// Pós-venda no chat: nota de 1 a 5 e um comentário opcional.
// Funciona logo depois que o pedido é concluído e também pelo link
// que o dono manda no WhatsApp (index.html?avaliar=<id do pedido>).

import { perguntar, perguntarTexto, botResponde } from "./conversa.js";
import { definirEtapa } from "./ui.js";
import { podeAvaliar } from "./pedido.js";

const NOTAS = [
  { id: "5", rotulo: "⭐⭐⭐⭐⭐ Excelente" },
  { id: "4", rotulo: "⭐⭐⭐⭐ Muito bom" },
  { id: "3", rotulo: "⭐⭐⭐ Bom" },
  { id: "2", rotulo: "⭐⭐ Ruim" },
  { id: "1", rotulo: "⭐ Muito ruim" },
];

const PULAR = { id: "pular", rotulo: "Pular", secundaria: true };
const DEPOIS = { id: "depois", rotulo: "Agora não", secundaria: true };

// Devolve true se a avaliação foi registrada
export async function avaliarPedido(loja, pedido) {
  const banco = await import("./banco.js");

  if (await banco.jaAvaliado(loja.loja.id, pedido.id)) {
    await botResponde("Esse pedido já foi avaliado. Obrigado por contar como foi!");
    return false;
  }

  const primeiroNome = pedido.cliente.split(" ")[0];
  const escolha = await perguntar(`${primeiroNome}, como foi seu pedido?`, [...NOTAS, DEPOIS]);
  if (escolha.id === "depois") {
    await botResponde("Tudo bem! Se quiser avaliar depois, a loja pode te mandar o link.");
    return false;
  }
  const nota = Number(escolha.id);

  const pergunta = nota >= 4
    ? "Que bom! Quer deixar um comentário? Pode escrever ou tocar em Pular."
    : "Poxa, sentimos muito. Conta pra gente o que aconteceu? Seu comentário vai direto para a loja.";
  const resposta = await perguntarTexto(pergunta, [PULAR]);
  const comentario = typeof resposta === "string" ? resposta.trim().slice(0, 300) : null;

  await banco.salvarAvaliacao(loja.loja.id, pedido, nota, comentario);
  definirEtapa(4);
  await botResponde(nota >= 4
    ? `Obrigado pela avaliação! Esperamos você de novo no ${loja.loja.nome}. 💛`
    : "Obrigado por avisar. A loja vai ler seu comentário com atenção e pode entrar em contato pelo WhatsApp.");
  return true;
}

// Entrada pelo link: confere se o pedido existe e já foi concluído
export async function avaliarPorLink(loja, pedidoId) {
  try {
    const banco = await import("./banco.js");
    const pedido = await banco.buscarPedido(loja.loja.id, pedidoId);
    if (!pedido) {
      await botResponde("Não encontrei esse pedido. Confira o link que a loja te mandou.");
      return;
    }
    if (!podeAvaliar(pedido)) {
      await botResponde("A avaliação deste pedido ainda não está liberada. Assim que ele for entregue e o pagamento confirmado, você pode avaliar por este mesmo link.");
      return;
    }
    await avaliarPedido(loja, pedido);
  } catch (erro) {
    console.error(erro);
    await botResponde("Não consegui abrir a avaliação agora. Tente de novo em instantes.");
  }
}
