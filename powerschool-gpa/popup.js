'use strict';

const GRADE_PTS = {
  'A+': 4.00, 'A': 4.00, 'A-': 3.70,
  'B+': 3.30, 'B': 3.00, 'B-': 2.70,
  'C+': 2.30, 'C': 2.00, 'C-': 1.70,
  'D+': 1.30, 'D': 1.00, 'D-': 0.70,
  'F':  0.00,
};

// Midpoint of each letter grade's percentage range (used for % display mode)
const GRADE_PCT = {
  'A+': 98.5, 'A': 94.5, 'A-': 91.0,
  'B+': 88.0, 'B': 84.5, 'B-': 81.0,
  'C+': 78.0, 'C': 74.5, 'C-': 71.0,
  'D+': 68.0, 'D': 64.5, 'D-': 61.0,
  'F':  50.0,
};

function isAP(name) {
  return /^AP\s/i.test(String(name).trim());
}

function pctToLetter(pct) {
  if (pct >= 97) return 'A+';
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A-';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B-';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C-';
  if (pct >= 67) return 'D+';
  if (pct >= 63) return 'D';
  if (pct >= 60) return 'D-';
  return 'F';
}

const TERMS = ['T1', 'T2', 'T3', 'Y1'];
let currentTerm = 'T1';
let termData = { T1: [], T2: [], T3: [], Y1: [] };
let gpaMode = 'gpa'; // 'gpa' | 'pct'

function newCourse() {
  return { name: '', grade: '', credits: '' };
}

function save() {
  chrome.storage.local.set({ termData, currentTerm, gpaMode });
}

// Returns number (valid grade pts), null (P/NP — valid but excluded), or undefined (invalid)
function gradePoints(grade) {
  if (!grade) return undefined;
  const g = grade.trim().toUpperCase();
  if (g === 'P' || g === 'NP') return null;
  return Object.prototype.hasOwnProperty.call(GRADE_PTS, g) ? GRADE_PTS[g] : undefined;
}

function calcGPA(courses) {
  let unweightedSum = 0, unweightedPctSum = 0, unweightedCount = 0;
  let weightedPts = 0, weightedPctPts = 0, weightedCredits = 0;

  for (const c of courses) {
    const pts = gradePoints(c.grade);
    if (pts === undefined || pts === null) continue;
    const letter  = c.grade.trim().toUpperCase();
    const pct     = GRADE_PCT[letter] ?? null;
    const credits = parseFloat(c.credits) || 0;
    const ap      = isAP(c.name);

    unweightedSum += pts;
    if (pct !== null) unweightedPctSum += pct;
    unweightedCount++;

    if (credits > 0) {
      // AP courses get +10 percentage points in weighted calculations
      const wPct = pct !== null ? (ap ? Math.min(pct + 10, 100) : pct) : null;
      const wPts = (ap && pct !== null)
        ? (GRADE_PTS[pctToLetter(Math.min(pct + 10, 100))] ?? pts)
        : pts;

      weightedPts     += wPts * credits;
      if (wPct !== null) weightedPctPts += wPct * credits;
      weightedCredits += credits;
    }
  }

  return {
    unweighted:    unweightedCount  > 0 ? unweightedSum    / unweightedCount  : null,
    weighted:      weightedCredits  > 0 ? weightedPts      / weightedCredits  : null,
    unweightedPct: unweightedCount  > 0 ? unweightedPctSum / unweightedCount  : null,
    weightedPct:   weightedCredits  > 0 ? weightedPctPts   / weightedCredits  : null,
    courseCount:   unweightedCount,
    totalCredits:  weightedCredits,
  };
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderRows() {
  const tbody   = document.getElementById('coursesBody');
  const courses = termData[currentTerm];
  tbody.innerHTML = '';

  if (courses.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No courses yet — click Add Course or use Auto-fill</td></tr>';
    updateResults();
    return;
  }

  for (let i = 0; i < courses.length; i++) {
    const c    = courses[i];
    const pts  = gradePoints(c.grade);
    const ptsText  = (pts !== undefined && pts !== null) ? pts.toFixed(2) : '—';
    const ptsClass = (pts !== undefined && pts !== null) ? '' : 'dim';
    const gradeCls = c.grade === '' ? '' : pts !== undefined ? ' ok' : ' err';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="inp inp-name"    type="text"   placeholder="Course name" value="${esc(c.name)}"    data-i="${i}" data-field="name"></td>
      <td><input class="inp inp-grade${gradeCls}" type="text" placeholder="A, B+…"     value="${esc(c.grade)}"   data-i="${i}" data-field="grade" list="gradeList" maxlength="3"></td>
      <td><input class="inp inp-credits" type="number" placeholder="1.0" step="0.5" min="0" max="10" value="${esc(c.credits)}" data-i="${i}" data-field="credits"></td>
      <td class="pts-cell ${ptsClass}">${ptsText}</td>
      <td><button class="btn-del" data-i="${i}" title="Remove">×</button></td>
    `;
    tbody.appendChild(tr);
  }

  updateResults();
}

function updateResults() {
  const courses = termData[currentTerm];
  const { unweighted, weighted, unweightedPct, weightedPct, courseCount, totalCredits } = calcGPA(courses);

  const isPct = gpaMode === 'pct';

  document.getElementById('unweightedLabel').textContent = isPct ? 'Unweighted Avg' : 'Unweighted GPA';
  document.getElementById('weightedLabel').textContent   = isPct ? 'Weighted Avg'   : 'Weighted GPA';

  const uwVal  = document.getElementById('unweightedVal');
  const wVal   = document.getElementById('weightedVal');
  const uwNote = document.getElementById('unweightedNote');
  const wNote  = document.getElementById('weightedNote');
  const meta   = document.getElementById('resultMeta');

  const uwDisplay = isPct ? unweightedPct : unweighted;
  const wDisplay  = isPct ? weightedPct   : weighted;

  if (uwDisplay === null) {
    uwVal.textContent  = '—';
    uwNote.textContent = 'No grades entered';
  } else {
    uwVal.textContent  = isPct ? unweightedPct.toFixed(1) + '%' : unweighted.toFixed(2);
    uwNote.textContent = `${courseCount} course${courseCount !== 1 ? 's' : ''}`;
  }

  if (wDisplay === null) {
    wVal.textContent  = '—';
    wNote.textContent = totalCredits === 0 ? 'Add credits to calculate' : 'No valid grades';
  } else {
    wVal.textContent  = isPct ? weightedPct.toFixed(1) + '%' : weighted.toFixed(2);
    wNote.textContent = `${totalCredits} credit${totalCredits !== 1 ? 's' : ''}`;
  }

  meta.innerHTML = courseCount > 0
    ? `<span>Term: <strong>${currentTerm}</strong></span><span>${courseCount} course${courseCount !== 1 ? 's' : ''} · ${totalCredits > 0 ? totalCredits + ' credit' + (totalCredits !== 1 ? 's' : '') : 'no credits set'}</span>`
    : '';
}

function setActiveTerm(term) {
  document.querySelectorAll('.term-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.term === term);
  });
}

function setActiveMode(mode) {
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
}

// ── Auto-fill (injected into page) ───────────────────────────────────────────

// This function runs inside the page's context — no closure access to popup vars.
function scrapeGrades(term) {
  function txt(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  const GRADE_RE = /^(A[+-]?|B[+-]?|C[+-]?|D[+-]?|F|P|NP)$/i;

  // Convert a numeric percentage to a letter grade using the standard 4.0 scale
  function percentToLetter(pct) {
    if (pct >= 97) return 'A+';
    if (pct >= 93) return 'A';
    if (pct >= 90) return 'A-';
    if (pct >= 87) return 'B+';
    if (pct >= 83) return 'B';
    if (pct >= 80) return 'B-';
    if (pct >= 77) return 'C+';
    if (pct >= 73) return 'C';
    if (pct >= 70) return 'C-';
    if (pct >= 67) return 'D+';
    if (pct >= 63) return 'D';
    if (pct >= 60) return 'D-';
    return 'F';
  }

  // Accept a letter grade or a numeric percentage string; returns letter or null
  function parseGrade(raw) {
    const t = raw.trim();
    if (GRADE_RE.test(t)) return t.toUpperCase();
    const pct = parseFloat(t);
    if (!isNaN(pct) && pct >= 0 && pct <= 100) return percentToLetter(pct);
    return null;
  }

  // ── Strategy 1: Grades & Attendance page (home.html) ────────────────────
  // PowerSchool rows for each course have id="ccid_XXXXXX".
  // Each term grade is a link whose href contains "fg=T1" (or T2/T3/Y1).
  // Grades are numeric percentages; course name is in td.table-element-text-align-start.
  {
    const courseRows = document.querySelectorAll('tr[id^="ccid_"]');
    if (courseRows.length > 0) {
      const courses = [];
      const seen = new Set();

      // For Y1: also pull in minimester (M1/M2) and semester (S1) courses with
      // their credit weights so weighted GPA is correct.
      const FG_CREDITS = { Y1: '1', M1: '0.25', M2: '0.25', S1: '0.5', S2: '1'};
      const fgOrder = term === 'Y1' ? ['Y1', 'M1', 'M2', 'S1', 'S2'] : [term];

      for (const row of courseRows) {
        let grade = null;
        let credits = '1';

        for (const fg of fgOrder) {
          const link = row.querySelector(`a[href*="fg=${fg}"]`);
          if (!link) continue;
          const g = parseGrade(txt(link));
          if (g) { grade = g; credits = FG_CREDITS[fg] || '1'; break; }
        }

        if (!grade) continue;

        // Course name: first text node inside the dedicated cell
        const nameTd = row.querySelector('td.table-element-text-align-start');
        if (!nameTd) continue;

        let name = '';
        for (const node of nameTd.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            // Strip non-breaking spaces and surrounding whitespace
            const t = node.textContent.replace(/ /g, '').trim();
            if (t.length > 1) { name = t; break; }
          }
        }

        if (!name || name.length < 2) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        courses.push({ name, grade, credits });
      }

      if (courses.length > 0) return { courses, error: null };
    }
  }

  // ── Strategy 2: Grade History page (termgrades.html) ────────────────────
  // Each row is one term-course record. We find a "Term" or "Store Code"
  // column and filter rows matching our selected term, then grab the grade.
  for (const table of document.querySelectorAll('table')) {
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) continue;

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    const headers = headerCells.map(h => txt(h).toUpperCase());

    const nameCol   = headers.findIndex(h => /^course/i.test(h));
    const storeCol  = headers.findIndex(h => /^term$|^store\s*code$/i.test(h));
    const gradeCol  = headers.findIndex(h => /^(grade|letter\s*grade|percent)$/i.test(h));
    const creditCol = headers.findIndex(h => /^credit/i.test(h));

    if (nameCol === -1 || storeCol === -1 || gradeCol === -1) continue;

    const bodyRows = Array.from(
      table.querySelectorAll('tbody tr').length
        ? table.querySelectorAll('tbody tr')
        : table.querySelectorAll('tr')
    ).filter(r => r !== headerRow);

    const courses = [];
    const seen = new Set();

    for (const row of bodyRows) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length <= Math.max(nameCol, storeCol, gradeCol)) continue;
      if (txt(cells[storeCol]).toUpperCase() !== term) continue;

      const name  = txt(cells[nameCol]);
      const grade = parseGrade(txt(cells[gradeCol]));
      if (!name || name.length < 2 || !grade) continue;

      if (!seen.has(name)) {
        seen.add(name);
        const credits = creditCol !== -1 ? txt(cells[creditCol]) : '1';
        courses.push({ name, grade, credits: credits || '1' });
      }
    }

    if (courses.length > 0) return { courses, error: null };
  }

  // ── Strategy 3: Generic — table with term-named header columns ───────────
  for (const table of document.querySelectorAll('table')) {
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    if (!headerRow) continue;

    const headerCells = Array.from(headerRow.querySelectorAll('th, td'));
    const headers = headerCells.map(h => txt(h).toUpperCase());
    const termCol = headers.findIndex(h => h === term);
    if (termCol === -1) continue;

    const bodyRows = Array.from(
      table.querySelectorAll('tbody tr').length
        ? table.querySelectorAll('tbody tr')
        : table.querySelectorAll('tr')
    ).filter(r => r !== headerRow);

    const courses = [];
    for (const row of bodyRows) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length <= termCol) continue;

      const nameEl = cells[0].querySelector('a') || cells[0];
      const name = txt(nameEl).split('\n')[0].trim();
      if (!name || name.length < 2 || name.length > 100) continue;

      const grade = parseGrade(txt(cells[termCol]).split(/\s/)[0]);
      if (!grade) continue;

      courses.push({ name, grade, credits: '1' });
    }

    if (courses.length > 0) return { courses, error: null };
  }

  return {
    courses: [],
    error: 'No grades found. Navigate to Grades & Attendance or Grade History, then try again.',
  };
}

async function autofill() {
  const btn    = document.getElementById('autofillBtn');
  const status = document.getElementById('statusMsg');

  btn.disabled       = true;
  status.textContent = 'Reading page…';
  status.className   = 'status-msg';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   scrapeGrades,
      args:   [currentTerm],
    });

    const { courses, error } = results[0].result;
    if (error)            throw new Error(error);
    if (!courses.length)  throw new Error('No grades found on this page');

    termData[currentTerm] = courses;
    save();
    renderRows();

    status.textContent = `✓ Imported ${courses.length} course${courses.length !== 1 ? 's' : ''}`;
    status.className   = 'status-msg ok';
  } catch (err) {
    status.textContent = err.message || 'Could not read page';
    status.className   = 'status-msg err';
  } finally {
    btn.disabled = false;
    setTimeout(() => { status.textContent = ''; status.className = 'status-msg'; }, 5000);
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['termData', 'currentTerm', 'gpaMode'], result => {
    if (result.termData) {
      termData = Object.assign({ T1: [], T2: [], T3: [], Y1: [] }, result.termData);
    }
    if (result.currentTerm && TERMS.includes(result.currentTerm)) {
      currentTerm = result.currentTerm;
    }
    if (result.gpaMode === 'pct' || result.gpaMode === 'gpa') {
      gpaMode = result.gpaMode;
    }
    setActiveTerm(currentTerm);
    setActiveMode(gpaMode);
    renderRows();
  });

  // Term switching
  document.getElementById('termTabs').addEventListener('click', e => {
    const btn = e.target.closest('.term-tab');
    if (!btn) return;
    currentTerm = btn.dataset.term;
    setActiveTerm(currentTerm);
    save();
    renderRows();
  });

  // Add course
  document.getElementById('addBtn').addEventListener('click', () => {
    termData[currentTerm].push(newCourse());
    save();
    renderRows();
    const inputs = document.querySelectorAll('.inp-name');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  // Clear all courses for current term
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!termData[currentTerm].length) return;
    if (!confirm(`Clear all courses for ${currentTerm}?`)) return;
    termData[currentTerm] = [];
    save();
    renderRows();
  });

  // Live input: update data + recompute
  document.getElementById('coursesBody').addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset.i) return;
    const i     = parseInt(el.dataset.i, 10);
    const field = el.dataset.field;
    termData[currentTerm][i][field] = el.value;

    if (field === 'grade') {
      const pts = gradePoints(el.value);
      el.className = 'inp inp-grade' + (el.value === '' ? '' : pts !== undefined ? ' ok' : ' err');
      const ptsCell = el.closest('tr').querySelector('.pts-cell');
      if (ptsCell) {
        if (pts !== undefined && pts !== null) {
          ptsCell.textContent = pts.toFixed(2);
          ptsCell.className   = 'pts-cell';
        } else {
          ptsCell.textContent = '—';
          ptsCell.className   = 'pts-cell dim';
        }
      }
    }

    save();
    updateResults();
  });

  // Delete row
  document.getElementById('coursesBody').addEventListener('click', e => {
    const btn = e.target.closest('.btn-del');
    if (!btn) return;
    termData[currentTerm].splice(parseInt(btn.dataset.i, 10), 1);
    save();
    renderRows();
  });

  // Auto-fill from PowerSchool
  document.getElementById('autofillBtn').addEventListener('click', autofill);

  // GPA / % mode toggle
  document.getElementById('modeToggle').addEventListener('click', e => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    gpaMode = btn.dataset.mode;
    setActiveMode(gpaMode);
    save();
    updateResults();
  });

  // Grade scale collapse/expand
  document.getElementById('scaleToggle').addEventListener('click', () => {
    const table  = document.getElementById('scaleTable');
    const arrow  = document.getElementById('scaleArrow');
    const isOpen = table.style.display !== 'none';
    table.style.display = isOpen ? 'none' : 'block';
    arrow.classList.toggle('open', !isOpen);
  });
});
