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
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color));
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
      <div class="hero-eyebrow">${series.name} · Round ${race.round} · ${race.venue} · ${fmtDate(race.date)}</div>
      <h1 class="hero-h1">${titleHtml}</h1>
      <p class="hero-deck">${race.summary || 'Race analysis coming soon.'}</p>
      <div class="hero-chips">${chips.join('')}</div>
    </div>
    ${right}`;
}

/* ── STATS BAR ───────────────────────────────────────────── */

function renderStatsBar(race) {
  if (!race.stats) return '';
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
    <span class="current">R${race.round} · ${race.name}</span>`;

  /* hero */
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

  const [config, seriesData] = await Promise.all([
    loadJSON('data/config.json'),
    loadJSON(`data/${p.series}-${year}.json`),
  ]);
  if (!config || !seriesData) return;

  const series = config.series[p.series];
  if (!series) return;

  setAccent(series.accent || series.color || '#FFFFFF');
  document.title = `${series.name} ${year} Standings — APEX Analytics`;

  const isF1   = series.id === 'f1';
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
        ${!isF1 ? '<th>#</th>' : ''}
        <th>Driver</th>
        <th style="width:120px"></th>
        <th style="text-align:right">Pts</th>
        <th style="text-align:right">Gap</th>
        <th style="text-align:center">Wins</th>
      </tr></thead>
      <tbody>
        ${drivers.map((d, i) => `<tr class="${i === 0 ? 'leader' : ''}">
          <td><span class="sf-pos${i === 0 ? ' p1' : ''}">${d.pos}</span></td>
          ${!isF1 ? `<td class="sf-num">${d.number || ''}</td>` : ''}
          <td>
            <div class="sf-name">${d.driver}</div>
            <div class="sf-team">${d.team}</div>
          </td>
          <td class="sf-bar-cell">
            <div class="sf-bar" style="width:${Math.round((d.pts / maxPts) * 100)}%;background:${d.color || 'var(--accent)'}"></div>
          </td>
          <td class="sf-pts">${d.pts}</td>
          <td class="sf-gap">${i === 0 ? 'Leader' : '−' + (maxPts - d.pts)}</td>
          <td class="sf-wins">${d.wins ?? '—'}</td>
        </tr>`).join('')}
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
        <thead><tr><th>Pos</th><th>Constructor</th><th style="width:120px"></th><th style="text-align:right">Pts</th></tr></thead>
        <tbody>
          ${cons.map((c, i) => `<tr class="${i === 0 ? 'leader' : ''}">
            <td><span class="sf-pos${i === 0 ? ' p1' : ''}">${c.pos}</span></td>
            <td><div class="sf-name">${c.team}</div></td>
            <td class="sf-bar-cell">
              <div class="sf-bar" style="width:${Math.round((c.pts / maxCons) * 100)}%;background:${c.color || 'var(--accent)'}"></div>
            </td>
            <td class="sf-pts">${c.pts}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  /* schedule column */
  const scheduleItems = seriesData.schedule.map(r => {
    const st     = raceStatus(r);
    const cls    = r.complete ? 'done' : st === 'analyzing' ? 'analyzing' : st === 'today' ? 'next' : '';
    const link   = r.complete || st !== 'upcoming'
      ? `onclick="location.href='race.html?series=${p.series}&round=${r.round}&year=${year}'" style="cursor:pointer"`
      : '';
    const badge  = r.complete
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
        <div class="si-sub">${r.venue}</div>
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
            <div class="si-sub">${r.venue}</div>
          </div>
          ${badge}
        </div>`;
      }).join('');

      schedEl.innerHTML = `<div class="schedule-list">${items}</div>`;
    }
  });

  /* series tab switcher */
  document.querySelectorAll('.series-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.series-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('[data-series-panel]').forEach(p => p.style.display = 'none');
      btn.classList.add('active');
      const panel = document.querySelector(`[data-series-panel="${btn.dataset.series}"]`);
      if (panel) panel.style.display = 'block';
    });
  });

  /* activate first tab */
  const firstTab = document.querySelector('.series-tab');
  if (firstTab) firstTab.click();
}
