# Gula Print Agent

Aplicativo desktop para Windows que recebe trabalhos de impressão do SaaS Gula e envia diretamente para impressoras térmicas (ESC/POS), sem caixa de diálogo do navegador.

## Como funciona

```
SaaS (Supabase) → Edge Function → Print Agent (Windows) → Impressora Térmica
```

O Print Agent fica rodando em segundo plano (bandeja do Windows), faz polling da fila de `print_jobs` no Supabase a cada 5 segundos, e envia comandos ESC/POS diretamente para a impressora configurada.

## Pré-requisitos para desenvolvimento

- Node.js 18+
- npm

## Instalação para desenvolvimento

```bash
cd print-agent
npm install
```

## Executar em modo desenvolvimento

```bash
npm run dev
```

Isso compila o TypeScript e abre o Electron.

## Gerar o instalador .exe

```bash
npm run dist
```

O instalador será gerado em `print-agent/release/` como um arquivo `.exe` (NSIS installer).

Para uma versão portable (sem instalador):

```bash
npm run dist:portable
```

## Como o cliente instala

1. Baixar o arquivo `.exe` gerado.
2. Executar o instalador (duplo clique).
3. O instalador cria atalho na Área de Trabalho e no Menu Iniciar.
4. O Print Agent inicia automaticamente com o Windows.

## Como vincular ao restaurante

1. No painel do SaaS: Configurações → Impressoras Térmicas → o sistema mostra os agentes vinculados com seus códigos.
2. No Print Agent (Windows): colar o código de vinculação e clicar em "Conectar".
3. O agente conecta ao SaaS e começa a rodar em segundo plano.

## Como configurar Caixa e Cozinha

1. Após conectar, o Print Agent lista todas as impressoras instaladas no Windows.
2. Selecionar qual impressora usar para o Caixa e qual para a Cozinha.
3. Marcar "Usar a mesma impressora" se for o caso.
4. Clicar em "Salvar Configuração".

## Como testar a impressão

Na tela principal do Print Agent, clicar em "Imprimir Página de Teste".
Ou no painel do SaaS: Configurações → Impressoras → "Imprimir Teste".

## Estrutura do projeto

```
print-agent/
├── package.json          # Configuração + electron-builder
├── tsconfig.json
├── assets/
│   ├── icon.png          # Ícone do app (256x256)
│   ├── tray-connected.png    # Ícone bandeja conectado (16x16)
│   └── tray-disconnected.png # Ícone bandeja desconectado (16x16)
└── src/
    ├── main.ts           # Processo principal (Electron, tray, janela, auto-start)
    ├── preload.ts        # Bridge seguro entre main e renderer
    ├── saas-client.ts    # Polling de jobs, heartbeat, ack
    ├── printer-service.ts # Detecção de impressoras + envio ESC/POS
    ├── escpos.ts         # Gerador de comandos ESC/POS (cupom, cozinha, teste)
    ├── types.ts          # Tipos compartilhados
    └── renderer/
        ├── index.html    # Interface (3 telas)
        ├── styles.css    # Estilos
        └── renderer.ts   # Lógica da interface
```

## Tecnologias

- **Electron** — aplicativo desktop multiplataforma
- **@thiagoelg/node-printer** — biblioteca nativa para acesso direto às impressoras do Windows (ESC/POS via spooler)
- **TypeScript** — tipagem estática
- **electron-builder** — geração do instalador .exe (NSIS)

## Segurança

- O agente se autentica com um token único (`agent_token`) gerado pelo SaaS.
- Cada agente está vinculado a um restaurante específico.
- A Edge Function valida o token em cada requisição.
- Isolamento multitenant garantido pelas RLS policies no banco.
- O agente só aceita trabalhos de impressão do seu próprio restaurante.
