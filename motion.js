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
   הגיבור — "מפיזור לסדר"
   ---------------------------------------------------------------------
   מצב פתיחה: נקודות מפוזרות באקראי, בגדלים ובצבעים מעורבים, נודדות
   באוויר. זה הכאוס — מאות פריטים בלי שיוך.
   מצב סיום: חמש עמודות מסודרות, אחת לכל מחלקה, והנדידה נעצרת.
   הגלילה היא שמערבבת בין שני המצבים, ולכן היא זו שמבצעת בפועל את
   ההבטחה של העסק.

   הנושא מופשט בכוונה ואינו מוצר עישון ואינו רומז על אחד. הנפשה על
   מוצר עישון עלולה להיחשב פרסומת.
   ===================================================================== */

function initHero(canvas, stage, marquee, deptCount) {
  if (!canvas || !stage) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.style.display = 'none'; return; }

  const reduced = motionReduced();
  const COLORS = ['#F45B9B', '#7C3AED', '#06B6D4', '#F59E0B', '#4F46E5'];

  let W = 0, H = 0, dots = [];

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const small = W < 720;
    const cols = Math.max(3, Math.min(deptCount || 5, small ? 4 : 6));
    const per  = small ? 9 : 15;
    const n    = cols * per;

    const gw = Math.min(W * 0.8, 940), colW = gw / cols;
    const gh = Math.min(H * 0.5, 420), rowH = gh / per;

    dots = Array.from({ length: n }, (_, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      return {
        x0: Math.random() * W, y0: Math.random() * H,
        r0: (small ? 3 : 4) + Math.random() * (small ? 7 : 12),
        x1: W / 2 - gw / 2 + colW * c + colW / 2,
        y1: H / 2 - gh / 2 + rowH * r + rowH / 2,
        r1: small ? 4.5 : 6.5,
        color: COLORS[c % COLORS.length],
        drift: Math.random() * Math.PI * 2,
        // דירוג של 20 עד 30 מילישניות — מספיק כדי להיקרא כרצף, לא כתור
        delay: r * 0.02 + c * 0.03
      };
    });
  }

  function draw(p, t) {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      const local = Math.min(1, Math.max(0, (p - d.delay) / 0.62));
      const e = 1 - Math.pow(1 - local, 3);       // האטה קוביתית, לא ליניארי
      const wob = (1 - e) * 14;                    // בכאוס נודדות, בסדר נעצרות
      const x = d.x0 + (d.x1 - d.x0) * e + Math.cos(t * 0.0006 + d.drift) * wob;
      const y = d.y0 + (d.y1 - d.y0) * e + Math.sin(t * 0.0007 + d.drift) * wob;
      const r = d.r0 + (d.r1 - d.r0) * e;
      ctx.globalAlpha = 0.24 + e * 0.42;
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  build();
  window.addEventListener('resize', () => { build(); if (reduced) draw(1, 0); });

  if (reduced) {
    // מצב סטטי: המצב הסופי בלבד, בלי לולאה
    stage.classList.add('stage--flat');
    draw(1, 0);
    return;
  }

  let mqX = 0, lastY = window.scrollY, vel = 0;
  const track = marquee;

  function frame(t) {
    const y = window.scrollY;
    vel += ((y - lastY) - vel) * 0.15;   // החלקה של המהירות
    lastY = y;

    const span = stage.offsetHeight - window.innerHeight;
    const p = span > 0 ? Math.min(1, Math.max(0, y / span)) : 1;
    draw(p, t);

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
