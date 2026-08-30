# Alô Buzinou

PWA mobile-first de transporte escolar. Liga o **motorista** — o "Tio" da perua
— às **famílias**: convite por código, rota ao vivo no mapa, aviso de chegada,
mensalidade e agenda.

Português do Brasil em todo lugar: código, comentário, commit e interface.

> **Estado:** em desenvolvimento, **sem usuário real**. Várias decisões do
> projeto são baratas por causa disso — não há dado para migrar. Elas ficam
> caras no dia em que a primeira família entrar.

---

## Rodar

```bash
npm install --legacy-peer-deps
cp .env.example .env      # e preencha com a config do seu Firebase
npm run dev               # localhost:5173
```

`--legacy-peer-deps` não é opcional: `vite-plugin-pwa@1.x` ainda declara Vite
≤ 7 como peer, e o projeto usa Vite 8.

**`VITE_USE_EMULATORS=false` é o padrão — rodar local sem trocar isso grava no
Firebase de produção.** Para trabalhar contra o emulador:

```bash
npm run emu               # auth + firestore
```

## Verificar

```bash
npm run lint
npm run testar            # 363 casos de lógica, Node puro, sem emulador
npm run testar:regras     # 113 casos contra as rules — precisa do emulador
npm run build
npm run servir            # dist/ com os cabeçalhos do firebase.json aplicados
```

**Não existe runner de teste, e é decisão.** Sem Jest, sem Vitest: os testes
são scripts Node em [`scripts/`](scripts/), rodados direto. Teste novo segue
esse padrão em vez de trazer um framework.

Isso tem uma consequência que vale saber antes de escrever código: **lógica
pura atrás de um `import` de Firebase é lógica que não tem como ser testada** —
o script não consegue nem importar o módulo. Por isso a regra de negócio mora
em [`src/utils/`](src/utils/), sem Firebase, e os services só falam com o banco.

## A armadilha que custa mais caro

**`role: 'admin'` significa MOTORISTA**, não administrador. É nome histórico, e
está no código inteiro — incluindo `isAdmin()` nas security rules.

| `role` | Quem é | Painel |
|---|---|---|
| `owner` | dono da plataforma | `/admin` |
| `admin` | **motorista** | `/tio` |
| `parent` | responsável | `/pai` |
| `aguardando` | motorista inscrito, ainda não aprovado | `/aguardando` |

Ler `admin` como "administrador" inverte todo raciocínio de permissão. Os
papéis estão explicados em [`src/utils/papeis.js`](src/utils/papeis.js).

## Stack

React 19 · Vite 8 · Tailwind 3 · Firebase 12 (Auth, Firestore, Storage,
Functions v2 em `southamerica-east1`, FCM) · react-router 7 · Leaflet 1.9 +
react-leaflet 5 (OpenStreetMap, sem chave de API) · vite-plugin-pwa ·
lucide-react · react-hot-toast.

**JavaScript puro — não há TypeScript**, e isso também é decisão.

## Onde está o resto

| Onde | O quê |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **o índice do projeto.** Mapa de pastas, modelo de dados e os conceitos que o nome não entrega. É o que evita ler o repositório inteiro. |
| [`docs/`](docs/) | decisões normativas, arquitetura, evolução, deploy e acessos de teste. Comece pelo [`docs/README.md`](docs/README.md). |
| [`docs/decisoes.md`](docs/decisoes.md) | **leia antes de mexer em permissão, dinheiro ou dado sensível.** Se uma mudança parece uma melhoria óbvia e contraria uma decisão de lá, a decisão vence. |
| [`docs/deploy.md`](docs/deploy.md) | como colocar no ar. A ordem importa e há dois pré-requisitos de console. |
| [`firestore.rules`](firestore.rules) | a segurança real do app. Esconder botão é UX; o que impede está aqui. |

## Licença

Privado — projeto da [Desenvolva Algo](https://github.com/).
