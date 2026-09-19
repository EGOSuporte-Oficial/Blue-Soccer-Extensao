# Blue Soccer — Estatísticas

Extensão para a Owlbear Rodeo feita para o sistema de RPG **Blue Soccer**, no
estilo da **Stat Bubbles for D&D** (de Seamus Finlayson): em vez de HP/Armor
Class, ela acompanha **PA**, **Deslocamento**, **Pontos de Despertar** e
**Fluxo** de cada personagem direto no token, para a mesa inteira ver sem
precisar abrir ficha nenhuma.

## Instalação

A extensão ainda não está na loja oficial da Owlbear Rodeo, então a
instalação é manual:

1. No seu perfil da Owlbear Rodeo, clique em **Add Extension**.
2. Cole esta URL:
   ```
   https://egosuporte-oficial.github.io/Blue-Soccer-Extensao/manifest.json
   ```
3. Na sala, ative a extensão em **Room Settings → Extensions**.

## Como funciona

Cada token com estatísticas ganha duas bolhas diferentes:

- **Marcador** — pequeno, fica sempre visível pra mesa inteira, com PA e
  Deslocamento num relance. Cada jogador pode escolher individualmente
  esconder o marcador de um token específico (não afeta os outros).
- **Detalhe** — a leitura completa, com pips do Despertar e status de
  rodadas. Aparece só **pra você**, só quando **você seleciona** aquele
  token, e some sozinho ao desselecionar.

## O Básico

Clique com o botão direito num token (Personagem, Montaria ou Item) e
escolha **Editar Estatísticas**. O painel abre em duas abas:

**Estatísticas**
- **PA (Pontos de Ação)** — atual/máximo.
- **Deslocamento** — atual/máximo, em metros.
- **Pontos de Despertar** — 0 a 10, com pips visuais. Ativa sozinho ao
  chegar em 10 (liga 5 rodadas e, ao terminar, aplica a penalidade de -1 em
  atributos por 3 rodadas). Só pode ser usado 1x por partida.
- **Fluxo** — mesma lógica: ativa por 5 rodadas (custa 3 PA, só 1x por
  partida) e aplica a exaustão automaticamente ao terminar.
- **Posse de Bola** — ao ativar, o Deslocamento efetivo cai pela metade
  (regra do Livro do Jogador), a menos que uma habilidade diga o contrário.

**Ações**
- Escolher se o marcador deste token aparece pra você ou não.
- **Nova Rodada** — recupera PA e Deslocamento, avança os contadores de
  Despertar/Fluxo.
- Remover as estatísticas do token.

Dica: em qualquer campo de número, digite `+2` ou `-1` e aperte Enter para
somar/subtrair rápido, sem apagar o valor todo.

## Tabela de Estatísticas

Um botão na barra de ferramentas (ícone de grade) abre a tabela com todos
os tokens rastreados na cena atual. De lá dá pra:

- Ver e editar PA, Deslocamento e Despertar de qualquer token, direto na
  lista.
- Clicar numa linha para mover a câmera até aquele token e destacá-lo com
  um contorno (visível só pra você).

## Configurações

Dentro da tabela, o botão **Configurações** dá acesso a:

- **Permissões** (só o Mestre edita): quem pode ver as estatísticas (todos
  ou só o Mestre) e quem pode editar cada token (só quem colocou o token,
  ou qualquer jogador).
- **Aparência da bolha**: formação (embaixo ou em cima do token),
  distância, mostrar barras em vez de números, e mostrar o nome do token
  junto (name tag).
- **Suporte**: link para estas instruções, contato para reportar bugs, e o
  convite do servidor do Discord — visível pra todo mundo.

## Sobre o sistema

Feita com base no Livro do Jogador de Blue Soccer (v0.9.3.2). Se você joga
Blue Soccer e sentir falta de alguma mecânica no painel, entre em contato
pelos links de suporte dentro da extensão.

## Créditos

O conceito de bolhas de estatísticas grudadas no token é inspirado na
[Stat Bubbles for D&D](https://github.com/seamuslowry/owlbear-stat-bubbles),
de Seamus Finlayson — adaptada aqui do zero para as regras específicas de
Blue Soccer.

## Licença

Todos os direitos reservados. Sinta-se à vontade para instalar e usar a
extensão pelo link acima, mas o código-fonte não deve ser copiado,
redistribuído ou reaproveitado sem autorização.
