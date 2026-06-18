# 🛡️ TruthShield: AI-Driven Media Verification System

**An advanced, client-side digital forensics and semantic check suite for detecting fake news, image manipulation, and video deepfakes.**

TruthShield is a unified, user-friendly desktop interface designed to combat digital misinformation and media tampering. Leveraging **TensorFlow.js** for browser-side, GPU-accelerated neural networks, the system operates entirely client-side, ensuring privacy and rapid evaluation without requiring server-side heavy-processing backend pipelines.

Developed under the conceptual requirements of the Cyber Crime Branch, Ahmedabad City Police.

---

## ✨ Key Forensic Pillars & ML Architecture

### 1. 📝 Text Verification (Fake News & Stance Analysis)
*   **Universal Sentence Encoder (USE)**: Embeds inputs into 512-dimensional semantic vectors.
*   **Cosine Similarity Matching**: Computes similarity scores against a database of known misinformation and regional language hoaxes.
*   **Zero-Shot Stance Detection**: Performs nearest-centroid classification across assertion, hedging, denial, questioning, and attribution stance vectors to understand the text's communicative profile.
*   **Traditional NLP Fallback**: Employs tf-idf vectorization and rule-based stance marker lexicons if GPU backend initialization is bypassed.

### 2. 🖼️ Image Forensic Scanner (Splicing & GAN Fingerprints)
*   **Error Level Analysis (ELA)**: Resaves the image at a known compression level to highlight pixel variance and highlight splicing boundaries.
*   **Custom CNN Edge Classifier**: A convolutional neural network built in TF.js (`Conv2D` -> `MaxPooling2D` -> `Flatten` -> `Dense`) that scans local patch layers of the ELA canvas for compression anomalies.
*   **MobileNet V2 Scene Classifier**: Identifies primary image entities (e.g. syringes, lemons, crowds) with confidence metrics to detect manipulation context.

### 3. 📹 Video Deepfake Forensics (Temporal Stability)
*   **Frame-by-Frame Classification**: Extracts frame slices from user-uploaded video timelines.
*   **Temporal Neural Stability Checker**: Measures the variance and change frequency of top MobileNet predictions between consecutive frames. Sudden flickering changes indicate splicing and frame-morphing artifacts common in deepfakes.

---

## 🛠️ Technology Stack
*   **Frontend**: HTML5, Vanilla CSS (Dark tech theme with glassmorphism and modern UI elements), and JavaScript (ES6+).
*   **Deep Learning Backend**: TensorFlow.js (WebGL backend for hardware acceleration, fallback to CPU).
*   **Pretrained Models**: MobileNet V2 (Image & Video classifier), Universal Sentence Encoder (Text semantics).
*   **Icons & Fonts**: FontAwesome, Google Fonts (Space Grotesk & Inter).

---

## 📂 Project Structure
*   `index.html` — Core web portal, dashboards, and custom canvas elements.
*   `css/style.css` — High-fidelity theme styling, loading indicators, and responsiveness.
*   `js/mlCore.js` — TensorFlow.js orchestrator, model downloader, and CNN model constructor.
*   `js/nlpEngine.js` — Heuristics-based text analyzer (fallback).
*   `js/textAnalyzer.js` — Text verification pipeline combining USE and metadata checks.
*   `js/imageAnalyzer.js` — ELA generator, MobileNet scene predictor, and CNN anomaly scanner.
*   `js/videoAnalyzer.js` — Video timeline frame loader and temporal neural stability scorer.
*   `js/app.js` — Orchestrates tab navigation, file upload triggers, and results rendering.

---

## 🚀 Running Locally

Since the application utilizes client-side TensorFlow.js, it can be run via any local HTTP server:

### Python HTTP Server
```bash
# Navigate to the project directory
cd TruthShield

# Start Python's built-in server
python -m http.server 8000
```
Open your browser and navigate to `http://localhost:8000`.

### Node.js http-server
```bash
npm install -g http-server
http-server -p 8000
```
Open your browser and navigate to `http://localhost:8000`.
