# Contrato de dados do Freguês

Este documento descreve os dados que o Freguês entrega para **outros sistemas**: o [Centraliza](https://github.com/KatiaDutra/centraliza), planilhas e ferramentas de BI como o Power BI.

As telas do Freguês podem mudar à vontade. O que está aqui, não: quem lê esses dados confia neste formato. Qualquer mudança que quebre o formato vira uma nova **versão** do contrato, e o campo `versao` de cada registro diz qual versão ele segue.

## Vendas (versão 1)

Uma **venda** é um pedido com o pagamento confirmado pelo administrador. Ela é gravada na mesma operação que confirma o pagamento, então:

- todo pedido pago tem exatamente uma venda, com o mesmo id do pedido;
- pedido cancelado ou não pago não gera venda;
- uma venda não pode ser alterada nem apagada (regras em `firestore.rules`).

**Onde fica:** `lojas/{id da loja}/vendas/{id do pedido}`, no Firestore. Só o administrador lê.

| Campo | Tipo | Descrição |
|---|---|---|
| `versao` | número | Versão do contrato. Hoje, `1`. |
| `pedidoId` | texto | Id do pedido de origem (igual ao id da venda). |
| `numero` | texto | Número curto do pedido, como `R6ZOZ`, o mesmo que o cliente vê. |
| `origem` | texto | Sistema que gerou a venda. Sempre `"fregues"`. |
| `data` | data e hora | Quando o cliente fez o pedido. É a data usada nos relatórios e na exportação. |
| `pagoEm` | data e hora | Quando o administrador confirmou o pagamento. |
| `cliente` | texto | Nome informado pelo cliente. |
| `clienteId` | texto ou `null` | Id protegido do cartão fidelidade (o telefone nunca é guardado). `null` se o cliente não usou o cartão. Serve para contar clientes recorrentes. |
| `tipoEntrega` | texto | `"entrega"` ou `"retirada"`. |
| `bairro` | texto ou `null` | Bairro da entrega. `null` na retirada. |
| `formaPagamento` | texto | Como o cliente pagou, como `"Pix"` ou `"Cartão (maquininha)"`. |
| `momentoPagamento` | texto | `"pedido"` (pago antes) ou `"recebimento"` (pago na entrega ou retirada). |
| `itens` | lista | Itens vendidos, descritos abaixo. |
| `subtotal` | número | Soma dos itens, em reais. |
| `taxaEntrega` | número | Taxa de entrega, em reais. `0` na retirada. |
| `total` | número | Subtotal mais taxa, em reais. |
| `usouPremio` | verdadeiro/falso | Se o pedido usou o prêmio do cartão fidelidade. |

### Itens

| Campo | Tipo | Descrição |
|---|---|---|
| `produtoId` | texto ou `null` | Id do produto no cardápio, como `"smash-duplo"`. É a chave para ligar com a ficha técnica e o estoque. |
| `categoria` | texto ou `null` | `"burgers"`, `"acompanhamentos"`, `"bebidas"`, `"sobremesas"`, `"premio"` ou `"outros"`. |
| `nome` | texto | Nome do produto. |
| `detalhes` | lista de textos | Ponto da carne, adicionais e combo. |
| `combo` | verdadeiro/falso | Se o burger foi pedido no combo. |
| `quantidade` | número | Quantidade de itens iguais. |
| `precoUnitario` | número | Preço de uma unidade, já com adicionais e combo. |
| `total` | número | `quantidade` × `precoUnitario`. |

Pedidos feitos antes da Versão 5 do Freguês não guardavam produto e categoria: nas vendas deles, `produtoId` e `categoria` vêm como `null`.

### Exemplo

```json
{
  "versao": 1,
  "pedidoId": "r6zozk2m9xa1b7c3d4e5",
  "numero": "R6ZOZ",
  "origem": "fregues",
  "data": "2026-11-19T23:05:12.000Z",
  "pagoEm": "2026-11-19T23:07:40.000Z",
  "cliente": "Ana Souza",
  "clienteId": "3f1c…(64 caracteres)",
  "tipoEntrega": "entrega",
  "bairro": "Centro",
  "formaPagamento": "Pix",
  "momentoPagamento": "pedido",
  "itens": [
    {
      "produtoId": "smash-duplo",
      "categoria": "burgers",
      "nome": "Smash Duplo",
      "detalhes": ["Combo do Zé: batata frita e refrigerante lata"],
      "combo": true,
      "quantidade": 1,
      "precoUnitario": 44,
      "total": 44
    }
  ],
  "subtotal": 44,
  "taxaEntrega": 5,
  "total": 49,
  "usouPremio": false
}
```

## Exportação

No painel do administrador, a seção **Exportar vendas** gera três arquivos para o período escolhido (hoje, últimos 7 dias, este mês ou mês passado):

| Arquivo | Uma linha por | Bom para |
|---|---|---|
| Vendas (CSV) | venda | Faturamento, ticket médio, formas de pagamento, entregas por bairro |
| Itens vendidos (CSV) | item vendido | Produtos mais vendidos, curva ABC, baixa de estoque pela ficha técnica |
| Dados completos (JSON) | venda, com os itens dentro | Importação em outros sistemas, como o Centraliza |

Os CSV seguem o padrão brasileiro, para abrir direto no Excel: ponto e vírgula como separador, vírgula nos decimais, datas `dd/mm/aaaa` e acentos em UTF-8. As duas tabelas se ligam pela coluna `numero`, o que permite montar um modelo simples no Power BI (vendas como dimensão do pedido, itens como fato).

O JSON leva um cabeçalho com o nome do contrato (`"fregues.vendas"`), a versão, a loja e o período, e as datas no padrão ISO 8601, em UTC.

## Como o Centraliza vai usar

O Centraliza e o Freguês usam o **mesmo projeto do Firebase**, então o Centraliza pode ler as vendas direto do Firestore, sem exportar arquivos:

- cada venda vira uma **receita** no contas a receber, já recebida em `pagoEm`;
- cada item, pelo `produtoId`, dá **baixa no estoque de insumos** conforme a ficha técnica do produto;
- `clienteId` permite contar **clientes recorrentes** sem expor o telefone de ninguém.

A exportação continua útil para quem usa só o Freguês e controla o negócio numa planilha.
