/* ==========================================================================
   SSC CGL 2026 Tier-1 GK Test Series · Inspector Baba
   Complete CBT Exam Engine, 4-Step Practice Mode, Analytics & Question Bank
   ========================================================================== */

(function () {
  'use strict';

  const DATA = window.SSC_DATA;
  if (!DATA) {
    console.error('SSC_DATA failed to load.');
    return;
  }

  // Lookup Maps
  const chapterById = new Map(DATA.chapters.map(c => [c.id, c]));
  const topicById = new Map(DATA.topics.map(t => [t.id, t]));
  const questionById = new Map(DATA.questions.map(q => [q.id, q]));

  // Persistent User State
  const STORAGE_KEY = 'ssc_cgl_2026_ib_state_v1';
  let userState = loadState();

  function loadState() {
    const defaults = {
      theme: 'light',
      fontSizeRem: 1.125,
      qStatus: {},      // { [qId]: { status: 'correct'|'incorrect', lastChoice: 'a'|'b'|'c'|'d' } }
      bookmarks: [],    // [qId, ...]
      shiftBest: {},    // { [shiftId]: { score, totalMarks, accuracy, correct, incorrect, unattempted, timeSec, attemptId } }
      history: []       // [{ id, title, mode, timestamp, score, totalMarks, accuracy, correct, incorrect, unattempted, timeSec, qIds, responses, qTimes }]
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return Object.assign({}, defaults, parsed);
    } catch (e) {
      return defaults;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
    } catch (e) {
      console.warn('Could not save state to localStorage:', e);
    }
  }

  function isBookmarked(qId) {
    return userState.bookmarks.includes(qId);
  }

  function toggleBookmark(qId) {
    const idx = userState.bookmarks.indexOf(qId);
    if (idx === -1) {
      userState.bookmarks.push(qId);
    } else {
      userState.bookmarks.splice(idx, 1);
    }
    saveState();
    updateHeroStats();
  }

  // Active Exam Session State
  let activeSession = null;
  let timerInterval = null;
  let lastResultReport = null;

  // Question Bank Explorer State
  let qbankPage = 1;
  const QBANK_PAGE_SIZE = 20;
  let qbankShowAllAnswers = false;
  let qbankLocalRevealed = new Set();
  let qbankLocalChoices = new Map();

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  function init() {
    applyTheme(userState.theme);
    applyFontSize(userState.fontSizeRem);

    bindTopNavigation();
    bindHeroActions();
    bindSubjectsTab();
    bindShiftsTab();
    bindCustomBuilderTab();
    bindQBankTab();
    bindAnalyticsTab();
    bindExamOverlayActions();
    bindResultOverlayActions();

    renderAllDashboardViews();
  }

  function renderAllDashboardViews() {
    updateHeroStats();
    renderSubjectsList();
    renderShiftsGrid();
    updateCustomPoolCount();
    renderQBank();
    renderAnalytics();
  }

  // ==========================================================================
  // THEME & FONT SIZE
  // ==========================================================================
  function applyTheme(theme) {
    userState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function applyFontSize(rem) {
    const clamped = Math.max(0.95, Math.min(1.45, rem));
    userState.fontSizeRem = clamped;
    document.documentElement.style.setProperty('--q-font-size', clamped + 'rem');
  }

  // ==========================================================================
  // TOP NAVBAR & HERO
  // ==========================================================================
  function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-' + tabName);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindTopNavigation() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('brandHomeBtn').addEventListener('click', () => switchTab('subjects'));

    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      applyTheme(userState.theme === 'dark' ? 'light' : 'dark');
      saveState();
    });

    document.getElementById('quickSearchBtn').addEventListener('click', () => {
      switchTab('qbank');
      setTimeout(() => document.getElementById('qbankSearchInput').focus(), 100);
    });

    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (activeSession) return;
        switchTab('qbank');
        setTimeout(() => document.getElementById('qbankSearchInput').focus(), 100);
      }
    });
  }

  function updateHeroStats() {
    const entries = Object.values(userState.qStatus);
    const solvedCount = entries.length;
    const correctCount = entries.filter(x => x.status === 'correct').length;
    const wrongCount = solvedCount - correctCount;
    const accuracy = solvedCount > 0 ? Math.round((correctCount / solvedCount) * 100) : 0;

    document.getElementById('statSolved').innerHTML = `${solvedCount.toLocaleString()} <small>/ ${DATA.questions.length}</small>`;
    document.getElementById('statSolvedBar').style.width = `${Math.min(100, (solvedCount / DATA.questions.length) * 100).toFixed(1)}%`;
    document.getElementById('statAccuracy').textContent = `${accuracy}%`;
    document.getElementById('statCorrectWrong').textContent = `${correctCount} सही · ${wrongCount} गलत`;
    document.getElementById('statTestsTaken').textContent = userState.history.length;

    if (userState.history.length > 0) {
      const avgPct = Math.round(
        userState.history.reduce((acc, h) => acc + (h.totalMarks > 0 ? (Math.max(0, h.score) / h.totalMarks) * 100 : 0), 0) /
        userState.history.length
      );
      document.getElementById('statAvgScore').textContent = `औसत स्कोर: ${avgPct}%`;
    } else {
      document.getElementById('statAvgScore').textContent = 'औसत स्कोर: --';
    }

    document.getElementById('statBookmarks').textContent = `${userState.bookmarks.length} ⭐`;
  }

  function bindHeroActions() {
    // Weighted 25-Question Full SSC CGL Tier-1 Mock Test
    document.getElementById('heroQuickMockBtn').addEventListener('click', () => {
      const pool = buildWeightedSSCMock(25);
      startExamSession({
        title: 'SSC CGL 2026 Tier-1 फुल GK मॉक टेस्ट (25 प्रश्न)',
        questions: pool,
        mode: 'cbt',
        timeLimitSec: 15 * 60
      });
    });

    // 4-Step Smart Practice (25 Unattempted Questions)
    document.getElementById('heroSmartPracticeBtn').addEventListener('click', () => {
      let unattempted = DATA.questions.filter(q => !userState.qStatus[q.id]);
      if (unattempted.length === 0) unattempted = DATA.questions.slice();
      const pool = shuffleArray(unattempted).slice(0, 25);
      startExamSession({
        title: '4-Step स्मार्ट प्रैक्टिस सेशन (25 प्रश्न)',
        questions: pool,
        mode: 'practice',
        timeLimitSec: 0
      });
    });

    // Weak / Unattempted Questions Test
    document.getElementById('heroWeakTestBtn').addEventListener('click', () => {
      let weak = DATA.questions.filter(q => userState.qStatus[q.id] && userState.qStatus[q.id].status === 'incorrect');
      let title = 'गलत हुए प्रश्नों का रिवीजन टेस्ट (Weak Areas)';
      if (weak.length < 5) {
        weak = DATA.questions.filter(q => !userState.qStatus[q.id] || userState.qStatus[q.id].status === 'incorrect');
        title = 'अनअटेम्प्टेड एवं कमजोर प्रश्नों का टेस्ट';
      }
      const pool = shuffleArray(weak).slice(0, 25);
      startExamSession({
        title,
        questions: pool,
        mode: 'cbt',
        timeLimitSec: Math.ceil((pool.length * 36) / 60) * 60
      });
    });

    document.getElementById('statBookmarksBox').addEventListener('click', () => {
      switchTab('qbank');
      document.getElementById('qbankStatusFilter').value = 'bookmarked';
      qbankPage = 1;
      renderQBank();
    });
  }

  function buildWeightedSSCMock(count) {
    // Pick proportionally across the 10 chapters
    const total = DATA.questions.length;
    let selected = [];
    const usedIds = new Set();

    for (const ch of DATA.chapters) {
      const chQs = DATA.questions.filter(q => q.chapterId === ch.id);
      const target = Math.max(1, Math.round((chQs.length / total) * count));
      const picked = shuffleArray(chQs).slice(0, target);
      for (const q of picked) {
        if (selected.length < count && !usedIds.has(q.id)) {
          selected.push(q);
          usedIds.add(q.id);
        }
      }
    }
    if (selected.length < count) {
      const remaining = shuffleArray(DATA.questions.filter(q => !usedIds.has(q.id)));
      selected.push(...remaining.slice(0, count - selected.length));
    }
    return shuffleArray(selected.slice(0, count));
  }

  // ==========================================================================
  // TAB 1: SUBJECT & TOPIC-WISE TEST SERIES
  // ==========================================================================
  const expandedChapters = new Set([1]); // Default expand Static GK

  function bindSubjectsTab() {
    const searchInput = document.getElementById('topicSearchInput');
    searchInput.addEventListener('input', () => renderSubjectsList());

    const expandAllBtn = document.getElementById('expandAllSubjectsBtn');
    expandAllBtn.addEventListener('click', () => {
      if (expandedChapters.size === DATA.chapters.length) {
        expandedChapters.clear();
        expandAllBtn.textContent = 'सभी टॉपिक खोलें';
      } else {
        DATA.chapters.forEach(c => expandedChapters.add(c.id));
        expandAllBtn.textContent = 'सभी टॉपिक बंद करें';
      }
      renderSubjectsList();
    });
  }

  function renderSubjectsList() {
    const container = document.getElementById('subjectsListContainer');
    const query = (document.getElementById('topicSearchInput').value || '').trim().toLowerCase();
    container.innerHTML = '';

    for (const ch of DATA.chapters) {
      const chTopics = DATA.topics.filter(t => t.chapterId === ch.id);
      const matchingTopics = query
        ? chTopics.filter(t =>
            t.name.toLowerCase().includes(query) ||
            ch.name.toLowerCase().includes(query) ||
            ch.en.toLowerCase().includes(query) ||
            (t.subSection && t.subSection.toLowerCase().includes(query))
          )
        : chTopics;

      if (query && matchingTopics.length === 0) continue;

      const chQuestions = DATA.questions.filter(q => q.chapterId === ch.id);
      const solvedInCh = chQuestions.filter(q => userState.qStatus[q.id]).length;
      const correctInCh = chQuestions.filter(q => userState.qStatus[q.id]?.status === 'correct').length;
      const pct = chQuestions.length > 0 ? Math.round((solvedInCh / chQuestions.length) * 100) : 0;
      const acc = solvedInCh > 0 ? Math.round((correctInCh / solvedInCh) * 100) : 0;

      const isExpanded = query.length > 0 || expandedChapters.has(ch.id);

      const card = document.createElement('div');
      card.className = `subject-card ${isExpanded ? 'expanded' : ''}`;

      // Group topics by subSection if present (e.g., History)
      let topicsHTML = '';
      const hasSubSections = matchingTopics.some(t => t.subSection);
      if (hasSubSections) {
        const groups = new Map();
        for (const t of matchingTopics) {
          const key = t.subSection || 'अन्य';
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(t);
        }
        for (const [secTitle, secTopics] of groups) {
          topicsHTML += `<div class="subsection-heading">📌 ${escapeHtml(secTitle)} (${secTopics.length} Topics)</div>`;
          topicsHTML += `<div class="topics-grid">${secTopics.map(t => renderTopicCardHTML(t)).join('')}</div>`;
        }
      } else {
        topicsHTML = `<div class="topics-grid">${matchingTopics.map(t => renderTopicCardHTML(t)).join('')}</div>`;
      }

      card.innerHTML = `
        <div class="subject-card-header" data-ch-toggle="${ch.id}">
          <div class="subject-info">
            <div class="subject-icon-box" style="background:${ch.color}18; color:${ch.color}; border:1px solid ${ch.color}40;">
              ${ch.icon}
            </div>
            <div>
              <div class="subject-title-row">
                <span class="subject-name-hi">अध्याय ${String(ch.id).padStart(2, '0')}: ${escapeHtml(ch.name)}</span>
                <span class="subject-name-en">(${escapeHtml(ch.en)})</span>
              </div>
              <div class="subject-meta-pills">
                <span>📂 ${ch.topicCount} टॉपिक्स</span>
                <span>•</span>
                <span>📝 ${ch.questionCount} प्रश्न</span>
                ${solvedInCh > 0 ? `<span>•</span><span>🎯 सटीकता: ${acc}%</span>` : ''}
              </div>
            </div>
          </div>

          <div class="subject-progress-wrap">
            <div class="subject-progress-label">
              <span>प्रोग्रेस (${solvedInCh}/${ch.questionCount})</span>
              <span>${pct}%</span>
            </div>
            <div class="mini-progress">
              <div class="mini-progress-bar" style="width:${pct}%"></div>
            </div>
          </div>

          <div class="subject-actions">
            <button class="btn btn-sm btn-primary" data-ch-cbt="${ch.id}" title="इस अध्याय से 25 प्रश्नों का CBT मॉक टेस्ट दें">
              🖥️ 25-Q CBT टेस्ट
            </button>
            <button class="btn btn-sm btn-secondary" data-ch-practice="${ch.id}" title="इस अध्याय के सभी ${ch.questionCount} प्रश्नों की 4-Step प्रैक्टिस करें">
              📖 फुल प्रैक्टिस (${ch.questionCount})
            </button>
            <button class="btn btn-sm btn-outline" data-ch-toggle-btn="${ch.id}">
              ${isExpanded ? '🔼 टॉपिक छिपाएँ' : `🔽 सभी ${ch.topicCount} टॉपिक देखें`}
            </button>
          </div>
        </div>
        <div class="topics-drawer">
          ${topicsHTML}
        </div>
      `;

      // Header click toggles expansion (unless clicking an action button)
      card.querySelector('.subject-card-header').addEventListener('click', e => {
        if (e.target.closest('[data-ch-cbt]') || e.target.closest('[data-ch-practice]')) return;
        if (expandedChapters.has(ch.id)) expandedChapters.delete(ch.id);
        else expandedChapters.add(ch.id);
        renderSubjectsList();
      });

      // Chapter 25-Q CBT button
      card.querySelector('[data-ch-cbt]').addEventListener('click', e => {
        e.stopPropagation();
        const pool = shuffleArray(chQuestions).slice(0, 25);
        startExamSession({
          title: `${ch.name} (${ch.en}) · CBT Test (${pool.length} प्रश्न)`,
          questions: pool,
          mode: 'cbt',
          timeLimitSec: Math.ceil((pool.length * 36) / 60) * 60
        });
      });

      // Chapter Full Practice button
      card.querySelector('[data-ch-practice]').addEventListener('click', e => {
        e.stopPropagation();
        startExamSession({
          title: `${ch.name} (${ch.en}) · संपूर्ण अध्याय प्रैक्टिस`,
          questions: chQuestions,
          mode: 'practice',
          timeLimitSec: 0
        });
      });

      // Bind topic buttons inside drawer
      card.querySelectorAll('[data-topic-cbt]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tId = btn.dataset.topicCbt;
          const topic = topicById.get(tId);
          const tQs = DATA.questions.filter(q => q.topicId === tId);
          startExamSession({
            title: `${ch.name} · टॉपिक ${topic.num}: ${topic.name} (CBT Test)`,
            questions: tQs,
            mode: 'cbt',
            timeLimitSec: Math.max(180, Math.ceil((tQs.length * 36) / 60) * 60)
          });
        });
      });

      card.querySelectorAll('[data-topic-practice]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tId = btn.dataset.topicPractice;
          const topic = topicById.get(tId);
          const tQs = DATA.questions.filter(q => q.topicId === tId);
          startExamSession({
            title: `${ch.name} · टॉपिक ${topic.num}: ${topic.name} (4-Step Practice)`,
            questions: tQs,
            mode: 'practice',
            timeLimitSec: 0
          });
        });
      });

      container.appendChild(card);
    }
  }

  function renderTopicCardHTML(t) {
    const tQs = DATA.questions.filter(q => q.topicId === t.id);
    const solved = tQs.filter(q => userState.qStatus[q.id]).length;
    const correct = tQs.filter(q => userState.qStatus[q.id]?.status === 'correct').length;
    const statusText = solved === 0
      ? 'अभी शुरू नहीं किया'
      : `${solved}/${t.questionCount} हल · ${Math.round((correct / solved) * 100)}% सही`;

    return `
      <div class="topic-card">
        <div class="topic-top">
          <span class="topic-num-badge">#${escapeHtml(t.num)}</span>
          <div class="topic-title">${escapeHtml(t.name)}</div>
          <span class="topic-q-count">${t.questionCount} प्रश्न</span>
        </div>
        <div class="topic-bottom">
          <span class="topic-stat-text">${statusText}</span>
          <div class="topic-btn-group">
            <button class="btn btn-xs btn-primary" data-topic-cbt="${t.id}">🖥️ CBT टेस्ट</button>
            <button class="btn btn-xs btn-outline" data-topic-practice="${t.id}">📖 प्रैक्टिस</button>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // TAB 2: SHIFT-WISE PYQ PAPERS (53 SHIFTS)
  // ==========================================================================
  function bindShiftsTab() {
    document.getElementById('shiftSearchInput').addEventListener('input', renderShiftsGrid);
    document.getElementById('shiftNumberFilter').addEventListener('change', renderShiftsGrid);
    document.getElementById('shiftStatusFilter').addEventListener('change', renderShiftsGrid);
  }

  function renderShiftsGrid() {
    const container = document.getElementById('shiftsGridContainer');
    const q = (document.getElementById('shiftSearchInput').value || '').trim().toLowerCase();
    const shiftNum = document.getElementById('shiftNumberFilter').value;
    const statusFilter = document.getElementById('shiftStatusFilter').value;

    container.innerHTML = '';

    DATA.shifts.forEach((sh, index) => {
      if (q && !sh.id.toLowerCase().includes(q)) return;
      if (shiftNum !== 'all' && sh.shift !== shiftNum) return;

      const best = userState.shiftBest[sh.id];
      if (statusFilter === 'attempted' && !best) return;
      if (statusFilter === 'unattempted' && best) return;

      const shiftQuestions = DATA.questions.filter(item => item.examTag === sh.id);
      const solvedCount = shiftQuestions.filter(item => userState.qStatus[item.id]).length;

      const card = document.createElement('div');
      card.className = 'shift-card';
      card.innerHTML = `
        <div>
          <div class="shift-card-top">
            <span class="shift-number-tag">Paper #${String(index + 1).padStart(2, '0')} · ${escapeHtml(sh.shift)}</span>
            ${
              best
                ? `<span class="shift-status-pill done">✅ स्कोर: ${best.score.toFixed(1)}/${best.totalMarks}</span>`
                : `<span class="shift-status-pill pending">${solvedCount > 0 ? `${solvedCount}/${sh.questionCount} हल` : 'Unattempted'}</span>`
            }
          </div>
          <div class="shift-date-title">📅 ${escapeHtml(sh.date)} (${escapeHtml(sh.shift)})</div>
          <div class="shift-meta-row" style="margin-top:8px;">
            <span>📝 ${sh.questionCount} प्रश्न</span>
            <span>•</span>
            <span>🏆 ${sh.questionCount * 2} अंक</span>
            <span>•</span>
            <span>⏱️ 15 मिनट</span>
          </div>
        </div>
        <div class="shift-actions">
          <button class="btn btn-sm btn-primary" data-shift-cbt="${escapeHtml(sh.id)}">
            🖥️ CBT टेस्ट दें
          </button>
          <button class="btn btn-sm btn-outline" data-shift-practice="${escapeHtml(sh.id)}">
            📖 प्रैक्टिस मोड
          </button>
        </div>
      `;

      card.querySelector('[data-shift-cbt]').addEventListener('click', () => {
        startExamSession({
          title: `SSC CGL 2026 Tier-1 Official Paper · ${sh.id}`,
          questions: shiftQuestions,
          mode: 'cbt',
          timeLimitSec: 15 * 60,
          shiftId: sh.id
        });
      });

      card.querySelector('[data-shift-practice]').addEventListener('click', () => {
        startExamSession({
          title: `SSC CGL 2026 Tier-1 · ${sh.id} (Practice)`,
          questions: shiftQuestions,
          mode: 'practice',
          timeLimitSec: 0,
          shiftId: sh.id
        });
      });

      container.appendChild(card);
    });
  }

  // ==========================================================================
  // TAB 3: CUSTOM MOCK GENERATOR
  // ==========================================================================
  function bindCustomBuilderTab() {
    const grid = document.getElementById('customSubjectCheckboxes');
    grid.innerHTML = DATA.chapters.map(ch => `
      <label class="subj-check-item">
        <input type="checkbox" class="custom-subj-cb" value="${ch.id}" checked />
        <span>${ch.icon} ${escapeHtml(ch.name)} <small>(${ch.questionCount})</small></span>
      </label>
    `).join('');

    grid.querySelectorAll('.custom-subj-cb').forEach(cb => {
      cb.addEventListener('change', updateCustomPoolCount);
    });

    document.getElementById('selectAllSubjBtn').addEventListener('click', () => {
      grid.querySelectorAll('.custom-subj-cb').forEach(cb => { cb.checked = true; });
      updateCustomPoolCount();
    });

    document.getElementById('deselectAllSubjBtn').addEventListener('click', () => {
      grid.querySelectorAll('.custom-subj-cb').forEach(cb => { cb.checked = false; });
      updateCustomPoolCount();
    });

    document.getElementById('customPoolFilter').addEventListener('change', updateCustomPoolCount);

    document.getElementById('startCustomCbtBtn').addEventListener('click', () => launchCustomTest('cbt'));
    document.getElementById('startCustomPracticeBtn').addEventListener('click', () => launchCustomTest('practice'));
  }

  function getCustomFilteredPool() {
    const selectedSubjIds = new Set(
      [...document.querySelectorAll('.custom-subj-cb:checked')].map(cb => parseInt(cb.value))
    );
    const poolFilter = document.getElementById('customPoolFilter').value;

    return DATA.questions.filter(q => {
      if (!selectedSubjIds.has(q.chapterId)) return false;
      if (poolFilter === 'unattempted') return !userState.qStatus[q.id];
      if (poolFilter === 'incorrect') return userState.qStatus[q.id]?.status === 'incorrect';
      if (poolFilter === 'bookmarked') return isBookmarked(q.id);
      return true;
    });
  }

  function updateCustomPoolCount() {
    const pool = getCustomFilteredPool();
    const summaryEl = document.getElementById('customPoolSummary');
    summaryEl.innerHTML = `चयनित फ़िल्टर में उपलब्ध प्रश्न: <strong>${pool.length.toLocaleString()}</strong>`;
  }

  function launchCustomTest(mode) {
    let pool = getCustomFilteredPool();
    if (pool.length === 0) {
      alert('चयनित फ़िल्टर में कोई प्रश्न उपलब्ध नहीं है। कृपया विषय या फ़िल्टर बदलें।');
      return;
    }

    const shuffleMode = document.getElementById('customShuffleMode').value;
    if (shuffleMode === 'shuffle') {
      pool = shuffleArray(pool);
    }

    const countVal = document.getElementById('customQuestionCount').value;
    if (countVal !== 'all') {
      pool = pool.slice(0, parseInt(countVal));
    }

    const timeVal = document.getElementById('customTimeLimit').value;
    let timeLimitSec = 0;
    if (timeVal === 'auto') {
      timeLimitSec = Math.max(60, Math.ceil((pool.length * 36) / 60) * 60);
    } else {
      timeLimitSec = parseInt(timeVal) * 60;
    }

    startExamSession({
      title: `कस्टम मॉक टेस्ट (${pool.length} प्रश्न)`,
      questions: pool,
      mode,
      timeLimitSec: mode === 'practice' ? 0 : timeLimitSec
    });
  }

  // ==========================================================================
  // TAB 4: QUESTION BANK & BOOKMARKS EXPLORER
  // ==========================================================================
  function bindQBankTab() {
    const subjSelect = document.getElementById('qbankSubjectFilter');
    subjSelect.innerHTML = `<option value="all">सभी 10 विषय (All Subjects)</option>` +
      DATA.chapters.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)} (${c.questionCount})</option>`).join('');

    const shiftSelect = document.getElementById('qbankShiftFilter');
    shiftSelect.innerHTML = `<option value="all">सभी 53 शिफ्ट (All Shifts)</option>` +
      DATA.shifts.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.id)} (${s.questionCount})</option>`).join('');

    populateQBankTopicDropdown('all');

    subjSelect.addEventListener('change', () => {
      populateQBankTopicDropdown(subjSelect.value);
      qbankPage = 1;
      renderQBank();
    });

    ['qbankTopicFilter', 'qbankShiftFilter', 'qbankStatusFilter'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        qbankPage = 1;
        renderQBank();
      });
    });

    document.getElementById('qbankSearchInput').addEventListener('input', () => {
      qbankPage = 1;
      renderQBank();
    });

    document.getElementById('toggleAllQBankAnswersBtn').addEventListener('click', () => {
      qbankShowAllAnswers = !qbankShowAllAnswers;
      renderQBank();
    });

    document.getElementById('testFilteredQBankBtn').addEventListener('click', () => {
      const matched = getFilteredQBankQuestions();
      if (matched.length === 0) {
        alert('कोई प्रश्न नहीं मिला!');
        return;
      }
      const subset = matched.slice(0, 50);
      startExamSession({
        title: `प्रश्न बैंक फ़िल्टर टेस्ट (${subset.length} प्रश्न)`,
        questions: subset,
        mode: 'cbt',
        timeLimitSec: Math.ceil((subset.length * 36) / 60) * 60
      });
    });
  }

  function populateQBankTopicDropdown(chapterVal) {
    const topicSelect = document.getElementById('qbankTopicFilter');
    const list = chapterVal === 'all'
      ? DATA.topics
      : DATA.topics.filter(t => t.chapterId === parseInt(chapterVal));

    topicSelect.innerHTML = `<option value="all">सभी टॉपिक (${list.length})</option>` +
      list.map(t => `<option value="${t.id}">#${t.num} ${escapeHtml(t.name)} (${t.questionCount})</option>`).join('');
  }

  function getFilteredQBankQuestions() {
    const query = (document.getElementById('qbankSearchInput').value || '').trim().toLowerCase();
    const subjVal = document.getElementById('qbankSubjectFilter').value;
    const topicVal = document.getElementById('qbankTopicFilter').value;
    const shiftVal = document.getElementById('qbankShiftFilter').value;
    const statusVal = document.getElementById('qbankStatusFilter').value;

    return DATA.questions.filter(q => {
      if (subjVal !== 'all' && q.chapterId !== parseInt(subjVal)) return false;
      if (topicVal !== 'all' && q.topicId !== topicVal) return false;
      if (shiftVal !== 'all' && q.examTag !== shiftVal) return false;

      if (statusVal === 'bookmarked' && !isBookmarked(q.id)) return false;
      if (statusVal === 'correct' && userState.qStatus[q.id]?.status !== 'correct') return false;
      if (statusVal === 'incorrect' && userState.qStatus[q.id]?.status !== 'incorrect') return false;
      if (statusVal === 'unattempted' && userState.qStatus[q.id]) return false;

      if (query) {
        const hay = `${q.question} ${q.options.a} ${q.options.b} ${q.options.c} ${q.options.d} ${q.explanation} ${q.extra.join(' ')}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }

  function renderQBank() {
    const matched = getFilteredQBankQuestions();
    const totalPages = Math.max(1, Math.ceil(matched.length / QBANK_PAGE_SIZE));
    if (qbankPage > totalPages) qbankPage = totalPages;

    document.getElementById('qbankResultCount').textContent = `${matched.length.toLocaleString()} प्रश्न मिले (पेज ${qbankPage} / ${totalPages})`;

    const paginationHTML = `
      <button class="btn btn-xs btn-outline" data-qpage="prev" ${qbankPage <= 1 ? 'disabled' : ''}>⬅️ पिछला</button>
      <span>पेज ${qbankPage} / ${totalPages}</span>
      <button class="btn btn-xs btn-outline" data-qpage="next" ${qbankPage >= totalPages ? 'disabled' : ''}>अगला ➡️</button>
    `;
    ['qbankPaginationTop', 'qbankPaginationBottom'].forEach(id => {
      const el = document.getElementById(id);
      el.innerHTML = paginationHTML;
      el.querySelectorAll('[data-qpage]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.qpage === 'prev' && qbankPage > 1) qbankPage--;
          if (btn.dataset.qpage === 'next' && qbankPage < totalPages) qbankPage++;
          renderQBank();
        });
      });
    });

    const slice = matched.slice((qbankPage - 1) * QBANK_PAGE_SIZE, qbankPage * QBANK_PAGE_SIZE);
    const container = document.getElementById('qbankListContainer');

    if (slice.length === 0) {
      container.innerHTML = `<div class="qbank-card" style="text-align:center; padding:40px;">कोई प्रश्न नहीं मिला। कृपया खोज शब्द या फ़िल्टर बदलें।</div>`;
      return;
    }

    container.innerHTML = slice.map(q => {
      const ch = chapterById.get(q.chapterId);
      const top = topicById.get(q.topicId);
      const bm = isBookmarked(q.id);
      const revealed = qbankShowAllAnswers || qbankLocalRevealed.has(q.id);
      const userChoice = qbankLocalChoices.get(q.id);

      return `
        <div class="qbank-card" data-qid="${q.id}">
          <div class="qbank-card-header">
            <div class="qbank-badges">
              <span class="q-number-pill">#${q.id} (अध्याय प्रश्न ${q.qNum})</span>
              <span class="q-subject-tag">${ch.icon} ${escapeHtml(ch.name)}</span>
              <span class="q-topic-tag">टॉपिक ${escapeHtml(top.num)}: ${escapeHtml(top.name)}</span>
              <span class="q-shift-tag">📅 ${escapeHtml(q.examTag)}</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="bookmark-btn ${bm ? 'active' : ''}" data-qbm="${q.id}">
                ${bm ? '★ बुकमार्क' : '☆ बुकमार्क'}
              </button>
              <button class="btn btn-xs btn-outline" data-qreveal="${q.id}">
                ${revealed ? '🙈 उत्तर छिपाएँ' : '👁️ उत्तर एवं हल देखें'}
              </button>
            </div>
          </div>

          <div class="qbank-q-stem">${escapeHtml(q.question)}</div>

          <div class="qbank-options-grid">
            ${['a', 'b', 'c', 'd'].map(key => {
              let cls = 'qbank-opt';
              if (revealed) {
                if (key === q.answer) cls += ' correct-opt';
                else if (userChoice === key && key !== q.answer) cls += ' wrong-opt';
              }
              return `
                <div class="${cls}" data-qopt="${key}" data-qid="${q.id}">
                  <span class="opt-letter-circle">${key}</span>
                  <span>${escapeHtml(q.options[key])}</span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="instant-solution-box ${revealed ? '' : 'hidden'}">
            <div class="solution-header ${userChoice ? (userChoice === q.answer ? 'correct' : 'wrong') : 'info'}">
              सही उत्तर: विकल्प (${q.answer.toUpperCase()}) — ${escapeHtml(q.options[q.answer])}
            </div>
            <div class="solution-explanation">
              <div class="sol-title">💡 विस्तृत व्याख्या:</div>
              <div class="sol-text">${escapeHtml(q.explanation)}</div>
            </div>
            ${
              q.extra && q.extra.length > 0
                ? `<div class="solution-extra">
                    <div class="extra-title">📌 अतिरिक्त महत्वपूर्ण तथ्य:</div>
                    <ul class="extra-list">${q.extra.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                  </div>`
                : ''
            }
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-qbm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = parseInt(btn.dataset.qbm);
        toggleBookmark(qId);
        renderQBank();
      });
    });

    container.querySelectorAll('[data-qreveal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = parseInt(btn.dataset.qreveal);
        if (qbankLocalRevealed.has(qId)) qbankLocalRevealed.delete(qId);
        else qbankLocalRevealed.add(qId);
        renderQBank();
      });
    });

    container.querySelectorAll('[data-qopt]').forEach(optEl => {
      optEl.addEventListener('click', () => {
        const qId = parseInt(optEl.dataset.qid);
        const choice = optEl.dataset.qopt;
        const q = questionById.get(qId);
        qbankLocalChoices.set(qId, choice);
        qbankLocalRevealed.add(qId);
        userState.qStatus[qId] = {
          status: choice === q.answer ? 'correct' : 'incorrect',
          lastChoice: choice
        };
        saveState();
        updateHeroStats();
        renderQBank();
      });
    });
  }

  // ==========================================================================
  // TAB 5: ANALYTICS & TEST HISTORY
  // ==========================================================================
  function bindAnalyticsTab() {
    document.getElementById('resetAllDataBtn').addEventListener('click', () => {
      if (confirm('क्या आप वाकई अपनी संपूर्ण टेस्ट हिस्ट्री, बुकमार्क और प्रोग्रेस रीसेट करना चाहते हैं?')) {
        localStorage.removeItem(STORAGE_KEY);
        userState = loadState();
        renderAllDashboardViews();
      }
    });
  }

  function renderAnalytics() {
    const masteryContainer = document.getElementById('subjectMasteryList');
    masteryContainer.innerHTML = DATA.chapters.map(ch => {
      const chQs = DATA.questions.filter(q => q.chapterId === ch.id);
      const solved = chQs.filter(q => userState.qStatus[q.id]).length;
      const correct = chQs.filter(q => userState.qStatus[q.id]?.status === 'correct').length;
      const pct = chQs.length > 0 ? Math.round((solved / chQs.length) * 100) : 0;
      const acc = solved > 0 ? Math.round((correct / solved) * 100) : 0;

      return `
        <div class="mastery-row">
          <div class="mastery-row-top">
            <span>${ch.icon} ${escapeHtml(ch.name)} (${escapeHtml(ch.en)})</span>
            <span>${solved}/${chQs.length} हल (${pct}%) · सटीकता: ${acc}%</span>
          </div>
          <div class="mini-progress">
            <div class="mini-progress-bar" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');

    const historyContainer = document.getElementById('testHistoryList');
    if (userState.history.length === 0) {
      historyContainer.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted);">आपने अभी तक कोई टेस्ट सबमिट नहीं किया है।</div>`;
      return;
    }

    historyContainer.innerHTML = userState.history.map((h, idx) => `
      <div class="history-item">
        <div>
          <div style="font-weight:800; font-size:0.96rem;">${escapeHtml(h.title)}</div>
          <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:3px;">
            📅 ${new Date(h.timestamp).toLocaleString('hi-IN')} ·
            🏆 स्कोर: <strong>${h.score.toFixed(2)} / ${h.totalMarks}</strong> ·
            🎯 सटीकता: ${h.accuracy}% ·
            ✅ ${h.correct} सही · ❌ ${h.incorrect} गलत
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-xs btn-primary" data-hist-view="${idx}">📊 रिज़ल्ट एवं हल देखें</button>
          <button class="btn btn-xs btn-outline" data-hist-retry="${idx}">🔄 दोबारा दें</button>
        </div>
      </div>
    `).join('');

    historyContainer.querySelectorAll('[data-hist-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const h = userState.history[parseInt(btn.dataset.histView)];
        if (h) openSavedResultReport(h);
      });
    });

    historyContainer.querySelectorAll('[data-hist-retry]').forEach(btn => {
      btn.addEventListener('click', () => {
        const h = userState.history[parseInt(btn.dataset.histRetry)];
        if (!h) return;
        const qs = h.qIds.map(id => questionById.get(id)).filter(Boolean);
        startExamSession({
          title: h.title,
          questions: qs,
          mode: 'cbt',
          timeLimitSec: Math.ceil((qs.length * 36) / 60) * 60
        });
      });
    });
  }

  // ==========================================================================
  // CBT EXAM & 4-STEP PRACTICE ENGINE
  // ==========================================================================
  function startExamSession({ title, questions, mode, timeLimitSec, shiftId = null }) {
    if (!questions || questions.length === 0) return;

    clearInterval(timerInterval);

    activeSession = {
      title,
      mode, // 'cbt' | 'practice'
      shiftId,
      questions,
      currentIndex: 0,
      timeLimitSec: timeLimitSec || 0,
      remainingSec: timeLimitSec || 0,
      elapsedSec: 0,
      paused: false,
      states: questions.map((q, idx) => ({
        qId: q.id,
        visited: idx === 0,
        selected: null,        // 'a' | 'b' | 'c' | 'd' | null
        marked: false,
        practiceRevealed: false,
        timeSpentSec: 0
      }))
    };

    document.getElementById('resultOverlay').classList.add('hidden');
    document.getElementById('examOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    updateExamHeaderUI();
    renderCurrentExamQuestion();
    renderExamPalette();
    startExamTimer();
  }

  function updateExamHeaderUI() {
    if (!activeSession) return;
    const badge = document.getElementById('examModeBadge');
    const switchBtn = document.getElementById('switchModeInExamBtn');
    const showAnsBtn = document.getElementById('showPracticeAnswerBtn');

    if (activeSession.mode === 'practice') {
      badge.textContent = '4-STEP PRACTICE';
      badge.classList.add('practice');
      switchBtn.textContent = '🖥️ CBT Exam Mode में बदलें';
      showAnsBtn.classList.remove('hidden');
    } else {
      badge.textContent = 'CBT EXAM';
      badge.classList.remove('practice');
      switchBtn.textContent = '📖 Practice Mode में बदलें';
      showAnsBtn.classList.add('hidden');
    }

    document.getElementById('examTitleText').textContent = activeSession.title;
    updateTimerDisplay();
  }

  function startExamTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!activeSession || activeSession.paused) return;
      activeSession.elapsedSec++;
      const curState = activeSession.states[activeSession.currentIndex];
      if (curState) {
        curState.timeSpentSec++;
        const qTimeEl = document.getElementById('examQTimeSpent');
        if (qTimeEl) qTimeEl.textContent = `⏱️ ${curState.timeSpentSec}s`;
      }

      if (activeSession.timeLimitSec > 0 && activeSession.mode === 'cbt') {
        activeSession.remainingSec--;
        updateTimerDisplay();
        if (activeSession.remainingSec <= 0) {
          clearInterval(timerInterval);
          finalizeAndSubmitExam();
        }
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    if (!activeSession) return;
    const timerBox = document.getElementById('examTimerBox');
    const timerText = document.getElementById('examTimerText');

    if (activeSession.timeLimitSec > 0 && activeSession.mode === 'cbt') {
      timerText.textContent = formatTimeMMSS(Math.max(0, activeSession.remainingSec));
      timerBox.classList.toggle('low-time', activeSession.remainingSec <= 60);
    } else {
      timerText.textContent = formatTimeMMSS(activeSession.elapsedSec);
      timerBox.classList.remove('low-time');
    }
  }

  function renderCurrentExamQuestion() {
    if (!activeSession) return;
    const idx = activeSession.currentIndex;
    const q = activeSession.questions[idx];
    const st = activeSession.states[idx];
    st.visited = true;

    const ch = chapterById.get(q.chapterId);
    const top = topicById.get(q.topicId);

    document.getElementById('examQNumberPill').textContent = `प्रश्न ${idx + 1} / ${activeSession.questions.length}`;
    document.getElementById('examQSubjectTag').textContent = `${ch.icon} ${ch.name}`;
    document.getElementById('examQTopicTag').textContent = `टॉपिक ${top.num}: ${top.name}`;
    document.getElementById('examQShiftTag').textContent = `📅 ${q.examTag}`;
    document.getElementById('examQTimeSpent').textContent = `⏱️ ${st.timeSpentSec}s`;

    const bmBtn = document.getElementById('examBookmarkBtn');
    const bm = isBookmarked(q.id);
    bmBtn.textContent = bm ? '★ बुकमार्क किया गया' : '☆ बुकमार्क करें';
    bmBtn.classList.toggle('active', bm);

    document.getElementById('examQuestionStem').textContent = q.question;

    // Render 4 Options
    const optsContainer = document.getElementById('examOptionsContainer');
    const isPracticeShown = activeSession.mode === 'practice' && (st.selected !== null || st.practiceRevealed);

    optsContainer.innerHTML = ['a', 'b', 'c', 'd'].map(key => {
      let cls = 'option-row';
      if (isPracticeShown) {
        if (key === q.answer) cls += ' practice-correct';
        else if (st.selected === key && key !== q.answer) cls += ' practice-wrong';
      } else if (st.selected === key) {
        cls += ' selected';
      }

      return `
        <div class="${cls}" data-opt-key="${key}">
          <span class="opt-letter-circle">${key}</span>
          <span>${escapeHtml(q.options[key])}</span>
        </div>
      `;
    }).join('');

    optsContainer.querySelectorAll('.option-row').forEach(row => {
      row.addEventListener('click', () => {
        selectOptionForCurrentQuestion(row.dataset.optKey);
      });
    });

    // Instant 4-Step Solution Box in Practice Mode
    const solBox = document.getElementById('examInstantSolutionBox');
    if (isPracticeShown) {
      solBox.classList.remove('hidden');
      const banner = document.getElementById('instantSolutionBanner');
      if (st.selected === q.answer) {
        banner.className = 'solution-header correct';
        banner.textContent = `✅ बिल्कुल सही उत्तर! विकल्प (${q.answer.toUpperCase()}) सही है। (+2.0 अंक)`;
      } else if (st.selected) {
        banner.className = 'solution-header wrong';
        banner.textContent = `❌ गलत उत्तर! आपने (${st.selected.toUpperCase()}) चुना, जबकि सही उत्तर विकल्प (${q.answer.toUpperCase()}) है।`;
      } else {
        banner.className = 'solution-header info';
        banner.textContent = `💡 सही उत्तर: विकल्प (${q.answer.toUpperCase()}) — ${q.options[q.answer]}`;
      }

      document.getElementById('instantExplanationText').textContent = q.explanation;

      const extraBox = document.getElementById('instantExtraBox');
      const extraList = document.getElementById('instantExtraList');
      if (q.extra && q.extra.length > 0) {
        extraBox.classList.remove('hidden');
        extraList.innerHTML = q.extra.map(item => `<li>${escapeHtml(item)}</li>`).join('');
      } else {
        extraBox.classList.add('hidden');
      }
    } else {
      solBox.classList.add('hidden');
    }

    document.getElementById('prevQuestionBtn').disabled = idx === 0;
  }

  function selectOptionForCurrentQuestion(optKey) {
    if (!activeSession) return;
    const idx = activeSession.currentIndex;
    const q = activeSession.questions[idx];
    const st = activeSession.states[idx];

    st.selected = optKey;

    if (activeSession.mode === 'practice') {
      st.practiceRevealed = true;
      userState.qStatus[q.id] = {
        status: optKey === q.answer ? 'correct' : 'incorrect',
        lastChoice: optKey
      };
      saveState();
    }

    renderCurrentExamQuestion();
    renderExamPalette();
  }

  function getQuestionPaletteStatus(st) {
    if (!st.visited) return 'not-visited';
    if (st.selected && st.marked) return 'answered-marked';
    if (st.marked) return 'marked';
    if (st.selected) return 'answered';
    return 'not-answered';
  }

  function renderExamPalette() {
    if (!activeSession) return;

    let cAns = 0, cNotAns = 0, cNotVis = 0, cMark = 0, cAnsMark = 0;
    activeSession.states.forEach(st => {
      const s = getQuestionPaletteStatus(st);
      if (s === 'answered') cAns++;
      else if (s === 'not-answered') cNotAns++;
      else if (s === 'not-visited') cNotVis++;
      else if (s === 'marked') cMark++;
      else if (s === 'answered-marked') cAnsMark++;
    });

    document.getElementById('countAnswered').textContent = cAns;
    document.getElementById('countNotAnswered').textContent = cNotAns;
    document.getElementById('countNotVisited').textContent = cNotVis;
    document.getElementById('countMarked').textContent = cMark;
    document.getElementById('countAnsweredMarked').textContent = cAnsMark;

    const filter = document.getElementById('paletteFilterSelect').value;
    const grid = document.getElementById('examPaletteGrid');

    grid.innerHTML = activeSession.states.map((st, idx) => {
      const status = getQuestionPaletteStatus(st);
      if (filter === 'answered' && status !== 'answered' && status !== 'answered-marked') return '';
      if (filter === 'unanswered' && status !== 'not-answered' && status !== 'not-visited') return '';
      if (filter === 'marked' && status !== 'marked' && status !== 'answered-marked') return '';

      const isCurrent = idx === activeSession.currentIndex;
      const bm = isBookmarked(st.qId);
      return `
        <button class="palette-btn ${status} ${isCurrent ? 'current' : ''}" data-pidx="${idx}">
          ${idx + 1}
          ${bm ? '<span class="bm-dot">⭐</span>' : ''}
        </button>
      `;
    }).join('');

    grid.querySelectorAll('.palette-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSession.currentIndex = parseInt(btn.dataset.pidx);
        renderCurrentExamQuestion();
        renderExamPalette();
        document.getElementById('examPaletteSidebar').classList.remove('open');
      });
    });
  }

  function bindExamOverlayActions() {
    document.getElementById('prevQuestionBtn').addEventListener('click', () => {
      if (!activeSession || activeSession.currentIndex <= 0) return;
      activeSession.currentIndex--;
      renderCurrentExamQuestion();
      renderExamPalette();
    });

    document.getElementById('saveNextBtn').addEventListener('click', () => {
      if (!activeSession) return;
      if (activeSession.currentIndex < activeSession.questions.length - 1) {
        activeSession.currentIndex++;
        renderCurrentExamQuestion();
        renderExamPalette();
      } else {
        openSubmitConfirmModal();
      }
    });

    document.getElementById('markReviewNextBtn').addEventListener('click', () => {
      if (!activeSession) return;
      const st = activeSession.states[activeSession.currentIndex];
      st.marked = !st.marked;
      if (activeSession.currentIndex < activeSession.questions.length - 1) {
        activeSession.currentIndex++;
      }
      renderCurrentExamQuestion();
      renderExamPalette();
    });

    document.getElementById('clearResponseBtn').addEventListener('click', () => {
      if (!activeSession) return;
      const st = activeSession.states[activeSession.currentIndex];
      st.selected = null;
      st.practiceRevealed = false;
      renderCurrentExamQuestion();
      renderExamPalette();
    });

    document.getElementById('showPracticeAnswerBtn').addEventListener('click', () => {
      if (!activeSession) return;
      const st = activeSession.states[activeSession.currentIndex];
      st.practiceRevealed = !st.practiceRevealed;
      renderCurrentExamQuestion();
    });

    document.getElementById('examBookmarkBtn').addEventListener('click', () => {
      if (!activeSession) return;
      const q = activeSession.questions[activeSession.currentIndex];
      toggleBookmark(q.id);
      renderCurrentExamQuestion();
      renderExamPalette();
    });

    document.getElementById('switchModeInExamBtn').addEventListener('click', () => {
      if (!activeSession) return;
      activeSession.mode = activeSession.mode === 'cbt' ? 'practice' : 'cbt';
      if (activeSession.mode === 'cbt' && activeSession.timeLimitSec === 0) {
        activeSession.timeLimitSec = Math.ceil((activeSession.questions.length * 36) / 60) * 60;
        activeSession.remainingSec = activeSession.timeLimitSec;
      }
      updateExamHeaderUI();
      renderCurrentExamQuestion();
    });

    document.getElementById('pauseTimerBtn').addEventListener('click', () => {
      if (!activeSession) return;
      activeSession.paused = !activeSession.paused;
      document.getElementById('pauseTimerBtn').textContent = activeSession.paused ? '▶️' : '⏸️';
    });

    document.getElementById('fontDecBtn').addEventListener('click', () => {
      applyFontSize(userState.fontSizeRem - 0.08);
      saveState();
    });

    document.getElementById('fontIncBtn').addEventListener('click', () => {
      applyFontSize(userState.fontSizeRem + 0.08);
      saveState();
    });

    document.getElementById('togglePaletteBtn').addEventListener('click', () => {
      document.getElementById('examPaletteSidebar').classList.toggle('open');
    });

    document.getElementById('paletteFilterSelect').addEventListener('change', renderExamPalette);

    document.getElementById('submitExamTopBtn').addEventListener('click', openSubmitConfirmModal);
    document.getElementById('submitExamSidebarBtn').addEventListener('click', openSubmitConfirmModal);

    document.getElementById('cancelSubmitBtn').addEventListener('click', () => {
      document.getElementById('submitConfirmModal').classList.add('hidden');
    });

    document.getElementById('confirmSubmitBtn').addEventListener('click', () => {
      document.getElementById('submitConfirmModal').classList.add('hidden');
      finalizeAndSubmitExam();
    });

    document.getElementById('exitExamBtn').addEventListener('click', () => {
      if (confirm('क्या आप टेस्ट बीच में छोड़कर डैशबोर्ड पर वापस जाना चाहते हैं?')) {
        clearInterval(timerInterval);
        activeSession = null;
        document.getElementById('examOverlay').classList.add('hidden');
        document.body.style.overflow = '';
        renderAllDashboardViews();
      }
    });

    // Keyboard shortcuts inside active exam
    window.addEventListener('keydown', e => {
      if (!activeSession) return;
      if (!document.getElementById('submitConfirmModal').classList.contains('hidden')) return;
      const key = e.key.toLowerCase();
      if (['1', 'a'].includes(key)) selectOptionForCurrentQuestion('a');
      else if (['2', 'b'].includes(key) && !e.ctrlKey) {
        if (e.key === 'B' || e.shiftKey) {
          const q = activeSession.questions[activeSession.currentIndex];
          toggleBookmark(q.id);
          renderCurrentExamQuestion();
          renderExamPalette();
        } else {
          selectOptionForCurrentQuestion('b');
        }
      }
      else if (['3', 'c'].includes(key)) selectOptionForCurrentQuestion('c');
      else if (['4', 'd'].includes(key)) selectOptionForCurrentQuestion('d');
      else if (e.key === 'ArrowRight') {
        if (activeSession.currentIndex < activeSession.questions.length - 1) {
          activeSession.currentIndex++;
          renderCurrentExamQuestion();
          renderExamPalette();
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeSession.currentIndex > 0) {
          activeSession.currentIndex--;
          renderCurrentExamQuestion();
          renderExamPalette();
        }
      }
    });
  }

  function openSubmitConfirmModal() {
    if (!activeSession) return;
    let ans = 0, notAns = 0, mark = 0, notVis = 0;
    activeSession.states.forEach(st => {
      const s = getQuestionPaletteStatus(st);
      if (s === 'answered' || s === 'answered-marked') ans++;
      else if (s === 'not-answered') notAns++;
      else if (s === 'not-visited') notVis++;
      if (st.marked) mark++;
    });

    document.getElementById('submitModalSummary').innerHTML = `
      <div class="modal-stat-item"><span>📝 कुल प्रश्न:</span><span>${activeSession.questions.length}</span></div>
      <div class="modal-stat-item" style="color:var(--success)"><span>🟢 उत्तर दिए गए:</span><span>${ans}</span></div>
      <div class="modal-stat-item" style="color:var(--danger)"><span>🔴 बिना उत्तर:</span><span>${notAns + notVis}</span></div>
      <div class="modal-stat-item" style="color:var(--review)"><span>🟣 समीक्षा हेतु चिह्नित:</span><span>${mark}</span></div>
    `;
    document.getElementById('submitConfirmModal').classList.remove('hidden');
  }

  // ==========================================================================
  // FINALIZE EXAM & RENDER RESULT REPORT
  // ==========================================================================
  function finalizeAndSubmitExam() {
    if (!activeSession) return;
    clearInterval(timerInterval);

    let correct = 0, incorrect = 0, unattempted = 0;
    const responses = {};
    const qTimes = {};

    activeSession.questions.forEach((q, idx) => {
      const st = activeSession.states[idx];
      responses[q.id] = st.selected;
      qTimes[q.id] = st.timeSpentSec;

      if (!st.selected) {
        unattempted++;
      } else if (st.selected === q.answer) {
        correct++;
        userState.qStatus[q.id] = { status: 'correct', lastChoice: st.selected };
      } else {
        incorrect++;
        userState.qStatus[q.id] = { status: 'incorrect', lastChoice: st.selected };
      }
    });

    const score = correct * 2.0 - incorrect * 0.5;
    const totalMarks = activeSession.questions.length * 2.0;
    const attempted = correct + incorrect;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    const report = {
      id: 'att_' + Date.now(),
      title: activeSession.title,
      mode: activeSession.mode,
      shiftId: activeSession.shiftId,
      timestamp: Date.now(),
      score,
      totalMarks,
      accuracy,
      correct,
      incorrect,
      unattempted,
      timeSec: activeSession.elapsedSec,
      qIds: activeSession.questions.map(q => q.id),
      responses,
      qTimes
    };

    userState.history.unshift(report);
    if (userState.history.length > 50) userState.history.pop();

    if (activeSession.shiftId) {
      const prevBest = userState.shiftBest[activeSession.shiftId];
      if (!prevBest || score >= prevBest.score) {
        userState.shiftBest[activeSession.shiftId] = {
          score,
          totalMarks,
          accuracy,
          correct,
          incorrect,
          unattempted,
          timeSec: activeSession.elapsedSec
        };
      }
    }

    saveState();
    activeSession = null;
    document.getElementById('examOverlay').classList.add('hidden');
    openSavedResultReport(report);
  }

  function openSavedResultReport(report) {
    lastResultReport = report;
    document.getElementById('resultOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    document.getElementById('resultTestTitle').textContent = report.title;
    document.getElementById('resFinalScore').innerHTML = `${report.score.toFixed(2)} <small>/ ${report.totalMarks}</small>`;
    document.getElementById('resAccuracy').textContent = `${report.accuracy}%`;
    document.getElementById('resAttempted').textContent = `${report.correct + report.incorrect} / ${report.qIds.length}`;
    document.getElementById('resCorrect').textContent = report.correct;
    document.getElementById('resIncorrect').textContent = report.incorrect;
    document.getElementById('resTimeTaken').textContent = formatTimeMMSS(report.timeSec);

    const pct = report.totalMarks > 0 ? (report.score / report.totalMarks) * 100 : 0;
    const tagEl = document.getElementById('resPerformanceTag');
    if (pct >= 80) tagEl.textContent = '🏆 उत्कृष्ट! (Inspector Level Performance)';
    else if (pct >= 60) tagEl.textContent = '🌟 बहुत बढ़िया! (Strong Selection Zone)';
    else if (pct >= 40) tagEl.textContent = '👍 अच्छा प्रयास! (रिवीजन से स्कोर और बढ़ाएँ)';
    else tagEl.textContent = '💪 और अभ्यास करें! (व्याख्या एवं अतिरिक्त तथ्य ध्यान से पढ़ें)';

    // Topic-wise breakdown table
    const topicGroups = new Map();
    report.qIds.forEach(qId => {
      const q = questionById.get(qId);
      if (!q) return;
      const key = q.topicId;
      if (!topicGroups.has(key)) {
        topicGroups.set(key, { topic: topicById.get(key), chapter: chapterById.get(q.chapterId), total: 0, correct: 0, incorrect: 0, unattempted: 0 });
      }
      const g = topicGroups.get(key);
      g.total++;
      const choice = report.responses[qId];
      if (!choice) g.unattempted++;
      else if (choice === q.answer) g.correct++;
      else g.incorrect++;
    });

    document.getElementById('resultTopicBreakdownBody').innerHTML = [...topicGroups.values()].map(g => {
      const sc = g.correct * 2 - g.incorrect * 0.5;
      const att = g.correct + g.incorrect;
      const acc = att > 0 ? Math.round((g.correct / att) * 100) : 0;
      return `
        <tr>
          <td><strong>${g.chapter.icon} ${escapeHtml(g.chapter.name)}</strong> — टॉपिक ${escapeHtml(g.topic.num)}: ${escapeHtml(g.topic.name)}</td>
          <td>${g.total}</td>
          <td style="color:var(--success); font-weight:700;">${g.correct}</td>
          <td style="color:var(--danger); font-weight:700;">${g.incorrect}</td>
          <td>${g.unattempted}</td>
          <td><strong>${sc.toFixed(2)} / ${g.total * 2}</strong></td>
          <td>${acc}%</td>
        </tr>
      `;
    }).join('');

    document.getElementById('resCountAll').textContent = report.qIds.length;
    document.getElementById('resCountCorrect').textContent = report.correct;
    document.getElementById('resCountIncorrect').textContent = report.incorrect;
    document.getElementById('resCountUnattempted').textContent = report.unattempted;

    renderResultSolutionsList('all');
  }

  function renderResultSolutionsList(filter) {
    if (!lastResultReport) return;

    document.querySelectorAll('#resultSolutionFilters .pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const container = document.getElementById('resultSolutionsList');
    const itemsHTML = [];

    lastResultReport.qIds.forEach((qId, idx) => {
      const q = questionById.get(qId);
      if (!q) return;
      const choice = lastResultReport.responses[qId];
      const status = !choice ? 'unattempted' : (choice === q.answer ? 'correct' : 'incorrect');
      if (filter !== 'all' && status !== filter) return;

      const ch = chapterById.get(q.chapterId);
      const top = topicById.get(q.topicId);
      const bm = isBookmarked(q.id);
      const tSpent = (lastResultReport.qTimes && lastResultReport.qTimes[qId]) || 0;

      let statusBadge = '';
      if (status === 'correct') statusBadge = `<span class="shift-status-pill done">✅ सही (+2.0)</span>`;
      else if (status === 'incorrect') statusBadge = `<span class="shift-status-pill" style="background:var(--danger-soft);color:var(--danger);border:1px solid var(--danger-border);">❌ गलत (-0.5)</span>`;
      else statusBadge = `<span class="shift-status-pill pending">⚪ अनअटेम्प्टेड (0)</span>`;

      itemsHTML.push(`
        <div class="qbank-card">
          <div class="qbank-card-header">
            <div class="qbank-badges">
              <span class="q-number-pill">प्रश्न ${idx + 1}</span>
              ${statusBadge}
              <span class="q-subject-tag">${ch.icon} ${escapeHtml(ch.name)}</span>
              <span class="q-topic-tag">टॉपिक ${escapeHtml(top.num)}: ${escapeHtml(top.name)}</span>
              <span class="q-shift-tag">📅 ${escapeHtml(q.examTag)}</span>
              <span class="q-time-spent">⏱️ ${tSpent}s</span>
            </div>
            <button class="bookmark-btn ${bm ? 'active' : ''}" data-res-bm="${q.id}">
              ${bm ? '★ बुकमार्क' : '☆ बुकमार्क'}
            </button>
          </div>

          <div class="qbank-q-stem">${escapeHtml(q.question)}</div>

          <div class="qbank-options-grid">
            ${['a', 'b', 'c', 'd'].map(key => {
              let cls = 'qbank-opt';
              if (key === q.answer) cls += ' correct-opt';
              else if (choice === key && key !== q.answer) cls += ' wrong-opt';
              return `
                <div class="${cls}">
                  <span class="opt-letter-circle">${key}</span>
                  <span>
                    ${escapeHtml(q.options[key])}
                    ${key === q.answer ? ' <strong>(सही उत्तर)</strong>' : ''}
                    ${choice === key && key !== q.answer ? ' <strong>(आपका उत्तर)</strong>' : ''}
                  </span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="instant-solution-box">
            <div class="solution-explanation">
              <div class="sol-title">💡 विस्तृत व्याख्या (Ans.${q.answer}):</div>
              <div class="sol-text">${escapeHtml(q.explanation)}</div>
            </div>
            ${
              q.extra && q.extra.length > 0
                ? `<div class="solution-extra">
                    <div class="extra-title">📌 अतिरिक्त महत्वपूर्ण तथ्य (Extra Revision Facts):</div>
                    <ul class="extra-list">${q.extra.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
                  </div>`
                : ''
            }
          </div>
        </div>
      `);
    });

    container.innerHTML = itemsHTML.length > 0
      ? itemsHTML.join('')
      : `<div style="padding:30px; text-align:center; color:var(--text-muted);">इस फ़िल्टर में कोई प्रश्न नहीं है।</div>`;

    container.querySelectorAll('[data-res-bm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = parseInt(btn.dataset.resBm);
        toggleBookmark(qId);
        renderResultSolutionsList(filter);
      });
    });
  }

  function bindResultOverlayActions() {
    document.querySelectorAll('#resultSolutionFilters .pill-btn').forEach(btn => {
      btn.addEventListener('click', () => renderResultSolutionsList(btn.dataset.filter));
    });

    document.getElementById('closeResultBtn').addEventListener('click', () => {
      document.getElementById('resultOverlay').classList.add('hidden');
      document.body.style.overflow = '';
      renderAllDashboardViews();
    });

    document.getElementById('reattemptFullTestBtn').addEventListener('click', () => {
      if (!lastResultReport) return;
      const qs = lastResultReport.qIds.map(id => questionById.get(id)).filter(Boolean);
      startExamSession({
        title: lastResultReport.title,
        questions: qs,
        mode: 'cbt',
        timeLimitSec: Math.ceil((qs.length * 36) / 60) * 60,
        shiftId: lastResultReport.shiftId
      });
    });

    document.getElementById('reattemptWrongBtn').addEventListener('click', () => {
      if (!lastResultReport) return;
      const wrongOrSkipped = lastResultReport.qIds
        .filter(id => {
          const q = questionById.get(id);
          const ch = lastResultReport.responses[id];
          return !ch || ch !== q.answer;
        })
        .map(id => questionById.get(id))
        .filter(Boolean);

      if (wrongOrSkipped.length === 0) {
        alert('बधाई हो! इस टेस्ट में आपके सभी उत्तर 100% सही थे!');
        return;
      }

      startExamSession({
        title: `${lastResultReport.title} · गलत/छूटे प्रश्न (${wrongOrSkipped.length})`,
        questions: wrongOrSkipped,
        mode: 'practice',
        timeLimitSec: 0
      });
    });
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function formatTimeMMSS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
