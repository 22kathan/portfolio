/**
 * TruthShield NLP Engine
 * Stance Detection & Semantic Similarity for misinformation analysis
 */
class NLPEngine {
  constructor() {
    this.stopwords = new Set([
      'a','an','the','is','are','was','were','be','been','being','have','has','had',
      'do','does','did','will','would','could','should','may','might','shall','can',
      'i','you','he','she','it','we','they','me','him','her','us','them','my','your',
      'his','its','our','their','this','that','these','those','and','but','or','nor',
      'for','yet','so','in','on','at','to','of','by','from','with','as','into','about',
      'up','out','off','over','after','before','between','under','above','below','not',
      'no','very','just','also','than','then','now','here','there','when','where','how',
      'all','each','every','both','few','more','most','some','any','other','such','only'
    ]);

    // ── Stance detection lexicons ──
    this.assertionMarkers = [
      'confirmed','proven','definitely','certainly','absolutely','clearly','obviously',
      'undoubtedly','fact','evidence shows','studies show','research proves','100%',
      'without doubt','guaranteed','exposed','exposed the truth','exposed the lie',
      'exposed the fraud','truth is','fact is','reality is','make no mistake'
    ];

    this.hedgingMarkers = [
      'allegedly','reportedly','supposedly','claimed','may','might','could',
      'possibly','perhaps','it seems','appears to','is believed','according to some',
      'sources say','unconfirmed','rumored','speculated','it is said','uncertain',
      'unclear','debatable','questionable','remains to be seen'
    ];

    this.negationMarkers = [
      'not true','false','fake','hoax','debunked','disproven','misleading',
      'incorrect','wrong','lie','fabricated','baseless','unfounded','myth',
      'no evidence','never happened','did not','was not','is not','are not',
      'deny','denied','refuted','contradicted','rejected'
    ];

    this.questionMarkers = [
      'is it true','did this really','can we verify','fact check','has anyone confirmed',
      'is there evidence','source?','proof?','verified?','real or fake','true or false'
    ];

    this.attributionMarkers = [
      'according to','as reported by','as stated by','sources say','officials say',
      'experts say','scientists say','researchers found','data shows','survey reveals',
      'study finds','report indicates','analysis shows','evidence suggests'
    ];

    // ── Known misinformation patterns database ──
    this.misinfoDB = [
      // Health misinformation
      { id: 'health_01', category: 'Health', text: 'vaccines cause autism and are dangerous for children government conspiracy to inject tracking chips', keywords: ['vaccine','autism','dangerous','chips','tracking','inject'] },
      { id: 'health_02', category: 'Health', text: 'drinking hot water with lemon cures covid coronavirus home remedy miracle cure proven', keywords: ['hot water','lemon','cure','covid','remedy','miracle'] },
      { id: 'health_03', category: 'Health', text: '5g towers cause coronavirus spread radiation dangerous health effects cancer causing signals', keywords: ['5g','towers','coronavirus','radiation','cancer','signals'] },
      { id: 'health_04', category: 'Health', text: 'cow urine gomutra cures all diseases cancer aids covid natural medicine ancient remedy', keywords: ['cow urine','gomutra','cure','cancer','aids','natural'] },
      { id: 'health_05', category: 'Health', text: 'garlic ginger turmeric ayurvedic cure covid kills virus instantly proven home remedy', keywords: ['garlic','ginger','turmeric','cure','virus','instantly'] },

      // Political misinformation
      { id: 'pol_01', category: 'Political', text: 'election was rigged stolen votes fraud ballot stuffing machines hacked rigging evidence', keywords: ['election','rigged','stolen','fraud','ballot','hacked'] },
      { id: 'pol_02', category: 'Political', text: 'government secretly planning to ban religion religious persecution conspiracy hidden agenda', keywords: ['government','ban','religion','persecution','conspiracy','agenda'] },
      { id: 'pol_03', category: 'Political', text: 'opposition party funded by foreign countries anti national traitor sell country pakistan china', keywords: ['opposition','foreign','anti national','traitor','pakistan','china'] },
      { id: 'pol_04', category: 'Political', text: 'new law will take away your rights freedom speech banned censorship dictatorship martial law', keywords: ['law','rights','freedom','banned','censorship','dictatorship'] },

      // Social/communal misinformation
      { id: 'soc_01', category: 'Communal', text: 'love jihad kidnapping forced conversion religious war community attack targeted specific religion', keywords: ['love jihad','kidnapping','conversion','attack','targeted','religion'] },
      { id: 'soc_02', category: 'Communal', text: 'child kidnapper gang active in city stealing children organ harvesting trafficking beware forward', keywords: ['child','kidnapper','stealing','organ','trafficking','forward'] },
      { id: 'soc_03', category: 'Communal', text: 'specific community spreading disease contaminating food poisoning water supply deliberate attack', keywords: ['community','disease','contaminating','food','poisoning','water'] },

      // Financial scams
      { id: 'fin_01', category: 'Financial', text: 'government giving free money scheme apply now limited time offer bank account details required', keywords: ['free money','scheme','apply','limited','bank','details'] },
      { id: 'fin_02', category: 'Financial', text: 'whatsapp lottery winner congratulations click link claim prize million dollars reward', keywords: ['lottery','winner','click','claim','prize','million'] },
      { id: 'fin_03', category: 'Financial', text: 'rbi reserve bank announcing new currency notes old notes banned demonetisation exchange deadline', keywords: ['rbi','currency','notes','banned','demonetisation','deadline'] },

      // Disaster/panic
      { id: 'dis_01', category: 'Panic', text: 'earthquake tsunami warning major disaster predicted city will be destroyed evacuate immediately', keywords: ['earthquake','tsunami','disaster','predicted','destroyed','evacuate'] },
      { id: 'dis_02', category: 'Panic', text: 'terrorist attack planned specific city bomb threat alert police confirmed forward immediately', keywords: ['terrorist','attack','bomb','threat','alert','forward'] },
      { id: 'dis_03', category: 'Panic', text: 'water supply contaminated poisoned do not drink tap water dangerous chemical alert emergency', keywords: ['water','contaminated','poisoned','drink','chemical','emergency'] }
    ];

    // Pre-compute TF vectors for misinfo database
    this._precomputeVectors();
  }

  // ══════════════════════════════════════
  //  TEXT PREPROCESSING
  // ══════════════════════════════════════

  /** Tokenize, lowercase, remove stopwords, stem basic suffixes */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !this.stopwords.has(w))
      .map(w => this._stem(w));
  }

  /** Basic Porter-style suffix stripping */
  _stem(word) {
    if (word.length < 5) return word;
    return word
      .replace(/ing$/, '')
      .replace(/tion$/, 't')
      .replace(/ness$/, '')
      .replace(/ment$/, '')
      .replace(/ful$/, '')
      .replace(/ous$/, '')
      .replace(/ive$/, '')
      .replace(/able$/, '')
      .replace(/ible$/, '')
      .replace(/ies$/, 'y')
      .replace(/es$/, '')
      .replace(/ed$/, '')
      .replace(/ly$/, '')
      .replace(/s$/, '');
  }

  // ══════════════════════════════════════
  //  TF-IDF & COSINE SIMILARITY
  // ══════════════════════════════════════

  /** Build term-frequency map from tokens */
  _tf(tokens) {
    const freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    const len = tokens.length || 1;
    Object.keys(freq).forEach(t => { freq[t] /= len; });
    return freq;
  }

  /** Pre-compute TF vectors for the misinformation database */
  _precomputeVectors() {
    // Build document frequency across corpus
    this._df = {};
    this._dbVectors = [];

    const allTokenSets = this.misinfoDB.map(entry => {
      const tokens = this.tokenize(entry.text);
      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(t => { this._df[t] = (this._df[t] || 0) + 1; });
      return { tokens, tf: this._tf(tokens), entry };
    });

    const N = this.misinfoDB.length;

    // Compute TF-IDF vectors
    allTokenSets.forEach(({ tf, entry }) => {
      const tfidf = {};
      Object.keys(tf).forEach(term => {
        const idf = Math.log((N + 1) / (1 + (this._df[term] || 0)));
        tfidf[term] = tf[term] * idf;
      });
      this._dbVectors.push({ vector: tfidf, entry });
    });
  }

  /** Compute TF-IDF vector for input text using the corpus IDF */
  _textToVector(text) {
    const tokens = this.tokenize(text);
    const tf = this._tf(tokens);
    const N = this.misinfoDB.length;
    const tfidf = {};
    Object.keys(tf).forEach(term => {
      const idf = Math.log((N + 1) / (1 + (this._df[term] || 0)));
      tfidf[term] = tf[term] * idf;
    });
    return tfidf;
  }

  /** Cosine similarity between two sparse vectors */
  _cosineSimilarity(vecA, vecB) {
    const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dot = 0, magA = 0, magB = 0;

    allKeys.forEach(key => {
      const a = vecA[key] || 0;
      const b = vecB[key] || 0;
      dot += a * b;
      magA += a * a;
      magB += b * b;
    });

    const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
    return magnitude === 0 ? 0 : dot / magnitude;
  }

  // ══════════════════════════════════════
  //  SEMANTIC SIMILARITY ANALYSIS
  // ══════════════════════════════════════

  /**
   * Compare input text against known misinformation database
   * Returns top matches with similarity scores
   */
  analyzeSimilarity(text) {
    const inputVector = this._textToVector(text);
    const inputTokens = new Set(this.tokenize(text));

    const matches = this._dbVectors.map(({ vector, entry }) => {
      // TF-IDF cosine similarity
      const cosineSim = this._cosineSimilarity(inputVector, vector);

      // Keyword overlap boost (Jaccard-like)
      const keywordHits = entry.keywords.filter(kw =>
        text.toLowerCase().includes(kw.toLowerCase())
      );
      const keywordScore = keywordHits.length / entry.keywords.length;

      // Combined score: weighted blend of cosine + keyword overlap
      const combined = (cosineSim * 0.6) + (keywordScore * 0.4);

      return {
        id: entry.id,
        category: entry.category,
        similarity: Math.round(combined * 100),
        cosineSim: Math.round(cosineSim * 100),
        keywordMatch: Math.round(keywordScore * 100),
        matchedKeywords: keywordHits,
        pattern: entry.text.substring(0, 80) + '…'
      };
    })
    .filter(m => m.similarity > 8) // Only meaningful matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5); // Top 5 matches

    const topScore = matches.length > 0 ? matches[0].similarity : 0;

    let riskLevel, riskLabel;
    if (topScore >= 60) { riskLevel = 'high'; riskLabel = 'High similarity to known misinformation'; }
    else if (topScore >= 35) { riskLevel = 'medium'; riskLabel = 'Moderate similarity to known patterns'; }
    else if (topScore >= 15) { riskLevel = 'low'; riskLabel = 'Low similarity — some shared terms'; }
    else { riskLevel = 'none'; riskLabel = 'No significant match to known misinformation'; }

    return { topScore, riskLevel, riskLabel, matches };
  }

  // ══════════════════════════════════════
  //  STANCE DETECTION
  // ══════════════════════════════════════

  /**
   * Detect the communicative stance of the text
   * Returns stance classification with confidence and evidence
   */
  detectStance(text) {
    const lower = text.toLowerCase();
    const evidence = [];

    // Count marker hits in each category
    const scores = {
      asserting: 0,
      hedging: 0,
      denying: 0,
      questioning: 0,
      attributing: 0
    };

    // Assertion markers
    this.assertionMarkers.forEach(m => {
      if (lower.includes(m)) { scores.asserting += 2; evidence.push({ type: 'assertion', marker: m }); }
    });

    // Hedging markers
    this.hedgingMarkers.forEach(m => {
      if (lower.includes(m)) { scores.hedging += 2; evidence.push({ type: 'hedging', marker: m }); }
    });

    // Negation/denial markers
    this.negationMarkers.forEach(m => {
      if (lower.includes(m)) { scores.denying += 2; evidence.push({ type: 'denial', marker: m }); }
    });

    // Question markers
    this.questionMarkers.forEach(m => {
      if (lower.includes(m)) { scores.questioning += 2; evidence.push({ type: 'question', marker: m }); }
    });

    // Attribution markers
    this.attributionMarkers.forEach(m => {
      if (lower.includes(m)) { scores.attributing += 2; evidence.push({ type: 'attribution', marker: m }); }
    });

    // ── Linguistic feature analysis ──

    // Exclamatory = more assertive/emotional
    const exclCount = (text.match(/!/g) || []).length;
    if (exclCount >= 3) { scores.asserting += 2; evidence.push({ type: 'assertion', marker: `${exclCount} exclamation marks — emphatic tone` }); }

    // Question marks = questioning stance
    const questCount = (text.match(/\?/g) || []).length;
    if (questCount >= 1) { scores.questioning += 1; }
    if (questCount >= 3) { scores.questioning += 2; evidence.push({ type: 'question', marker: `${questCount} question marks` }); }

    // ALL CAPS words = strong assertion
    const words = text.split(/\s+/);
    const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
    if (capsWords.length >= 2) {
      scores.asserting += 1;
      evidence.push({ type: 'assertion', marker: `ALL CAPS words: ${capsWords.slice(0, 3).join(', ')}` });
    }

    // Imperative verbs (share, forward, spread, read)
    if (/\b(share|forward|spread|tell everyone|must read|wake up|open your eyes)\b/i.test(text)) {
      scores.asserting += 2;
      evidence.push({ type: 'assertion', marker: 'Contains imperative call-to-action' });
    }

    // Conditional language
    if (/\b(if true|if this is real|if confirmed|assuming|in case)\b/i.test(text)) {
      scores.hedging += 1;
      evidence.push({ type: 'hedging', marker: 'Conditional language detected' });
    }

    // Quotation marks suggest attribution
    const quoteCount = (text.match(/[""][^""]+[""]/g) || []).length;
    if (quoteCount > 0) {
      scores.attributing += 1;
      evidence.push({ type: 'attribution', marker: `${quoteCount} direct quotation(s)` });
    }

    // ── Determine dominant stance ──
    const entries = Object.entries(scores);
    entries.sort((a, b) => b[1] - a[1]);

    const [topStance, topScore] = entries[0];
    const totalScore = entries.reduce((sum, [, s]) => sum + s, 0) || 1;
    const confidence = Math.min(95, Math.round((topScore / totalScore) * 100));

    const stanceMap = {
      asserting: { label: 'Assertive / Claiming', icon: 'fas fa-bullhorn',
        desc: 'The text makes strong, definitive claims. It presents information as established fact without qualification.' },
      hedging: { label: 'Uncertain / Hedging', icon: 'fas fa-scale-balanced',
        desc: 'The text uses cautious, qualified language. Claims are presented as possibilities rather than facts.' },
      denying: { label: 'Denying / Refuting', icon: 'fas fa-xmark',
        desc: 'The text actively denies or refutes claims. It challenges the validity of specific statements.' },
      questioning: { label: 'Questioning / Skeptical', icon: 'fas fa-circle-question',
        desc: 'The text questions claims and seeks verification. It adopts a skeptical, inquiry-driven posture.' },
      attributing: { label: 'Reporting / Attributing', icon: 'fas fa-newspaper',
        desc: 'The text attributes claims to specific sources. It maintains journalistic distance from the claims.' }
    };

    const stance = stanceMap[topStance];

    // Calculate stance distribution for visualization
    const distribution = {};
    entries.forEach(([key, val]) => {
      distribution[key] = Math.round((val / totalScore) * 100);
    });

    // Reliability assessment based on stance
    let stanceRisk;
    if (topStance === 'asserting' && confidence > 50) {
      stanceRisk = 'Highly assertive content without attribution is a common misinformation pattern.';
    } else if (topStance === 'attributing') {
      stanceRisk = 'Source attribution is a positive indicator of journalistic standards.';
    } else if (topStance === 'hedging') {
      stanceRisk = 'Cautious language suggests the author acknowledges uncertainty — generally a good sign.';
    } else if (topStance === 'denying') {
      stanceRisk = 'Denial-focused content may be countering misinformation — or spreading counter-narratives. Verify context.';
    } else if (topStance === 'questioning') {
      stanceRisk = 'Questioning stance indicates healthy skepticism. Verify whether it leads to fact-checking or conspiracy.';
    } else {
      stanceRisk = 'Mixed stance markers detected. Content uses a blend of assertion and qualification.';
    }

    return {
      stance: topStance,
      label: stance.label,
      icon: stance.icon,
      description: stance.desc,
      confidence,
      stanceRisk,
      distribution,
      evidence: evidence.slice(0, 8) // Cap at 8 evidence items
    };
  }

  // ══════════════════════════════════════
  //  FULL NLP ANALYSIS
  // ══════════════════════════════════════

  analyze(text) {
    const stance = this.detectStance(text);
    const similarity = this.analyzeSimilarity(text);

    // Compute an NLP risk score (0–100, higher = riskier)
    const stanceWeight = stance.stance === 'asserting' ? stance.confidence * 0.4 :
                         stance.stance === 'attributing' ? -10 : 0;
    const simWeight = similarity.topScore * 0.6;
    const nlpRisk = Math.max(0, Math.min(100, Math.round(stanceWeight + simWeight)));

    return { stance, similarity, nlpRisk };
  }
}

window.NLPEngineClass = NLPEngine;
