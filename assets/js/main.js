/* ═══════════════════════════════════════════════════════════════
   Kamilly Vitória | Beauty Art  ─  Main JS
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── CONFIG ──────────────────────────────────────────────────── */
// 🔧 SUBSTITUA pelo número real com DDI (ex: 5511999999999)
const WHATSAPP_NUMBER = '5511975199771';

/* ─── SERVIÇOS ────────────────────────────────────────────────── */
const SERVICES_LIST = [
  { id: 'pe', name: 'Pé', price: 35 },
  { id: 'mao', name: 'Mão', price: 25 },
  { id: 'blindagem', name: 'Blindagem', price: null },
  { id: 'gel', name: 'Esmaltação em Gel', price: null },
  { id: 'molde-f1', name: 'Molde F1', price: 55 },
  { id: 'tips', name: 'Tips', price: 60 },
  { id: 'fibra', name: 'Fibra', price: 90 },
];
/* Fallback estático — substituído pelos dados do Firebase quando disponível */
const AVAILABLE_TIMES = [
  '08:00', '09:00', '10:00', '11:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

/* ─── SCHEDULE CONFIG (carregado do Firebase) ────────────────── */
let scheduleConfig = {
  defaultTimes: [...AVAILABLE_TIMES],
  workDays: [1, 2, 3, 4, 5, 6]   // 0=Dom … 6=Sáb
};

async function loadScheduleConfig() {
  try {
    const snap = await db.collection('config').doc('schedule').get();
    if (snap.exists) scheduleConfig = { ...scheduleConfig, ...snap.data() };
  } catch (e) {
    console.warn('[KV] loadScheduleConfig falhou, usando padrão:', e.message);
  }
}

/* Formata Date → 'YYYY-MM-DD' */
function fmtDate(date) {
  return `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}`;
}
const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const PT_DAYS_FULL = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

/* ─── STATE ───────────────────────────────────────────────────── */
let currentStep      = 1;
let selectedService  = null;   // fluxo legado (botão "Agendar" do nav)
let selectedServices = [];     // array { name, price } — fluxo dos cards
let selectedDate     = null;
let selectedTime     = null;
let calendarDate     = new Date();

let pendingService = null;
let pendingPrice   = null;

/* ─── DOM REFS ────────────────────────────────────────────────── */
const backdrop = document.getElementById('modal-backdrop');
const modal = document.getElementById('booking-modal');
const step1Next = document.getElementById('step1-next');
const step2Next = document.getElementById('step2-next');
const calDays = document.getElementById('cal-days');
const calLabel = document.getElementById('cal-month-label');
const timeSlotsWrap = document.getElementById('time-slots-section');
const timeSlotsEl = document.getElementById('time-slots');
const hamburgerBtn = document.getElementById('hamburger-btn');
const navLinks = document.getElementById('nav-links');

/* ─── MODAL ───────────────────────────────────────────────────── */
function openModal(preselect) {
  // Reset state
  currentStep = 1;
  selectedDate = null;
  selectedTime = null;
  calendarDate = new Date();

  if (preselect) {
    selectedService = preselect;
    const radios = document.querySelectorAll('input[name="service"]');
    radios.forEach(r => {
      r.checked = (r.value === preselect);
    });
    step1Next.disabled = false;
  } else {
    selectedService = null;
    document.querySelectorAll('input[name="service"]').forEach(r => r.checked = false);
    step1Next.disabled = true;
  }

  renderCalendar();
  showStep(1);

  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus trap
  setTimeout(() => modal.querySelector('.modal-close').focus(), 350);
}

function closeModal() {
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Close on backdrop click
backdrop.addEventListener('click', e => {
  if (e.target === backdrop) closeModal();
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
});

/* ─── STEP MANAGEMENT ────────────────────────────────────────── */
function showStep(n) {
  currentStep = n;
  [1, 2, 3].forEach(i => {
    const el = document.getElementById(`modal-step-${i}`);
    el.classList.toggle('hidden', i !== n);
  });
  updateStepDots();
  modal.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepDots() {
  [1, 2, 3].forEach(i => {
    const dot = document.getElementById(`step-dot-${i}`);
    const line = document.getElementById(`step-line-${i}`);
    dot.classList.remove('active', 'done');
    if (i < currentStep) dot.classList.add('done');
    else if (i === currentStep) dot.classList.add('active');
    if (line) {
      line.classList.toggle('done', i < currentStep);
    }
  });
}

function goToStep(n) {
  if (n === 2 && !selectedService) return;
  if (n === 3) {
    if (!selectedDate || !selectedTime) return;
    fillSummary();
  }
  showStep(n);
}

/* ─── SERVICE SELECTION ──────────────────────────────────────── */
document.querySelectorAll('input[name="service"]').forEach(radio => {
  radio.addEventListener('change', () => {
    selectedService = radio.value;
    step1Next.disabled = false;

    // Update visual selection on labels
    document.querySelectorAll('.service-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    radio.closest('.service-option').classList.add('selected');
  });
});

/* ─── CALENDAR ───────────────────────────────────────────────── */
function changeMonth(dir) {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + dir, 1);
  selectedDate = null;
  selectedTime = null;
  timeSlotsWrap.hidden = true;
  step2Next.disabled = true;
  renderCalendar();
}

function renderCalendar() {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  calLabel.textContent = `${PT_MONTHS[month]} ${year}`;

  const today       = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  calDays.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('button');
    empty.className = 'cal-day cal-day--empty';
    empty.tabIndex  = -1;
    empty.setAttribute('aria-hidden', 'true');
    calDays.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date      = new Date(year, month, d);
    const isPast    = date < today;
    const isOffDay  = !scheduleConfig.workDays.includes(date.getDay());
    const isToday   = date.toDateString() === today.toDateString();
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
    const isDisabled = isPast || isOffDay;

    const btn = document.createElement('button');
    btn.className = 'cal-day';
    btn.textContent = d;
    btn.dataset.dateStr = fmtDate(date);
    btn.setAttribute('role', 'gridcell');
    btn.setAttribute('aria-label',
      `${d} de ${PT_MONTHS[month]} de ${year}${isDisabled ? ' (indisponível)' : ''}`);

    if (isDisabled) { btn.classList.add('cal-day--disabled'); btn.disabled = true; }
    if (isToday)    btn.classList.add('cal-day--today');
    if (isSelected) btn.classList.add('selected');

    if (!isDisabled) {
      btn.addEventListener('click', () => selectDate(date, btn));
    }
    calDays.appendChild(btn);
  }

  /* Overlay assíncrono: marca dias bloqueados no Firebase */
  applyBlockedDates(year, month);
}

async function applyBlockedDates(year, month) {
  try {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    /* Busca todos os docs do mês — filtra por prefixo no cliente */
    const snap = await db.collection('dateConfig').get();

    snap.forEach(docSnap => {
      if (!docSnap.id.startsWith(prefix)) return;

      const data      = docSnap.data();
      const isBlocked = data.blocked ||
        (Array.isArray(data.times) && data.times.length === 0);
      if (!isBlocked) return;

      const btn = calDays.querySelector(`[data-date-str="${docSnap.id}"]`);
      if (btn && !btn.disabled) {
        btn.classList.add('cal-day--disabled');
        btn.disabled = true;
      }
    });
  } catch (e) {
    console.warn('[KV] applyBlockedDates falhou:', e.message);
  }
}

async function selectDate(date, btn) {
  selectedDate = date;
  selectedTime = null;
  step2Next.disabled = true;

  document.querySelectorAll('.cal-day').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  /* Mostra loading enquanto busca horários */
  timeSlotsWrap.hidden = false;
  timeSlotsEl.innerHTML = '<p class="slots-loading">Carregando horários…</p>';

  const times = await fetchTimesForDate(date);
  renderTimeSlots(times);

  if (window.innerWidth < 640) {
    timeSlotsWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function fetchTimesForDate(date) {
  try {
    const snap = await db.collection('dateConfig').doc(fmtDate(date)).get();
    if (snap.exists) {
      const data = snap.data();
      if (data.blocked) return [];
      if (Array.isArray(data.times) && data.times.length > 0) return data.times;
    }
  } catch (e) {
    console.warn('[KV] fetchTimesForDate falhou:', e.message);
  }
  return scheduleConfig.defaultTimes;
}

/* ─── TIME SLOTS ─────────────────────────────────────────────── */
function renderTimeSlots(times) {
  timeSlotsEl.innerHTML = '';

  if (!times || times.length === 0) {
    timeSlotsEl.innerHTML =
      '<p class="slots-empty">Nenhum horário disponível para esta data.</p>';
    return;
  }

  times.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'time-slot';
    btn.textContent = t;
    btn.setAttribute('aria-label', `Horário ${t}`);
    btn.addEventListener('click', () => selectTime(t, btn));
    timeSlotsEl.appendChild(btn);
  });
}

function selectTime(time, btn) {
  selectedTime = time;
  step2Next.disabled = false;
  document.querySelectorAll('.time-slot').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

/* ─── SUMMARY ────────────────────────────────────────────────── */
function fillSummary() {
  const listEl  = document.getElementById('summary-services-list');
  const totalLine = document.getElementById('summary-total-line');
  const totalEl   = document.getElementById('summary-total');

  // Serviços vindos dos cards
  if (selectedServices.length > 0) {
    let total = 0;
    let hasConsulta = false;

    listEl.innerHTML = selectedServices.map(s => {
      const priceLabel = s.price !== null
        ? `R$ ${s.price.toFixed(2).replace('.', ',')}`
        : 'A consultar';
      if (s.price !== null) total += s.price; else hasConsulta = true;
      return `<span class="summary-service-row">
                <span>${s.name}</span>
                <strong>${priceLabel}</strong>
              </span>`;
    }).join('');

    if (selectedServices.length > 1) {
      const totalStr = (hasConsulta
        ? `R$ ${total.toFixed(2).replace('.', ',')} + A consultar`
        : `R$ ${total.toFixed(2).replace('.', ',')}`);
      totalEl.textContent = totalStr;
      totalLine.hidden = false;
    } else {
      totalLine.hidden = true;
    }

  // Fluxo legado (nav "Agendar")
  } else {
    listEl.innerHTML = `<span class="summary-service-row"><span>${selectedService || '—'}</span></span>`;
    totalLine.hidden = true;
  }

  if (selectedDate) {
    const opts = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    document.getElementById('summary-date').textContent =
      selectedDate.toLocaleDateString('pt-BR', opts);
  }

  document.getElementById('summary-time').textContent = selectedTime || '—';
}

/* ─── WHATSAPP FINALIZE ──────────────────────────────────────── */
function finalizeOnWhatsApp() {
  const hasServices = selectedServices.length > 0 || selectedService;
  if (!hasServices || !selectedDate || !selectedTime) {
    alert('Por favor, preencha todos os campos antes de continuar.');
    return;
  }

  const dateStr = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  let serviceBlock;
  if (selectedServices.length > 0) {
    let total = 0;
    let hasConsulta = false;
    const lines = selectedServices.map(s => {
      if (s.price !== null) { total += s.price; return `• ${s.name}: R$ ${s.price.toFixed(2).replace('.', ',')}`; }
      hasConsulta = true;
      return `• ${s.name}: A consultar`;
    });
    const totalStr = hasConsulta
      ? `R$ ${total.toFixed(2).replace('.', ',')} + valores a consultar`
      : `R$ ${total.toFixed(2).replace('.', ',')}`;
    serviceBlock = lines.join('\n') +
      (selectedServices.length > 1 ? `\n*Total:* ${totalStr}` : '');
  } else {
    serviceBlock = `• ${selectedService}`;
  }

  const message =
    `Olá Kamilly! 💅\n` +
    `Gostaria de agendar:\n\n` +
    serviceBlock + '\n\n' +
    `*Data:* ${dateStr}\n` +
    `*Horário:* ${selectedTime}\n\n` +
    `Aguardo a confirmação. Obrigada! 🌸`;

  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    '_blank', 'noopener,noreferrer'
  );
  closeModal();
}

/* ─── NAV: SCROLL HEADER ─────────────────────────────────────── */
const siteHeader = document.getElementById('site-header');

function handleScroll() {
  siteHeader.classList.toggle('scrolled', window.scrollY > 50);
}
window.addEventListener('scroll', handleScroll, { passive: true });
handleScroll(); // initial

/* ─── NAV: HAMBURGER ─────────────────────────────────────────── */
hamburgerBtn.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  hamburgerBtn.classList.toggle('open', isOpen);
  hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Close nav on link click
navLinks.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburgerBtn.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
});

// Close nav on outside click
document.addEventListener('click', e => {
  if (
    navLinks.classList.contains('open') &&
    !navLinks.contains(e.target) &&
    !hamburgerBtn.contains(e.target)
  ) {
    navLinks.classList.remove('open');
    hamburgerBtn.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
});

/* ─── INTERSECTION OBSERVER (section reveals) ────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll(
  '.section-header, .bento-item, .service-card, .testimonial-card, .whatsapp-cta-block, .hero-stats'
).forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

/* ─── SMOOTH ANCHOR SCROLL ───────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ─── BENTO: staggered animation on view ─────────────────────── */
document.querySelectorAll('.bento-item').forEach((item, i) => {
  item.style.transitionDelay = `${i * 0.06}s`;
});

/* ═══════════════════════════════════════════════════════════════
   FLUXO DE SERVIÇO COM DESCONTO
   ═══════════════════════════════════════════════════════════════ */

/* ─── Formatar preço ────────────────────────────────────────── */
function formatPrice(price) {
  if (price === null) return 'A consultar';
  return 'R$ ' + price.toFixed(2).replace('.', ',');
}

/* ─── Abrir seleção de serviços sem pré-seleção (nav/hero/portfólio) */
function openServiceSelect() {
  pendingService = null;
  pendingPrice   = null;
  openMultiSelectModal();
}

/* ─── Abrir booking modal já com serviços selecionados ──────── */
function openBookingModal(services) {
  selectedServices = services;
  selectedDate     = null;
  selectedTime     = null;
  calendarDate     = new Date();

  timeSlotsWrap.hidden = true;
  step2Next.disabled   = true;

  loadScheduleConfig().then(() => renderCalendar());

  // Vai direto para o step 2 (data/hora), marcando step 1 como concluído
  showStep(2);

  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  setTimeout(() => modal.querySelector('.modal-close').focus(), 350);
}

/* ─── Voltar do step 2: fecha o modal (veio dos cards) ──────── */
function goBackFromStep2() {
  if (selectedServices.length > 0) {
    // Veio dos cards — fecha o booking e limpa
    selectedServices = [];
    closeModal();
  } else {
    // Veio do fluxo legado
    goToStep(1);
  }
}

/* ─── 1. Clique no card do serviço ─────────────────────────── */
function selectService(name, price) {
  pendingService = name;
  pendingPrice = price;

  const preview = document.getElementById('discount-service-preview');
  preview.innerHTML =
    `<div class="preview-service">` +
    `<span class="preview-name">${name}</span>` +
    `<span class="preview-price">${formatPrice(price)}</span>` +
    `</div>`;

  openDiscountModal();
}

/* ─── Modal de desconto ─────────────────────────────────────── */
function openDiscountModal() {
  const bd = document.getElementById('discount-backdrop');
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDiscountModal() {
  const bd = document.getElementById('discount-backdrop');
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Fechar ao clicar no fundo
document.getElementById('discount-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('discount-backdrop')) closeDiscountModal();
});

/* ─── 2a. Usuário clica "Não" → booking modal com serviço único ─ */
function discountNo() {
  closeDiscountModal();
  openBookingModal([{ name: pendingService, price: pendingPrice }]);
}

/* ─── 2b. Usuário clica "Sim" → Modal de seleção múltipla ───── */
function discountYes() {
  closeDiscountModal();
  openMultiSelectModal();
}

/* ─── Modal de seleção múltipla ─────────────────────────────── */
function openMultiSelectModal() {
  const container = document.getElementById('multiselect-services');
  container.innerHTML = '';

  SERVICES_LIST.forEach(service => {
    const isPreselected = service.name === pendingService;

    const label = document.createElement('label');
    label.className = 'multiselect-option' + (isPreselected ? ' multiselect-option--checked' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = 'multi-service';
    cb.value = service.name;
    cb.dataset.price = service.price !== null ? service.price : '';
    cb.checked = isPreselected;

    cb.addEventListener('change', function () {
      this.closest('.multiselect-option').classList.toggle('multiselect-option--checked', this.checked);
      updateMultiTotal();
    });

    const inner = document.createElement('div');
    inner.className = 'multiselect-option-inner';
    inner.innerHTML =
      `<span class="multi-name">${service.name}</span>` +
      `<span class="multi-price">${formatPrice(service.price)}</span>`;

    label.appendChild(cb);
    label.appendChild(inner);
    container.appendChild(label);
  });

  updateMultiTotal();

  const bd = document.getElementById('multiselect-backdrop');
  bd.classList.add('open');
  bd.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeMultiSelectModal() {
  const bd = document.getElementById('multiselect-backdrop');
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Fechar ao clicar no fundo
document.getElementById('multiselect-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('multiselect-backdrop')) closeMultiSelectModal();
});

/* ─── Atualizar total ao marcar/desmarcar ────────────────────── */
function updateMultiTotal() {
  const checked = document.querySelectorAll('#multiselect-services input[type="checkbox"]:checked');

  let total = 0;
  let hasConsulta = false;

  checked.forEach(cb => {
    if (cb.dataset.price !== '') {
      total += parseFloat(cb.dataset.price);
    } else {
      hasConsulta = true;
    }
  });

  const totalEl = document.getElementById('multiselect-total');
  const totalBase = 'R$ ' + total.toFixed(2).replace('.', ',');
  totalEl.textContent = hasConsulta ? totalBase + ' + A consultar' : totalBase;

  document.getElementById('multiselect-confirm-btn').disabled = checked.length === 0;
}

/* ─── Finalizar seleção múltipla → booking modal ────────────── */
function finalizeMultiSelect() {
  const checked = document.querySelectorAll('#multiselect-services input[type="checkbox"]:checked');
  if (checked.length === 0) return;

  const services = [];
  checked.forEach(cb => {
    services.push({
      name:  cb.value,
      price: cb.dataset.price !== '' ? parseFloat(cb.dataset.price) : null
    });
  });

  closeMultiSelectModal();
  openBookingModal(services);
}
