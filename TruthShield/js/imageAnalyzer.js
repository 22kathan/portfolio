/**
 * TruthShield Image Analyzer
 * Performs Error Level Analysis (ELA), metadata extraction, and statistical analysis
 */
class ImageAnalyzer {
  constructor() {
    this.elaQuality = 0.85; // JPEG recompression quality for ELA
    this.elaScale = 20;     // Amplification factor for ELA differences
  }

  async analyze(file) {
    const img = await this.loadImage(file);
    const elaResult = await this.performELA(img);
    const metadata = await this.extractMetadata(file);
    const stats = this.analyzeStatistics(img);
    const noiseAnalysis = this.analyzeNoise(img);
    const ganDetection = this.detectGANArtifacts(img);

    // Run Neural Checks if MLCore is active
    let neuralAnomalies = null;
    let predictions = [];
    if (window.MLCore && window.MLCore.loaded) {
      predictions = await window.MLCore.classifyImage(img);

      // Run CNN on ELA frame
      const elaCanvas = document.createElement('canvas');
      elaCanvas.width = elaResult.width;
      elaCanvas.height = elaResult.height;
      elaCanvas.getContext('2d').putImageData(elaResult.elaImageData, 0, 0);
      neuralAnomalies = await window.MLCore.detectNeuralAnomalies(elaCanvas);
    }

    // Calculate overall authenticity score
    const elaScore = elaResult.suspicionLevel;
    const metaScore = metadata.trustScore;
    const statsScore = stats.consistencyScore;
    const ganScore = ganDetection.authenticityScore;

    let authenticityScore;
    if (neuralAnomalies) {
      const blended = (
        neuralAnomalies.authenticityScore * 0.35 +
        elaScore * 0.25 +
        metaScore * 0.15 +
        statsScore * 0.10 +
        ganScore * 0.15
      );
      authenticityScore = Math.round(Math.max(0, Math.min(100, blended)));
    } else {
      const rawScore = (elaScore * 0.35 + metaScore * 0.2 + statsScore * 0.2 + ganScore * 0.25);
      authenticityScore = Math.round(Math.max(0, Math.min(100, rawScore)));
    }

    let verdict, verdictClass;
    if (authenticityScore >= 75) { verdict = 'Likely Authentic'; verdictClass = 'success'; }
    else if (authenticityScore >= 50) { verdict = 'Inconclusive'; verdictClass = 'warning'; }
    else if (authenticityScore >= 25) { verdict = 'Potentially Manipulated'; verdictClass = 'warning'; }
    else { verdict = 'Likely Manipulated'; verdictClass = 'danger'; }

    // Prepare breakdown
    const breakdown = [
      { label: 'ELA Consistency', icon: 'fas fa-wand-magic-sparkles', value: elaScore, color: this.getScoreColor(elaScore) },
      { label: 'Metadata Trust', icon: 'fas fa-circle-info', value: metaScore, color: this.getScoreColor(metaScore) },
      { label: 'Statistical Consistency', icon: 'fas fa-chart-bar', value: statsScore, color: this.getScoreColor(statsScore) },
      { label: 'GAN Detection', icon: 'fas fa-robot', value: ganScore, color: this.getScoreColor(ganScore) },
      { label: 'Noise Uniformity', icon: 'fas fa-volume-low', value: noiseAnalysis.uniformityScore, color: this.getScoreColor(noiseAnalysis.uniformityScore) }
    ];

    if (neuralAnomalies) {
      breakdown.push({
        label: 'Neural ELA CNN',
        icon: 'fas fa-brain',
        value: neuralAnomalies.authenticityScore,
        color: this.getScoreColor(neuralAnomalies.authenticityScore)
      });
    }

    const flags = this.generateFlags(elaResult, metadata, stats, ganDetection, noiseAnalysis);
    if (neuralAnomalies && neuralAnomalies.anomalyFound) {
      flags.push({
        type: 'danger',
        icon: 'fas fa-microchip',
        text: `Neural ELA CNN scan detected local editing boundaries (splicing probability: ${(neuralAnomalies.rawPredict * 100).toFixed(0)}%).`
      });
    }

    return {
      authenticityScore, verdict, verdictClass,
      ela: elaResult, metadata, stats, noise: noiseAnalysis, gan: ganDetection,
      neuralAnomalies, predictions,
      breakdown, flags
    };
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  async performELA(img) {
    let width = img.width;
    let height = img.height;
    const maxDimension = 800;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    // Create canvas with scaled image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    // Get original pixel data
    const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Re-encode as JPEG at lower quality
    const jpegDataUrl = canvas.toDataURL('image/jpeg', this.elaQuality);

    // Load recompressed image
    const recompressed = await new Promise((resolve) => {
      const reImg = new Image();
      reImg.onload = () => resolve(reImg);
      reImg.src = jpegDataUrl;
    });

    // Draw recompressed image
    ctx.drawImage(recompressed, 0, 0);
    const recompressedData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Calculate ELA - amplify differences
    const elaData = ctx.createImageData(canvas.width, canvas.height);
    let totalDiff = 0;
    let maxDiff = 0;
    let highDiffPixels = 0;
    const diffMap = [];

    for (let i = 0; i < originalData.data.length; i += 4) {
      const rDiff = Math.abs(originalData.data[i] - recompressedData.data[i]);
      const gDiff = Math.abs(originalData.data[i + 1] - recompressedData.data[i + 1]);
      const bDiff = Math.abs(originalData.data[i + 2] - recompressedData.data[i + 2]);

      const diff = (rDiff + gDiff + bDiff) / 3;
      totalDiff += diff;
      maxDiff = Math.max(maxDiff, diff);
      if (diff > 15) highDiffPixels++;

      const amplified = Math.min(255, diff * this.elaScale);
      elaData.data[i] = amplified;
      elaData.data[i + 1] = amplified > 150 ? amplified * 0.3 : amplified;
      elaData.data[i + 2] = amplified > 100 ? amplified * 0.2 : amplified * 0.8;
      elaData.data[i + 3] = 255;
      diffMap.push(diff);
    }

    const totalPixels = canvas.width * canvas.height;
    const avgDiff = totalDiff / totalPixels;
    const highDiffRatio = highDiffPixels / totalPixels;

    // Calculate standard deviation of differences
    const mean = avgDiff;
    let variance = 0;
    diffMap.forEach(d => variance += (d - mean) ** 2);
    const stdDev = Math.sqrt(variance / diffMap.length);

    // Higher std deviation = more variation = more suspicious
    // Uniform ELA = more authentic (or uniformly manipulated)
    let suspicionLevel;
    if (stdDev < 3 && avgDiff < 5) suspicionLevel = 85;
    else if (stdDev < 6 && avgDiff < 10) suspicionLevel = 70;
    else if (stdDev < 10) suspicionLevel = 50;
    else if (stdDev < 15) suspicionLevel = 35;
    else suspicionLevel = 20;

    if (highDiffRatio > 0.3) suspicionLevel = Math.min(suspicionLevel, 30);
    if (highDiffRatio < 0.02) suspicionLevel = Math.max(suspicionLevel, 75);

    return {
      elaImageData: elaData,
      width: canvas.width,
      height: canvas.height,
      avgDiff: avgDiff.toFixed(2),
      maxDiff: maxDiff.toFixed(2),
      stdDev: stdDev.toFixed(2),
      highDiffRatio: (highDiffRatio * 100).toFixed(1),
      suspicionLevel
    };
  }

  async extractMetadata(file) {
    const info = {
      fileName: file.name,
      fileSize: this.formatFileSize(file.size),
      fileType: file.type,
      lastModified: new Date(file.lastModified).toLocaleString(),
      dimensions: 'Unknown'
    };

    let trustScore = 60;
    const findings = [];

    // Read EXIF data from file bytes
    try {
      const buffer = await file.arrayBuffer();
      const view = new DataView(buffer);
      const exifData = this.parseBasicExif(view);

      if (exifData) {
        info.camera = exifData.make || 'Unknown';
        info.model = exifData.model || 'Unknown';
        info.software = exifData.software || 'None detected';
        info.dateTime = exifData.dateTime || 'Not available';

        if (exifData.software) {
          const sw = exifData.software.toLowerCase();
          if (sw.includes('photoshop') || sw.includes('gimp') || sw.includes('illustrator')) {
            trustScore -= 25;
            findings.push({ type: 'danger', text: `Editing software detected: ${exifData.software}` });
          } else if (sw.includes('lightroom') || sw.includes('camera raw')) {
            trustScore -= 5;
            findings.push({ type: 'warning', text: `Photo editing software: ${exifData.software}` });
          }
        }

        if (exifData.make && exifData.model) {
          trustScore += 10;
          findings.push({ type: 'success', text: `Camera info present: ${exifData.make} ${exifData.model}` });
        }
      } else {
        trustScore -= 10;
        findings.push({ type: 'warning', text: 'No EXIF metadata found — may have been stripped' });
      }
    } catch (e) {
      findings.push({ type: 'warning', text: 'Could not parse metadata' });
    }

    // Check file type
    if (file.type === 'image/png') {
      trustScore -= 5;
      findings.push({ type: 'warning', text: 'PNG format — lossless format sometimes used to hide JPEG artifacts' });
    }

    return { ...info, trustScore: Math.max(0, Math.min(100, trustScore)), findings };
  }

  parseBasicExif(view) {
    try {
      // Check for JPEG SOI marker
      if (view.getUint16(0) !== 0xFFD8) return null;

      let offset = 2;
      while (offset < view.byteLength - 4) {
        const marker = view.getUint16(offset);
        if (marker === 0xFFE1) {
          // APP1 EXIF
          const length = view.getUint16(offset + 2);
          // Check for "Exif" string
          if (view.getUint32(offset + 4) === 0x45786966) {
            return this.parseExifData(view, offset + 10, length);
          }
        }
        if ((marker & 0xFF00) !== 0xFF00) break;
        offset += 2 + view.getUint16(offset + 2);
      }
    } catch (e) { /* ignore parsing errors */ }
    return null;
  }

  parseExifData(view, tiffOffset, maxLength) {
    try {
      const bigEndian = view.getUint16(tiffOffset) === 0x4D4D;
      const getU16 = (o) => view.getUint16(o, !bigEndian);
      const getU32 = (o) => view.getUint32(o, !bigEndian);

      const ifdOffset = tiffOffset + getU32(tiffOffset + 4);
      const entries = getU16(ifdOffset);
      const result = {};

      const tagNames = { 0x010F: 'make', 0x0110: 'model', 0x0131: 'software', 0x0132: 'dateTime' };

      for (let i = 0; i < Math.min(entries, 50); i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;
        const tag = getU16(entryOffset);

        if (tagNames[tag]) {
          const type = getU16(entryOffset + 2);
          const count = getU32(entryOffset + 4);
          if (type === 2 && count < 200) { // ASCII string
            let strOffset = count > 4 ? tiffOffset + getU32(entryOffset + 8) : entryOffset + 8;
            let str = '';
            for (let j = 0; j < count - 1 && strOffset + j < view.byteLength; j++) {
              str += String.fromCharCode(view.getUint8(strOffset + j));
            }
            result[tagNames[tag]] = str.trim();
          }
        }
      }
      return Object.keys(result).length > 0 ? result : null;
    } catch (e) { return null; }
  }

  analyzeStatistics(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Color distribution analysis
    const rHist = new Array(256).fill(0);
    const gHist = new Array(256).fill(0);
    const bHist = new Array(256).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      rHist[data[i]]++;
      gHist[data[i + 1]]++;
      bHist[data[i + 2]]++;
    }

    // Check for unnatural distributions
    const totalPx = img.width * img.height;
    const rEntropy = this.calcEntropy(rHist, totalPx);
    const gEntropy = this.calcEntropy(gHist, totalPx);
    const bEntropy = this.calcEntropy(bHist, totalPx);
    const avgEntropy = (rEntropy + gEntropy + bEntropy) / 3;

    // Natural images typically have entropy between 6-8
    let consistencyScore;
    if (avgEntropy >= 5.5 && avgEntropy <= 8) consistencyScore = 80;
    else if (avgEntropy >= 4.5) consistencyScore = 60;
    else if (avgEntropy >= 3) consistencyScore = 40;
    else consistencyScore = 25;

    return { rEntropy: rEntropy.toFixed(2), gEntropy: gEntropy.toFixed(2), bEntropy: bEntropy.toFixed(2), avgEntropy: avgEntropy.toFixed(2), consistencyScore };
  }

  calcEntropy(histogram, total) {
    let entropy = 0;
    histogram.forEach(count => {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    });
    return entropy;
  }

  analyzeNoise(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = Math.min(img.width, 512);
    const h = Math.min(img.height, 512);
    canvas.width = w; canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Calculate local noise variance in blocks
    const blockSize = 16;
    const variances = [];

    for (let by = 0; by < h - blockSize; by += blockSize) {
      for (let bx = 0; bx < w - blockSize; bx += blockSize) {
        let sum = 0, sumSq = 0, count = 0;
        for (let y = by; y < by + blockSize; y++) {
          for (let x = bx; x < bx + blockSize; x++) {
            const idx = (y * w + x) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            sum += gray;
            sumSq += gray * gray;
            count++;
          }
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        variances.push(variance);
      }
    }

    // Check uniformity of noise
    const avgVar = variances.reduce((a, b) => a + b, 0) / variances.length;
    let varOfVar = 0;
    variances.forEach(v => varOfVar += (v - avgVar) ** 2);
    varOfVar = Math.sqrt(varOfVar / variances.length);

    // Uniform noise = likely authentic or high-quality manipulation
    const uniformityScore = varOfVar < 50 ? 80 : varOfVar < 150 ? 60 : varOfVar < 300 ? 45 : 30;

    return { avgVariance: avgVar.toFixed(1), varianceStdDev: varOfVar.toFixed(1), uniformityScore };
  }

  detectGANArtifacts(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 256;
    canvas.width = size; canvas.height = size;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    // Check for checkerboard artifacts (common in GANs)
    let checkerboardScore = 0;
    for (let y = 1; y < size - 1; y += 2) {
      for (let x = 1; x < size - 1; x += 2) {
        const idx = (y * size + x) * 4;
        const center = data[idx];
        const left = data[((y) * size + (x - 1)) * 4];
        const right = data[((y) * size + (x + 1)) * 4];
        const top = data[((y - 1) * size + x) * 4];
        const bottom = data[((y + 1) * size + x) * 4];
        const avg = (left + right + top + bottom) / 4;
        if (Math.abs(center - avg) > 20) checkerboardScore++;
      }
    }

    const totalChecks = ((size - 2) / 2) * ((size - 2) / 2);
    const checkerboardRatio = checkerboardScore / totalChecks;

    // Check for color banding
    let bandingScore = 0;
    for (let y = 0; y < size; y++) {
      let runLength = 0;
      let lastVal = -1;
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const val = Math.round(data[idx] / 4) * 4; // Quantize
        if (val === lastVal) { runLength++; }
        else { if (runLength > 20) bandingScore++; runLength = 0; }
        lastVal = val;
      }
    }

    const authenticityScore = checkerboardRatio < 0.05 && bandingScore < 10 ? 80 :
      checkerboardRatio < 0.1 ? 60 : checkerboardRatio < 0.2 ? 40 : 25;

    return { checkerboardRatio: (checkerboardRatio * 100).toFixed(1), bandingScore, authenticityScore };
  }

  generateFlags(ela, metadata, stats, gan, noise) {
    const flags = [];

    if (ela.suspicionLevel < 40) {
      flags.push({ type: 'danger', icon: 'fas fa-wand-magic-sparkles', text: `ELA detected significant inconsistencies (std dev: ${ela.stdDev}). Areas of different compression levels suggest editing.` });
    } else if (ela.suspicionLevel < 60) {
      flags.push({ type: 'warning', icon: 'fas fa-wand-magic-sparkles', text: `ELA shows some inconsistencies that may indicate minor edits or different source qualities.` });
    } else {
      flags.push({ type: 'success', icon: 'fas fa-wand-magic-sparkles', text: 'ELA shows consistent compression levels across the image.' });
    }

    metadata.findings.forEach(f => {
      flags.push({ type: f.type, icon: 'fas fa-circle-info', text: f.text });
    });

    if (gan.authenticityScore < 50) {
      flags.push({ type: 'warning', icon: 'fas fa-robot', text: `Potential GAN artifacts detected (checkerboard: ${gan.checkerboardRatio}%). Image may be AI-generated.` });
    }

    if (noise.uniformityScore < 50) {
      flags.push({ type: 'warning', icon: 'fas fa-volume-low', text: 'Non-uniform noise distribution detected — may indicate compositing from multiple sources.' });
    }

    if (stats.avgEntropy < 4.5) {
      flags.push({ type: 'warning', icon: 'fas fa-chart-bar', text: `Low color entropy (${stats.avgEntropy}) — unusual for natural photographs.` });
    }

    return flags;
  }

  getScoreColor(score) {
    if (score >= 70) return '#10b981';
    if (score >= 45) return '#f59e0b';
    return '#ef4444';
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}

window.ImageAnalyzerEngine = ImageAnalyzer;
