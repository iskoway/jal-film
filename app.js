// ===== Утилиты =====
const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let s = hash(String(seed));
  return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0) / 4294967296;
}
const fmtDate = (d) => d.toISOString().slice(0, 10);
const som = (n) => `${n.toLocaleString("ru-RU")} сом`;
const WEEK = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const humanDate = (iso) => {
  const d = new Date(iso + "T00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${WEEK[d.getDay()]}`;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function days(n = 7) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    out.push(fmtDate(d));
  }
  return out;
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2500);
}

// ===== Хранилище (localStorage) =====
const store = {
  get(key, def) {
    try { return JSON.parse(localStorage.getItem("jf_" + key)) ?? def; } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem("jf_" + key, JSON.stringify(val)); } catch {}
  },
};
let city = store.get("city", "Бишкек");
let pending = null; // текущий заказ до оплаты

// ===== Сеансы =====
const cityCinemas = () => CINEMAS.filter((c) => c.city === city);

function sessionsFor(movie, date) {
  if (date < movie.start) return [];
  const result = [];
  for (const cinema of cityCinemas()) {
    const r = rng(`${movie.id}|${cinema.id}|${date}`);
    if (r() < 0.25) continue;
    const count = 2 + Math.floor(r() * 4);
    let hour = 10 + Math.floor(r() * 3);
    for (let i = 0; i < count && hour < 24; i++) {
      const hallIdx = Math.floor(r() * cinema.halls.length);
      const hall = cinema.halls[hallIdx];
      const format = hall === "IMAX" ? "IMAX" : hall.includes("3D") ? "3D" : r() < 0.3 ? "3D" : "2D";
      const min = [0, 10, 20, 30, 40, 50][Math.floor(r() * 6)];
      const time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const base = { "2D": 350, "3D": 450, IMAX: 600 }[format] + (hour >= 18 ? 100 : 0) + (hall === "VIP" ? 300 : 0);
      result.push({ id: [movie.id, cinema.id, date, time, hallIdx].join("~"), movie, cinema, hall, format, date, time, price: base });
      hour += Math.ceil(movie.duration / 60) + Math.floor(r() * 2);
    }
  }
  return result;
}

function parseSession(id) {
  const [movieId, cinemaId, date, time, hallIdx] = id.split("~");
  const movie = MOVIES.find((m) => m.id === +movieId);
  const s = movie && sessionsFor(movie, date).find((x) => x.id === id);
  if (s) return s;
  // если сменили город — достаём сеанс напрямую
  const cinema = CINEMAS.find((c) => c.id === cinemaId);
  if (!movie || !cinema) return null;
  return { id, movie, cinema, hall: cinema.halls[+hallIdx], format: "2D", date, time, price: 350 };
}

function isPast(session) {
  return new Date(`${session.date}T${session.time}`) < new Date();
}

// ===== Зал =====
function hallLayout(session) {
  const isVip = session.hall === "VIP";
  const rows = isVip ? 5 : session.hall === "IMAX" ? 12 : 9;
  const cols = isVip ? 8 : session.hall === "IMAX" ? 18 : 14;
  const r = rng("occ" + session.id);
  const booked = new Set(store.get("booked", {})[session.id] || []);
  const layout = [];
  for (let row = 1; row <= rows; row++) {
    const seats = [];
    const vipRow = !isVip && row === rows;
    const n = vipRow ? Math.floor(cols / 2) : cols;
    for (let s = 1; s <= n; s++) {
      const key = `${row}-${s}`;
      seats.push({
        key, row, seat: s,
        type: isVip || vipRow ? "vip" : "std",
        taken: booked.has(key) || r() < 0.28,
      });
    }
    layout.push(seats);
  }
  return layout;
}
const seatPrice = (session, seat) => (seat.type === "vip" && session.hall !== "VIP" ? Math.round(session.price * 1.8 / 10) * 10 : session.price);

// ===== Компоненты =====
const isSoon = (m) => m.start > days()[0];
const releaseLabel = (m) => {
  const d = new Date(m.start + "T00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

function poster(m, cls = "") {
  return `<div class="poster ${m.poster ? "poster--img" : ""} ${cls}" style="--c1:${m.colors[0]};--c2:${m.colors[1]}">
    ${m.poster
      ? `<img src="${m.poster}" alt="${esc(m.title)}" loading="lazy" />`
      : `<span class="poster__emoji">${m.emoji}</span><span class="poster__title">${esc(m.title)}</span>`}
    <span class="poster__age">${m.age}</span>
  </div>`;
}

function movieCard(m, date) {
  const soon = isSoon(m);
  const href = date ? `#/movie/${m.id}?d=${date}` : `#/movie/${m.id}`;
  return `<a class="card" href="${href}">
    ${poster(m)}
    <div class="card__body">
      <div class="card__title">${esc(m.title)}</div>
      <div class="muted">${m.genre.join(", ")}</div>
      ${soon ? `<div class="tag">с ${releaseLabel(m)}</div>` : `<div class="rating">★ ${m.rating}</div>`}
    </div>
  </a>`;
}

function dateTabs(active, base) {
  return `<div class="dates">${days().map((d, i) => {
    const dt = new Date(d + "T00:00");
    const label = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : WEEK[dt.getDay()];
    return `<a class="date ${d === active ? "active" : ""}" href="${base}?d=${d}">
      <small>${label}</small><b>${dt.getDate()}</b><small>${MONTHS[dt.getMonth()].slice(0, 3)}</small>
    </a>`;
  }).join("")}</div>`;
}

// ===== Страницы =====
function pageHome(q) {
  const date = q.d || days()[0];
  const showing = MOVIES.filter((m) => sessionsFor(m, date).length);
  const genres = [...new Set(showing.flatMap((m) => m.genre))];
  const g = q.g || "";
  const list = showing.filter((m) => !g || m.genre.includes(g));
  const hero = MOVIES[0];
  return `
    <section class="hero" style="--c1:${hero.colors[0]};--c2:${hero.colors[1]}${hero.poster ? `;--bg:url('${hero.poster}')` : ""}">
      <div class="hero__text">
        <div class="tag">Сейчас в кино</div>
        <h1>${esc(hero.title)}</h1>
        <p>${esc(hero.description)}</p>
        <a class="btn" href="#/movie/${hero.id}?d=${date}">Купить билет</a>
      </div>
      ${hero.poster ? `<img class="hero__poster" src="${hero.poster}" alt="${esc(hero.title)}" />` : `<div class="hero__emoji">${hero.emoji}</div>`}
    </section>
    <h2>Афиша · ${city}</h2>
    ${dateTabs(date, "#/")}
    <div class="chips">
      <a class="chip ${!g ? "active" : ""}" href="#/?d=${date}">Все</a>
      ${genres.map((x) => `<a class="chip ${g === x ? "active" : ""}" href="#/?d=${date}&g=${encodeURIComponent(x)}">${x}</a>`).join("")}
    </div>
    <div class="grid">${list.map((m) => movieCard(m, date)).join("") || `<p class="muted">На эту дату сеансов нет</p>`}</div>`;
}

function pageSoon() {
  return `<h2>Скоро в кино</h2>
    <div class="grid">${MOVIES.filter(isSoon).map((m) => movieCard(m)).join("") || `<p class="muted">Пока ничего не анонсировано</p>`}</div>`;
}

function pageCinemas() {
  return `<h2>Кинотеатры · ${city}</h2>
    <div class="list">${cityCinemas().map((c) => `
      <div class="panel">
        <h3>${esc(c.name)}</h3>
        <div class="muted">📍 ${esc(c.address)}</div>
        <div class="chips">${c.halls.map((h) => `<span class="chip">${h}</span>`).join("")}</div>
      </div>`).join("")}
    </div>`;
}

function pageMovie(id, q) {
  const m = MOVIES.find((x) => x.id === +id);
  if (!m) return notFound();
  // для будущей премьеры по умолчанию открываем день старта, если он в пределах недели
  const date = q.d || (isSoon(m) && days().includes(m.start) ? m.start : days()[0]);
  const sessions = sessionsFor(m, date);
  const inWeek = !isSoon(m) || days().includes(m.start);
  const byCinema = {};
  sessions.forEach((s) => (byCinema[s.cinema.id] ||= []).push(s));
  return `
    <a class="back" href="#/?d=${date}">← Афиша</a>
    <section class="movie">
      ${poster(m, "poster--big")}
      <div>
        <h1>${esc(m.title)} <span class="age">${m.age}</span></h1>
        <div class="muted">${esc(m.original)} · ${m.year} · ${m.country}</div>
        <div class="meta">
          ${m.rating ? `<span class="rating">★ ${m.rating}</span>` : ""}
          <span>${m.genre.join(", ")}</span>
          <span>${Math.floor(m.duration / 60)} ч ${m.duration % 60} мин</span>
        </div>
        <p>${esc(m.description)}</p>
        ${isSoon(m) ? `<div class="tag">В прокате с ${releaseLabel(m)}</div>` : ""}
      </div>
    </section>
    ${!inWeek ? "" : `
      <h2>Расписание</h2>
      ${dateTabs(date, `#/movie/${m.id}`)}
      ${Object.values(byCinema).map((list) => `
        <div class="panel">
          <h3>${esc(list[0].cinema.name)}</h3>
          <div class="muted">📍 ${esc(list[0].cinema.address)}</div>
          <div class="times">${list.map((s) => isPast(s)
            ? `<span class="time disabled"><b>${s.time}</b><small>${s.format} · ${s.hall}</small></span>`
            : `<a class="time" href="#/session/${encodeURIComponent(s.id)}">
                <b>${s.time}</b><small>${s.format} · ${s.hall}</small><small class="price">от ${s.price} с</small>
              </a>`).join("")}
          </div>
        </div>`).join("") || `<p class="muted">${date < m.start ? `Сеансы появятся с ${releaseLabel(m)}` : "На эту дату сеансов нет"}</p>`}`}`;
}

function pageSession(id) {
  const s = parseSession(decodeURIComponent(id));
  if (!s) return notFound();
  const layout = hallLayout(s);
  const vipPrice = seatPrice(s, { type: "vip" });
  setTimeout(() => bindSeats(s, layout));
  return `
    <a class="back" href="#/movie/${s.movie.id}?d=${s.date}">← ${esc(s.movie.title)}</a>
    <div class="session-head">
      <div>
        <h2>${esc(s.movie.title)} <span class="age">${s.movie.age}</span></h2>
        <div class="muted">${esc(s.cinema.name)} · ${s.hall} · ${s.format}</div>
      </div>
      <div class="session-when"><b>${s.time}</b><span>${humanDate(s.date)}</span></div>
    </div>
    <div class="hall">
      <div class="screen">Экран</div>
      ${layout[0].length > 14 ? `<div class="hall-hint">← схему можно листать →</div>` : ""}
      <div class="seats" style="--cols:${layout[0].length * (layout[0][0].type === "vip" ? 2 : 1)}">
        ${layout.map((row) => `
          <div class="row">
            <span class="row__num">${row[0].row}</span>
            <div class="row__seats">${row.map((seat) => `
              <button class="seat ${seat.type} ${seat.taken ? "taken" : ""}" data-key="${seat.key}"
                ${seat.taken ? "disabled" : ""} title="Ряд ${seat.row}, место ${seat.seat} — ${seatPrice(s, seat)} сом">${seat.seat}</button>`).join("")}
            </div>
            <span class="row__num">${row[0].row}</span>
          </div>`).join("")}
      </div>
      <div class="legend">
        <span><i class="seat std"></i> Стандарт · ${s.price} с</span>
        <span><i class="seat vip"></i> ${s.hall === "VIP" ? "VIP-кресло" : "Диван VIP"} · ${vipPrice} с</span>
        <span><i class="seat taken"></i> Занято</span>
        <span><i class="seat selected"></i> Выбрано</span>
      </div>
    </div>
    <div class="summary" id="summary"></div>`;
}

function bindSeats(s, layout) {
  const flat = layout.flat();
  const selected = new Map();
  const summary = $("#summary");
  const render = () => {
    const list = [...selected.values()];
    const total = list.reduce((a, x) => a + seatPrice(s, x), 0);
    summary.innerHTML = list.length
      ? `<div class="summary__seats">${list.map((x) => `<span class="chip">Ряд ${x.row}, место ${x.seat}</span>`).join("")}</div>
         <div class="summary__total"><span>${list.length} бил. · <b>${som(total)}</b></span>
         <button class="btn" id="toCheckout">Продолжить</button></div>`
      : `<div class="muted">Выберите места на схеме зала (до 8 мест)</div>`;
    const btn = $("#toCheckout");
    if (btn) btn.onclick = () => {
      pending = { session: s, seats: list, total };
      location.hash = "#/checkout";
    };
  };
  app.querySelectorAll(".seat[data-key]").forEach((el) => {
    el.onclick = () => {
      const key = el.dataset.key;
      if (selected.has(key)) { selected.delete(key); el.classList.remove("selected"); }
      else {
        if (selected.size >= 8) return toast("Максимум 8 мест за один заказ");
        selected.set(key, flat.find((x) => x.key === key));
        el.classList.add("selected");
      }
      render();
    };
  });
  render();
}

function pageCheckout() {
  if (!pending) { location.hash = "#/"; return ""; }
  const { session: s, seats, total } = pending;
  const fee = Math.round(total * 0.03);
  setTimeout(() => {
    const form = $("#payForm");
    form.onsubmit = (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const btn = $("#payBtn");
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Обработка платежа…`;
      setTimeout(() => finishOrder(data, fee), 1600);
    };
    form.querySelectorAll("input[name=method]").forEach((r) =>
      (r.onchange = () => ($("#cardFields").hidden = r.value !== "card" || !r.checked)));
  });
  return `
    <a class="back" href="#/session/${encodeURIComponent(s.id)}">← Выбор мест</a>
    <h2>Оформление заказа</h2>
    <div class="checkout">
      <form id="payForm" class="panel">
        <h3>Контакты</h3>
        <label>Телефон<input name="phone" required placeholder="+996 700 123 456" pattern="[+0-9 ()-]{9,}" /></label>
        <label>Email (для билета)<input name="email" type="email" placeholder="you@mail.kg" /></label>
        <h3>Способ оплаты</h3>
        <div class="methods">
          ${[["card", "💳 Банковская карта", "Visa / Mastercard / Элкарт"], ["mbank", "📱 MBank", "Оплата через приложение"], ["odengi", "🟣 O!Деньги", "Электронный кошелёк"], ["megapay", "🟢 MegaPay", "Электронный кошелёк"]]
            .map(([v, t, d], i) => `<label class="method"><input type="radio" name="method" value="${v}" ${i === 0 ? "checked" : ""} /><span><b>${t}</b><small>${d}</small></span></label>`).join("")}
        </div>
        <div id="cardFields" class="card-fields">
          <label>Номер карты<input placeholder="4169 0000 0000 0000" inputmode="numeric" /></label>
          <div class="two">
            <label>Срок<input placeholder="12/28" /></label>
            <label>CVV<input placeholder="•••" type="password" maxlength="3" /></label>
          </div>
        </div>
        <label class="check"><input type="checkbox" required checked /> Согласен с правилами покупки</label>
        <button class="btn btn--wide" id="payBtn">Оплатить ${som(total + fee)}</button>
        <div class="muted small">Демо: деньги не списываются</div>
      </form>
      <aside class="panel order">
        ${poster(s.movie, "poster--small")}
        <h3>${esc(s.movie.title)}</h3>
        <div class="muted">${esc(s.cinema.name)}<br>${s.hall} · ${s.format}<br>${humanDate(s.date)}, ${s.time}</div>
        <ul>${seats.map((x) => `<li><span>Ряд ${x.row}, место ${x.seat}</span><span>${som(seatPrice(s, x))}</span></li>`).join("")}
          <li class="muted"><span>Сервисный сбор</span><span>${som(fee)}</span></li>
          <li class="total"><span>Итого</span><span>${som(total + fee)}</span></li>
        </ul>
      </aside>
    </div>`;
}

function finishOrder(data, fee) {
  const { session: s, seats, total } = pending;
  const id = "JF" + Date.now().toString(36).toUpperCase().slice(-6);
  const order = {
    id, sessionId: s.id, movieId: s.movie.id, title: s.movie.title, cinema: s.cinema.name, address: s.cinema.address,
    hall: s.hall, format: s.format, date: s.date, time: s.time, seats: seats.map((x) => ({ row: x.row, seat: x.seat })),
    total: total + fee, phone: data.phone, method: data.method, createdAt: Date.now(),
  };
  const orders = store.get("orders", []);
  orders.unshift(order);
  store.set("orders", orders);
  const booked = store.get("booked", {});
  booked[s.id] = [...(booked[s.id] || []), ...seats.map((x) => x.key)];
  store.set("booked", booked);
  pending = null;
  updateBadge();
  location.hash = `#/ticket/${id}`;
}

function qr(text, size = 25) {
  const r = rng(text);
  const finder = (x, y) => {
    for (const [fx, fy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      const dx = x - fx, dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7)
        return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
    }
    return null;
  };
  let rects = "";
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const f = finder(x, y);
      if (f ?? r() < 0.5) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
  return `<svg viewBox="-2 -2 ${size + 4} ${size + 4}" class="qr"><rect x="-2" y="-2" width="${size + 4}" height="${size + 4}" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}

function ticketView(o) {
  const m = MOVIES.find((x) => x.id === o.movieId) || { colors: ["#1f2230", "#3a3f52"] };
  return `
    <div class="ticket">
      <div class="ticket__main" style="--c1:${m.colors[0]};--c2:${m.colors[1]}${m.poster ? `;--bg:url('${m.poster}')` : ""}">
        <div class="ticket__brand">Джал<b>Фильм</b></div>
        <h2>${esc(o.title)}</h2>
        <div class="ticket__grid">
          <div><small>Дата</small><b>${humanDate(o.date)}</b></div>
          <div><small>Начало</small><b>${o.time}</b></div>
          <div><small>Зал</small><b>${o.hall} · ${o.format}</b></div>
          <div><small>Места</small><b>${o.seats.map((x) => `${x.row} ряд ${x.seat} м`).join(", ")}</b></div>
        </div>
        <div class="ticket__cinema">${esc(o.cinema)} · ${esc(o.address)}</div>
      </div>
      <div class="ticket__stub">
        ${qr(o.id)}
        <b>${o.id}</b>
        <small>${som(o.total)}</small>
      </div>
    </div>`;
}

function pageTicket(id) {
  const o = store.get("orders", []).find((x) => x.id === id);
  if (!o) return notFound();
  return `
    <div class="success">
      <div class="success__icon">✓</div>
      <h2>Оплата прошла успешно!</h2>
      <p class="muted">Покажите QR-код на входе в зал. Билет также сохранён в разделе «Мои билеты».</p>
    </div>
    ${ticketView(o)}
    <div class="center"><a class="btn btn--ghost" href="#/">На главную</a> <a class="btn" href="#/tickets">Мои билеты</a></div>`;
}

function pageTickets() {
  const orders = store.get("orders", []);
  if (!orders.length) return `<h2>Мои билеты</h2><div class="panel center"><p class="muted">У вас пока нет билетов</p><a class="btn" href="#/">Выбрать фильм</a></div>`;
  return `<h2>Мои билеты</h2>${orders.map(ticketView).join("")}
    <div class="center"><button class="btn btn--ghost" id="clearTickets">Очистить демо-данные</button></div>`;
}

const notFound = () => `<div class="panel center"><h2>Страница не найдена</h2><a class="btn" href="#/">На главную</a></div>`;

// ===== Роутер =====
function router() {
  const [path, qs] = location.hash.slice(1).split("?");
  const q = Object.fromEntries(new URLSearchParams(qs || ""));
  const parts = (path || "/").split("/").filter(Boolean);
  let html;
  switch (parts[0]) {
    case undefined: html = pageHome(q); break;
    case "soon": html = pageSoon(); break;
    case "cinemas": html = pageCinemas(); break;
    case "movie": html = pageMovie(parts[1], q); break;
    case "session": html = pageSession(parts[1]); break;
    case "checkout": html = pageCheckout(); break;
    case "ticket": html = pageTicket(parts[1]); break;
    case "tickets": html = pageTickets(); break;
    default: html = notFound();
  }
  if (html !== "") app.innerHTML = html;
  document.querySelectorAll(".nav a, .tabbar a").forEach((a) => {
    const target = a.getAttribute("href").slice(1);
    a.classList.toggle("active", target === "/" ? !parts[0] : ("/" + (parts[0] || "")) === target);
  });
  const clr = $("#clearTickets");
  if (clr) clr.onclick = () => { store.set("orders", []); store.set("booked", {}); updateBadge(); router(); };
  if (!q.d || parts[0] !== undefined) window.scrollTo(0, 0);
}

function updateBadge() {
  const n = store.get("orders", []).length;
  document.querySelectorAll(".ticket-count").forEach((b) => {
    b.textContent = n;
    b.hidden = !n;
  });
}

$("#city").value = city;
$("#city").onchange = (e) => {
  city = e.target.value;
  store.set("city", city);
  router();
};
window.addEventListener("hashchange", router);
updateBadge();
router();
