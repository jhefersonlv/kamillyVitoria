/* ═══════════════════════════════════════════════════════════════
   Kamilly Vitória | Beauty Art  ─  Admin Panel JS
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── CONSTANTES ─────────────────────────────────────────────── */
const PT_MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const PT_DAYS_FULL = [
  'Domingo','Segunda-feira','Terça-feira','Quarta-feira',
  'Quinta-feira','Sexta-feira','Sábado'
];
const ALL_TIMES = [
  '06:00','07:00','08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'
];
const DAYS_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

/* ─── ESTADO ─────────────────────────────────────────────────── */
let adminCalDate  = new Date();
let selectedDayStr = null;        // 'YYYY-MM-DD' do dia aberto no painel
let isBlocked     = false;        // estado do toggle no painel
let adminConfig   = {
  defaultTimes: ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00','18:00'],
  workDays: [1,2,3,4,5,6]
};
let monthCache    = {};           // { 'YYYY-MM-DD': { blocked, times, reason } }
let hasExistingConfig = false;    // indica se o dia já tem doc no Firestore

/* ─── AUTENTICAÇÃO ───────────────────────────────────────────── */
auth.onAuthStateChanged(async user => {
  if (user) {
    await showDashboard();
  } else {
    showLogin();
  }
});

function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('dashboard').hidden    = true;
}

async function showDashboard() {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('dashboard').hidden    = false;
  await loadAdminConfig();
  renderWorkdaysGrid();
  renderConfigTimesGrid();
  await renderAdminCalendar();
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');
  const btnText  = document.getElementById('login-btn-text');

  btn.disabled  = true;
  btnText.textContent = 'Entrando…';
  errEl.hidden  = true;

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (_) {
    errEl.textContent = 'E-mail ou senha incorretos. Tente novamente.';
    errEl.hidden  = false;
    btn.disabled  = false;
    btnText.textContent = 'Entrar';
  }
}

async function handleLogout() {
  await auth.signOut();
}

function togglePw() {
  const input = document.getElementById('login-password');
  const icon  = document.getElementById('eye-icon');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  icon.className = isHidden ? 'ph ph-eye-slash' : 'ph ph-eye';
}

/* ─── TABS ───────────────────────────────────────────────────── */
function switchTab(tab) {
  ['agenda','config'].forEach(t => {
    document.getElementById(`tab-btn-${t}`).classList.toggle('active', t === tab);
    const content = document.getElementById(`tab-content-${t}`);
    content.classList.toggle('active', t === tab);
    content.hidden = t !== tab;
  });
}

/* ─── CARREGAR CONFIG ────────────────────────────────────────── */
async function loadAdminConfig() {
  try {
    const snap = await db.collection('config').doc('schedule').get();
    if (snap.exists) adminConfig = { ...adminConfig, ...snap.data() };
  } catch (_) {}
}

/* ─── CALENDÁRIO ADMIN ───────────────────────────────────────── */
function adminChangeMonth(dir) {
  adminCalDate = new Date(adminCalDate.getFullYear(), adminCalDate.getMonth() + dir, 1);
  monthCache   = {};
  renderAdminCalendar();
}

async function renderAdminCalendar() {
  const year   = adminCalDate.getFullYear();
  const month  = adminCalDate.getMonth();
  const label  = document.getElementById('admin-cal-label');
  label.textContent = `${PT_MONTHS[month]} ${year}`;

  const daysEl    = document.getElementById('admin-cal-days');
  const today     = new Date(); today.setHours(0,0,0,0);
  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  daysEl.innerHTML = '';

  /* Células vazias */
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'admin-day admin-day--empty';
    daysEl.appendChild(el);
  }

  /* Dias — renderiza sincronamente com skeleton */
  for (let d = 1; d <= daysInMonth; d++) {
    const date     = new Date(year, month, d);
    const isPast   = date < today;
    const isOffDay = !adminConfig.workDays.includes(date.getDay());
    const isToday  = date.toDateString() === today.toDateString();
    const dateStr  = fmtDateAdmin(date);

    const btn = document.createElement('button');
    btn.className    = 'admin-day';
    btn.textContent  = d;
    btn.dataset.date = dateStr;

    if (isPast)   btn.classList.add('admin-day--past');
    if (isOffDay) btn.classList.add('admin-day--off');
    if (isToday)  btn.classList.add('admin-day--today');

    if (!isPast) {
      btn.addEventListener('click', () => openDayPanel(dateStr, date));
    }

    daysEl.appendChild(btn);
  }

  /* Overlay assíncrono: busca config de cada dia no mês */
  await loadMonthData(year, month);
  applyMonthDataToCalendar();
}

async function loadMonthData(year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  try {
    const snap = await db.collection('dateConfig')
      .where(firebase.firestore.FieldPath.documentId(), '>=', `${prefix}-01`)
      .where(firebase.firestore.FieldPath.documentId(), '<=', `${prefix}-31`)
      .get();

    snap.forEach(docSnap => {
      monthCache[docSnap.id] = docSnap.data();
    });
  } catch (_) {}
}

function applyMonthDataToCalendar() {
  const daysEl = document.getElementById('admin-cal-days');
  daysEl.querySelectorAll('.admin-day[data-date]').forEach(btn => {
    const data = monthCache[btn.dataset.date];
    if (!data) return;

    btn.classList.remove('admin-day--blocked', 'admin-day--custom');
    if (data.blocked || (Array.isArray(data.times) && data.times.length === 0)) {
      btn.classList.add('admin-day--blocked');
    } else if (Array.isArray(data.times)) {
      btn.classList.add('admin-day--custom');
    }
  });
}

/* ─── UTILITÁRIO ─────────────────────────────────────────────── */
function fmtDateAdmin(date) {
  return `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`;
}

function fmtDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${PT_DAYS_FULL[date.getDay()]}, ${d} de ${PT_MONTHS[m - 1]} de ${y}`;
}

/* ─── DAY PANEL ──────────────────────────────────────────────── */
async function openDayPanel(dateStr, date) {
  selectedDayStr = dateStr;

  /* Título */
  document.getElementById('day-panel-title').textContent = fmtDateLabel(dateStr);

  /* Busca config existente */
  let dayData = monthCache[dateStr] || null;
  if (!dayData) {
    try {
      const snap = await db.collection('dateConfig').doc(dateStr).get();
      if (snap.exists) { dayData = snap.data(); monthCache[dateStr] = dayData; }
    } catch (_) {}
  }

  hasExistingConfig = !!dayData;

  /* Estado do toggle */
  isBlocked = dayData ? (dayData.blocked === true) : false;
  setBlockToggle(isBlocked);

  /* Motivo */
  document.getElementById('block-reason').value = dayData?.reason || '';

  /* Times */
  const times = (dayData && !dayData.blocked && Array.isArray(dayData.times))
    ? dayData.times
    : [...adminConfig.defaultTimes];
  renderDayTimesGrid(times);

  /* Botão "remover personalização" só aparece se já existe config */
  document.getElementById('btn-delete-config').hidden = !hasExistingConfig;

  /* Abre */
  document.getElementById('day-panel').classList.add('open');
  document.getElementById('day-panel-backdrop').classList.add('open');
  document.getElementById('day-panel').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDayPanel() {
  document.getElementById('day-panel').classList.remove('open');
  document.getElementById('day-panel-backdrop').classList.remove('open');
  document.getElementById('day-panel').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  selectedDayStr = null;
}

/* ─── TOGGLE BLOQUEAR ────────────────────────────────────────── */
function toggleBlock() {
  isBlocked = !isBlocked;
  setBlockToggle(isBlocked);
}

function setBlockToggle(blocked) {
  const toggle = document.getElementById('toggle-switch');
  toggle.setAttribute('aria-checked', String(blocked));
  document.getElementById('block-reason-wrap').hidden = !blocked;
  document.getElementById('day-times-section').style.opacity = blocked ? '0.35' : '1';
  document.getElementById('day-times-section').style.pointerEvents = blocked ? 'none' : '';
}

/* ─── TIMES DO DIA ───────────────────────────────────────────── */
function renderDayTimesGrid(selectedTimes) {
  const grid = document.getElementById('day-times-grid');
  grid.innerHTML = '';

  ALL_TIMES.forEach(t => {
    const label = document.createElement('label');
    label.className = 'chip-label';

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.value   = t;
    cb.checked = selectedTimes.includes(t);

    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = t;

    label.appendChild(cb);
    label.appendChild(chip);
    grid.appendChild(label);
  });
}

function useDefaultTimes() {
  renderDayTimesGrid([...adminConfig.defaultTimes]);
}

function getCheckedTimes() {
  return [...document.querySelectorAll('#day-times-grid input:checked')]
    .map(cb => cb.value)
    .sort();
}

/* ─── SALVAR DIA ─────────────────────────────────────────────── */
async function saveDayConfig() {
  if (!selectedDayStr) return;

  const btn = document.getElementById('btn-save-day');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner"></i> Salvando…';

  const data = isBlocked
    ? { blocked: true, reason: document.getElementById('block-reason').value.trim(), times: [] }
    : { blocked: false, reason: '', times: getCheckedTimes() };

  try {
    await db.collection('dateConfig').doc(selectedDayStr).set(data);
    monthCache[selectedDayStr] = data;
    applyMonthDataToCalendar();
    closeDayPanel();
  } catch (err) {
    alert('Erro ao salvar. Verifique a conexão e tente novamente.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Salvar';
  }
}

async function deleteDayConfig() {
  if (!selectedDayStr) return;
  if (!confirm('Remover personalização e voltar ao horário padrão?')) return;

  try {
    await db.collection('dateConfig').doc(selectedDayStr).delete();
    delete monthCache[selectedDayStr];
    applyMonthDataToCalendar();
    closeDayPanel();
  } catch (err) {
    alert('Erro ao remover. Tente novamente.');
    console.error(err);
  }
}

/* ─── CONFIGURAÇÕES — RENDER ─────────────────────────────────── */
function renderWorkdaysGrid() {
  const grid = document.getElementById('workdays-grid');
  grid.innerHTML = '';

  DAYS_LABELS.forEach((label, i) => {
    const lbl = document.createElement('label');
    lbl.className = 'chip-label';

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.value   = i;
    cb.checked = adminConfig.workDays.includes(i);
    cb.id      = `wd-${i}`;

    const chip = document.createElement('span');
    chip.className   = 'chip';
    chip.textContent = label;

    lbl.appendChild(cb);
    lbl.appendChild(chip);
    grid.appendChild(lbl);
  });
}

function renderConfigTimesGrid() {
  const grid = document.getElementById('config-times-grid');
  grid.innerHTML = '';

  const allTimes = [...new Set([...ALL_TIMES, ...adminConfig.defaultTimes])].sort();

  allTimes.forEach(t => {
    const lbl = document.createElement('label');
    lbl.className = 'chip-label';

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.value   = t;
    cb.checked = adminConfig.defaultTimes.includes(t);

    const chip = document.createElement('span');
    chip.className   = 'chip';
    chip.textContent = t;

    lbl.appendChild(cb);
    lbl.appendChild(chip);
    grid.appendChild(lbl);
  });
}

function addCustomTime() {
  const input = document.getElementById('new-time-input');
  const val   = input.value;
  if (!val) return;

  /* Adiciona na lista e re-renderiza */
  const currentTimes = [...document.querySelectorAll('#config-times-grid input')]
    .filter(cb => cb.checked).map(cb => cb.value);

  if (!currentTimes.includes(val)) {
    if (!ALL_TIMES.includes(val)) ALL_TIMES.push(val);
    if (!adminConfig.defaultTimes.includes(val)) adminConfig.defaultTimes.push(val);
    adminConfig.defaultTimes.sort();
    renderConfigTimesGrid();
  }
  input.value = '';
}

/* ─── SALVAR CONFIGURAÇÕES ───────────────────────────────────── */
async function saveSettings() {
  const btn      = document.getElementById('btn-save-config');
  const feedback = document.getElementById('save-feedback');

  btn.disabled  = true;
  btn.innerHTML = '<i class="ph ph-spinner"></i> Salvando…';
  feedback.hidden = true;

  const workDays = [...document.querySelectorAll('#workdays-grid input:checked')]
    .map(cb => Number(cb.value));

  const defaultTimes = [...document.querySelectorAll('#config-times-grid input:checked')]
    .map(cb => cb.value).sort();

  if (workDays.length === 0) {
    showFeedback(feedback, 'Selecione pelo menos um dia de trabalho.', false);
    btn.disabled  = false;
    btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Salvar Configurações';
    return;
  }

  try {
    await db.collection('config').doc('schedule').set({ workDays, defaultTimes });
    adminConfig = { workDays, defaultTimes };
    showFeedback(feedback, 'Configurações salvas com sucesso!', true);
    /* Recarrega calendário para refletir novos dias de trabalho */
    monthCache = {};
    await renderAdminCalendar();
  } catch (err) {
    showFeedback(feedback, 'Erro ao salvar. Verifique a conexão.', false);
    console.error(err);
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="ph ph-floppy-disk"></i> Salvar Configurações';
  }
}

function showFeedback(el, msg, success) {
  el.textContent = msg;
  el.className   = `save-feedback ${success ? 'success' : 'error'}`;
  el.hidden      = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}
