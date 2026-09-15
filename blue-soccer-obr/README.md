Blue Soccer — Estatísticas (extensão para Owlbear Rodeo)

Extensão pra Owlbear Rodeo feita pro sistema de RPG Blue Soccer, no
estilo da Stat Bubbles for D&D: em vez de HP/Armor Class, 
ela acompanha PA, Deslocamento e Pontos de Despertar de cada personagem direto
no token, pra mesa inteira ver sem precisar abrir ficha nenhuma.

O que ela faz

- Clique com o botão direito num token > Editar Estatísticas abre um
  painel com:
  - PA (Pontos de Ação) - atual/máximo.
  - Deslocamento - atual/máximo, em metros.
  - Pontos de Despertar - 0 a 10, com pips visuais e um botão que ativa
    o Despertar sozinho quando chega a 10 (liga 5 rodadas e, ao terminar,
    já aplica a penalidade de -1 em atributos por 3 rodadas).
  - Fluxo - mesma lógica: ativa por 5 rodadas (custa 3 PA, só 1x por
    partida) e aplica a exaustão automaticamente ao terminar.
  - Posse de Bola - toggle simples.
  - Nova Rodada - um botão que recupera PA/Deslocamento e avança os
    contadores de Despertar/Fluxo de uma vez.
  - Um bloqueio de Mestre: dá pra deixar um token visível/editável só
    pra você, sem os jogadores verem.
- Toda alteração atualiza uma bolha colorida grudada no token, visível
  pra todo mundo na mesa. Fica azul-marinho no normal, dourada com
  Despertar/Fluxo ativos, e vermelho-escura durante as penalidades.

Como instalar na sua mesa

1. No seu perfil da Owlbear Rodeo, clique em Add Extension.
2. Cole esta URL:
   https://EGOSuporte-Oficial.github.io/blue-soccer-obr/manifest.json
   
3. Na sala, ative a extensão em Room Settings > Extensions.
4. Clique com o botão direito num token (Personagem, Montaria ou Item) e
   escolha Editar Estatísticas.

Dica: nos campos de PA, Deslocamento e Despertar, digite +2 ou -1 e
aperte Enter pra somar/subtrair rápido, sem precisar apagar o número todo.

Estrutura do projeto (Estrutura projetada com ajuda da Claude.IA!)

blue-soccer-obr/
├── manifest.json
├── background.html
├── editor.html
├── css/editor.css
├── js/
│   ├── shared.js       ← modelo de dados e regras de rodada
│   ├── background.js   ← menu de contexto + limpeza de bolhas órfãs
│   ├── panel.js        ← cria/atualiza a bolha no token
│   └── editor.js        ← painel de edição
└── icons/stats.svg

Tudo é HTML/CSS/JS puro (ES Modules), sem build step.

Sobre o sistema

Feita com base no Livro do Jogador de Blue Soccer (v0.9.3.2). Se você joga
Blue Soccer e sentir falta de alguma mecânica no painel, abre uma issue ou
manda sugestão.
