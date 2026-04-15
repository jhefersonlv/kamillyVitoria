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
let bookedCache   = {};           // { 'YYYY-MM-DD': true } — dias com agendamentos
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
  loadPendingAppointments();    // não bloqueia — carrega em paralelo
  loadUpcomingAppointments();   // não bloqueia — carrega em paralelo
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
  bookedCache  = {};
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

  const [dateSnap, bookedSnap] = await Promise.allSettled([
    db.collection('dateConfig')
      .where(firebase.firestore.FieldPath.documentId(), '>=', `${prefix}-01`)
      .where(firebase.firestore.FieldPath.documentId(), '<=', `${prefix}-31`)
      .get(),
    db.collection('bookedSlots')
      .where(firebase.firestore.FieldPath.documentId(), '>=', `${prefix}-01`)
      .where(firebase.firestore.FieldPath.documentId(), '<=', `${prefix}-31`)
      .get()
  ]);

  if (dateSnap.status === 'fulfilled') {
    dateSnap.value.forEach(docSnap => { monthCache[docSnap.id] = docSnap.data(); });
  } else {
    console.warn('[KV] loadMonthData dateConfig falhou:', dateSnap.reason?.message);
  }

  if (bookedSnap.status === 'fulfilled') {
    bookedSnap.value.forEach(docSnap => {
      const d = docSnap.data();
      if (Array.isArray(d.times) && d.times.length > 0) bookedCache[docSnap.id] = true;
    });
  } else {
    console.warn('[KV] loadMonthData bookedSlots falhou:', bookedSnap.reason?.message);
  }
}

function applyMonthDataToCalendar() {
  const daysEl = document.getElementById('admin-cal-days');
  daysEl.querySelectorAll('.admin-day[data-date]').forEach(btn => {
    const dateStr = btn.dataset.date;
    const data    = monthCache[dateStr];

    btn.classList.remove('admin-day--blocked', 'admin-day--custom', 'admin-day--booked');

    if (data) {
      if (data.blocked || (Array.isArray(data.times) && data.times.length === 0)) {
        btn.classList.add('admin-day--blocked');
      } else if (Array.isArray(data.times)) {
        btn.classList.add('admin-day--custom');
      }
    }

    if (bookedCache[dateStr]) btn.classList.add('admin-day--booked');
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
  loadAppointmentsForDay(dateStr);   // não bloqueia a abertura do painel
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

/* ═══════════════════════════════════════════════════════════════
   AGENDAMENTOS — DIA
   ═══════════════════════════════════════════════════════════════ */

async function loadAppointmentsForDay(dateStr) {
  const list = document.getElementById('day-appt-list');
  list.innerHTML = '<p class="appt-empty">Carregando…</p>';

  try {
    const snap = await db.collection('appointments')
      .where('date', '==', dateStr)
      .get();

    const appts = [];
    snap.forEach(doc => appts.push({ id: doc.id, ...doc.data() }));
    appts.sort((a, b) => a.time.localeCompare(b.time));

    renderDayAppointments(appts, dateStr);
  } catch (e) {
    console.warn('[KV] loadAppointmentsForDay falhou:', e.message);
    list.innerHTML = '<p class="appt-empty">Erro ao carregar agendamentos.</p>';
  }

  populateApptTimeSelect(dateStr);
}

function renderDayAppointments(appts, dateStr) {
  const list = document.getElementById('day-appt-list');

  if (appts.length === 0) {
    list.innerHTML = '<p class="appt-empty">Nenhum agendamento neste dia.</p>';
    return;
  }

  list.innerHTML = '';
  appts.forEach(appt => {
    const isPending = appt.status === 'pending';
    const item      = document.createElement('div');
    item.className  = `appt-item${isPending ? ' appt-item--pending' : ''}`;

    const clientLabel = isPending
      ? `<span class="appt-client appt-client--pending"><i class="ph ph-clock"></i> Aguardando confirmação</span>`
      : `<span class="appt-client${appt.client ? '' : ' appt-client--anon'}">${appt.client || 'Cliente não informado'}</span>`;

    const serviceText = appt.service || '';
    /* notes guarda o WhatsApp quando veio do site */
    const notesLabel  = appt.notes
      ? (appt.source === 'site'
          ? `<a class="appt-phone" href="https://wa.me/55${appt.notes.replace(/\D/g,'')}" target="_blank" rel="noopener">
               <i class="ph ph-whatsapp-logo"></i> ${appt.notes}
             </a>`
          : `<span class="appt-notes">${appt.notes}</span>`)
      : '';

    const actions = isPending
      ? `<div class="appt-item-pending-btns">
           <button class="btn-appt-confirm" onclick="confirmAppointment('${appt.id}','${dateStr}','${appt.time}')" title="Confirmar">
             <i class="ph ph-check"></i>
           </button>
           <button class="btn-appt-reject" onclick="rejectAppointment('${appt.id}','${dateStr}','${appt.time}')" title="Recusar">
             <i class="ph ph-x"></i>
           </button>
         </div>`
      : `<button class="btn-appt-delete" onclick="deleteAppointment('${appt.id}','${dateStr}','${appt.time}')"
           aria-label="Remover agendamento">
           <i class="ph ph-trash"></i>
         </button>`;

    item.innerHTML = `
      <div class="appt-item-main">
        <span class="appt-time-badge">${appt.time}</span>
        <div class="appt-item-info">
          ${clientLabel}
          ${serviceText ? `<span class="appt-service">${serviceText}</span>` : ''}
          ${notesLabel}
        </div>
      </div>
      ${actions}
    `;
    list.appendChild(item);
  });
}

async function populateApptTimeSelect(dateStr) {
  const select = document.getElementById('appt-time');
  select.innerHTML = '<option value="">— selecione —</option>';

  /* Horários do dia (config personalizada ou padrão) */
  let times = [...adminConfig.defaultTimes];
  try {
    const daySnap = await db.collection('dateConfig').doc(dateStr).get();
    if (daySnap.exists) {
      const d = daySnap.data();
      if (d.blocked) times = [];
      else if (Array.isArray(d.times)) times = d.times;
    }
  } catch (_) {}

  /* Horários já ocupados */
  let booked = [];
  try {
    const bookedSnap = await db.collection('bookedSlots').doc(dateStr).get();
    if (bookedSnap.exists && Array.isArray(bookedSnap.data().times)) {
      booked = bookedSnap.data().times;
    }
  } catch (_) {}

  /* Monta opções: primeiro os horários do dia, depois ALL_TIMES que faltarem */
  const combined = [...new Set([...times, ...ALL_TIMES])].sort();
  combined.forEach(t => {
    const opt       = document.createElement('option');
    opt.value       = t;
    opt.textContent = booked.includes(t) ? `${t} · ocupado` : t;
    select.appendChild(opt);
  });
}

async function addAppointment() {
  if (!selectedDayStr) return;

  const time    = document.getElementById('appt-time').value;
  if (!time) { alert('Selecione um horário para o agendamento.'); return; }

  const client  = document.getElementById('appt-client').value.trim();
  const service = document.getElementById('appt-service').value;
  const notes   = document.getElementById('appt-notes').value.trim();

  const btn = document.querySelector('.btn-add-appt');
  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-spinner"></i> Salvando…';

  try {
    await db.collection('appointments').add({
      date:   selectedDayStr,
      time,
      client:  client  || '',
      service: service || '',
      notes:   notes   || '',
      status:  'confirmed',
      source:  'admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    /* Marca o horário como ocupado */
    await db.collection('bookedSlots').doc(selectedDayStr).set(
      { times: firebase.firestore.FieldValue.arrayUnion(time) },
      { merge: true }
    );

    /* Limpa formulário */
    document.getElementById('appt-time').value    = '';
    document.getElementById('appt-client').value  = '';
    document.getElementById('appt-service').value = '';
    document.getElementById('appt-notes').value   = '';

    /* Atualiza lista do dia, calendário e próximos agendamentos */
    await loadAppointmentsForDay(selectedDayStr);
    bookedCache[selectedDayStr] = true;
    applyMonthDataToCalendar();
    loadUpcomingAppointments();

  } catch (err) {
    alert('Erro ao registrar agendamento. Tente novamente.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-check"></i> Registrar';
  }
}

async function deleteAppointment(id, dateStr, time) {
  if (!confirm('Remover este agendamento?')) return;

  try {
    /* Verifica o status antes de deletar */
    const docSnap = await db.collection('appointments').doc(id).get();
    const wasConfirmed = docSnap.exists && docSnap.data().status === 'confirmed';

    await db.collection('appointments').doc(id).delete();

    /* Só libera o horário no bookedSlots se estava confirmado */
    if (wasConfirmed) {
      const remaining = await db.collection('appointments')
        .where('date', '==', dateStr)
        .where('time', '==', time)
        .where('status', '==', 'confirmed')
        .get();

      if (remaining.empty) {
        await db.collection('bookedSlots').doc(dateStr).update({
          times: firebase.firestore.FieldValue.arrayRemove(time)
        });
      }
    }

    /* Atualiza cache do calendário se não há mais confirmados */
    const anyConfirmed = await db.collection('appointments')
      .where('date', '==', dateStr)
      .where('status', '==', 'confirmed')
      .limit(1).get();
    if (anyConfirmed.empty) {
      delete bookedCache[dateStr];
      applyMonthDataToCalendar();
    }

    loadAppointmentsForDay(dateStr);
    loadUpcomingAppointments();

  } catch (err) {
    alert('Erro ao remover agendamento.');
    console.error(err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SOLICITAÇÕES PENDENTES
   ═══════════════════════════════════════════════════════════════ */

async function loadPendingAppointments() {
  const wrap  = document.getElementById('pending-wrap');
  const list  = document.getElementById('pending-list');
  const badge = document.getElementById('pending-badge');

  try {
    const snap = await db.collection('appointments')
      .where('status', '==', 'pending')
      .get();

    const appts = [];
    snap.forEach(doc => appts.push({ id: doc.id, ...doc.data() }));
    appts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    if (appts.length === 0) {
      wrap.hidden = true;
      return;
    }

    wrap.hidden     = false;
    badge.textContent = `${appts.length} nova${appts.length !== 1 ? 's' : ''}`;
    list.innerHTML  = '';

    appts.forEach(appt => {
      const item = document.createElement('div');
      item.className = 'pending-item';
      const pendingPhone = appt.notes
        ? `<a class="pending-item-phone" href="https://wa.me/55${appt.notes.replace(/\D/g,'')}" target="_blank" rel="noopener">
             <i class="ph ph-whatsapp-logo"></i> ${appt.notes}
           </a>`
        : '';

      item.innerHTML = `
        <div class="pending-item-info">
          <div class="pending-item-top">
            <span class="pending-item-date">${fmtDateLabel(appt.date)}</span>
            <span class="pending-item-time">${appt.time}</span>
          </div>
          ${appt.client ? `<span class="pending-item-client">${appt.client}</span>` : ''}
          <span class="pending-item-service">${appt.service || '—'}</span>
          ${pendingPhone}
        </div>
        <div class="pending-item-actions">
          <button class="btn-pending-confirm" onclick="confirmAppointment('${appt.id}','${appt.date}','${appt.time}')">
            <i class="ph ph-check"></i> Confirmar
          </button>
          <button class="btn-pending-reject" onclick="rejectAppointment('${appt.id}','${appt.date}','${appt.time}')">
            <i class="ph ph-x"></i> Recusar
          </button>
        </div>
      `;
      list.appendChild(item);
    });

  } catch (e) {
    console.warn('[KV] loadPendingAppointments falhou:', e.message);
  }
}

async function confirmAppointment(id, dateStr, time) {
  const btn = event.currentTarget;
  btn.disabled = true;

  try {
    await db.collection('appointments').doc(id).update({ status: 'confirmed' });

    await db.collection('bookedSlots').doc(dateStr).set(
      { times: firebase.firestore.FieldValue.arrayUnion(time) },
      { merge: true }
    );

    bookedCache[dateStr] = true;
    applyMonthDataToCalendar();
    loadPendingAppointments();
    loadUpcomingAppointments();
    if (selectedDayStr === dateStr) loadAppointmentsForDay(dateStr);

  } catch (err) {
    alert('Erro ao confirmar agendamento.');
    console.error(err);
    btn.disabled = false;
  }
}

async function rejectAppointment(id, dateStr, time) {
  if (!confirm('Recusar e remover esta solicitação?')) return;

  try {
    await db.collection('appointments').doc(id).delete();
    loadPendingAppointments();
    if (selectedDayStr === dateStr) loadAppointmentsForDay(dateStr);

  } catch (err) {
    alert('Erro ao recusar agendamento.');
    console.error(err);
  }
}

/* ═══════════════════════════════════════════════════════════════
   PRÓXIMOS AGENDAMENTOS
   ═══════════════════════════════════════════════════════════════ */

async function loadUpcomingAppointments() {
  const list  = document.getElementById('upcoming-list');
  const count = document.getElementById('upcoming-count');
  list.innerHTML = '<p class="upcoming-empty">Carregando…</p>';

  const today = fmtDateAdmin(new Date());

  try {
    const snap = await db.collection('appointments')
      .where('date', '>=', today)
      .orderBy('date')
      .limit(50)
      .get();

    const appts = [];
    snap.forEach(doc => {
      const d = doc.data();
      /* Exclui pendentes — eles aparecem na seção própria */
      if (d.status !== 'pending') appts.push({ id: doc.id, ...d });
    });
    appts.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    count.textContent = appts.length > 0 ? `${appts.length} agendamento${appts.length !== 1 ? 's' : ''}` : '';
    renderUpcomingList(appts);

  } catch (e) {
    console.warn('[KV] loadUpcomingAppointments falhou:', e.message);
    /* Fallback sem índice composto */
    try {
      const snap2 = await db.collection('appointments').get();
      const appts = [];
      snap2.forEach(doc => {
        const d = doc.data();
        if (d.date >= today && d.status !== 'pending') appts.push({ id: doc.id, ...d });
      });
      appts.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
      const limited = appts.slice(0, 50);
      count.textContent = limited.length > 0 ? `${limited.length} agendamento${limited.length !== 1 ? 's' : ''}` : '';
      renderUpcomingList(limited);
    } catch (e2) {
      console.warn('[KV] loadUpcomingAppointments fallback falhou:', e2.message);
      list.innerHTML = '<p class="upcoming-empty">Erro ao carregar agendamentos.</p>';
    }
  }
}

function renderUpcomingList(appts) {
  const list = document.getElementById('upcoming-list');

  if (appts.length === 0) {
    list.innerHTML = '<p class="upcoming-empty">Nenhum agendamento futuro.</p>';
    return;
  }

  list.innerHTML = '';
  let currentDate = '';

  appts.forEach(appt => {
    if (appt.date !== currentDate) {
      currentDate = appt.date;
      const divider = document.createElement('div');
      divider.className   = 'upcoming-date-divider';
      divider.textContent = fmtDateLabel(appt.date);
      list.appendChild(divider);
    }

    const phoneLink = (appt.notes && appt.source === 'site')
      ? `<a class="upcoming-phone" href="https://wa.me/55${appt.notes.replace(/\D/g,'')}" target="_blank" rel="noopener">
           <i class="ph ph-whatsapp-logo"></i> ${appt.notes}
         </a>`
      : (appt.notes ? `<span class="upcoming-notes">${appt.notes}</span>` : '');

    const item = document.createElement('div');
    item.className = 'upcoming-item';
    item.innerHTML = `
      <span class="upcoming-time">${appt.time}</span>
      <div class="upcoming-info">
        <span class="upcoming-client">${appt.client || 'Cliente não informado'}</span>
        ${appt.service ? `<span class="upcoming-service">${appt.service}</span>` : ''}
        ${phoneLink}
      </div>
    `;
    list.appendChild(item);
  });
}
