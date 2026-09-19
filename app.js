// Willes jultidningar – enkel PWA mot Supabase (RPC med hemlig nyckel)
const SUPABASE_URL = 'https://zmnganukzpoovfwtushw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UtyVOvVfbnYvtYNM1YDoMA_hfSzfLVH';
const LAGRING_NYCKEL = 'jultidningar.nyckel';
const LAGRING_DATA = 'jultidningar.data';

const $ = id => document.getElementById(id);
const kr = n => Math.round(Number(n) || 0).toLocaleString('sv-SE') + ' kr';

let nyckel = null;
let data = { nivaer: [], artiklar: [], kunder: [] };
let sortering = 'senaste';

function nivaFor(total) {
  const nivaer = [...(data.nivaer || [])].sort((a, b) => a.ordning - b.ordning);
  return [...nivaer].reverse().find(n => total >= n.troskel_kr) || null;
}
function totalSalt() {
  return (data.kunder || []).reduce((s, k) => s + Number(k.summa_kr || 0), 0);
}

function artikel(nr) {
  const n = parseInt(String(nr).trim(), 10);
  return (data.artiklar || []).find(a => a.nr === n) || null;
}
let aktuellKund = null; // null = ny kund

// ---------- Nyckel ----------
function lasNyckel() {
  const m = location.hash.match(/nyckel=([A-Za-z0-9]+)/);
  if (m) { try { localStorage.setItem(LAGRING_NYCKEL, m[1]); } catch {} return m[1]; }
  try { return localStorage.getItem(LAGRING_NYCKEL); } catch { return null; }
}

// ---------- API ----------
async function rpc(fn, args) {
  const svar = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_nyckel: nyckel, ...args })
  });
  if (!svar.ok) {
    let msg = 'Något gick fel';
    try { msg = (await svar.json()).message || msg; } catch {}
    throw new Error(msg);
  }
  const text = await svar.text();
  return text ? JSON.parse(text) : null;
}

async function hamta() {
  try {
    data = await rpc('hamta_allt', {});
    try { localStorage.setItem(LAGRING_DATA, JSON.stringify(data)); } catch {}
    $('offline-info').hidden = true;
  } catch (e) {
    try { const c = localStorage.getItem(LAGRING_DATA); if (c) data = JSON.parse(c); } catch {}
    $('offline-info').hidden = false;
    if (e.message === 'Fel nyckel') { visa('vy-nyckel'); return; }
    toast('Kunde inte hämta: ' + e.message, true);
  }
  ritaStart();
}

// ---------- Vyer ----------
function visa(id) {
  for (const v of document.querySelectorAll('.vy')) v.hidden = v.id !== id;
  window.scrollTo(0, 0);
}

function toast(text, fel = false) {
  const t = $('toast');
  t.textContent = text; t.className = 'toast' + (fel ? ' fel' : ''); t.hidden = false;
  clearTimeout(t._timer); t._timer = setTimeout(() => t.hidden = true, fel ? 4000 : 2000);
}

// ---------- Startsida ----------
function ritaStart() {
  const total = totalSalt();
  const nivaer = [...(data.nivaer || [])].sort((a, b) => a.ordning - b.ordning);
  const nuvarande = nivaFor(total);
  const nasta = nivaer.find(n => total < n.troskel_kr) || null;

  $('total').textContent = kr(total);
  $('niva').textContent = nuvarande ? nuvarande.namn : 'Ingen än';
  if (nasta) {
    $('nasta-etikett').textContent = 'Kvar till ' + (isNaN(nasta.namn) ? nasta.namn : 'nivå ' + nasta.namn);
    $('kvar').textContent = kr(nasta.troskel_kr - total);
    const start = nuvarande ? nuvarande.troskel_kr : 0;
    const andel = Math.max(0, Math.min(1, (total - start) / (nasta.troskel_kr - start)));
    $('stapel-fyll').style.width = Math.round(andel * 100) + '%';
  } else {
    $('nasta-etikett').textContent = 'Högsta nivån';
    $('kvar').textContent = '🌟';
    $('stapel-fyll').style.width = '100%';
  }
  $('nivalista').innerHTML = nivaer.map(n =>
    `<span class="${total >= n.troskel_kr ? 'klar' : ''}">${n.namn} · ${n.troskel_kr.toLocaleString('sv-SE')}</span>`).join('');

  ritaKundlista();
}

function ritaKundlista() {
  const bara = $('filter-ej-levererade').checked;
  const kunder = data.kunder.filter(k => !bara || !k.levererad);
  if (sortering === 'storst') kunder.sort((a, b) => Number(b.summa_kr) - Number(a.summa_kr));
  else kunder.sort((a, b) => new Date(b.skapad) - new Date(a.skapad));
  $('kundrubrik').textContent = `Kunder (${kunder.length})`;
  const ul = $('kundlista');
  ul.innerHTML = '';
  if (!kunder.length) {
    ul.innerHTML = `<li class="tom">${bara ? 'Alla är levererade 🎉' : 'Inga kunder än. Tryck på Ny kund.'}</li>`;
    return;
  }
  for (const k of kunder) {
    const li = document.createElement('li');
    li.className = k.levererad ? 'levererad' : '';
    const antal = (k.rader || []).reduce((s, r) => s + Number(r.antal || 0), 0);
    li.innerHTML = `
      <button class="lev ${k.levererad ? 'ja' : ''}" aria-label="Levererad">✓</button>
      <div class="info">
        <div class="namn"></div>
        <div class="detalj"></div>
      </div>
      <div class="summa">${kr(k.summa_kr)}</div>`;
    li.querySelector('.namn').textContent = k.namn;
    li.querySelector('.detalj').textContent = [k.adress, antal ? `${antal} st` : ''].filter(Boolean).join(' · ');
    li.querySelector('.lev').addEventListener('click', e => { e.stopPropagation(); vaxlaLevererad(k); });
    li.querySelector('.info').addEventListener('click', () => oppnaKund(k));
    li.querySelector('.summa').addEventListener('click', () => oppnaKund(k));
    ul.appendChild(li);
  }
}

async function vaxlaLevererad(k) {
  const nytt = !k.levererad;
  k.levererad = nytt; ritaStart();
  try { await rpc('satt_levererad', { p_id: k.id, p_levererad: nytt }); }
  catch (e) { k.levererad = !nytt; ritaStart(); toast('Kunde inte spara: ' + e.message, true); }
}

// ---------- Kundskärm ----------
function oppnaKund(k) {
  aktuellKund = k || null;
  $('kundtitel').textContent = k ? 'Kund' : 'Ny kund';
  $('f-namn').value = k ? k.namn : '';
  $('f-mobil').value = k ? k.mobil : '';
  $('f-adress').value = k ? k.adress : '';
  $('f-levererad').checked = k ? !!k.levererad : false;
  $('knapp-ta-bort').hidden = !k;
  $('rader').innerHTML = '';
  const rader = k && k.rader && k.rader.length
    ? k.rader.flatMap(r => Array.from({ length: Math.max(1, Number(r.antal) || 1) }, () => ({ ...r, antal: 1 }))) // äldre rader med antal > 1 blir flera rader
    : [{}];
  rader.forEach(r => laggTillRad(r));
  if (k && k.rader && k.rader.length) laggTillRad({}); // tom rad sist för att lägga till
  raknaSumma();
  history.pushState({ vy: 'kund' }, '');
  visa('vy-kund');
  if (!k) setTimeout(() => $('f-namn').focus(), 50);
}

function laggTillRad(r = {}) {
  const div = document.createElement('div');
  div.className = 'rad';
  div.innerHTML = `
    <input type="text" inputmode="numeric" class="r-nr" placeholder="Nr" enterkeyhint="next">
    <input type="number" inputmode="decimal" class="r-pris" min="0" step="1" placeholder="kr" enterkeyhint="done">
    <button type="button" class="bort" aria-label="Ta bort rad">×</button>
    <div class="artnamn"></div>`;
  div.querySelector('.r-nr').value = r.artikelnr || '';
  div.querySelector('.r-pris').value = r.pris_kr != null && r.artikelnr ? Number(r.pris_kr) : '';
  div.querySelector('.bort').addEventListener('click', () => { div.remove(); if (!$('rader').children.length) laggTillRad({}); raknaSumma(); });
  const visaNamn = () => {
    const nr = div.querySelector('.r-nr').value.trim();
    const a = artikel(nr);
    const el = div.querySelector('.artnamn');
    el.textContent = !nr ? '' : a ? a.namn : 'Okänt nummer, skriv priset själv';
    el.className = 'artnamn' + (nr && !a ? ' okand' : '');
  };
  div.querySelector('.r-nr').addEventListener('input', () => {
    // Nytt tomt radfält när sista raden fylls i
    const alla = [...$('rader').querySelectorAll('.rad')];
    if (alla[alla.length - 1] === div && div.querySelector('.r-nr').value.trim()) laggTillRad({});
    const a = artikel(div.querySelector('.r-nr').value);
    if (a) div.querySelector('.r-pris').value = a.pris_kr; // pris från katalogen, går att ändra
    visaNamn();
  });
  visaNamn();
  div.addEventListener('input', raknaSumma);
  for (const inp of div.querySelectorAll('input')) inp.addEventListener('focus', () => setTimeout(() => inp.select(), 0)); // markera innehållet så man skriver över
  $('rader').appendChild(div);
}

function lasRader() {
  return [...$('rader').querySelectorAll('.rad')].map(d => ({
    artikelnr: d.querySelector('.r-nr').value.trim(),
    antal: 1,
    pris_kr: parseFloat(String(d.querySelector('.r-pris').value).replace(',', '.')) || 0
  })).filter(r => r.artikelnr || r.pris_kr);
}

function raknaSumma() {
  $('f-summa').textContent = kr(lasRader().reduce((s, r) => s + r.antal * r.pris_kr, 0));
}

async function sparaKund(e) {
  e.preventDefault();
  const kund = {
    id: aktuellKund ? aktuellKund.id : null,
    namn: $('f-namn').value.trim(),
    mobil: $('f-mobil').value.trim(),
    adress: $('f-adress').value.trim(),
    levererad: $('f-levererad').checked,
    rader: lasRader()
  };
  if (!kund.namn) { toast('Skriv ett namn', true); $('f-namn').focus(); return; }
  const knapp = $('knapp-spara');
  knapp.disabled = true; knapp.textContent = 'Sparar…';
  const nivaFore = nivaFor(totalSalt());
  try {
    await rpc('spara_kund', { p_kund: kund });
    toast('Sparat ✓');
    stangKund();
    await hamta();
    const nivaEfter = nivaFor(totalSalt());
    if (nivaEfter && (!nivaFore || nivaEfter.ordning > nivaFore.ordning)) visaFest(nivaEfter);
  } catch (err) {
    toast('Kunde inte spara: ' + err.message + '. Försök igen.', true);
  } finally {
    knapp.disabled = false; knapp.textContent = 'Spara';
  }
}

async function taBortKund() {
  if (!aktuellKund) return;
  if (!confirm(`Ta bort ${aktuellKund.namn} och alla rader?`)) return;
  try {
    await rpc('ta_bort_kund', { p_id: aktuellKund.id });
    toast('Borttagen');
    stangKund();
    await hamta();
  } catch (err) { toast('Kunde inte ta bort: ' + err.message, true); }
}

function stangKund() {
  if (history.state && history.state.vy === 'kund') history.back(); else visa('vy-start');
}

// ---------- Ny nivå: vit skärm med konfetti ----------
let konfettiTimer = null;
function visaFest(niva) {
  $('festniva').textContent = niva.namn;
  $('vy-fest').hidden = false;
  startaKonfetti();
}
function stangFest() {
  $('vy-fest').hidden = true;
  cancelAnimationFrame(konfettiTimer);
}
function startaKonfetti() {
  const c = $('konfetti');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr; ctx.scale(dpr, dpr);
  const W = c.clientWidth, H = c.clientHeight;
  const farger = ['#b3261e', '#e0a12a', '#2e7d32', '#1e88e5', '#ffd666', '#ff7043'];
  const bitar = Array.from({ length: 160 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H, w: 6 + Math.random() * 6, h: 10 + Math.random() * 8,
    f: farger[Math.floor(Math.random() * farger.length)], v: 2 + Math.random() * 3,
    s: (Math.random() - 0.5) * 2, r: Math.random() * Math.PI, rv: (Math.random() - 0.5) * 0.2
  }));
  let start = performance.now();
  const rita = t => {
    ctx.clearRect(0, 0, W, H);
    for (const b of bitar) {
      b.y += b.v; b.x += b.s + Math.sin(t / 300 + b.r) * 0.6; b.r += b.rv;
      if (b.y > H + 20 && t - start < 6000) { b.y = -20; b.x = Math.random() * W; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.f; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    }
    if (bitar.some(b => b.y < H + 20)) konfettiTimer = requestAnimationFrame(rita);
  };
  cancelAnimationFrame(konfettiTimer);
  konfettiTimer = requestAnimationFrame(rita);
}

// ---------- Start ----------
function init() {
  nyckel = lasNyckel();
  if (!nyckel) { visa('vy-nyckel'); return; }
  history.replaceState({ vy: 'start' }, '');
  visa('vy-start');
  hamta();

  $('knapp-ny').addEventListener('click', () => oppnaKund(null));
  $('knapp-uppdatera').addEventListener('click', hamta);
  $('knapp-tillbaka').addEventListener('click', stangKund);
  $('kundform').addEventListener('submit', sparaKund);
  $('knapp-rad').addEventListener('click', () => { laggTillRad({}); $('rader').lastElementChild.querySelector('.r-nr').focus(); });
  $('knapp-ta-bort').addEventListener('click', taBortKund);
  $('knapp-fest-stang').addEventListener('click', stangFest);
  $('filter-ej-levererade').addEventListener('change', ritaKundlista);
  for (const b of document.querySelectorAll('.sortknapp')) b.addEventListener('click', () => {
    sortering = b.dataset.sort;
    for (const x of document.querySelectorAll('.sortknapp')) x.classList.toggle('aktiv', x === b);
    ritaKundlista();
  });
  window.addEventListener('popstate', () => visa((history.state && history.state.vy) === 'kund' ? 'vy-kund' : 'vy-start'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('vy-start').hidden) hamta(); });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('hashchange', () => { if (/nyckel=/.test(location.hash)) location.reload(); });
init();
