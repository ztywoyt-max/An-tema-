# VESSA — Documento de Design (rascunho 0.2)

> Nome provisório: **VESSA** (o reino). Projeto independente do ANÁTEMA/Minecraft.
> Mudanças da v0.1: tom tropical e luminoso (não mais sombrio/cinza), humanos **condenados pelo mar**,
> primeira + terceira pessoa, movimentação livre, **Água e Vento** como pilares.
> v0.2.1: as imagens em `referencias/` são **somente referência de estilo de arte**. Nenhum personagem, lugar ou
> enredo vem delas. A história abaixo é só um esqueleto mínimo, a ser escrita com o dono.

## 1. Decisões tomadas

| Item | Decisão |
|---|---|
| Motor | **Godot 4** (Forward+, sem royalties) |
| Gênero | Soulslike de ação, **1ª e 3ª pessoa** alternáveis |
| Multiplayer | **Co-op 2–4 jogadores** (host por ENet; servidor dedicado depois) |
| Preço | **Gratuito** |
| Mundo | Reino de **Vessa**, litoral tropical e quente |
| Arte | **Desenhada/pintada**, modelos 3D de alta qualidade, sem orçamento de polígonos, FPS alto |
| Pilares | **Água** e **Vento** |
| Fase atual | Planejamento |

## 2. Pilares de design

1. **Água e Vento em tudo**: mapa, combate, movimento, chefes e história giram em torno deles.
2. **Movimento é diversão**: correr, deslizar, investir e planar precisam ser bons só por si.
3. **Combate pesado e justo**: parry, stamina, padrões legíveis; morreu, a culpa foi sua.
4. **Beleza que contrasta**: mundo ensolarado e lindo cuja história é uma sentença cruel.
5. **Co-op que muda o jogo**: amigos criam combos de Água + Vento, não só mais dano.

## 3. Direção de arte

Alvo: **ilustração viva em 3D**, como as referências — céu azul saturado, lagoas turquesa, corais gigantes
magenta/roxo, palmeiras com sombras recortadas, pinceladas visíveis, contornos finos.

| Item | Abordagem |
|---|---|
| Sombreamento | *Toon* de 3 a 4 tons + sombra colorida (nunca preta), borda de luz (*rim*) |
| Contorno | Pós-processo por profundidade/normais, espessura variável |
| Texturas | Pintadas à mão, ruído de pincel, *triplanar* em rochas e corais |
| Água | Shader próprio: cor por profundidade, espuma nas bordas, cáusticas, ondas, reflexo estilizado |
| Vento | Campo de vento global lido pela vegetação, panos, cabelos, partículas e pela jogabilidade |
| Céu | Gradiente pintado, nuvens volumétricas estilizadas, *god rays* |
| Personagens | Roupas de tecido que balançam ao vento, cabelo físico, silhuetas marcantes |
| Desempenho | Meta 144+ FPS: LOD, oclusão, instâncias de vegetação, sem *ray tracing* |

**Paleta-guia:** turquesa `#1FC9B5`, azul-céu `#2D8FD8`, magenta-coral `#D6457A`, roxo `#6B3FA0`, verde-musgo `#6FA84A`,
amarelo-sol `#F3D36B`, areia `#EFE0B8`, ouro `#C9A24A`. Sombras tendem a azul/roxo.

**Sobre os modelos 3D:** eu escrevo todo o código, shaders, ferramentas e pipeline. Para o *conteúdo artístico*
(personagens, ruínas, corais) o caminho é: Blender com scripts Python para o que for procedural (corais, casas
de palafita, vegetação), assets CC0 como base (Quaternius, Kenney, Poly Haven) retrabalhados no estilo, e você
pode adicionar artistas/IA geradora de modelos depois. Não vou prometer escultura à mão perfeita só por texto.

## 4. História (esqueleto — a definir com o dono)

**Fixo (decidido):**
- Reino de **Vessa**, litoral tropical e quente, vilas sobre palafitas, recifes, lagoas.
- Os humanos foram **condenados pelo mar**.
- Água e Vento são as duas forças centrais.

**Em aberto (precisa de você):**
- Qual foi o crime e como é a condenação? (o que o mar impõe aos humanos, qual o custo, existe saída?)
- Quem são os jogadores e por que voltam a lutar quando morrem?
- Qual o papel do Vento na história? (aliado, rival, outra face do mar?)
- Quem são os chefes e o que eles representam?
- Quantos atos e quantos finais?

Não vou inventar personagens, relíquias ou chefes sem você aprovar. Quando você responder, a história entra aqui.

## 5. Os dois pilares em detalhe

### 5.1 Água
- **Marés dinâmicas**: o nível da água sobe e desce em ciclos; maré baixa abre caminhos e tesouros, maré alta
  abre rotas de barco e libera certos chefes.
- **Natação e mergulho**: fôlego, correntes, combate submerso com armas próprias (lança, arpão).
- **Surfar ondas**: deslizar em ondas e correntezas para viajar rápido.
- **Estado Molhado**: aumenta condução de relâmpago/gelo, diminui fogo, apaga tochas.
- **Chefes e inimigos aquáticos** que mudam o campo de batalha (inundam a arena, puxam jogadores).
- **Pontos de descanso**: pontos de descanso (visual a definir), onde o jogo salva e reaparecem inimigos.

### 5.2 Vento
- **Campo de vento**: o vento tem direção e força por região; vegetação, panos e fumaça o mostram, e o jogador
  pode usá-lo (correntes ascendentes, rajadas que carregam).
- **Impulso de vento**: segurar para carregar e investir, com rastro e distorção de tela.
- **Planar**: pano/capa abre e permite deslizar entre ilhas e torres.
- **Parry de vento**: parry perfeito solta uma rajada que empurra e quebra a postura do inimigo.
- **Canto dos Ventos**: habilidades da melodia (bardo), como sopro cortante e ciclone.

## 6. Movimentação (freestyle)

| Ação | Descrição |
|---|---|
| Corrida | Velocidade fluida, inclinação do corpo, aceleração gradual |
| Investida (dash) | Impulso curto em qualquer direção, com quadros de invulnerabilidade e rastro de vento |
| Investida carregada | Segure para um impulso longo, gasta Fôlego-de-Vento |
| Deslizar | Em ladeiras e na água rasa, conserva velocidade |
| Pulo duplo de vento | Segundo pulo apoiado numa rajada |
| Planar | Abre a capa no ar; correntes ascendentes ampliam o voo |
| Escalar | Palafitas, cordas, corais; bordas agarráveis |
| Parkour | Pular de pilar em pilar, correr em paredes curtas |
| Natação/surfe | Ver 5.1 |

Regras de ouro: input responde em ≤ 1 quadro, nada de *input lag*, estados cancelam suavemente (dash → ataque,
pulo → planar), e **câmera sempre legível**.

## 7. Câmera e interface

- **1ª e 3ª pessoa** com troca em tempo real (tecla), cada uma com o próprio *FOV*, sensibilidade e animações.
- Travar alvo na 3ª pessoa; na 1ª, mira central com assistência leve de parry.
- **Hotbar** de 8 slots (armas, consumíveis, ferramentas e Cantos); roda de seleção rápida no gamepad.
- HUD: vida, stamina, Fôlego-de-Vento, moeda; discreto, estilo desenhado, pode ser escondido.

## 8. Combate

- Ataques leve/pesado, combos, ataque aéreo e investido.
- **Parry** com janela curta, resposta forte (quebra postura, abre golpe crítico). Parry perfeito de vento
  conserva *momentum* e recompensa recuo.
- Esquiva com i-frames, bloqueio, stamina e quebra de postura.
- Armas: lâmina-concha (espada), arpão (lança), machado de coral, adagas de osso-de-peixe, cajado-ressoador
  (foco do Canto), escudo-casco (parry reforçado). Cada uma com uma habilidade de Água e uma de Vento.
- Build: 5 atributos, encantamentos de maré, runas de vento.
- **Morte**: reaparece no último ponto de descanso; a moeda fica no local da morte (perde se morrer antes
  de recuperar).

## 9. Co-op (2–4 jogadores)

- Host cria a sessão, amigos entram por código; invocação em pontos de descanso.
- Combos de Água + Vento: um joga correnteza, outro usa a rajada para surfar com o grupo.
- Ressurreição por ressurreição cooperativa (nome e custo a definir).
- Escala de vida dos chefes com o número de jogadores.
- Autoridade no host, previsão local de movimento, reconciliação de golpes.

## 10. Chefes

A definir junto com a história (seção 4). Regras já fixadas: 2–3 fases, padrões legíveis, pelo menos
uma mecânica de **Água** ou **Vento** por chefe, e vida escalada pelo número de jogadores no co-op.

## 11. Arquitetura técnica (Godot 4)

- Linguagem: **GDScript**; C# só onde houver gargalo.
- Rede: *Multiplayer API* do Godot (ENet), host autoritativo.
- Sistemas de base: `WindField` (vento global), `TideSystem` (marés), `WaterBody`, `PlayerController`
  (1ª/3ª, estados de movimento), `Combat` (hitbox/hurtbox, parry, postura), `Hotbar`, `Save`.
- Dados em `.tres/.json` (armas, inimigos, diálogos) para ajustar sem recompilar.
- Shaders: toon, contorno, água, vegetação ao vento, céu.
- Testes: GUT/gdUnit; cena headless para rede e simulação de combate.
- CI no GitHub Actions gerando builds grátis (Windows e Linux).

```
jogo-novo/
  docs/        design, história, referencias/
  game/        projeto Godot
  tools/       scripts (Blender, build, testes)
```

### Pipeline de arte 3D (Blender)
Testado nesta sessão: o módulo `bpy` (Blender 5.3) instala via pip e roda sem interface, então scripts Python
criam modelos com **materiais procedurais**, renderizam e exportam `.glb` para o Godot. Script de teste em
`../tools/blender/teste_coral.py`. Fica bom para vegetação, corais, palafitas e cenário; personagens com
rosto e anatomia exigem mais iteração (ver conversa). Meta de estilo: referências 01–08.

## 12. Roteiro por marcos

| Marco | Entrega | Pronto quando |
|---|---|---|
| M0 | Design aprovado | Este documento fechado |
| M1 | **Sensação de movimento** | Correr, dash, pulo duplo e planar bons, 1ª/3ª pessoa, vento visível |
| M2 | Água básica | Lagoa com shader, natação, maré simples |
| M3 | Combate | Ataque, parry, stamina, hotbar, inimigo com IA |
| M4 | Co-op mínimo | 2 jogadores na mesma ilha |
| M5 | **Fatia vertical** | 1 ilha, 1 chefe, estilo visual final |
| M6+ | Atos 2–4 | Um ato por marco |

## 13. Perguntas ainda em aberto

1. **Nome**: ficamos com VESSA ou quer outro?
2. **PvP/invasões** no futuro, ou só co-op?
3. **Repositório**: seguimos nesta pasta ou você cria um novo (eu não crio repositórios daqui)?
4. **Idioma**: só pt-BR ou também inglês desde o começo?
5. **Controles**: priorizar mouse e teclado, gamepad ou os dois desde o início?
6. **Personagem**: criador de personagem ou protagonista fixo (visual do bardo)?
