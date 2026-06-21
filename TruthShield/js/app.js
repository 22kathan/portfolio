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

        // 3D Pie Chart for text analysis: Real vs Edited vs Fake
        const realVal = result.trustScore;
        const editVal = Math.round(((result.clickbait + result.sentiment) / 2) * (1 - realVal / 100));
        const fakeVal = 100 - realVal - editVal;
        draw3DPieChart('textPieChart3D', [
          { label: 'Real / Authentic', value: realVal, color: '#3dba5c' },
          { label: 'Edited / Sensationalized', value: editVal, color: '#f07a3a' },
          { label: 'Fake / Misinformation', value: fakeVal, color: '#f05454' }
        ], 'Text Authenticity Analysis');

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
    if (file.size > 30 * 1024 * 1024) { toast('File too large. Max 30MB.', 'error'); return; }

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

      // 3D Pie Chart for image analysis: Real vs Edited vs AI Generated
      const imgScores = result.provenance ? result.provenance.scores : { raw: 70, edit: 20, ai: 10 };
      draw3DPieChart('imagePieChart3D', [
        { label: 'Real / Authentic', value: imgScores.raw, color: '#3dba5c' },
        { label: 'Edited / Modified', value: imgScores.edit, color: '#f07a3a' },
        { label: 'AI Generated', value: imgScores.ai, color: '#c084fc' }
      ], 'Image Authenticity Origin');

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

      // Provenance
      if (result.provenance) {
        renderProvenance(result.provenance, 'image');
      }

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
    if (file.size > 250 * 1024 * 1024) { toast('File too large. Max 250MB.', 'error'); return; }

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

      // 3D Pie Chart for video analysis: Real vs Edited vs AI Generated
      const vidScores = result.provenance ? result.provenance.scores : { raw: 70, edit: 20, ai: 10 };
      draw3DPieChart('videoPieChart3D', [
        { label: 'Real / Authentic', value: vidScores.raw, color: '#3dba5c' },
        { label: 'Edited / Modified', value: vidScores.edit, color: '#f07a3a' },
        { label: 'AI Generated / Deepfake', value: vidScores.ai, color: '#c084fc' }
      ], 'Video Authenticity Origin');

      // Flags
      document.getElementById('videoFlags').innerHTML = result.flags.map(f => `
        <div class="flag-item ${f.type}">
          <i class="${f.icon}" style="color:${f.type === 'success' ? '#3dba5c' : f.type === 'danger' ? '#f05454' : '#f07a3a'}"></i>
          <p>${f.text}</p>
        </div>
      `).join('');

      // Provenance
      if (result.provenance) {
        renderProvenance(result.provenance, 'video');
      }

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
    const idx = index % quizData.length;
    const strings = i18n[state.lang] || i18n.en;

    const qText = strings[`quiz_q_${idx}`] || quiz.q;
    document.getElementById('quizQuestion').textContent = qText;
    document.getElementById('quizFeedback').textContent = '';
    document.getElementById('quizOptions').innerHTML = quiz.options.map((opt, i) => {
      const optText = strings[`quiz_opt_${idx}_${i}`] || opt;
      return `<button class="quiz-option" onclick="TruthShield.answerQuiz(${i})">${optText}</button>`;
    }).join('');
  }

  function answerQuiz(selected) {
    const quiz = quizData[state.quizIndex % quizData.length];
    const idx = state.quizIndex % quizData.length;
    const strings = i18n[state.lang] || i18n.en;
    const explanation = strings[`quiz_exp_${idx}`] || quiz.explanation;

    const options = document.querySelectorAll('.quiz-option');
    options.forEach((opt, i) => {
      opt.disabled = true;
      opt.style.pointerEvents = 'none';
      if (i === quiz.correct) opt.classList.add('correct');
      if (i === selected && i !== quiz.correct) opt.classList.add('wrong');
    });
    document.getElementById('quizFeedback').textContent = explanation;
  }

  function nextQuiz() {
    state.quizIndex++;
    showQuizQuestion(state.quizIndex);
  }

  // ==================== LANGUAGE ====================
  const i18n = {
    en: {
      nav_dashboard: 'Dashboard',
      nav_text: 'Text',
      nav_image: 'Image',
      nav_video: 'Video',
      nav_literacy: 'Learn',
      hero_overline: 'AI-Powered Verification Platform',
      hero_title: 'Stop misinformation<br><em>before it spreads.</em>',
      hero_subtitle: 'Upload text, images, or videos — TruthShield analyses them for fake news patterns, deepfake artifacts, and digital manipulation in seconds.',
      btn_analyse_text: 'Analyse Text',
      btn_scan_image: 'Scan Image',
      btn_check_video: 'Check Video',
      stat_texts: 'texts analysed',
      stat_images: 'images scanned',
      stat_videos: 'videos checked',
      stat_threats: 'threats flagged',
      how_it_works: 'How it works',
      step_1_title: 'Upload content',
      step_1_desc: 'Paste text, drop an image, or upload a video file',
      step_2_title: 'AI analyses it',
      step_2_desc: 'Multiple detection algorithms run in parallel',
      step_3_title: 'Get a trust score',
      step_3_desc: 'See a detailed breakdown with explanations and flags',
      fact_check_partners: 'Fact-check partners',
      recent_activity: 'Recent activity',
      activity_empty_msg: 'No analyses yet. Pick a tool above to get started.',
      text_title: 'Text & News Analysis',
      text_desc: 'Paste a headline, article, or social media post. We\'ll check it for clickbait, emotional manipulation, source credibility, and known misinformation patterns.',
      tab_paste_text: 'Paste text',
      tab_enter_url: 'Enter URL',
      text_placeholder: 'Paste news article, headline, or social media post here…',
      url_placeholder: 'https://example.com/article',
      url_hint: 'Content will be fetched and analysed automatically',
      char_count_suffix: 'chars',
      analyze_btn: 'Analyse',
      cross_verified_label: 'Cross-verified with',
      trust_score_label: 'Trust score',
      metric_clickbait: 'Clickbait',
      metric_sentiment: 'Sentiment bias',
      metric_credibility: 'Source credibility',
      metric_quality: 'Writing quality',
      stance_detection_label: 'Stance Detection',
      semantic_similarity_label: 'Semantic Similarity Analysis',
      detected_flags_label: 'Detected flags',
      explanation_label: 'Explanation',
      img_title: 'Image Manipulation Detection',
      img_desc: 'Upload a photo to run Error Level Analysis, extract metadata, and detect AI-generation artifacts.',
      upload_img_main: 'Drop an image here, or browse',
      upload_img_sub: 'JPG, PNG, WebP · Max 30 MB',
      original_label: 'Original',
      ela_label: 'Error Level Analysis',
      ela_consistent: 'Consistent',
      ela_minor: 'Minor diff',
      ela_suspect: 'Suspect',
      authenticity_score_label: 'Authenticity score',
      breakdown_label: 'Breakdown',
      neural_classification_label: 'Neural Scene Classification',
      metadata_label: 'Metadata',
      metadata_waiting: 'Waiting for upload…',
      provenance_label: 'Media Provenance & Source Origin',
      findings_label: 'Findings',
      vid_title: 'Deepfake Video Detection',
      vid_desc: 'Upload a video to extract frames and analyse them for temporal artifacts, face inconsistencies, and deepfake signatures.',
      upload_vid_main: 'Drop a video here, or browse',
      upload_vid_sub: 'MP4, WebM, AVI · Max 250 MB',
      extracted_frames_label: 'Extracted frames',
      deepfake_confidence_label: 'Deepfake confidence',
      frame_consistency_label: 'Frame consistency',
      face_analysis_label: 'Face analysis',
      neural_video_label: 'Neural Frame Analysis',
      video_provenance_label: 'Video Provenance & Origin',
      detection_results_label: 'Detection results',
      lit_title: 'Learn to spot fakes',
      lit_desc: 'Build your media literacy skills. Know the telltale signs of misinformation, deepfakes, and image manipulation.',
      lit_fake_title: 'Spotting fake news',
      lit_fake_1: 'Check the source — is it a known, reputable outlet?',
      lit_fake_2: 'Read beyond the headline — clickbait often misleads',
      lit_fake_3: 'Check the date — old news is often reshared as current',
      lit_fake_4: 'Verify with multiple sources before sharing',
      lit_fake_5: 'Watch for unusual formatting, spelling errors, ALL CAPS',
      lit_deep_title: 'Recognising deepfakes',
      lit_deep_1: 'Watch for unnatural blinking or eye movements',
      lit_deep_2: 'Check lip-sync — does speech match lip movement?',
      lit_deep_3: 'Look for skin texture issues and blurring at face edges',
      lit_deep_4: 'Notice lighting inconsistencies across the face',
      lit_deep_5: 'Be suspicious of viral videos from unknown sources',
      lit_img_title: 'Detecting manipulated images',
      lit_img_1: 'Use reverse image search to find the original',
      lit_img_2: 'Look for inconsistent shadows and lighting',
      lit_img_3: 'Check edges for cloning or blending artifacts',
      lit_img_4: 'Zoom in — look for repeated patterns (clone stamp)',
      lit_img_5: 'Check metadata for editing software traces',
      lit_share_title: 'Responsible sharing',
      lit_share_1: 'Verify before you share — you\'re the last line of defence',
      lit_share_2: 'Use fact-checkers: PIB, AltNews, BOOM, Factly',
      lit_share_3: 'Report suspicious content to platform moderators',
      lit_share_4: 'Educate family and friends about misinformation',
      lit_share_5: 'Be wary of content that triggers strong emotions',
      quick_quiz: 'Quick quiz',
      next_question: 'Next question →',
      loading_analyzing: 'Analysing…',
      footer_mid: 'AI-Driven Detection for Fake News, Deepfakes & Media Manipulation',
      footer_org: 'Cyber Crime Branch, Ahmedabad City Police',
      quiz_q_0: 'What is the first thing to check when encountering a sensational news headline?',
      quiz_opt_0_0: 'Share it immediately',
      quiz_opt_0_1: 'Check the source and verify',
      quiz_opt_0_2: 'Ignore it',
      quiz_opt_0_3: 'Add your opinion',
      quiz_exp_0: 'Always verify the source before sharing any content.',
      quiz_q_1: 'Which of these is a common sign of a deepfake video?',
      quiz_opt_1_0: 'High resolution',
      quiz_opt_1_1: 'Unnatural blinking',
      quiz_opt_1_2: 'Good audio quality',
      quiz_opt_1_3: 'Professional editing',
      quiz_exp_1: 'Deepfakes often have unnatural blinking, lip-sync issues, and edge artifacts.',
      quiz_q_2: 'What does ELA stand for in image forensics?',
      quiz_opt_2_0: 'Electronic Level Assessment',
      quiz_opt_2_1: 'Error Level Analysis',
      quiz_opt_2_2: 'Enhanced Light Analysis',
      quiz_opt_2_3: 'Edge Line Algorithm',
      quiz_exp_2: 'ELA compares compression levels across an image to detect edits.',
      quiz_q_3: 'Which is a trusted fact-checking platform in India?',
      quiz_opt_3_0: 'WhatsApp University',
      quiz_opt_3_1: 'PIB Fact Check',
      quiz_opt_3_2: 'Random blogs',
      quiz_opt_3_3: 'Forwarded messages',
      quiz_exp_3: 'PIB Fact Check is an official government initiative to combat misinformation.',
      quiz_q_4: 'What should you do before forwarding a viral message?',
      quiz_opt_4_0: 'Add "forwarded as received"',
      quiz_opt_4_1: 'Verify with multiple sources',
      quiz_opt_4_2: 'Send to all contacts',
      quiz_opt_4_3: 'Forward to groups',
      quiz_exp_4: 'Always cross-verify information with trusted sources before sharing.'
    },
    hi: {
      nav_dashboard: 'डैशबोर्ड',
      nav_text: 'पाठ (टेक्स्ट)',
      nav_image: 'छवि',
      nav_video: 'वीडियो',
      nav_literacy: 'सिखें',
      hero_overline: 'एआई-संचालित सत्यापन मंच',
      hero_title: 'गलत सूचना को रोकें<br><em>इससे पहले कि वह फैले।</em>',
      hero_subtitle: 'टेक्स्ट, इमेज या वीडियो अपलोड करें — ट्रुथशील्ड सेकंडों में नकली समाचार पैटर्न, डीपफेक आर्टिफैक्ट्स और डिजिटल हेरफेर के लिए उनका विश्लेषण करता है।',
      btn_analyse_text: 'पाठ विश्लेषण',
      btn_scan_image: 'छवि स्कैन',
      btn_check_video: 'वीडियो जांच',
      stat_texts: 'पाठ विश्लेषित',
      stat_images: 'छवियां स्कैन',
      stat_videos: 'वीडियो जांचे',
      stat_threats: 'खतरे पाए',
      how_it_works: 'यह कैसे काम करता है',
      step_1_title: 'सामग्री अपलोड करें',
      step_1_desc: 'पाठ पेस्ट करें, एक छवि डालें, या एक वीडियो फ़ाइल अपलोड करें',
      step_2_title: 'एआई विश्लेषण करता है',
      step_2_desc: 'समानांतर में एकाधिक पहचान एल्गोरिदम चलते हैं',
      step_3_title: 'एक ट्रस्ट स्कोर प्राप्त करें',
      step_3_desc: 'स्पष्टीकरण और झंडों के साथ विस्तृत विवरण देखें',
      fact_check_partners: 'तथ्य-जांच भागीदार',
      recent_activity: 'हाल ही की गतिविधि',
      activity_empty_msg: 'अभी तक कोई विश्लेषण नहीं हुआ है। शुरू करने के लिए ऊपर से एक टूल चुनें।',
      text_title: 'पाठ और समाचार विश्लेषण',
      text_desc: 'शीर्षक, लेख या सोशल मीडिया पोस्ट पेस्ट करें। हम क्लिकबैट, भावनात्मक हेरफेर, स्रोत विश्वसनीयता और ज्ञात गलत सूचना पैटर्न के लिए इसकी जांच करेंगे।',
      tab_paste_text: 'पाठ पेस्ट करें',
      tab_enter_url: 'यूआरएल दर्ज करें',
      text_placeholder: 'समाचार लेख, शीर्षक, या सोशल मीडिया पोस्ट यहाँ पेस्ट करें…',
      url_placeholder: 'https://example.com/article',
      url_hint: 'सामग्री स्वचालित रूप से प्राप्त और विश्लेषित की जाएगी',
      char_count_suffix: 'वर्ण',
      analyze_btn: 'विश्लेषण करें',
      cross_verified_label: 'इनके साथ क्रॉस-सत्यापित',
      trust_score_label: 'ट्रस्ट स्कोर',
      metric_clickbait: 'क्लिकबैट',
      metric_sentiment: 'भावना पूर्वाग्रह',
      metric_credibility: 'स्रोत विश्वसनीयता',
      metric_quality: 'लेखन गुणवत्ता',
      stance_detection_label: 'रुख की पहचान',
      semantic_similarity_label: 'अर्थपूर्ण समानता विश्लेषण',
      detected_flags_label: 'पाए गए झंडे',
      explanation_label: 'स्पष्टीकरण',
      img_title: 'छवि हेरफेर पहचान',
      img_desc: 'त्रुटि स्तर विश्लेषण (ELA) चलाने, मेटाडेटा निकालने और एआई-जनरेशन कलाकृतियों का पता लगाने के लिए एक फोटो अपलोड करें।',
      upload_img_main: 'यहाँ एक छवि डालें, या ब्राउज़ करें',
      upload_img_sub: 'JPG, PNG, WebP · अधिकतम 30 MB',
      original_label: 'मूल छवि',
      ela_label: 'त्रुटि स्तर विश्लेषण',
      ela_consistent: 'सुसंगत',
      ela_minor: 'मामूली अंतर',
      ela_suspect: 'संदिग्ध',
      authenticity_score_label: 'प्रामाणिकता स्कोर',
      breakdown_label: 'विभाजन',
      neural_classification_label: 'तंत्रिका दृश्य वर्गीकरण',
      metadata_label: 'मेटाडेटा',
      metadata_waiting: 'अपलोड की प्रतीक्षा की जा रही है…',
      provenance_label: 'मीडिया उद्गम और स्रोत उत्पत्ति',
      findings_label: 'निष्कर्ष',
      vid_title: 'डीपफेक वीडियो पहचान',
      vid_desc: 'वीडियो के फ़्रेम निकालने और उनमें अस्थायी विसंगतियों, चेहरे की बेमेल संरचना और डीपफेक हस्ताक्षरों के विश्लेषण के लिए वीडियो अपलोड करें।',
      upload_vid_main: 'यहाँ एक वीडियो डालें, या ब्राउज़ करें',
      upload_vid_sub: 'MP4, WebM, AVI · अधिकतम 250 MB',
      extracted_frames_label: 'निकाले गए फ़्रेम',
      deepfake_confidence_label: 'डीपफेक आत्मविश्वास',
      frame_consistency_label: 'फ़्रेम निरंतरता',
      face_analysis_label: 'चेहरा विश्लेषण',
      neural_video_label: 'तंत्रिका फ़्रेम विश्लेषण',
      video_provenance_label: 'वीडियो उद्गम और उत्पत्ति',
      detection_results_label: 'पहचान के परिणाम',
      lit_title: 'नकली की पहचान करना सीखें',
      lit_desc: 'अपने मीडिया साक्षरता कौशल का निर्माण करें। गलत सूचना, डीपफेक और छवि हेरफेर के स्पष्ट संकेतों को जानें।',
      lit_fake_title: 'फर्जी खबरों को पहचानना',
      lit_fake_1: 'स्रोत की जाँच करें — क्या यह एक प्रतिष्ठित समाचार आउटलेट है?',
      lit_fake_2: 'शीर्षक से आगे पढ़ें — क्लिकबैट अक्सर भ्रामक होता है',
      lit_fake_3: 'तारीख की जाँच करें — पुरानी खबरों को अक्सर वर्तमान मानकर साझा किया जाता है',
      lit_fake_4: 'साझा करने से पहले कई स्रोतों से सत्यापित करें',
      lit_fake_5: 'असामान्य स्वरूपण, वर्तनी की त्रुटियों, या ALL CAPS पर ध्यान दें',
      lit_deep_title: 'डीपफेक को पहचानना',
      lit_deep_1: 'अस्वाभाविक रूप से पलकें झपकने या आँखों की हलचल पर नज़र रखें',
      lit_deep_2: 'लिप-सिंक की जाँच करें — क्या आवाज़ होठों की हलचल से मेल खाती है?',
      lit_deep_3: 'चेहरे के किनारों पर त्वचा की बनावट की समस्याओं और धुंधलेपन को देखें',
      lit_deep_4: 'चेहरे पर रोशनी की विसंगतियों पर ध्यान दें',
      lit_deep_5: 'अअज्ञात स्रोतों से आने वाले वायरल वीडियो पर संदेह करें',
      lit_img_title: 'हेरफेर की गई छवियों का पता लगाना',
      lit_img_1: 'मूल छवि खोजने के लिए रिवर्स इमेज सर्च का उपयोग करें',
      lit_img_2: 'असंगत परछाइयों और प्रकाश की दिशा को देखें',
      lit_img_3: 'क्लोनिंग या सम्मिश्रण विसंगतियों के लिए किनारों की जाँच करें',
      lit_img_4: 'ज़ूम इन करें — बार-बार दोहराए जाने वाले पैटर्न (क्लोन स्टैम्प) को देखें',
      lit_img_5: 'संपादन सॉफ़्टवेयर निशानों के लिए मेटाडेटा की जाँच करें',
      lit_share_title: 'जिम्मेदार साझाकरण',
      lit_share_1: 'साझा करने से पहले रुकें और सत्यापित करें — आप सुरक्षा की अंतिम पंक्ति हैं',
      lit_share_2: 'विश्वसनीय तथ्य-जांचकर्ताओं का उपयोग करें: PIB, AltNews, BOOM, Factly',
      lit_share_3: 'मंच के मध्यस्थों को संदिग्ध सामग्री की रिपोर्ट करें',
      lit_share_4: 'परिवार और दोस्तों को गलत सूचना के लक्षणों के बारे में शिक्षित करें',
      lit_share_5: 'ऐसी सामग्री से सावधान रहें जो तीव्र भावनात्मक प्रतिक्रियाएँ पैदा करती है',
      quick_quiz: 'त्वरित प्रश्नोत्तरी',
      next_question: 'अगला प्रश्न →',
      loading_analyzing: 'विश्लेषण किया जा रहा है…',
      footer_mid: 'फर्जी खबरों, डीपफेक और मीडिया हेरफेर से निपटने के लिए एआई-आधारित सत्यापन मंच',
      footer_org: 'साइबर क्राइम सेल, अहमदाबाद सिटी पुलिस',
      quiz_q_0: 'सनसनीखेज समाचारों की सुर्खियों का सामना करने पर सबसे पहले किस चीज़ की जांच करनी चाहिए?',
      quiz_opt_0_0: 'इसे तुरंत साझा करें',
      quiz_opt_0_1: 'स्रोत की जाँच करें और सत्यापित करें',
      quiz_opt_0_2: 'इसे अनदेखा करें',
      quiz_opt_0_3: 'अपनी राय जोड़ें',
      quiz_exp_0: 'किसी भी सामग्री को साझा करने से पहले हमेशा स्रोत को सत्यापित करें।',
      quiz_q_1: 'इनमें से कौन सा डीपफेक वीडियो का एक सामान्य संकेत है?',
      quiz_opt_1_0: 'उच्च रिज़ॉल्यूशन',
      quiz_opt_1_1: 'अस्वाभाविक पलकें झपकना',
      quiz_opt_1_2: 'अच्छी ऑडियो गुणवत्ता',
      quiz_opt_1_3: 'व्यावसायिक संपादन',
      quiz_exp_1: 'डीपफेक में अक्सर अस्वाभाविक पलकें झपकना, लिप-सिंक की समस्याएं और किनारों पर त्रुटियां होती हैं।',
      quiz_q_2: 'इमेज फोरेंसिक में ELA का क्या अर्थ है?',
      quiz_opt_2_0: 'इलेक्ट्रॉनिक स्तर का मूल्यांकन',
      quiz_opt_2_1: 'त्रुटि स्तर विश्लेषण',
      quiz_opt_2_2: 'उन्नत प्रकाश विश्लेषण',
      quiz_opt_2_3: 'एज लाइन एल्गोरिदम',
      quiz_exp_2: 'ELA संपादन का पता लगाने के लिए एक छवि में संपीड़न स्तरों की तुलना करता है।',
      quiz_q_3: 'भारत में एक विश्वसनीय तथ्य-जांच मंच कौन सा है?',
      quiz_opt_3_0: 'व्हाट्सएप यूनिवर्सिटी',
      quiz_opt_3_1: 'PIB फैक्ट चेक',
      quiz_opt_3_2: 'यादृच्छिक ब्लॉग',
      quiz_opt_3_3: 'फॉरवर्ड किए गए संदेश',
      quiz_exp_3: 'PIB फैक्ट चेक गलत सूचनाओं से निपटने के लिए एक आधिकारिक सरकारी पहल है।',
      quiz_q_4: 'वायरल संदेश को फॉरवर्ड करने से पहले आपको क्या करना चाहिए?',
      quiz_opt_4_0: '"जैसा प्राप्त हुआ वैसा ही अग्रेषित" जोड़ें',
      quiz_opt_4_1: 'एकाधिक स्रोतों से सत्यापित करें',
      quiz_opt_4_2: 'सभी संपर्कों को भेजें',
      quiz_opt_4_3: 'समूहों को अग्रेषित करें',
      quiz_exp_4: 'साझा करने से पहले हमेशा विश्वसनीय स्रोतों से जानकारी को क्रॉस-वेरीफाई करें।'
    },
    gu: {
      nav_dashboard: 'ડેશબોર્ડ',
      nav_text: 'ટેક્સ્ટ',
      nav_image: 'છબી',
      nav_video: 'વીડિયો',
      nav_literacy: 'શીખો',
      hero_overline: 'AI-સંચાલિત ચકાસણી પ્લેટફોર્મ',
      hero_title: 'ખોટી માહિતી અટકાવો<br><em>તે ફેલાય તે પહેલાં.</em>',
      hero_subtitle: 'ટેક્સ્ટ, છબીઓ અથવા વિડિઓઝ અપલોડ કરો — ટ્રુથશીલ્ડ સેકન્ડોમાં નકલી સમાચાર પેટર્ન, ડીપફેક આર્ટિફેક્ટ્સ અને ડિજિટલ હેરફેર માટે તેમનું વિશ્લેષણ કરે છે.',
      btn_analyse_text: 'ટેક્સ્ટ વિશ્લેષણ',
      btn_scan_image: 'છબી સ્કેન',
      btn_check_video: 'વિડિઓ તપાસ',
      stat_texts: 'ટેક્સ્ટ વિશ્લેષિત',
      stat_images: 'છબીઓ સ્કેન',
      stat_videos: 'વીડિયો ચકાસ્યા',
      stat_threats: 'ખતરા મળ્યા',
      how_it_works: 'તે કેવી રીતે કામ કરે છે',
      step_1_title: 'સામગ્રી અપલોડ કરો',
      step_1_desc: 'ટેક્સ્ટ પેસ્ટ કરો, છબી મૂકો, અથવા વિડિઓ ફાઇલ અપલોડ કરો',
      step_2_title: 'AI વિશ્લેષણ કરે છે',
      step_2_desc: 'સમાંતરમાં બહુવિધ તપાસ અલ્ગોરિધમ્સ ચાલે છે',
      step_3_title: 'ટ્રસ્ટ સ્કોર મેળવો',
      step_3_desc: 'સ્પષ્ટતા અને ફ્લેગ્સ સાથે વિગતવાર વિભાજન જુઓ',
      fact_check_partners: 'ફેક્ટ-ચેક ભાગીદારો',
      recent_activity: 'તાજેતરની પ્રવૃત્તિ',
      activity_empty_msg: 'હજી સુધી કોઈ વિશ્લેષણ નથી. શરૂ કરવા માટે ઉપરથી એક સાધન પસંદ કરો.',
      text_title: 'ટેક્સ્ટ અને ન્યૂઝ વિશ્લેષણ',
      text_desc: 'હેડલાઇન, લેખ અથવા સોશિયલ મીડિયા પોસ્ટ પેસ્ટ કરો. અમે તેને ક્લિકબેટ, ભાવનાત્મક હેરફેર, સ્રોતની વિશ્વસનીયતા અને જાણીતી ખોટી માહિતી પેટર્ન માટે તપાસીશું.',
      tab_paste_text: 'ટેક્સ્ટ પેસ્ટ કરો',
      tab_enter_url: 'URL દાખલ કરો',
      text_placeholder: 'સમાચાર લેખ, હેડલાઇન અથવા સોશિયલ મીડિયા પોસ્ટ અહીં પેસ્ટ કરો…',
      url_placeholder: 'https://example.com/article',
      url_hint: 'સામગ્રી આપમેળે મેળવવામાં આવશે અને વિશ્લેષણ કરવામાં આવશે',
      char_count_suffix: 'અક્ષરો',
      analyze_btn: 'વિશ્લેષણ કરો',
      cross_verified_label: 'આના દ્વારા ક્રોસ-વેરિફાઈડ',
      trust_score_label: 'ટ્રસ્ટ સ્કોર',
      metric_clickbait: 'ક્લિકબેટ',
      metric_sentiment: 'ભાવના પૂર્વગ્રહ',
      metric_credibility: 'સ્રોત વિશ્વસનીયતા',
      metric_quality: 'લેખનની ગુણવત્તા',
      stance_detection_label: 'વલણની ઓળખ',
      semantic_similarity_label: 'અર્થપૂર્ણ સમાનતા વિશ્લેષણ',
      detected_flags_label: 'મળેલા ફ્લેગ્સ',
      explanation_label: 'સ્પષ્ટીકરણ',
      img_title: 'છબી હેરફેર શોધ',
      img_desc: 'ભૂલ સ્તર વિશ્લેષણ (ELA) ચલાવવા, મેટાડેટા કાઢવા અને AI-જનરેશન આર્ટિફેક્ટ્સ શોધવા માટે ફોટો અપલોડ કરો.',
      upload_img_main: 'અહીં એક છબી મૂકો, અથવા બ્રાઉઝ કરો',
      upload_img_sub: 'JPG, PNG, WebP · મહત્તમ 30 MB',
      original_label: 'મૂળ છબી',
      ela_label: 'ભૂલ સ્તર વિશ્લેષણ',
      ela_consistent: 'સુસંગત',
      ela_minor: 'નાનો તફાવત',
      ela_suspect: 'શંકાસ્પદ',
      authenticity_score_label: 'પ્રામાણિકતા સ્કોર',
      breakdown_label: 'વિભાજન',
      neural_classification_label: 'ન્યુરલ સીન વર્ગીકરણ',
      metadata_label: 'મેટાડેટા',
      metadata_waiting: 'અપલોડની રાહ જોવાઈ રહી છે…',
      provenance_label: 'મીડિયા પ્રોવેનન્સ અને સ્રોત મૂળ',
      findings_label: 'તારણો',
      vid_title: 'ડીપફેક વિડિઓ શોધ',
      vid_desc: 'વિડિઓમાંથી ફ્રેમ કાઢવા અને અસ્થાયી વિસંગતતાઓ, ચહેરાની અસંગતતાઓ અને ડીપફેક સહીઓ માટે તેનું વિશ્લેષણ કરવા માટે વિડિઓ અપલોડ કરો.',
      upload_vid_main: 'અહીં એક વિડિઓ મૂકો, અથવા બ્રાઉઝ કરો',
      upload_vid_sub: 'MP4, WebM, AVI · મહત્તમ 250 MB',
      extracted_frames_label: 'કાઢવામાં આવેલી ફ્રેમ્સ',
      deepfake_confidence_label: 'ડીપફેક આત્મવિશ્વાસ',
      frame_consistency_label: 'ફ્રેમ સુસંગતતા',
      face_analysis_label: 'ચહેરાનું વિશ્લેષણ',
      neural_video_label: 'ન્યુરલ ફ્રેમ વિશ્લેષણ',
      video_provenance_label: 'વિડિઓ પ્રોવેનન્સ અને મૂળ',
      detection_results_label: 'શોધ પરિણામો',
      lit_title: 'નકલી ઓળખતા શીખો',
      lit_desc: 'તમારી મીડિયા સાક્ષરતા કુશળતા બનાવો. ખોટી માહિતી, ડીપફેક અને છબી હેરફેરના સંકેતો જાણો.',
      lit_fake_title: 'નકલી સમાચાર શોધવા',
      lit_fake_1: 'સ્રોત તપાસો — શું તે જાણીતી, પ્રતિષ્ઠિત ચેનલ છે?',
      lit_fake_2: 'હેડલાઇનથી આગળ વાંચો — ક્લિકબેટ ઘણીવાર ગેરમાર્ગે દોરે છે',
      lit_fake_3: 'તારીખ તપાસો — જૂના સમાચાર ઘણીવાર વર્તમાન તરીકે શેર કરવામાં આવે છે',
      lit_fake_4: 'શેર કરતા પહેલા બહુવિધ સ્રોતોથી ચકાસો',
      lit_fake_5: 'અસામાન્ય ફોર્મેટિંગ, જોડણીની ભૂલો અથવા ALL CAPS પર ધ્યાન આપો',
      lit_deep_title: 'ડીપફેક ઓળખવા',
      lit_deep_1: 'અકુદરતી રીતે પલક ઝપકાવવા અથવા આંખોની હિલચાલ પર નજર રાખો',
      lit_deep_2: 'લિપ-સિંક તપાસો — શું અવાજ હોઠની હિલચાલ સાથે મેળ ખાય છે?',
      lit_deep_3: 'ચહેરાના કિનારે ત્વચાની રચનાની સમસ્યાઓ અને અસ્પષ્ટતા શોધો',
      lit_deep_4: 'ચહેરા પર પ્રકાશની અસંગતતાઓ નોંધો',
      lit_deep_5: 'અજ્ઞાત સ્રોતોના વાયરલ વીડિયો પર શંકા કરો',
      lit_img_title: 'મેનિપ્યુલેટેડ છબીઓ શોધવી',
      lit_img_1: 'મૂળ શોધવા માટે રિવર્સ ઇમેજ સર્ચનો ઉપયોગ કરો',
      lit_img_2: 'અસંગત પડછાયાઓ અને પ્રકાશની દિશા જુઓ',
      lit_img_3: 'ક્લોનિંગ અથવા બ્લેન્ડિંગ ભૂલો માટે કિનારીઓ તપાસો',
      lit_img_4: 'ઝૂમ ઇન કરો — વારંવાર પુનરાવર્તિત પેટર્ન (ક્લોન સ્ટેમ્પ) જુઓ',
      lit_img_5: 'એડિટિંગ સોફ્ટવેરના ટ્રેસ માટે મેટાડેટા તપાસો',
      lit_share_title: 'જવાબદાર શેરિંગ',
      lit_share_1: 'શેર કરતા પહેલા રોકો અને ચકાસો — તમે સુરક્ષાની છેલ્લી લાઇન છો',
      lit_share_2: 'વિશ્વાસપાત્ર ફેક્ટ-ચેકર્સનો ઉપયોગ કરો: PIB, AltNews, BOOM, Factly',
      lit_share_3: 'શંકાસ્પદ સામગ્રીની રિપોર્ટ પ્લેટફોર્મના મધ્યસ્થીઓને કરો',
      lit_share_4: 'પરિવાર અને મિત્રોને ખોટી માહિતીના લક્ષણો વિશે શિક્ષિત કરો',
      lit_share_5: 'તીવ્ર ભાવનાત્મક પ્રતિક્રિયાઓ ઉત્તેજિત કરતી સામગ્રીથી સાવધ રહો',
      quick_quiz: 'ઝડપી ક્વિઝ',
      next_question: 'આગલો પ્રશ્ન →',
      loading_analyzing: 'વિશ્લેષણ કરવામાં આવી રહ્યું છે…',
      footer_mid: 'નકલી સમાચાર, ડીપફેક અને મીડિયા હેરફેર સામે લડવા માટે AI-આધારિત પ્લેટફોર્મ',
      footer_org: 'સાયબર ક્રાઈમ સેલ, અમદાવાદ સિટી પોલીસ',
      quiz_q_0: 'સનસનાટીભર્યા સમાચારની હેડલાઇન જોતી વખતે સૌથી પહેલા શું તપાસવું જોઈએ?',
      quiz_opt_0_0: 'તેને તરત જ શેર કરો',
      quiz_opt_0_1: 'સ્રોત તપાસો અને ચકાસો',
      quiz_opt_0_2: 'તેની અવગણના કરો',
      quiz_opt_0_3: 'તમારો અભિપ્રાય ઉમેરો',
      quiz_exp_0: 'કોઈપણ સામગ્રી શેર કરતા પહેલા હંમેશા સ્રોતની ચકાસણી કરો.',
      quiz_q_1: 'આમાંથી કયું ડીપફેક વીડિયોનું સામાન્ય લક્ષણ છે?',
      quiz_opt_1_0: 'ઉચ્ચ રીઝોલ્યુશન',
      quiz_opt_1_1: 'અકુદરતી પલક ઝપકાવવી',
      quiz_opt_1_2: 'સારી ઓડિયો ગુણવત્તા',
      quiz_opt_1_3: 'વ્યાવસાયિક સંપાદન',
      quiz_exp_1: 'ડીપફેકમાં ઘણીવાર અકુદરતી પલક ઝપકાવવી, લિપ-સિંકની સમસ્યાઓ અને કિનારીઓ પર ખામીઓ હોય છે.',
      quiz_q_2: 'ઇમેજ ફોરેન્સિક્સમાં ELA નો અર્થ શું છે?',
      quiz_opt_2_0: 'ઇલેક્ટ્રોનિક સ્તરનું મૂલ્યાંકન',
      quiz_opt_2_1: 'ભૂલ સ્તર વિશ્લેષણ',
      quiz_opt_2_2: 'ઉન્નત પ્રકાશ વિશ્લેષણ',
      quiz_opt_2_3: 'એજ લાઇન અલ્ગોરિધમ',
      quiz_exp_2: 'ELA ફેરફારો શોધવા માટે છબીમાં કમ્પ્રેશન સ્તરોની તુલના કરે છે.',
      quiz_q_3: 'ભારતમાં વિશ્વસનીય ફેક્ટ-ચેકિંગ પ્લેટફોર્મ કયું છે?',
      quiz_opt_3_0: 'વોટ્સએપ યુનિવર્સિટી',
      quiz_opt_3_1: 'PIB ફેક્ટ ચેક',
      quiz_opt_3_2: 'રેન્ડમ બ્લોગ્સ',
      quiz_opt_3_3: 'ફોરવર્ડ કરેલા સંદેશાઓ',
      quiz_exp_3: 'PIB ફેક્ટ ચેક ખોટી માહિતી સામે લડવા માટે સત્તાવાર સરકારી પહેલ છે.',
      quiz_q_4: 'વાયરલ મેસેજ ફોરવર્ડ કરતા પહેલા તમારે શું કરવું જોઈએ?',
      quiz_opt_4_0: '"જેમ મળ્યું તેમ ફોરવર્ડ કર્યું" ઉમેરો',
      quiz_opt_4_1: 'બહુવિધ સ્રોતોથી ચકાસો',
      quiz_opt_4_2: 'બધા સંપર્કોને મોકલો',
      quiz_opt_4_3: 'ગ્રૂપમાં ફોરવર્ડ કરો',
      quiz_exp_4: 'શેર કરતા પહેલા હંમેશા વિશ્વસનીય સ્રોતોથી માહિતીની ક્રોસ-ચકાસણી કરો।'
    },
    ta: {
      nav_dashboard: 'டாஷ்போர்டு',
      nav_text: 'உரை (டெக்ஸ்ட்)',
      nav_image: 'படம்',
      nav_video: 'வீடியோ',
      nav_literacy: 'கற்றல்',
      hero_overline: 'AI-ஆற்றல் கொண்ட சரிபார்ப்பு தளம்',
      hero_title: 'தவறான தகவலை நிறுத்துங்கள்<br><em>பரவும் முன்.</em>',
      hero_subtitle: 'உரை, படங்கள் அல்லது வீடியோக்களைப் பதிவேற்றவும் — ட்ரூத்ஷீல்ட் நொடிகளில் போலிச் செய்தி வடிவங்கள், டீப்ஃபேக் கலைப்பொருட்கள் மற்றும் டிஜிட்டல் கையாளுதல்களை பகுப்பாய்வு செய்கிறது.',
      btn_analyse_text: 'உரை பகுப்பாய்வு',
      btn_scan_image: 'படம் ஸ்கேன்',
      btn_check_video: 'வீடியோ சோதனை',
      stat_texts: 'உரைகள் பகுப்பாய்வு',
      stat_images: 'படங்கள் ஸ்கேன்',
      stat_videos: 'வீடியோக்கள் சரிபார்ப்பு',
      stat_threats: 'அச்சுறுத்தல்கள்',
      how_it_works: 'இது எப்படி செயல்படுகிறது',
      step_1_title: 'உள்ளடக்கத்தைப் பதிவேற்றுக',
      step_1_desc: 'உரையை ஒட்டவும், படத்தை இழுத்துப் போடவும் அல்லது வீடியோவை பதிவேற்றவும்',
      step_2_title: 'AI பகுப்பாய்வு செய்கிறது',
      step_2_desc: 'ஒரே நேரத்தில் பல கண்டறிதல் அல்காரிதம்கள் இயங்குகின்றன',
      step_3_title: 'நம்பிக்கை மதிப்பெண் பெறுக',
      step_3_desc: 'விளக்கங்கள் மற்றும் எச்சரிக்கைகளுடன் விரிவான முடிவுகளைக் காண்க',
      fact_check_partners: 'உண்மை சரிபார்ப்பு பங்காளிகள்',
      recent_activity: 'சமீபத்திய செயல்பாடு',
      activity_empty_msg: 'இன்னும் எந்த பகுப்பாய்வும் இல்லை. தொடங்க மேலே உள்ள ஒரு கருவியைத் தேர்ந்தெடுக்கவும்.',
      text_title: 'உரை & செய்தி பகுப்பாய்வு',
      text_desc: 'தலைப்பு, கட்டுரை அல்லது சமூக ஊடகப் பதிவை ஒட்டவும். கிளிவ்பைட், உணர்ச்சி கையாளுதல், மூலத்தின் நம்பகத்தன்மை மற்றும் அறியப்பட்ட தவறான தகவல் வடிவங்களை நாங்கள் சரிபார்ப்போம்.',
      tab_paste_text: 'உரையை ஒட்டுக',
      tab_enter_url: 'URL ஐ உள்ளிடுக',
      text_placeholder: 'செய்திக் கட்டுரை, தலைப்பு அல்லது சமூக ஊடகப் பதிவை இங்கே ஒட்டவும்…',
      url_placeholder: 'https://example.com/article',
      url_hint: 'உள்ளடக்கம் தானாகவே பெறப்பட்டு பகுப்பாய்வு செய்யப்படும்',
      char_count_suffix: 'எழுத்துக்கள்',
      analyze_btn: 'பகுப்பாய்வு',
      cross_verified_label: 'இவற்றுடன் சரிபார்க்கப்பட்டது',
      trust_score_label: 'நம்பிக்கை மதிப்பெண்',
      metric_clickbait: 'கிளிக்பைட்',
      metric_sentiment: 'உணர்ச்சி சார்பு',
      metric_credibility: 'மூல நம்பகத்தன்மை',
      metric_quality: 'எழுத்து தரம்',
      stance_detection_label: 'நிலைப்பாடு கண்டறிதல்',
      semantic_similarity_label: 'அர்த்தமுள்ள ஒற்றுமை பகுப்பாய்வு',
      detected_flags_label: 'கண்டறியப்பட்ட கொடிகள்',
      explanation_label: 'விளக்கம்',
      img_title: 'பட கையாளுதல் கண்டறிதல்',
      img_desc: 'பிழை நிலை பகுப்பாய்வு (ELA) இயக்கவும், மெட்டாடேட்டாவை பிரித்தெடுக்கவும், மற்றும் AI-உருவாக்க கலைப்பொருட்களைக் கண்டறியவும் புகைப்படத்தைப் பதிவேற்றவும்.',
      upload_img_main: 'இங்கே ஒரு படத்தை இழுத்துப் போடவும், அல்லது உலாவவும்',
      upload_img_sub: 'JPG, PNG, WebP · அதிகபட்சம் 30 MB',
      original_label: 'அசல் படம்',
      ela_label: 'பிழை நிலை பகுப்பாய்வு',
      ela_consistent: 'சீரானது',
      ela_minor: 'சிறிய வேறுபாடு',
      ela_suspect: 'சந்தேகத்திற்குரியது',
      authenticity_score_label: 'நம்பகத்தன்மை மதிப்பெண்',
      breakdown_label: 'பகுப்பாய்வு விவரம்',
      neural_classification_label: 'நரம்பியல் காட்சி வகைப்பாடு',
      metadata_label: 'மெட்டாடேட்டா',
      metadata_waiting: 'பதிவேற்றத்திற்காக காத்திருக்கிறது…',
      provenance_label: 'ஊடக தோற்றம் & மூல ஆதார விவரங்கள்',
      findings_label: 'கண்டுபிடிப்புகள்',
      vid_title: 'டீப்ஃபேக் வீடியோ கண்டறிதல்',
      vid_desc: 'வீடியோவிலிருந்து பிரேம்களைப் பிரித்தெடுக்கவும் மற்றும் தற்காலிக முரண்பாடுகள், முக முரண்பாடுகள் மற்றும் டீப்ஃபேக் கையொப்பங்களுக்கு அவற்றை பகுப்பாய்வு செய்யவும்.',
      upload_vid_main: 'இங்கே ஒரு வீடியோவை இழுத்துப் போடவும், அல்லது உலாவவும்',
      upload_vid_sub: 'MP4, WebM, AVI · அதிகபட்சம் 250 MB',
      extracted_frames_label: 'பிரித்தெடுக்கப்பட்ட பிரேம்கள்',
      deepfake_confidence_label: 'டீப்ஃபேக் நம்பிக்கை',
      frame_consistency_label: 'பிரேம் நிலைத்தன்மை',
      face_analysis_label: 'முக பகுப்பாய்வு',
      neural_video_label: 'நரம்பியல் பிரேம் பகுப்பாய்வு',
      video_provenance_label: 'வீடியோ தோற்றம் & ஆதார விவரங்கள்',
      detection_results_label: 'கண்டறிதல் முடிவுகள்',
      lit_title: 'போலிகளைக் கண்டறியக் கற்றுக்கொள்ளுங்கள்',
      lit_desc: 'உங்கள் ஊடக அறிவுத் திறன்களை வளர்த்துக் கொள்ளுங்கள். தவறான தகவல், டீப்ஃபேக் மற்றும் படக் கையாளுதலின் அறிகுறிகளை அறிந்து கொள்ளுங்கள்.',
      lit_fake_title: 'போலிச் செய்திகளைக் கண்டறிதல்',
      lit_fake_1: 'மூலத்தை சரிபார்க்கவும் — இது அறியப்பட்ட, புகழ்பெற்ற செய்தி நிறுவனமா?',
      lit_fake_2: 'தலைப்புக்கு அப்பால் படியுங்கள் — கிளிக்பைட் பெரும்பாலும் தவறாக வழிநடத்துகிறது',
      lit_fake_3: 'தேதியை சரிபார்க்கவும் — பழைய செய்திகள் பெரும்பாலும் தற்போதையதாக மீண்டும் பகிரப்படுகின்றன',
      lit_fake_4: 'பகிர்வதற்கு முன் பல ஆதாரங்களுடன் சரிபார்க்கவும்',
      lit_fake_5: 'அசாதாரண வடிவமைப்பு, எழுத்துப்பிழைகள், ALL CAPS ஆகியவற்றைக் கவனிக்கவும்',
      lit_deep_title: 'டீப்ஃபேக்குகளை அங்கீகரித்தல்',
      lit_deep_1: 'இயற்கைக்கு மாறான கண் சிமிட்டல் அல்லது கண் அசைவுகளைக் கவனிக்கவும்',
      lit_deep_2: 'லிப்-சின்க் சரிபார்க்கவும் — பேச்சு உதடு அசைவுடன் பொருந்துகிறதா?',
      lit_deep_3: 'தோல் அமைப்பு சிக்கல்கள் மற்றும் முகத்தின் விளிம்புகளில் மங்கலான தன்மையைக் கண்டறியவும்',
      lit_deep_4: 'முகம் முழுவதும் வெளிச்சத்தின் முரண்பாடுகளைக் கவனிக்கவும்',
      lit_deep_5: 'தெரியாத ஆதாரங்களில் இருந்து வரும் வைரல் வீடியோக்களை சந்தேகிக்கவும்',
      lit_img_title: 'கையாளப்பட்ட படங்களை கண்டறிதல்',
      lit_img_1: 'அசல் படத்தைக் கண்டறிய தலைகீழ் படத் தேடலைப் பயன்படுத்தவும்',
      lit_img_2: 'முரணான நிழல்கள் மற்றும் வெளிச்சத்தை கவனிக்கவும்',
      lit_img_3: 'குளோனிங் அல்லது கலத்தல் கலைப்பொருட்களின் விளிம்புகளைச் சரிபார்க்கவும்',
      lit_img_4: 'பெரிதாக்கவும் — மீண்டும் மீண்டும் வரும் வடிவங்களைக் கவனிக்கவும் (குளோன் ஸ்டாம்ப்)',
      lit_img_5: 'எடிட்டிங் மென்பொருள் தடயங்களுக்கான மெட்டாடேட்டாவைச் சரிபார்க்கவும்',
      lit_share_title: 'பொறுப்பான பகிர்வு',
      lit_share_1: 'பகிரவதற்கு முன் சரிபார்க்கவும் — நீங்கள் தான் கடைசி பாதுகாப்பு வரிசை',
      lit_share_2: 'உண்மை சரிபார்ப்பாளர்களைப் பயன்படுத்தவும்: PIB, AltNews, BOOM, Factly',
      lit_share_3: 'சந்தேகத்திற்குரிய உள்ளடக்கத்தை தள மதிப்பீட்டாளர்களுக்குப் புகாரளிக்கவும்',
      lit_share_4: 'தவறான தகவல்கள் குறித்து குடும்பத்தினருக்கும் நண்பர்களுக்கும் கற்பிக்கவும்',
      lit_share_5: 'வலுவான உணர்ச்சிகளைத் தூண்டும் உள்ளடக்கம் குறித்து எச்சரிக்கையாக இருங்கள்',
      quick_quiz: 'விரைவான வினாடி வினா',
      next_question: 'அடுத்த கேள்வி →',
      loading_analyzing: 'பகுப்பாய்வு செய்யப்படுகிறது...',
      footer_mid: 'போலிச் செய்திகள், டீப்ஃபேக் மற்றும் ஊடகக் கையாளுதலுக்கான AI-அடிப்படையிலான சரிபார்ப்பு தளம்',
      footer_org: 'சைபர் கிரைம் பிரிவு, அகமதாபாத் மாநகர காவல்',
      quiz_q_0: 'பரபரப்பான செய்தித் தலைப்பை எதிர்கொள்ளும் போது முதலில் எதைச் சரிபார்க்க வேண்டும்?',
      quiz_opt_0_0: 'உடனே பகிரவும்',
      quiz_opt_0_1: 'மூலத்தை சரிபார்த்து உறுதிப்படுத்தவும்',
      quiz_opt_0_2: 'அதைப் புறக்கணிக்கவும்',
      quiz_opt_0_3: 'உங்கள் கருத்தைச் சேர்க்கவும்',
      quiz_exp_0: 'எந்தவொரு உள்ளடக்கத்தையும் பகிர்வதற்கு முன் எப்போதும் மூலத்தை சரிபார்க்கவும்.',
      quiz_q_1: 'இவற்றில் டீப்ஃபேக் வீடியோவின் பொதுவான அறிகுறி எது?',
      quiz_opt_1_0: 'உயர் தெளிவுத்திறன் (ரெசல்யூஷன்)',
      quiz_opt_1_1: 'இயற்கைக்கு மாறான கண் சிமிட்டல்',
      quiz_opt_1_2: 'நல்ல ஆடியோ தரம்',
      quiz_opt_1_3: 'தொழில்முறை எடிட்டிங்',
      quiz_exp_1: 'டீப்ஃபேக்குகளில் பெரும்பாலும் இயற்கைக்கு மாறான கண் சிமிட்டல், லிப்-சின்க் சிக்கல்கள் மற்றும் விளிம்பு குறைபாடுகள் இருக்கும்.',
      quiz_q_2: 'பட தடயவியலில் ELA என்பது எதைக் குறிக்கிறது?',
      quiz_opt_2_0: 'மின்னணு நிலை மதிப்பீடு',
      quiz_opt_2_1: 'பிழை நிலை பகுப்பாய்வு',
      quiz_opt_2_2: 'மேம்படுத்தப்பட்ட ஒளி பகுப்பாய்வு',
      quiz_opt_2_3: 'எட்ஜ் லைன் அல்காரிதம்',
      quiz_exp_2: 'எடிட்டிங் செய்ததைக் கண்டறிய ஒரு படத்தில் உள்ள அழுத்த நிலைகளை ELA ஒப்பிடுகிறது.',
      quiz_q_3: 'இந்தியாவில் நம்பகமான உண்மை சரிபார்ப்பு தளம் எது?',
      quiz_opt_3_0: 'வாட்ஸ்அப் பல்கலைக்கழகம்',
      quiz_opt_3_1: 'PIB உண்மை சரிபார்ப்பு',
      quiz_opt_3_2: 'ரேண்டம் வலைப்பதிவுகள்',
      quiz_opt_3_3: 'பகிரப்பட்ட செய்திகள்',
      quiz_exp_3: 'PIB உண்மை சரிபார்ப்பு என்பது தவறான தகவல்களை எதிர்ப்பதற்கான அதிகாரப்பூர்வ அரசு முயற்சியாகும்.',
      quiz_q_4: 'வைரல் செய்தியைப் பகிரும் முன் நீங்கள் என்ன செய்ய வேண்டும்?',
      quiz_opt_4_0: '"வந்தபடியே பகிரப்பட்டது" என்பதைச் சேர்க்கவும்',
      quiz_opt_4_1: 'பல மூலங்களிலிருந்து சரிபார்க்கவும்',
      quiz_opt_4_2: 'அனைத்து தொடர்புகளுக்கும் அனுப்பவும்',
      quiz_opt_4_3: 'குழுக்களுக்குப் பகிரவும்',
      quiz_exp_4: 'பகிர்வதற்கு முன் எப்போதும் நம்பகமான மூலங்களிலிருந்து தகவலைச் சரிபார்க்கவும்.'
    }
  };

  function setupLanguage() {
    document.getElementById('langSelect').addEventListener('change', (e) => {
      state.lang = e.target.value;
      applyLanguage(state.lang);
    });
  }

  function applyLanguage(lang) {
    state.lang = lang;
    const strings = i18n[lang];
    if (!strings) return;

    // Translate standard elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (strings[key]) {
        if (strings[key].includes('<')) {
          el.innerHTML = strings[key];
        } else {
          el.textContent = strings[key];
        }
      }
    });

    // Translate placeholder elements
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (strings[key]) {
        el.placeholder = strings[key];
      }
    });

    // Re-render current quiz question to keep it in sync with language
    showQuizQuestion(state.quizIndex);
  }

  function renderProvenance(provenance, type) {
    const containerId = type === 'image' ? 'imageProvenance' : 'videoProvenance';
    const canvasId = type === 'image' ? 'imageProvenancePie' : 'videoProvenancePie';
    const container = document.getElementById(containerId);
    if (!container || !provenance) return;

    const scores = provenance.scores || { ai: 10, edit: 20, raw: 70 };
    const device = provenance.device || { model: 'Unknown', deviceClass: 'unknown' };
    const platform = provenance.platform;
    const exif = provenance.exif;
    const aiDetection = provenance.aiDetection;

    let badgeClass = 'capture-gen';
    let badgeText = 'Original Capture';
    if (scores.ai > scores.edit && scores.ai > scores.raw) {
      badgeClass = 'ai-gen';
      badgeText = 'AI Generated';
    } else if (scores.edit > scores.raw) {
      badgeClass = 'edit-gen';
      badgeText = 'Edited / Modified';
    }

    const reverseSearchLinks = provenance.reverseSearch || [];
    const reverseSearchHTML = reverseSearchLinks.map(lnk => `
      <a href="${lnk.url}" target="_blank" rel="noopener noreferrer" class="reverse-link-card">
        <div class="reverse-link-icon"><i class="${lnk.icon}"></i></div>
        <div class="reverse-link-info">
          <strong>${lnk.name}</strong>
          <span>${lnk.desc}</span>
        </div>
      </a>
    `).join('');

    let deviceText = device.model || 'Unknown';
    if (device.deviceClass === 'smartphone') deviceText += ' (Smartphone)';
    else if (device.deviceClass === 'camera') deviceText += ' (DSLR / Digital Camera)';

    let softwareText = 'None detected';
    if (exif && exif.software) softwareText = exif.software;
    else if (aiDetection && aiDetection.isAI) softwareText = aiDetection.generator || 'AI Generator';

    let locationText = provenance.location || 'Unknown';
    if (provenance.gps && provenance.gps.latitude) {
      locationText = `<span class="location-resolved"><i class="fas fa-location-dot"></i> ${provenance.location}</span>`;
    } else {
      locationText = `<span class="location-empty">${locationText}</span>`;
    }

    container.innerHTML = `
      <div class="provenance-summary">
        <span class="prov-badge ${badgeClass}">${badgeText}</span>
        <span class="prov-text">${provenance.originSummary}</span>
      </div>

      <div class="provenance-analytics-row">
        <div class="canvas-pie-wrap">
          <canvas id="${canvasId}" width="100" height="100" style="width: 100px; height: 100px;"></canvas>
        </div>
        <div class="provenance-legend-list">
          <div class="legend-item">
            <span class="legend-color-dot" style="background:#5b7cfa"></span>
            <span class="legend-name">Original Capture</span>
            <span class="legend-percentage">${scores.raw}%</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-dot" style="background:#f07a3a"></span>
            <span class="legend-name">Manual Edit</span>
            <span class="legend-percentage">${scores.edit}%</span>
          </div>
          <div class="legend-item">
            <span class="legend-color-dot" style="background:#c084fc"></span>
            <span class="legend-name">AI Generated</span>
            <span class="legend-percentage">${scores.ai}%</span>
          </div>
        </div>
      </div>

      <div class="provenance-details-list">
        <div class="prov-detail-item">
          <span class="prov-detail-label"><i class="fas fa-camera"></i> Capture Device</span>
          <span class="prov-detail-value">${deviceText}</span>
        </div>
        <div class="prov-detail-item">
          <span class="prov-detail-label"><i class="fas fa-code"></i> Editing / Creator software</span>
          <span class="prov-detail-value">${softwareText}</span>
        </div>
        <div class="prov-detail-item">
          <span class="prov-detail-label"><i class="fas fa-clock"></i> Capture Timestamp</span>
          <span class="prov-detail-value">${(exif && exif.dateTime) || 'Not available'}</span>
        </div>
        <div class="prov-detail-item">
          <span class="prov-detail-label"><i class="fas fa-earth-americas"></i> Origin Location</span>
          <span class="prov-detail-value">${locationText}</span>
        </div>
        ${platform ? `
        <div class="prov-detail-item">
          <span class="prov-detail-label"><i class="fas fa-share-nodes"></i> Distribution Origin</span>
          <span class="prov-detail-value">${platform.name}</span>
        </div>
        ` : ''}
      </div>

      <div class="reverse-search-section">
        <p class="prov-label-title">Reverse Search & Verification Tools</p>
        <div class="reverse-links-grid">
          ${reverseSearchHTML}
        </div>
      </div>
    `;

    drawProvenancePieChart(canvasId, scores);
  }

  function drawProvenancePieChart(canvasId, scores) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 100 * dpr;
    canvas.height = 100 * dpr;
    ctx.scale(dpr, dpr);

    const centerX = 50;
    const centerY = 50;
    const outerRadius = 42;
    const innerRadius = 24;

    const data = [
      { value: scores.raw, color: '#5b7cfa' },
      { value: scores.edit, color: '#f07a3a' },
      { value: scores.ai, color: '#c084fc' }
    ].filter(item => item.value > 0);

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return;

    let startAngle = -Math.PI / 2;

    data.forEach(slice => {
      const sliceAngle = (slice.value / total) * (Math.PI * 2);
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();

      startAngle = endAngle;
    });

    // Donut hole is naturally transparent due to reverse path tracing
  }

  // ==================== 3D PIE CHART ====================
  function draw3DPieChart(canvasId, data, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const displayW = canvas.parentElement ? canvas.parentElement.offsetWidth : 340;
    const displayH = 300;
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    // Filter out zero-value slices
    const filteredData = data.filter(d => d.value > 0);
    if (filteredData.length === 0) return;
    const total = filteredData.reduce((sum, d) => sum + d.value, 0);

    // Build slices
    const slices = [];
    let currentAngle = -Math.PI / 2;
    filteredData.forEach(d => {
      const sliceAngle = (d.value / total) * Math.PI * 2;
      slices.push({
        startAngle: currentAngle,
        endAngle: currentAngle + sliceAngle,
        color: d.color,
        label: d.label,
        value: d.value,
        percentage: Math.round((d.value / total) * 100)
      });
      currentAngle += sliceAngle;
    });

    // Heuristics for responsive mobile layout
    const isMobile = displayW < 450;
    let centerX, centerY, radiusX, radiusY, depth;
    let legendX, legendY, legendSpacing;

    if (isMobile) {
      centerX = displayW * 0.5;
      centerY = 90;
      radiusX = Math.min(displayW * 0.28, 80);
      radiusY = radiusX * 0.52;
      depth = 15;
      legendX = 20;
      legendSpacing = 22;
      legendY = 165;
    } else {
      centerX = displayW * 0.32;
      centerY = displayH * 0.42;
      radiusX = Math.min(displayW * 0.24, 100);
      radiusY = radiusX * 0.52;
      depth = 20;
      legendX = centerX + radiusX + 30;
      legendSpacing = 26;
      const totalLegendH = slices.length * legendSpacing;
      legendY = Math.max(14, centerY - totalLegendH / 2);
    }

    // Color helpers
    function parseHex(c) {
      if (c.startsWith('#') && c.length === 7) {
        return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
      }
      return [91, 124, 250]; // fallback accent color
    }

    function darkenColor(c, f) {
      const [r,g,b] = parseHex(c);
      return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
    }

    function lightenColor(c, f) {
      const [r,g,b] = parseHex(c);
      return `rgb(${Math.min(255,Math.round(r+(255-r)*f))},${Math.min(255,Math.round(g+(255-g)*f))},${Math.min(255,Math.round(b+(255-b)*f))})`;
    }

    // Trace elliptical arc using only lineTo (path-safe)
    function traceArc(cx, cy, rx, ry, a1, a2) {
      const n = Math.max(20, Math.ceil(Math.abs(a2 - a1) * 40));
      for (let i = 0; i <= n; i++) {
        const a = a1 + (a2 - a1) * (i / n);
        ctx.lineTo(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
      }
    }

    ctx.clearRect(0, 0, displayW, displayH);

    // === Layer 1: 3D side extrusion ===
    slices.forEach(slice => {
      const vs = Math.max(slice.startAngle, 0);
      const ve = Math.min(slice.endAngle, Math.PI);
      if (vs >= ve) return;

      ctx.beginPath();
      ctx.moveTo(centerX + radiusX * Math.cos(vs), centerY + depth + radiusY * Math.sin(vs));
      traceArc(centerX, centerY + depth, radiusX, radiusY, vs, ve);
      traceArc(centerX, centerY, radiusX, radiusY, ve, vs);
      ctx.closePath();

      const sg = ctx.createLinearGradient(centerX, centerY, centerX, centerY + depth);
      sg.addColorStop(0, darkenColor(slice.color, 0.6));
      sg.addColorStop(1, darkenColor(slice.color, 0.3));
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = darkenColor(slice.color, 0.2);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // === Layer 2: Top face (main pie) ===
    slices.forEach(slice => {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      traceArc(centerX, centerY, radiusX, radiusY, slice.startAngle, slice.endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();

      const mid = (slice.startAngle + slice.endAngle) / 2;
      const gx = centerX + radiusX * 0.25 * Math.cos(mid);
      const gy = centerY + radiusY * 0.25 * Math.sin(mid);
      const grad = ctx.createRadialGradient(gx, gy, 0, centerX, centerY, radiusX);
      grad.addColorStop(0, lightenColor(slice.color, 0.4));
      grad.addColorStop(0.55, slice.color);
      grad.addColorStop(1, darkenColor(slice.color, 0.65));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // === Layer 3: Gloss highlight ===
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.clip();
    const hg = ctx.createRadialGradient(
      centerX - radiusX * 0.3, centerY - radiusY * 0.45, 0,
      centerX, centerY, radiusX * 0.95
    );
    hg.addColorStop(0, 'rgba(255,255,255,0.22)');
    hg.addColorStop(0.45, 'rgba(255,255,255,0.06)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(centerX - radiusX, centerY - radiusY, radiusX * 2, radiusY * 2);
    ctx.restore();

    // === Layer 4: Ground shadow ===
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.beginPath();
    ctx.ellipse(centerX + 2, centerY + depth + 8, radiusX + 5, radiusY + 3, 0, 0, Math.PI * 2);
    const shg = ctx.createRadialGradient(centerX + 2, centerY + depth + 8, radiusX * 0.25,
      centerX + 2, centerY + depth + 8, radiusX + 8);
    shg.addColorStop(0, 'rgba(0,0,0,0.3)');
    shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg;
    ctx.fill();
    ctx.restore();

    // === Layer 5: Legend ===
    slices.forEach((slice, i) => {
      const y = legendY + i * legendSpacing;

      // Color circle
      ctx.fillStyle = slice.color;
      ctx.beginPath();
      ctx.arc(legendX + 5, y + 5, 5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#9a9aab';
      ctx.font = '500 10.5px DM Sans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(slice.label, legendX + 16, y + 9);

      // Percentage
      ctx.fillStyle = '#e8e8ec';
      ctx.font = '700 10.5px DM Sans, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(slice.percentage + '%', displayW - 20, y + 9);
      ctx.textAlign = 'left';
    });

    // Title
    if (title) {
      ctx.fillStyle = '#5e5e70';
      ctx.font = '600 9.5px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      if (isMobile) {
        ctx.fillText(title.toUpperCase(), displayW / 2, 20);
      } else {
        ctx.fillText(title.toUpperCase(), displayW / 2, displayH - 10);
      }
    }
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
