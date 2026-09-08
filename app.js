/**
 * app.js — הרכבת חזית החנות מתוך הנתונים.
 *
 * שלוש הבחנות שקובעות את המבנה:
 *  1. מחלקה עם restricted מקבלת תבנית אחרת לגמרי — רשימה טקסטואלית
 *     של שם, מחיר וזמינות. בלי תיאור שיווקי ובלי תגי מבצע. תמונה
 *     ותיאור אפשריים רק אם בעל האתר הדליק אותם באותה מחלקה.
 *  2. מוצר שאזל יורד לתחתית הרשימה ומסומן באדום, בשתי התבניות.
 *  3. לכל מוצר מערך תמונות. אחת מציגה תמונה בודדת, יותר מאחת מציגה
 *     גלריה עם תמונות ממוזערות. המשתמש קובע כמה, הקוד לא מניח דבר.
 */

import { Store, money, stockLabel, waLink, esc, imagesOf, isOut, displayOrder } from './store.js';
import { initCart, cartRefresh } from './cart.js';
import { $, lockScroll, unlockScroll, anyOverlayOpen } from './ui.js';

/** לוגו וואטסאפ, בשימוש בכפתור הצף ובכל כפתורי ההזמנה. */
const WA_ICON =
  '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">' +
  '<path d="M16.02 3C8.85 3 3.03 8.82 3.03 15.99c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.74a12.9 12.9 0 0 0 6.34 1.63h.01C23.2 28.89 29 23.07 29 15.9 29 12.43 27.65 9.17 25.2 6.72A12.87 12.87 0 0 0 16.02 3Zm7.55 18.44c-.32.9-1.87 1.72-2.6 1.83-.66.1-1.5.14-2.42-.15-.56-.18-1.28-.41-2.2-.81-3.87-1.67-6.4-5.57-6.6-5.83-.19-.26-1.57-2.09-1.57-3.99 0-1.9 1-2.83 1.35-3.22.36-.39.78-.49 1.04-.49h.75c.24.01.56-.09.88.67.32.78 1.1 2.69 1.2 2.88.1.2.16.42.03.68-.13.26-.19.42-.38.65-.19.23-.4.5-.57.68-.19.19-.39.4-.17.78.22.39.98 1.62 2.11 2.62 1.45 1.29 2.67 1.69 3.05 1.88.38.19.6.16.82-.1.23-.26.95-1.1 1.2-1.48.25-.39.5-.32.85-.19.35.13 2.22 1.05 2.6 1.24.38.19.64.29.73.45.1.16.1.93-.22 1.83Z"/></svg>';

const data  = Store.load();
const depts = Store.sortedDepartments(data);
const biz   = data.business;


/* ===================== עזרים ===================== */

function orderText(deptName, productName) {
  let t = 'שלום, אשמח להזמין';
  if (productName) t += ': ' + productName;
  if (deptName) t += ' (' + deptName + ')';
  return t;
}

function slugOf(d) { return d.id.replace(/[^a-z0-9_-]/gi, ''); }

function stockLine(p) {
  const cls = p.stock === 'out' ? 'out' : p.stock === 'low' ? 'low' : 'in';
  return '<span class="stock-line stock-line--' + cls + '">' + esc(stockLabel(p.stock)) + '</span>';
}

function priceHtml(p) {
  let h = '<div class="card__price">' + esc(money(p.price));
  if (p.prevPrice && Number(p.prevPrice) > Number(p.price)) {
    h += '<s>' + esc(money(p.prevPrice)) + '</s>';
  }
  return h + '</div>';
}

function addButton(p, plain) {
  const cls = plain ? 'btn btn--out btn--sm' : 'btn btn--sm btn--block';
  if (isOut(p)) return '<button class="' + cls + '" type="button" disabled>אזל מהמלאי</button>';
  return '<button class="' + cls + '" type="button" data-add="' + esc(p.id) + '">הוספה לסל</button>';
}

/**
 * גלריית תמונות. מספר התמונות נקבע לפי מה שהוזן בפאנל:
 * אחת מציגה רק אותה, יותר מאחת מוסיפה שורת ממוזערות להחלפה.
 */
function galleryHtml(p) {
  const imgs = imagesOf(p);
  if (!imgs.length) return '<div class="gallery__empty">אין תמונה</div>';

  const alt = p.imageAlt || p.name;
  // referrerpolicy נדרש כי שרת התמונות חוסם בקשות שמגיעות עם מפנה זר,
  // וזו הסיבה שהתמונות הופיעו שבורות. onerror מסיר תמונה שנכשלה,
  // והממלא נכנס במקומה דרך הסגנון, בלי טקסט חלופי ענק שמעוות את הקוביה.
  let h = '<div class="gallery" data-gallery="' + esc(p.id) + '">' +
    '<div class="gallery__main"><img src="' + esc(imgs[0]) + '" alt="' + esc(alt) +
    '" loading="lazy" decoding="async" referrerpolicy="no-referrer"' +
    ' onerror="this.remove()"></div>';

  if (imgs.length > 1) {
    h += '<div class="gallery__thumbs">' + imgs.map((src, i) =>
      '<button class="gallery__thumb" type="button" data-src="' + esc(src) + '"' +
      ' aria-current="' + (i === 0) + '" aria-label="תמונה ' + (i + 1) + ' מתוך ' + imgs.length + '">' +
      '<img src="' + esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
      ' onerror="this.parentElement.remove()"></button>').join('') + '</div>';
  }
  return h + '</div>';
}

/* ===================== מעטפת ===================== */

function renderShell() {
  document.title = biz.name + ' — ' + biz.tagline;
  $('brand-mark').textContent = biz.name.trim().charAt(0) || 'ח';
  $('brand-name').textContent = biz.name;
  $('brand-sub').textContent  = biz.tagline;
  $('top-hours').textContent  = biz.hours || '';
  $('top-phone').textContent  = 'וואטסאפ ' + biz.whatsappDisplay;

  $('hero-title').textContent = biz.name;
  $('hero-lead').textContent  = data.hero.lead;

  const wa = waLink(biz.whatsapp, orderText());
  ['hero-cta-2', 'wa-fab', 'footer-wa', 'menu-wa'].forEach(id => { if ($(id)) $(id).href = wa; });
  $('footer-wa').textContent = biz.whatsappDisplay;
  $('wa-fab').innerHTML = WA_ICON + '<span class="visually-hidden">שיחה בוואטסאפ</span>';
  $('menu-wa').innerHTML = WA_ICON + '<span>הזמנה בוואטסאפ</span>';
  $('hero-cta-2').innerHTML = WA_ICON + '<span>הזמנה בוואטסאפ</span>';

  // פס הניווט החום: כפתור הקטגוריות ואחריו חמש המחלקות הראשונות
  $('quicknav').innerHTML =
    '<button type="button" data-open-menu>לכל הקטגוריות</button>' +
    depts.slice(0, 5).map(d =>
      '<button type="button" data-goto="' + slugOf(d) + '">' + esc(d.name) + '</button>').join('');

  // תפריט הצד: כל המחלקות, עם מספר הפריטים בכל אחת
  $('menu-list').innerHTML = depts.map(d => {
    const n = Store.productsOf(data, d.id).length;
    return '<button class="drawer__link" type="button" data-goto="' + slugOf(d) + '">' +
      '<span>' + esc(d.name) + (d.restricted ? ' <span class="flag">18+</span>' : '') + '</span>' +
      '<span class="n">' + n + '</span></button>';
  }).join('');
}

/* ===================== מחלקות ===================== */

function renderTabs() {
  if (!depts.length) {
    $('dept-panels').innerHTML = '<div class="empty-state">עדיין לא הוגדרו מחלקות.</div>';
    return;
  }
  $('dept-tabs').innerHTML = depts.map((d, i) =>
    '<button class="dept-tab" role="tab" type="button" id="tab-' + slugOf(d) + '"' +
    ' aria-controls="panel-' + slugOf(d) + '" aria-selected="' + (i === 0) + '"' +
    ' tabindex="' + (i === 0 ? 0 : -1) + '">' + esc(d.name) +
    (d.restricted ? '<span class="dept-tab__flag">18+</span>' : '') + '</button>').join('');

  $('dept-panels').innerHTML = depts.map((d, i) =>
    '<section class="dept-panel" role="tabpanel" id="panel-' + slugOf(d) + '"' +
    ' aria-labelledby="tab-' + slugOf(d) + '" tabindex="0"' + (i === 0 ? '' : ' hidden') + '>' +
    renderDept(d) + '</section>').join('');

  $('dept-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.dept-tab');
    if (b) selectTab(b.id.replace('tab-', ''), true);
  });

  // ניווט מקלדת לפי דפוס ה-tablist. בממשק מימין לשמאל חץ שמאלה מתקדם.
  $('dept-tabs').addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const all = [...$('dept-tabs').querySelectorAll('.dept-tab')];
    const cur = all.findIndex(b => b.getAttribute('aria-selected') === 'true');
    let n = cur;
    if (e.key === 'ArrowLeft')  n = (cur + 1) % all.length;
    if (e.key === 'ArrowRight') n = (cur - 1 + all.length) % all.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End')  n = all.length - 1;
    const id = all[n].id.replace('tab-', '');
    selectTab(id, true);
    $('tab-' + id).focus();
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
  closeResults();
}

function renderDept(d) {
  const products = displayOrder(Store.productsOf(data, d.id));
  const head = '<header class="dept-head"><h2>' + esc(d.name) + '</h2>' +
    (d.intro && !d.restricted ? '<p>' + esc(d.intro) + '</p>' : '') + '</header>';
  const body = d.restricted ? renderRestricted(d, products) : renderVisual(d, products);
  const order = '<div class="dept-order">' +
    '<p>' + esc(data.settings.vatNotice) + ' הזמנות בוואטסאפ ' + esc(biz.whatsappDisplay) + '.</p>' +
    '<a class="btn btn--green btn--sm" href="' + waLink(biz.whatsapp, orderText(d.name)) +
    '" target="_blank" rel="noopener">' + WA_ICON + '<span>הזמנה בוואטסאפ</span></a></div>';
  return head + body + order;
}

/**
 * קוביית מוצר. plain מסמן גרסה יבשה למחלקת מוצרי עישון: אותו מבנה,
 * בלי תגי מבצע ובלי הדגשות, כדי שלא תיקרא כפרסומת.
 */
function cardHtml(p, dept, plain) {
  const showImg = dept.showImages !== false;
  const media = showImg ? galleryHtml(p) : '<div class="gallery__empty"></div>';
  const showDesc = plain ? dept.showDescriptions === true : dept.showDescriptions !== false;
  const deal = (!plain && p.prevPrice && Number(p.prevPrice) > Number(p.price))
    ? '<p class="card__note">מבצע</p>' : '';

  return '<article class="card' + (plain ? ' card--plain' : '') +
    (isOut(p) ? ' card--out' : '') + '">' + media +
    '<div class="card__body">' +
      '<h3 class="card__name">' + esc(p.name) + '</h3>' +
      (showDesc && p.description ? '<p class="card__desc">' + esc(p.description) + '</p>' : '') +
      deal +
      priceHtml(p) +
      (isOut(p) ? '<div class="out-banner">אזל זמנית מהמלאי</div>' : stockLine(p)) +
      addButton(p) +
    '</div></article>';
}

/** מחלקה רגילה — קוביות מלאות. */
function renderVisual(d, products) {
  if (!products.length) return '<div class="empty-state">אין כרגע מוצרים במחלקה הזו.</div>';
  return '<div class="product-grid">' +
    products.map(p => cardHtml(p, d, false)).join('') + '</div>';
}

/**
 * מחלקת מוצרי עישון — אותה פריסה, בגרסה היבשה.
 * האזהרה הסטטוטורית נשארת בראש המחלקה, וההערה בסופה.
 */
function renderRestricted(d, products) {
  const warning = '<div class="legal-warning" role="note">' +
    '<strong>' + esc(data.settings.smokingWarning) + '</strong>' +
    '<span>' + esc(data.settings.ageNotice) + '</span></div>';

  if (!products.length) return warning + '<div class="empty-state">אין כרגע מוצרים במחלקה הזו.</div>';

  return warning + '<div class="product-grid">' +
    products.map(p => cardHtml(p, d, true)).join('') + '</div>' +
    '<p class="plain-note">' + esc(data.settings.vatNotice) +
    ' הרשימה היא פירוט פרטים בסיסיים בלבד של מוצרים המוצעים למכירה, ואינה פרסומת.</p>';
}

/* ===================== חיפוש ===================== */

/**
 * נרמול לחיפוש: הסרת ניקוד, גרשיים ומקפים, וכיווץ רווחים.
 * בלי זה "סיגריות" ו"סיגריות־אלקטרוניות" לא נחשבים דומים.
 */
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/["'`\u05F3\u05F4\u2019\-־–—/|]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/**
 * התאמה גמישה: נחשב מתאים אם המונח פותח את הטקסט, פותח אחת המילים
 * שבו, או מופיע בתוכו. כך "סיג" מוצא גם סיגריות וגם סיגריות אלקטרוניות.
 */
function matches(text, q) {
  const t = norm(text);
  if (!q) return false;
  if (t.startsWith(q)) return true;
  if (t.split(' ').some(w => w.startsWith(q))) return true;
  return t.includes(q);
}

function search(term) {
  const q = norm(term);
  if (q.length < 2) return { depts: [], products: [] };
  const dm = depts.filter(d => matches(d.name, q));
  const pm = data.products.filter(p => matches(p.name, q) || matches(p.description, q));
  return { depts: dm, products: displayOrder(pm) };
}

function deptName(id) {
  const d = depts.find(x => x.id === id);
  return d ? d.name : '';
}

function renderSuggest(term) {
  const box = $('search-suggest');
  const { depts: dm, products: pm } = search(term);
  if (!dm.length && !pm.length) { box.hidden = true; return; }

  const rows = dm.slice(0, 6).map(d =>
      '<button type="button" data-goto="' + slugOf(d) + '">' +
      '<span>' + esc(d.name) + '</span><span class="kind">מחלקה</span></button>').join('')
    + pm.slice(0, 8).map(p => {
      const img = imagesOf(p)[0];
      return '<button type="button" data-find="' + esc(p.name) + '">' +
        (img ? '<img src="' + esc(img) + '" alt="">' : '') +
        '<span>' + esc(p.name) + '</span>' +
        '<span class="kind">' + esc(deptName(p.deptId)) + '</span></button>';
    }).join('');

  box.innerHTML = rows;
  box.hidden = false;
}

function showResults(term) {
  const { depts: dm, products: pm } = search(term);
  $('search-suggest').hidden = true;
  $('results-title').textContent = 'תוצאות חיפוש עבור ' + term + ' — ' + pm.length + ' מוצרים';

  if (!pm.length && !dm.length) {
    $('results-body').innerHTML = '<div class="empty-state">לא נמצאו תוצאות.</div>';
  } else {
    const chips = dm.length
      ? '<p class="section__lead">מחלקות מתאימות: ' + dm.map(d =>
          '<button class="btn btn--out btn--sm" type="button" data-goto="' + slugOf(d) + '">' +
          esc(d.name) + '</button>').join(' ') + '</p>'
      : '';
    $('results-body').innerHTML = chips + '<div class="product-grid">' + pm.map(p => {
      const d = depts.find(x => x.id === p.deptId) || {};
      return cardHtml(p, d, !!d.restricted);
    }).join('') + '</div>';
  }

  $('results-section').hidden = false;
  $('results-section').scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function closeResults() { $('results-section').hidden = true; }

function initSearch() {
  const bar = $('searchbar'), input = $('search-input'), box = $('search-suggest');

  $('search-open').addEventListener('click', () => {
    const open = bar.hidden;
    bar.hidden = !open;
    $('search-open').setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  });
  $('search-close').addEventListener('click', () => {
    bar.hidden = true; box.hidden = true; input.value = ''; closeResults();
    $('search-open').setAttribute('aria-expanded', 'false');
  });

  input.addEventListener('input', () => renderSuggest(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); showResults(input.value.trim()); }
    if (e.key === 'Escape') { box.hidden = true; }
  });

  box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-find]');
    if (b) { input.value = b.dataset.find; showResults(b.dataset.find); }
  });

  document.addEventListener('click', (e) => {
    if (!bar.hidden && !bar.contains(e.target) && e.target !== $('search-open')) box.hidden = true;
  });
}

/* ===================== תפריט הצד ===================== */

function initMenu() {
  const drawer = $('menu-drawer');
  const open  = () => { drawer.hidden = false; lockScroll(); $('menu-close').focus(); };
  const close = () => { drawer.hidden = true; if (!anyOverlayOpen()) unlockScroll(); $('menu-open').focus(); };

  $('menu-open').addEventListener('click', open);
  $('menu-close').addEventListener('click', close);
  $('menu-back').addEventListener('click', close);
  $('hero-cta-1').addEventListener('click', open);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) close(); });

  // מאזין אחד לכל כפתורי המעבר למחלקה, מכל מקום באתר
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-menu]');
    if (b) { open(); return; }
    const g = e.target.closest('[data-goto]');
    if (!g) return;
    selectTab(g.dataset.goto, true);
    drawer.hidden = true;
    $('searchbar').hidden = true;
    $('search-suggest').hidden = true;
    if (!anyOverlayOpen()) unlockScroll();
    const panel = $('panel-' + g.dataset.goto);
    if (panel) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
}

/* ===================== גלריות ===================== */

function initGalleries() {
  document.addEventListener('click', (e) => {
    const th = e.target.closest('.gallery__thumb');
    if (!th) return;
    const g = th.closest('.gallery');
    g.querySelector('.gallery__main img').src = th.dataset.src;
    g.querySelectorAll('.gallery__thumb').forEach(x => x.setAttribute('aria-current', String(x === th)));
  });
}

/* ===================== מידע, שער גיל, נגישות ===================== */

function renderInfo() {
  $('page-about').textContent = data.pages.about;
  $('biz-facts').innerHTML = [
    ['שם העוסק', biz.legalName], ['מספר עוסק או חברה', biz.businessId],
    ['כתובת', biz.address], ['שעות פעילות', biz.hours], ['וואטסאפ', biz.whatsappDisplay]
  ].filter(([, v]) => v).map(([k, v]) =>
    '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');

  $('legal-docs').innerHTML = [
    ['תקנון האתר', data.pages.terms],
    ['מדיניות משלוחים', data.pages.shipping],
    ['ביטול והחזרה', data.pages.returns],
    ['מדיניות פרטיות', data.pages.privacy],
    ['הצהרת נגישות', data.pages.accessibility + ' רכז הנגישות: ' +
      biz.accessibilityOfficer + '. ' + biz.accessibilityContact]
  ].map(([t, b]) => '<details><summary>' + esc(t) + '</summary><p>' + esc(b) + '</p></details>').join('');

  const fw = $('footer-warning');
  fw.hidden = !depts.some(d => d.restricted);
  fw.textContent = data.settings.smokingWarning;
  $('footer-biz').textContent = biz.legalName + ' · ' + biz.businessId + ' · ' + biz.address;
  $('footer-year').textContent = new Date().getFullYear();
}

function initAgeGate() {
  const gate = $('age-gate');
  const needed = data.settings.ageGate && depts.some(d => d.restricted);
  if (!needed || localStorage.getItem(Store.keys.GATE_KEY) === 'ok') { gate.hidden = true; return; }
  gate.hidden = false;
  lockScroll();
  $('gate-yes').focus();
  $('gate-yes').addEventListener('click', () => {
    localStorage.setItem(Store.keys.GATE_KEY, 'ok');
    gate.hidden = true;
    if (!anyOverlayOpen()) unlockScroll();
  });
  $('gate-no').addEventListener('click', () => {
    $('gate-body').innerHTML = '<h2>הכניסה אינה אפשרית</h2>' +
      '<p>האתר כולל מחלקות של מוצרי טבק ועישון, שהמכירה בהן אסורה מתחת לגיל 18.</p>';
  });
}

/** הגדלת טקסט פשוטה, כמו בכפתור הנגישות שבאתרים מסחריים. */
function initA11y() {
  let step = 0;
  $('a11y-fab').addEventListener('click', () => {
    step = (step + 1) % 3;
    document.documentElement.style.fontSize = [16, 18, 20][step] + 'px';
  });
}

/* ===================== הרצה ===================== */

renderShell();
renderTabs();
renderInfo();
initAgeGate();
initSearch();
initMenu();
initGalleries();
initA11y();
initCart(data);

const wanted = location.hash.replace('#', '');
if (wanted && $('panel-' + wanted)) selectTab(wanted, false);

cartRefresh();
