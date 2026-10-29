// ia.js
// Camada opcional de IA: entende pedidos em texto livre e responde dúvidas.
// Chama a função intermediária (pasta worker/), nunca a API de IA diretamente,
// para que nenhuma chave fique exposta no navegador.
// Se a IA falhar, o bot volta para os botões e o pedido continua funcionando.
// Etapa: fim da semana 2.
