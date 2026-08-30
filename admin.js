/**
 * admin.js — פאנל הניהול.
 *
 * הכלל שמנחה את כל המסך: שדה התמונה, הטקסט החלופי והתיאור קיימים תמיד,
 * בכל מוצר, גם במחלקה שסומנה כמחלקת מוצרי עישון, והם נשמרים כרגיל.
 * ההחלטה אם הם נראים באתר עוברת דרך שני מתגים ברמת המחלקה, שכבויים
 * כברירת מחדל ומלווים באזהרה.
 */

import { Store, money, stockLabel, esc } from './store.js';

let data = Store.load();
const $ = (id) => document.getElementById(id);

/* ===================== עזרים ===================== */

function persist(message) { Store.save(data); toast(message || 'נשמר'); }

let toastTimer;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

function deptById(id) { return data.departments.find(d => d.id === id); }

/* ===================== לשוניות הפאנל ===================== */

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
  });
});

/* ===================== חלון עריכה ===================== */

let modalSaveHandler = null, lastFocused = null;

function openModal(title, bodyHtml, onSave) {
  lastFocused = document.activeElement;
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHtml;
  modalSaveHandler = onSave;
  $('modal').hidden = false;
  const first = $('modal-body').querySelector('input, select, textarea');
  if (first) first.focus();
}

function closeModal() {
  $('modal').hidden = true;
  modalSaveHandler = null;
  if (lastFocused) lastFocused.focus();
}

$('modal-close').addEventListener('click', closeModal);
$('modal-cancel').addEventListener('click', closeModal);
$('modal-save').addEventListener('click', () => { if (modalSaveHandler) modalSaveHandler(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

function field(id, label, value, opts = {}) {
  const type = opts.type || 'text';
  const hint = opts.hint ? '<p class="hint">' + esc(opts.hint) + '</p>' : '';
  if (type === 'textarea') {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' +
           '<textarea id="' + id + '">' + esc(value || '') + '</textarea>' + hint + '</div>';
  }
  if (type === 'select') {
    const options = opts.options.map(o =>
      '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' +
      esc(o[1]) + '</option>').join('');
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' +
           '<select id="' + id + '">' + options + '</select>' + hint + '</div>';
  }
  return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' +
         '<input id="' + id + '" type="' + type + '" value="' + esc(value == null ? '' : value) + '"' +
         (opts.step ? ' step="' + opts.step + '"' : '') + '>' + hint + '</div>';
}

function check(id, label, checked, hint) {
  return '<label class="check" for="' + id + '">' +
    '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
    '<span>' + esc(label) + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span></label>';
}

/* ===================== מחלקות ===================== */

function renderDepts() {
  const list = Store.sortedDepartments(data);
  $('dept-list').innerHTML = list.map((d, i) => {
    const count = data.products.filter(p => p.deptId === d.id).length;
    const flags = d.restricted
      ? '<span class="tag tag--restricted">מחלקת מוצרי עישון</span>' +
        '<span class="tag">' + (d.showImages ? 'תמונות מוצגות' : 'תמונות מוסתרות') + '</span>' +
        '<span class="tag">' + (d.showDescriptions ? 'תיאורים מוצגים' : 'תיאורים מוסתרים') + '</span>'
      : '<span class="tag tag--open">מחלקה רגילה</span>';

    return '<div class="admin-row" data-id="' + d.id + '">' +
      '<div class="admin-row__main">' +
        '<span class="admin-row__title">' + esc(d.name) + '</span>' + flags +
        '<span class="admin-row__meta">' + count + ' מוצרים</span></div>' +
      '<div class="admin-row__acts">' +
        '<button class="btn btn--quiet btn--sm" data-act="up" ' + (i === 0 ? 'disabled' : '') + ' type="button">העלאה בסדר</button>' +
        '<button class="btn btn--quiet btn--sm" data-act="down" ' + (i === list.length - 1 ? 'disabled' : '') + ' type="button">הורדה בסדר</button>' +
        '<button class="btn btn--soft btn--sm" data-act="edit" type="button">עריכה</button>' +
        '<button class="btn btn--danger btn--sm" data-act="del" type="button">מחיקה</button>' +
      '</div></div>';
  }).join('');
}

$('dept-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.admin-row').dataset.id;
  const act = btn.dataset.act;

  if (act === 'up' || act === 'down') {
    const list = Store.sortedDepartments(data);
    const i = list.findIndex(d => d.id === id);
    const j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    const a = list[i].order, b = list[j].order;
    list[i].order = b; list[j].order = a;
    persist('סדר המחלקות עודכן');
    renderDepts(); refreshDeptSelect();
  }

  if (act === 'del') {
    const d = deptById(id);
    const n = data.products.filter(p => p.deptId === id).length;
    if (!confirm('למחוק את המחלקה "' + d.name + '" ואת ' + n + ' המוצרים שבה?')) return;
    data.departments = data.departments.filter(x => x.id !== id);
    data.products = data.products.filter(p => p.deptId !== id);
    persist('המחלקה נמחקה');
    renderDepts(); refreshDeptSelect();
  }

  if (act === 'edit') editDept(deptById(id));
});

$('act-add-dept').addEventListener('click', () => {
  const maxOrder = data.departments.reduce((m, d) => Math.max(m, d.order || 0), 0);
  editDept({ id: Store.uid('dep'), name: '', order: maxOrder + 1, restricted: false,
             showImages: true, showDescriptions: true, intro: '' }, true);
});

function editDept(dept, isNew) {
  const body =
    field('f-name', 'שם המחלקה', dept.name) +
    field('f-intro', 'טקסט פתיחה למחלקה', dept.intro,
      { type: 'textarea', hint: 'מוצג רק במחלקה רגילה. במחלקת מוצרי עישון הוא לא יוצג באתר.' }) +
    check('f-restricted', 'זו מחלקת מוצרי טבק או עישון', dept.restricted,
      'הסימון מחליף את התבנית לרשימה יבשה ומכבה אנימציות על הפריטים.') +
    '<div class="callout callout--warn" id="restricted-note"' + (dept.restricted ? '' : ' hidden') + '>' +
      '<strong>שני המתגים הבאים פתוחים לשימושך</strong>' +
      'החוק מגביל מאוד הצגת תמונות ותיאורים של מוצרי עישון באינטרנט. ' +
      'המערכת משאירה לך את השליטה, אבל ברירת המחדל היא כיבוי.</div>' +
    check('f-images', 'הצגת תמונות המוצרים באתר', dept.showImages !== false) +
    check('f-desc', 'הצגת תיאורי המוצרים באתר', dept.showDescriptions !== false);

  openModal(isNew ? 'מחלקה חדשה' : 'עריכת מחלקה', body, () => {
    const name = $('f-name').value.trim();
    if (!name) { toast('צריך שם למחלקה'); $('f-name').focus(); return; }
    dept.name = name;
    dept.intro = $('f-intro').value.trim();
    dept.restricted = $('f-restricted').checked;
    dept.showImages = $('f-images').checked;
    dept.showDescriptions = $('f-desc').checked;
    if (isNew) data.departments.push(dept);
    persist(isNew ? 'המחלקה נוספה' : 'המחלקה עודכנה');
    closeModal(); renderDepts(); refreshDeptSelect();
  });

  // סימון כמחלקת עישון מכבה את שני המתגים ומציף את האזהרה
  $('f-restricted').addEventListener('change', (e) => {
    $('restricted-note').hidden = !e.target.checked;
    if (e.target.checked) { $('f-images').checked = false; $('f-desc').checked = false; }
  });
}

/* ===================== מוצרים ===================== */

function refreshDeptSelect() {
  const sel = $('prod-dept');
  const cur = sel.value;
  const list = Store.sortedDepartments(data);
  sel.innerHTML = list.map(d => '<option value="' + esc(d.id) + '">' + esc(d.name) + '</option>').join('');
  if (list.some(d => d.id === cur)) sel.value = cur;
  renderProducts();
}

function renderProducts() {
  const deptId = $('prod-dept').value;
  const dept = deptById(deptId);
  const ctx = $('prod-context');

  if (!dept) { ctx.innerHTML = ''; $('prod-list').innerHTML = '<div class="empty-state">אין מחלקות.</div>'; return; }

  ctx.innerHTML = dept.restricted
    ? '<div class="callout callout--warn"><strong>מחלקת מוצרי עישון</strong>' +
      'שדות התמונה והתיאור פעילים כאן ונשמרים כרגיל. הצגתם באתר תלויה במתגים ' +
      'שבהגדרות המחלקה, וכרגע הם ' +
      (dept.showImages ? 'מדליקים תמונות' : 'מכבים תמונות') + ' ו' +
      (dept.showDescriptions ? 'מדליקים תיאורים' : 'מכבים תיאורים') + '.</div>'
    : '';

  const list = Store.productsOf(data, deptId);
  if (!list.length) { $('prod-list').innerHTML = '<div class="empty-state">אין עדיין מוצרים במחלקה הזו.</div>'; return; }

  $('prod-list').innerHTML = list.map((p, i) => {
    const deal = (p.prevPrice && Number(p.prevPrice) > Number(p.price))
      ? '<span class="tag tag--open">מבצע</span>' : '';
    const img = p.image ? '<span class="tag">יש תמונה</span>' : '';
    return '<div class="admin-row" data-id="' + p.id + '">' +
      '<div class="admin-row__main">' +
        '<span class="admin-row__title">' + esc(p.name) + '</span>' +
        '<span class="admin-row__meta">' + esc(money(p.price)) + ' · ' + esc(stockLabel(p.stock)) + '</span>' +
        deal + img + '</div>' +
      '<div class="admin-row__acts">' +
        '<button class="btn btn--quiet btn--sm" data-act="up" ' + (i === 0 ? 'disabled' : '') + ' type="button">העלאה בסדר</button>' +
        '<button class="btn btn--quiet btn--sm" data-act="down" ' + (i === list.length - 1 ? 'disabled' : '') + ' type="button">הורדה בסדר</button>' +
        '<button class="btn btn--soft btn--sm" data-act="edit" type="button">עריכה</button>' +
        '<button class="btn btn--danger btn--sm" data-act="del" type="button">מחיקה</button>' +
      '</div></div>';
  }).join('');
}

$('prod-dept').addEventListener('change', renderProducts);

$('prod-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.admin-row').dataset.id;
  const act = btn.dataset.act;
  const list = Store.productsOf(data, $('prod-dept').value);
  const prod = data.products.find(p => p.id === id);

  if (act === 'up' || act === 'down') {
    const i = list.findIndex(p => p.id === id);
    const j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    const a = list[i].order, b = list[j].order;
    list[i].order = b; list[j].order = a;
    persist('סדר המוצרים עודכן'); renderProducts();
  }

  if (act === 'del') {
    if (!confirm('למחוק את המוצר "' + prod.name + '"?')) return;
    data.products = data.products.filter(p => p.id !== id);
    persist('המוצר נמחק'); renderProducts();
  }

  if (act === 'edit') editProduct(prod);
});

$('act-add-prod').addEventListener('click', () => {
  const deptId = $('prod-dept').value;
  if (!deptId) { toast('צריך קודם להגדיר מחלקה'); return; }
  const maxOrder = Store.productsOf(data, deptId).reduce((m, p) => Math.max(m, p.order || 0), 0);
  editProduct({ id: Store.uid('prd'), deptId, name: '', price: 0, prevPrice: null,
                stock: 'in', image: '', imageAlt: '', description: '', order: maxOrder + 1 }, true);
});

function editProduct(prod, isNew) {
  const dept = deptById(prod.deptId);
  const note = dept && dept.restricted
    ? '<div class="callout callout--warn"><strong>מוצר במחלקת עישון</strong>' +
      'התמונה והתיאור נשמרים, אך יופיעו באתר רק אם המתגים המתאימים דולקים בהגדרות המחלקה.</div>'
    : '';

  const body = note +
    field('f-pname', 'שם המוצר', prod.name) +
    '<div class="form-grid form-grid--2">' +
      field('f-price', 'מחיר לצרכן, כולל מס ערך מוסף', prod.price, { type: 'number', step: '0.01' }) +
      field('f-prev', 'מחיר קודם, למבצע', prod.prevPrice == null ? '' : prod.prevPrice,
        { type: 'number', step: '0.01', hint: 'להשאיר ריק כשאין מבצע.' }) +
    '</div>' +
    field('f-stock', 'זמינות', prod.stock,
      { type: 'select', options: [['in', 'במלאי'], ['low', 'מלאי מוגבל'], ['out', 'אזל מהמלאי']] }) +
    field('f-image', 'כתובת התמונה', prod.image,
      { type: 'url', hint: 'שדה זמין בכל המחלקות, גם במחלקות מוצרי עישון. אפשר להשאיר ריק.' }) +
    field('f-alt', 'טקסט חלופי לתמונה', prod.imageAlt,
      { type: 'text', hint: 'חובה לנגישות כשיש תמונה. תיאור ענייני של מה שרואים.' }) +
    field('f-pdesc', 'תיאור המוצר', prod.description, { type: 'textarea' }) +
    field('f-pdept', 'מחלקה', prod.deptId,
      { type: 'select', options: Store.sortedDepartments(data).map(d => [d.id, d.name]) });

  openModal(isNew ? 'מוצר חדש' : 'עריכת מוצר', body, () => {
    const name = $('f-pname').value.trim();
    if (!name) { toast('צריך שם למוצר'); $('f-pname').focus(); return; }
    const image = $('f-image').value.trim();
    const alt = $('f-alt').value.trim();
    if (image && !alt) { toast('כשיש תמונה צריך גם טקסט חלופי'); $('f-alt').focus(); return; }

    prod.name = name;
    prod.price = Number($('f-price').value) || 0;
    const prev = $('f-prev').value.trim();
    prod.prevPrice = prev === '' ? null : Number(prev);
    prod.stock = $('f-stock').value;
    prod.image = image;
    prod.imageAlt = alt;
    prod.description = $('f-pdesc').value.trim();
    prod.deptId = $('f-pdept').value;

    if (isNew) data.products.push(prod);
    persist(isNew ? 'המוצר נוסף' : 'המוצר עודכן');
    closeModal(); renderProducts(); renderDepts();
  });
}

/* ===================== תוכן ופרטי עסק ===================== */

function renderContent() {
  const b = data.business, h = data.hero, p = data.pages;
  $('content-form').innerHTML =
    '<h2>פרטי העסק</h2>' +
    '<div class="form-grid form-grid--2">' +
      field('c-name', 'שם מסחרי', b.name) +
      field('c-tagline', 'תת כותרת', b.tagline) +
      field('c-legal', 'שם העוסק המלא', b.legalName) +
      field('c-bizid', 'מספר עוסק או חברה', b.businessId) +
      field('c-address', 'כתובת', b.address) +
      field('c-hours', 'שעות פעילות', b.hours) +
      field('c-wa', 'וואטסאפ לקישור', b.whatsapp,
        { hint: 'בפורמט בינלאומי ללא סימנים, לדוגמה 972505335323.' }) +
      field('c-wadisp', 'וואטסאפ לתצוגה', b.whatsappDisplay) +
      field('c-acco', 'רכז נגישות', b.accessibilityOfficer) +
      field('c-accc', 'דרך יצירת קשר עם רכז הנגישות', b.accessibilityContact) +
    '</div>' +

    '<h2>מסך הפתיחה</h2>' +
    field('c-eyebrow', 'שורה עליונה', h.eyebrow) +
    '<div class="form-grid form-grid--2">' +
      field('c-ta', 'כותרת, חלק ראשון', h.titleA) +
      field('c-tb', 'כותרת, המילה הצבועה', h.titleB) +
    '</div>' +
    field('c-tc', 'כותרת, חלק אחרון', h.titleC) +
    field('c-lead', 'פסקת פתיחה', h.lead, { type: 'textarea' }) +
    '<div class="form-grid form-grid--2">' +
      field('c-cta1', 'כפתור ראשי', h.ctaPrimary) +
      field('c-cta2', 'כפתור משני', h.ctaSecondary) +
    '</div>' +

    '<h2>עמודי מידע</h2>' +
    field('c-about', 'על העסק', p.about, { type: 'textarea' }) +
    field('c-terms', 'תקנון', p.terms, { type: 'textarea' }) +
    field('c-shipping', 'משלוחים', p.shipping, { type: 'textarea' }) +
    field('c-returns', 'ביטול והחזרה', p.returns, { type: 'textarea' }) +
    field('c-privacy', 'פרטיות', p.privacy, { type: 'textarea' }) +
    field('c-access', 'הצהרת נגישות', p.accessibility, { type: 'textarea' });
}

$('act-save-content').addEventListener('click', () => {
  const g = (id) => $(id).value.trim();
  Object.assign(data.business, {
    name: g('c-name'), tagline: g('c-tagline'), legalName: g('c-legal'),
    businessId: g('c-bizid'), address: g('c-address'), hours: g('c-hours'),
    whatsapp: g('c-wa'), whatsappDisplay: g('c-wadisp'),
    accessibilityOfficer: g('c-acco'), accessibilityContact: g('c-accc')
  });
  Object.assign(data.hero, {
    eyebrow: g('c-eyebrow'), titleA: g('c-ta'), titleB: g('c-tb'), titleC: g('c-tc'),
    lead: g('c-lead'), ctaPrimary: g('c-cta1'), ctaSecondary: g('c-cta2')
  });
  Object.assign(data.pages, {
    about: g('c-about'), terms: g('c-terms'), shipping: g('c-shipping'),
    returns: g('c-returns'), privacy: g('c-privacy'), accessibility: g('c-access')
  });
  persist('התוכן נשמר');
});

/* ===================== הגדרות וגיבוי ===================== */

function renderSettings() {
  const s = data.settings;
  $('settings-form').innerHTML =
    field('s-warn', 'נוסח האזהרה הסטטוטורית', s.smokingWarning,
      { hint: 'מוצג בראש כל מחלקת עישון ובכותרת התחתונה.' }) +
    field('s-age', 'הודעת הגיל', s.ageNotice, { type: 'textarea' }) +
    field('s-vat', 'הודעת מס ערך מוסף', s.vatNotice) +
    check('s-gate', 'הצגת שער אישור גיל בכניסה לאתר', s.ageGate !== false);
}

$('act-save-settings').addEventListener('click', () => {
  data.settings.smokingWarning = $('s-warn').value.trim();
  data.settings.ageNotice = $('s-age').value.trim();
  data.settings.vatNotice = $('s-vat').value.trim();
  data.settings.ageGate = $('s-gate').checked;
  persist('ההגדרות נשמרו');
});

$('act-reset').addEventListener('click', () => {
  if (!confirm('לאפס את כל התוכן ולחזור לנתוני ברירת המחדל? הפעולה אינה הפיכה.')) return;
  Store.reset();
  data = Store.load();
  renderAll();
  toast('הנתונים אופסו');
});

/**
 * ייצוא קובץ האתר. מייצר את data/catalog.js בדיוק בפורמט שהאתר טוען,
 * כדי שאפשר יהיה להחליף אותו בגיטהאב ולפרסם את השינויים לכל המבקרים.
 */
$('act-publish').addEventListener('click', () => {
  const header =
    '/**\n' +
    ' * catalog.js — נתוני האתר.\n' +
    ' *\n' +
    ' * נוצר מפאנל הניהול. להחלפה ישירה בתיקיית data שבמאגר.\n' +
    ' */\n' +
    'window.CATALOG_SEED = ';
  const blob = new Blob([header + JSON.stringify(data, null, 2) + ';\n'],
    { type: 'text/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'catalog.js';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('הקובץ ירד. יש להחליף בו את data/catalog.js במאגר');
});

$('act-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'store-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('act-import').addEventListener('click', () => $('import-file').click());

$('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.departments)) throw new Error('מבנה לא מוכר');
      Store.save(parsed);
      data = Store.load();
      renderAll();
      toast('הגיבוי נטען');
    } catch (err) {
      toast('הקובץ אינו גיבוי תקין');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ===================== הרצה ===================== */

function renderAll() {
  renderDepts();
  refreshDeptSelect();
  renderContent();
  renderSettings();
}

renderAll();
