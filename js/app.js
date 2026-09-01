// Cole aqui a URL do Web App depois de publicar o Apps Script (ver README.md)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwW3GjlRpV5jKOhuMeikoWKEAPtQyX0lQOQdDDeUcIVz6PysGL3HFiWdE7l4hQBjLop/exec";

const gate = document.getElementById('gate');
const form = document.getElementById('formulario');
const senhaInput = document.getElementById('senha');
const btnEntrar = document.getElementById('btn-entrar');
const spinnerEntrar = btnEntrar.querySelector('.spinner');
const gateErro = document.getElementById('gate-erro');
const nomeRepresentanteEl = document.getElementById('nome-representante');
const representanteInput = document.getElementById('representante');
const statusEl = document.getElementById('form-status');
const btnEnviar = document.getElementById('btn-enviar');
const spinnerEnviar = btnEnviar.querySelector('.spinner');
const btnNovaSolicitacao = document.getElementById('btn-nova-solicitacao');

// ===== Itens do orçamento (um ou mais equipamentos: Porta Seccional / Portal de Selamento) =====

const itensContainer = document.getElementById('itens-equipamento');
const btnAddItem = document.getElementById('btn-add-item');
let contadorItens = 0;

const OPCOES_ESTRUTURA = [
  'Isopainel', 'Bloco grauteado', 'Bloco oco',
  'Placa cimentícia', 'Metalon (tubo)', 'Metálica - Perfil Aberto'
];

function opcoesHtml(valores, comPlaceholder) {
  const placeholder = comPlaceholder ? '<option value="" selected disabled>Selecione...</option>' : '';
  return placeholder + valores.map((v) => '<option value="' + v + '">' + v + '</option>').join('');
}

function criarBlocoItem() {
  contadorItens += 1;

  const bloco = document.createElement('div');
  bloco.className = 'item-equipamento';
  bloco.innerHTML =
    '<div class="item-cabecalho">' +
      '<strong class="item-titulo">Equipamento ' + contadorItens + '</strong>' +
      '<button type="button" class="btn-remover-item" title="Remover este equipamento">✕</button>' +
    '</div>' +

    '<label>Nome deste item (opcional)</label>' +
    '<input type="text" data-field="nome_item" placeholder="Ex: Porta 1 - Depósito">' +

    '<label>Equipamento</label>' +
    '<div class="toggle-group item-equipamento-toggle">' +
      '<button type="button" class="toggle-btn" data-value="Porta Seccional">Porta Seccional</button>' +
      '<button type="button" class="toggle-btn" data-value="Portal de Selamento">Portal de Selamento</button>' +
    '</div>' +
    '<p class="erro item-erro" hidden></p>' +

    '<fieldset class="campos-seccional-item" hidden disabled>' +
      '<legend>Especificações técnicas — Porta Seccional</legend>' +

      '<label>Rebatimento</label>' +
      '<select data-field="rebatimento" required>' +
        opcoesHtml(['VL', 'HL', 'HL TD', 'SL'], true) +
      '</select>' +

      '<label>Quantidade de portas</label>' +
      '<input type="number" data-field="quantidade_portas" min="1" data-max-digitos="4" required>' +

      '<label>Largura do vão (mm)</label>' +
      '<input type="number" data-field="largura_vao" data-max-digitos="5" required>' +

      '<label>Altura do vão (mm)</label>' +
      '<input type="number" data-field="altura_vao" data-max-digitos="5" required>' +

      '<label>Pé direito (mm)</label>' +
      '<input type="number" data-field="pe_direito" data-max-digitos="5" required>' +

      '<label>Tipo de acionamento</label>' +
      '<select data-field="tipo_acionamento">' +
        '<option value="Manual">Manual</option>' +
        '<option value="Motorizada">Motorizada</option>' +
        '<option value="Talha">Talha</option>' +
      '</select>' +

      '<label>Número de visores</label>' +
      '<select data-field="numero_visores">' +
        [0,1,2,3,4,5,6,7,8,9,10].map((n) => '<option>' + n + '</option>').join('') +
      '</select>' +

      '<label>Estrutura da coluna/parede</label>' +
      '<select data-field="estrutura_coluna" required>' + opcoesHtml(OPCOES_ESTRUTURA, true) + '</select>' +

      '<label>Estrutura do teto</label>' +
      '<select data-field="estrutura_teto" required>' + opcoesHtml(OPCOES_ESTRUTURA, true) + '</select>' +

      '<label>Acessórios</label>' +
      '<label class="checkbox"><input type="checkbox" data-field="acessorios" value="Sensor de tráfego"> Sensor de tráfego</label>' +
      '<label class="checkbox"><input type="checkbox" data-field="acessorios" value="Sensor Pressostato"> Sensor Pressostato</label>' +

      '<label>Acessórios estruturais</label>' +
      '<label class="checkbox"><input type="checkbox" data-field="acessorios_estruturais" value="Estrutura metálica"> Estrutura metálica</label>' +
      '<label class="checkbox"><input type="checkbox" data-field="acessorios_estruturais" value="Mão francesa"> Mão francesa</label>' +

      '<label>Observações</label>' +
      '<textarea data-field="observacoes" rows="4"></textarea>' +
    '</fieldset>' +

    '<fieldset class="campos-portal-item" hidden disabled>' +
      '<legend>Especificações técnicas — Portal de Selamento</legend>' +

      '<label>Quantidade de portais</label>' +
      '<input type="number" data-field="quantidade_portais" min="1" data-max-digitos="4" required>' +

      '<label>Largura do vão (mm)</label>' +
      '<input type="number" data-field="largura_vao" data-max-digitos="5" required>' +

      '<label>Altura do vão (mm)</label>' +
      '<input type="number" data-field="altura_vao" data-max-digitos="5" required>' +

      '<label>Pé direito (mm)</label>' +
      '<input type="number" data-field="pe_direito" data-max-digitos="5" required>' +

      '<label>Modelo do portal</label>' +
      '<select data-field="modelo_portal" required>' + opcoesHtml(['F1', 'F2 - padrão', 'F3', 'Especial'], true) + '</select>' +

      '<label>Acessórios</label>' +
      '<label class="checkbox"><input type="checkbox" data-field="acessorios" value="Bolsão triangular"> Bolsão triangular</label>' +
      '<label class="checkbox"><input type="checkbox" data-field="acessorios" value="Estrutura metálica"> Estrutura metálica</label>' +

      '<label>Estrutura da coluna/parede</label>' +
      '<select data-field="estrutura_coluna" required>' + opcoesHtml(OPCOES_ESTRUTURA, true) + '</select>' +

      '<label>Observações</label>' +
      '<textarea data-field="observacoes" rows="4"></textarea>' +
    '</fieldset>';

  wireBlocoItem(bloco);
  return bloco;
}

function wireBlocoItem(bloco) {
  const camposSeccional = bloco.querySelector('.campos-seccional-item');
  const camposPortal = bloco.querySelector('.campos-portal-item');
  const itemErro = bloco.querySelector('.item-erro');

  bloco.querySelectorAll('.item-equipamento-toggle .toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const valor = btn.dataset.value;
      itemErro.hidden = true;
      bloco.dataset.equipamento = valor;
      bloco.querySelectorAll('.item-equipamento-toggle .toggle-btn').forEach((b) => {
        b.classList.toggle('ativo', b === btn);
      });
      const ehSeccional = valor === 'Porta Seccional';
      const ehPortal = valor === 'Portal de Selamento';
      camposSeccional.hidden = !ehSeccional;
      camposSeccional.disabled = !ehSeccional;
      camposPortal.hidden = !ehPortal;
      camposPortal.disabled = !ehPortal;
    });
  });

  bloco.querySelectorAll('[data-max-digitos]').forEach((input) => {
    const max = Number(input.dataset.maxDigitos);
    input.addEventListener('input', () => {
      if (input.value.length > max) input.value = input.value.slice(0, max);
    });
  });

  bloco.querySelector('.btn-remover-item').addEventListener('click', () => {
    bloco.remove();
    renumerarItens();
  });
}

function renumerarItens() {
  [...itensContainer.querySelectorAll('.item-equipamento')].forEach((bloco, indice) => {
    bloco.querySelector('.item-titulo').textContent = 'Equipamento ' + (indice + 1);
  });
}

function adicionarItem() {
  itensContainer.appendChild(criarBlocoItem());
}

function resetarItens() {
  itensContainer.innerHTML = '';
  contadorItens = 0;
  adicionarItem();
}

btnAddItem.addEventListener('click', adicionarItem);
adicionarItem();

// Lê os campos de um bloco de item e devolve um objeto simples pra mandar no e-mail.
function lerCamposDoItem(bloco) {
  const equipamento = bloco.dataset.equipamento || '';
  const ativo = equipamento === 'Portal de Selamento' ? bloco.querySelector('.campos-portal-item') : bloco.querySelector('.campos-seccional-item');
  const campos = { equipamento: equipamento };

  const nomeItem = bloco.querySelector('[data-field="nome_item"]').value.trim();
  if (nomeItem) campos.nome_item = nomeItem;

  if (!ativo) return campos;

  ativo.querySelectorAll('[data-field]').forEach((el) => {
    if (el.type === 'checkbox') return;
    campos[el.dataset.field] = el.value;
  });

  ['acessorios', 'acessorios_estruturais'].forEach((grupo) => {
    const valores = [...ativo.querySelectorAll('input[data-field="' + grupo + '"]:checked')].map((el) => el.value);
    if (valores.length) campos[grupo] = valores.join(', ');
  });

  return campos;
}

// Valida todos os blocos de item; devolve os itens prontos ou null se algo estiver faltando.
function validarEColetarItens() {
  const blocos = [...itensContainer.querySelectorAll('.item-equipamento')];
  let valido = true;

  if (blocos.length === 0) valido = false;

  const itens = blocos.map((bloco) => {
    const itemErro = bloco.querySelector('.item-erro');
    itemErro.hidden = true;

    const equipamento = bloco.dataset.equipamento || '';
    if (!equipamento) {
      itemErro.textContent = 'Escolha um equipamento antes de continuar.';
      itemErro.hidden = false;
      valido = false;
      return null;
    }

    if (equipamento === 'Portal de Selamento') {
      const temAcessorio = bloco.querySelectorAll('.campos-portal-item input[data-field="acessorios"]:checked').length > 0;
      if (!temAcessorio) {
        itemErro.textContent = 'Escolha ao menos um acessório.';
        itemErro.hidden = false;
        valido = false;
        return null;
      }
    }

    return lerCamposDoItem(bloco);
  });

  return valido ? itens : null;
}

// ===== Estado / Cidade (API do IBGE) =====

const estadoSelect = document.getElementById('estado');
const cidadeSelect = document.getElementById('cidade');

async function carregarEstados() {
  try {
    const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
    const estados = await resp.json();
    estadoSelect.innerHTML = '<option value="" selected disabled>Selecione...</option>' +
      estados.map((e) => `<option value="${e.sigla}">${e.nome}</option>`).join('');
  } catch (erro) {
    estadoSelect.innerHTML = '<option value="" selected disabled>Erro ao carregar estados</option>';
  }
}

estadoSelect.addEventListener('change', async () => {
  cidadeSelect.disabled = true;
  cidadeSelect.innerHTML = '<option value="" selected disabled>Carregando cidades...</option>';
  try {
    const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + estadoSelect.value + '/municipios');
    const cidades = await resp.json();
    cidades.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    cidadeSelect.innerHTML = '<option value="" selected disabled>Selecione...</option>' +
      cidades.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
    cidadeSelect.disabled = false;
  } catch (erro) {
    cidadeSelect.innerHTML = '<option value="" selected disabled>Erro ao carregar cidades</option>';
  }
});

carregarEstados();

// ===== Máscaras (CNPJ, telefone, moeda) =====

function maskCNPJ(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 14);
  if (digitos.length > 12) return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5');
  if (digitos.length > 8) return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
  if (digitos.length > 5) return digitos.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
  if (digitos.length > 2) return digitos.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
  return digitos;
}

function maskTelefone(valor) {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length > 10) return digitos.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digitos.length > 6) return digitos.replace(/^(\d{2})(\d{4})(\d{1,4})$/, '($1) $2-$3');
  if (digitos.length > 2) return digitos.replace(/^(\d{2})(\d{1,5})$/, '($1) $2');
  if (digitos.length > 0) return digitos.replace(/^(\d{1,2})$/, '($1');
  return digitos;
}

function maskMoeda(valor) {
  const digitos = valor.replace(/\D/g, '');
  if (!digitos) return '';
  const numero = (parseInt(digitos, 10) / 100).toFixed(2);
  const [inteiro, centavos] = numero.split('.');
  const inteiroFormatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$ ' + inteiroFormatado + ',' + centavos;
}

const cnpjInput = document.getElementById('cnpj_cliente');
cnpjInput.addEventListener('input', () => { cnpjInput.value = maskCNPJ(cnpjInput.value); });

const telefoneInput = document.getElementById('telefone_cliente');
telefoneInput.addEventListener('input', () => { telefoneInput.value = maskTelefone(telefoneInput.value); });

const valorInstalacaoInput = document.getElementById('valor_instalacao');
valorInstalacaoInput.addEventListener('input', () => { valorInstalacaoInput.value = maskMoeda(valorInstalacaoInput.value); });

// ===== Instalação: mostra "Valor da instalação" só quando for pelo representante =====

const instalacaoSelect = document.getElementById('instalacao');
const campoValorInstalacao = document.getElementById('campo-valor-instalacao');

instalacaoSelect.addEventListener('change', () => {
  const mostrar = instalacaoSelect.value === 'Pelo representante';
  campoValorInstalacao.hidden = !mostrar;
  valorInstalacaoInput.required = mostrar;
  if (!mostrar) valorInstalacaoInput.value = '';
});

// ===== Anexos: escolhas múltiplas se acumulam numa lista, cada um removível =====

const anexosInput = document.getElementById('anexos');
const listaAnexosEl = document.getElementById('lista-anexos');
let arquivosSelecionados = [];

anexosInput.addEventListener('change', () => {
  arquivosSelecionados.push(...anexosInput.files);
  anexosInput.value = ''; // permite escolher o mesmo arquivo de novo e evita duplicar via input.files
  renderizarListaAnexos();
});

function renderizarListaAnexos() {
  listaAnexosEl.innerHTML = '';
  arquivosSelecionados.forEach((arquivo, indice) => {
    const li = document.createElement('li');
    const nome = document.createElement('span');
    nome.textContent = arquivo.name;
    const btnRemover = document.createElement('button');
    btnRemover.type = 'button';
    btnRemover.className = 'btn-remover-anexo';
    btnRemover.textContent = '✕';
    btnRemover.title = 'Remover este arquivo';
    btnRemover.addEventListener('click', () => {
      arquivosSelecionados.splice(indice, 1);
      renderizarListaAnexos();
    });
    li.appendChild(nome);
    li.appendChild(btnRemover);
    listaAnexosEl.appendChild(li);
  });
}

// ===== Portão de senha =====
// Sempre pede senha ao abrir a página — não persiste login entre carregamentos.

btnEntrar.addEventListener('click', validarSenha);
senhaInput.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') validarSenha();
});

async function validarSenha() {
  const senha = senhaInput.value.trim();
  gateErro.hidden = true;
  if (!senha) return;

  btnEntrar.disabled = true;
  spinnerEntrar.hidden = false;
  try {
    const resposta = await chamarBackend('validarSenha', { senha });
    if (resposta.ok) {
      mostrarFormulario(resposta.representante);
    } else {
      gateErro.textContent = 'Senha incorreta. Tente de novo.';
      gateErro.hidden = false;
    }
  } catch (erro) {
    gateErro.textContent = 'Não foi possível validar agora. Tente de novo em instantes.';
    gateErro.hidden = false;
  } finally {
    btnEntrar.disabled = false;
    spinnerEntrar.hidden = true;
  }
}

function mostrarFormulario(nomeRepresentante) {
  nomeRepresentanteEl.textContent = nomeRepresentante;
  representanteInput.value = nomeRepresentante;
  gate.hidden = true;
  form.hidden = false;
}

// ===== Envio do formulário =====

function finalizarComoEnviado() {
  form.querySelectorAll('fieldset').forEach((fs) => { fs.disabled = true; });
  form.querySelectorAll('.item-equipamento-toggle .toggle-btn, .btn-remover-item').forEach((btn) => { btn.disabled = true; });
  btnAddItem.disabled = true;
  anexosInput.disabled = true;
  listaAnexosEl.querySelectorAll('.btn-remover-anexo').forEach((btn) => { btn.disabled = true; });
  btnEnviar.hidden = true;
  btnNovaSolicitacao.hidden = false;
}

function iniciarNovaSolicitacao() {
  form.reset();
  form.querySelectorAll('fieldset').forEach((fs) => { fs.disabled = false; });
  btnAddItem.disabled = false;
  anexosInput.disabled = false;
  resetarItens();
  arquivosSelecionados = [];
  renderizarListaAnexos();
  campoValorInstalacao.hidden = true;
  valorInstalacaoInput.required = false;
  cidadeSelect.innerHTML = '<option value="" selected disabled>Selecione o estado primeiro</option>';
  cidadeSelect.disabled = true;
  btnEnviar.hidden = false;
  btnNovaSolicitacao.hidden = true;
  statusEl.hidden = true;
  statusEl.className = '';
}

btnNovaSolicitacao.addEventListener('click', iniciarNovaSolicitacao);

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();

  const itens = validarEColetarItens();
  if (!itens) return;

  statusEl.hidden = false;
  statusEl.className = '';
  statusEl.textContent = 'Enviando...';
  btnEnviar.disabled = true;
  spinnerEnviar.hidden = false;

  const dados = Object.fromEntries(new FormData(form).entries());
  dados.itens = JSON.stringify(itens);
  dados.anexos = await Promise.all(arquivosSelecionados.map(paraBase64));

  try {
    const resultado = await chamarBackend('enviarOrcamento', dados);
    if (resultado.ok) {
      statusEl.textContent = '✓ Orçamento enviado com sucesso!';
      statusEl.className = 'sucesso';
      finalizarComoEnviado();
    } else {
      statusEl.textContent = 'Erro ao enviar. Tente de novo.';
      statusEl.className = 'erro-envio';
    }
  } catch (erro) {
    statusEl.textContent = 'Erro ao enviar. Tente de novo.';
    statusEl.className = 'erro-envio';
  } finally {
    btnEnviar.disabled = false;
    spinnerEnviar.hidden = true;
  }
});

async function chamarBackend(acao, dados) {
  const resp = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ acao, ...dados })
  });
  return resp.json();
}

function paraBase64(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve({
      nome: arquivo.name,
      tipo: arquivo.type,
      base64: leitor.result.split(',')[1]
    });
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}
