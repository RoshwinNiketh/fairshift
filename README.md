# FairShift 2026

> Transparent Shifts, Fair Pay & Worker Safety for Construction and Campus Support Services.
> Built for Hackathon SDG 8 (Decent Work and Economic Growth).

[![Tests](https://img.shields.io/badge/tests-16%20passing-brightgreen)](#automated-testing)
[![SDG](https://img.shields.io/badge/SDG-8%20Decent%20Work-blue)](#mission)
[![Architecture](https://img.shields.io/badge/Docker-Linux%20Alpine%20Ready-blue)](#cloud-run--docker-deployment)

---

## Mission & Purpose

FairShift addresses acute vulnerability among hourly and informal frontline workers in high-risk, labor-intensive environments—specifically **civil construction sites** and **college campus housekeeping/facilities operations**.

Frontline workers frequently experience:
- Lack of transparent, verifiable shift and overtime calculations.
- Excessive fatigue from back-to-back shifts without mandatory rest intervals.
- Barriers to voicing safety concerns and physical hazards without fear of retribution.

FairShift delivers an accessible, mobile-first progressive application with full English and Tamil localization, deterministic shift pay breakdown, rule-based fatigue alerts, and supervisor-accountable safety tracking.

> **Demonstration & Synthetic Data Notice**:
> FairShift is configured with self-contained synthetic demonstration scenarios. It does not store or process real personally identifiable information (PII). Role switching between Worker and Employer is provided for demonstration and judging review purposes only and does not imply production access-control or authentication.

---

## Key Modules & Features

### 1. Shift & Pay Transparency
- **One-Touch Check In / Check Out**: Designed for mobile ergonomics with oversized touch targets and zoom-enabled viewports.
- **Live Elapsed Duty & Real-Time Estimated Pay**: Displays real-time earnings and highlights whether overtime has begun.
- **Itemized Earnings Breakdown**: Automatically decomposes recorded shifts into regular hours, overtime hours, base rate, and overtime multiplier earnings.
- **Clear Legal Disclaimer**: Explicitly states that estimates provide transparency and accountability rather than tax/payroll compliance.

### 2. Safety & Grievance Reporting
- **Multi-Category Incident Logging**: Log structural hazards, equipment failure, extreme fatigue, chemical exposure, or harassment.
- **Severity Stratification**: Categorize incidents from *Low* to *Critical Life-Safety Risk*.
- **Accountable & Confidential**: Linked to worker account to prevent supervisor dismissal while protecting worker privacy.
- **Bidirectional Status Updates**: Workers track supervisor review status (`OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`) and view actionable resolution notes.

### 3. Operational Dashboard & Rule-Based Fatigue Monitoring
- **Deterministic Fatigue Engine**: Detects excessive daily hours (>10h threshold), insufficient rest intervals between consecutive shifts (<11h rest), and weekly duty limits (>48h/week).
- **Organization-Level Rules**: Configurable standard shift limits, overtime multipliers, and safety thresholds.
- **Actionable Report Management**: Supervisors can inspect details, dispatch maintenance, update statuses, and log resolution notes.

### 4. Cross-Industry Demonstration
Includes two distinct synthetic scenarios:
1. **BuildRight Infrastructure Ltd** (Construction & Heavy Civil): Demonstrates structural pours, high fall risk hazards, and extreme rest-deficiency alerts.
2. **Apex Heights College Facilities** (Higher Ed Support & Housekeeping): Demonstrates dorm and lab sanitization, chemical ventilation hazards, and customized shift rules.

---

## Inclusivity & Localization

- **Bilingual Interface**: Full, native English and Tamil (`தமிழ்`) translations for all essential worker interactions, categories, and buttons (zero placeholder text).
- **Device Independence**: Fully operational without camera, microphone, or GPS permissions.
- **Accessibility**: Semantic HTML5 elements, high-contrast badges, keyboard focus rings, and touch-optimized sizing with unrestricted viewport scaling.

---

## Technical Stack & Architecture

- **Frontend**: React 18, Vite, Tailwind CSS v4 compiled build (`@tailwindcss/vite` without development CDNs).
- **Backend**: Node.js & Express REST API (`0.0.0.0` with `PORT` environment variable support).
- **Calculation Core**: Pure deterministic ES modules with comprehensive test suite (`node:test`).
- **Containerization**: Clean cross-platform multi-stage Dockerfile (`node:20-alpine`) free of platform-specific binaries.
- **Data Persistence**: In-memory synthetic datastore with persistent client fallback for high-reliability demo presentations.

---

## Automated Testing

Run the deterministic calculation, fatigue, and end-to-end API lifecycle test suite:

```bash
npm test
```

### Verified Test Suite (16 Automated Tests Passing)
- `calculateDurationHours`: Verified accurate decimal hour calculation and inverted timestamp rejection.
- `calculateShiftEarnings`: Verified exact regular pay calculations.
- `calculateShiftEarnings`: Verified overtime math with custom multipliers.
- `evaluateFatigueRisk`: Verified daily duty limit threshold warnings.
- `evaluateFatigueRisk`: Verified critical alerts for insufficient rest periods between shifts.
- `Seed data isolation`: Verified strict separation between construction and college organization datasets.
- `GET /api/health`: Verified healthcheck response and synthetic data disclosure.
- `GET /api/org/:orgId/data`: Scoped retrieval verifying data isolation.
- `POST /api/shifts/check-in`: Validated organization membership and rejected cross-org worker injection.
- `POST /api/reports`: Validated issue categories, severity enums, and required fields.
- `PATCH /api/reports/:id`: Verified status transitions (`OPEN` -> `RESOLVED`) and supervisor resolution notes.
- `POST /api/shifts/check-out`: Full check-in to check-out calculation lifecycle.

---

## Running Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RoshwinNiketh/fairshift.git
   cd fairshift
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the production frontend**:
   ```bash
   npm run build
   ```

4. **Start the production server**:
   ```bash
   npm start
   ```
   Open `http://localhost:8080` in your browser.

---

## Google Cloud Run Deployment

FairShift is packaged as a standard container listening on `0.0.0.0:${PORT}`:

### Option A: Direct Google Cloud Run Deployment (Source-based)
```bash
gcloud run deploy fairshift \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

### Option B: Cloud Build & Container Registry
```bash
# 1. Build and push image to Google Artifact Registry
gcloud builds submit --tag gcr.io/[PROJECT_ID]/fairshift:latest

# 2. Deploy to Cloud Run
gcloud run deploy fairshift \
  --image gcr.io/[PROJECT_ID]/fairshift:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

---

## License & Attribution

Developed for PromptWars / SDG 8 Hackathon 2026. All synthetic data and personnel profiles are fictional.
