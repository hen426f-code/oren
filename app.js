/**
 * app.js — הרכבת חזית החנות מתוך הנתונים.
 *
 * ההבחנה המרכזית: מחלקה עם restricted מקבלת תבנית אחרת לגמרי —
 * רשימה טקסטואלית של שם, מחיר וזמינות. בלי תיאור שיווקי, בלי דירוגים,
 * בלי תגי מבצע ובלי אנימציה על השורה. תמונה ותיאור נשארים אפשריים,
 * אך רק אם בעל האתר הדליק אותם במפורש בהגדרות אותה מחלקה.
 */

import { Store, money, stockLabel, waLink, esc } from './store.js';
import { motionReduced, initScroll, scrollToTarget, initReveals, revealHeadline, initHero } from './motion.js';
import { initCart } from './cart.js';

const data  = Store.load();
const depts = Store.sortedDepartments(data);
const biz   = data.business;

/* ===================== עזרי סימון ===================== */

function orderText(deptName, productName) {
  let t = 'שלום, אשמח להזמין';
  if (productName) t += ': ' + productName;
  if (deptName) t += ' (' + deptName + ')';
  return t;
}

function stockMarkup(status) {
  const cls = status === 'out' ? 'out' : status === 'low' ? 'low' : 'in';
  return '<span class="stock stock--' + cls + '">' + esc(stockLabel(status)) + '</span>';
}

function priceMarkup(p) {
  let html = '<span><span class="price__now">' + esc(money(p.price)) + '</span>';
  if (p.prevPrice && Number(p.prevPrice) > Number(p.price)) {
    html += '<span class="price__prev">' + esc(money(p.prevPrice)) + '</span>';
  }
  return html + '</span>';
}

/** כפתור הוספה לסל. מוצר שאזל אינו ניתן להוספה. */
function addButton(p, plain) {
  const cls = plain ? 'btn btn--soft btn--sm' : 'btn btn--sm';
  if (p.stock === 'out') {
    return '<button class="' + cls + '" type="button" disabled>אזל מהמלאי</button>';
  }
  return '<button class="' + cls + '" type="button" data-add="' + esc(p.id) + '">הוספה לסל</button>';
}

const waIcon =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z"/></svg>';

/* ===================== מעטפת ===================== */

function renderShell() {
  document.title = biz.name + ' — ' + biz.tagline;

  document.getElementById('brand-mark').textContent = (biz.name.trim().charAt(0) || 'ח');
  document.getElementById('brand-name').textContent = biz.name;
  document.getElementById('brand-sub').textContent  = biz.tagline;

  document.getElementById('hero-eyebrow').textContent =
    data.hero.eyebrow + ' · ' + biz.whatsappDisplay;
  document.getElementById('hero-lead').textContent = data.hero.lead;
  document.getElementById('hero-cta-1').textContent = data.hero.ctaPrimary;

  const cta2 = document.getElementById('hero-cta-2');
  cta2.href = waLink(biz.whatsapp, orderText());
  cta2.innerHTML = waIcon + '<span>' + esc(data.hero.ctaSecondary) + '</span>';

  const fab = document.getElementById('wa-fab');
  fab.href = waLink(biz.whatsapp, orderText());
  fab.innerHTML = waIcon + '<span class="visually-hidden">פתיחת שיחה בוואטסאפ</span>';

  // הרצועה מכילה את הרשימה שלוש פעמים, כדי שהלולאה תהיה רציפה
  const names = depts.map(d => d.name);
  const triple = names.concat(names, names);
  document.getElementById('strip-track').innerHTML =
    triple.map(n => '<li>' + esc(n) + '</li>').join('');
}

/* ===================== לשוניות המחלקות ===================== */

/** עוגן יציב, נגזר מהמזהה כדי שקישור עמוק לא ישבר בשינוי שם המחלקה. */
function slugOf(d) { return d.id.replace(/[^a-z0-9_-]/gi, ''); }

function renderTabs() {
  const tabsEl = document.getElementById('dept-tabs');
  const panelsEl = document.getElementById('dept-panels');

  if (!depts.length) {
    tabsEl.innerHTML = '';
    panelsEl.innerHTML = '<div class="empty-state">עדיין לא הוגדרו מחלקות. אפשר להוסיף אותן בפאנל הניהול.</div>';
    return;
  }

  tabsEl.innerHTML = depts.map((d, i) =>
    '<button class="dept-tab" role="tab" type="button" id="tab-' + slugOf(d) + '"' +
    ' aria-controls="panel-' + slugOf(d) + '" aria-selected="' + (i === 0) + '"' +
    ' tabindex="' + (i === 0 ? 0 : -1) + '">' + esc(d.name) +
    (d.restricted ? '<span class="dept-tab__flag">18+</span>' : '') + '</button>').join('');

  panelsEl.innerHTML = depts.map((d, i) =>
    '<section class="dept-panel" role="tabpanel" id="panel-' + slugOf(d) + '"' +
    ' aria-labelledby="tab-' + slugOf(d) + '" tabindex="0"' + (i === 0 ? '' : ' hidden') + '>' +
    renderDept(d) + '</section>').join('');

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.dept-tab');
    if (btn) selectTab(btn.id.replace('tab-', ''), true);
  });

  // ניווט מקלדת לפי דפוס ה-tablist המקובל. בממשק מימין לשמאל,
  // חץ שמאלה מתקדם קדימה ברשימה.
  tabsEl.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const all = [...tabsEl.querySelectorAll('.dept-tab')];
    const cur = all.findIndex(b => b.getAttribute('aria-selected') === 'true');
    let next = cur;
    if (e.key === 'ArrowLeft')  next = (cur + 1) % all.length;
    if (e.key === 'ArrowRight') next = (cur - 1 + all.length) % all.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End')  next = all.length - 1;
    const id = all[next].id.replace('tab-', '');
    selectTab(id, true);
    document.getElementById('tab-' + id).focus();
  });
}

function selectTab(slug, updateHash) {
  document.querySelectorAll('.dept-tab').forEach(b => {
    const on = b.id === 'tab-' + slug;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.dept-panel').forEach(p => { p.hidden = p.id !== 'panel-' + slug; });
  if (updateHash) history.replaceState(null, '', '#' + slug);

  // תוכן שנחשף בלחיצה על לשונית מוצג מיד. משקיף הגלילה אינו נורה על
  // אלמנט שהיה מוסתר, ובלי השורה הזו הרשימה נשארת בשקיפות אפס.
  const panel = document.getElementById('panel-' + slug);
  if (panel) panel.querySelectorAll('.reveal').forEach(el => el.classList.add('is-revealed'));
}

/* ===================== שתי התבניות ===================== */

function renderDept(d) {
  const products = Store.productsOf(data, d.id);
  const head =
    '<header class="dept-head">' +
      '<h2>' + esc(d.name) + '</h2>' +
      (d.intro && !d.restricted ? '<p>' + esc(d.intro) + '</p>' : '') +
    '</header>';

  const body = d.restricted ? renderRestricted(d, products) : renderVisual(d, products);

  const order =
    '<div class="dept-order">' +
      '<p>' + esc(data.settings.vatNotice) + ' הזמנות ובירורים בוואטסאפ ' + esc(biz.whatsappDisplay) + '.</p>' +
      '<a class="btn btn--sm" href="' + waLink(biz.whatsapp, orderText(d.name)) + '" target="_blank" rel="noopener">' +
      waIcon + '<span>הזמנה בוואטסאפ</span></a>' +
    '</div>';

  return head + body + order;
}

/** מחלקה שאינה מוצרי עישון — תצוגה מלאה, ויזואלית, עם תנועה. */
function renderVisual(d, products) {
  if (!products.length) return '<div class="empty-state">אין כרגע מוצרים במחלקה הזו.</div>';

  return '<div class="product-grid">' + products.map((p, i) => {
    const alt = p.imageAlt || p.name;
    const media = (d.showImages !== false && p.image)
      ? '<div class="card__media"><img src="' + esc(p.image) + '" alt="' + esc(alt) +
        '" loading="lazy" decoding="async" width="800" height="600"></div>'
      : '<div class="card__media card__media--empty">' + esc(p.name) + '</div>';

    const deal = (p.prevPrice && Number(p.prevPrice) > Number(p.price))
      ? '<span class="deal-flag">מבצע</span>' : '';

    return '<article class="card card--animated reveal tone-' + (i % 3) + '">' + deal + media +
      '<div class="card__body">' +
        '<h3 class="card__name">' + esc(p.name) + '</h3>' +
        (d.showDescriptions !== false && p.description
          ? '<p class="card__desc">' + esc(p.description) + '</p>' : '') +
        '<div class="card__foot">' + priceMarkup(p) + stockMarkup(p.stock) + '</div>' +
        addButton(p) +
      '</div></article>';
  }).join('') + '</div>';
}

/**
 * מחלקת מוצרי עישון — פרטים בסיסיים בלבד.
 * תמונה ותיאור נשלטים במתגים ייעודיים במחלקה, כבויים כברירת מחדל.
 */
function renderRestricted(d, products) {
  const warning =
    '<div class="legal-warning" role="note">' +
      '<strong>' + esc(data.settings.smokingWarning) + '</strong>' +
      '<span>' + esc(data.settings.ageNotice) + '</span>' +
    '</div>';

  if (!products.length) return warning + '<div class="empty-state">אין כרגע מוצרים במחלקה הזו.</div>';

  const rows = products.map(p => {
    let extra = '';
    if (d.showImages === true && p.image) {
      extra += '<div class="plain-row__extra"><img src="' + esc(p.image) + '" alt="' +
               esc(p.imageAlt || p.name) + '" loading="lazy" decoding="async"></div>';
    }
    if (d.showDescriptions === true && p.description) {
      extra += '<div class="plain-row__extra"><p>' + esc(p.description) + '</p></div>';
    }
    return '<div class="plain-row">' +
      '<div class="plain-row__name">' + esc(p.name) + '</div>' +
      '<div class="plain-row__price">' + esc(money(p.price)) + '</div>' +
      '<div class="plain-row__stock">' + esc(stockLabel(p.stock)) + '</div>' +
      '<div class="plain-row__add">' + addButton(p, true) + '</div>' + extra +
    '</div>';
  }).join('');

  return warning +
    '<div class="plain-list reveal">' +
      '<div class="plain-list__head" aria-hidden="true">' +
        '<div>שם המוצר</div><div>מחיר</div><div>זמינות</div></div>' + rows +
    '</div>' +
    '<p class="plain-note">' + esc(data.settings.vatNotice) +
    ' הרשימה היא פירוט פרטים בסיסיים בלבד של מוצרים המוצעים למכירה, ואינה פרסומת.</p>';
}

/* ===================== מידע ותחתית ===================== */

function renderInfo() {
  document.getElementById('page-about').textContent = data.pages.about;

  document.getElementById('biz-facts').innerHTML =
    [['שם העוסק', biz.legalName], ['מספר עוסק או חברה', biz.businessId],
     ['כתובת', biz.address], ['שעות פעילות', biz.hours],
     ['וואטסאפ', biz.whatsappDisplay]]
      .filter(([, v]) => v)
      .map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');

  const docs = [
    ['תקנון האתר', data.pages.terms],
    ['מדיניות משלוחים', data.pages.shipping],
    ['ביטול והחזרה', data.pages.returns],
    ['מדיניות פרטיות', data.pages.privacy],
    ['הצהרת נגישות', data.pages.accessibility + ' רכז הנגישות: ' +
      biz.accessibilityOfficer + '. ' + biz.accessibilityContact]
  ];
  document.getElementById('legal-docs').innerHTML = docs.map(([t, b]) =>
    '<details><summary>' + esc(t) + '</summary><p>' + esc(b) + '</p></details>').join('');

  const hasRestricted = depts.some(d => d.restricted);
  const fw = document.getElementById('footer-warning');
  fw.hidden = !hasRestricted;
  fw.textContent = data.settings.smokingWarning;

  document.getElementById('footer-biz').textContent =
    biz.legalName + ' · ' + biz.businessId + ' · ' + biz.address;
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  const fl = document.getElementById('footer-wa');
  fl.href = waLink(biz.whatsapp, orderText());
  fl.textContent = biz.whatsappDisplay;
}

/* ===================== שער גיל ===================== */

function initAgeGate() {
  const gate = document.getElementById('age-gate');
  const needed = data.settings.ageGate && depts.some(d => d.restricted);
  if (!needed || localStorage.getItem(Store.keys.GATE_KEY) === 'ok') { gate.hidden = true; return; }

  gate.hidden = false;
  document.body.style.overflow = 'hidden';
  document.getElementById('gate-yes').focus();

  document.getElementById('gate-yes').addEventListener('click', () => {
    localStorage.setItem(Store.keys.GATE_KEY, 'ok');
    gate.hidden = true;
    document.body.style.overflow = '';
  });
  document.getElementById('gate-no').addEventListener('click', () => {
    document.getElementById('gate-body').innerHTML =
      '<h2>הכניסה אינה אפשרית</h2><p>האתר כולל מחלקות של מוצרי טבק ועישון, ' +
      'שהמכירה בהן אסורה מתחת לגיל 18.</p>';
  });
}

/* ===================== מתג צמצום תנועה ===================== */

function initMotionToggle() {
  const btn = document.getElementById('motion-toggle');
  const on = localStorage.getItem(Store.keys.MOTION_KEY) === '1';
  document.body.classList.toggle('no-motion', on);
  btn.textContent = on ? 'הפעלת אנימציות' : 'צמצום אנימציות';
  btn.setAttribute('aria-pressed', String(on));
  btn.addEventListener('click', () => {
    localStorage.setItem(Store.keys.MOTION_KEY, on ? '0' : '1');
    location.reload();
  });
}

/* ===================== הרצה ===================== */

renderShell();
renderTabs();
renderInfo();
initAgeGate();
initMotionToggle();

// קישור עמוק: כתובת עם עוגן פותחת ישירות את המחלקה המבוקשת
const wanted = location.hash.replace('#', '');
if (wanted && document.getElementById('panel-' + wanted)) selectTab(wanted, false);
else {
  // גם הלשונית הראשונה נחשפת ישירות, כדי שהתוכן לעולם לא יהיה תלוי במשקיף
  const first = document.querySelector('.dept-panel:not([hidden])');
  if (first) first.querySelectorAll('.reveal').forEach(el => el.classList.add('is-revealed'));
}

document.querySelectorAll('[data-scroll-to]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToTarget(document.querySelector(a.getAttribute('data-scroll-to')));
  });
});

revealHeadline(document.getElementById('hero-title'), [
  esc(data.hero.titleA),
  '<span class="grad">' + esc(data.hero.titleB) + '</span>',
  esc(data.hero.titleC)
]);

initCart(data);
initScroll();
initReveals();
initHero({
  canvas: document.getElementById('hero-canvas'),
  stage:  document.getElementById('hero-stage'),
  track:  document.getElementById('strip-track'),
  bg:     document.getElementById('bg-layer'),
  columns: depts.length || 5
});

if (motionReduced()) document.documentElement.setAttribute('data-motion', 'reduced');
