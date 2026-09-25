/* ReShape — сайт пилота.
   Все настройки в CONFIG. Пустой formEndpoint = демо-режим: анкета не уходит на сервер,
   а собирается в текст, который человек отправляет в Telegram сам. */

const CONFIG = {
  // Реле анкеты (POST JSON). Пусто — смотрим telegramBot, потом демо-режим.
  formEndpoint: '',
  // Временный прямой режим без реле: сайт сам шлёт анкету через Bot API.
  // Токен виден в исходнике страницы, поэтому только на время, пока реле не встало.
  telegramBot: { token: '8717084919:AAHnwcqgO3PRsyHZfO5bm7646Jv89VJhNgg', chatId: '7017655811' },
  // Куда ведут кнопки «Открыть Telegram» и ссылка в подвале.
  telegram: 'https://t.me/marchvlv',
  instagram: '',
  youtube: '',
  // Номер счётчика Яндекс.Метрики. Пусто — счётчик не грузится.
  metrikaId: '',
};

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const motion = document.documentElement.classList.contains('motion');

  /* ---------- Заголовки-афиши: каждая строка растягивается на ширину контейнера ---------- */
  function buildLines(el) {
    if (!el.dataset.linesDesktop) return;
    const mobile = el.clientWidth < 620;
    const src = mobile ? (el.dataset.linesMobile || el.dataset.linesDesktop) : el.dataset.linesDesktop;
    const key = mobile ? 'm' : 'd';
    if (el.dataset.built === key) return;
    const yellowFrom = el.dataset.yellowFrom;
    let yellow = false;
    el.innerHTML = src.split('|').map((t) => {
      if (yellowFrom && t.startsWith(yellowFrom)) yellow = true;
      return `<span class="ln${yellow ? ' ln--y' : ''}"><span class="w">${t}</span></span>`;
    }).join('');
    el.dataset.built = key;
  }
  function fitEl(el) {
    const max = parseFloat(el.dataset.fit) || 260;
    const width = el.clientWidth;
    $$('.ln', el).forEach((ln) => {
      const w = $('.w', ln);
      ln.style.fontSize = '100px';
      const measured = w.getBoundingClientRect().width;
      if (!measured) return;
      ln.style.fontSize = Math.min((width / measured) * 100, max).toFixed(2) + 'px';
    });
  }
  function fitAll() {
    $$('[data-fit]').forEach((el) => { buildLines(el); fitEl(el); });
  }
  fitAll();
  if (document.fonts) {
    document.fonts.load('900 100px "Unbounded"').then(fitAll, fitAll);
    document.fonts.addEventListener('loadingdone', fitAll);
  }
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitAll, 80); });

  /* ---------- Бегущие ленты: дублируем дорожку для бесшовной петли ---------- */
  $$('.track').forEach((track) => {
    const span = $('span', track);
    if (!span) return;
    const n = parseInt(track.dataset.repeat || '6', 10);
    const text = span.textContent;
    span.textContent = text.repeat(n);
    if (motion) track.appendChild(span.cloneNode(true));
  });

  /* ---------- Появление блоков при скролле ---------- */
  if (motion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    $$('.rv').forEach((el) => io.observe(el));
  } else {
    $$('.rv').forEach((el) => el.classList.add('in'));
  }

  /* ---------- Ссылки на площадки из CONFIG. Пустые скрываем. ---------- */
  $$('#footerLinks a[data-link]').forEach((a) => {
    const url = CONFIG[a.dataset.link];
    if (url) a.href = url; else a.remove();
  });
  const doneTg = $('#doneTg');
  if (doneTg) doneTg.href = CONFIG.telegram;
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Анкета ---------- */
  const form = $('#applyForm');
  if (!form) return;
  const params = new URLSearchParams(location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach((k) => {
    const el = form.elements[k];
    if (el) el.value = params.get(k) || '';
  });
  form.elements.referrer.value = document.referrer || '';
  form.elements.page.value = location.href.split('?')[0];

  if (CONFIG.metrikaId) {
    const s = document.createElement('script');
    s.src = 'https://mc.yandex.ru/metrika/tag.js';
    s.async = true;
    s.onload = () => {
      if (window.ym) window.ym(CONFIG.metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
    };
    document.head.appendChild(s);
  }
  const track = (goal) => { if (CONFIG.metrikaId && window.ym) window.ym(CONFIG.metrikaId, 'reachGoal', goal); };

  const labels = {
    name: 'Кто', scenario: 'Сценарий', times: 'Сколько раз за год', cost: 'Во что обходится',
    tried: 'Что пробовал', ready: 'Готовность к заданию', telegram: 'Telegram',
    utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign', utm_content: 'utm_content',
    referrer: 'Реферер', page: 'Страница',
  };

  function collect() {
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = String(v).trim(); });
    return data;
  }
  function toText(data) {
    const lines = ['Анкета ReShape'];
    Object.keys(labels).forEach((k) => { if (data[k]) lines.push(`${labels[k]}: ${data[k]}`); });
    return lines.join('\n');
  }

  const errorEl = $('#formError');
  const showError = (msg) => { errorEl.textContent = msg; errorEl.classList.add('is-visible'); };
  const hideError = () => { errorEl.textContent = ''; errorEl.classList.remove('is-visible'); };

  function validate() {
    const bad = $$('[required]', form).find((el) => {
      if (el.type === 'radio') return !form.querySelector(`[name="${el.name}"]:checked`);
      if (el.type === 'checkbox') return !el.checked;
      return !el.value.trim();
    });
    if (bad) {
      showError(bad.type === 'checkbox'
        ? 'Без согласия с офертой анкету не отправить: это нужно по закону.'
        : 'Заполни все поля, кроме «что пробовал». Без них я не смогу ответить по делу.');
      bad.focus();
      return false;
    }
    hideError();
    return true;
  }

  const block = $('#applyBlock');
  const done = $('#formDone');
  const doneTitle = $('#doneTitle');
  const doneText = $('#doneText');
  const submitBtn = $('#submitBtn');

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  function finish(mode, text) {
    block.classList.add('is-sent');
    done.classList.add('is-visible');
    if (mode === 'sent') {
      doneTitle.textContent = 'Анкета отправлена';
      doneText.textContent = 'Отвечу в течение суток в Telegram. Если через сутки тишина, напиши мне сам, значит, что-то сломалось.';
      doneTg.textContent = 'Открыть Telegram';
    } else {
      doneTitle.textContent = 'Анкета собрана';
      doneText.textContent = 'Текст анкеты скопирован. Открой Telegram, вставь его в сообщение мне и отправь. Отвечу в течение суток.';
      doneTg.textContent = 'Открыть Telegram и вставить';
      copy(text).then((ok) => {
        if (!ok) {
          doneText.textContent = 'Скопируй текст ниже, открой Telegram и отправь его мне. Отвечу в течение суток.';
          const pre = document.createElement('pre');
          pre.textContent = text;
          doneText.after(pre);
        }
      });
    }
    done.scrollIntoView({ block: 'start', behavior: motion ? 'smooth' : 'auto' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const data = collect();
    const text = toText(data);

    /* Скрытое поле заполняют только боты: делаем вид, что отправили. */
    if (data.website) { finish('sent', text); return; }

    const direct = CONFIG.telegramBot && CONFIG.telegramBot.token && CONFIG.telegramBot.chatId;
    if (!CONFIG.formEndpoint && !direct) {
      track('anketa_demo');
      finish('demo', text);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправляем…';
    try {
      let res;
      if (CONFIG.formEndpoint) {
        res = await fetch(CONFIG.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ...data, _subject: 'Анкета ReShape', text }),
        });
      } else {
        /* Простой запрос без preflight: form-urlencoded. */
        res = await fetch(`https://api.telegram.org/bot${CONFIG.telegramBot.token}/sendMessage`, {
          method: 'POST',
          body: new URLSearchParams({ chat_id: CONFIG.telegramBot.chatId, text: text.slice(0, 4000), disable_web_page_preview: 'true' }),
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      track('anketa_sent');
      finish('sent', text);
    } catch (err) {
      showError('Не отправилось. Попробуй ещё раз или напиши мне в Telegram, я подскажу.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить анкету';
    }
  });
})();
