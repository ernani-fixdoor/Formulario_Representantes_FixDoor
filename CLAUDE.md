# FixDoor — Formulário de Representantes

## O que é este projeto

Formulário de solicitação de orçamento (Portas Seccionais e Portais de Selamento) para
representantes comerciais externos da FixDoor. Hoje vive dentro do site em Framer
(https://www.fixdoor.com.br/formulario-representantes), usando o formulário nativo do
Framer. Este repositório substitui esse formulário nativo por uma solução própria,
porque o Framer não resolve três necessidades:

1. Upload de fotos e vídeos anexados ao pedido.
2. Um portão de senha por representante: cada representante tem sua própria senha; ao
   entrar, o campo "Representante" já vem preenchido com o nome dele, travado (não
   editável), e ele nunca deve conseguir ver a lista dos demais representantes.
3. Roteamento condicional de e-mail: cada representante precisa notificar um conjunto
   diferente e configurável de e-mails.

## Regra importante sobre o roteamento de e-mail

Os e-mails de destino de cada representante são **pré-definidos**, cadastrados por quem
administra o projeto na Lista do SharePoint (coluna `Emails`). O representante que
preenche o formulário **nunca escolhe nem vê** quem recebe a solicitação — essa decisão
não deve, em nenhuma hipótese, virar um campo do formulário. O formulário só carrega o
nome do representante (travado, vindo da senha); o backend é quem resolve, sozinho,
para quais e-mails aquele envio vai.

## Por que esta arquitetura

Avaliamos Jotform e Tally (no-code), mas nenhum resolve tudo de graça: o Jotform trava
a notificação por e-mail em 1 destinatário no plano gratuito; o Tally exige o plano Pro
pra personalizar o destinatário dinamicamente. Decidimos por uma solução própria:

- **Front-end**: HTML/CSS/JS estático, hospedado de graça no GitHub Pages, publicado a
  partir deste repositório (atualizado via GitHub Desktop, a partir de uma pasta local).
- **Back-end**: Google Apps Script (Web App) atuando como **porteiro** — a URL pública
  gratuita e sem cartão de crédito que o formulário chama.

A FixDoor já usa o Microsoft 365 for business para e-mail, armazenamento em nuvem e
planilhas. Por isso, o Apps Script não guarda dado nenhum — ele autentica como
aplicação no Azure AD (Entra ID) e fala com a **Microsoft Graph API** para:

1. Ler a Lista do SharePoint com Representante | Senha | Emails, e devolver *só* o
   nome do representante que bateu com a senha — nunca a lista inteira.
2. Salvar os arquivos (fotos/vídeos) no OneDrive/SharePoint da FixDoor, organizados
   automaticamente por representante e por envio.
3. Enviar o e-mail via Outlook (Graph `/sendMail`), a partir de uma caixa dedicada
   (ex: `orcamentos@fixdoor.com.br`), para os e-mails configurados na Lista.

## Autenticação (Azure AD / Entra ID)

- App Registration próprio do projeto, com permissões de **aplicação** (não
  delegadas): `Sites.Selected` (acesso restrito só ao site do SharePoint usado aqui,
  não a todos os sites da empresa) e `Mail.Send`.
- Autenticação via **client credentials flow**: o Apps Script troca Tenant ID + Client
  ID + Client Secret por um token de acesso (válido ~1h), guardado em cache
  (`CacheService`) entre chamadas.
- Um administrador do M365 precisa dar "Grant admin consent" nas permissões e
  conceder acesso ao site específico (`Sites.Selected` não libera nada por padrão).

## Segredos e onde eles vivem

Nada de Tenant ID, Client ID, Client Secret, Site ID, List ID, Drive ID, ID da pasta
raiz ou o e-mail remetente fica escrito em `Code.gs`. Tudo isso mora nas **Propriedades
do Script** (Configurações do projeto → Propriedades do script, no editor do Apps
Script) e é lido em tempo de execução por `getConfig()`. Isso vale mesmo o `Code.gs`
sendo espelhado neste repositório público — o arquivo nunca carrega segredo nenhum.

Este repositório é público (exigência do plano gratuito do GitHub Pages). Nunca
commitar aqui: senha de representante, Client Secret, IDs do Azure AD/SharePoint,
nome de representante ou e-mail de notificação.

## Conta do Google (papel mudou)

O Apps Script continua rodando numa conta Google dedicada ao projeto (separada de
contas pessoais), mas o papel dela mudou: ela só hospeda o script e faz chamadas de
saída (`UrlFetchApp`) para a Microsoft Graph. Não usa mais Gmail nem Drive próprios —
o envio de e-mail e o armazenamento de arquivo acontecem inteiramente do lado do
Microsoft 365 da FixDoor.

## Organização dos arquivos no Microsoft 365

Dentro da pasta raiz configurada (`PASTA_RAIZ_ID`), no drive configurado (`DRIVE_ID`):

```
<Pasta raiz>
  └── <Representante>
        └── <2026-08-29_1430 - Nome do solicitante>
              ├── foto1.jpg
              └── video1.mp4
```

**Sem limpeza automática**: por decisão de quem administra o projeto (há bastante
armazenamento disponível no Microsoft 365 da FixDoor), os arquivos ficam salvos por
tempo indeterminado — não existe rotina nenhuma apagando pastas antigas.

## Pendências técnicas conhecidas

- **Upload de arquivo grande**: ✅ implementado e testado ponta a ponta (vídeo de
  36 MB). Arquivos ≤ 4 MB usam PUT direto; acima disso, `uploadArquivoGrande` (em
  `Code.gs`) cria uma "upload session" (`createUploadSession`) e envia o arquivo em
  pedaços de 10 MB via PUT direto na `uploadUrl` devolvida (sem passar pelo
  `chamarGraph`, já que essa URL já vem pré-autenticada). Ponto de atenção: o Apps
  Script tem limite de 6 minutos de execução por chamada; um vídeo muito grande com
  conexão lenta pode estourar esse limite (sem retry automático em caso de erro
  transitório).
  - **Pegadinha do `UrlFetchApp`**: não dá pra setar o header `Content-Length`
    manualmente (o Apps Script calcula sozinho e lança
    `Exception: Atributo fornecido com valor inválido: Header:Content-Length` se
    você tentar) — só `Content-Range` é necessário no PUT de cada pedaço.
- **Renovação do Client Secret**: tem validade (normalmente até 2 anos) e precisa ser
  trocado antes de vencer, ou o porteiro para de autenticar.
- **Cota de chamadas**: cada envio de formulário agora faz várias chamadas
  `UrlFetchApp` (token + consulta da lista + criar pastas + upload por arquivo +
  enviar e-mail). A cota diária de `UrlFetchApp` (20.000/dia em conta Google
  consumer) cobre esse volume com folga, mas vale monitorar se o volume crescer muito.

## Campos do formulário (migrados do Framer)

- Tipo de solicitação: "Porta Seccional | Nova" ou "Portal de Selamento" — controla
  quais campos aparecem, do mesmo jeito que o Framer fazia com código customizado.
- **Removido**: o campo "Vendedor" antigo (misturava vendedor interno + parceiro, ex.
  "Tom | Fransisco") não existe mais. Foi substituído pelo campo "Representante",
  travado, vindo do portão de senha.
- Campos comuns: Nome do solicitante, E-mail do cliente, Telefone do cliente, CNPJ do
  cliente, Cidade, Estado, Frete (Sim/Não), Mão de obra (Sim/Não), Quantidade de portas,
  Largura do vão (mm), Altura do vão (mm), Pé direito (mm), Tipo de acionamento
  (Manual/Motorizada/Talha), Número de visores (0–10), Rebatimento (VL/HL/SL/LH),
  Acessórios estruturais (Estrutura metálica, Mão francesa — múltipla escolha),
  Estrutura da coluna/parede (dropdown), Itens extra e observações (texto livre).
- Upload de fotos e vídeos (múltiplos arquivos).
- **Não existe** (e não deve existir) nenhum campo de escolha de destinatário — ver
  "Regra importante sobre o roteamento de e-mail" acima.

## Estrutura do repositório

- `index.html` — página única: portão de senha + formulário.
- `css/style.css` — estilo.
- `js/app.js` — lógica: valida a senha, mostra/esconde campos por tipo, envia o
  formulário e os anexos. Não muda com a migração pro Microsoft Graph — o contrato
  (ação, campos, formato da resposta) continua o mesmo.
- `apps-script/Code.gs` — o porteiro: autentica no Azure AD, chama a Microsoft Graph.
- `apps-script/appsscript.json` — manifesto do projeto Apps Script.
- `README.md` — passo a passo de configuração (Azure AD, SharePoint, Apps Script).

## Estado atual / TODO

- [ ] Criar a conta do Google dedicada ao projeto (hospeda só o script agora).
- [ ] Cadastrar o App Registration no Azure AD (Tenant ID, Client ID, Client Secret,
      permissões `Sites.Selected` + `Mail.Send`, admin consent).
- [ ] Conceder ao app acesso ao site do SharePoint específico (`Sites.Selected` não
      libera nada por padrão).
- [ ] Criar a Lista `Representantes` no SharePoint (Representante | Senha | Emails) e
      a pasta raiz de arquivos numa biblioteca de documentos.
- [ ] Anotar Site ID, List ID, Drive ID e ID da pasta raiz.
- [ ] Colar `apps-script/Code.gs` e `appsscript.json` no editor do Apps Script.
- [ ] Cadastrar todas as chaves nas Propriedades do Script (nunca em `Code.gs`):
      `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `SITE_ID`, `LIST_ID`, `DRIVE_ID`,
      `PASTA_RAIZ_ID`, `REMETENTE_EMAIL`.
- [ ] Publicar o Web App (Executar como: Eu / Quem pode acessar: Qualquer pessoa) e
      colar a URL em `js/app.js` (`APPS_SCRIPT_URL`).
- [x] Implementar a upload session pra arquivos > 4 MB (ver "Pendências técnicas").
- [x] Testar o fluxo ponta a ponta com uma senha de teste, incluindo um vídeo grande.
- [ ] Ativar o GitHub Pages neste repositório (Settings → Pages → branch main → pasta
      raiz).
- [ ] Ajustar o CSS pra bater com a identidade visual da FixDoor (cores, logo).
- [ ] Ligar a página do Framer a este formulário (link ou iframe).

## Preferências de quem está construindo isso

- Tudo precisa continuar gratuito — sem SaaS pago, sem cartão de crédito. O Apps
  Script continua sendo o porteiro por causa disso; o motivo de trazer o Microsoft
  Graph pra dentro dele é manter os dados no ecossistema M365 que a FixDoor já usa,
  sem trocar essa peça central.
- Prefere manter os dois códigos (front-end e o espelho local do Apps Script) na mesma
  pasta, sincronizada com GitHub Desktop.
- Vai usar o Claude Code para toda a manutenção contínua deste projeto — incluindo
  terminar a implementação da upload session e testar a integração com o Azure AD.
