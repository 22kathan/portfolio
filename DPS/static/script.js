/**
 * DPS — Diabetes Prediction System  •  Frontend Logic
 * Handles form submission, API calls, gauge animation,
 * and SHAP explanation rendering.
 */

// ─── DOM Elements ───
const form = document.getElementById("prediction-form");
const btnPredict = document.getElementById("btn-predict");
const inputSection = document.getElementById("input-section");
const resultSection = document.getElementById("result-section");

const gaugeFill = document.getElementById("gauge-fill");
const gaugeValue = document.getElementById("gauge-value");
const gaugeLabel = document.getElementById("gauge-label");
const verdictBadge = document.getElementById("verdict-badge");
const verdictText = document.getElementById("verdict-text");
const resultModelInfo = document.getElementById("result-model-info");
const explanationBars = document.getElementById("explanation-bars");

const CIRCUMFERENCE = 2 * Math.PI * 85; // matches SVG circle r=85

// ─── Feature names (must match backend) ───
const FEATURES = [
    "Pregnancies", "Glucose", "BloodPressure", "SkinThickness",
    "Insulin", "BMI", "DiabetesPedigreeFunction", "Age"
];

// ─── Form Submission ───
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnPredict.classList.add("loading");
    btnPredict.disabled = true;

    // Collect form data
    const payload = {};
    FEATURES.forEach((f) => {
        const input = document.getElementById(f);
        payload[f] = parseFloat(input.value) || 0;
    });

    try {
        // Collect feature values in an array matching FEATURES order
        const feature_values = FEATURES.map(f => payload[f]);
        
        // Use local JS model inference (from model_inference.js)
        const result = predict_single(feature_values, FEATURES);
        
        showResult(result);
    } catch (error) {
        alert("⚠ Error: " + error.message);
        console.error(error);
    } finally {
        btnPredict.classList.remove("loading");
        btnPredict.disabled = false;
    }
});

// ─── Display Result ───
function showResult(result) {
    // Switch sections
    inputSection.classList.add("hidden");
    resultSection.classList.remove("hidden");

    // Scroll to result
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Model info
    resultModelInfo.textContent = `Predicted using the best-performing model.`;

    // Animate gauge
    const probability = result.probability;
    const offset = CIRCUMFERENCE - (probability / 100) * CIRCUMFERENCE;
    const riskColor = result.risk_color;

    gaugeFill.style.stroke = riskColor;
    // Trigger reflow for animation restart
    gaugeFill.style.strokeDashoffset = CIRCUMFERENCE;
    void gaugeFill.offsetWidth;
    gaugeFill.style.strokeDashoffset = offset;

    // Animate counter
    animateCounter(gaugeValue, 0, probability, 1600);
    gaugeLabel.textContent = result.risk_level;
    gaugeLabel.style.color = riskColor;

    // Verdict badge
    verdictBadge.textContent = result.label;
    verdictBadge.style.background = hexToRgba(riskColor, 0.15);
    verdictBadge.style.color = riskColor;
    verdictBadge.style.border = `1px solid ${hexToRgba(riskColor, 0.3)}`;

    if (result.prediction === 1) {
        verdictText.textContent = "The model indicates an elevated risk of diabetes. Please consult a healthcare professional.";
    } else {
        verdictText.textContent = "The model indicates a low likelihood of diabetes. Maintain a healthy lifestyle!";
    }

    // SHAP Explanations
    renderExplanations(result.explanations);
}

// ─── Render SHAP Bars ───
function renderExplanations(explanations) {
    explanationBars.innerHTML = "";

    if (!explanations || explanations.length === 0 || explanations[0].note) {
        explanationBars.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">
            ${explanations?.[0]?.note || "No explanation available."}</p>`;
        return;
    }

    // Find max absolute SHAP value for scaling
    const maxAbsShap = Math.max(...explanations.map((e) => Math.abs(e.shap_value)), 0.001);

    explanations.forEach((exp) => {
        const row = document.createElement("div");
        row.className = "exp-row";

        const isPositive = exp.shap_value > 0;
        const barWidthPct = (Math.abs(exp.shap_value) / maxAbsShap) * 50; // 50% of container max

        row.innerHTML = `
            <span class="exp-label" title="${exp.feature}: ${exp.value}">${exp.feature}</span>
            <div class="exp-bar-container">
                <div class="exp-bar ${isPositive ? "exp-bar--positive" : "exp-bar--negative"}"
                     style="width: 0%;">
                </div>
            </div>
            <span class="exp-impact" style="color: ${isPositive ? "var(--risk-high)" : "var(--risk-low)"};">
                ${exp.shap_value > 0 ? "+" : ""}${exp.shap_value.toFixed(4)}
            </span>
        `;
        explanationBars.appendChild(row);

        // Animate bar width
        requestAnimationFrame(() => {
            const bar = row.querySelector(".exp-bar");
            bar.style.width = barWidthPct + "%";
        });
    });
}

// ─── Reset ───
function resetForm() {
    resultSection.classList.add("hidden");
    inputSection.classList.remove("hidden");
    inputSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Reset gauge
    gaugeFill.style.strokeDashoffset = CIRCUMFERENCE;
    gaugeValue.textContent = "0%";
}

// ─── Utilities ───
function animateCounter(el, start, end, duration) {
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = start + (end - start) * eased;
        el.textContent = current.toFixed(1) + "%";
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function hexToRgba(hex, alpha) {
    // Handle named colors or already-rgba values
    if (!hex.startsWith("#")) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
