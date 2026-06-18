/**
 * TruthShield — Main Application Controller
 * Navigation, state management, language support, UI interactions
 */
const TruthShield = (() => {
  // State
  const state = {
    currentSection: 'dashboard',
    stats: { texts: 0, images: 0, videos: 0, threats: 0 },
    activities: [],
    quizIndex: 0,
    lang: 'en'
  };

  // Analyzers
  let textAnalyzer, imageAnalyzer, videoAnalyzer;

  // ==================== INITIALIZATION ====================
  function init() {
    textAnalyzer = new TextAnalyzerEngine();
    imageAnalyzer = new ImageAnalyzerEngine();
    videoAnalyzer = new VideoAnalyzerEngine();

    setupNavigation();
    setupTextAnalysis();
    setupImageUpload();
    setupVideoUpload();
    setupLanguage();
    loadQuiz();
    animateStats();

    // Init Neural Engine (MLCore)
    if (window.MLCore) {
      window.MLCore.registerStatusCallback(updateMLStatusUI);
      window.MLCore.init();
    }

    // Load saved state
    const saved = localStorage.getItem('truthshield_stats');
    if (saved) {
      Object.assign(state.stats, JSON.parse(saved));
      updateStatCounters();
    }
    const savedActivities = localStorage.getItem('truthshield_activities');
    if (savedActivities) {
      state.activities = JSON.parse(savedActivities);
      renderActivities();
    }
  }

  // ==================== NAVIGATION ====================
  function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.dataset.section);
      });
    });

    document.getElementById('mobileToggle').addEventListener('click', () => {
      document.getElementById('navLinks').classList.toggle('open');
    });
  }

  function navigate(section) {
    state.currentSection = section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    document.getElementById(section).classList.add('active');
    const navLink = document.querySelector(`[data-section="${section}"]`);
    if (navLink) navLink.classList.add('active');

    document.getElementById('navLinks').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== TEXT ANALYSIS ====================
  function setupTextAnalysis() {
    const textInput = document.getElementById('textInput');
    const charCount = document.getElementById('charCount');

    textInput.addEventListener('input', () => {
      charCount.textContent = textInput.value.length;
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`text-tab-${tab.dataset.tab}`).classList.add('active');
      });
    });
  }

  function analyzeText() {
    const activeTab = document.querySelector('.tab.active').dataset.tab;
    let text = '';

    if (activeTab === 'text') {
      text = document.getElementById('textInput').value;
    } else {
      const url = document.getElementById('urlInput').value;
      if (!url) { toast('Please enter a URL', 'error'); return; }
      text = `[URL Analysis] ${url} — URL content extraction requires server-side processing. Analyzing URL patterns...`;
    }

    if (!text || text.trim().length < 10) {
      toast('Please enter at least 10 characters to analyze', 'error');
      return;
    }

    showLoading('Analyzing text content...');

    setTimeout(async () => {
      try {
        const result = await textAnalyzer.analyze(text);

        if (result.error) {
          hideLoading();
          toast(result.error, 'error');
          return;
        }

        // Show results
        document.getElementById('textResults').style.display = 'block';

        // Animate gauge
        const arc = document.getElementById('textGaugeArc');
        const maxDash = 251;
        const targetDash = (result.trustScore / 100) * maxDash;
        arc.style.transition = 'stroke-dasharray 1.5s ease';
        arc.setAttribute('stroke-dasharray', `${targetDash} ${maxDash}`);

        document.getElementById('textScoreValue').textContent = result.trustScore;
        const label = document.getElementById('textScoreLabel');
        label.textContent = result.verdict;
        label.style.fill = result.verdictClass === 'success' ? '#3dba5c' : result.verdictClass === 'warning' ? '#f07a3a' : '#f05454';

        // Breakdown bars
        animateBar('clickbaitBar', 'clickbaitValue', result.clickbait);
        animateBar('sentimentBar', 'sentimentValue', result.sentiment);
        animateBar('credibilityBar', 'credibilityValue', result.credibility);
        animateBar('grammarBar', 'grammarValue', result.quality);

        // Flags
        const flagsList = document.getElementById('flagsList');
        flagsList.innerHTML = result.flags.map(f => `
          <div class="flag-item ${f.type}">
            <i class="${f.icon}" style="color:${f.type === 'success' ? '#3dba5c' : f.type === 'danger' ? '#f05454' : '#f07a3a'}"></i>
            <p>${f.text}</p>
          </div>
        `).join('');

        // NLP: Stance Detection
        if (result.nlp && result.nlp.stance) {
          renderStance(result.nlp.stance);
        }

        // NLP: Semantic Similarity
        if (result.nlp && result.nlp.similarity) {
          renderSimilarity(result.nlp.similarity);
        }

        // Explanation
        document.getElementById('explanationText').textContent = result.explanation;

        // Update stats
        state.stats.texts++;
        if (result.trustScore < 40) state.stats.threats++;
        saveStats();
        addActivity('text', text.substring(0, 60) + '...', result.trustScore, result.verdict);

        hideLoading();
        toast('Text analysis complete!', 'success');

        // Scroll to results
        document.getElementById('textResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        hideLoading();
        toast('Error during text analysis: ' + err.message, 'error');
      }
    }, 1500);
  }

  function animateBar(barId, valueId, score) {
    const bar = document.getElementById(barId);
    const value = document.getElementById(valueId);
    const color = score > 60 ? '#f05454' : score > 30 ? '#f07a3a' : '#3dba5c';

    setTimeout(() => {
      bar.style.width = score + '%';
      bar.style.background = color;
      value.textContent = score + '%';
      value.style.color = color;
    }, 300);
  }

  // ==================== IMAGE ANALYSIS ====================
  function setupImageUpload() {
    const dropZone = document.getElementById('imageDropZone');
    const fileInput = document.getElementById('imageFileInput');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) processImage(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) processImage(fileInput.files[0]); });
  }

  async function processImage(file) {
    if (!file.type.startsWith('image/')) { toast('Please upload an image file', 'error'); return; }
    if (file.size > 20 * 1024 * 1024) { toast('File too large. Max 20MB.', 'error'); return; }

    showLoading('Performing image analysis...');

    try {
      const result = await imageAnalyzer.analyze(file);

      document.getElementById('imageResultsArea').style.display = 'block';
      document.getElementById('imageDropZone').style.display = 'none';

      // Draw original
      const origCanvas = document.getElementById('originalCanvas');
      const origCtx = origCanvas.getContext('2d');
      const img = await imageAnalyzer.loadImage(file);
      const maxW = 600;
      const scale = Math.min(1, maxW / img.width);
      origCanvas.width = img.width * scale;
      origCanvas.height = img.height * scale;
      origCtx.drawImage(img, 0, 0, origCanvas.width, origCanvas.height);

      // Draw ELA
      const elaCanvas = document.getElementById('elaCanvas');
      const elaCtx = elaCanvas.getContext('2d');
      elaCanvas.width = result.ela.width;
      elaCanvas.height = result.ela.height;
      elaCtx.putImageData(result.ela.elaImageData, 0, 0);
      // Scale to match
      const elaTemp = document.createElement('canvas');
      elaTemp.width = origCanvas.width;
      elaTemp.height = origCanvas.height;
      elaTemp.getContext('2d').drawImage(elaCanvas, 0, 0, elaTemp.width, elaTemp.height);
      elaCanvas.width = elaTemp.width;
      elaCanvas.height = elaTemp.height;
      elaCtx.drawImage(elaTemp, 0, 0);

      // Score gauge
      const arc = document.getElementById('imageGaugeArc');
      const maxDash = 251;
      arc.style.transition = 'stroke-dasharray 1.5s ease';
      arc.setAttribute('stroke-dasharray', `${(result.authenticityScore / 100) * maxDash} ${maxDash}`);
      document.getElementById('imageScoreValue').textContent = result.authenticityScore;
      const label = document.getElementById('imageScoreLabel');
      label.textContent = result.verdict;
      label.style.fill = result.verdictClass === 'success' ? '#3dba5c' : result.verdictClass === 'warning' ? '#f07a3a' : '#f05454';

      // Breakdown
      document.getElementById('imageBreakdown').innerHTML = result.breakdown.map(b => `
        <div class="b-item">
          <span class="b-label"><i class="${b.icon}" style="color:${b.color}"></i> ${b.label}</span>
          <span class="b-val" style="color:${b.color}">${b.value}%</span>
        </div>
      `).join('');

      // Metadata
      const meta = result.metadata;
      document.getElementById('imageMetadata').innerHTML = `<table>
        <tr><td>File Name</td><td>${meta.fileName}</td></tr>
        <tr><td>File Size</td><td>${meta.fileSize}</td></tr>
        <tr><td>Type</td><td>${meta.fileType}</td></tr>
        <tr><td>Dimensions</td><td>${result.ela.width} × ${result.ela.height}</td></tr>
        <tr><td>Last Modified</td><td>${meta.lastModified}</td></tr>
        ${meta.camera ? `<tr><td>Camera</td><td>${meta.camera} ${meta.model || ''}</td></tr>` : ''}
        ${meta.software ? `<tr><td>Software</td><td>${meta.software}</td></tr>` : ''}
        ${meta.dateTime ? `<tr><td>Date Taken</td><td>${meta.dateTime}</td></tr>` : ''}
      </table>`;

      // Render neural predictions card
      const neuralCard = document.getElementById('neuralSceneCard');
      if (result.predictions && result.predictions.length > 0) {
        neuralCard.style.display = 'block';
        document.getElementById('imagePredictions').innerHTML = result.predictions.map(p => `
          <div class="pred-item">
            <div class="pred-label-row">
              <span>${p.label.split(',')[0]}</span>
              <span>${p.confidence}%</span>
            </div>
            <div class="pred-bar-track">
              <div class="pred-bar-fill" style="width: ${p.confidence}%"></div>
            </div>
          </div>
        `).join('');
      } else {
        neuralCard.style.display = 'none';
      }

      // Flags
      document.getElementById('imageFlags').innerHTML = result.flags.map(f => `
        <div class="flag-item ${f.type}">
          <i class="${f.icon}" style="color:${f.type === 'success' ? '#3dba5c' : f.type === 'danger' ? '#f05454' : '#f07a3a'}"></i>
          <p>${f.text}</p>
        </div>
      `).join('');

      state.stats.images++;
      if (result.authenticityScore < 40) state.stats.threats++;
      saveStats();
      addActivity('image', file.name, result.authenticityScore, result.verdict);

      hideLoading();
      toast('Image analysis complete!', 'success');
    } catch (err) {
      hideLoading();
      toast('Error analyzing image: ' + err.message, 'error');
    }
  }

  // ==================== VIDEO ANALYSIS ====================
  function setupVideoUpload() {
    const dropZone = document.getElementById('videoDropZone');
    const fileInput = document.getElementById('videoFileInput');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) processVideo(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) processVideo(fileInput.files[0]); });
  }

  async function processVideo(file) {
    if (!file.type.startsWith('video/')) { toast('Please upload a video file', 'error'); return; }
    if (file.size > 100 * 1024 * 1024) { toast('File too large. Max 100MB.', 'error'); return; }

    showLoading('Extracting and analyzing video frames...');

    try {
      const result = await videoAnalyzer.analyze(file);

      document.getElementById('videoResultsArea').style.display = 'block';
      document.getElementById('videoDropZone').style.display = 'none';

      // Score gauge
      const arc = document.getElementById('videoGaugeArc');
      const maxDash = 251;
      arc.style.transition = 'stroke-dasharray 1.5s ease';
      arc.setAttribute('stroke-dasharray', `${(result.deepfakeConfidence / 100) * maxDash} ${maxDash}`);
      document.getElementById('videoScoreValue').textContent = result.deepfakeConfidence + '%';
      const label = document.getElementById('videoScoreLabel');
      label.textContent = result.verdict;
      label.style.fill = result.verdictClass === 'success' ? '#3dba5c' : result.verdictClass === 'warning' ? '#f07a3a' : '#f05454';

      // Frames grid
      const framesGrid = document.getElementById('framesGrid');
      framesGrid.innerHTML = result.frames.map((frame, i) => {
        const suspicious = result.consistency.details[i - 1]?.suspicious;
        return `
          <div class="frame-thumb ${suspicious ? 'suspicious' : ''}">
            <img src="${frame.dataUrl}" alt="Frame ${i + 1}" style="width:100%;display:block;border-radius:8px">
            <div class="frame-label">${frame.time}s ${suspicious ? '⚠️' : ''}</div>
          </div>`;
      }).join('');

      // Consistency chart
      drawConsistencyChart(result.consistency.details);

      // Face analysis
      document.getElementById('faceAnalysis').innerHTML = result.faceAnalysis.details.map(d => `
        <div class="a-item"><span>${d.label}</span><span style="font-weight:600">${d.value}</span></div>
      `).join('');

      // Render neural video card
      const neuralVideoCard = document.getElementById('neuralVideoCard');
      if (result.temporalStability) {
        neuralVideoCard.style.display = 'block';
        const classesList = result.temporalStability.frameClasses.map(fc => 
          `Frame ${fc.frame + 1}: <strong>${fc.topClass.split(',')[0]}</strong> (${(fc.probability * 100).toFixed(0)}%)`
        ).join('<br>');

        document.getElementById('neuralVideoItems').innerHTML = `
          <div class="a-item">
            <span>Neural Stability Score</span>
            <span style="font-weight:600;color:${result.temporalStability.stabilityScore > 75 ? 'var(--success)' : 'var(--danger)'}">
              ${result.temporalStability.stabilityScore}%
            </span>
          </div>
          <div class="a-item">
            <span>Class Flickers</span>
            <span style="font-weight:600">${result.temporalStability.classFlickers} transitions</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text2);margin-top:0.75rem;line-height:1.55">
            <strong>MobileNet frame classification timeline:</strong><br>
            <div style="margin-top:0.35rem;display:flex;flex-direction:column;gap:0.2rem">${classesList}</div>
          </div>
        `;
      } else {
        neuralVideoCard.style.display = 'none';
      }

      // Flags
      document.getElementById('videoFlags').innerHTML = result.flags.map(f => `
        <div class="flag-item ${f.type}">
          <i class="${f.icon}" style="color:${f.type === 'success' ? '#3dba5c' : f.type === 'danger' ? '#f05454' : '#f07a3a'}"></i>
          <p>${f.text}</p>
        </div>
      `).join('');

      state.stats.videos++;
      if (result.deepfakeConfidence > 60) state.stats.threats++;
      saveStats();
      addActivity('video', file.name, 100 - result.deepfakeConfidence, result.verdict);

      hideLoading();
      toast('Video analysis complete!', 'success');
    } catch (err) {
      hideLoading();
      toast('Error analyzing video: ' + err.message, 'error');
    }
  }

  function drawConsistencyChart(details) {
    const canvas = document.getElementById('consistencyChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 160 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = 160;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    if (!details || details.length === 0) { return; }

    const values = details.map(d => parseFloat(d.colorDiff));
    const maxVal = Math.max(...values, 50);

    // Grid
    ctx.strokeStyle = '#2a2a32';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(w - padding.right, y); ctx.stroke();
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#5b7cfa';
    ctx.lineWidth = 2;
    values.forEach((val, i) => {
      const x = padding.left + (i / (values.length - 1)) * chartW;
      const y = padding.top + chartH - (val / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    values.forEach((val, i) => {
      const x = padding.left + (i / (values.length - 1)) * chartW;
      const y = padding.top + chartH - (val / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = details[i].suspicious ? '#f05454' : '#5b7cfa';
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = '#5e5e70';
    ctx.font = '10px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Frame Transitions', w / 2, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(maxVal.toFixed(0), padding.left - 5, padding.top + 4);
    ctx.fillText('0', padding.left - 5, padding.top + chartH + 4);
  }

  // ==================== QUIZ ====================
  const quizData = [
    { q: 'What is the first thing to check when encountering a sensational news headline?', options: ['Share it immediately', 'Check the source and verify', 'Ignore it', 'Add your opinion'], correct: 1, explanation: 'Always verify the source before sharing any content.' },
    { q: 'Which of these is a common sign of a deepfake video?', options: ['High resolution', 'Unnatural blinking', 'Good audio quality', 'Professional editing'], correct: 1, explanation: 'Deepfakes often have unnatural blinking, lip-sync issues, and edge artifacts.' },
    { q: 'What does ELA stand for in image forensics?', options: ['Electronic Level Assessment', 'Error Level Analysis', 'Enhanced Light Analysis', 'Edge Line Algorithm'], correct: 1, explanation: 'ELA compares compression levels across an image to detect edits.' },
    { q: 'Which is a trusted fact-checking platform in India?', options: ['WhatsApp University', 'PIB Fact Check', 'Random blogs', 'Forwarded messages'], correct: 1, explanation: 'PIB Fact Check is an official government initiative to combat misinformation.' },
    { q: 'What should you do before forwarding a viral message?', options: ['Add "forwarded as received"', 'Verify with multiple sources', 'Send to all contacts', 'Forward to groups'], correct: 1, explanation: 'Always cross-verify information with trusted sources before sharing.' }
  ];

  function loadQuiz() {
    showQuizQuestion(state.quizIndex);
  }

  function showQuizQuestion(index) {
    const quiz = quizData[index % quizData.length];
    document.getElementById('quizQuestion').textContent = quiz.q;
    document.getElementById('quizFeedback').textContent = '';
    document.getElementById('quizOptions').innerHTML = quiz.options.map((opt, i) => `
      <button class="quiz-option" onclick="TruthShield.answerQuiz(${i})">${opt}</button>
    `).join('');
  }

  function answerQuiz(selected) {
    const quiz = quizData[state.quizIndex % quizData.length];
    const options = document.querySelectorAll('.quiz-option');
    options.forEach((opt, i) => {
      opt.disabled = true;
      opt.style.pointerEvents = 'none';
      if (i === quiz.correct) opt.classList.add('correct');
      if (i === selected && i !== quiz.correct) opt.classList.add('wrong');
    });
    document.getElementById('quizFeedback').textContent = quiz.explanation;
  }

  function nextQuiz() {
    state.quizIndex++;
    showQuizQuestion(state.quizIndex);
  }

  // ==================== LANGUAGE ====================
  const i18n = {
    hi: {
      hero_title: 'गलत सूचना को रोकें<br><em>इससे पहले कि वह फैले।</em>',
      hero_subtitle: 'AI विश्लेषण के साथ फेक न्यूज़, डीपफेक वीडियो और हेरफेर की गई छवियों का पता लगाएं।',
      analyze_btn: 'विश्लेषण करें', stat_texts: 'पाठ विश्लेषित', stat_images: 'छवियां स्कैन', stat_videos: 'वीडियो जांचे', stat_threats: 'खतरे पाए'
    },
    gu: {
      hero_title: 'ખોટી માહિતી અટકાવો<br><em>તે ફેલાય તે પહેલાં.</em>',
      hero_subtitle: 'AI વિશ્લેષણ સાથે ફેક ન્યૂઝ, ડીપફેક વીડિયો અને મેનિપ્યુલેટેડ છબીઓ શોધો.',
      analyze_btn: 'વિશ્લેષણ કરો', stat_texts: 'ટેક્સ્ટ વિશ્લેષિત', stat_images: 'છબીઓ સ્કેન', stat_videos: 'વીડિયો ચકાસ્યા', stat_threats: 'ખતરા મળ્યા'
    },
    ta: {
      hero_title: 'தவறான தகவலை நிறுத்துங்கள்<br><em>பரவும் முன்.</em>',
      hero_subtitle: 'AI பகுப்பாய்வு மூலம் போலிச் செய்திகள், டீப்ஃபேக் வீடியோக்கள், கையாளப்பட்ட படங்களைக் கண்டறியுங்கள்.',
      analyze_btn: 'பகுப்பாய்வு', stat_texts: 'உரைகள் பகுப்பாய்வு', stat_images: 'படங்கள் ஸ்கேன்', stat_videos: 'வீடியோக்கள் சரிபார்ப்பு', stat_threats: 'அச்சுறுத்தல்கள்'
    }
  };

  function setupLanguage() {
    document.getElementById('langSelect').addEventListener('change', (e) => {
      state.lang = e.target.value;
      applyLanguage(state.lang);
    });
  }

  function applyLanguage(lang) {
    if (lang === 'en') {
      location.reload(); return;
    }
    const strings = i18n[lang];
    if (!strings) return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (strings[key]) {
        if (key.includes('title') && strings[key].includes('<')) el.innerHTML = strings[key];
        else el.textContent = strings[key];
      }
    });
  }

  // ==================== UTILITIES ====================
  function showLoading(text) {
    document.getElementById('loadingText').textContent = text || 'Analyzing...';
    document.getElementById('loadingOverlay').classList.add('show');
  }

  function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
  }

  function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4000);
  }

  function saveStats() {
    localStorage.setItem('truthshield_stats', JSON.stringify(state.stats));
    updateStatCounters();
  }

  function updateStatCounters() {
    animateCounter('stat-texts', state.stats.texts);
    animateCounter('stat-images', state.stats.images);
    animateCounter('stat-videos', state.stats.videos);
    animateCounter('stat-threats', state.stats.threats);
  }

  function animateCounter(id, target) {
    const el = document.getElementById(id);
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const step = target > current ? 1 : -1;
    let val = current;
    const interval = setInterval(() => {
      val += step;
      el.textContent = val;
      if (val === target) clearInterval(interval);
    }, 50);
  }

  function animateStats() {
    updateStatCounters();
  }

  function addActivity(type, description, score, verdict) {
    const icons = { text: 'fa-file-lines', image: 'fa-image', video: 'fa-video' };
    const colors = { text: '#5b7cfa', image: '#a78bfa', video: '#f07a3a' };

    state.activities.unshift({
      type, description, score, verdict,
      icon: icons[type], color: colors[type],
      time: new Date().toLocaleTimeString()
    });

    if (state.activities.length > 20) state.activities = state.activities.slice(0, 20);
    localStorage.setItem('truthshield_activities', JSON.stringify(state.activities));
    renderActivities();
  }

  function renderActivities() {
    const feed = document.getElementById('activityFeed');
    if (state.activities.length === 0) return;

    feed.innerHTML = state.activities.slice(0, 8).map(a => {
      const scoreColor = a.score >= 70 ? '#3dba5c' : a.score >= 40 ? '#f07a3a' : '#f05454';
      return `
        <div class="activity-item">
          <div class="act-icon" style="background:${a.color}20;color:${a.color}"><i class="fas ${a.icon}"></i></div>
          <div class="act-info">
            <strong>${a.description}</strong>
            <p>${a.verdict} • ${a.time}</p>
          </div>
          <div class="act-score" style="color:${scoreColor}">${a.score}%</div>
        </div>`;
    }).join('');
  }

  // ==================== NLP RENDERING ====================
  function renderStance(stance) {
    // Header
    const stanceColors = {
      asserting: '#f07a3a', hedging: '#5b7cfa', denying: '#f05454',
      questioning: '#5b7cfa', attributing: '#3dba5c'
    };
    const color = stanceColors[stance.stance] || '#5b7cfa';

    document.getElementById('stanceHeader').innerHTML = `
      <div class="stance-icon" style="background:${color}18;color:${color}">
        <i class="${stance.icon}"></i>
      </div>
      <div class="stance-meta">
        <span class="stance-label">${stance.label}</span>
        <span class="stance-conf">${stance.confidence}% confidence</span>
      </div>`;

    // Distribution bars
    const barLabels = {
      asserting: 'Assert', hedging: 'Hedge', denying: 'Deny',
      questioning: 'Question', attributing: 'Attribute'
    };
    const barColors = {
      asserting: '#f07a3a', hedging: '#5b7cfa', denying: '#f05454',
      questioning: '#a78bfa', attributing: '#3dba5c'
    };

    document.getElementById('stanceBars').innerHTML = Object.entries(stance.distribution)
      .filter(([, v]) => v > 0)
      .map(([key, val]) => `
        <div class="stance-bar-row">
          <span class="stance-bar-label">${barLabels[key] || key}</span>
          <div class="stance-bar-track"><div class="stance-bar-fill" style="width:${val}%;background:${barColors[key] || '#5b7cfa'}"></div></div>
          <span class="stance-bar-val">${val}%</span>
        </div>`).join('');

    // Evidence chips
    if (stance.evidence && stance.evidence.length > 0) {
      document.getElementById('stanceEvidence').innerHTML = stance.evidence.map(e => `
        <span class="evidence-chip ${e.type}">
          <i class="fas fa-circle"></i> ${e.marker}
        </span>`).join('');
    } else {
      document.getElementById('stanceEvidence').innerHTML = `
        <span class="evidence-chip neutral" style="background:var(--surface2);border-color:var(--border)">
          <i class="fas fa-brain" style="color:var(--accent);margin-right:0.25rem"></i> Neural semantic alignment check
        </span>`;
    }

    // Risk assessment
    document.getElementById('stanceRisk').textContent = stance.stanceRisk;
  }

  function renderSimilarity(sim) {
    // Summary badge
    document.getElementById('simSummary').innerHTML = `
      <span class="sim-badge ${sim.riskLevel}">${sim.riskLevel === 'none' ? 'Clear' : sim.riskLevel + ' risk'}</span>
      <span class="sim-desc">${sim.riskLabel} (top score: ${sim.topScore}%)</span>`;

    // Matches
    if (sim.matches.length === 0) {
      document.getElementById('simMatches').innerHTML = `
        <div class="sim-empty"><i class="fas fa-check-circle" style="color:#3dba5c"></i> No significant matches to known misinformation patterns found.</div>`;
      return;
    }

    const matchColor = (score) => score >= 50 ? '#f05454' : score >= 30 ? '#f07a3a' : '#5b7cfa';

    document.getElementById('simMatches').innerHTML = sim.matches.map(m => `
      <div class="sim-match">
        <div class="sim-match-head">
          <span class="sim-match-cat">${m.category}</span>
          <span class="sim-match-score" style="color:${matchColor(m.similarity)}">${m.similarity}%</span>
        </div>
        <div class="sim-match-bar"><div class="sim-match-bar-fill" style="width:${m.similarity}%;background:${matchColor(m.similarity)}"></div></div>
        ${m.matchedKeywords.length > 0 ? `<div class="sim-match-keys">${m.matchedKeywords.map(k => `<span class="sim-key">${k}</span>`).join('')}</div>` : ''}
      </div>`).join('');
  }

  function updateMLStatusUI(status) {
    const badge = document.getElementById('mlStatusBadge');
    if (!badge) return;

    if (status.loaded) {
      badge.className = 'ml-status-badge active';
      badge.innerHTML = '<i class="fas fa-brain"></i> <span>AI Core: Active (WebGL)</span>';
      toast('AI Neural Engine activated successfully!', 'info');
    } else if (status.loading) {
      badge.className = 'ml-status-badge loading';
      badge.innerHTML = '<i class="fas fa-brain spinner-pulse"></i> <span>Initializing AI...</span>';
    } else if (status.error) {
      badge.className = 'ml-status-badge error';
      badge.innerHTML = '<i class="fas fa-triangle-exclamation"></i> <span>AI offline</span>';
      toast('AI Neural Engine failed to initialize: ' + status.error, 'error');
    }
  }

  // ==================== PUBLIC API ====================
  document.addEventListener('DOMContentLoaded', init);

  return {
    navigate, analyzeText, answerQuiz, nextQuiz
  };
})();
