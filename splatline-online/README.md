# Splatline online

Paintball em primeira pessoa no navegador. Quem abre o link digita o nome e cai
num dos dois times (sorteado para equilibrar). Time contra time, com respawn.
Se faltar gente, bots completam até 3 por time.

- `server.js`: servidor Node que entrega o jogo e mantém a sala via WebSocket (`/ws`)
- `public/index.html`: o jogo inteiro (o three.js vem da CDN cdnjs)

## Rodar no seu computador

```bash
npm install
npm start
```

Abra http://localhost:8080 em duas abas, ou em dois computadores da mesma rede
usando o IP da sua máquina (`http://192.168.x.x:8080`).

## Colocar no ar de graça (Render)

1. Suba esta pasta num repositório no GitHub.
2. Em https://render.com, clique em **New → Blueprint** e escolha o repositório.
   O `render.yaml` já configura tudo (Node, `npm install`, `npm start`, plano free).
   Outra opção é **New → Web Service**, com build `npm install` e start `npm start`.
3. No fim do deploy, o Render dá um endereço como `https://splatline.onrender.com`.
   Mande esse link para os amigos. Ninguém precisa de conta nem de login.

No plano free, o servidor dorme depois de uns 15 minutos sem ninguém. O primeiro
a abrir o link espera de 30 a 60 segundos até ele acordar. Enquanto isso, o menu
mostra "sem servidor" e conecta sozinho quando o servidor volta.

Railway e Fly.io também funcionam: é um app Node comum que escuta na porta `PORT`.
A Vercel **não** serve para o servidor, porque as funções dela não mantêm um
WebSocket aberto. Se quiser o jogo na Vercel, publique só a pasta `public/` lá
e aponte para o servidor do Render com `?server=`:

```
https://seu-jogo.vercel.app/?server=wss://splatline.onrender.com/ws
```

## Ajustes

- `MAX_PEERS` (variável de ambiente): máximo de jogadores na sala. Padrão: 24.
- `?debug` no link expõe `window.__splat` no console, com o estado do jogo.

## Como a sala funciona

Cada jogador manda a própria posição cerca de 20 vezes por segundo e os tiros em
lotes a cada 100 ms. Quem é acertado decide no próprio computador e avisa a sala
(evento `out`). O jogador com o menor id da sala roda os bots. O servidor só
repassa mensagens e não tem autoridade sobre o jogo, então dá para trapacear pelo
console. É para jogar entre amigos.
