# Projeto separado — Documento de Design (rascunho 0.1)

> Nome provisório: **CINZA E SAL** (troque à vontade). Rascunho para o dono aprovar ou corrigir antes de qualquer código.
> Projeto independente do ANÁTEMA/Minecraft; está nesta pasta só por enquanto e pode ir para outro repositório.

## 1. Decisões já tomadas

| Item | Decisão |
|---|---|
| Motor | **Godot 4** (livre, sem royalties, texto puro → dá para versionar e testar por código) |
| Gênero | Soulslike de ação, câmera em 3ª pessoa |
| Multiplayer | **Co-op 2–4 jogadores**, por host (P2P/ENet) com opção de servidor dedicado simples depois |
| Preço | **Gratuito**, sem loja, sem microtransação |
| Fase atual | **Só planejamento** (nenhum código ainda) |

## 2. Pilares

1. **Combate pesado e justo**: cada morte deve ser culpa do jogador, nunca da câmera ou do servidor.
2. **Mundo que se entende sozinho**: história contada por lugares, itens e silêncio, não por cutscene longa.
3. **Co-op que muda o jogo**: chamar amigos deve criar situações novas, não só reduzir a vida do chefe.
4. **Estética coesa, não fotorrealista**: arte estilizada e sombria, que fica bonita com poucos recursos.

## 3. Sobre os "gráficos impecáveis"

Fotorrealismo AAA não é viável sem equipe de arte. O caminho realista é **direção de arte forte**: paleta limitada, névoa volumétrica, iluminação dramática, silhuetas marcantes, low-poly detalhado com texturas pintadas à mão. Jogos como *Hyper Light Drifter*, *Death's Door* e *Hollow Knight* mostram que isso parece "impecável" sem custar um estúdio. Assets gratuitos (CC0: Kenney, Quaternius, Poly Haven) cobrem o início.

## 4. História (proposta)

**Mundo:** *Vessa*, um reino costeiro que fez um pacto com o mar. Em troca de colheitas eternas, o povo entregou uma pessoa por geração ao oceano. O pacto quebrou: a maré parou de voltar e tudo que o mar tocou virou **sal** — cidades inteiras cristalizadas, gente presa em pé, sem apodrecer.

**Protagonistas:** os **Devolvidos** — pessoas que o mar cuspiu de volta, sem nome e sem memória, incapazes de morrer de verdade. Cada jogador do co-op é um Devolvido. A morte deles tem preço: perdem um pouco de *lembrança* (a moeda do jogo).

**Mistério central:** quem foi entregue, quem entregou e por que o mar está devolvendo gente agora. A resposta (sem spoiler no jogo até o fim): o mar não está se vingando, está **tentando devolver o que tomou**, e o último chefe é o próprio acordo.

**Atos**
1. **A Praia dos Pés Descalços**: tutorial, vila de sal, primeiro chefe (o Faroleiro).
2. **A Cidade Afogada em Pé**: verticalidade, becos, atalhos que se abrem.
3. **Os Salinas**: planícies brancas, clima hostil, chefes opcionais.
4. **O Fundo**: o mar por dentro, clímax.

**Final:** 3 finais conforme as escolhas (selar o pacto, romper o pacto, tornar-se o próximo entregue).

## 5. Sistemas principais

- **Combate:** ataque leve/pesado, esquiva com quadros de invulnerabilidade, bloqueio e *parry*, stamina, travar alvo, golpe crítico por quebra de postura.
- **Build:** 5 atributos, 6 classes de arma (espada, machado, lança, adaga, cajado, escudo-martelo), cada uma com uma habilidade única.
- **Moeda e morte:** *lembrança* cai no local da morte; morrer de novo antes de recuperar a perde.
- **Hubs:** pontos de descanso (fogueiras de sal) que reaparecem inimigos e servem de ponto de invocar amigos.
- **Co-op:** o host fixa a sessão; amigos entram por convite (código/IP), herdam o progresso do host na área, mas guardam o próprio inventário.
- **Chefes:** 8 principais + 6 opcionais; cada um com 2–3 fases e padrões legíveis.

## 6. Arquitetura técnica (Godot 4)

- Linguagem: **GDScript** (rápido de iterar); C# só se houver gargalo.
- Rede: *High-level Multiplayer API* do Godot, autoridade no host; previsão local no movimento, reconciliação nos golpes.
- Dados em arquivos `.tres/.json` (armas, inimigos, falas) para facilitar traduções e ajustes.
- Testes automáticos: GUT/gdUnit para lógica; cena de teste headless para rede.
- Exportação: Windows e Linux; CI no GitHub Actions gerando builds grátis.

```
jogo-novo/
  docs/        design e história
  game/        projeto Godot (project.godot, cenas, scripts)
  tools/       scripts de build e testes
```

## 7. Roteiro por marcos

| Marco | Entrega | Critério de pronto |
|---|---|---|
| M0 | Design aprovado | Este documento fechado |
| M1 | Protótipo de combate | Um boneco que anda, esquiva, ataca, e um inimigo básico com IA |
| M2 | Co-op mínimo | 2 jogadores na mesma arena, vendo e acertando um ao outro/inimigo |
| M3 | Fatia vertical | Praia + Faroleiro (chefe) + 1 cena de história |
| M4 | Ato 1 completo | Mapa, atalhos, itens, 3 armas |
| M5+ | Atos 2–4 | Um ato por marco |

## 8. Perguntas em aberto (para você decidir)

1. Gostou do universo **Vessa / mar / sal**, ou prefere outro (ex.: fantasia medieval clássica, sci-fi decadente, folclore brasileiro sombrio)?
2. **Nome** do jogo: manter CINZA E SAL ou escolher outro?
3. Estilo visual: **low-poly pintado** (recomendado) ou algo mais realista?
4. Quer **PvP/invasões** no futuro ou só co-op?
5. Onde fica o projeto: seguimos nesta pasta por ora ou você cria um repositório novo (eu não consigo criar daqui)?
6. Idioma: só pt-BR ou também inglês desde o começo?
