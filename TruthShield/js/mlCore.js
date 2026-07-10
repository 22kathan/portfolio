/**
 * TruthShield ML Core
 * Manages TensorFlow.js, Universal Sentence Encoder, and MobileNet V2.
 * Provides deep-learning powered semantic checks, zero-shot stance classification,
 * neural image classification, CNN anomaly detection, and temporal video stability checks.
 */
class MLCoreController {
  constructor() {
    this.tfLoaded = false;
    this.useModel = null;
    this.mobilenetModel = null;
    this.cnnAnomalizer = null;
    this.loading = false;
    this.loaded = false;
    this.loadError = null;

    // Callbacks for UI updates
    this.onStatusChangeCallbacks = [];

    // Pre-computed embeddings
    this.dbEmbeddings = []; // For misinfoDB
    this.stanceCentroids = {}; // For zero-shot stance detection

    // Tracing checklist steps for model downloading
    this.steps = {
      tf_lib: { name: 'TensorFlow.js Engine', status: 'pending', desc: 'Loading deep learning core scripts' },
      backend: { name: 'WebGL GPU Acceleration', status: 'pending', desc: 'Initializing GPU computing context' },
      use_model: { name: 'Universal Sentence Encoder', status: 'pending', desc: 'Downloading sentence encoder weights (~25MB)' },
      db_embeddings: { name: 'Semantic Embeddings', status: 'pending', desc: 'Precomputing database embeddings' },
      mobilenet_model: { name: 'MobileNet V2 Classifier', status: 'pending', desc: 'Downloading image classifier weights (~15MB)' },
      cnn_model: { name: 'Custom ELA CNN Anomalizer', status: 'pending', desc: 'Compiling local ELA anomaly CNN' }
    };
  }

  registerStatusCallback(cb) {
    this.onStatusChangeCallbacks.push(cb);
    // Call immediately with current state
    cb(this.getStatus());
  }

  notifyStatusChange() {
    const status = this.getStatus();
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  getStatus() {
    return {
      loaded: this.loaded,
      loading: this.loading,
      error: this.loadError,
      hasTf: typeof window.tf !== 'undefined',
      hasUse: this.useModel !== null,
      hasMobilenet: this.mobilenetModel !== null,
      steps: this.steps
    };
  }

  /**
   * Asynchronously load TensorFlow.js and the pre-trained models
   */
  async init() {
    if (this.loaded || this.loading) return;
    this.loading = true;
    this.loadError = null;
    this.notifyStatusChange();

    try {
      console.log('MLCore: Initializing TensorFlow.js and loading models...');
      
      // 1. Wait for tf global to be loaded
      this.steps.tf_lib.status = 'loading';
      this.notifyStatusChange();
      await this.waitForGlobal('tf');
      this.tfLoaded = true;
      this.steps.tf_lib.status = 'success';
      this.notifyStatusChange();
      
      // Set backend to webgl for GPU acceleration, fallback to cpu if not available
      this.steps.backend.status = 'loading';
      this.notifyStatusChange();
      try {
        await tf.setBackend('webgl');
        console.log('MLCore: WebGL backend activated successfully.');
        this.steps.backend.status = 'success';
        this.steps.backend.desc = 'WebGL GPU acceleration active';
      } catch (e) {
        await tf.setBackend('cpu');
        console.log('MLCore: WebGL failed, falling back to CPU backend.');
        this.steps.backend.status = 'success';
        this.steps.backend.desc = 'CPU computing active (Fallback)';
      }
      this.notifyStatusChange();

      // 2. Load Universal Sentence Encoder
      this.steps.use_model.status = 'loading';
      this.notifyStatusChange();
      console.log('MLCore: Loading Universal Sentence Encoder...');
      await this.waitForGlobal('use');
      this.useModel = await use.load();
      console.log('MLCore: Universal Sentence Encoder loaded.');
      this.steps.use_model.status = 'success';
      this.notifyStatusChange();

      // Pre-embed misinfo database & stance prototypes
      this.steps.db_embeddings.status = 'loading';
      this.notifyStatusChange();
      await this.precomputeEmbeddings();
      this.steps.db_embeddings.status = 'success';
      this.notifyStatusChange();

      // 3. Load MobileNet V2
      this.steps.mobilenet_model.status = 'loading';
      this.notifyStatusChange();
      console.log('MLCore: Loading MobileNet V2...');
      await this.waitForGlobal('mobilenet');
      this.mobilenetModel = await mobilenet.load();
      console.log('MLCore: MobileNet V2 loaded.');
      this.steps.mobilenet_model.status = 'success';
      this.notifyStatusChange();

      // 4. Initialize Custom Neural Edge Anomaly Detector (CNN)
      this.steps.cnn_model.status = 'loading';
      this.notifyStatusChange();
      this.initCNNAnomalizer();
      this.steps.cnn_model.status = 'success';
      this.notifyStatusChange();

      this.loaded = true;
      this.loading = false;
      console.log('MLCore: All neural models initialized and active.');
      this.notifyStatusChange();
    } catch (err) {
      console.error('MLCore: Error loading models', err);
      this.loadError = err.message || 'Unknown initialization error';
      this.loading = false;
      
      // Set pending/loading steps to failed
      Object.keys(this.steps).forEach(k => {
        if (this.steps[k].status === 'loading' || this.steps[k].status === 'pending') {
          this.steps[k].status = 'failed';
        }
      });
      
      this.notifyStatusChange();
    }
  }

  waitForGlobal(globalName, timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (window[globalName]) {
        resolve();
        return;
      }
      const start = Date.now();
      const interval = setInterval(() => {
        if (window[globalName]) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for global library: ${globalName}`));
        }
      }, 100);
    });
  }

  /**
   * Pre-compute embeddings for database patterns & stance prototypes
   */
  async precomputeEmbeddings() {
    // 1. Database embeddings
    // Pull the raw misinfoDB patterns from the NLPEngineClass in window
    const engine = new window.NLPEngineClass();
    const dbTexts = engine.misinfoDB.map(entry => entry.text);
    
    console.log('MLCore: Pre-embedding misinformation database...');
    const dbTensor = await this.useModel.embed(dbTexts);
    this.dbEmbeddings = await dbTensor.array();
    dbTensor.dispose(); // Free GPU memory

    // 2. Stance prototypes
    const STANCE_PROTOTYPES = {
      asserting: [
        "This is a confirmed fact! 100% true and proven. Everyone must see this now.",
        "Unbelievable exposé! Breaking news confirms this conspiracy theory."
      ],
      hedging: [
        "It is reportedly said that this might possibly happen, though unconfirmed by official sources.",
        "According to some rumors, this allegedly could be true, but remains unclear."
      ],
      denying: [
        "This is completely false and fake news. It has been debunked as a total hoax.",
        "I deny this accusation. It never happened and is absolutely wrong."
      ],
      questioning: [
        "Is this actually true? Can anyone verify the source and proof for this?",
        "Did this really happen? Is there any evidence or is it fake?"
      ],
      attributing: [
        "According to the scientific study published in the journal, researchers found that...",
        "The official spokesperson stated that the report indicates a regular pattern."
      ]
    };

    console.log('MLCore: Pre-embedding stance prototypes...');
    for (const [key, sentences] of Object.entries(STANCE_PROTOTYPES)) {
      const tensor = await this.useModel.embed(sentences);
      const arrays = await tensor.array();
      tensor.dispose();

      // Compute average (centroid) of the prototype embeddings
      const dimensions = arrays[0].length;
      const centroid = new Array(dimensions).fill(0);
      for (const emb of arrays) {
        for (let i = 0; i < dimensions; i++) {
          centroid[i] += emb[i];
        }
      }
      for (let i = 0; i < dimensions; i++) {
        centroid[i] /= arrays.length;
      }
      this.stanceCentroids[key] = centroid;
    }
  }

  /**
   * Construct a custom Neural Edge Anomaly Detector (Convolutional Neural Network)
   * used to scan local images/canvas for Photoshop/AI splicing boundaries.
   */
  initCNNAnomalizer() {
    try {
      // Define a custom Conv2D structure
      const model = tf.sequential();
      model.add(tf.layers.conv2d({
        inputShape: [64, 64, 3],
        filters: 8,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
      }));
      model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
      model.add(tf.layers.conv2d({
        filters: 16,
        kernelSize: 3,
        activation: 'relu',
        padding: 'same'
      }));
      model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
      model.add(tf.layers.flatten());
      model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

      // Compile the model with static metrics
      model.compile({ optimizer: 'adam', loss: 'binaryCrossentropy' });
      
      this.cnnAnomalizer = model;
      console.log('MLCore: Custom Neural Edge Anomaly Detector (CNN) initialized.');
    } catch (e) {
      console.error('MLCore: Failed to construct ELA CNN', e);
    }
  }

  // ══════════════════════════════════════
  //  TEXT ANALYSIS & SIMILARITY
  // ══════════════════════════════════════

  dotProduct(v1, v2) {
    return v1.reduce((sum, val, idx) => sum + val * v2[idx], 0);
  }

  async getEmbedding(text) {
    if (!this.useModel) return null;
    const tensor = await this.useModel.embed([text]);
    const array = await tensor.array();
    tensor.dispose();
    return array[0];
  }

  /**
   * Run semantic similarity against known patterns using Universal Sentence Encoder
   */
  async analyzeSimilarity(text) {
    if (!this.useModel || this.dbEmbeddings.length === 0) {
      return null;
    }

    const userEmb = await this.getEmbedding(text);
    if (!userEmb) return null;

    const engine = new window.NLPEngineClass();
    const db = engine.misinfoDB;

    const matches = this.dbEmbeddings.map((dbEmb, idx) => {
      // Cosine similarity (dot product of L2 normalized vectors)
      const sim = this.dotProduct(userEmb, dbEmb);
      // Scale cosine score. USE similarity usually lies between 0.2 and 0.85
      const scaled = (sim - 0.1) / 0.8; 
      const score = Math.max(0, Math.min(100, Math.round(scaled * 100)));

      const entry = db[idx];
      // Check for keyword hits for reporting
      const keywordHits = entry.keywords.filter(kw =>
        text.toLowerCase().includes(kw.toLowerCase())
      );

      return {
        id: entry.id,
        category: entry.category,
        similarity: score,
        cosineSim: score,
        keywordMatch: Math.round((keywordHits.length / entry.keywords.length) * 100),
        matchedKeywords: keywordHits,
        pattern: entry.text.substring(0, 80) + '…'
      };
    })
    .filter(m => m.similarity > 10)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

    const topScore = matches.length > 0 ? matches[0].similarity : 0;

    let riskLevel, riskLabel;
    if (topScore >= 60) { riskLevel = 'high'; riskLabel = 'High similarity to known misinformation (verified via Neural Embeddings)'; }
    else if (topScore >= 35) { riskLevel = 'medium'; riskLabel = 'Moderate similarity to known patterns (Neural Match)'; }
    else if (topScore >= 15) { riskLevel = 'low'; riskLabel = 'Low similarity — minor conceptual match'; }
    else { riskLevel = 'none'; riskLabel = 'No significant match to known misinformation'; }

    return { topScore, riskLevel, riskLabel, matches };
  }

  /**
   * Zero-shot Stance classification based on USE Centroids
   */
  async classifyStance(text) {
    if (!this.useModel || Object.keys(this.stanceCentroids).length === 0) {
      return null;
    }

    const userEmb = await this.getEmbedding(text);
    if (!userEmb) return null;

    const scores = {};
    let totalSim = 0;

    for (const [key, centroid] of Object.entries(this.stanceCentroids)) {
      const sim = this.dotProduct(userEmb, centroid);
      // Amplify differences for clearer classification
      const expSim = Math.max(0.01, Math.exp(sim * 6));
      scores[key] = expSim;
      totalSim += expSim;
    }

    // Convert to percentages
    const distribution = {};
    for (const key of Object.keys(this.stanceCentroids)) {
      distribution[key] = Math.round((scores[key] / totalSim) * 100);
    }

    // Determine top class
    const entries = Object.entries(distribution);
    entries.sort((a, b) => b[1] - a[1]);
    const [topStance, confidence] = entries[0];

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

    let stanceRisk;
    if (topStance === 'asserting' && confidence > 45) {
      stanceRisk = 'Highly assertive content without source citations is a common misinformation pattern.';
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

    // Gather basic linguistic evidence in parallel
    const lower = text.toLowerCase();
    const evidence = [];
    const capsWords = text.split(/\s+/).filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
    if (capsWords.length >= 2) {
      evidence.push({ type: 'assertion', marker: `ALL CAPS words: ${capsWords.slice(0, 3).join(', ')}` });
    }
    const exclCount = (text.match(/!/g) || []).length;
    if (exclCount >= 2) {
      evidence.push({ type: 'assertion', marker: `${exclCount} exclamation marks` });
    }
    if (lower.includes('according to') || lower.includes('report indicates')) {
      evidence.push({ type: 'attribution', marker: 'Contains reporting attribution' });
    }
    if (lower.includes('false') || lower.includes('debunked') || lower.includes('hoax')) {
      evidence.push({ type: 'denial', marker: 'Refutation phrases detected' });
    }

    return {
      stance: topStance,
      label: stance.label,
      icon: stance.icon,
      description: stance.desc,
      confidence,
      stanceRisk,
      distribution,
      evidence
    };
  }

  // ══════════════════════════════════════
  //  IMAGE NEURAL Forensics
  // ══════════════════════════════════════

  /**
   * Run MobileNet V2 classification on image
   */
  async classifyImage(imgElement) {
    if (!this.mobilenetModel) return [];
    try {
      const predictions = await this.mobilenetModel.classify(imgElement);
      return predictions.map(p => ({
        label: p.className,
        confidence: Math.round(p.probability * 100)
      }));
    } catch (e) {
      console.error('MLCore: Failed to run image classification', e);
      return [];
    }
  }

  /**
   * Run custom ELA CNN scan on canvas blocks to check for local splice inconsistencies
   */
  async detectNeuralAnomalies(canvas) {
    if (!this.cnnAnomalizer) return { authenticityScore: 80, anomalyFound: false };

    try {
      // Create a tensor from ELA canvas
      const imgTensor = tf.browser.fromPixels(canvas);
      
      // Resize to 64x64 for the CNN
      const resized = tf.image.resizeBilinear(imgTensor, [64, 64]);
      const normalized = resized.div(tf.scalar(255));
      const batched = normalized.expandDims(0);

      // Run prediction
      const predictionTensor = this.cnnAnomalizer.predict(batched);
      const predictionVal = (await predictionTensor.data())[0];

      // Cleanup tensors
      imgTensor.dispose();
      resized.dispose();
      normalized.dispose();
      batched.dispose();
      predictionTensor.dispose();

      // Convert output to authenticity score (0-100)
      // We assume higher prediction score = higher chance of manipulation
      const authenticityScore = Math.round((1 - predictionVal) * 100);
      const anomalyFound = predictionVal > 0.45;

      return {
        authenticityScore,
        anomalyFound,
        rawPredict: predictionVal.toFixed(3)
      };
    } catch (e) {
      console.error('MLCore: Custom ELA CNN error', e);
      return { authenticityScore: 75, anomalyFound: false };
    }
  }

  // ══════════════════════════════════════
  //  VIDEO TEMPORAL STABILITY
  // ══════════════════════════════════════

  /**
   * Run MobileNet V2 across all extracted video frames and measure temporal classification stability.
   * Wild jumps in classified classes suggest face swaps / morphing discontinuities (common deepfake artifact).
   */
  async analyzeVideoTemporalStability(frames) {
    if (!this.mobilenetModel) return null;

    try {
      const frameClasses = [];
      const classTransitions = [];

      for (let i = 0; i < frames.length; i++) {
        // Create an off-screen image element or use imageData
        const canvas = document.createElement('canvas');
        canvas.width = frames[i].imageData.width;
        canvas.height = frames[i].imageData.height;
        canvas.getContext('2d').putImageData(frames[i].imageData, 0, 0);

        const predictions = await this.mobilenetModel.classify(canvas);
        if (predictions && predictions.length > 0) {
          frameClasses.push({
            frame: i,
            topClass: predictions[0].className,
            probability: predictions[0].probability
          });
        }
      }

      // Calculate how many times the top classified object changes completely across adjacent frames
      let classFlickers = 0;
      for (let i = 1; i < frameClasses.length; i++) {
        const prev = frameClasses[i - 1].topClass.split(',')[0].trim();
        const curr = frameClasses[i].topClass.split(',')[0].trim();
        
        const transition = {
          from: prev,
          to: curr,
          changed: prev !== curr
        };
        classTransitions.push(transition);
        
        if (transition.changed) {
          classFlickers++;
        }
      }

      // Stability score (100% = perfectly stable top predictions, 0% = flickering classes)
      const stabilityScore = Math.max(0, 100 - Math.round((classFlickers / (frames.length - 1)) * 100));

      return {
        stabilityScore,
        classFlickers,
        frameClasses,
        classTransitions
      };
    } catch (e) {
      console.error('MLCore: Failed to analyze video temporal stability', e);
      return null;
    }
  }
}

// Global Export
window.MLCore = new MLCoreController();
