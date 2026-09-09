/**
 * ui.js — עזרי ממשק משותפים.
 *
 * העיצוב החדש ויתר על הגלילה החלקה ועל הרקע המונפש, ולכן נותרה כאן
 * רק נעילת הגלילה לחלונות צפים. היא עדיין נחוצה: בלעדיה העמוד שמאחור
 * ממשיך לגלול כשהסל או תפריט הצד פתוחים.
 */

/** קיצור נפוץ. מוגדר כאן פעם אחת ומיובא, ולא חוזר בכל מודול. */
const $ = (id) => document.getElementById(id);

let lockedY = 0;

function lockScroll() {
  if (document.body.classList.contains('is-locked')) return;
  lockedY = window.scrollY;
  document.body.style.top = (-lockedY) + 'px';
  document.body.classList.add('is-locked');
}

function unlockScroll() {
  if (!document.body.classList.contains('is-locked')) return;
  document.body.classList.remove('is-locked');
  document.body.style.top = '';
  window.scrollTo(0, lockedY);
}

/** האם יש חלון צף פתוח כרגע. משמש כדי לא לשחרר נעילה של חלון אחר. */
function anyOverlayOpen() {
  return [...document.querySelectorAll('.drawer, .cart-drawer, .gate')]
    .some(el => !el.hidden);
}

export { $, lockScroll, unlockScroll, anyOverlayOpen };
