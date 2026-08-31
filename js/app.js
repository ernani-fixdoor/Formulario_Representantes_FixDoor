// Cole aqui a URL do Web App depois de publicar o Apps Script (ver README.md)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwW3GjlRpV5jKOhuMeikoWKEAPtQyX0lQOQdDDeUcIVz6PysGL3HFiWdE7l4hQBjLop/exec";

const gate = document.getElementById('gate');
const form = document.getElementById('formulario');
const senhaInput = document.getElementById('senha');
const btnEntrar = document.getElementById('btn-entrar');
const gateErro = document.getElementById('gate-erro');
const nomeRepresentanteEl = document.getElementById('nome-representante');
const representanteInput = document.getElementById('representante');
const tipoSelect = document.getElementById('tipo');
const camposSeccional = document.getElementById('campos-seccional');
const statusEl = document.getElementById('form-status');

// Mantém a sessão enquanto a aba estiver aberta (some ao fechar o navegador)
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
  }
}

function mostrarFormulario(nomeRepresentante) {
  nomeRepresentanteEl.textContent = nomeRepresentante;
  representanteInput.value = nomeRepresentante;
  gate.hidden = true;
  form.hidden = false;
}

tipoSelect.addEventListener('change', () => {
  camposSeccional.hidden = tipoSelect.value !== 'seccional';
});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  statusEl.hidden = false;
  statusEl.textContent = 'Enviando...';

  const dados = Object.fromEntries(new FormData(form).entries());
  const arquivos = document.getElementById('anexos').files;
  dados.anexos = await Promise.all([...arquivos].map(paraBase64));

  try {
    const resultado = await chamarBackend('enviarOrcamento', dados);
    if (resultado.ok) {
      statusEl.textContent = 'Orçamento enviado com sucesso!';
      form.reset();
      tipoSelect.dispatchEvent(new Event('change'));
    } else {
      statusEl.textContent = 'Erro ao enviar. Tente de novo.';
    }
  } catch (erro) {
    statusEl.textContent = 'Erro ao enviar. Tente de novo.';
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
