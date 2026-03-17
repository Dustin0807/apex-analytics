/* ============================================================
   APEX ANALYTICS — Universal Renderer v2
   apex.js — reads JSON, renders all pages
   ============================================================ */

'use strict';

/* ── SMALL HELPERS ───────────────────────────────────────── */

const $ = id => document.getElementById(id);

function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls)  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function params() {
  const p = new URLSearchParams(location.search);
  return {
    series : p.get('series') || 'f1',
    round  : parseInt(p.get('round'))  || null,
    year   : parseInt(p.get('year'))   || null,
    id     : p.get('id')     || null,
    a      : p.get('a')      || null,
    b      : p.get('b')      || null,
  };
}

async function loadJSON(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } catch(e) {
    console.error('loadJSON:', path, e.message);
    return null;
  }
}

function fmtDate(str) {
  if (!str) return 'TBD';
  const d = new Date(str + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const n = parseInt(hex, 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

function setAccent(color) {
  const rgb = hexToRgb(color);
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-rgb', rgb);
  // Update bg gradient element if present
  const bg = document.getElementById('bg-radial');
  if (bg) bg.style.setProperty('--accent-rgb', rgb);
}

/* ── RACE STATUS ─────────────────────────────────────────── */

function raceStatus(race) {
  if (race.complete) return 'done';
  if (!race.date)    return 'upcoming';
  const now      = new Date();
  const raceTime = new Date(`${race.date}T${race.time_utc || '12:00'}Z`);
  if (now >= raceTime) return 'analyzing';
  if (race.date === now.toISOString().slice(0, 10)) return 'today';
  return 'upcoming';
}

/* ── STATUS BADGE HTML ───────────────────────────────────── */

function statusBadge(status) {
  const map = {
    running : ['status-run',   'Running'   ],
    crash   : ['status-crash', 'Accident'  ],
    mech    : ['status-mech',  'Mechanical'],
    dnf     : ['status-dnf',   'DNF'       ],
    dns     : ['status-dnf',   'DNS'       ],
    dsq     : ['status-dnf',   'DSQ'       ],
  };
  const [cls, label] = map[status] || ['status-dnf', status || '—'];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

/* ── CHART SHARED OPTIONS ────────────────────────────────── */

function chartOpts(overrides) {
  return Object.assign({
    responsive : true,
    plugins    : { legend: { display: false } },
    scales     : {
      x: { grid: { color:'rgba(255,255,255,.04)' }, ticks: { color:'rgba(237,234,246,.35)', font:{ family:'JetBrains Mono', size:9 } } },
      y: { grid: { color:'rgba(255,255,255,.04)' }, ticks: { color:'rgba(237,234,246,.35)', font:{ family:'JetBrains Mono', size:9 } } },
    }
  }, overrides || {});
}

function posTrackerOpts(maxPos) {
  return {
    responsive : true,
    spanGaps   : true,
    plugins    : {
      legend: { display:true, labels:{ color:'rgba(237,234,246,.45)', font:{ family:'JetBrains Mono', size:9 }, boxWidth:12 } }
    },
    scales: {
      x: { grid:{ color:'rgba(255,255,255,.04)' }, ticks:{ color:'rgba(237,234,246,.35)', font:{ family:'JetBrains Mono', size:9 } } },
      y: {
        reverse:true, min:1, max: maxPos || 20,
        grid:{ color:'rgba(255,255,255,.04)' },
        ticks:{ color:'rgba(237,234,246,.35)', font:{ family:'JetBrains Mono', size:9 }, stepSize:5 },
        title:{ display:true, text:'Position', color:'rgba(237,234,246,.2)', font:{ family:'JetBrains Mono', size:8 } }
      }
    }
  };
}

/* ── TAB SYSTEM ──────────────────────────────────────────── */

function initTabs(barId, contentId) {
  const bar     = $(barId);
  const content = $(contentId);
  if (!bar || !content) return;

  bar.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      content.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = $('panel-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });
}

/* ══════════════════════════════════════════════════════════
   SECTION RENDERERS
   Each returns an HTML string or mutates a container element.
══════════════════════════════════════════════════════════ */

/* ── HERO ─────────────────────────────────────────────────── */

function renderHero(race, series) {
  const status    = raceStatus(race);
  const winner    = race.race?.winner    || null;
  const winnerNum = race.race?.results?.[0]?.number || '?';
  const winnerTeam= race.race?.results?.[0]?.team   || '';

  const chips = [];
  if (status === 'analyzing')
    chips.push(`<span class="chip red">⚡ Analyzing</span>`);
  if (status === 'today')
    chips.push(`<span class="chip accent">🏁 Race Day</span>`);
  if (race.sprint_weekend && series.id === 'f1')
    chips.push(`<span class="chip accent">Sprint Weekend</span>`);
  if (race.race?.margin)
    chips.push(`<span class="chip accent">Margin: ${race.race.margin}</span>`);
  if (race.race?.cautions != null)
    chips.push(`<span class="chip">${race.race.cautions} Cautions</span>`);

  const right = winner
    ? `<div class="hero-right">
        <div class="hero-label">Race Winner</div>
        <div class="hero-winner-name">${winner.split(' ').pop()}</div>
        <div class="hero-winner-sub">#${winnerNum} · ${winnerTeam}</div>
        <div class="hero-winner-num">${winnerNum}</div>
       </div>`
    : `<div class="hero-right" style="opacity:.35">
        <div class="hero-label">${status === 'analyzing' ? 'Analyzing' : 'Upcoming'}</div>
        <div class="hero-winner-name" style="font-size:28px;color:var(--dim)">TBD</div>
       </div>`;

  // Split last word of race name onto accent span
  const titleParts = race.name.split(' ');
  const lastWord   = titleParts.pop();
  const titleHtml  = titleParts.join(' ') + (titleParts.length ? ' ' : '')
                   + `<span class="acc">${lastWord}</span>`;

  return `
    <div class="hero-bg-word">${(race.location || race.venue || '').split(',')[0].toUpperCase().slice(0,4)}</div>
    <div>
      <div class="hero-eyebrow">${series.name} · Round ${race.round} · ${race.venue_id ? `<a href="venue.html?series=${race.series_id || 'f1'}&id=${race.venue_id}" style="color:inherit;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.2);transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(255,255,255,.2)'">${race.venue}</a>` : race.venue} · ${fmtDate(race.date)}</div>
      <h1 class="hero-h1">${titleHtml}</h1>
      <p class="hero-deck">${race.summary || 'Race analysis coming soon.'}</p>
      <div class="hero-chips">${chips.join('')}</div>
    </div>
    ${right}`;
}

/* ── STATS BAR ───────────────────────────────────────────── */

function renderStatsBar(race) {
  const bar = document.getElementById('stats-bar');
  if (!race.stats || !race.stats.length) {
    if (bar) bar.style.display = 'none';
    return '';
  }
  if (bar) bar.style.display = '';
  return race.stats.slice(0, 5).map(s => `
    <div class="sb-cell">
      <div class="sb-v">${s.value}</div>
      <div class="sb-l">${s.label}</div>
    </div>`).join('');
}

/* ── OVERVIEW TAB ────────────────────────────────────────── */

function renderOverview(race, series) {
  const status = raceStatus(race);

  const banner = status !== 'done'
    ? `<div class="tbd-banner" style="margin-bottom:16px">
        <div style="font-size:22px">${status === 'analyzing' ? '⚡' : '🏁'}</div>
        <div>
          <div class="tb-head">${status === 'analyzing'
            ? 'ANALYZING — Race complete, data incoming'
            : 'RACE DAY — ' + fmtDate(race.date)}</div>
          <div class="tb-sub">${status === 'analyzing'
            ? 'Results will populate once confirmed.'
            : 'Race preview below. Full analysis after the event.'}</div>
        </div>
       </div>`
    : '';

  const cards = (race.story_cards || []).map(c => `
    <div class="card">
      <div class="card-title">${c.title}</div>
      <p>${c.body}</p>
    </div>`).join('');

  return `
    ${banner}
    <div class="sec-hd">
      <div class="sec-title">Race Story</div>
      <div class="sec-sub">${race.venue} · ${race.location} · ${fmtDate(race.date)}</div>
    </div>
    <div class="cards-2">
      ${cards || `<div class="card" style="grid-column:1/-1"><p style="color:var(--dim)">Race analysis incoming.</p></div>`}
    </div>`;
}

/* ── QUALIFYING TAB ──────────────────────────────────────── */

function renderQualifying(race, series) {
  if (!race.quali) {
    return `<div class="tbd-banner" style="margin-top:32px">
      <div style="font-size:20px">⏳</div>
      <div><div class="tb-head">Qualifying data not yet available</div></div>
    </div>`;
  }

  const q    = race.quali;
  const isF1 = series.id === 'f1';

  /* ── F1: Q1 / Q2 / Q3 knockout ── */
  if (isF1 && q.grid) {
    const q3  = q.grid.filter(d => !d.eliminated);
    const q2  = q.grid.filter(d => d.eliminated === 'Q2');
    const q1  = q.grid.filter(d => d.eliminated === 'Q1');

    const section = (title, drivers, timeKey) => {
      if (!drivers.length) return '';
      const rows = drivers.map(d => {
        const isPole  = d.pos === 1 && !d.eliminated;
        const gapPx   = d.gap ? Math.min(parseFloat(d.gap) * 24, 90) : 0;
        return `<tr class="${isPole ? 'pole-row' : ''}${d.eliminated ? ' elim-row' : ''}">
          <td><span class="col-pos ${isPole ? 'pp' : `p${d.pos}`}">${isPole ? 'PP' : d.pos}</span></td>
          <td class="col-num">${d.number}</td>
          <td class="col-driver">
            <span class="team-dot" style="background:${d.team_color || '#888'}"></span>${d.driver}
          </td>
          <td class="col-team">${d.team}</td>
          <td class="col-time${isPole ? ' pole' : ''}">${d[timeKey] ?? d.q3 ?? d.q2 ?? d.q1 ?? '—'}</td>
          <td>
            <div class="gap-bar-wrap">
              <span class="col-gap">${isPole ? 'POLE' : (d.gap || '—')}</span>
              ${!isPole && d.gap ? `<div class="gap-bar" style="width:${gapPx}px"></div>` : ''}
            </div>
          </td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">${d.note || ''}</td>
        </tr>`;
      }).join('');

      return `<table class="rt mt-2">
        <thead>
          <tr class="group-hd"><th colspan="7">${title}</th></tr>
          <tr><th>Grid</th><th>#</th><th>Driver</th><th>Constructor</th><th>Time</th><th>Gap</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    };

    const note = q.session_note
      ? `<div style="margin-top:8px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);line-height:1.8">${q.session_note}</div>`
      : '';
    const poleNote = q.pole_note
      ? `<div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--accent);margin-top:6px;opacity:.8">${q.pole_note}</div>`
      : '';

    return `
      <div class="sec-hd">
        <div class="sec-title">${q.session || 'Qualifying'}</div>
        <div class="sec-sub">Pole: ${q.pole_driver} · ${q.pole_time || ''}</div>
      </div>
      ${poleNote}
      ${section('Q3 — Top 10 Shootout', q3, 'q3')}
      ${section('Q2 Eliminated (P11–P15)', q2, 'q2')}
      ${section('Q1 Eliminated (P16–P20)', q1, 'q1')}
      ${note}`;
  }

  /* ── NASCAR: single speed list ── */
  if (q.grid) {
    const rows = q.grid.map(d => `
      <tr>
        <td><span class="col-pos p${d.pos}">${d.pos}</span></td>
        <td class="col-num">${d.number}</td>
        <td class="col-driver">${d.driver}</td>
        <td class="col-team">${d.team} · ${d.car || ''}</td>
        <td class="col-time${d.pos === 1 ? ' pole' : ''}">${d.speed ? d.speed + ' mph' : d.time || '—'}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">${d.note || ''}</td>
      </tr>`).join('');

    return `
      <div class="sec-hd">
        <div class="sec-title">${q.session || 'Qualifying'}</div>
        <div class="sec-sub">Pole: ${q.pole_driver} · ${q.pole_speed || q.pole_time || ''}</div>
      </div>
      <table class="rt mt-16">
        <thead><tr><th>Grid</th><th>#</th><th>Driver</th><th>Team</th><th>Speed</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  return `<div class="tbd-banner" style="margin-top:32px"><div style="font-size:20px">⏳</div><div><div class="tb-head">No qualifying data</div></div></div>`;
}

/* ── SPRINT TAB (F1) ─────────────────────────────────────── */

function renderSprint(race) {
  if (!race.sprint) {
    return `<div class="tbd-banner" style="margin-top:32px">
      <div style="font-size:20px">ℹ️</div>
      <div><div class="tb-head">Not a sprint weekend</div></div>
    </div>`;
  }

  const s    = race.sprint;
  const rows = (s.results || []).map(r => {
    const posN  = typeof r.pos === 'number';
    const pcls  = r.pos === 1 ? 'p1' : r.pos === 2 ? 'p2' : r.pos === 3 ? 'p3' : '';
    return `<tr>
      <td><span class="col-pos ${pcls}">${r.pos}</span></td>
      <td class="col-num">${r.number}</td>
      <td class="col-driver">${r.driver}</td>
      <td class="col-team">${r.team}</td>
      <td class="col-gap">${r.gap || (r.status ? statusBadge(r.status) : '—')}</td>
      <td class="col-pts" style="text-align:right">${r.points ?? '—'}</td>
    </tr>`;
  }).join('');

  const notes = s.notes
    ? `<div style="margin-top:8px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);line-height:1.8">${s.notes}</div>`
    : '';

  return `
    <div class="sec-hd">
      <div class="sec-title">Sprint Race</div>
      <div class="sec-sub">${fmtDate(s.date)} · ${s.laps} laps · Sprint pole: ${s.pole_driver} (${s.pole_time})</div>
    </div>
    <table class="rt">
      <thead><tr><th>Pos</th><th>#</th><th>Driver</th><th>Constructor</th><th>Gap</th><th style="text-align:right">Pts</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${notes}`;
}

/* ── RACE RESULTS TAB ────────────────────────────────────── */

function renderRaceResults(race, series) {
  if (!race.race) {
    return `<div class="tbd-banner" style="margin-top:32px">
      <div style="font-size:20px">⏳</div>
      <div>
        <div class="tb-head">Race result pending</div>
        <div class="tb-sub">${fmtDate(race.date)}</div>
      </div>
    </div>`;
  }

  const r      = race.race;
  const isF1   = series.id === 'f1';
  const isNasc = series.id.startsWith('nascar');

  const rows = (r.results || []).map(res => {
    const pcls = res.pos === 1 ? 'p1' : res.pos === 2 ? 'p2' : res.pos === 3 ? 'p3' : '';
    const llHi = (res.laps_led > 0) ? 'hi' : '';
    const noteHtml = res.note
      ? `<br><span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">${res.note}</span>`
      : '';

    return `<tr>
      <td><span class="col-pos ${pcls}">${res.pos}</span></td>
      <td class="col-num">${res.number}</td>
      <td class="col-driver">${res.driver}${noteHtml}</td>
      <td class="col-team">${res.team}${isNasc && res.car ? ' · ' + res.car : ''}</td>
      ${isNasc ? `<td>${statusBadge(res.status || 'running')}</td>` : ''}
      <td class="col-gap">${res.gap || (res.status && res.status !== 'running' ? statusBadge(res.status) : '—')}</td>
      <td class="col-ll ${llHi}">${res.laps_led ?? '—'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="sec-hd">
      <div class="sec-title">Race Classification</div>
      <div class="sec-sub">${r.laps || race.laps || '—'} laps · ${race.venue} · ${fmtDate(race.date)}</div>
    </div>
    <table class="rt">
      <thead><tr>
        <th>Pos</th><th>#</th><th>Driver</th><th>Team</th>
        ${isNasc ? '<th>Status</th>' : ''}
        <th style="text-align:right">Gap</th>
        <th style="text-align:right">Laps Led</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ── STAGES TAB (NASCAR) ─────────────────────────────────── */

function renderStages(race) {
  if (!race.stages) {
    return `<div class="tbd-banner" style="margin-top:32px">
      <div style="font-size:20px">⏳</div>
      <div><div class="tb-head">Stage results pending</div></div>
    </div>`;
  }

  const stageCards = race.stages.map((s, i) => {
    const isLast = i === race.stages.length - 1;
    return `<div class="stage-card ${isLast ? 'race-win' : ''}">
      <div class="sc-label">Stage ${s.number} · Laps ${s.laps}</div>
      <div class="sc-winner"${isLast ? ' style="color:var(--accent)"' : ''}>${s.winner}</div>
      <div class="sc-detail">#${s.number_car}${s.note ? ' · ' + s.note : ''}</div>
    </div>`;
  }).join('');

  /* laps-led chart data */
  const leaders = (race.race?.results || [])
    .filter(r => r.laps_led > 0)
    .sort((a, b) => b.laps_led - a.laps_led)
    .slice(0, 8);

  const chartHtml = leaders.length
    ? `<div class="sec-hd mt-32"><div class="sec-title">Laps Led</div></div>
       <div class="chart-card">
         <canvas id="chart-laps-led" style="max-height:240px"></canvas>
       </div>`
    : '';

  // Chart init runs after DOM insert (caller must call drawStagesChart)
  return `
    <div class="sec-hd">
      <div class="sec-title">Stage Results</div>
      <div class="sec-sub">${race.venue} · Stage points awarded to top 10 in each segment</div>
    </div>
    <div class="stage-cards">${stageCards}</div>
    ${chartHtml}`;
}

function drawStagesChart(race) {
  const ctx = $('chart-laps-led');
  if (!ctx) return;
  const leaders = (race.race?.results || [])
    .filter(r => r.laps_led > 0)
    .sort((a, b) => b.laps_led - a.laps_led)
    .slice(0, 8);
  if (!leaders.length) return;

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || '#FFD100';

  new Chart(ctx, {
    type : 'bar',
    data : {
      labels   : leaders.map(r => r.driver.split(' ').pop()),
      datasets : [{
        data            : leaders.map(r => r.laps_led),
        backgroundColor : leaders.map((_, i) => i === 0 ? accent + 'CC' : 'rgba(255,255,255,0.18)'),
        borderColor     : 'transparent',
        borderRadius    : 3,
      }],
    },
    options: chartOpts(),
  });
}

/* ── STRATEGY TAB (F1) ───────────────────────────────────── */

function renderStrategy(race) {
  if (!race.strategy) {
    return `<div class="tbd-banner" style="margin-top:32px">
      <div style="font-size:20px">⏳</div>
      <div><div class="tb-head">Strategy data not yet available</div></div>
    </div>`;
  }

  const s = race.strategy;
  const compColor = { M:'#FFD100', H:'#DEDEDE', S:'#FF4040', I:'#39B54A', W:'#0099FF' };
  const compName  = { M:'Medium',  H:'Hard',    S:'Soft',    I:'Inters',  W:'Wet'    };

  const legend = Object.entries(compName).map(([k,v]) => `
    <span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;
                 font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted)">
      <span style="width:10px;height:10px;border-radius:50%;background:${compColor[k]};display:inline-block"></span>${v}
    </span>`).join('');

  const stintBars = (s.stints || []).map(driver => {
    const bars = driver.compounds.map((c, i) => {
      const laps = driver.laps[i];
      const tc   = compColor[c] || '#888';
      const txtC = c === 'H' ? '#111' : 'rgba(0,0,0,.75)';
      return `<div style="flex:${laps};background:${tc};height:16px;margin:0 1px;
                           display:flex;align-items:center;justify-content:center;
                           font-family:'JetBrains Mono',monospace;font-size:8px;color:${txtC}">${laps}</div>`;
    }).join('');
    return `<div style="display:grid;grid-template-columns:90px 1fr;align-items:center;gap:12px;margin-bottom:6px">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);text-align:right">${driver.driver}</div>
      <div style="display:flex;border-radius:2px;overflow:hidden">${bars}</div>
    </div>`;
  }).join('');

  const scHtml = (s.vsc_laps?.length || s.sc_laps?.length)
    ? `<div class="chart-card mt-2">
        <div class="chart-label">Safety Periods</div>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          ${s.vsc_laps?.length ? `<div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-bottom:4px">VSC DEPLOYED</div>
            <div style="font-family:'Bebas Neue',display;font-size:16px;color:var(--yellow)">Laps ${s.vsc_laps.join(', ')}</div>
          </div>` : ''}
          ${s.sc_laps?.length ? `<div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-bottom:4px">SAFETY CAR</div>
            <div style="font-family:'Bebas Neue',display;font-size:16px;color:var(--red)">Laps ${s.sc_laps.join(', ')}</div>
          </div>` : ''}
        </div>
       </div>`
    : '';

  return `
    <div class="sec-hd">
      <div class="sec-title">Tyre Strategy</div>
      <div class="sec-sub">${race.venue} · Stint lengths in laps</div>
    </div>
    <div class="card" style="margin-bottom:2px">
      <p style="font-size:13px;line-height:1.75">${s.key_narrative || ''}</p>
    </div>
    <div class="chart-card mt-2">
      <div class="chart-label">Stint Breakdown</div>
      <div style="margin-bottom:14px">${legend}</div>
      ${stintBars || '<p style="color:var(--dim)">No stint data.</p>'}
    </div>
    ${scHtml}`;
}

/* ── STATS TAB ───────────────────────────────────────────── */

function renderStats(race, series, seriesData) {
  const bigNums = race.stats
    ? `<div class="big-nums">
        ${race.stats.map(s => `
          <div class="bn-cell">
            <div class="bn-v">${s.value}</div>
            <div class="bn-l">${s.label}</div>
            ${s.note ? `<div class="bn-note">${s.note}</div>` : ''}
          </div>`).join('')}
       </div>`
    : '';

  const tracker = race.position_tracker
    ? `<div class="charts-row full mt-2">
        <div class="chart-card">
          <div class="chart-label">Position Tracker — Key Drivers</div>
          <canvas id="chart-tracker" style="max-height:260px"></canvas>
        </div>
       </div>`
    : '';

  const champRow = race.race
    ? `<div class="charts-row mt-2">
        <div class="chart-card">
          <div class="chart-label">${series.id === 'f1' ? 'Driver Championship' : 'Points Standings'}</div>
          <canvas id="chart-champ-drivers" style="max-height:220px"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-label">${series.id === 'f1' ? 'Constructor Championship' : 'Laps Led This Race'}</div>
          <canvas id="chart-champ-teams" style="max-height:220px"></canvas>
        </div>
       </div>`
    : '';

  const dotr = race.driver_of_race
    ? (() => {
        const d = race.driver_of_race;
        return `
          <div class="sec-hd mt-32"><div class="sec-title">Driver of the Race</div></div>
          <div class="dotr">
            <div class="dotr-num">${d.number}</div>
            <div class="dotr-body">
              <div class="dotr-badge">${d.badge}</div>
              <div class="dotr-name">${d.driver}</div>
              <div class="dotr-team">#${d.number} · ${d.team}</div>
              <div class="dotr-stats">
                ${(d.stats || []).map(s => `
                  <div>
                    <div class="dotr-sv">${s.value}</div>
                    <div class="dotr-sl">${s.label}</div>
                  </div>`).join('')}
              </div>
              <div class="dotr-analysis">${d.analysis}</div>
            </div>
          </div>`;
      })()
    : '';

  return `
    <div class="sec-hd">
      <div class="sec-title">Race Stats</div>
      <div class="sec-sub">${race.venue} · ${fmtDate(race.date)}</div>
    </div>
    ${bigNums}
    ${tracker}
    ${champRow}
    ${dotr}`;
}

function drawStatsCharts(race, series, seriesData) {
  /* Position tracker */
  const trackerCtx = $('chart-tracker');
  if (trackerCtx && race.position_tracker) {
    const t      = race.position_tracker;
    const maxPos = Math.max(...t.drivers.flatMap(d => d.positions.filter(p => p != null)));
    new Chart(trackerCtx, {
      type    : 'line',
      data    : {
        labels   : t.labels,
        datasets : t.drivers.map(d => ({
          label           : d.name,
          data            : d.positions,
          borderColor     : d.color,
          backgroundColor : 'transparent',
          borderWidth     : (d.positions[d.positions.length - 1] || 20) <= 3 ? 2.5 : 1.5,
          pointRadius     : 3,
          tension         : 0.3,
          spanGaps        : true,
        })),
      },
      options: posTrackerOpts(maxPos + 2),
    });
  }

  /* Championship — drivers */
  const champCtx = $('chart-champ-drivers');
  if (champCtx && seriesData?.standings?.drivers) {
    const drivers = seriesData.standings.drivers.slice(0, 8);
    new Chart(champCtx, {
      type : 'bar',
      data : {
        labels   : drivers.map(d => d.short || d.driver.split(' ').pop()),
        datasets : [{
          data            : drivers.map(d => d.pts),
          backgroundColor : drivers.map(d => d.color || 'rgba(255,255,255,0.2)'),
          borderColor     : 'transparent',
          borderRadius    : 3,
        }],
      },
      options: chartOpts(),
    });
  }

  /* Championship — teams (F1) or laps led (NASCAR) */
  const teamsCtx = $('chart-champ-teams');
  if (teamsCtx) {
    if (series.id === 'f1' && seriesData?.standings?.constructors) {
      const cons = seriesData.standings.constructors.slice(0, 8);
      new Chart(teamsCtx, {
        type : 'bar',
        data : {
          labels   : cons.map(c => c.team),
          datasets : [{
            data            : cons.map(c => c.pts),
            backgroundColor : cons.map(c => c.color || 'rgba(255,255,255,0.2)'),
            borderColor     : 'transparent',
            borderRadius    : 3,
          }],
        },
        options: chartOpts(),
      });
    } else {
      const leaders = (race.race?.results || [])
        .filter(r => r.laps_led > 0)
        .sort((a, b) => b.laps_led - a.laps_led)
        .slice(0, 8);
      if (leaders.length) {
        const accent = getComputedStyle(document.documentElement)
          .getPropertyValue('--accent').trim() || '#FFD100';
        new Chart(teamsCtx, {
          type : 'bar',
          data : {
            labels   : leaders.map(r => r.driver.split(' ').pop()),
            datasets : [{
              data            : leaders.map(r => r.laps_led),
              backgroundColor : leaders.map((_, i) => i === 0 ? accent + 'CC' : 'rgba(255,255,255,0.18)'),
              borderColor     : 'transparent',
              borderRadius    : 3,
            }],
          },
          options: chartOpts(),
        });
      }
    }
  }
}

/* ── INSIGHTS TAB ────────────────────────────────────────── */

function renderInsights(race) {
  if (!race.insights?.length) {
    return `<div class="tbd-banner" style="margin-top:32px">
      <div style="font-size:20px">⏳</div>
      <div><div class="tb-head">Insights incoming after analysis</div></div>
    </div>`;
  }

  return `
    <div class="sec-hd">
      <div class="sec-title">Key Insights</div>
      <div class="sec-sub">Analysis · ${race.name} · Round ${race.round}</div>
    </div>
    <div class="insights-grid">
      ${race.insights.map(ins => `
        <div class="insight ${ins.type}">
          <div class="i-icon">${ins.icon}</div>
          <div class="i-head">${ins.headline}</div>
          <div class="i-body">${ins.body}</div>
        </div>`).join('')}
    </div>`;
}

/* ══════════════════════════════════════════════════════════
   PAGE BOOTSTRAPS — called by each HTML page's inline script
══════════════════════════════════════════════════════════ */

/* ── RACE PAGE ───────────────────────────────────────────── */

async function initRacePage() {
  const p    = params();
  const year = p.year || new Date().getFullYear();

  const [config, seriesData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/${p.series}-${year}.json`),
  ]);

  if (!config || !seriesData) {
    document.body.innerHTML = `<div style="padding:40px;color:rgba(255,255,255,.4);font-family:monospace">
      Could not load data for ${p.series}-${year}</div>`;
    return;
  }

  const series = config.series[p.series];
  if (!series) return;

  const race = seriesData.schedule.find(r => r.round === p.round);
  if (!race) {
    document.body.innerHTML = `<div style="padding:40px;color:rgba(255,255,255,.4);font-family:monospace">
      Round ${p.round} not found in ${p.series}-${year}</div>`;
    return;
  }

  /* accent colour */
  setAccent(series.accent || series.color || '#FFFFFF');

  /* page title + breadcrumb */
  document.title = `${race.name} ${year} — APEX Analytics`;
  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a>
    <span class="sep">/</span>
    <a href="standings.html?series=${p.series}&year=${year}">${series.short} ${year}</a>
    <span class="sep">/</span>
    <span class="current">R${race.round} · ${race.name}</span>
    ${race.venue_id ? `<span class="sep">/</span><a href="venue.html?series=${p.series}&id=${race.venue_id}" style="color:var(--dim);font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1px;opacity:.6;transition:opacity .15s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">Circuit →</a>` : ''}`;

  /* hero — inject series id so renderHero can build venue link */
  race.series_id = p.series;
  const heroEl = $('race-hero');
  if (heroEl) heroEl.innerHTML = renderHero(race, series);

  /* stats bar */
  const sbEl = $('stats-bar');
  if (sbEl) sbEl.innerHTML = renderStatsBar(race);

  /* decide which tabs to show */
  const status = raceStatus(race);
  const tabs   = [{ id:'overview', label:'Overview' }];

  tabs.push({ id:'qualifying', label:'Qualifying' });
  if (race.sprint_weekend)            tabs.push({ id:'sprint',   label:'Sprint' });
  if (status === 'done' || status === 'analyzing')
                                      tabs.push({ id:'race',     label:'Results' });
  if (series.has_stages)              tabs.push({ id:'stages',   label:'Stages'   });
  if (series.has_strategy)            tabs.push({ id:'strategy', label:'Strategy' });
                                      tabs.push({ id:'stats',    label:'Stats'    });
                                      tabs.push({ id:'insights', label:'Insights' });

  /* build tab bar + panel containers */
  const tabBar     = $('tab-bar');
  const tabContent = $('tab-content');
  if (!tabBar || !tabContent) return;

  tabBar.innerHTML = tabs.map((t, i) =>
    `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');

  tabContent.innerHTML = tabs.map((t, i) =>
    `<div class="panel${i === 0 ? ' active' : ''}" id="panel-${t.id}"></div>`
  ).join('');

  /* render each panel */
  const contentMap = {
    overview  : () => renderOverview(race, series),
    qualifying : () => renderQualifying(race, series),
    sprint    : () => renderSprint(race),
    race      : () => renderRaceResults(race, series),
    stages    : () => renderStages(race),
    strategy  : () => renderStrategy(race),
    stats     : () => renderStats(race, series, seriesData),
    insights  : () => renderInsights(race),
  };

  tabs.forEach(t => {
    const panel = $('panel-' + t.id);
    if (panel && contentMap[t.id]) panel.innerHTML = contentMap[t.id]();
  });

  /* deferred chart draws (need canvas to exist in DOM first) */
  setTimeout(() => {
    drawStatsCharts(race, series, seriesData);
    drawStagesChart(race);
  }, 60);

  /* footer */
  const foot = $('footer-copy');
  if (foot) foot.textContent =
    `${series.name} · ${race.name} · Round ${race.round} of ${seriesData.rounds_total} · ${fmtDate(race.date)}`;

  /* wire up tabs */
  initTabs('tab-bar', 'tab-content');
}

/* ── STANDINGS PAGE ──────────────────────────────────────── */

async function initStandingsPage() {
  const p    = params();
  const year = p.year || new Date().getFullYear();

  const [config, seriesData, competitorsData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/${p.series}-${year}.json`),
    loadJSON(`data/competitors-${p.series}-${year}.json`),
  ]);
  if (!config || !seriesData) return;

  const series = config.series[p.series];
  if (!series) return;

  setAccent(series.accent || series.color || '#FFFFFF');
  document.title = `${series.name} ${year} Standings — APEX Analytics`;

  // Build ID lookup from competitors data (name → id)
  const idMap = {};
  if (competitorsData?.competitors) {
    competitorsData.competitors.forEach(c => { idMap[c.name] = c.id; });
  }

  // Helper: strip # from color if present
  const cleanColor = (c) => c ? c.replace('#','') : null;

  const isF1    = series.id === 'f1';
  const drivers = seriesData.standings?.drivers || [];
  const maxPts  = drivers[0]?.pts || 1;

  /* driver table */
  const driverTable = `
    <div class="sec-hd">
      <div class="sec-title">Driver Championship</div>
      <div class="sec-sub">${seriesData.standings?.note || year + ' · ' + series.name}</div>
    </div>
    <table class="standings-full">
      <thead><tr>
        <th>Pos</th>
        <th>Driver</th>
        <th style="width:120px"></th>
        <th style="text-align:right">Pts</th>
        <th style="text-align:right">Gap</th>
        <th style="text-align:center">Wins</th>
        <th></th>
      </tr></thead>
      <tbody>
        ${drivers.map((d, i) => {
          const driverId  = idMap[d.driver];
          const barColor  = '#' + cleanColor(d.color);
          const profileLink = driverId
            ? `<a href="competitor.html?series=${p.series}&id=${driverId}&year=${year}"
                  style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1.5px;
                         text-transform:uppercase;color:var(--accent);text-decoration:none;
                         opacity:.6;white-space:nowrap">Profile →</a>`
            : '';
          return `<tr class="${i === 0 ? 'leader' : ''}">
            <td><span class="sf-pos${i === 0 ? ' p1' : ''}">${d.pos}</span></td>
            <td>
              <div class="sf-name">${d.driver}</div>
              <div class="sf-team">${d.team}</div>
            </td>
            <td class="sf-bar-cell">
              <div class="sf-bar" style="width:${Math.round((d.pts / maxPts) * 100)}%;background:${barColor}"></div>
            </td>
            <td class="sf-pts">${d.pts}</td>
            <td class="sf-gap">${i === 0 ? 'Leader' : '−' + (maxPts - d.pts)}</td>
            <td class="sf-wins">${d.wins ?? '—'}</td>
            <td>${profileLink}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  /* constructor table (F1 only) */
  let consTable = '';
  if (isF1 && seriesData.standings?.constructors) {
    const cons    = seriesData.standings.constructors;
    const maxCons = cons[0]?.pts || 1;
    consTable = `
      <div class="sec-hd mt-32">
        <div class="sec-title">Constructor Championship</div>
      </div>
      <table class="standings-full">
        <thead><tr>
          <th>Pos</th><th>Constructor</th>
          <th style="width:120px"></th>
          <th style="text-align:right">Pts</th>
        </tr></thead>
        <tbody>
          ${cons.map((c, i) => `<tr class="${i === 0 ? 'leader' : ''}">
            <td><span class="sf-pos${i === 0 ? ' p1' : ''}">${c.pos}</span></td>
            <td><div class="sf-name">${c.team}</div></td>
            <td class="sf-bar-cell">
              <div class="sf-bar" style="width:${Math.round((c.pts / maxCons) * 100)}%;background:#${cleanColor(c.color) || 'var(--accent)'}"></div>
            </td>
            <td class="sf-pts">${c.pts}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  /* schedule sidebar */
  const scheduleItems = seriesData.schedule.map(r => {
    const st   = raceStatus(r);
    const cls  = r.complete ? 'done' : st === 'analyzing' ? 'analyzing' : st === 'today' ? 'next' : '';
    const link = r.complete || st !== 'upcoming'
      ? `onclick="location.href='race.html?series=${p.series}&round=${r.round}&year=${year}'" style="cursor:pointer"`
      : '';
    const badge = r.complete
      ? `<span class="si-status done">Done</span>`
      : st === 'analyzing'
      ? `<span class="analyzing-badge"><span class="analyzing-dot"></span>Live</span>`
      : st === 'today'
      ? `<span class="si-status next">Today</span>`
      : `<span class="si-date">${fmtDate(r.date)}</span>`;

    return `<div class="schedule-item ${cls}" ${link}>
      <div class="si-round">R${r.round}</div>
      <div class="si-flag">${r.flag || '🏁'}</div>
      <div>
        <div class="si-name">${r.name}</div>
        <div class="si-sub">${r.venue_id
          ? `<a href="venue.html?series=${p.series}&id=${r.venue_id}" onclick="event.stopPropagation()" style="color:inherit;text-decoration:none;opacity:.7;border-bottom:1px solid transparent;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='transparent'">${r.venue}</a>`
          : r.venue}</div>
      </div>
      ${badge}
    </div>`;
  }).join('');

  /* inject */
  const main = $('standings-main');
  if (main) main.innerHTML = driverTable + consTable;

  const sched = $('standings-schedule');
  if (sched) sched.innerHTML = `
    <div class="sec-hd">
      <div class="sec-title">Schedule</div>
      <div class="sec-sub">${year} Season · ${seriesData.rounds_total} Rounds</div>
    </div>
    <div class="schedule-list">${scheduleItems}</div>`;

  /* breadcrumb */
  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a>
    <span class="sep">/</span>
    <span class="current">${series.name} ${year} Standings</span>`;

  /* series switcher */
  document.querySelectorAll('.series-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = `standings.html?series=${btn.dataset.series}&year=${year}`;
    });
  });
}

/* ── HUB PAGE ────────────────────────────────────────────── */

async function initHubPage() {
  const config = await loadJSON('data/config.json');
  if (!config) return;

  const year      = config.site.current_year;
  const seriesIds = Object.keys(config.series);

  /* load all series data in parallel */
  const allData = {};
  await Promise.all(seriesIds.map(async id => {
    allData[id] = await loadJSON(`data/${id}-${year}.json`);
  }));

  /* masthead: live date + total races */
  const now     = new Date();
  const weekNum = Math.ceil(
    (((now - new Date(now.getFullYear(), 0, 1)) / 86400000)
    + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7
  );
  const mastheadWeek = $('masthead-week');
  if (mastheadWeek)
    mastheadWeek.textContent = `Week ${weekNum} · ${now.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}`;

  let totalDone = 0;
  Object.values(allData).forEach(sd => {
    if (sd) totalDone += sd.schedule.filter(r => r.complete).length;
  });
  const doneEl = $('races-done-count');
  if (doneEl) doneEl.textContent = totalDone;

  /* find lead story: most recently completed race across all series */
  let leadRace = null, leadSeriesId = null;
  seriesIds.forEach(sid => {
    const sd = allData[sid];
    if (!sd) return;
    const done = sd.schedule.filter(r => r.complete);
    if (!done.length) return;
    const last = done[done.length - 1];
    if (!leadRace || new Date(last.date) > new Date(leadRace.date)) {
      leadRace = last;
      leadSeriesId = sid;
    }
  });

  if (leadRace) {
    const s      = config.series[leadSeriesId];
    const accent = s.accent || s.color;
    const winner = leadRace.race?.winner || 'TBD';
    const winNum = leadRace.race?.results?.[0]?.number || '?';
    const winTeam= leadRace.race?.results?.[0]?.team   || '';
    const link   = `race.html?series=${leadSeriesId}&round=${leadRace.round}&year=${year}`;

    const titleParts = leadRace.name.split(' ');
    const lastWord   = titleParts.pop();
    const titleHtml  = (titleParts.join(' ') + ' <span class="acc">' + lastWord + '</span>');

    const leadEl = $('lead-story');
    if (leadEl) {
      leadEl.style.setProperty('--accent', accent);
      leadEl.innerHTML = `
        <div class="story-lead" onclick="location.href='${link}'">
          <div class="story-lead-body">
            <div class="lead-eyebrow">${s.name} · Round ${leadRace.round} · ${leadRace.venue} · ${fmtDate(leadRace.date)}</div>
            <h2 class="lead-h2">${titleHtml}</h2>
            <p class="lead-summary">${leadRace.summary || ''}</p>
            <div class="lead-footer">
              <span class="lead-winner-tag">🏆 ${winner}</span>
              <span class="lead-cta">Full Analysis →</span>
            </div>
          </div>
          <div class="story-lead-aside">
            <div class="aside-num">${winNum}</div>
            <div class="aside-name" style="color:${accent}">${winner.split(' ').pop()}</div>
            <div class="aside-team">${winTeam}</div>
          </div>
        </div>`;
    }
  }

  /* story grid: recent + today + upcoming across all series */
  const stories = [];
  seriesIds.forEach(sid => {
    const sd = allData[sid];
    if (!sd) return;
    const s      = config.series[sid];
    const accent = s.accent || s.color;

    /* last completed (skip absolute lead) */
    const done = sd.schedule.filter(r => r.complete && r !== leadRace);
    if (done.length) {
      stories.push({ race: done[done.length - 1], s, sid, accent, state:'done' });
    }

    /* analyzing */
    const analyzing = sd.schedule.find(r => !r.complete && raceStatus(r) === 'analyzing');
    if (analyzing) stories.push({ race: analyzing, s, sid, accent, state:'analyzing' });

    /* next upcoming */
    const upcoming = sd.schedule.find(r => !r.complete && raceStatus(r) === 'upcoming');
    if (upcoming) stories.push({ race: upcoming, s, sid, accent, state:'upcoming' });
  });

  /* sort: analyzing first, then done desc, then upcoming asc */
  stories.sort((a, b) => {
    if (a.state === 'analyzing' && b.state !== 'analyzing') return -1;
    if (b.state === 'analyzing' && a.state !== 'analyzing') return  1;
    if (a.state === 'done'      && b.state === 'upcoming')  return -1;
    if (a.state === 'upcoming'  && b.state === 'done')      return  1;
    return new Date(b.race.date) - new Date(a.race.date);
  });

  const storyGridEl = $('story-grid');
  if (storyGridEl) {
    storyGridEl.innerHTML = stories.slice(0, 6).map(item => {
      const r      = item.race;
      const link   = `race.html?series=${item.sid}&round=${r.round}&year=${year}`;
      const cls    = item.state === 'analyzing' ? 'analyzing' : item.state === 'upcoming' ? 'upcoming' : '';
      const winner = r.race?.winner;

      const statusTag = item.state === 'analyzing'
        ? `<span class="analyzing-badge"><span class="analyzing-dot"></span>Analyzing</span>`
        : item.state === 'upcoming'
        ? `<span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">${fmtDate(r.date)}</span>`
        : `🏆 ${winner || '—'}`;

      const summary = r.summary
        ? r.summary.slice(0, 115) + (r.summary.length > 115 ? '…' : '')
        : `${fmtDate(r.date)} · ${r.venue}`;

      return `<div class="story-card ${cls}" style="--accent:${item.accent}" onclick="location.href='${link}'">
        <div class="sc-eyebrow">${item.s.short} · R${r.round} · ${r.venue}</div>
        <div class="sc-h3">${r.name}</div>
        <div class="sc-summary">${summary}</div>
        <div class="sc-footer">
          <span class="sc-winner-tag">${statusTag}</span>
          <span class="sc-cta">${item.state === 'upcoming' ? 'Preview →' : 'Analysis →'}</span>
        </div>
      </div>`;
    }).join('');
  }

  /* per-series standings + schedule panels */
  seriesIds.forEach(sid => {
    const sd = allData[sid];
    if (!sd) return;
    const s      = config.series[sid];
    const accent = s.accent || s.color;

    /* mini standings */
    const standingsEl = $(`mini-standings-${sid}`);
    if (standingsEl && sd.standings?.drivers) {
      const top8   = sd.standings.drivers.slice(0, 8);
      const maxPts = top8[0]?.pts || 1;
      standingsEl.innerHTML = `
        <div class="mini-standings" style="--accent:${accent};--accent-rgb:${hexToRgb(accent)}">
          <div class="mini-standings-head">
            <div class="mini-standings-title">${s.name}</div>
            <a class="mini-standings-link" href="standings.html?series=${sid}&year=${year}">Full →</a>
          </div>
          ${top8.map((d, i) => `
            <div class="mini-row ${i === 0 ? 'top' : ''}">
              <div class="mr-pos${i === 0 ? ' p1' : ''}">${d.pos}</div>
              <div>
                <div class="mr-name">${d.short || d.driver.split(' ').pop()}</div>
                <div class="mr-team">${d.team}</div>
              </div>
              <div style="width:90px">
                <div class="mr-bar" style="width:${Math.round((d.pts / maxPts) * 90)}px;background:${d.color || accent}"></div>
              </div>
              <div class="mr-pts">${d.pts}</div>
              <div class="mr-wins">${d.wins ?? 0}W</div>
            </div>`).join('')}
        </div>`;
    }

    /* schedule list */
    const schedEl = $(`schedule-list-${sid}`);
    if (schedEl) {
      const items = sd.schedule.slice(0, 10).map(r => {
        const st   = raceStatus(r);
        const cls  = r.complete ? 'done' : st === 'analyzing' ? 'analyzing' : st === 'today' ? 'next' : '';
        const clickable = r.complete || st !== 'upcoming';
        const link = clickable
          ? `onclick="location.href='race.html?series=${sid}&round=${r.round}&year=${year}'" style="cursor:pointer"`
          : '';
        const badge = r.complete
          ? `<span class="si-status done">✓</span>`
          : st === 'analyzing'
          ? `<span class="analyzing-badge" style="font-size:7px;padding:2px 6px"><span class="analyzing-dot"></span>Live</span>`
          : st === 'today'
          ? `<span class="si-status next">Today</span>`
          : `<span class="si-date">${fmtDate(r.date)}</span>`;

        return `<div class="schedule-item ${cls}" ${link}>
          <div class="si-round">R${r.round}</div>
          <div class="si-flag">${r.flag || '🏁'}</div>
          <div>
            <div class="si-name">${r.name}</div>
            <div class="si-sub">${r.venue_id
              ? `<a href="venue.html?series=${sid}&id=${r.venue_id}" onclick="event.stopPropagation()" style="color:inherit;text-decoration:none;opacity:.7;border-bottom:1px solid transparent;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='transparent'">${r.venue}</a>`
              : r.venue}</div>
          </div>
          ${badge}
        </div>`;
      }).join('');

      schedEl.innerHTML = `<div class="schedule-list">${items}</div>`;
    }
  });

  /* series tab switcher */
  // Hide all series panels first
  document.querySelectorAll('[data-series-panel]').forEach(p => {
    p.style.display = 'none';
  });

  function activateSeriesTab(seriesId) {
    document.querySelectorAll('.series-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('[data-series-panel]').forEach(p => p.style.display = 'none');
    const btn = document.querySelector(`.series-tab[data-series="${seriesId}"]`);
    if (btn) btn.classList.add('active');
    const panel = document.querySelector(`[data-series-panel="${seriesId}"]`);
    if (panel) panel.style.display = 'block';
  }

  document.querySelectorAll('.series-tab').forEach(btn => {
    btn.addEventListener('click', () => activateSeriesTab(btn.dataset.series));
  });

  // Activate first series tab (f1 by default)
  const firstSeriesId = seriesIds[0] || 'f1';
  activateSeriesTab(firstSeriesId);
}

/* ══════════════════════════════════════════════════════════
   ASSET RESOLVER
   Builds paths for driver photos, team logos, car numbers.
   JPG takes priority over SVG for driver photos.
   All paths relative to site root.
══════════════════════════════════════════════════════════ */

function driverPhotoPath(driverId) {
  // Return jpg path — renderer uses onerror to fall back to svg
  return `assets/drivers/${driverId}.jpg`;
}

function driverPhotoFallback(driverId) {
  return `assets/drivers/${driverId}.svg`;
}

function teamLogoPath(teamId) {
  return `assets/teams/${teamId}.svg`;
}

function numberLogoPath(number, suffix) {
  return `assets/numbers/${number}${suffix || ''}.svg`;
}

/* Render a driver photo <img> with SVG fallback */
function driverPhoto(driverId, cls, alt) {
  const jpg = driverPhotoPath(driverId);
  const svg = driverPhotoFallback(driverId);
  return `<img
    src="${jpg}"
    onerror="this.onerror=null;this.src='${svg}'"
    class="${cls || 'driver-photo'}"
    alt="${alt || driverId}"
    loading="lazy">`;
}

/* Render a team logo <img> */
function teamLogo(teamId, cls, alt) {
  return `<img
    src="${teamLogoPath(teamId)}"
    class="${cls || 'team-logo'}"
    alt="${alt || teamId}"
    loading="lazy">`;
}

/* Render a car number <img> */
function numberLogo(number, cls, suffix) {
  return `<img
    src="${numberLogoPath(number, suffix)}"
    class="${cls || 'number-logo'}"
    alt="#${number}"
    loading="lazy">`;
}

/* ══════════════════════════════════════════════════════════
   COMPETITOR PAGE
   URL: competitor.html?series=f1&id=russell-george
══════════════════════════════════════════════════════════ */

/* ── Position class helper ───────────────────────────────── */
function posClass(finish) {
  if (finish === 'DNS' || finish === 'dns') return 'pos-dns';
  if (finish === 'DNF' || finish === 'dnf') return 'pos-dnf';
  if (finish === null || finish === undefined) return 'upcoming';
  const n = parseInt(finish);
  if (n === 1) return 'pos-1';
  if (n === 2) return 'pos-2';
  if (n === 3) return 'pos-3';
  if (n <= 10) return 'pos-pts';
  return 'pos-out';
}

function posColor(finish) {
  if (finish === 'DNS' || finish === 'dns') return '#4A4A66';
  if (finish === 'DNF' || finish === 'dnf') return '#E8002D';
  const n = parseInt(finish);
  if (n === 1) return '#FFD700';
  if (n === 2) return '#C0C0C0';
  if (n === 3) return '#CD7F32';
  if (n <= 10) return '#27F4D2';
  return '#4A4A66';
}

/* ── renderCompetitorHero ────────────────────────────────── */
function renderCompetitorHero(driver, teams) {
  const team      = teams[driver.team] || {};
  const firstName = driver.name.split(' ')[0];
  const lastName  = driver.name.split(' ').slice(1).join(' ');
  const photoJpg  = `assets/drivers/${driver.id}.jpg`;
  const photoSvg  = `assets/drivers/${driver.id}.svg`;
  const teamLogo  = `assets/teams/${driver.team}.svg`;
  const accent    = '#' + driver.color;

  return `
    <div class="comp-hero">

      <div class="comp-hero-photo">
        <img
          src="${photoJpg}"
          onerror="this.onerror=null;this.src='${photoSvg}'"
          alt="${driver.name}"
          style="width:100%;height:100%;object-fit:cover;object-position:top center;display:block">
        <div class="comp-hero-photo-overlay"></div>
      </div>

      <div class="comp-hero-body">
        <div class="comp-hero-bg-num">${driver.number}</div>

        <div class="comp-hero-team-row">
          <img src="${teamLogo}"
               onerror="this.style.display='none'"
               class="comp-team-logo-sm"
               alt="${team.name}">
          <div class="comp-team-dot" style="background:${accent}"></div>
          <div class="comp-team-name">${team.name || driver.team_name}</div>
        </div>

        <div class="comp-hero-flag">${driver.flag}</div>

        <div class="comp-hero-name">
          ${firstName}<br><span class="acc">${lastName}</span>
        </div>

        <div class="comp-hero-number">
          #${driver.number} &nbsp;·&nbsp; ${driver.code}
          &nbsp;·&nbsp; ${driver.nationality}
        </div>

        <p class="comp-hero-bio">${driver.bio}</p>
      </div>

    </div>`;
}

/* ── renderCompetitorStatsBar ────────────────────────────── */
function renderCompetitorStatsBar(driver) {
  const s   = driver.season_2026;
  const stats = [
    { v: s.pts,               l: '2026 Points'  },
    { v: s.wins,              l: 'Wins'          },
    { v: s.podiums,           l: 'Podiums'       },
    { v: s.poles,             l: 'Poles'         },
    { v: s.dnfs,              l: 'DNFs'          },
    { v: s.rounds_completed,  l: 'Rounds Scored' },
  ];
  return stats.map(s => `
    <div class="comp-sb-cell">
      <div class="comp-sb-v">${s.v ?? '—'}</div>
      <div class="comp-sb-l">${s.l}</div>
    </div>`).join('');
}

/* ── renderResultsGrid ───────────────────────────────────── */
function renderResultsGrid(driver, schedule) {
  const results  = driver.season_2026.results_by_round || [];
  const resultMap = {};
  results.forEach(r => { resultMap[r.round] = r; });

  const cells = schedule.map(race => {
    const r      = resultMap[race.round];
    const finish = r ? r.finish : (race.complete ? '?' : null);
    const cls    = posClass(finish);
    const col    = posColor(finish);
    const grid   = r?.grid  ?? '—';
    const pts    = r?.pts   ?? 0;
    const note   = r?.note  || '';
    const label  = finish === null
      ? (race.date ? fmtDate(race.date).split(',')[0] : 'TBD')
      : (finish === 'DNS' || finish === 'DNF' ? finish : `P${finish}`);

    const tooltip = finish !== null
      ? `<div class="rg-tooltip">
          R${race.round} ${race.venue || race.name}<br>
          Grid: ${grid} → Finish: ${label}<br>
          ${pts ? `+${pts} pts` : ''}${note ? '<br>' + note : ''}
         </div>`
      : `<div class="rg-tooltip">R${race.round} · ${race.venue || race.name} · ${fmtDate(race.date)}</div>`;

    return `
      <div class="rg-cell ${cls}">
        <div class="rg-pos" style="color:${col}">${label}</div>
        <div class="rg-venue">${(race.venue || race.name || '').slice(0,3).toUpperCase()}</div>
        ${tooltip}
      </div>`;
  }).join('');

  return `
    <div class="sec-hd">
      <div class="sec-title">2026 Season Results</div>
      <div class="sec-sub">${driver.season_2026.rounds_completed} rounds scored · ${driver.season_2026.pts} pts</div>
    </div>
    <div class="results-grid">${cells}</div>`;
}

/* ── renderTeammateComparison ────────────────────────────── */
function renderTeammateComparison(driver, allDrivers) {
  const tmId = driver.season_2026.teammate_quali_record?.teammate;
  if (!tmId) {
    return `<div class="sec-hd"><div class="sec-title">Team-mate</div></div>
            <div class="card"><p style="color:var(--dim)">No team-mate data available.</p></div>`;
  }

  const teammate = allDrivers.find(d => d.id === tmId);
  if (!teammate) return '';

  const qr = driver.season_2026.teammate_quali_record;
  const rr = driver.season_2026.teammate_race_record;
  const s  = driver.season_2026;
  const ts = teammate.season_2026;

  const dColor  = '#' + driver.color;
  const tmColor = '#' + teammate.color;

  // Qualifying head-to-head record
  const qTotal  = (qr.ahead || 0) + (qr.behind || 0);
  const qAhead  = qr.ahead  || 0;
  const qBehind = qr.behind || 0;

  // Race record
  const rTotal  = (rr.ahead || 0) + (rr.behind || 0);
  const rAhead  = rr.ahead  || 0;
  const rBehind = rr.behind || 0;

  const pct = (v, t) => t > 0 ? Math.round((v / t) * 100) : 50;

  const barRow = (label, a, b, total) => {
    const pA = pct(a, total);
    const pB = pct(b, total);
    return `
      <div class="tm-bar-row">
        <div class="tm-bar-left">
          <div class="tm-bar-seg" style="width:${pA * 0.9}px;background:${dColor};opacity:.7"></div>
        </div>
        <div class="tm-bar-label">${label}<br><span style="color:var(--muted);font-size:9px">${a}–${b}</span></div>
        <div class="tm-bar-right">
          <div class="tm-bar-seg" style="width:${pB * 0.9}px;background:${tmColor};opacity:.7"></div>
        </div>
      </div>`;
  };

  const metricRow = (label, dVal, tmVal, higherIsBetter) => {
    const dLeads  = higherIsBetter ? dVal > tmVal : dVal < tmVal;
    const tmLeads = higherIsBetter ? tmVal > dVal  : tmVal < dVal;
    return `
      <div class="tm-metric">
        <div class="tm-val ${dLeads ? 'leader' : ''}"
             style="color:${dLeads ? dColor : 'var(--dim)'}">
          ${dVal ?? '—'}
        </div>
        <div class="tm-label">${label}</div>
        <div class="tm-val right ${tmLeads ? 'leader' : ''}"
             style="color:${tmLeads ? tmColor : 'var(--dim)'}">
          ${tmVal ?? '—'}
        </div>
      </div>`;
  };

  return `
    <div class="sec-hd">
      <div class="sec-title">Team-mate Battle</div>
      <div class="sec-sub">${driver.team_name} · 2026 Season</div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--border)">

      <div class="tm-header">
        <div class="tm-driver">
          <div class="tm-driver-name" style="color:${dColor}">${driver.name.split(' ').pop()}</div>
          <div class="tm-driver-team">#${driver.number}</div>
        </div>
        <div class="tm-vs">VS</div>
        <div class="tm-driver" style="text-align:right">
          <div class="tm-driver-name" style="color:${tmColor}">${teammate.name.split(' ').pop()}</div>
          <div class="tm-driver-team">#${teammate.number}</div>
        </div>
      </div>

      ${barRow('QUALIFYING', qAhead, qBehind, qTotal)}
      ${barRow('RACE RESULT', rAhead, rBehind, rTotal)}
      ${metricRow('PTS', s.pts, ts.pts, true)}
      ${metricRow('WINS', s.wins, ts.wins, true)}
      ${metricRow('PODIUMS', s.podiums, ts.podiums, true)}
      ${metricRow('AVG QUAL', s.avg_qualifying_pos?.toFixed(1) ?? '—', ts.avg_qualifying_pos?.toFixed(1) ?? '—', false)}
      ${metricRow('AVG FINISH', s.avg_finish_pos?.toFixed(1) ?? '—', ts.avg_finish_pos?.toFixed(1) ?? '—', false)}

    </div>`;
}

/* ── renderCareerSummary ─────────────────────────────────── */
function renderCareerSummary(driver) {
  const c = driver.career;
  const cells = [
    { v: c.wins,     l: 'Race Wins',      note: c.first_win || '' },
    { v: c.podiums,  l: 'Podiums',        note: '' },
    { v: c.poles,    l: 'Pole Positions', note: '' },
    { v: c.fastest_laps, l: 'Fastest Laps', note: '' },
    { v: c.seasons,  l: 'Seasons',        note: c.first_race?.split(' ').slice(-1)[0] + ' debut' || '' },
    { v: c.championships > 0 ? c.championships : '0',
       l: 'Championships',
       note: c.championship_years?.join(', ') || 'None yet' },
  ];

  const teams = (c.teams || []).join(' → ');

  return `
    <div class="sec-hd">
      <div class="sec-title">Career Record</div>
      <div class="sec-sub">${c.seasons} seasons · ${teams}</div>
    </div>
    <div class="career-grid">
      ${cells.map(c => `
        <div class="career-cell">
          <div class="career-v">${c.v}</div>
          <div class="career-l">${c.l}</div>
          ${c.note ? `<div class="career-note">${c.note}</div>` : ''}
        </div>`).join('')}
    </div>`;
}

/* ── renderCircuitHistory ────────────────────────────────── */
function renderCircuitHistory(driver, venues, schedule) {
  // Cross-reference driver results with venues
  const resultMap = {};
  (driver.season_2026.results_by_round || []).forEach(r => {
    resultMap[r.round] = r;
  });

  const rows = schedule.map(race => {
    const venue   = venues.find(v => v.id === race.venue_id || v.short === race.venue);
    const result  = resultMap[race.round];
    const finish  = result?.finish;
    const grid    = result?.grid;
    const finN    = parseInt(finish);

    let resCls = 'none', resLabel = '—';
    if (finish === null || finish === undefined) {
      resLabel = race.complete ? '?' : '⏳';
    } else if (finish === 'DNS') {
      resLabel = 'DNS'; resCls = 'none';
    } else if (finish === 'DNF') {
      resLabel = 'DNF'; resCls = 'none';
    } else {
      resLabel = `P${finN}`;
      if (finN === 1)       resCls = 'win';
      else if (finN <= 3)   resCls = 'podium';
      else if (finN <= 10)  resCls = 'points';
    }

    const tierCls = venue ? `t${venue.tier}` : 't3';
    const tierLbl = venue ? ['', 'Iconic', 'Established', 'Modern'][venue.tier] : '';

    return `<tr>
      <td>
        <div class="ct-venue">${race.venue_id
          ? `<a href="venue.html?series=f1&id=${race.venue_id}" style="color:inherit;text-decoration:none;border-bottom:1px solid transparent;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='transparent'">${race.venue || race.name}</a>`
          : (race.venue || race.name)}</div>
        ${venue ? `<div style="font-size:10px;color:var(--dim);font-family:'JetBrains Mono',monospace;margin-top:2px">${venue.location?.split(',')[1]?.trim() || ''}</div>` : ''}
      </td>
      <td><span class="ct-tier ${tierCls}">${tierLbl}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--dim)">${grid ?? '—'}</td>
      <td><span class="ct-result ${resCls}">${resLabel}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted)">${result?.pts ? '+' + result.pts : '—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim)">${result?.note || (race.complete ? '' : fmtDate(race.date))}</td>
    </tr>`;
  }).join('');

  return `
    <div class="sec-hd">
      <div class="sec-title">Circuit by Circuit — 2026</div>
      <div class="sec-sub">Qualifying grid position → Race finish</div>
    </div>
    <div class="comp-section">
      <table class="circuit-table">
        <thead>
          <tr>
            <th>Venue</th>
            <th>Tier</th>
            <th>Grid</th>
            <th>Finish</th>
            <th>Pts</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── renderCompetitorSidebar ─────────────────────────────── */
function renderCompetitorSidebar(driver, allDrivers, seriesData) {
  // Championship position context
  const standings = seriesData.standings?.drivers || [];
  const pos       = standings.findIndex(d => d.driver === driver.name) + 1;
  const leader    = standings[0];
  const gap       = pos > 0 && leader ? leader.pts - driver.season_2026.pts : null;

  const champCard = `
    <div class="side-card">
      <div class="side-card-head">Championship · 2026</div>
      <div class="side-card-body">
        <div style="font-family:'Bebas Neue',display;font-size:48px;letter-spacing:1px;color:var(--accent);line-height:1">
          P${pos || '—'}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);margin-top:4px">
          ${driver.season_2026.pts} points
        </div>
        ${gap !== null && gap > 0 ? `
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);margin-top:4px">
            −${gap} from ${leader.driver.split(' ').pop()}
          </div>` : (gap === 0 ? '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--accent);margin-top:4px">CHAMPIONSHIP LEADER</div>' : '')}
        <div style="margin-top:16px">
          <canvas id="chart-pts-trajectory" style="max-height:120px"></canvas>
        </div>
      </div>
    </div>`;

  // Next race
  const nextRace = seriesData.schedule?.find(r => !r.complete);
  const nextCard = nextRace ? `
    <div class="side-card">
      <div class="side-card-head">Next Race</div>
      <div class="side-card-body">
        <div style="font-family:'Bebas Neue',display;font-size:20px;letter-spacing:1px">${nextRace.name}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);margin-top:4px">
          ${nextRace.venue_id
            ? `<a href="venue.html?series=f1&id=${nextRace.venue_id}" style="color:inherit;text-decoration:none;border-bottom:1px solid transparent;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='transparent'">${nextRace.venue}</a>`
            : nextRace.venue} · ${fmtDate(nextRace.date)}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <a href="race.html?series=f1&round=${nextRace.round}"
             style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;
                    text-transform:uppercase;color:var(--accent);text-decoration:none;opacity:.7">
            Preview →
          </a>
          ${nextRace.venue_id ? `
          <a href="venue.html?series=f1&id=${nextRace.venue_id}"
             style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;
                    text-transform:uppercase;color:var(--dim);text-decoration:none;opacity:.7">
            Circuit →
          </a>` : ''}
        </div>
      </div>
    </div>` : '';

  // Compare CTA
  const compareCard = `
    <div class="side-card">
      <div class="side-card-head">Compare</div>
      <div class="side-card-body">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);line-height:1.7;margin-bottom:12px">
          Head-to-head comparison with any 2026 driver
        </div>
        <select id="compare-select" style="width:100%;background:var(--bg-2);border:1px solid var(--border);
                  color:var(--text);padding:8px 10px;font-family:'JetBrains Mono',monospace;
                  font-size:9px;letter-spacing:1px;margin-bottom:8px">
          <option value="">Select a driver…</option>
          ${allDrivers
            .filter(d => d.id !== driver.id)
            .map(d => `<option value="${d.id}">${d.name} (#${d.number})</option>`)
            .join('')}
        </select>
        <button onclick="goCompare()" style="width:100%;padding:9px;background:rgba(var(--accent-rgb),.1);
                  border:1px solid rgba(var(--accent-rgb),.3);color:var(--accent);
                  font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;
                  text-transform:uppercase;cursor:pointer;transition:all .18s"
                  onmouseover="this.style.background='rgba(var(--accent-rgb),.2)'"
                  onmouseout="this.style.background='rgba(var(--accent-rgb),.1)'">
          Compare →
        </button>
      </div>
    </div>`;

  return champCard + nextCard + compareCard;
}

/* ── drawPtsTrajectory ───────────────────────────────────── */
function drawPtsTrajectory(driver, standings) {
  const ctx = $('chart-pts-trajectory');
  if (!ctx) return;

  // Build cumulative points from results
  const results = driver.season_2026.results_by_round || [];
  let cum = 0;
  const labels = [];
  const data   = [];
  results.forEach(r => {
    cum += r.pts || 0;
    labels.push(`R${r.round}`);
    data.push(cum);
  });

  if (!data.length) return;

  const accent = '#' + driver.color;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor:     accent,
        backgroundColor: accent + '15',
        borderWidth:     2,
        fill:            true,
        pointRadius:     4,
        pointBackgroundColor: accent,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color:'rgba(255,255,255,.04)' }, ticks: { color:'rgba(237,234,246,.35)', font:{ family:'JetBrains Mono', size:8 } } },
        y: { grid: { color:'rgba(255,255,255,.04)' }, ticks: { color:'rgba(237,234,246,.35)', font:{ family:'JetBrains Mono', size:8 } }, beginAtZero: true },
      }
    }
  });
}

/* ── goCompare helper ────────────────────────────────────── */
function goCompare() {
  const sel    = $('compare-select');
  const series = params().series || 'f1';
  const idA    = params().id;
  if (sel && sel.value && idA) {
    location.href = `compare.html?series=${series}&a=${idA}&b=${sel.value}`;
  }
}

/* ── initCompetitorPage ──────────────────────────────────── */
async function initCompetitorPage() {
  const p    = params();
  const year = p.year || new Date().getFullYear();

  const [config, competitorsData, seriesData, venuesData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/competitors-${p.series}-${year}.json`),
    loadJSON(`data/${p.series}-${year}.json`),
    loadJSON(`data/venues-${p.series}-${year}.json`),
  ]);

  if (!config || !competitorsData) {
    document.getElementById('comp-page').innerHTML =
      `<div style="padding:80px;color:var(--dim);font-family:'JetBrains Mono',monospace">
        Driver not found: ${p.id}
       </div>`;
    return;
  }

  const series  = config.series[p.series];
  const driver  = competitorsData.competitors.find(d => d.id === p.id);
  const venues  = venuesData?.venues || [];
  const teams   = competitorsData.teams || {};

  // Populate name→ID cache
  buildNameIdCache(competitorsData.competitors);

  if (!driver) {
    document.getElementById('comp-page').innerHTML =
      `<div style="padding:80px;color:var(--dim);font-family:'JetBrains Mono',monospace">
        Driver not found: ${p.id}
       </div>`;
    return;
  }

  // Set accent to driver's team colour
  setAccent('#' + driver.color);

  // Page title
  document.title = `${driver.name} — APEX Analytics`;

  // Breadcrumb
  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `
    <a href="index.html">Home</a>
    <span class="sep">/</span>
    <a href="standings.html?series=${p.series}&year=${year}">F1 ${year}</a>
    <span class="sep">/</span>
    <span class="current">${driver.name}</span>`;

  // Assemble page
  const page = $('comp-page');

  const hero     = renderCompetitorHero(driver, teams);
  const statsBar = `<div class="comp-stats-bar">${renderCompetitorStatsBar(driver)}</div>`;

  const schedule = seriesData?.schedule || [];
  const resultsGrid = renderResultsGrid(driver, schedule);
  const teammate    = renderTeammateComparison(driver, competitorsData.competitors);
  const career      = renderCareerSummary(driver);
  const circuits    = renderCircuitHistory(driver, venues, schedule);
  const sidebar     = renderCompetitorSidebar(driver, competitorsData.competitors, seriesData || {});

  page.innerHTML = `
    ${hero}
    ${statsBar}
    <div class="comp-content">
      <div class="comp-main">
        <div class="comp-section">${resultsGrid}</div>
        <div class="comp-section" style="margin-top:32px">${teammate}</div>
        <div class="comp-section" style="margin-top:32px">${career}</div>
        <div class="comp-section" style="margin-top:32px">${circuits}</div>
      </div>
      <div class="comp-side">${sidebar}</div>
    </div>`;

  // Charts (need DOM first)
  setTimeout(() => {
    drawPtsTrajectory(driver, seriesData?.standings?.drivers || []);
  }, 60);

  // Footer
  const foot = $('footer-copy');
  if (foot) foot.textContent = `${driver.name} · #${driver.number} · ${driver.team_name} · ${year}`;
}

/* ══════════════════════════════════════════════════════════
   VENUE PAGE
   URL: venue.html?series=f1&id=shanghai
══════════════════════════════════════════════════════════ */

async function initVenuePage() {
  const p    = params();
  const year = p.year || new Date().getFullYear();

  const [config, venuesData, seriesData, competitorsData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/venues-${p.series}-${year}.json`),
    loadJSON(`data/${p.series}-${year}.json`),
    loadJSON(`data/competitors-${p.series}-${year}.json`),
  ]);
  if (!config || !venuesData) return;

  const series = config.series[p.series];
  const venue  = venuesData.venues.find(v => v.id === p.id);
  if (!venue) { document.getElementById('venue-page').innerHTML = `<div style="padding:80px;color:var(--dim);font-family:'JetBrains Mono',monospace">Circuit not found: ${p.id}</div>`; return; }

  // Populate name→ID cache for driver links
  buildNameIdCache(competitorsData?.competitors);

  setAccent(series.accent || '#27F4D2');
  document.title = `${venue.name} — APEX Analytics`;

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `<a href="index.html">Home</a><span class="sep">/</span><a href="standings.html?series=${p.series}">F1 ${year}</a><span class="sep">/</span><span class="current">${venue.short}</span>`;

  const tierLabel = ['','Iconic Circuit','Established Venue','Modern Circuit'][venue.tier] || '';
  const tierCls   = `tier-${venue.tier}`;

  // SC probability bar colour
  const scProb = venue.strategic_profile?.safety_car_probability || '';
  const scPct  = scProb.toLowerCase().includes('very high') ? 85
               : scProb.toLowerCase().includes('high')      ? 65
               : scProb.toLowerCase().includes('medium')    ? 40
               : scProb.toLowerCase().includes('low')       ? 20 : 30;
  const scColor = scPct > 60 ? '#FF4040' : scPct > 35 ? '#FFD100' : '#27F4D2';

  const hero = `
    <div class="venue-hero">
      <div class="venue-hero-bg"></div>
      <div class="venue-hero-bg-word">${venue.short.toUpperCase().slice(0,4)}</div>
      <div class="venue-hero-content">
        <div class="venue-eyebrow">${p.series.toUpperCase()} · Round ${venue['2026_race']?.round || '—'} · ${year}</div>
        <h1 class="venue-h1">${venue.name.split(' ').slice(0,-1).join(' ')}<br><span class="acc">${venue.name.split(' ').slice(-1)[0]}</span></h1>
        <div class="venue-location">${venue.location} &nbsp;${venue.flag}</div>
        <span class="venue-tier-badge ${tierCls}">${tierLabel}</span>
      </div>
      <div class="venue-facts">
        <div class="vf-cell"><div class="vf-v">${venue.lap_length_km}km</div><div class="vf-l">Lap Length</div></div>
        <div class="vf-cell"><div class="vf-v">${venue.turns}</div><div class="vf-l">Turns</div></div>
        <div class="vf-cell"><div class="vf-v">${venue.drs_zones}</div><div class="vf-l">DRS Zones</div></div>
        <div class="vf-cell"><div class="vf-v">${venue.first_f1_gp}</div><div class="vf-l">First GP</div></div>
        <div class="vf-cell" style="grid-column:1/-1">
          <div class="vf-v" style="font-size:18px">${venue.lap_record?.time}</div>
          <div class="vf-l">Lap Record — ${venue.lap_record?.driver} · ${venue.lap_record?.team} · ${venue.lap_record?.year}</div>
        </div>
      </div>
    </div>`;

  // 2026 race result box
  const race2026 = venue['2026_race'];
  const raceBox = race2026?.winner ? `
    <div class="card" style="margin-bottom:2px;border-color:rgba(var(--accent-rgb),.25)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);opacity:.7;margin-bottom:6px">2026 Race Result</div>
          <div style="font-family:'Bebas Neue',display;font-size:24px">🏆 ${race2026.winner}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);margin-top:4px">
            ${race2026.winning_team} · Pole: ${race2026.pole} · Margin: ${race2026.margin}
          </div>
          ${race2026.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:6px">${race2026.notes}</div>` : ''}
        </div>
        <a href="race.html?series=${p.series}&round=${race2026.round}"
           style="padding:8px 18px;background:rgba(var(--accent-rgb),.1);border:1px solid rgba(var(--accent-rgb),.3);
                  color:var(--accent);font-family:'JetBrains Mono',monospace;font-size:8px;
                  letter-spacing:2px;text-transform:uppercase;text-decoration:none">
          Full Analysis →
        </a>
      </div>
    </div>` : '';

  // Strategic profile
  const sp = venue.strategic_profile || {};
  const stratGrid = `
    <div class="sec-hd"><div class="sec-title">Strategic Profile</div></div>
    <div class="strat-grid">
      <div class="strat-cell">
        <div class="strat-label">Typical Strategy</div>
        <div class="strat-value">${sp.typical_stops}-stop · ${sp.key_strategy || '—'}</div>
      </div>
      <div class="strat-cell">
        <div class="strat-label">Safety Car Probability</div>
        <div class="strat-value">${sp.safety_car_probability}</div>
        <div class="sc-bar-wrap">
          <div class="sc-bar-track">
            <div class="sc-bar-fill" style="width:${scPct}%;background:${scColor}"></div>
          </div>
        </div>
      </div>
      <div class="strat-cell">
        <div class="strat-label">Undercut Potential</div>
        <div class="strat-value">${sp.undercut_potential}</div>
      </div>
      <div class="strat-cell">
        <div class="strat-label">Tyre Behaviour</div>
        <div class="strat-value">${sp.tyre_behaviour}</div>
      </div>
    </div>`;

  // Circuit characteristics
  const chars = venue.characteristics ? `
    <div class="sec-hd" style="margin-top:24px"><div class="sec-title">Circuit Character</div></div>
    <div class="card"><p class="circuit-chars">${venue.characteristics}</p></div>` : '';

  // Recent winners
  const winners = venue.recent_winners || [];
  const winnerRows = winners.map(w => `
    <tr>
      <td><span class="wt-year ${w.year === 2026 ? 'current' : ''}">${w.year}</span></td>
      <td>
        <a href="competitor.html?series=${p.series}&id=${nameToId(w.winner)}"
           style="text-decoration:none;color:inherit">
          <div class="wt-winner">${w.winner}</div>
          <div class="wt-team">${w.team}</div>
        </a>
      </td>
      <td><div class="wt-pole">${w.pole}</div></td>
      ${w.note ? `<td style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim)">${w.note}</td>` : '<td></td>'}
    </tr>`).join('');

  const winnersTable = winners.length ? `
    <div class="sec-hd" style="margin-top:24px"><div class="sec-title">Recent Winners</div></div>
    <table class="winners-table">
      <thead><tr><th>Year</th><th>Winner</th><th>Pole</th><th>Note</th></tr></thead>
      <tbody>${winnerRows}</tbody>
    </table>` : '';

  // All-time records
  const at = venue.all_time;
  const allTimeBox = at ? `
    <div class="cards-2" style="margin-top:2px">
      <div class="card">
        <div style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Most Wins — Driver</div>
        <div style="font-family:'Bebas Neue',display;font-size:22px">${at.most_wins_driver?.wins}× ${at.most_wins_driver?.driver}</div>
      </div>
      <div class="card">
        <div style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Most Wins — Constructor</div>
        <div style="font-family:'Bebas Neue',display;font-size:22px">${at.most_wins_team?.wins}× ${at.most_wins_team?.team}</div>
      </div>
    </div>` : '';

  // Legendary moments (Tier 1 only)
  const moments = (venue.legendary_moments || []).map(m => `
    <div class="moment-card">
      <div class="moment-year-label">${m.year}</div>
      <div class="moment-title">${m.title}</div>
      <div class="moment-year">${m.year}</div>
      <p class="moment-body">${m.summary}</p>
    </div>`).join('');

  const legendarySection = moments ? `
    <div class="sec-hd" style="margin-top:24px">
      <div class="sec-title">Legendary Moments</div>
      <div class="sec-sub">${venue.name} · Defining races and chapters</div>
    </div>
    ${moments}` : '';

  // Sidebar
  const totalGPs = at?.total_gps_held;
  const sidebar = `
    <div class="venue-side-card">
      <div class="vsc-head">Circuit at a Glance</div>
      <div class="vsc-body">
        ${[
          ['Type',      venue.circuit_type.replace('_',' ')],
          ['Direction', venue.direction || '—'],
          ['Country',   venue.country],
          ['First GP',  venue.first_f1_gp],
          ['Total GPs', totalGPs ? `${totalGPs} grands prix` : '—'],
        ].map(([l,v]) => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.03)">
            <span style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1px;text-transform:uppercase;color:var(--dim)">${l}</span>
            <span style="font-size:12px;color:var(--muted)">${v}</span>
          </div>`).join('')}
      </div>
    </div>

    ${seriesData ? `
    <div class="venue-side-card">
      <div class="vsc-head">2026 Season</div>
      <div class="vsc-body">
        ${seriesData.schedule.slice(0,6).map(r => {
          const isThis = r.venue === venue.short || r.venue_id === venue.id;
          return `<a href="race.html?series=${p.series}&round=${r.round}"
                    style="display:flex;align-items:center;justify-content:space-between;
                           padding:7px 0;border-bottom:1px solid rgba(255,255,255,.03);
                           text-decoration:none;color:inherit;
                           ${isThis ? 'color:var(--accent)' : ''}">
            <span style="font-size:11px;${isThis ? 'font-weight:500' : ''}">R${r.round} · ${r.venue || r.name}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim)">${r.complete ? '✓' : fmtDate(r.date)}</span>
          </a>`;
        }).join('')}
        <a href="standings.html?series=${p.series}" style="display:block;margin-top:10px;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);text-decoration:none;opacity:.7">Full Schedule →</a>
      </div>
    </div>` : ''}`;

  document.getElementById('venue-page').innerHTML = `
    ${hero}
    <div class="venue-layout">
      <div class="venue-main">
        ${raceBox}
        ${stratGrid}
        ${chars}
        ${winnersTable}
        ${allTimeBox}
        ${legendarySection}
      </div>
      <div class="venue-side">${sidebar}</div>
    </div>`;

  const foot = $('footer-copy');
  if (foot) foot.textContent = `${venue.name} · Circuit Profile · ${year}`;
}

/* ══════════════════════════════════════════════════════════
   COMPARE PAGE
   URL: compare.html?series=f1&a=russell-george&b=antonelli-kimi
══════════════════════════════════════════════════════════ */

async function initComparePage() {
  const p    = params();
  const year = p.year || new Date().getFullYear();

  const [config, competitorsData, seriesData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/competitors-${p.series}-${year}.json`),
    loadJSON(`data/${p.series}-${year}.json`),
  ]);
  if (!config || !competitorsData) return;

  const series  = config.series[p.series];
  const all     = competitorsData.competitors;
  setAccent(series.accent || '#27F4D2');
  document.title = 'Driver Comparison — APEX Analytics';

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `<a href="index.html">Home</a><span class="sep">/</span><a href="standings.html?series=${p.series}">F1 ${year}</a><span class="sep">/</span><span class="current">Compare</span>`;

  // Selector always shown
  const selectorHtml = `
    <div class="cmp-page">
      <div style="padding-top:8px;border-bottom:1px solid var(--border)">
        <div style="font-family:'Bebas Neue',display;font-size:56px;letter-spacing:2px;line-height:.9;margin-bottom:8px">
          Driver <span style="color:var(--accent)">Comparison</span>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:2px;margin-bottom:20px">
          F1 · ${year} Season
        </div>
      </div>
      <div class="cmp-selector">
        <div class="cmp-sel-group">
          <div class="cmp-sel-label">Driver A</div>
          <select class="cmp-sel-select" id="sel-a">
            <option value="">Select driver…</option>
            ${all.map(d => `<option value="${d.id}" ${d.id === p.a ? 'selected' : ''}>${d.name} (#${d.number})</option>`).join('')}
          </select>
        </div>
        <button class="cmp-vs-btn" onclick="runCompare()">Compare →</button>
        <div class="cmp-sel-group">
          <div class="cmp-sel-label">Driver B</div>
          <select class="cmp-sel-select" id="sel-b">
            <option value="">Select driver…</option>
            ${all.map(d => `<option value="${d.id}" ${d.id === p.b ? 'selected' : ''}>${d.name} (#${d.number})</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="compare-result"></div>
    </div>`;

  document.getElementById('compare-page').innerHTML = selectorHtml;

  // Auto-run if both params present
  if (p.a && p.b) {
    renderComparison(p.a, p.b, all, seriesData, year, p.series);
  }
}

function runCompare() {
  const a = document.getElementById('sel-a')?.value;
  const b = document.getElementById('sel-b')?.value;
  if (!a || !b || a === b) return;
  const p = params();
  location.href = `compare.html?series=${p.series || 'f1'}&a=${a}&b=${b}`;
}

function renderComparison(idA, idB, all, seriesData, year, seriesId) {
  const dA = all.find(d => d.id === idA);
  const dB = all.find(d => d.id === idB);
  if (!dA || !dB) return;

  const sA = dA.season_2026, sB = dB.season_2026;
  const cA = '#' + dA.color, cB = '#' + dB.color;
  const schedule = seriesData?.schedule || [];

  // Build result maps
  const rA = {}, rB = {};
  (sA.results_by_round||[]).forEach(r => rA[r.round] = r);
  (sB.results_by_round||[]).forEach(r => rB[r.round] = r);

  const winner = (vA, vB, higherBetter) => {
    if (vA == null || vB == null) return '';
    return higherBetter ? (vA > vB ? 'a' : vA < vB ? 'b' : '') : (vA < vB ? 'a' : vA > vB ? 'b' : '');
  };

  const row = (label, vA, vB, higherBetter=true) => {
    const w = winner(parseFloat(vA)||0, parseFloat(vB)||0, higherBetter);
    return `
      <div class="cmp-row">
        <div class="cmp-row-val ${w==='a' ? 'winner' : ''}" style="color:${w==='a' ? cA : 'var(--dim)'}">
          ${vA ?? '—'}
        </div>
        <div class="cmp-row-mid">${label}</div>
        <div class="cmp-row-val right ${w==='b' ? 'winner' : ''}" style="color:${w==='b' ? cB : 'var(--dim)'}">
          ${vB ?? '—'}
        </div>
      </div>`;
  };

  const barRow = (label, vA, vB) => {
    const total = (parseFloat(vA)||0) + (parseFloat(vB)||0) || 1;
    const pA = Math.round(((parseFloat(vA)||0)/total)*100);
    const pB = 100-pA;
    return `
      <div class="cmp-bar-row">
        <div class="cmp-bar-side">
          <div class="cmp-bar-num" style="color:${cA}">${vA ?? 0}</div>
          <div class="cmp-bar-track">
            <div class="cmp-bar-fill" style="width:${pA}%;background:${cA};opacity:.7"></div>
          </div>
        </div>
        <div class="cmp-row-mid">${label}</div>
        <div class="cmp-bar-side right">
          <div class="cmp-bar-track">
            <div class="cmp-bar-fill" style="width:${pB}%;background:${cB};opacity:.7;margin-left:auto"></div>
          </div>
          <div class="cmp-bar-num" style="color:${cB}">${vB ?? 0}</div>
        </div>
      </div>`;
  };

  // Results grid
  const rgCell = (r, color) => {
    if (!r) return `<div class="cmp-rg-cell gm-tbd"><div class="cmp-rg-pos" style="color:#2A2A3A">—</div></div>`;
    const f = r.finish;
    const n = parseInt(f);
    let cls='', col='#4A4A66', lbl=f;
    if (f==='DNS'||f==='dns') { cls='dns'; col='#4A4A66'; }
    else if (f==='DNF'||f==='dnf') { cls='dnf'; col='#E8002D'; }
    else if (n===1)  { cls='p1';  col='#FFD700'; lbl=`P1`; }
    else if (n===2)  { cls='p2';  col='#C0C0C0'; lbl=`P2`; }
    else if (n===3)  { cls='p3';  col='#CD7F32'; lbl=`P3`; }
    else if (n<=10)  { cls='pts'; col=color;     lbl=`P${n}`; }
    else             { lbl=`P${n}`; }
    return `<div class="cmp-rg-cell ${cls}"><div class="cmp-rg-pos" style="color:${col}">${lbl}</div></div>`;
  };

  const gridA = schedule.map(r => rgCell(rA[r.round], cA)).join('');
  const gridB = schedule.map(r => rgCell(rB[r.round], cB)).join('');
  const gridLabels = schedule.map(r => `<div style="font-family:'JetBrains Mono',monospace;font-size:7px;color:var(--dim);text-align:center;width:40px;flex-shrink:0">${(r.venue||r.name||'').slice(0,3).toUpperCase()}</div>`).join('');

  const resultsSection = `
    <div class="cmp-section-label">Round by Round</div>
    <div style="overflow-x:auto">
      <div style="display:flex;gap:2px;margin-bottom:2px;min-width:max-content">${gridLabels}</div>
      <div class="cmp-results-grid" style="min-width:max-content">
        <div class="cmp-rg-col" style="flex-wrap:nowrap">${gridA}</div>
        <div class="cmp-rg-mid">${dA.code}<br>VS<br>${dB.code}</div>
        <div class="cmp-rg-col right" style="flex-wrap:nowrap">${gridB}</div>
      </div>
    </div>`;

  // Points trajectory chart data
  const cumA = [], cumB = [], labels = [];
  let ptA=0, ptB=0;
  schedule.filter(r => r.complete || rA[r.round] || rB[r.round]).forEach(r => {
    ptA += rA[r.round]?.pts || 0;
    ptB += rB[r.round]?.pts || 0;
    labels.push(`R${r.round}`);
    cumA.push(ptA);
    cumB.push(ptB);
  });

  const result = document.getElementById('compare-result');
  result.innerHTML = `
    <!-- Heads -->
    <div class="cmp-heads">
      <div class="cmp-head" style="border-left:3px solid ${cA}">
        <div class="cmp-head-num">${dA.number}</div>
        <img src="assets/drivers/${dA.id}.jpg"
             onerror="this.onerror=null;this.src='assets/drivers/${dA.id}.svg'"
             style="width:64px;height:64px;object-fit:cover;object-position:top;border-radius:2px;margin-bottom:8px">
        <div class="cmp-head-name" style="color:${cA}">${dA.name.split(' ').pop()}</div>
        <div class="cmp-head-team">${dA.name.split(' ')[0]} · #${dA.number} · ${dA.team_name}</div>
        <a href="competitor.html?series=f1&id=${dA.id}" style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:${cA};text-decoration:none;opacity:.6;margin-top:8px;display:inline-block">Profile →</a>
      </div>
      <div class="cmp-vs-divider">VS</div>
      <div class="cmp-head right" style="border-right:3px solid ${cB}">
        <div class="cmp-head-num" style="right:auto;left:-10px">${dB.number}</div>
        <img src="assets/drivers/${dB.id}.jpg"
             onerror="this.onerror=null;this.src='assets/drivers/${dB.id}.svg'"
             style="width:64px;height:64px;object-fit:cover;object-position:top;border-radius:2px;margin-bottom:8px;margin-left:auto;display:block">
        <div class="cmp-head-name" style="color:${cB}">${dB.name.split(' ').pop()}</div>
        <div class="cmp-head-team">${dB.name.split(' ')[0]} · #${dB.number} · ${dB.team_name}</div>
        <a href="competitor.html?series=f1&id=${dB.id}" style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:${cB};text-decoration:none;opacity:.6;margin-top:8px;display:inline-block">Profile →</a>
      </div>
    </div>

    <!-- Season stats -->
    <div class="cmp-section-label">2026 Season</div>
    ${row('POINTS',           sA.pts,                    sB.pts)}
    ${row('WINS',             sA.wins,                   sB.wins)}
    ${row('PODIUMS',          sA.podiums,                sB.podiums)}
    ${row('POLES',            sA.poles,                  sB.poles)}
    ${row('FASTEST LAPS',     sA.fastest_laps,           sB.fastest_laps)}
    ${row('DNFs',             sA.dnfs,                   sB.dnfs, false)}
    ${row('AVG QUAL POS',     sA.avg_qualifying_pos?.toFixed(1), sB.avg_qualifying_pos?.toFixed(1), false)}
    ${row('AVG FINISH POS',   sA.avg_finish_pos?.toFixed(1),     sB.avg_finish_pos?.toFixed(1),     false)}
    ${barRow('POINTS SPLIT',  sA.pts, sB.pts)}

    <!-- Results grid -->
    ${resultsSection}

    <!-- Career -->
    <div class="cmp-section-label">Career</div>
    ${row('CAREER WINS',      dA.career.wins,            dB.career.wins)}
    ${row('PODIUMS',          dA.career.podiums,         dB.career.podiums)}
    ${row('POLES',            dA.career.poles,           dB.career.poles)}
    ${row('CHAMPIONSHIPS',    dA.career.championships,   dB.career.championships)}
    ${row('SEASONS',          dA.career.seasons,         dB.career.seasons)}

    <!-- Charts -->
    ${labels.length > 1 ? `
    <div class="cmp-section-label">Points Trajectory</div>
    <div class="cmp-chart-card">
      <div class="cmp-chart-label">Cumulative points — ${year} season</div>
      <canvas id="chart-cmp-pts" style="max-height:200px"></canvas>
    </div>` : ''}`;

  // Draw chart
  setTimeout(() => {
    const ctx = $('chart-cmp-pts');
    if (ctx && labels.length > 1) {
      new Chart(ctx, {
        type:'line',
        data:{ labels, datasets:[
          { label:dA.name, data:cumA, borderColor:cA, backgroundColor:cA+'18', borderWidth:2, pointRadius:3, fill:true, tension:.3 },
          { label:dB.name, data:cumB, borderColor:cB, backgroundColor:cB+'18', borderWidth:2, pointRadius:3, fill:true, tension:.3 },
        ]},
        options:{ responsive:true, plugins:{ legend:{ display:true, labels:{ color:'rgba(237,234,246,.45)', font:{ family:'JetBrains Mono', size:9 }, boxWidth:12 } } },
          scales:{
            x:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}} },
            y:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}}, beginAtZero:true },
          }
        }
      });
    }
  }, 60);

  const foot = $('footer-copy');
  if (foot) foot.textContent = `${dA.name} vs ${dB.name} · F1 ${year}`;
}

/* ══════════════════════════════════════════════════════════
   SEASON PAGE
   URL: season.html?series=f1&year=2026
══════════════════════════════════════════════════════════ */

async function initSeasonPage() {
  const p    = params();
  const year = p.year || new Date().getFullYear();

  const [config, competitorsData, seriesData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/competitors-${p.series}-${year}.json`),
    loadJSON(`data/${p.series}-${year}.json`),
  ]);
  if (!config || !competitorsData) return;

  const series  = config.series[p.series];
  const drivers = competitorsData.competitors;
  const schedule = seriesData?.schedule || [];
  const completed = schedule.filter(r => r.complete);

  setAccent(series.accent || '#27F4D2');
  document.title = `F1 ${year} Season Stats — APEX Analytics`;

  const bc = $('nav-breadcrumb');
  if (bc) bc.innerHTML = `<a href="index.html">Home</a><span class="sep">/</span><a href="standings.html?series=${p.series}">F1 ${year}</a><span class="sep">/</span><span class="current">Season Stats</span>`;

  const maxPts = Math.max(...drivers.map(d => d.season_2026.pts || 0), 1);

  /* ── View 1: League Table ── */
  const leagueRows = [...drivers]
    .sort((a,b) => (b.season_2026.pts||0) - (a.season_2026.pts||0))
    .map((d, i) => {
      const s = d.season_2026;
      const color = '#'+d.color;
      const pct = Math.round((s.pts/maxPts)*100);
      return `<tr class="${i===0?'leader':''}">
        <td><span class="lt-pos ${i===0?'p1':''}">${i+1}</span></td>
        <td>
          <a href="competitor.html?series=${p.series}&id=${d.id}" style="text-decoration:none;color:inherit">
            <div class="lt-driver">${d.name}</div>
            <div class="lt-team">${d.team_name}</div>
          </a>
        </td>
        <td><span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${color}">#${d.number}</span></td>
        <td class="lt-bar-cell"><div class="lt-bar" style="width:${pct}%;background:${color}"></div></td>
        <td><span class="lt-num ${s.pts===maxPts?'hi':''}">${s.pts??0}</span></td>
        <td><span class="lt-num">${s.wins??0}</span></td>
        <td><span class="lt-num">${s.podiums??0}</span></td>
        <td><span class="lt-num">${s.poles??0}</span></td>
        <td><span class="lt-num">${s.fastest_laps??0}</span></td>
        <td><span class="lt-num">${s.dnfs??0}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted)">${s.avg_qualifying_pos?.toFixed(1)??'—'}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted)">${s.avg_finish_pos?.toFixed(1)??'—'}</td>
      </tr>`;
    }).join('');

  const leagueTable = `
    <div style="overflow-x:auto">
      <table class="league-table" id="league-tbl">
        <thead><tr>
          <th>Pos</th><th>Driver</th><th>#</th><th class="lt-bar-cell"></th>
          <th data-col="pts" class="sorted">PTS</th>
          <th data-col="wins">W</th>
          <th data-col="pod">POD</th>
          <th data-col="pol">POL</th>
          <th data-col="fl">FL</th>
          <th data-col="dnf">DNF</th>
          <th data-col="aqp">AQP</th>
          <th data-col="afp">AFP</th>
        </tr></thead>
        <tbody>${leagueRows}</tbody>
      </table>
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-top:8px;letter-spacing:1px">
      AQP = Avg Qualifying Position &nbsp;·&nbsp; AFP = Avg Finish Position &nbsp;·&nbsp; Click column headers to sort
    </div>`;

  /* ── View 2: Form Table ── */
  const formDotCls = (finish) => {
    if (!finish) return 'fd-none';
    if (finish==='DNS'||finish==='dns') return 'fd-dns';
    if (finish==='DNF'||finish==='dnf') return 'fd-dnf';
    const n = parseInt(finish);
    if (n===1) return 'fd-win';
    if (n<=3)  return 'fd-pod';
    if (n<=10) return 'fd-pts';
    return 'fd-out';
  };
  const formLabel = (finish) => {
    if (!finish) return '—';
    if (finish==='DNS') return 'D';
    if (finish==='DNF') return 'R';
    const n=parseInt(finish); return n<=20 ? `${n}` : '—';
  };

  const last5 = completed.slice(-5);
  const formRows = [...drivers]
    .sort((a,b) => {
      const ptsA = last5.reduce((s,r) => s + ((a.season_2026.results_by_round||[]).find(x=>x.round===r.round)?.pts||0), 0);
      const ptsB = last5.reduce((s,r) => s + ((b.season_2026.results_by_round||[]).find(x=>x.round===r.round)?.pts||0), 0);
      return ptsB - ptsA;
    })
    .map((d,i) => {
      const results = d.season_2026.results_by_round || [];
      const last5res = last5.map(r => results.find(x=>x.round===r.round));
      const last5pts = last5res.reduce((s,r) => s+(r?.pts||0), 0);
      const last5fin = last5res.filter(r=>r&&typeof r.finish==='number').map(r=>r.finish);
      const avgFin   = last5fin.length ? (last5fin.reduce((s,v)=>s+v,0)/last5fin.length).toFixed(1) : '—';

      // Trend: compare last 2 results to first 2
      const allRes   = results.filter(r=>typeof r.finish==='number');
      let trendCls='trend-flat', trendLabel='—';
      if (allRes.length>=2) {
        const recent = allRes.slice(-1)[0].finish;
        const older  = allRes.slice(-2)[0].finish;
        if (recent < older) { trendCls='trend-up'; trendLabel='↑'; }
        else if (recent > older) { trendCls='trend-down'; trendLabel='↓'; }
        else { trendLabel='→'; }
      }

      const dots = last5.map((r,ri) => {
        const res = last5res[ri];
        if (!res) return `<div class="form-dot fd-none">·</div>`;
        return `<div class="form-dot ${formDotCls(res.finish)}" title="R${r.round} ${r.venue||''}: ${res.finish}">${formLabel(res.finish)}</div>`;
      }).join('');

      return `<tr>
        <td>${i+1}</td>
        <td><a href="competitor.html?series=${p.series}&id=${d.id}" style="text-decoration:none;color:inherit;font-weight:500">${d.name}</a></td>
        <td><div class="form-dots">${dots}</div></td>
        <td style="font-family:'Bebas Neue',display;font-size:20px;color:var(--accent)">${last5pts}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--muted)">${avgFin}</td>
        <td><span class="form-trend ${trendCls}">${trendLabel}</span></td>
      </tr>`;
    }).join('');

  const formTable = `
    <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-bottom:12px;letter-spacing:1px">
      Sorted by points scored in last ${last5.length} races · ${last5.map(r=>`R${r.round}`).join(', ')}
    </div>
    <div style="overflow-x:auto">
      <table class="form-table">
        <thead><tr>
          <th>Pos</th><th>Driver</th>
          <th>Last ${last5.length} Results</th>
          <th>Pts (L${last5.length})</th>
          <th>Avg Fin</th>
          <th>Trend</th>
        </tr></thead>
        <tbody>${formRows}</tbody>
      </table>
    </div>`;

  /* ── View 3: Results Grid / Matrix ── */
  const matrixRows = [...drivers]
    .sort((a,b) => (b.season_2026.pts||0) - (a.season_2026.pts||0))
    .map(d => {
      const results = d.season_2026.results_by_round || [];
      const rMap = {};
      results.forEach(r => rMap[r.round]=r);
      const cells = schedule.map(r => {
        const res = rMap[r.round];
        if (!res) return r.complete ? `<td class="gm-cell gm-out">—</td>` : `<td class="gm-cell gm-tbd">·</td>`;
        const f=res.finish, n=parseInt(f);
        let cls='gm-out', lbl=n||f;
        if (f==='DNS'||f==='dns') { cls='gm-dns'; lbl='D'; }
        else if (f==='DNF'||f==='dnf') { cls='gm-dnf'; lbl='R'; }
        else if (n===1) { cls='gm-1'; lbl=1; }
        else if (n===2) { cls='gm-2'; lbl=2; }
        else if (n===3) { cls='gm-3'; lbl=3; }
        else if (n<=10) { cls='gm-pts'; }
        return `<td class="gm-cell ${cls}">${lbl}</td>`;
      }).join('');
      return `<tr>
        <td class="gm-row-name">
          <a href="competitor.html?series=${p.series}&id=${d.id}" style="text-decoration:none;color:inherit">${d.name}</a>
        </td>
        ${cells}
      </tr>`;
    }).join('');

  const roundHeaders = schedule.map(r => {
    const label = (r.venue||r.name||'').slice(0,3).toUpperCase();
    return r.venue_id
      ? `<th class="gm-th-round"><a href="venue.html?series=${p.series}&id=${r.venue_id}" style="color:inherit;text-decoration:none;opacity:.8" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color=''">${label}</a></th>`
      : `<th class="gm-th-round">${label}</th>`;
  }).join('');

  const matrix = `
    <div class="grid-matrix">
      <table>
        <thead>
          <tr>
            <th class="gm-th-driver">Driver</th>
            ${roundHeaders}
          </tr>
        </thead>
        <tbody>${matrixRows}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);letter-spacing:1px">
      <span><span style="color:#FFD700">1</span> = Win</span>
      <span><span style="color:#C0C0C0">2–3</span> = Podium</span>
      <span><span style="color:#27F4D2">4–10</span> = Points</span>
      <span style="color:var(--dim)">11+ = Out of pts</span>
      <span><span style="color:#E8002D">R</span> = Retired</span>
      <span><span style="color:#4A4A66">D</span> = DNS</span>
    </div>`;

  /* ── View 4: Championship Trajectories ── */
  const top8 = [...drivers].sort((a,b)=>(b.season_2026.pts||0)-(a.season_2026.pts||0)).slice(0,8);
  const trajLabels = completed.map(r=>`R${r.round}`);

  const trajToggles = top8.map(d => {
    const col = '#'+d.color;
    return `<div class="traj-toggle active" data-id="${d.id}" onclick="toggleTraj('${d.id}',this)" style="color:${col};border-color:${col+'55'}">
      <div class="traj-dot" style="background:${col}"></div>
      ${d.name.split(' ').pop()}
    </div>`;
  }).join('');

  const trajectories = `
    <div class="traj-controls">${trajToggles}</div>
    <div class="traj-chart-card">
      <canvas id="chart-trajectories" style="max-height:320px"></canvas>
    </div>`;

  /* Assemble page */
  document.getElementById('season-page').innerHTML = `
    <div class="season-header">
      <div class="season-h1">F1 <span style="color:var(--accent)">${year}</span> Season Stats</div>
      <div class="season-sub">${completed.length} rounds complete · ${drivers.length} drivers</div>
      <div class="view-switcher">
        <button class="view-btn active" onclick="switchView('league',this)">League Table</button>
        <button class="view-btn" onclick="switchView('form',this)">Form Guide</button>
        <button class="view-btn" onclick="switchView('matrix',this)">Results Grid</button>
        <button class="view-btn" onclick="switchView('trajectories',this)">Trajectories</button>
      </div>
    </div>

    <div class="view-panel active" id="panel-league">${leagueTable}</div>
    <div class="view-panel" id="panel-form">${formTable}</div>
    <div class="view-panel" id="panel-matrix">${matrix}</div>
    <div class="view-panel" id="panel-trajectories">${trajectories}</div>`;

  // Trajectory chart
  setTimeout(() => {
    const ctx = $('chart-trajectories');
    if (!ctx) return;
    const datasets = top8.map(d => {
      const rMap = {};
      (d.season_2026.results_by_round||[]).forEach(r => rMap[r.round]=r);
      let cum=0;
      return {
        label:     d.name.split(' ').pop(),
        data:      completed.map(r => { cum+=(rMap[r.round]?.pts||0); return cum; }),
        borderColor:     '#'+d.color,
        backgroundColor: 'transparent',
        borderWidth:     2,
        pointRadius:     3,
        tension: 0.3,
        spanGaps: true,
      };
    });
    new Chart(ctx, {
      type:'line',
      data:{ labels:trajLabels, datasets },
      options:{
        responsive:true,
        plugins:{ legend:{ display:true, labels:{ color:'rgba(237,234,246,.45)', font:{ family:'JetBrains Mono',size:9 }, boxWidth:12 } } },
        scales:{
          x:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}} },
          y:{ grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'rgba(237,234,246,.35)',font:{family:'JetBrains Mono',size:9}}, beginAtZero:true },
        }
      }
    });
  }, 80);

  const foot = $('footer-copy');
  if (foot) foot.textContent = `F1 ${year} Season Statistics · APEX Analytics`;
}

function switchView(id, btn) {
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById('panel-'+id);
  if (panel) panel.classList.add('active');
}

function toggleTraj(id, el) {
  el.classList.toggle('active');
  const ctx   = document.getElementById('chart-trajectories');
  const chart = ctx ? Chart.getChart(ctx) : null;
  if (!chart) return;
  // Dataset label is set to driver.name.split(' ').pop() (surname)
  const surname = id.split('-').slice(0, -1).reverse().join(' ').split(' ').pop()
               || id.split('-')[0];
  const ds = chart.data.datasets.find(d =>
    d.label.toLowerCase().includes(id.split('-')[0]) ||
    id.includes(d.label.toLowerCase().replace(/\s+/g,'-'))
  );
  if (ds) { ds.hidden = !el.classList.contains('active'); chart.update(); }
}

/* ══════════════════════════════════════════════════════════
   HUB PAGE V2 — Editorial newsroom front page
   URL: index.html
══════════════════════════════════════════════════════════ */

async function initHubPageV2() {
  const config = await loadJSON('data/config.json');
  if (!config) return;

  const year      = config.site.current_year;
  const activeIds = config.site.active_series;
  const allData   = {};
  const allComps  = {};

  await Promise.all(activeIds.map(async id => {
    allData[id]  = await loadJSON(`data/${id}-${year}.json`);
    allComps[id] = await loadJSON(`data/competitors-${id}-${year}.json`);
  }));

  // Default accent — first active series
  const firstSeries = config.series[activeIds[0]];
  setAccent(firstSeries?.accent || '#27F4D2');

  // Date info
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  // Find lead story — most recently completed race
  let leadRace=null, leadSeriesId=null;
  activeIds.forEach(sid => {
    const sd = allData[sid];
    if (!sd) return;
    const done = sd.schedule.filter(r => r.complete);
    if (!done.length) return;
    const last = done[done.length-1];
    if (!leadRace || new Date(last.date) > new Date(leadRace.date)) {
      leadRace = last; leadSeriesId = sid;
    }
  });

  // Championship strip — top 2 per active series
  const champRows = activeIds.map(sid => {
    const sd = allData[sid];
    const sr = config.series[sid];
    if (!sd?.standings?.drivers?.length) return '';
    const top = sd.standings.drivers;
    const leader = top[0];
    const second = top[1];
    const gap = second ? leader.pts - second.pts : null;
    return `<a href="standings.html?series=${sid}" class="champ-row">
      <div class="champ-row-series" style="color:#${sr.color}">${sr.short}</div>
      <div>
        <div class="champ-row-leader">${leader.driver}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim)">${leader.team}</div>
      </div>
      <div class="champ-row-gap">
        <div style="font-family:'Bebas Neue',display;font-size:20px;color:#${sr.color}">${leader.pts}</div>
        <div style="font-size:9px">${gap ? `+${gap}` : 'Leader'}</div>
      </div>
    </a>`;
  }).filter(Boolean).join('');

  // Weekend timeline — all sessions this week / recent weekend
  const timelineItems = [];
  activeIds.forEach(sid => {
    const sd = allData[sid];
    const sr = config.series[sid];
    if (!sd) return;
    sd.schedule.forEach(r => {
      const status = raceStatus(r);
      if (status === 'done' || status === 'analyzing' || status === 'today') {
        timelineItems.push({ race:r, series:sr, sid, status });
      }
    });
    // Next upcoming
    const next = sd.schedule.find(r => raceStatus(r)==='upcoming');
    if (next) timelineItems.push({ race:next, series:sr, sid, status:'upcoming' });
  });

  const timelinePills = timelineItems.slice(0,12).map(item => {
    const r   = item.race;
    const cls = item.status === 'done' ? 'done' : item.status === 'analyzing' ? 'live' : item.status === 'today' ? 'next' : '';
    const statusText = item.status === 'done' ? 'Done' : item.status === 'analyzing' ? '⚡ Live' : item.status === 'today' ? 'Today' : fmtDate(r.date);
    return `<a href="race.html?series=${item.sid}&round=${r.round}" class="tl-pill ${cls}">
      <div class="tl-series" style="color:#${item.series.color}">${item.series.short}</div>
      <div class="tl-name">${(r.venue||r.name||'').slice(0,10)}</div>
      <div class="tl-status ${cls||'upcoming'}">${statusText}</div>
    </a>`;
  }).join('');

  // Lead card
  let leadCardHtml = '';
  if (leadRace && leadSeriesId) {
    const sr       = config.series[leadSeriesId];
    const winner   = leadRace.race?.winner || 'TBD';
    const winNum   = leadRace.race?.results?.[0]?.number || '—';
    const winTeam  = leadRace.race?.results?.[0]?.team   || '';
    const summary  = leadRace.summary || '';
    const titleParts = leadRace.name.split(' ');
    const lastWord   = titleParts.pop();
    const titleHtml  = `${titleParts.join(' ')} <span class="acc">${lastWord}</span>`;

    leadCardHtml = `
      <a href="race.html?series=${leadSeriesId}&round=${leadRace.round}" class="lead-card" style="--accent-rgb:${sr.accent_rgb||'39,244,210'}">
        <div class="lead-card-body">
          <div class="lead-card-eyebrow">${sr.name} · Round ${leadRace.round} · ${leadRace.venue} · ${fmtDate(leadRace.date)}</div>
          <div class="lead-card-h2">${titleHtml}</div>
          <div class="lead-card-summary">${summary.slice(0,180)}${summary.length>180?'…':''}</div>
          <div class="lead-card-footer">
            <span class="lead-card-winner">🏆 ${winner}</span>
            <span class="lead-card-cta">Full Analysis →</span>
          </div>
        </div>
        <div class="lead-card-aside">
          <div class="lead-aside-num">${winNum}</div>
          <div class="lead-aside-name" style="color:#${sr.color}">${winner.split(' ').pop()}</div>
          <div class="lead-aside-team">${winTeam}</div>
        </div>
      </a>`;
  }

  // Story grid — recent races + upcoming
  const stories = [];
  activeIds.forEach(sid => {
    const sd = allData[sid];
    const sr = config.series[sid];
    if (!sd) return;
    const done = sd.schedule.filter(r => r.complete && r !== leadRace);
    done.slice(-2).reverse().forEach(r => stories.push({ race:r, sr, sid, state:'done' }));
    const analyzing = sd.schedule.find(r => !r.complete && raceStatus(r)==='analyzing');
    if (analyzing) stories.push({ race:analyzing, sr, sid, state:'analyzing' });
    const upcoming = sd.schedule.find(r => !r.complete && raceStatus(r)==='upcoming');
    if (upcoming) stories.push({ race:upcoming, sr, sid, state:'upcoming' });
  });

  stories.sort((a,b) => {
    const order = { analyzing:0, done:1, upcoming:2 };
    return (order[a.state]||1) - (order[b.state]||1);
  });

  const storyCards = stories.slice(0,6).map(item => {
    const r   = item.race;
    const cls = item.state === 'analyzing' ? 'analyzing' : item.state === 'upcoming' ? 'upcoming' : '';
    const winner = r.race?.winner;
    const summary = r.summary ? r.summary.slice(0,100)+(r.summary.length>100?'…':'') : fmtDate(r.date)+' · '+r.venue;
    const resultTag = item.state === 'analyzing'
      ? `<span style="color:var(--orange);font-size:8px;letter-spacing:1px">⚡ ANALYZING</span>`
      : item.state === 'upcoming'
      ? `<span style="color:var(--dim);font-size:8px">${fmtDate(r.date)}</span>`
      : winner ? `<span style="font-size:9px">🏆 ${winner}</span>` : '';

    return `<a href="race.html?series=${item.sid}&round=${r.round}" class="story-card-new ${cls}">
      <div class="sc-eyebrow" style="color:#${item.sr.color}">${item.sr.short} · R${r.round} · ${r.venue||r.name}</div>
      <div class="sc-h">${r.name}</div>
      <div class="sc-summary">${summary}</div>
      <div class="sc-footer-row">
        <span class="sc-result">${resultTag}</span>
        <span class="sc-link" style="color:#${item.sr.color}">${item.state==='upcoming'?'Preview →':'Analysis →'}</span>
      </div>
    </a>`;
  }).join('');

  // Total races count
  let totalDone = 0;
  activeIds.forEach(sid => {
    if (allData[sid]) totalDone += allData[sid].schedule.filter(r=>r.complete).length;
  });

  // Coming soon series
  const comingSoon = config.site.coming_soon || [];
  const comingSoonHtml = comingSoon.map(sid => {
    const sr = config.series[sid];
    return sr ? `<span class="coming-series" style="border-color:#${sr.color}44">${sr.short||sr.name}</span>` : '';
  }).filter(Boolean).join('');

  // Quick nav links
  const quickNavLinks = [
    { href:`standings.html?series=f1`, label:'Standings', title:'Championship Table' },
    { href:`season.html?series=f1`,    label:'Stats',     title:'Season Statistics' },
    { href:`compare.html?series=f1`,   label:'Compare',   title:'Driver vs Driver' },
    { href:`season.html?series=f1`,    label:'Archive',   title:'Past Seasons' },
  ];

  // Build the page
  document.getElementById('hub-root').innerHTML = `

    <!-- Hero -->
    <div class="hub-hero">
      <div class="hub-hero-bg-word">APEX</div>
      <div class="hub-hero-left">
        <div class="hub-hero-eyebrow">${dateStr}</div>
        <h1 class="hub-hero-h1">This Week<br>in <span class="acc">Racing</span></h1>
        <p class="hub-hero-deck">Deep race analysis across every major motorsport series — results, strategy, championship tracking and season archives. ${totalDone} races analysed so far in ${year}.</p>
        <div class="hub-series-dots">
          ${activeIds.map(sid => {
            const sr = config.series[sid];
            return `<span class="hub-series-dot" style="--dot-color:#${sr.color}">${sr.short}</span>`;
          }).join('<span style="color:var(--border);margin:0 4px">·</span>')}
          ${comingSoon.length ? `<span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);letter-spacing:1px">+ ${comingSoon.length} more coming</span>` : ''}
        </div>
      </div>
      <div class="hub-hero-right">
        <div class="champ-strip-title">Championship Leaders</div>
        <div class="champ-strip">${champRows || '<div style="color:var(--dim);font-family:\'JetBrains Mono\',monospace;font-size:9px">No standings data yet</div>'}</div>
      </div>
    </div>

    <!-- Weekend Timeline -->
    ${timelinePills ? `
    <div class="hub-timeline">
      <div class="timeline-label">This weekend in racing</div>
      <div class="timeline-track">${timelinePills}</div>
    </div>` : ''}

    <!-- Main grid -->
    <div class="hub-main">

      <!-- Feed -->
      <div class="hub-feed">
        ${leadCardHtml}
        <div class="story-grid-wrap">${storyCards}</div>
      </div>

      <!-- Aside -->
      <div class="hub-aside">

        <div style="background:var(--surface);border:1px solid var(--border);padding:16px 18px">
          <div style="font-family:'Bebas Neue',display;font-size:14px;letter-spacing:2px;margin-bottom:12px">Quick Links</div>
          <div class="quick-nav-grid">
            ${quickNavLinks.map(l => `
              <a href="${l.href}" class="quick-nav-btn">
                <div class="qn-label">${l.label}</div>
                <div class="qn-title">${l.title}</div>
                <div class="qn-arrow">→</div>
              </a>`).join('')}
          </div>
        </div>

        <div class="about-card">
          <div style="font-family:'Bebas Neue',display;font-size:14px;letter-spacing:2px;margin-bottom:10px">About APEX</div>
          <p style="font-size:12px;color:var(--muted);line-height:1.75;font-weight:300;margin-bottom:14px">
            Deep race analysis across every major motorsport series. Full field results, strategy breakdowns, championship tracking, and season archives — updated after every event.
          </p>
          <div style="font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px">Series Coverage</div>
          ${activeIds.map(sid => {
            const sr = config.series[sid];
            return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03)">
              <div style="width:6px;height:6px;border-radius:50%;background:#${sr.color};flex-shrink:0"></div>
              <span style="font-size:12px;color:var(--muted)">${sr.name}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--accent);margin-left:auto">Live</span>
            </div>`;
          }).join('')}
          ${comingSoon.slice(0,4).map(sid => {
            const sr = config.series[sid];
            return sr ? `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);opacity:.35">
              <div style="width:6px;height:6px;border-radius:50%;background:#${sr.color};flex-shrink:0"></div>
              <span style="font-size:12px;color:var(--dim)">${sr.name}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--dim);margin-left:auto">Coming Soon</span>
            </div>` : '';
          }).filter(Boolean).join('')}
        </div>

      </div>
    </div>`;
}

/* ── nameToId helper ─────────────────────────────────────
   Converts a display name like "Lewis Hamilton" to a
   competitor ID like "hamilton-lewis". Uses a loaded
   competitors dataset when available, falls back to
   reverse-split with accent stripping.
── */
const _nameIdCache = {};

function buildNameIdCache(competitors) {
  if (!competitors) return;
  competitors.forEach(c => {
    _nameIdCache[c.name]       = c.id;
    _nameIdCache[c.name.toLowerCase()] = c.id;
    // Also map short name (surname only)
    const surname = c.name.split(' ').pop();
    _nameIdCache[surname]              = c.id;
    _nameIdCache[surname.toLowerCase()]= c.id;
  });
}

function nameToId(name) {
  if (!name) return null;
  // Check cache first
  if (_nameIdCache[name]) return _nameIdCache[name];
  if (_nameIdCache[name.toLowerCase()]) return _nameIdCache[name.toLowerCase()];
  // Fallback: reverse split + strip accents
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .split(' ').reverse().join('-')
    .replace(/[^a-z0-9-]/g, '');
}

/* ══════════════════════════════════════════════════════════
   CIRCUITS INDEX PAGE
   URL: circuits.html?series=f1&year=2026
══════════════════════════════════════════════════════════ */

async function initCircuitsPage() {
  const p    = params();
  const year = p.year || new Date().getFullYear();

  const [config, venuesData, seriesData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/venues-${p.series || 'f1'}-${year}.json`),
    loadJSON(`data/${p.series || 'f1'}-${year}.json`),
  ]);
  if (!config || !venuesData) return;

  const series = config.series[p.series || 'f1'];
  setAccent(series?.accent || '#27F4D2');
  document.title = `F1 ${year} Circuits — APEX Analytics`;

  // Build round→result map from seriesData
  const raceResults = {};
  (seriesData?.schedule || []).forEach(r => {
    if (r.complete && r.venue_id) {
      raceResults[r.venue_id] = {
        winner: r.race?.winner,
        round:  r.round,
        margin: r.race?.margin,
      };
    }
  });

  // Group venues by tier, sort by round number within tier
  const venues = venuesData.venues;
  const byTier = { 1:[], 2:[], 3:[] };
  venues.forEach(v => {
    const tier = v.tier || 3;
    byTier[tier].push(v);
  });
  // Sort each tier by 2026 round number
  Object.values(byTier).forEach(arr => {
    arr.sort((a,b) => (a['2026_race']?.round||99) - (b['2026_race']?.round||99));
  });

  const tierNames = { 1:'Iconic Circuits', 2:'Established Venues', 3:'Modern Circuits' };

  const renderCard = (v) => {
    const round    = v['2026_race']?.round;
    const result   = raceResults[v.id];
    const tierCls  = `t${v.tier}`;
    const bgWord   = v.short.toUpperCase().slice(0,4);

    return `
      <a href="venue.html?series=${p.series||'f1'}&id=${v.id}" class="circuit-card ${tierCls}">
        <div class="cc-bg-word">${bgWord}</div>
        <div class="cc-round">${round ? `Round ${round} · ` : ''}${v.flag} ${v.country}</div>
        <div class="cc-name">${v.name}</div>
        <div class="cc-location">${v.location}</div>
        <div class="cc-facts">
          <span><strong>${v.lap_length_km}km</strong> lap</span>
          <span><strong>${v.turns}</strong> turns</span>
          <span><strong>${v.drs_zones}</strong> DRS</span>
          <span>Since <strong>${v.first_f1_gp}</strong></span>
        </div>
        ${result ? `
        <div class="cc-result">
          🏆 <span class="winner">${result.winner}</span>
          ${result.margin ? `<span style="color:var(--dim)"> · ${result.margin}</span>` : ''}
        </div>` : round ? `
        <div class="cc-result" style="color:var(--dim)">
          R${round} · ${fmtDate(seriesData?.schedule?.find(r=>r.round===round)?.date||'')}
        </div>` : ''}
        <div class="cc-cta">Circuit Guide →</div>
      </a>`;
  };

  const sections = [1, 2, 3].map(tier => {
    if (!byTier[tier].length) return '';
    const labelCls = `t${tier}`;
    const tierLabel = { 1:'⭐ Iconic', 2:'Established', 3:'Modern' }[tier];
    return `
      <div class="tier-label ${labelCls}">${tierLabel} — ${tierNames[tier]}</div>
      <div class="circuits-grid">
        ${byTier[tier].map(renderCard).join('')}
      </div>`;
  }).join('');

  document.getElementById('circuits-page').innerHTML = `
    <div class="circuits-header">
      <h1 class="circuits-h1">F1 <span class="acc">${year}</span> Circuits</h1>
      <div class="circuits-sub">${venues.length} venues · Formula 1 World Championship</div>
    </div>
    ${sections}`;

  const foot = $('footer-copy');
  if (foot) foot.textContent = `F1 ${year} · ${venues.length} Circuits`;
}
