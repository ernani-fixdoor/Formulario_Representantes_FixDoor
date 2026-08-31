// =====================================================================
// FixDoor — Formulário de Representantes — Backend (Apps Script "porteiro")
// =====================================================================
//
// Este script NÃO guarda os dados de verdade. Ele só:
//   1. Recebe a chamada do formulário (GitHub Pages).
//   2. Autentica como aplicação no Azure AD (client credentials).
//   3. Fala com a Microsoft Graph API pra ler/gravar no Microsoft 365 da FixDoor
//      (Lista do SharePoint, OneDrive/SharePoint, Outlook).
//
// Nenhum segredo (Client Secret, IDs de tenant/site/lista/drive, e-mail
// remetente) fica escrito neste arquivo. Tudo isso vive nas Propriedades do
// Script — Configurações do projeto → Propriedades do script, no editor do
// Apps Script — e é lido em tempo de execução por getConfig().
//
// REGRA IMPORTANTE: os e-mails de destino de cada representante são
// pré-definidos na Lista do SharePoint (coluna "Emails"), cadastrados por
// quem administra o projeto. O representante que preenche o formulário
// nunca escolhe nem vê quem recebe a solicitação — essa lógica não deve
// nunca virar um campo do formulário.

function getConfig(chave) {
  const valor = PropertiesService.getScriptProperties().getProperty(chave);
  if (!valor) throw new Error('Falta configurar "' + chave + '" nas Propriedades do Script.');
  return valor;
}

// ===== ROTEADOR =====

function doPost(e) {
  const corpo = JSON.parse(e.postData.contents);
  let resposta;

  try {
    if (corpo.acao === 'validarSenha') {
      resposta = validarSenha(corpo.senha);
    } else if (corpo.acao === 'enviarOrcamento') {
      resposta = enviarOrcamento(corpo);
    } else {
      resposta = { ok: false, erro: 'Ação desconhecida' };
    }
  } catch (erro) {
    resposta = { ok: false, erro: String(erro) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(resposta))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== AUTENTICAÇÃO NO AZURE AD (client credentials) =====

function getTokenGraph() {
  const cache = CacheService.getScriptCache();
  const tokenCache = cache.get('graph_token');
  if (tokenCache) return tokenCache;

  const tenantId = getConfig('TENANT_ID');
  const url = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token';

  const resposta = UrlFetchApp.fetch(url, {
    method: 'post',
    payload: {
      grant_type: 'client_credentials',
      client_id: getConfig('CLIENT_ID'),
      client_secret: getConfig('CLIENT_SECRET'),
      scope: 'https://graph.microsoft.com/.default'
    },
    muteHttpExceptions: true
  });

  const dados = JSON.parse(resposta.getContentText());
  if (!dados.access_token) {
    throw new Error('Não consegui autenticar no Azure AD: ' + resposta.getContentText());
  }

  const expiraEm = (dados.expires_in || 3600) - 60; // guarda 1 min de margem
  cache.put('graph_token', dados.access_token, expiraEm);
  return dados.access_token;
}

// Helper genérico pra qualquer chamada à Microsoft Graph.
function chamarGraph(caminho, opcoes) {
  opcoes = opcoes || {};
  const token = getTokenGraph();
  const headers = Object.assign({ Authorization: 'Bearer ' + token }, opcoes.headers || {});

  const resposta = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0' + caminho, Object.assign(
    { headers: headers, muteHttpExceptions: true },
    opcoes
  ));

  const codigo = resposta.getResponseCode();
  if (codigo >= 400) {
    throw new Error('Graph API respondeu ' + codigo + ' em ' + caminho + ': ' + resposta.getContentText());
  }
  return resposta;
}

// ===== VALIDAR SENHA (Lista do SharePoint) =====

function validarSenha(senha) {
  const item = buscarRepresentantePorSenha(senha);
  if (!item) return { ok: false };
  return { ok: true, representante: item.representante };
}

function buscarRepresentantePorSenha(senha) {
  const todos = listarRepresentantes();
  return todos.find(function (r) { return String(r.senha) === String(senha); }) || null;
}

function buscarRepresentantePorNome(nome) {
  const todos = listarRepresentantes();
  return todos.find(function (r) { return r.representante === nome; }) || null;
}

function listarRepresentantes() {
  const siteId = getConfig('SITE_ID');
  const listId = getConfig('LIST_ID');
  const resposta = chamarGraph('/sites/' + siteId + '/lists/' + listId + '/items?expand=fields', { method: 'get' });
  const dados = JSON.parse(resposta.getContentText());

  return dados.value.map(function (item) {
    return {
      representante: item.fields.Representante,
      senha: item.fields.Senha,
      emails: item.fields.Emails // pré-definido pela FixDoor, nunca escolhido pelo representante
    };
  });
}

// ===== ENVIAR ORÇAMENTO =====

function enviarOrcamento(dados) {
  const rep = buscarRepresentantePorNome(dados.representante);
  if (!rep) return { ok: false, erro: 'Representante não encontrado' };

  const pastaEnvio = salvarArquivosNoSharePoint(dados.anexos || [], dados.representante, dados.nome_solicitante);
  enviarEmailGraph(rep.emails, dados, pastaEnvio.webUrl);

  return { ok: true };
}

// ===== ARQUIVOS: sempre salvos no OneDrive/SharePoint, organizados por representante =====
//
// Estrutura criada dentro do drive configurado (DRIVE_ID), a partir da pasta
// raiz (PASTA_RAIZ_ID):
//
// <Pasta raiz>
//   └── <Representante>
//         └── <2026-08-29_1430 - Nome do solicitante>
//               ├── foto1.jpg
//               └── video1.mp4

function salvarArquivosNoSharePoint(anexos, representante, nomeSolicitante) {
  const driveId = getConfig('DRIVE_ID');
  const pastaRaizId = getConfig('PASTA_RAIZ_ID');

  const pastaRepresentante = getOuCriarSubpasta(driveId, pastaRaizId, representante);

  const carimbo = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd_HHmm');
  const nomePasta = carimbo + ' - ' + (nomeSolicitante || 'sem nome');
  const pastaEnvio = criarSubpasta(driveId, pastaRepresentante.id, nomePasta);

  (anexos || []).forEach(function (arquivo) {
    uploadArquivo(driveId, pastaEnvio.id, arquivo);
  });

  return pastaEnvio;
}

function getOuCriarSubpasta(driveId, pastaPaiId, nome) {
  const resposta = chamarGraph('/drives/' + driveId + '/items/' + pastaPaiId + '/children', { method: 'get' });
  const dados = JSON.parse(resposta.getContentText());
  const existente = dados.value.find(function (i) { return i.name === nome && i.folder; });
  if (existente) return existente;
  return criarSubpasta(driveId, pastaPaiId, nome);
}

function criarSubpasta(driveId, pastaPaiId, nome) {
  const resposta = chamarGraph('/drives/' + driveId + '/items/' + pastaPaiId + '/children', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      name: nome,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename'
    })
  });
  return JSON.parse(resposta.getContentText());
}

// Arquivos até 4 MB usam upload direto (PUT); acima disso, a Graph API exige
// uma "upload session" em pedaços (ver uploadArquivoGrande).
function uploadArquivo(driveId, pastaId, arquivo) {
  const bytes = Utilities.base64Decode(arquivo.base64);
  const LIMITE_UPLOAD_SIMPLES = 4 * 1024 * 1024;

  if (bytes.length <= LIMITE_UPLOAD_SIMPLES) {
    chamarGraph('/drives/' + driveId + '/items/' + pastaId + ':/' + encodeURIComponent(arquivo.nome) + ':/content', {
      method: 'put',
      contentType: arquivo.tipo,
      payload: bytes
    });
  } else {
    uploadArquivoGrande(driveId, pastaId, arquivo, bytes);
  }
}

// Upload em pedaços (upload session) para arquivos > 4 MB, principalmente
// vídeos. Fluxo: cria a sessão (createUploadSession), depois faz um PUT por
// pedaço na uploadUrl devolvida — essa URL já vem com um token pré-assinado,
// por isso os PUTs de pedaço NÃO passam pelo chamarGraph() (que sempre
// adiciona o header Authorization e o prefixo /v1.0).
function uploadArquivoGrande(driveId, pastaId, arquivo, bytes) {
  const TAMANHO_PEDACO = 10 * 1024 * 1024; // múltiplo de 320 KiB, como a Graph API exige

  const sessao = chamarGraph(
    '/drives/' + driveId + '/items/' + pastaId + ':/' + encodeURIComponent(arquivo.nome) + ':/createUploadSession',
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } })
    }
  );
  const uploadUrl = JSON.parse(sessao.getContentText()).uploadUrl;

  const total = bytes.length;
  for (let inicio = 0; inicio < total; inicio += TAMANHO_PEDACO) {
    const fim = Math.min(inicio + TAMANHO_PEDACO, total) - 1;
    const pedaco = bytes.slice(inicio, fim + 1);

    const resposta = UrlFetchApp.fetch(uploadUrl, {
      method: 'put',
      headers: {
        'Content-Range': 'bytes ' + inicio + '-' + fim + '/' + total
      },
      payload: pedaco,
      muteHttpExceptions: true
    });

    const codigo = resposta.getResponseCode();
    if (codigo >= 400) {
      throw new Error(
        'Falha no upload em pedaços de "' + arquivo.nome + '" (bytes ' + inicio + '-' + fim + '): ' +
        codigo + ' ' + resposta.getContentText()
      );
    }
  }
}

// ===== E-MAIL (Outlook, via Graph) =====

function enviarEmailGraph(emails, dados, linkPasta) {
  const remetente = getConfig('REMETENTE_EMAIL');
  const destinatarios = emails.split(',').map(function (e) {
    return { emailAddress: { address: e.trim() } };
  });

  chamarGraph('/users/' + remetente + '/sendMail', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      message: {
        subject: 'Nova solicitação de orçamento — ' + dados.representante,
        body: { contentType: 'HTML', content: montarCorpoEmail(dados, linkPasta) },
        toRecipients: destinatarios
      }
    })
  });
}

function montarCorpoEmail(dados, linkPasta) {
  let corpo = '<h2>Nova solicitação — ' + dados.representante + '</h2><ul>';
  Object.keys(dados).forEach(function (chave) {
    if (chave === 'anexos' || chave === 'representante' || chave === 'acao') return;
    corpo += '<li><strong>' + chave + ':</strong> ' + dados[chave] + '</li>';
  });
  corpo += '</ul>';
  corpo += '<p><strong>Fotos e vídeos:</strong> <a href="' + linkPasta + '">' + linkPasta + '</a></p>';
  return corpo;
}
