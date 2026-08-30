/**
 * cart.js — סל הקניות והזמנה.
 *
 * שני עקרונות שקובעים את המבנה כאן:
 *
 *  1. פרטי כרטיס אשראי אינם נאספים באתר. באתר סטטי אין צד שרת שיכול
 *     לקבל אותם בבטחה, ואיסוף כזה מפר את תקן PCI. לכן האשראי מוצע
 *     בשתי דרכים בלבד: תשלום במעמד המסירה או האיסוף, וקישור תשלום
 *     שמונפק על ידי ספק סליקה מורשה. הקישור נשמר בפאנל ונשלח ללקוח.
 *
 *  2. ההזמנה נשלחת כהודעת וואטסאפ מסודרת. אין שרת שיקלוט אותה, ולכן
 *     הלקוח הוא זה ששולח, והעסק מקבל אותה בשיחה רגילה.
 */

import { Store, money, waLink, esc } from './store.js';
import { lockScroll, unlockScroll } from './motion.js';

const CART_KEY = 'multistore.cart.v1';

let siteData = null;
let cart = {};          // מזהה מוצר אל כמות
let lastFocused = null;

/* ===================== מצב הסל ===================== */

function cartLoad() {
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
  catch (e) { cart = {}; }
  cartPrune();
}

/**
 * מסיר מהסל מוצרים שכבר אינם בקטלוג, וכמויות לא חוקיות.
 *
 * הצורך התגלה בהחלפת הקטלוג: המזהים החדשים שונים מהישנים, והסל
 * השמור בדפדפן המשיך להחזיק מזהים מתים. הרשימה סיננה אותם בתצוגה
 * אבל הספירה עדיין מנתה אותם, ולכן הופיע מספר על הכפתור מול סל ריק.
 */
function cartPrune() {
  let changed = false;
  for (const id of Object.keys(cart)) {
    const qty = Number(cart[id]);
    if (!productById(id) || !Number.isFinite(qty) || qty <= 0) {
      delete cart[id];
      changed = true;
    } else if (cart[id] !== qty) {
      cart[id] = qty;
      changed = true;
    }
  }
  if (changed) cartPersist();
}

function cartPersist() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function productById(id) { return siteData.products.find(p => p.id === id); }

/** שורות הסל, מדולגות על מוצרים שנמחקו מהקטלוג בינתיים. */
function cartLines() {
  return Object.entries(cart).map(([id, qty]) => {
    const p = productById(id);
    return p ? { p, qty, total: Number(p.price) * qty } : null;
  }).filter(Boolean);
}

function subtotal() { return cartLines().reduce((s, l) => s + l.total, 0); }
// נגזר מהשורות התקפות ולא מהאחסון הגולמי, אחרת מזהה מת עדיין נספר
function cartCount()    { return cartLines().reduce((s, l) => s + l.qty, 0); }

/** דמי משלוח לפי ההגדרות, עם התחשבות בסף למשלוח חינם. */
function deliveryFee(method) {
  const c = siteData.settings.checkout;
  if (method !== 'delivery') return 0;
  const free = Number(c.freeDeliveryFrom || 0);
  if (free > 0 && subtotal() >= free) return 0;
  return Number(c.deliveryFee || 0);
}

/* ===================== הוספה והסרה ===================== */

function cartAdd(id) {
  const p = productById(id);
  if (!p || p.stock === 'out') return;
  cart[id] = (cart[id] || 0) + 1;
  cartPersist(); cartRefresh();
  cartAnnounce(p.name + ' נוסף לסל');
}

function cartSetQty(id, qty) {
  if (qty <= 0) delete cart[id];
  else cart[id] = qty;
  cartPersist(); cartRefresh();
}

function cartClear() { cart = {}; cartPersist(); cartRefresh(); }

/** הודעה קולית לקוראי מסך, בלי לשנות את המיקוד. */
function cartAnnounce(text) {
  const el = document.getElementById('cart-live');
  if (el) el.textContent = text;
}

/* ===================== תצוגת הסל ===================== */

function cartRefresh() {
  const n = cartCount();
  const badge = document.getElementById('cart-count');
  if (badge) {
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }
  const fab = document.getElementById('cart-fab');
  if (fab) fab.setAttribute('aria-label', 'פתיחת הסל, ' + n + ' פריטים');
  renderLines();
  renderTotals();
}

function renderLines() {
  const box = document.getElementById('cart-lines');
  if (!box) return;
  const ls = cartLines();

  if (!ls.length) {
    box.innerHTML = '<p class="cart-empty">הסל ריק. אפשר להוסיף פריטים מהמחלקות.</p>';
    const form = document.getElementById('cart-form');
    if (form) form.hidden = true;
    return;
  }
  const form = document.getElementById('cart-form');
  if (form) form.hidden = false;

  box.innerHTML = ls.map(l =>
    '<div class="cart-line">' +
      '<div class="cart-line__main">' +
        '<span class="cart-line__name">' + esc(l.p.name) + '</span>' +
        '<span class="cart-line__unit">' + esc(money(l.p.price)) + ' ליחידה</span>' +
      '</div>' +
      '<div class="cart-qty">' +
        '<button type="button" class="cart-qty__btn" data-qty="' + esc(l.p.id) + '|' + (l.qty - 1) +
        '" aria-label="הפחתת כמות של ' + esc(l.p.name) + '">−</button>' +
        '<span class="cart-qty__val">' + l.qty + '</span>' +
        '<button type="button" class="cart-qty__btn" data-qty="' + esc(l.p.id) + '|' + (l.qty + 1) +
        '" aria-label="הוספת כמות של ' + esc(l.p.name) + '">+</button>' +
      '</div>' +
      '<span class="cart-line__total">' + esc(money(l.total)) + '</span>' +
      '<button type="button" class="cart-line__del" data-qty="' + esc(l.p.id) + '|0"' +
      ' aria-label="הסרת ' + esc(l.p.name) + ' מהסל">הסרה</button>' +
    '</div>').join('');
}

function renderTotals() {
  const box = document.getElementById('cart-totals');
  if (!box) return;
  const c = siteData.settings.checkout;
  const method = currentMethod();
  const sub = subtotal();
  const fee = deliveryFee(method);
  const min = Number(c.minOrder || 0);

  let html =
    '<div class="cart-total"><span>סכום הפריטים</span><span>' + esc(money(sub)) + '</span></div>';
  if (method === 'delivery') {
    html += '<div class="cart-total"><span>משלוח</span><span>' +
            (fee === 0 ? 'ללא חיוב' : esc(money(fee))) + '</span></div>';
  }
  html += '<div class="cart-total cart-total--grand"><span>לתשלום</span><span>' +
          esc(money(sub + fee)) + '</span></div>';
  html += '<p class="cart-note">' + esc(siteData.settings.vatNotice) + '</p>';

  if (min > 0 && sub < min) {
    html += '<p class="cart-warn">מינימום הזמנה הוא ' + esc(money(min)) +
            '. חסרים ' + esc(money(min - sub)) + '.</p>';
  }
  box.innerHTML = html;

  const send = document.getElementById('cart-send');
  if (send) send.disabled = (min > 0 && sub < min) || !cartLines().length;
}

function currentMethod() {
  const el = document.querySelector('input[name="fulfil"]:checked');
  return el ? el.value : 'delivery';
}

/* ===================== המגירה ===================== */

function openCart() {
  lastFocused = document.activeElement;
  const d = document.getElementById('cart-drawer');
  d.hidden = false;
  lockScroll();
  cartRefresh();
  document.getElementById('cart-close').focus();
}

function closeCart() {
  document.getElementById('cart-drawer').hidden = true;
  unlockScroll();
  if (lastFocused) lastFocused.focus();
}

/* ===================== בניית טופס ההזמנה ===================== */

function buildForm() {
  const c = siteData.settings.checkout;
  const pay = [];
  if (c.payCash !== false) pay.push(['cash', 'מזומן במעמד המסירה או האיסוף']);
  if (c.payCardOnDelivery !== false) pay.push(['card_on_site', 'אשראי במעמד המסירה או האיסוף']);
  if (c.payLink) pay.push(['link', c.payLinkLabel || 'קישור תשלום מאובטח']);
  if (!pay.length) pay.push(['cash', 'מזומן במעמד המסירה או האיסוף']);

  const form = document.getElementById('cart-form');
  form.innerHTML =
    '<h3 class="cart-h">אופן קבלה</h3>' +
    '<div class="cart-choices">' +
      '<label class="cart-choice"><input type="radio" name="fulfil" value="delivery" checked>' +
        '<span>משלוח<small>' + esc(c.deliveryAreas || '') + '</small></span></label>' +
      '<label class="cart-choice"><input type="radio" name="fulfil" value="pickup">' +
        '<span>איסוף עצמי<small>' + esc(c.pickupAddress || '') + '</small></span></label>' +
    '</div>' +

    '<h3 class="cart-h">הפרטים שלך</h3>' +
    '<div class="field"><label for="ck-name">שם מלא</label><input id="ck-name" type="text" autocomplete="name"></div>' +
    '<div class="field"><label for="ck-phone">טלפון</label><input id="ck-phone" type="tel" autocomplete="tel" inputmode="tel"></div>' +
    '<div id="ck-address-wrap">' +
      '<div class="field"><label for="ck-city">יישוב</label><input id="ck-city" type="text" autocomplete="address-level2"></div>' +
      '<div class="field"><label for="ck-street">רחוב ומספר</label><input id="ck-street" type="text" autocomplete="street-address"></div>' +
      '<div class="field"><label for="ck-apt">קומה, דירה וכניסה</label><input id="ck-apt" type="text"></div>' +
    '</div>' +
    '<div class="field"><label for="ck-notes">הערות להזמנה</label><textarea id="ck-notes"></textarea></div>' +

    '<h3 class="cart-h">תשלום</h3>' +
    '<div class="cart-choices cart-choices--col">' +
      pay.map((o, i) =>
        '<label class="cart-choice"><input type="radio" name="pay" value="' + esc(o[0]) + '"' +
        (i === 0 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>').join('') +
    '</div>' +
    '<p class="cart-note">האתר אינו אוסף פרטי כרטיס אשראי. תשלום באשראי מתבצע במעמד המסירה או דרך קישור מאובטח של ספק הסליקה.</p>' +

    '<label class="cart-check"><input type="checkbox" id="ck-age">' +
      '<span>אני מאשר שגילי 18 ומעלה ואציג תעודה מזהה במעמד המסירה</span></label>' +
    '<label class="cart-check"><input type="checkbox" id="ck-terms">' +
      '<span>קראתי ואני מסכים לתקנון האתר ולמדיניות הביטול</span></label>' +

    '<div id="cart-totals"></div>' +
    '<p class="cart-error" id="ck-error" hidden></p>' +
    '<button class="btn" id="cart-send" type="button">שליחת ההזמנה בוואטסאפ</button>' +
    '<button class="btn btn--soft btn--sm" id="cart-clear" type="button">ריקון הסל</button>';

  // כתובת נדרשת רק במשלוח
  form.addEventListener('change', (e) => {
    if (e.target.name === 'fulfil') {
      document.getElementById('ck-address-wrap').hidden = e.target.value !== 'delivery';
      renderTotals();
    }
  });

  document.getElementById('cart-send').addEventListener('click', cartSubmit);
  document.getElementById('cart-clear').addEventListener('click', () => {
    if (confirm('לרוקן את הסל?')) cartClear();
  });
}

/* ===================== שליחה ===================== */

function fail(message, focusId) {
  const err = document.getElementById('ck-error');
  err.textContent = message;
  err.hidden = false;
  const el = document.getElementById(focusId);
  if (el) el.focus();
}

function cartSubmit() {
  const err = document.getElementById('ck-error');
  err.hidden = true;

  const method = currentMethod();
  const name  = document.getElementById('ck-name').value.trim();
  const phone = document.getElementById('ck-phone').value.trim();
  const notes = document.getElementById('ck-notes').value.trim();

  if (!name)  return fail('צריך למלא שם מלא', 'ck-name');
  if (phone.replace(/\D/g, '').length < 9) return fail('צריך למלא מספר טלפון תקין', 'ck-phone');

  let address = '';
  if (method === 'delivery') {
    const city   = document.getElementById('ck-city').value.trim();
    const street = document.getElementById('ck-street').value.trim();
    const apt    = document.getElementById('ck-apt').value.trim();
    if (!city)   return fail('צריך למלא יישוב', 'ck-city');
    if (!street) return fail('צריך למלא רחוב ומספר', 'ck-street');
    address = street + ', ' + city + (apt ? ' (' + apt + ')' : '');
  }

  if (!document.getElementById('ck-age').checked)   return fail('צריך לאשר את הצהרת הגיל', 'ck-age');
  if (!document.getElementById('ck-terms').checked) return fail('צריך לאשר את התקנון', 'ck-terms');

  const ls = cartLines();
  if (!ls.length) return fail('הסל ריק', 'cart-send');

  const payEl = document.querySelector('input[name="pay"]:checked');
  const payLabel = payEl ? payEl.parentElement.querySelector('span').childNodes[0].textContent.trim() : '';
  const c = siteData.settings.checkout;
  const fee = deliveryFee(method);
  const sub = subtotal();

  const L = [];
  L.push('הזמנה חדשה מהאתר');
  L.push('');
  L.push('שם: ' + name);
  L.push('טלפון: ' + phone);
  L.push(method === 'delivery' ? 'משלוח אל: ' + address
                               : 'איסוף עצמי מ: ' + (c.pickupAddress || ''));
  L.push('תשלום: ' + payLabel);
  if (notes) L.push('הערות: ' + notes);
  L.push('');
  L.push('פריטים:');
  ls.forEach(l => L.push('• ' + l.qty + ' × ' + l.p.name + ' — ' + money(l.total)));
  L.push('');
  L.push('סכום הפריטים: ' + money(sub));
  if (method === 'delivery') L.push('משלוח: ' + (fee === 0 ? 'ללא חיוב' : money(fee)));
  L.push('לתשלום: ' + money(sub + fee));
  L.push('');
  L.push('אישור גיל 18 ואישור תקנון: כן');

  window.open(waLink(siteData.business.whatsapp, L.join('\n')), '_blank', 'noopener');
  cartAnnounce('ההזמנה נשלחה לוואטסאפ');
}

/* ===================== חיבור ===================== */

function initCart(source) {
  siteData = source;
  // גוש חסר אינו סיבה לכבות את הסל, אלא רק כיבוי מפורש בפאנל
  siteData.settings.checkout = siteData.settings.checkout || {};
  if (siteData.settings.checkout.enabled === false) return;
  if (!document.getElementById('cart-fab')) return;

  cartLoad();
  buildForm();

  document.getElementById('cart-fab').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  document.getElementById('cart-backdrop').addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('cart-drawer').hidden) closeCart();
  });

  // האזנה אחת לכל הכפתורים, כולל כאלה שנוצרו אחרי הטעינה
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) { cartAdd(addBtn.dataset.add); return; }
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const [id, q] = qtyBtn.dataset.qty.split('|');
      cartSetQty(id, Number(q));
    }
  });

  cartRefresh();
}

export { initCart };
