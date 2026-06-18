/**
 * TruthShield Text Analyzer
 * Detects clickbait, sentiment bias, misinformation patterns, and writing quality
 */
class TextAnalyzer {
  constructor() {
    this.nlp = new NLPEngineClass();
    this.clickbaitWords = [
      'shocking','unbelievable','you won\'t believe','mind-blowing','jaw-dropping','secret','exposed',
      'breaking','urgent','alert','warning','banned','censored','they don\'t want you to know',
      'this will change','what happens next','number \\d+ will','gone wrong','hack','trick','insane',
      'destroyed','obliterated','slammed','blasted','ripped','destroyed','epic fail','cringe',
      'exclusive','just in','confirmed','leaked','viral','gone viral','watch till end',
      'चौंकाने वाला','वायरल','ब्रेकिंग','खुलासा','सच्चाई','सनसनी','હાલ','ચોંકાવનારું','வைரல்'
    ];

    this.emotionalWords = [
      'terrible','horrible','amazing','incredible','devastating','catastrophic','miraculous',
      'outrageous','disgusting','heartbreaking','infuriating','terrifying','phenomenal',
      'hate','evil','corrupt','traitor','patriot','hero','villain','fraud','scam','conspiracy',
      'genocide','massacre','destroy','attack','threat','crisis','emergency','doom','panic'
    ];

    this.unreliablePatterns = [
      /forward (this|as received)/i,
      /received from (a |my )?(friend|reliable source|whatsapp)/i,
      /share (this )?(before|with everyone)/i,
      /government (is hiding|doesn'?t want)/i,
      /exposed[!]+/i,
      /100% (true|real|confirmed)/i,
      /scientists? (hate|don'?t want)/i,
      /\b(big pharma|deep state|illuminati|new world order)\b/i,
      /(?:just )?received (?:on |from )whatsapp/i
    ];

    this.trustedDomains = [
      'reuters.com','apnews.com','bbc.com','bbc.co.uk','thehindu.com','indianexpress.com',
      'ndtv.com','hindustantimes.com','pib.gov.in','altnews.in','boomlive.in','factly.in',
      'thequint.com','factcheck.org','snopes.com','politifact.com','washingtonpost.com',
      'nytimes.com','theguardian.com','timesofindia.indiatimes.com'
    ];

    this.sentimentLexicon = {
      'good':2,'great':3,'excellent':4,'amazing':4,'wonderful':4,'fantastic':4,'love':3,'happy':3,
      'bad':-2,'terrible':-4,'horrible':-4,'awful':-3,'hate':-3,'angry':-3,'sad':-2,'fear':-2,
      'kill':-4,'death':-3,'die':-3,'murder':-4,'war':-3,'attack':-3,'threat':-3,'danger':-3,
      'peace':3,'safe':2,'protect':2,'help':2,'support':2,'trust':2,'honest':2,'truth':2,
      'lie':-3,'fake':-3,'fraud':-3,'scam':-3,'cheat':-3,'steal':-3,'corrupt':-3,'evil':-4
    };
  }

  async analyze(text) {
    if (!text || text.trim().length < 10) {
      return { error: 'Please provide at least 10 characters of text to analyze.' };
    }

    const cleaned = text.trim();
    const words = cleaned.split(/\s+/);
    const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const lang = this.detectLanguage(cleaned);

    const clickbait = this.detectClickbait(cleaned, words);
    const sentiment = this.analyzeSentiment(cleaned, words);
    const credibility = this.analyzeCredibility(cleaned);
    const quality = this.analyzeWritingQuality(cleaned, words, sentences);

    // NLP: Stance detection + semantic similarity (with heavy MLCore fallback)
    let nlpResult;
    if (window.MLCore && window.MLCore.loaded) {
      const mlSim = await window.MLCore.analyzeSimilarity(cleaned);
      const mlStance = await window.MLCore.classifyStance(cleaned);
      
      const stanceWeight = mlStance.stance === 'asserting' ? mlStance.confidence * 0.4 :
                           mlStance.stance === 'attributing' ? -10 : 0;
      const simWeight = mlSim.topScore * 0.6;
      const nlpRisk = Math.max(0, Math.min(100, Math.round(stanceWeight + simWeight)));

      nlpResult = {
        stance: mlStance,
        similarity: mlSim,
        nlpRisk,
        isNeural: true
      };
    } else {
      nlpResult = this.nlp.analyze(cleaned);
      nlpResult.isNeural = false;
    }

    const flags = this.generateFlags(cleaned, clickbait, sentiment, credibility, quality, nlpResult);

    // Calculate overall trust score (0-100, higher = more trustworthy)
    // NLP risk factor reduces trust when content matches known misinfo patterns
    const rawScore = (
      (100 - clickbait.score) * 0.25 +
      (100 - sentiment.biasScore) * 0.15 +
      credibility.score * 0.20 +
      quality.score * 0.20 +
      (100 - nlpResult.nlpRisk) * 0.20
    );
    const trustScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    let verdict, verdictClass;
    if (trustScore >= 75) { verdict = 'Likely Authentic'; verdictClass = 'success'; }
    else if (trustScore >= 50) { verdict = 'Needs Verification'; verdictClass = 'warning'; }
    else if (trustScore >= 25) { verdict = 'Suspicious Content'; verdictClass = 'warning'; }
    else { verdict = 'Likely Misinformation'; verdictClass = 'danger'; }

    return {
      trustScore, verdict, verdictClass, lang,
      clickbait: clickbait.score,
      sentiment: sentiment.biasScore,
      credibility: credibility.score,
      quality: quality.score,
      nlp: nlpResult,
      flags,
      explanation: this.generateExplanation(trustScore, clickbait, sentiment, credibility, quality, lang, nlpResult),
      stats: { words: words.length, sentences: sentences.length, characters: cleaned.length }
    };
  }

  detectClickbait(text, words) {
    let score = 0;
    const lower = text.toLowerCase();
    const findings = [];

    // Check clickbait words
    let clickbaitHits = 0;
    this.clickbaitWords.forEach(word => {
      if (lower.includes(word.toLowerCase())) {
        clickbaitHits++;
        findings.push(`Contains clickbait phrase: "${word}"`);
      }
    });
    score += Math.min(clickbaitHits * 15, 60);

    // Excessive caps
    const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
    if (capsRatio > 0.4 && text.length > 20) {
      score += 20;
      findings.push('Excessive use of CAPITAL LETTERS');
    }

    // Excessive punctuation
    const exclCount = (text.match(/[!?]{2,}/g) || []).length;
    if (exclCount > 0) {
      score += Math.min(exclCount * 10, 25);
      findings.push('Excessive punctuation (!!!, ???)');
    }

    // Question-based headlines
    if (/^[^.]{5,80}\?$/m.test(text)) {
      score += 10;
      findings.push('Uses question format (common clickbait pattern)');
    }

    // Numbers in headlines ("Top 10", "5 reasons")
    if (/\b(top\s+)?\d+\s+(reasons?|ways?|things?|facts?|secrets?|tips?|hacks?|tricks?)\b/i.test(text)) {
      score += 8;
      findings.push('Uses numbered list format');
    }

    return { score: Math.min(score, 100), findings };
  }

  analyzeSentiment(text, words) {
    let positive = 0, negative = 0, total = 0;
    const lower = text.toLowerCase();

    words.forEach(w => {
      const clean = w.toLowerCase().replace(/[^a-z]/g, '');
      if (this.sentimentLexicon[clean]) {
        const val = this.sentimentLexicon[clean];
        if (val > 0) positive += val;
        else negative += Math.abs(val);
        total++;
      }
    });

    let emotionalHits = 0;
    this.emotionalWords.forEach(w => {
      if (lower.includes(w)) emotionalHits++;
    });

    const sentimentScore = total > 0 ? (positive - negative) / total : 0;
    const biasScore = Math.min(100, Math.round((emotionalHits * 10) + (Math.abs(sentimentScore) * 15) + (negative > positive ? 15 : 0)));

    return {
      positive, negative, sentimentScore,
      biasScore,
      emotionalHits,
      direction: sentimentScore > 0.5 ? 'positive' : sentimentScore < -0.5 ? 'negative' : 'neutral'
    };
  }

  analyzeCredibility(text) {
    let score = 50; // Start neutral-low (must earn credibility)
    const lower = text.toLowerCase();
    const findings = [];

    // Check for unreliable patterns
    let unreliableHits = 0;
    this.unreliablePatterns.forEach(pattern => {
      if (pattern.test(text)) {
        unreliableHits++;
      }
    });
    score -= unreliableHits * 18;
    if (unreliableHits > 0) findings.push(`Contains ${unreliableHits} unreliable content pattern(s)`);

    // Check for source citations
    const hasCitation = /\b(according to|source[s]?:|reported by|confirmed by|stated|said)\b/i.test(text);
    if (hasCitation) { score += 10; findings.push('Contains source attribution'); }

    // Check for URLs to trusted domains
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    let trustedUrl = false;
    urls.forEach(url => {
      if (this.trustedDomains.some(d => url.includes(d))) {
        trustedUrl = true;
      }
    });
    if (trustedUrl) { score += 15; findings.push('References trusted news source'); }
    if (urls.length > 0 && !trustedUrl) { score -= 5; }

    // Check for dates and specifics
    const hasDate = /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})\b/i.test(text);
    if (hasDate) { score += 5; }

    // Check for named entities (simple check)
    const hasQuotes = (text.match(/[""][^""]+[""]/g) || []).length > 0;
    if (hasQuotes) { score += 5; findings.push('Contains direct quotes'); }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  analyzeWritingQuality(text, words, sentences) {
    let score = 70;
    const findings = [];

    // Average sentence length
    const avgSentLen = words.length / Math.max(sentences.length, 1);
    if (avgSentLen > 35) { score -= 10; findings.push('Very long sentences (poor readability)'); }
    else if (avgSentLen < 5 && sentences.length > 1) { score -= 5; findings.push('Very short, fragmented sentences'); }

    // Spelling/grammar indicators
    const typoPatterns = /\b(teh|recieve|seperate|definately|occured|goverment|accomodate|acheive)\b/i;
    if (typoPatterns.test(text)) { score -= 15; findings.push('Contains common spelling errors'); }

    // Mixed case abuse
    const mixedCase = words.filter(w => w.length > 3 && w !== w.toUpperCase() && w !== w.toLowerCase() && !/^[A-Z][a-z]/.test(w)).length;
    if (mixedCase > 3) { score -= 10; findings.push('Inconsistent capitalization'); }

    // Very short text with strong claims
    if (words.length < 30 && /\b(confirmed|breaking|just in|urgent)\b/i.test(text)) {
      score -= 20;
      findings.push('Short text with strong unsubstantiated claims');
    }

    // ALL CAPS word ratio
    const allCapsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)).length;
    if (allCapsWords / words.length > 0.15) {
      score -= 15;
      findings.push('High ratio of ALL CAPS words — aggressive tone');
    }

    // Professional indicators
    if (/\b(research|study|data|evidence|analysis|according)\b/i.test(text)) {
      score += 10;
      findings.push('Uses evidence-based language');
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  detectLanguage(text) {
    const hindiRange = /[\u0900-\u097F]/;
    const gujaratiRange = /[\u0A80-\u0AFF]/;
    const tamilRange = /[\u0B80-\u0BFF]/;

    const hindiCount = (text.match(/[\u0900-\u097F]/g) || []).length;
    const gujaratiCount = (text.match(/[\u0A80-\u0AFF]/g) || []).length;
    const tamilCount = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
    const total = text.length;

    if (hindiCount / total > 0.1) return 'hi';
    if (gujaratiCount / total > 0.1) return 'gu';
    if (tamilCount / total > 0.1) return 'ta';
    return 'en';
  }

  generateFlags(text, clickbait, sentiment, credibility, quality, nlpResult) {
    const flags = [];

    if (nlpResult && nlpResult.similarity && nlpResult.similarity.topScore > 35) {
      flags.push({
        type: nlpResult.similarity.topScore >= 60 ? 'danger' : 'warning',
        icon: 'fas fa-brain',
        text: `Neural semantic check matching: ${nlpResult.similarity.topScore}% similarity to known hoaxes (${nlpResult.similarity.riskLabel}).`
      });
    }

    if (nlpResult && nlpResult.stance && nlpResult.stance.stance === 'asserting' && nlpResult.stance.confidence > 55) {
      flags.push({
        type: 'warning',
        icon: 'fas fa-bullhorn',
        text: `Zero-shot neural stance indicates high assertion (${nlpResult.stance.confidence}%): Text claims absolute authority without source quotes.`
      });
    }

    if (clickbait.score > 60) {
      flags.push({ type: 'danger', icon: 'fas fa-bullhorn', text: 'High clickbait probability detected. This content uses sensationalist language designed to manipulate engagement.' });
    } else if (clickbait.score > 30) {
      flags.push({ type: 'warning', icon: 'fas fa-bullhorn', text: 'Moderate clickbait patterns found. Some sensationalist elements present.' });
    }

    clickbait.findings.forEach(f => {
      flags.push({ type: 'warning', icon: 'fas fa-circle-exclamation', text: f });
    });

    if (sentiment.biasScore > 60) {
      flags.push({ type: 'danger', icon: 'fas fa-face-angry', text: `Strong emotional bias detected (${sentiment.direction} sentiment). Highly emotional content is often used to manipulate.` });
    } else if (sentiment.biasScore > 30) {
      flags.push({ type: 'warning', icon: 'fas fa-face-surprise', text: `Moderate emotional language detected with ${sentiment.direction} tone.` });
    }

    credibility.findings.forEach(f => {
      flags.push({ type: f.includes('trusted') || f.includes('source') || f.includes('quotes') ? 'success' : 'warning', icon: 'fas fa-building', text: f });
    });

    quality.findings.forEach(f => {
      flags.push({ type: f.includes('evidence') ? 'success' : 'warning', icon: 'fas fa-spell-check', text: f });
    });

    if (flags.length === 0) {
      flags.push({ type: 'success', icon: 'fas fa-check-circle', text: 'No significant red flags detected. Content appears to follow standard journalistic patterns.' });
    }

    return flags;
  }

  generateExplanation(score, clickbait, sentiment, credibility, quality, lang, nlpResult) {
    let explanation = '';

    if (score >= 75) {
      explanation = 'This content appears to be generally trustworthy. It demonstrates characteristics of legitimate reporting including balanced language, source attribution, and professional writing quality. ';
    } else if (score >= 50) {
      explanation = 'This content shows some concerning patterns that warrant further verification. While not definitively fake, several elements raise questions about its reliability. ';
    } else if (score >= 25) {
      explanation = 'This content exhibits multiple characteristics commonly associated with misinformation. We strongly recommend cross-verifying with trusted fact-checking sources before sharing. ';
    } else {
      explanation = 'This content shows strong indicators of misinformation or deliberate manipulation. Multiple red flags were detected across clickbait patterns, emotional manipulation, and source credibility. ';
    }

    if (clickbait.score > 40) {
      explanation += `The text uses clickbait techniques (score: ${clickbait.score}%) that are commonly employed to spread misinformation. `;
    }

    if (sentiment.biasScore > 40) {
      explanation += `Strong emotional language was detected (bias: ${sentiment.biasScore}%), which is a common tactic to bypass critical thinking. `;
    }

    // NLP stance insight
    if (nlpResult && nlpResult.stance) {
      explanation += `Stance analysis classified this as "${nlpResult.stance.label}" (${nlpResult.stance.confidence}% confidence). ${nlpResult.stance.stanceRisk} `;
    }

    // Semantic similarity insight
    if (nlpResult && nlpResult.similarity && nlpResult.similarity.topScore > 20) {
      explanation += `Semantic similarity analysis found ${nlpResult.similarity.riskLabel.toLowerCase()} (top match: ${nlpResult.similarity.topScore}% to ${nlpResult.similarity.matches[0]?.category} patterns). `;
    }

    if (lang !== 'en') {
      const langNames = { hi: 'Hindi', gu: 'Gujarati', ta: 'Tamil' };
      explanation += `Content detected in ${langNames[lang] || 'non-English'} language. Regional language misinformation is particularly effective and often goes unchecked. `;
    }

    explanation += 'Always verify information with multiple trusted sources before sharing.';
    return explanation;
  }
}

// Export for use
window.TextAnalyzerEngine = TextAnalyzer;
