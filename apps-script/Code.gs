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

  const pastaEnvio = salvarArquivosNoSharePoint(dados.anexos || [], dados.representante, dados.nome_cliente);
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
//         └── <2026-08-29_1430 - Nome do cliente>
//               ├── foto1.jpg
//               └── video1.mp4

function salvarArquivosNoSharePoint(anexos, representante, nomeCliente) {
  const driveId = getConfig('DRIVE_ID');
  const pastaRaizId = getConfig('PASTA_RAIZ_ID');

  const pastaRepresentante = getOuCriarSubpasta(driveId, pastaRaizId, representante);

  const carimbo = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd_HHmm');
  const nomePasta = carimbo + ' - ' + (nomeCliente || 'sem nome');
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
        subject: dados.representante + ' - Solicitação de Orçamento',
        body: { contentType: 'HTML', content: montarCorpoEmail(dados, linkPasta) },
        toRecipients: destinatarios
      }
    })
  });
}

// Rótulo amigável de cada campo do formulário, pra não aparecer o nome interno
// (ex.: "nome_cliente") cru no e-mail. Campo sem rótulo aqui usa o próprio nome.
const RUTULOS_CAMPOS = {
  nome_cliente: 'Nome do cliente',
  cnpj_cliente: 'CNPJ do cliente',
  inscricao_estadual: 'Inscrição Estadual',
  destinacao_fiscal: 'Destinação fiscal do equipamento',
  email_cliente: 'E-mail do cliente',
  telefone_cliente: 'Telefone do cliente',
  estado: 'Estado',
  cidade: 'Cidade',
  frete: 'Frete',
  instalacao: 'Instalação',
  valor_instalacao: 'Valor da instalação por equipamento',
  rebatimento: 'Rebatimento',
  quantidade_portas: 'Quantidade de portas',
  quantidade_portais: 'Quantidade de portais',
  largura_vao: 'Largura do vão (mm)',
  altura_vao: 'Altura do vão (mm)',
  pe_direito: 'Pé direito (mm)',
  tipo_acionamento: 'Tipo de acionamento',
  numero_visores: 'Número de visores',
  estrutura_coluna: 'Estrutura da coluna/parede',
  estrutura_teto: 'Estrutura do teto',
  modelo_portal: 'Modelo do portal',
  acessorios: 'Acessórios',
  acessorios_estruturais: 'Acessórios estruturais',
  observacoes: 'Observações'
};

// Campos que não entram na tabela geral (o "itens" vira suas próprias tabelas,
// um por equipamento).
const CAMPOS_IGNORADOS_NO_EMAIL = ['anexos', 'representante', 'acao', 'itens'];
// Dentro de cada item, "equipamento" e "nome_item" já aparecem no título da seção.
const CAMPOS_IGNORADOS_NO_ITEM = ['equipamento', 'nome_item'];

function montarLinhasTabela(objeto, camposIgnorados) {
  let linhas = '';
  Object.keys(objeto).forEach(function (chave) {
    if (camposIgnorados.indexOf(chave) !== -1) return;
    const valor = objeto[chave];
    if (valor === undefined || valor === null || valor === '') return;

    const rotulo = RUTULOS_CAMPOS[chave] || chave;
    const valorSeguro = escaparHtml(String(valor)).replace(/\n/g, '<br>');
    linhas +=
      '<tr>' +
      '<td style="padding:8px 12px;border:1px solid #ecdfd5;background:#fff8f3;font-weight:600;white-space:nowrap;">' +
      escaparHtml(rotulo) +
      '</td>' +
      '<td style="padding:8px 12px;border:1px solid #ecdfd5;">' + valorSeguro + '</td>' +
      '</tr>';
  });
  return linhas;
}

function montarCorpoEmail(dados, linkPasta) {
  const enviadoEm = Utilities.formatDate(new Date(), 'America/Sao_Paulo', "dd/MM/yyyy 'às' HH:mm");

  let corpo =
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#2b1d15;">' +
    '<p style="margin:0 0 16px;color:#8a7266;font-size:13px;">Enviado em ' + enviadoEm + '</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:640px;">' +
    montarLinhasTabela(dados, CAMPOS_IGNORADOS_NO_EMAIL) +
    '</table>';

  const itens = dados.itens ? JSON.parse(dados.itens) : [];
  itens.forEach(function (item, indice) {
    const titulo = (item.nome_item ? item.nome_item + ' — ' : '') + (item.equipamento || ('Equipamento ' + (indice + 1)));
    corpo +=
      '<h3 style="color:#d1520a;margin:20px 0 6px;">' + escaparHtml(titulo) + '</h3>' +
      '<table style="border-collapse:collapse;width:100%;max-width:640px;">' +
      montarLinhasTabela(item, CAMPOS_IGNORADOS_NO_ITEM) +
      '</table>';
  });

  corpo +=
    '<p style="margin-top:16px;"><strong>Fotos e vídeos:</strong> <a href="' + linkPasta + '">' + linkPasta + '</a></p>' +
    '</div>';

  return corpo;
}

function escaparHtml(texto) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
