<p align="center">
  <img src="assets/img/logo-completa.jpg" alt="Logo do Freguês: mascote robô de avental e fone de atendimento segurando um celular com um pedido" width="360">
</p>

# Freguês

**Do primeiro pedido ao freguês de sempre.**

Atendimento, pedidos e fidelidade para pequenos negócios de alimentação, com custo zero.

> Projeto em desenvolvimento como trabalho final da residência Bolsa Futuro Digital.

---

## O problema

Muitas hamburguerias, lanchonetes e açaiterias de pequeno porte recebem pedidos pelo WhatsApp de forma manual. Isso gera mensagens soltas, adicionais esquecidos, erros de preço e nenhum controle sobre quem é cliente fiel. Ferramentas prontas costumam ter mensalidade, e a API oficial do WhatsApp tem custo e exige estrutura técnica que um MEI não tem.

## A solução

O Freguês é um assistente de atendimento que acompanha toda a jornada do cliente:

1. **Acolhe** o cliente, informa horário, cardápio e responde dúvidas.
2. **Monta o pedido** com o cliente, calculando o preço em tempo real.
3. **Envia o pedido** organizado para o WhatsApp da loja e para o painel da cozinha.
4. **Registra selos** no cartão fidelidade do cliente.
5. **Faz o pós-venda**, pedindo uma avaliação e convidando o cliente a voltar.

Tudo funciona com ferramentas gratuitas e sem a API paga do WhatsApp.

## Uso de IA

No Freguês, **a IA entende e o sistema decide**.

- A IA interpreta pedidos escritos em texto livre e responde dúvidas sobre o cardápio.
- Preços, totais, selos e regras da loja são sempre calculados pelo código, a partir do arquivo de configuração.
- A chave da IA fica em uma função intermediária, nunca no navegador ou no GitHub.
- Se a IA estiver indisponível, o atendimento continua normalmente pelos botões.

## Adaptável a qualquer pequeno negócio

O cardápio, os preços, os horários e as regras da loja ficam em um único arquivo de configuração (`config/ze-burger.json`). Trocando esse arquivo, o Freguês passa a atender outro negócio, sem alterar o código.

## Roteiro de desenvolvimento

### Versão 1: atendimento e pedido
- [ ] Acolhimento com horário de funcionamento e perguntas frequentes
- [ ] Montagem do pedido com adicionais, combos e preço em tempo real
- [ ] Entrega ou retirada, com taxa por bairro e pedido mínimo
- [ ] Envio do pedido resumido para o WhatsApp da loja
- [ ] Pedido em texto livre e dúvidas respondidas com IA
- [ ] Painel da cozinha com status do pedido em tempo real

### Versão 2: fidelidade
- [ ] Cartão fidelidade identificado pelo telefone
- [ ] Selo automático quando o pedido é concluído
- [ ] Resgate do prêmio

### Versão 3: pós-venda
- [ ] Avaliação do pedido de 1 a 5
- [ ] Mensagem de agradecimento pronta para o dono enviar
- [ ] Resumo das avaliações com IA

## Tecnologias

- HTML, CSS e JavaScript (sem frameworks)
- Firebase, no plano gratuito (Firestore e Authentication)
- Cloudflare Workers, no plano gratuito, para a função intermediária da IA
- Links `wa.me` do WhatsApp
- GitHub Pages

## Como rodar localmente

O projeto carrega o arquivo de configuração com `fetch`, então ele precisa ser aberto por um servidor local, e não clicando direto no `index.html`.

1. Clone o repositório:
   ```bash
   git clone https://github.com/KatiaDutra/fregues.git
   ```
2. Abra a pasta no VS Code.
3. Instale a extensão **Live Server**.
4. Clique com o botão direito no `index.html` e escolha **Open with Live Server**.

## Estrutura do projeto

```
fregues/
├── index.html            Página do cliente
├── css/
│   └── estilos.css       Identidade visual
├── js/
│   ├── main.js           Ponto de entrada
│   ├── config.js         Carrega a configuração da loja
│   ├── bot.js            Conversa com o cliente
│   ├── pedido.js         Regras e cálculo do pedido
│   ├── whatsapp.js       Resumo e link para o WhatsApp
│   └── ia.js             Camada opcional de IA
├── config/
│   └── ze-burger.json    Cardápio e regras da loja de demonstração
├── worker/               Função intermediária da IA
├── assets/img/           Logo, ícones e favicon
└── docs/validacao/       Registro dos testes com usuários
```

## Validação com usuários

O sistema será testado com donos de pequenos negócios de alimentação e com clientes finais. Os registros, sempre anônimos, ficarão em `docs/validacao/`.

## Identidade visual

<p align="center">
  <img src="assets/img/identidade-visual.jpg" alt="Versões da marca Freguês: logo horizontal, ícone quadrado e ícone redondo" width="720">
</p>

O mascote do Freguês é um atendente robô: o fone representa o atendimento, o avental com coração representa o acolhimento e o celular representa o pedido. Os cinco ícones ao lado do nome mostram a jornada do cliente no sistema: conversa, pedido, cozinha, fidelidade e pós-venda.

| Cor | Hex | Uso |
|---|---|---|
| Creme | `#FDF8E9` | Fundo |
| Marrom | `#592012` | Texto principal e marca |
| Laranja | `#FF9B36` | Destaques e botões |
| Amarelo | `#FDB227` | Selos e sublinhados |
| Vermelho | `#E3512E` | Conversa e alertas |
| Verde | `#708D34` | Cozinha e confirmações |

As imagens da marca foram geradas com IA (Google Gemini) a partir de direção criativa da autora e adaptadas para uso na web.

## Demonstração

**Zé Burger é uma hamburgueria fictícia criada para demonstrar o Freguês.** Qualquer semelhança com estabelecimentos reais é coincidência.

## Autora

Katia Dutra · [GitHub](https://github.com/KatiaDutra)
