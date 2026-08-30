/**
 * store.js — שכבת הנתונים המשותפת לאתר ולפאנל הניהול.
 *
 * מקור אמת יחיד. אין מחרוזות תוכן קשיחות בקוד התצוגה — הכול נקרא מכאן.
 * האחסון מקומי בדפדפן. במעבר לשרת מחליפים רק את load ואת save.
 */

const STORAGE_KEY = 'multistore.data.v1';
const GATE_KEY    = 'multistore.agegate.v1';
const MOTION_KEY  = 'multistore.reducedmotion.v1';

/** מזהה קצר וייחודי לרשומה חדשה. */
function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

/**
 * נתוני ברירת המחדל.
 * restricted        — מחלקת מוצרי עישון. השדה הזה קובע את תבנית התצוגה.
 * showImages        — מתג ידני להצגת תמונות. במחלקה מוגבלת כבוי כברירת מחדל.
 * showDescriptions  — מתג ידני להצגת תיאורים. אותו היגיון.
 *
 * המבנה שלהלן הוא שלד ההדגמה בלבד. כשקובץ data/catalog.js נטען,
 * התוכן שבו גובר עליו — ראה FALLBACK בתחתית הקובץ.
 */
const FALLBACK = {
  business: {
    name: 'החנות',
    tagline: 'חנות רב־מחלקתית',
    legalName: 'שם העוסק המלא — למילוי',
    businessId: 'מספר עוסק או חברה — למילוי',
    address: 'כתובת העסק — למילוי',
    whatsapp: '972505335323',
    whatsappDisplay: '050-5335323',
    hours: 'ראשון עד חמישי 09:00–19:00, שישי 09:00–14:00',
    accessibilityOfficer: 'שם רכז הנגישות — למילוי',
    accessibilityContact: 'טלפון או דואר אלקטרוני של רכז הנגישות — למילוי'
  },

  hero: {
    eyebrow: 'הזמנות בוואטסאפ',
    titleA: 'המון פריטים.',
    titleB: 'סדר',
    titleC: 'אחד.',
    lead: 'המון פריטים, חמש מחלקות, סדר אחד ברור. בוחרים, שולחים הודעה, מקבלים.',
    ctaPrimary: 'למחלקות החנות',
    ctaSecondary: 'הזמנה בוואטסאפ'
  },


  pages: {
    about:
      'כאן נכתב הטקסט על העסק. מומלץ לתאר מה נמכר, מאיזו שנה העסק פועל, ' +
      'ואיך מגיעים לחנות הפיזית. אין לכלול בטקסט התייחסות שיווקית למוצרי עישון.',
    terms:
      'תקנון האתר — טיוטה למילוי ולבדיקת עורך דין. יש לכלול: פרטי העוסק, ' +
      'תנאי ההזמנה, מדיניות המחירים, אחריות, סמכות שיפוט ותנאי שימוש.',
    shipping:
      'מדיניות משלוחים — אזורי חלוקה, זמני אספקה, עלויות, ואופן אימות הגיל במעמד המסירה.',
    returns:
      'מדיניות ביטול והחזרה — זכות ביטול בתוך ארבעה עשר יום ממועד קבלת המוצר או ' +
      'ממועד קבלת מסמך הפרטים, לפי המאוחר, בכפוף לחריגים שבחוק הגנת הצרכן.',
    privacy:
      'מדיניות פרטיות — איזה מידע נאסף, לאיזו מטרה, למי הוא מועבר, וכיצד ניתן ' +
      'לעיין בו או לבקש את מחיקתו.',
    accessibility:
      'הצהרת נגישות — האתר נבנה בהתאם לתקן הישראלי 5568 ברמה AA. ' +
      'נמצאה תקלת נגישות? נשמח לפנייה אל רכז הנגישות.'
  },

  departments: [
    { id: 'dep_deals',  name: 'מבצעי החנות', order: 1, restricted: false, showImages: true,  showDescriptions: true,  intro: 'המבצעים שרצים כרגע בחנות.' },
    { id: 'dep_acc',    name: 'אקססוריז',    order: 2, restricted: false, showImages: true,  showDescriptions: true,  intro: 'מציתים, קופסאות, מגשים ומוצרים נלווים שאינם מוצרי עישון.' },
    { id: 'dep_hookah', name: 'נרגילות',     order: 3, restricted: true,  showImages: false, showDescriptions: false, intro: '' },
    { id: 'dep_tobac',  name: 'מוצרי טבק',   order: 4, restricted: true,  showImages: false, showDescriptions: false, intro: '' },
    { id: 'dep_smoke',  name: 'מוצרי עישון', order: 5, restricted: true,  showImages: false, showDescriptions: false, intro: '' }
  ],

  products: [
    { id: 'prd_1', deptId: 'dep_deals',  name: 'מארז אקססוריז משולב', price: 79,  prevPrice: 99,   stock: 'in',  image: '', imageAlt: '', description: 'מארז המשלב מספר פריטים נלווים.', order: 1 },
    { id: 'prd_2', deptId: 'dep_deals',  name: 'מארז מתנה',            price: 129, prevPrice: 159,  stock: 'low', image: '', imageAlt: '', description: 'מארז ארוז ומוכן למסירה.',        order: 2 },
    { id: 'prd_3', deptId: 'dep_acc',    name: 'מצית סופה',            price: 25,  prevPrice: null, stock: 'in',  image: '', imageAlt: '', description: 'מצית עמיד לרוח, ניתן למילוי חוזר.', order: 1 },
    { id: 'prd_4', deptId: 'dep_acc',    name: 'מגש הגשה מתכת',        price: 45,  prevPrice: null, stock: 'in',  image: '', imageAlt: '', description: 'מגש מתכת בגודל בינוני.',        order: 2 },
    { id: 'prd_5', deptId: 'dep_acc',    name: 'קופסת אחסון',          price: 38,  prevPrice: null, stock: 'out', image: '', imageAlt: '', description: 'קופסה אטומה עם מכסה מתברג.',    order: 3 },
    { id: 'prd_6', deptId: 'dep_hookah', name: 'נרגילה דגם א',         price: 320, prevPrice: null, stock: 'in',  image: '', imageAlt: '', description: '', order: 1 },
    { id: 'prd_7', deptId: 'dep_hookah', name: 'ראש נרגילה חרס',       price: 35,  prevPrice: null, stock: 'in',  image: '', imageAlt: '', description: '', order: 2 },
    { id: 'prd_8', deptId: 'dep_tobac',  name: 'מוצר טבק לדוגמה א',    price: 40,  prevPrice: null, stock: 'in',  image: '', imageAlt: '', description: '', order: 1 },
    { id: 'prd_9', deptId: 'dep_tobac',  name: 'מוצר טבק לדוגמה ב',    price: 44,  prevPrice: null, stock: 'out', image: '', imageAlt: '', description: '', order: 2 },
    { id: 'prd_10', deptId: 'dep_smoke', name: 'מוצר עישון לדוגמה א',  price: 60,  prevPrice: null, stock: 'in',  image: '', imageAlt: '', description: '', order: 1 }
  ],

  settings: {
    smokingWarning: 'אזהרה: העישון מזיק לבריאות ומכיל חומרים ממכרים',
    ageNotice: 'מכירת מוצרי טבק ועישון אסורה מתחת לגיל 18. תידרש הצגת תעודה מזהה במעמד המסירה.',
    vatNotice: 'כל המחירים לצרכן כוללים מס ערך מוסף.',
    ageGate: true,

    /**
     * הגדרות ההזמנה. שים לב ל-payLink: זהו קישור תשלום שמונפק על ידי
     * ספק סליקה מורשה. האתר לעולם אינו אוסף פרטי כרטיס בעצמו.
     */
    checkout: {
      enabled: true,
      deliveryFee: 20,
      freeDeliveryFrom: 0,
      minOrder: 0,
      pickupAddress: 'הזגג 11, אילת',
      deliveryAreas: 'אילת והסביבה',
      payCash: true,
      payCardOnDelivery: true,
      payLink: '',
      payLinkLabel: 'קישור תשלום מאובטח'
    }
  }
};

/**
 * הנתונים הפעילים, בשלוש שכבות:
 *   FALLBACK   — השלד. מגדיר כל שדה שהקוד מצפה לו, כולל הגדרות ההזמנה.
 *   CATALOG_SEED — הקטלוג המפורסם. גובר על השלד בכל מה שהוא מגדיר.
 *   אחסון מקומי — עריכות מהפאנל. גובר על שניהם.
 *
 * הקטלוג חייב להתמזג לתוך השלד ולא להחליף אותו: קטלוג שנוצר לפני
 * שנוספה תכונה חדשה אינו מכיל את השדות שלה, והחלפה מלאה הייתה
 * מוחקת אותם ומשביתה את התכונה.
 */
function mergeSettings(base, over) {
  const s = Object.assign({}, base, over || {});
  s.checkout = Object.assign({}, base.checkout, (over && over.checkout) || {});
  return s;
}

function baseData() {
  const f = JSON.parse(JSON.stringify(FALLBACK));
  const pub = (typeof window !== 'undefined' && window.CATALOG_SEED)
    ? JSON.parse(JSON.stringify(window.CATALOG_SEED)) : null;
  if (!pub) return f;
  return {
    business:    Object.assign(f.business, pub.business || {}),
    hero:        Object.assign(f.hero,     pub.hero     || {}),
    pages:       Object.assign(f.pages,    pub.pages    || {}),
    settings:    mergeSettings(f.settings, pub.settings),
    departments: Array.isArray(pub.departments) ? pub.departments : f.departments,
    products:    Array.isArray(pub.products)    ? pub.products    : f.products
  };
}

/** מיזוג עם ברירת המחדל, כדי ששדות חדשים לא ישברו נתונים ישנים. */
function withDefaults(raw) {
  const d = baseData();
  if (!raw || typeof raw !== 'object') return d;
  return {
    business:    Object.assign(d.business, raw.business || {}),
    hero:        Object.assign(d.hero,     raw.hero     || {}),
    pages:       Object.assign(d.pages,    raw.pages    || {}),
    settings:    mergeSettings(d.settings, raw.settings),
    departments: Array.isArray(raw.departments) ? raw.departments : d.departments,
    products:    Array.isArray(raw.products)    ? raw.products    : d.products
  };
}

const Store = {
  load() {
    try {
      return withDefaults(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (e) {
      console.warn('נתונים שמורים לא תקינים, נטענה ברירת המחדל.', e);
      return withDefaults(null);
    }
  },

  save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },

  reset() { localStorage.removeItem(STORAGE_KEY); },

  /** מחלקות לפי סדר התצוגה שנקבע בפאנל. */
  sortedDepartments(data) {
    return [...data.departments].sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  /** מוצרי מחלקה, ממוינים. */
  productsOf(data, deptId) {
    return data.products.filter(p => p.deptId === deptId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  uid,
  get SEED() { return baseData(); },
  keys: { STORAGE_KEY, GATE_KEY, MOTION_KEY }
};

/** תצוגת מחיר בשקלים, בלי שברים מיותרים. */
function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString('he-IL', {
    style: 'currency', currency: 'ILS',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

/** תווית זמינות אחידה. status הוא in או low או out. */
function stockLabel(status) {
  if (status === 'out') return 'אזל מהמלאי';
  if (status === 'low') return 'מלאי מוגבל';
  return 'במלאי';
}

/** קישור הזמנה בוואטסאפ עם טקסט פתיחה. */
function waLink(number, text) {
  const clean = String(number || '').replace(/\D/g, '');
  return 'https://wa.me/' + clean + (text ? '?text=' + encodeURIComponent(text) : '');
}

/** בריחה מתווי סימון — כל תוכן שמגיע מהפאנל עובר דרך כאן. */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export { Store, money, stockLabel, waLink, esc };
