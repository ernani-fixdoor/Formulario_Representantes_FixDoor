# FixDoor — Formulário de Representantes

Formulário próprio (fora do Framer) para representantes solicitarem orçamento
de Portas Seccionais e Portais de Selamento. O backend usa o Google Apps
Script só como "porteiro" — a URL pública gratuita que o formulário chama —
mas os dados de verdade (representantes, arquivos, e-mail) vivem no
Microsoft 365 da FixDoor, acessados via Microsoft Graph API.

Veja o `CLAUDE.md` para o contexto completo das decisões de arquitetura.

## Configuração (primeira vez)

### 1. Azure AD App Registration (precisa de um administrador do M365)

- No [Entra admin center](https://entra.microsoft.com), crie um **App
  Registration** novo (nome sugerido: "FixDoor Formulário Representantes").
- Anote o **Tenant ID** e o **Client ID** (Application ID), que aparecem na
  tela de visão geral do app.
- Em "Certificates & secrets", crie um **Client Secret** novo e copie o
  valor na hora — ele só aparece uma vez. Anote também a data de validade,
  pra lembrar de renovar antes de vencer.
- Em "API permissions", adicione permissões de **aplicação** (não
  delegadas) da Microsoft Graph:
  - `Sites.Selected` (acesso restrito só ao site do SharePoint deste
    projeto — mais seguro que `Sites.ReadWrite.All`, que libera todos os
    sites da empresa)
  - `Mail.Send`
- Clique em "Grant admin consent" — só um administrador do tenant consegue
  aprovar isso.
- Como `Sites.Selected` não dá acesso a nenhum site por padrão, um admin
  precisa também rodar uma chamada Graph concedendo acesso deste app ao
  site específico usado no projeto (`POST /sites/{site-id}/permissions`).
- Opcional (recomendado): restrinja `Mail.Send` pra só poder enviar como a
  caixa dedicada do projeto, com uma Application Access Policy no Exchange
  Online (via PowerShell).

### 2. SharePoint (lista de representantes + pasta de arquivos)

- Crie um site do SharePoint (ou use um já existente) e, dentro dele, uma
  **Lista** chamada `Representantes` com as colunas: `Representante`,
  `Senha`, `Emails` (e-mails separados por vírgula, sem espaço).
- Preencha uma linha por representante — os e-mails aqui são os que
  recebem a notificação daquele representante; o representante nunca
  escolhe isso no formulário.
- Crie uma pasta dedicada numa biblioteca de documentos (ex: "Orçamentos
  FixDoor") pra guardar os anexos.
- Anote o **Site ID**, o **List ID** e o **Drive ID** (da biblioteca de
  documentos) e o **ID da pasta raiz** — todos obtidos via chamadas à
  Graph API ou pela URL de cada recurso.

### 3. Google Apps Script (o porteiro)

- Abra [script.google.com](https://script.google.com) e crie um projeto
  novo, numa conta Google dedicada a este projeto.
- Cole o conteúdo de `apps-script/Code.gs` no arquivo `Code.gs`.
- Cole o conteúdo de `apps-script/appsscript.json` nas configurações do
  projeto (ícone de engrenagem → mostrar arquivo `appsscript.json`).
- Em "Configurações do projeto → Propriedades do script", cadastre estas
  chaves (nunca escreva esses valores no `Code.gs`):
  - `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` (do passo 1)
  - `SITE_ID`, `LIST_ID`, `DRIVE_ID`, `PASTA_RAIZ_ID` (do passo 2)
  - `REMETENTE_EMAIL` (a caixa que vai aparecer como remetente, ex.
    `orcamentos@fixdoor.com.br`)
- Clique em **Implantar → Nova implantação → Web app**.
  - Executar como: **Eu**
  - Quem pode acessar: **Qualquer pessoa**
- Copie a URL do Web App gerada.

### 4. Front-end

- Em `js/app.js`, substitua `APPS_SCRIPT_URL` pela URL copiada no passo 3.

### 5. GitHub Pages

- No repositório, vá em Settings → Pages.
- Em "Source", escolha a branch `main` e a pasta raiz (`/`).
- Aguarde a publicação — a URL aparece na mesma tela.
- Opcional: aponte um domínio próprio via um arquivo `CNAME` + DNS.

### 6. Ligar ao site da FixDoor

- Na página do Framer, troque o formulário nativo por um link ou botão
  apontando para a URL do GitHub Pages (ou incorpore via `<iframe>`).

## Pendência técnica conhecida

Upload de arquivo maior que 4 MB (a maioria dos vídeos) já está implementado
via "upload session" em pedaços (`uploadArquivoGrande`, em `Code.gs`), mas
ainda não foi testado com um vídeo grande de verdade em produção. Ver o TODO
"Testar o fluxo ponta a ponta" no `CLAUDE.md`.

## Manutenção do dia a dia

- **Adicionar/remover representante, trocar senha ou e-mails**: edite
  direto a Lista do SharePoint — não precisa mexer em código.
- **Mudar campos do formulário**: edite `index.html`, `css/style.css` e
  `js/app.js`, e publique com o GitHub Desktop (commit + push).
- **Mudar a lógica do backend**: edite `apps-script/Code.gs` aqui, e
  depois cole a versão atualizada no editor do Apps Script (ou use o
  `clasp` para sincronizar por linha de comando).

## Segurança

Este repositório é público. Nunca coloque senha, Client Secret, IDs do
Azure AD/SharePoint, nome de representante ou e-mail de notificação em
nenhum arquivo daqui. Tudo isso vive só na Lista do SharePoint e nas
Propriedades do Script do Apps Script.
