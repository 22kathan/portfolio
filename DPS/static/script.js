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

const genderRadios = document.querySelectorAll('input[name="Gender"]');
const groupPregnancies = document.getElementById("group-pregnancies");
const pregnanciesInput = document.getElementById("Pregnancies");

if (genderRadios.length > 0) {
    genderRadios.forEach(radio => {
        radio.addEventListener("change", (e) => {
            if (e.target.value === "male") {
                groupPregnancies.style.display = "none";
                pregnanciesInput.value = "0";
            } else {
                groupPregnancies.style.display = "flex";
            }
        });
    });
}

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
    const checkedGender = document.querySelector('input[name="Gender"]:checked');
    const gender = checkedGender ? checkedGender.value : "female";
    
    FEATURES.forEach((f) => {
        const input = document.getElementById(f);
        if (f === "Pregnancies" && gender === "male") {
            payload[f] = 0;
        } else {
            payload[f] = parseFloat(input.value) || 0;
        }
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

// ─── Chart.js Insights ───
function renderInsights() {
    if (typeof modelMetrics === "undefined" || !modelMetrics || modelMetrics.length === 0) return;

    // Common chart options for Dark Tech theme
    Chart.defaults.color = '#8899b8';
    Chart.defaults.font.family = 'Inter, sans-serif';
    Chart.defaults.scale.grid.color = 'rgba(99, 140, 255, 0.08)';

    const labels = modelMetrics.map(m => m.Model);
    
    // 1. Train vs Test Accuracy
    const trainAcc = modelMetrics.map(m => m["Train Accuracy"]);
    const testAcc = modelMetrics.map(m => m["Accuracy"]);

    const ctxTrainTest = document.getElementById('trainTestChart').getContext('2d');
    new Chart(ctxTrainTest, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Train Accuracy (%)',
                    data: trainAcc,
                    backgroundColor: 'rgba(34, 211, 238, 0.6)',
                    borderColor: 'rgba(34, 211, 238, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Test Accuracy (%)',
                    data: testAcc,
                    backgroundColor: 'rgba(167, 139, 250, 0.6)',
                    borderColor: 'rgba(167, 139, 250, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 50,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });

    // 2. ML Models Accuracy (All metrics radar or another bar)
    // Let's do a grouped bar for Accuracy, Precision, Recall, F1
    const precision = modelMetrics.map(m => m["Precision"]);
    const recall = modelMetrics.map(m => m["Recall"]);
    const f1 = modelMetrics.map(m => m["F1-Score"]);

    const ctxAcc = document.getElementById('accuracyChart').getContext('2d');
    new Chart(ctxAcc, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Accuracy',
                    data: testAcc,
                    backgroundColor: 'rgba(77, 139, 255, 0.7)'
                },
                {
                    label: 'Precision',
                    data: precision,
                    backgroundColor: 'rgba(0, 230, 118, 0.7)'
                },
                {
                    label: 'Recall',
                    data: recall,
                    backgroundColor: 'rgba(255, 171, 0, 0.7)'
                },
                {
                    label: 'F1-Score',
                    data: f1,
                    backgroundColor: 'rgba(255, 23, 68, 0.7)'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 40,
                    max: 100
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

// Initialize Charts on load
document.addEventListener("DOMContentLoaded", renderInsights);
