/* ═══════════════════════════════════════════════════════════════
   Kamilly Vitória | Beauty Art  ─  Main JS
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── CONFIG ──────────────────────────────────────────────────── */
// 🔧 SUBSTITUA pelo número real com DDI (ex: 5511999999999)
const WHATSAPP_NUMBER = '5500000000000';

/* ─── SERVIÇOS ────────────────────────────────────────────────── */
const SERVICES_LIST = [
  { id: 'pe',         name: 'Pé',               price: 35   },
  { id: 'mao',        name: 'Mão',              price: 25   },
  { id: 'blindagem',  name: 'Blindagem',         price: null },
  { id: 'gel',        name: 'Esmaltação em Gel', price: null },
  { id: 'molde-f1',   name: 'Molde F1',          price: 55   },
  { id: 'tips',       name: 'Tips',              price: 60   },
  { id: 'fibra',      name: 'Fibra',             price: 90   },
];
const AVAILABLE_TIMES = [
  '08:00', '09:00', '10:00', '11:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];
const PT_MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
const PT_DAYS_FULL = [
  'Domingo','Segunda-feira','Terça-feira','Quarta-feira',
  'Quinta-feira','Sexta-feira','Sábado'
];

/* ─── STATE ───────────────────────────────────────────────────── */
let currentStep    = 1;
let selectedService = null;
let selectedDate   = null;
let selectedTime   = null;
let calendarDate   = new Date();

let pendingService = null;
let pendingPrice   = null;

/* ─── DOM REFS ────────────────────────────────────────────────── */
const backdrop    = document.getElementById('modal-backdrop');
const modal       = document.getElementById('booking-modal');
const step1Next   = document.getElementById('step1-next');
const step2Next   = document.getElementById('step2-next');
const calDays     = document.getElementById('cal-days');
const calLabel    = document.getElementById('cal-month-label');
const timeSlotsWrap = document.getElementById('time-slots-section');
const timeSlotsEl   = document.getElementById('time-slots');
const hamburgerBtn  = document.getElementById('hamburger-btn');
const navLinks      = document.getElementById('nav-links');

/* ─── MODAL ───────────────────────────────────────────────────── */
function openModal(preselect) {
  // Reset state
  currentStep     = 1;
  selectedDate    = null;
  selectedTime    = null;
  calendarDate    = new Date();

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
    const dot  = document.getElementById(`step-dot-${i}`);
    const line = document.getElementById(`step-line-${i}`);
    dot.classList.remove('active', 'done');
    if (i < currentStep)       dot.classList.add('done');
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
    selectedService  = radio.value;
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
  selectedDate   = null;
  selectedTime   = null;
  timeSlotsWrap.hidden = true;
  step2Next.disabled   = true;
  renderCalendar();
}

function renderCalendar() {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  calLabel.textContent = `${PT_MONTHS[month]} ${year}`;

  const today    = new Date();
  today.setHours(0,0,0,0);
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  calDays.innerHTML = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('button');
    empty.className = 'cal-day cal-day--empty';
    empty.tabIndex = -1;
    empty.setAttribute('aria-hidden', 'true');
    calDays.appendChild(empty);
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month, d);
    const isPast  = date < today;
    const isSun   = date.getDay() === 0;
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
    const isDisabled  = isPast || isSun;

    const btn = document.createElement('button');
    btn.className  = 'cal-day';
    btn.textContent = d;
    btn.setAttribute('role', 'gridcell');
    btn.setAttribute('aria-label', `${d} de ${PT_MONTHS[month]} de ${year}${isDisabled ? ' (indisponível)' : ''}`);

    if (isDisabled)  btn.classList.add('cal-day--disabled');
    if (isToday)     btn.classList.add('cal-day--today');
    if (isSelected)  btn.classList.add('selected');
    if (isDisabled) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => selectDate(date, btn));
    }
    calDays.appendChild(btn);
  }
}

function selectDate(date, btn) {
  selectedDate = date;
  selectedTime = null;
  step2Next.disabled = true;

  // Highlight selected day
  document.querySelectorAll('.cal-day').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  renderTimeSlots();
  timeSlotsWrap.hidden = false;

  // Scroll on mobile only
  if (window.innerWidth < 640) {
    timeSlotsWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/* ─── TIME SLOTS ─────────────────────────────────────────────── */
function renderTimeSlots() {
  timeSlotsEl.innerHTML = '';
  AVAILABLE_TIMES.forEach(t => {
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
  document.getElementById('summary-service').textContent = selectedService || '—';

  if (selectedDate) {
    const options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    document.getElementById('summary-date').textContent =
      selectedDate.toLocaleDateString('pt-BR', options);
  }

  document.getElementById('summary-time').textContent = selectedTime || '—';
}

/* ─── WHATSAPP FINALIZE ──────────────────────────────────────── */
function finalizeOnWhatsApp() {
  if (!selectedService || !selectedDate || !selectedTime) {
    alert('Por favor, preencha todos os campos antes de continuar.');
    return;
  }

  const dateStr = selectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const message =
    `Olá Kamilly! 💅\n` +
    `Gostaria de agendar o seguinte serviço:\n\n` +
    `*Serviço:* ${selectedService}\n` +
    `*Data:* ${dateStr}\n` +
    `*Horário:* ${selectedTime}\n\n` +
    `Aguardo a confirmação. Obrigada! 🌸`;

  const encoded = encodeURIComponent(message);
  const url     = `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;

  window.open(url, '_blank', 'noopener,noreferrer');
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

/* ─── 1. Clique no card do serviço ─────────────────────────── */
function selectService(name, price) {
  pendingService = name;
  pendingPrice   = price;

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

/* ─── 2a. Usuário clica "Não" → WhatsApp direto ─────────────── */
function discountNo() {
  closeDiscountModal();

  const message =
    `Olá Kamilly! 💅\n` +
    `Gostaria de agendar o seguinte serviço:\n\n` +
    `*Serviço:* ${pendingService}\n` +
    `*Valor:* ${formatPrice(pendingPrice)}\n\n` +
    `Aguardo a confirmação. Obrigada! 🌸`;

  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    '_blank', 'noopener,noreferrer'
  );
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
    cb.type    = 'checkbox';
    cb.name    = 'multi-service';
    cb.value   = service.name;
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

  let total       = 0;
  let hasConsulta = false;

  checked.forEach(cb => {
    if (cb.dataset.price !== '') {
      total += parseFloat(cb.dataset.price);
    } else {
      hasConsulta = true;
    }
  });

  const totalEl   = document.getElementById('multiselect-total');
  const totalBase = 'R$ ' + total.toFixed(2).replace('.', ',');
  totalEl.textContent = hasConsulta ? totalBase + ' + A consultar' : totalBase;

  document.getElementById('multiselect-confirm-btn').disabled = checked.length === 0;
}

/* ─── Finalizar seleção múltipla → WhatsApp ─────────────────── */
function finalizeMultiSelect() {
  const checked = document.querySelectorAll('#multiselect-services input[type="checkbox"]:checked');
  if (checked.length === 0) return;

  let lines       = [];
  let total       = 0;
  let hasConsulta = false;

  checked.forEach(cb => {
    const name = cb.value;
    if (cb.dataset.price !== '') {
      const p = parseFloat(cb.dataset.price);
      total  += p;
      lines.push(`• ${name}: R$ ${p.toFixed(2).replace('.', ',')}`);
    } else {
      hasConsulta = true;
      lines.push(`• ${name}: A consultar`);
    }
  });

  const totalStr = hasConsulta
    ? `R$ ${total.toFixed(2).replace('.', ',')} + valores a consultar`
    : `R$ ${total.toFixed(2).replace('.', ',')}`;

  const message =
    `Olá Kamilly! 💅\n` +
    `Gostaria de agendar os seguintes serviços:\n\n` +
    lines.join('\n') + '\n\n' +
    `*Total:* ${totalStr}\n\n` +
    `Aguardo a confirmação. Obrigada! 🌸`;

  window.open(
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    '_blank', 'noopener,noreferrer'
  );

  closeMultiSelectModal();
}
