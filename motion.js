/**
 * motion.js — שכבת התנועה.
 *
 * שלושה כללי יסוד שהקוד כאן מקיים:
 *  1. לולאת ציור אחת. הגלילה, הקנבס והרצועה מתעדכנים באותו פריים,
 *     אחרת הם נגררים זה אחרי זה ומרגיש מפורק.
 *  2. מונפשים רק transform ו-opacity, וציור בקנבס. שום שינוי פריסה.
 *  3. מסלול צמצום התנועה הוא מסלול ראשי ולא תיקון בסוף: בו הקנבס
 *     מצויר פעם אחת במצבו הסופי, ואין לולאה בכלל.
 */

/** האם המשתמש ביקש צמצום אנימציות, במערכת ההפעלה או במתג שבאתר. */
function motionReduced() {
  const sys = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const manual = localStorage.getItem('multistore.reducedmotion.v1') === '1';
  return sys || manual;
}

let lenis = null;

/** גלילה חלקה, אם הספרייה נטענה. שיפור מדורג בלבד — האתר עובד גם בלעדיה. */
function initScroll() {
  if (motionReduced() || typeof Lenis === 'undefined') return null;
  lenis = new Lenis({ duration: 1.05, smoothWheel: true, syncTouch: false });
  return lenis;
}

/** גלילה לעוגן, דרך הספרייה כשהיא פעילה. */
function scrollToTarget(el) {
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -90 });
  else el.scrollIntoView({ block: 'start', behavior: motionReduced() ? 'auto' : 'smooth' });
}

/** חשיפות בגלילה — התנהגות אחידה לכל האתר, נצפה פעם אחת ומשחרר. */
function initReveals() {
  const els = document.querySelectorAll('.reveal');
  if (motionReduced() || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-revealed');
      io.unobserve(e.target);
    });
  // סף אפס במקום אחוז: רשימה ארוכה מגובה המסך לעולם לא תגיע לאחוז
  // הנראות הנדרש, ובסף אחוזי היא נשארת בלתי נראית לצמיתות.
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
}

/** כותרת שנכנסת מילה־מילה, בדירוג של 85 מילישניות בין מילה למילה. */
function revealHeadline(el, words) {
  if (!el) return;
  el.innerHTML = words
    .map((w, i) => '<span style="animation-delay:' + (i * 0.085) + 's">' + w + '</span>')
    .join(' ');
  if (!motionReduced()) el.classList.add('play');
}

/* =====================================================================
   הגיבור — "מפיזור לסדר", בתלת ממד
   ---------------------------------------------------------------------
   מצב פתיחה: ענן נקודות מפוזר בחלל, מסתובב לאט. הנקודות הרחוקות קטנות
   וחיוורות, הקרובות גדולות וברורות — זה מה שיוצר את העומק.
   מצב סיום: הענן מתיישר למישור אחד שפונה אל הצופה, בעמודות מסודרות,
   אחת לכל מחלקה, והסיבוב נעצר.

   הגלילה היא שמערבבת בין שני המצבים, ולכן היא זו שמבצעת בפועל את
   ההבטחה של העסק. הנושא מופשט בכוונה ואינו מוצר עישון ואינו רומז על
   אחד, כי הנפשה על מוצר עישון עלולה להיחשב פרסומת.
   ===================================================================== */

function initHero(opts) {
  const { canvas, stage, track, bg, columns } = opts;
  if (!canvas || !stage) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.style.display = 'none'; return; }

  const reduced = motionReduced();
  const COLORS = ['#F45B9B', '#7C3AED', '#06B6D4', '#F59E0B', '#4F46E5'];
  const FOCAL = 900;              // מרחק מוקד: ככל שקטן, הפרספקטיבה חדה יותר

  let W = 0, H = 0, dots = [];

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const small = W < 720;
    const cols = Math.max(3, Math.min(columns || 5, small ? 4 : 6));
    const per  = small ? 8 : 13;
    const n    = cols * per;

    const gw = Math.min(W * 0.74, 900), colW = gw / cols;
    const gh = Math.min(H * 0.52, 430), rowH = gh / per;

    dots = Array.from({ length: n }, (_, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      return {
        // מצב הכאוס: מיקום אקראי בתיבה תלת ממדית סביב המרכז
        x0: (Math.random() - 0.5) * W * 1.5,
        y0: (Math.random() - 0.5) * H * 1.4,
        z0: (Math.random() - 0.5) * 900,
        // מצב הסדר: משבצת ברשת שטוחה, כל עמודה היא מחלקה
        x1: -gw / 2 + colW * c + colW / 2,
        y1: -gh / 2 + rowH * r + rowH / 2,
        z1: 0,
        r0: (small ? 5 : 7) + Math.random() * (small ? 9 : 14),
        r1: small ? 5 : 7,
        color: COLORS[c % COLORS.length],
        drift: Math.random() * Math.PI * 2,
        // דירוג של 20 עד 30 מילישניות — נקרא כרצף, לא כתור
        delay: r * 0.02 + c * 0.03
      };
    });
  }

  /** הטלת נקודה תלת ממדית למסך, אחרי סיבוב סביב שני צירים. */
  const proj = [];
  function draw(p, t, pointer) {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);

    const build01 = Math.min(1, Math.max(0, p));
    // בכאוס הענן מסובב ומוטה, ובסדר הוא מתיישר אל מול הצופה
    const spin = reduced ? 0 : t * 0.00011;
    const ay = (1 - build01) * (0.85 + spin * 6) + pointer.x * 0.28;
    const ax = (1 - build01) * 0.38 + pointer.y * 0.12;
    const cosY = Math.cos(ay), sinY = Math.sin(ay);
    const cosX = Math.cos(ax), sinX = Math.sin(ax);
    const cx = W / 2, cy = H / 2;

    proj.length = 0;
    for (const d of dots) {
      const local = Math.min(1, Math.max(0, (build01 - d.delay) / 0.62));
      const e = 1 - Math.pow(1 - local, 3);   // האטה קוביתית, לא ליניארי
      const wob = (1 - e) * 26;               // בכאוס נודדות, בסדר נעצרות

      let x = d.x0 + (d.x1 - d.x0) * e + Math.cos(t * 0.0006 + d.drift) * wob;
      let y = d.y0 + (d.y1 - d.y0) * e + Math.sin(t * 0.0007 + d.drift) * wob;
      let z = d.z0 + (d.z1 - d.z0) * e;

      // סיבוב סביב ציר האנך ואז הטיה סביב ציר הרוחב
      const xr =  x * cosY - z * sinY;
      let   zr =  x * sinY + z * cosY;
      const yr =  y * cosX - zr * sinX;
      zr       =  y * sinX + zr * cosX;

      const s = FOCAL / (FOCAL + zr);          // הפרספקטיבה עצמה
      if (s <= 0) continue;
      proj.push({
        sx: cx + xr * s,
        sy: cy + yr * s,
        r: (d.r0 + (d.r1 - d.r0) * e) * s,
        z: zr,
        color: d.color,
        // הרחוקות חיוורות, הקרובות ברורות
        alpha: Math.max(0.06, Math.min(0.85, (0.2 + e * 0.42) * (0.45 + s * 0.75)))
      });
    }

    // ציור מהרחוק אל הקרוב, אחרת הקרובות נבלעות מאחורי הרחוקות
    proj.sort((a, b) => b.z - a.z);
    for (const q of proj) {
      ctx.globalAlpha = q.alpha;
      ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.sx, q.sy, Math.max(0.5, q.r), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  build();
  window.addEventListener('resize', () => { build(); if (reduced) draw(1, 0, { x: 0, y: 0 }); });

  if (reduced) {
    stage.classList.add('stage--flat');
    draw(1, 0, { x: 0, y: 0 });
    return;
  }

  // מצביע העכבר מטלטל את הענן במעט — עומק בלי להסיח
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  const orbs = bg ? [...bg.querySelectorAll('.bg-orb')] : [];
  const grid = bg ? bg.querySelector('.bg-grid') : null;

  let mqX = 0, lastY = window.scrollY, vel = 0;

  function frame(t) {
    const y = window.scrollY;
    vel += ((y - lastY) - vel) * 0.15;   // החלקה של מהירות הגלילה
    lastY = y;

    pointer.x += (pointer.tx - pointer.x) * 0.055;
    pointer.y += (pointer.ty - pointer.y) * 0.055;

    const span = stage.offsetHeight - window.innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, y / span)) : 1;
    draw(p, t, pointer);

    // רקע: כל כתם נע במהירות אחרת, וזה מה שיוצר את הפרלקסה
    const doc = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const gp = y / doc;
    for (let i = 0; i < orbs.length; i++) {
      const depth = 0.18 + i * 0.14;
      orbs[i].style.transform =
        'translate3d(' + (Math.sin(t * 0.00007 + i) * 40) + 'px,' +
        (-y * depth) + 'px,0) scale(' + (1 + gp * 0.22) + ')';
    }
    if (grid) grid.style.transform = 'translate3d(0,' + (-y * 0.08) + 'px,0)';

    if (track) {
      // הרצועה נעה מעצמה ומאיצה לפי מהירות הגלילה, עם תקרה
      mqX -= 0.45 + Math.min(6, Math.abs(vel) * 0.08);
      const loop = track.scrollWidth / 3;
      if (loop && mqX < -loop) mqX += loop;
      track.style.transform = 'translate3d(' + mqX + 'px,0,0)';
    }

    if (lenis) lenis.raf(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export { motionReduced, initScroll, scrollToTarget, initReveals, revealHeadline, initHero };
