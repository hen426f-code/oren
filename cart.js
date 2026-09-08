/**
 * cart.js — סל הקניות וההזמנה.
 *
 * שני עקרונות שקובעים את המבנה:
 *
 *  1. פרטי כרטיס אשראי אינם נאספים באתר. באתר סטטי אין צד שרת שיכול
 *     לקבל אותם בבטחה, ואיסוף כזה מפר את תקן PCI. לכן האשראי מוצע
 *     בשתי דרכים בלבד: תשלום במעמד המסירה או האיסוף, וקישור תשלום
 *     שמונפק על ידי ספק סליקה מורשה.
 *
 *  2. ההזמנה נשלחת כהודעת וואטסאפ מסודרת. אין שרת שיקלוט אותה, ולכן
 *     הלקוח הוא ששולח, והעסק מקבל אותה בשיחה רגילה.
 */

import { Store, money, waLink, esc, imagesOf } from './store.js';
import { $, lockScroll, unlockScroll, anyOverlayOpen } from './ui.js';

const CART_KEY = 'multistore.cart.v1';

let siteData = null;
let cart = {};
let lastFocused = null;


/* ===================== מצב הסל ===================== */

function cartLoad() {
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
  catch (e) { cart = {}; }
  cartPrune();
}

function cartPersist() { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

function productById(id) { return siteData.products.find(p => p.id === id); }

/**
 * מסיר מהסל מוצרים שכבר אינם בקטלוג, כמויות לא חוקיות ומוצרים שאזלו.
 *
 * הצורך התגלה בהחלפת הקטלוג: המזהים החדשים שונים מהישנים, והסל השמור
 * בדפדפן המשיך להחזיק מזהים מתים. הרשימה סיננה אותם בתצוגה אבל הספירה
 * עדיין מנתה אותם, ולכן הופיע מספר על הכפתור מול סל ריק.
 */
function cartPrune() {
  let changed = false;
  for (const id of Object.keys(cart)) {
    const qty = Number(cart[id]);
    const p = productById(id);
    if (!p || p.stock === 'out' || !Number.isFinite(qty) || qty <= 0) {
      delete cart[id]; changed = true;
    } else if (cart[id] !== qty) {
      cart[id] = qty; changed = true;
    }
  }
  if (changed) cartPersist();
}

function cartLines() {
  return Object.entries(cart).map(([id, qty]) => {
    const p = productById(id);
    return p ? { p, qty, total: Number(p.price) * qty } : null;
  }).filter(Boolean);
}

function subtotal() { return cartLines().reduce((s, l) => s + l.total, 0); }
// נגזר מהשורות התקפות ולא מהאחסון הגולמי, אחרת מזהה מת עדיין נספר
function cartCount() { return cartLines().reduce((s, l) => s + l.qty, 0); }

function deliveryFee(method) {
  const c = siteData.settings.checkout;
  if (method !== 'delivery') return 0;
  const free = Number(c.freeDeliveryFrom || 0);
  if (free > 0 && subtotal() >= free) return 0;
  return Number(c.deliveryFee || 0);
}

/* ===================== שינויים ===================== */

function cartAdd(id) {
  const p = productById(id);
  if (!p || p.stock === 'out') return;
  cart[id] = (cart[id] || 0) + 1;
  cartPersist(); cartRefresh();
  cartAnnounce(p.name + ' נוסף לסל');
}

function cartSetQty(id, qty) {
  if (qty <= 0) delete cart[id]; else cart[id] = qty;
  cartPersist(); cartRefresh();
}

function cartClearAll() { cart = {}; cartPersist(); cartRefresh(); }

function cartAnnounce(text) {
  const el = $('cart-live');
  if (el) el.textContent = text;
}

/* ===================== תצוגה ===================== */

function cartRefresh() {
  if (!siteData) return;
  const n = cartCount();
  const badge = $('cart-count');
  if (badge) { badge.textContent = String(n); badge.hidden = n === 0; }
  const total = $('cart-total');
  if (total) total.textContent = money(subtotal());
  const pill = $('cart-open');
  if (pill) pill.setAttribute('aria-label', 'פתיחת סל הקניות, ' + n + ' פריטים');
  renderLines();
  renderTotals();
}

function renderLines() {
  const box = $('cart-lines');
  if (!box) return;
  const ls = cartLines();

  if (!ls.length) {
    box.innerHTML = '<p class="cart-empty">הסל ריק. אפשר להוסיף פריטים מהמחלקות.</p>';
    if ($('cart-form')) $('cart-form').hidden = true;
    if ($('cart-foot')) $('cart-foot').hidden = true;
    return;
  }
  if ($('cart-foot')) $('cart-foot').hidden = false;

  box.innerHTML = ls.map(l => {
    const img = imagesOf(l.p)[0];
    return '<div class="cart-line">' +
      '<div class="cart-line__img">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(l.p.imageAlt || l.p.name) +
               '" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">'
             : '<span>אין תמונה</span>') + '</div>' +
      '<div class="cart-line__info">' +
        '<p class="cart-line__name">' + esc(l.p.name) + '</p>' +
        '<p class="cart-line__price">מחיר ליחידה: <b>' + esc(money(l.p.price)) + '</b></p>' +
        '<p class="cart-line__price">סך הכול: <b>' + esc(money(l.total)) + '</b></p>' +
      '</div>' +
      '<button class="cart-line__del" type="button" data-qty="' + esc(l.p.id) + '|0"' +
      ' aria-label="הסרת ' + esc(l.p.name) + ' מהסל">&times;</button>' +
      '<div class="qty">' +
        '<button type="button" data-qty="' + esc(l.p.id) + '|' + (l.qty + 1) +
        '" aria-label="הוספת כמות">+</button>' +
        '<span>' + l.qty + '</span>' +
        '<button type="button" data-qty="' + esc(l.p.id) + '|' + (l.qty - 1) +
        '" aria-label="הפחתת כמות">&minus;</button>' +
      '</div></div>';
  }).join('');
}

function currentMethod() {
  const el = document.querySelector('input[name="fulfil"]:checked');
  return el ? el.value : 'delivery';
}

function renderTotals() {
  const box = $('cart-totals');
  if (!box) return;
  const c = siteData.settings.checkout;
  const method = currentMethod();
  const sub = subtotal(), fee = deliveryFee(method), min = Number(c.minOrder || 0);

  let h = '<div class="cart-total"><span>סכום הפריטים</span><span>' + esc(money(sub)) + '</span></div>';
  if (method === 'delivery') {
    h += '<div class="cart-total"><span>משלוח</span><span>' +
         (fee === 0 ? 'ללא חיוב' : esc(money(fee))) + '</span></div>';
  }
  h += '<div class="cart-total cart-total--grand"><span>לתשלום</span><span>' +
       esc(money(sub + fee)) + '</span></div>';
  h += '<p class="cart-note">' + esc(siteData.settings.vatNotice) + '</p>';
  if (min > 0 && sub < min) {
    h += '<p class="cart-warn">מינימום הזמנה הוא ' + esc(money(min)) +
         '. חסרים ' + esc(money(min - sub)) + '.</p>';
  }
  box.innerHTML = h;

  const send = $('cart-send');
  if (send) send.disabled = (min > 0 && sub < min) || !cartLines().length;
}

/* ===================== פתיחה וסגירה ===================== */

function openCart() {
  lastFocused = document.activeElement;
  $('cart-drawer').hidden = false;
  lockScroll();
  cartRefresh();
  $('cart-close').focus();
}

function closeCart() {
  $('cart-drawer').hidden = true;
  if (!anyOverlayOpen()) unlockScroll();
  if (lastFocused) lastFocused.focus();
}

/* ===================== טופס ההזמנה ===================== */

function buildForm() {
  const c = siteData.settings.checkout;
  const pay = [];
  if (c.payCash !== false) pay.push(['cash', 'מזומן במעמד המסירה או האיסוף']);
  if (c.payCardOnDelivery !== false) pay.push(['card_on_site', 'אשראי במעמד המסירה או האיסוף']);
  if (c.payLink) pay.push(['link', c.payLinkLabel || 'קישור תשלום מאובטח']);
  if (!pay.length) pay.push(['cash', 'מזומן במעמד המסירה או האיסוף']);

  $('cart-form').innerHTML =
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
      pay.map((o, i) => '<label class="cart-choice"><input type="radio" name="pay" value="' +
        esc(o[0]) + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>').join('') +
    '</div>' +
    '<p class="cart-note">האתר אינו אוסף פרטי כרטיס אשראי. תשלום באשראי מתבצע במעמד המסירה או דרך קישור מאובטח של ספק הסליקה.</p>' +
    '<label class="cart-check"><input type="checkbox" id="ck-age">' +
      '<span>אני מאשר שגילי 18 ומעלה ואציג תעודה מזהה במעמד המסירה</span></label>' +
    '<label class="cart-check"><input type="checkbox" id="ck-terms">' +
      '<span>קראתי ואני מסכים לתקנון האתר ולמדיניות הביטול</span></label>' +
    '<div id="cart-totals"></div>' +
    '<p class="cart-error" id="ck-error" hidden></p>' +
    '<button class="btn btn--green btn--block" id="cart-send" type="button">שליחת ההזמנה בוואטסאפ</button>';

  $('cart-form').addEventListener('change', (e) => {
    if (e.target.name === 'fulfil') {
      $('ck-address-wrap').hidden = e.target.value !== 'delivery';
      renderTotals();
    }
  });
  $('cart-send').addEventListener('click', cartSubmit);
}

function fail(msg, focusId) {
  const err = $('ck-error');
  err.textContent = msg; err.hidden = false;
  const el = $(focusId);
  if (el) el.focus();
}

function cartSubmit() {
  $('ck-error').hidden = true;
  const method = currentMethod();
  const name  = $('ck-name').value.trim();
  const phone = $('ck-phone').value.trim();
  const notes = $('ck-notes').value.trim();

  if (!name) return fail('צריך למלא שם מלא', 'ck-name');
  if (phone.replace(/\D/g, '').length < 9) return fail('צריך למלא מספר טלפון תקין', 'ck-phone');

  let address = '';
  if (method === 'delivery') {
    const city = $('ck-city').value.trim(), street = $('ck-street').value.trim(), apt = $('ck-apt').value.trim();
    if (!city)   return fail('צריך למלא יישוב', 'ck-city');
    if (!street) return fail('צריך למלא רחוב ומספר', 'ck-street');
    address = street + ', ' + city + (apt ? ' (' + apt + ')' : '');
  }
  if (!$('ck-age').checked)   return fail('צריך לאשר את הצהרת הגיל', 'ck-age');
  if (!$('ck-terms').checked) return fail('צריך לאשר את התקנון', 'ck-terms');

  const ls = cartLines();
  if (!ls.length) return fail('הסל ריק', 'cart-send');

  const payEl = document.querySelector('input[name="pay"]:checked');
  const payLabel = payEl ? payEl.parentElement.querySelector('span').childNodes[0].textContent.trim() : '';
  const c = siteData.settings.checkout;
  const fee = deliveryFee(method), sub = subtotal();

  const L = ['הזמנה חדשה מהאתר', '', 'שם: ' + name, 'טלפון: ' + phone];
  L.push(method === 'delivery' ? 'משלוח אל: ' + address : 'איסוף עצמי מ: ' + (c.pickupAddress || ''));
  L.push('תשלום: ' + payLabel);
  if (notes) L.push('הערות: ' + notes);
  L.push('', 'פריטים:');
  ls.forEach(l => L.push('• ' + l.qty + ' × ' + l.p.name + ' — ' + money(l.total)));
  L.push('', 'סכום הפריטים: ' + money(sub));
  if (method === 'delivery') L.push('משלוח: ' + (fee === 0 ? 'ללא חיוב' : money(fee)));
  L.push('לתשלום: ' + money(sub + fee), '', 'אישור גיל 18 ואישור תקנון: כן');

  window.open(waLink(siteData.business.whatsapp, L.join('\n')), '_blank', 'noopener');
  cartAnnounce('ההזמנה נשלחה לוואטסאפ');
}

/* ===================== חיבור ===================== */

function initCart(source) {
  siteData = source;
  siteData.settings.checkout = siteData.settings.checkout || {};
  if (siteData.settings.checkout.enabled === false) return;
  if (!$('cart-open')) return;

  cartLoad();
  buildForm();

  $('cart-open').addEventListener('click', openCart);
  $('cart-close').addEventListener('click', closeCart);
  $('cart-back').addEventListener('click', closeCart);
  $('cart-clear').addEventListener('click', () => { if (confirm('לרוקן את הסל?')) cartClearAll(); });
  $('cart-checkout').addEventListener('click', () => {
    $('cart-form').hidden = false;
    $('cart-form').scrollIntoView({ block: 'start', behavior: 'smooth' });
    $('ck-name').focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('cart-drawer').hidden) closeCart();
  });

  // מאזין אחד לכל כפתורי ההוספה והכמות, כולל כאלה שנוצרו אחרי הטעינה
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-add]');
    if (a) { cartAdd(a.dataset.add); return; }
    const q = e.target.closest('[data-qty]');
    if (q) {
      const [id, n] = q.dataset.qty.split('|');
      cartSetQty(id, Number(n));
    }
  });

  cartRefresh();
}

export { initCart, cartRefresh };
