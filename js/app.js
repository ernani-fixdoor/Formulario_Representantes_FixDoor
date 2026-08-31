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
const anexosInput = document.getElementById('anexos');

// ===== Equipamento (Porta Seccional / Portal de Selamento) =====

const equipamentoInput = document.getElementById('equipamento');
const equipamentoErro = document.getElementById('equipamento-erro');
const botoesEquipamento = [...document.querySelectorAll('#equipamento-toggle .toggle-btn')];
const camposSeccional = document.getElementById('campos-seccional');
const camposPortal = document.getElementById('campos-portal');

function selecionarEquipamento(valor) {
  equipamentoInput.value = valor;
  equipamentoErro.hidden = true;
  botoesEquipamento.forEach((btn) => btn.classList.toggle('ativo', btn.dataset.value === valor));

  const ehSeccional = valor === 'Porta Seccional';
  const ehPortal = valor === 'Portal de Selamento';
  camposSeccional.hidden = !ehSeccional;
  camposSeccional.disabled = !ehSeccional;
  camposPortal.hidden = !ehPortal;
  camposPortal.disabled = !ehPortal;
}

botoesEquipamento.forEach((btn) => {
  btn.addEventListener('click', () => selecionarEquipamento(btn.dataset.value));
});

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

// ===== Limita quantidade de dígitos em campos numéricos =====

document.querySelectorAll('[data-max-digitos]').forEach((input) => {
  const max = Number(input.dataset.maxDigitos);
  input.addEventListener('input', () => {
    if (input.value.length > max) input.value = input.value.slice(0, max);
  });
});

// ===== Portão de senha =====

const repSalvo = sessionStorage.getItem('representante');
if (repSalvo) mostrarFormulario(repSalvo);

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
      sessionStorage.setItem('representante', resposta.representante);
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
  botoesEquipamento.forEach((btn) => { btn.disabled = true; });
  anexosInput.disabled = true;
  btnEnviar.hidden = true;
  btnNovaSolicitacao.hidden = false;
}

function iniciarNovaSolicitacao() {
  form.reset();
  form.querySelectorAll('fieldset').forEach((fs) => { fs.disabled = false; });
  botoesEquipamento.forEach((btn) => { btn.disabled = false; });
  anexosInput.disabled = false;
  selecionarEquipamento('');
  campoValorInstalacao.hidden = true;
  valorInstalacaoInput.required = false;
  cidadeSelect.innerHTML = '<option value="" selected disabled>Selecione o estado primeiro</option>';
  cidadeSelect.disabled = true;
  btnEnviar.hidden = false;
  btnNovaSolicitacao.hidden = true;
  statusEl.hidden = true;
}

btnNovaSolicitacao.addEventListener('click', iniciarNovaSolicitacao);

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();

  if (!equipamentoInput.value) {
    equipamentoErro.hidden = false;
    return;
  }

  statusEl.hidden = false;
  statusEl.textContent = 'Enviando...';
  btnEnviar.disabled = true;
  spinnerEnviar.hidden = false;

  const dados = Object.fromEntries(new FormData(form).entries());
  dados.acessorios = [...form.querySelectorAll('input[name="acessorios"]:checked')].map((el) => el.value).join(', ');
  const arquivos = anexosInput.files;
  dados.anexos = await Promise.all([...arquivos].map(paraBase64));

  try {
    const resultado = await chamarBackend('enviarOrcamento', dados);
    if (resultado.ok) {
      statusEl.textContent = 'Orçamento enviado com sucesso!';
      finalizarComoEnviado();
    } else {
      statusEl.textContent = 'Erro ao enviar. Tente de novo.';
    }
  } catch (erro) {
    statusEl.textContent = 'Erro ao enviar. Tente de novo.';
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
