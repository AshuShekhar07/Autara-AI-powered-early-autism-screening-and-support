# AI Autism Diagnosis Assistant

> **Responsible, Explainable AI for Early ASD Screening & Behavioral Support**

[![Track: Generative AI](https://img.shields.io/badge/Track-Generative%20AI-blue.svg)](https://github.com/)
[![Domain: HealthTech](https://img.shields.io/badge/Domain-HealthTech-green.svg)](https://github.com/)
[![Role: Human--in--the--Loop](https://img.shields.io/badge/Clinical%20Safety-Human--in--the--Loop-orange.svg)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Executive Summary

The **AI Autism Diagnosis Assistant** is an AI-assisted screening and behavior-support platform designed to support early detection of Autism Spectrum Disorder (ASD), track day-to-day behavioral patterns, and translate complex data into clear, explainable insights for clinicians, therapists, caregivers, and administrators.

> ⚠️ **Important Clinical & Responsible AI Disclaimer:**
> This platform is intentionally built as a **screening-support system**, NOT a diagnostic authority. It flags risk scores, correlates behavioral patterns, and generates evidence-backed insights to assist clinical evaluation. **A qualified clinician remains fully responsible for final diagnostic decisions.**

---

## 👥 Project Identity & Team

* **Track:** Generative AI
* **Domain:** HealthTech — Autism Screening & Behavioral Support
* **Team Members:**
  * **Ashu Shekhar** (`PST-25-022`)
  * **Shivam Mishra** (`PST-25-0149`)
* **Skill Level:** Intermediate
* **Primary Target Users:** Clinicians, Therapists, Caregivers, System Admins

---

## 🔄 Core Product Flow

```
[ Screening Questionnaire (M-CHAT-R) / ABC Behavior Log ]
                         │
                         ▼
             [ Upload & Data Validation ]
                         │
                         ▼
          [ Role-Based Authentication (RBAC) ]
                         │
                         ▼
     [ AI Classification Model & Risk Scoring ]
                         │
                         ▼
        [ Behavioral Trend Aggregation (ABC) ]
                         │
                         ▼
   [ LLM-Assisted Plain-Language Insight Generation ]
                         │
                         ▼
          [ Clinical Dashboard Presentation ]
                         │
                         ▼
    [ Clinician Review / Override / Annotation ]
                         │
                         ▼
            [ Report Export (PDF / CSV) ]
```

---

## ✨ Features & Functional Breakdown

### 🎯 Minimum Viable Product (MVP)

1. **Role-Based Authentication & Authorization (RBAC):** Secure access control tailored for Clinicians, Therapists, Caregivers, and Admins.
2. **M-CHAT-R Style Screening Questionnaire:** Standardized early screening tool with automated scoring logic.
3. **AI Classification Model:** Risk scoring engine that outputs overall risk levels with flagged focus areas.
4. **Structured ABC Behavior Logging:** Antecedent-Behavior-Consequence (ABC) logging tool for tracking environmental triggers and outcomes over time.
5. **Diagnosis & Insights Dashboard:** Interactive visualization of behavioral trends, frequency distributions, and trigger correlations.
6. **REST API:** Fully documented endpoints covering all core screening, logging, and reporting operations.
7. **Report Generation & Export:** Downloadable PDF and CSV clinical summaries.
8. **Admin Analytics Panel:** Aggregated, anonymized system-wide trends and usage statistics.

### 🌟 Extended & Future Scope (Prioritized)

* **LLM Trigger-Correlation Insights:** Deep text analysis linking behavior antecedents to specific environmental triggers.
* **Explainable Screening Scores:** Traceable score provenance linking flagged risks directly back to exact questionnaire responses or log entries.
* **Pattern-Based Push Notifications:** Automated alerts when behavioral frequency spikes occur.
* **Shared Clinician-Caregiver Timeline:** Unified chronological history of medical events, screenings, and behavioral logs.
* **Dark Mode & Plain-Language Toggle:** Accessible UI customization for caregiver clarity and low-light clinical environments.

---

## 📊 Product State Machine

Every screening record flows through a strictly tracked lifecycle to maintain clinical workflow integrity:

```
[ DRAFT ] ────────► [ SCREENING_SUBMITTED ] ────────► [ PROCESSING ]
                                                             │
                                             ┌───────────────┴───────────────┐
                                             ▼                               ▼
                                   [ INSIGHTS_READY ]              [ PROCESSING_FAILED ]
                                             │
                                             ▼
                              [ UNDER_CLINICAL_REVIEW ]
                                             │
                                             ▼
                                       [ REVIEWED ]
```

---

## 💡 Core Design & Responsible AI Principles

1. **Evidence Before Explanation:** Every AI insight must be tied to explicit questionnaire inputs or verified behavior logs.
2. **Human-in-the-Loop:** Professional clinical judgment is non-negotiable; clinicians can annotate, adjust, or override AI screening flags.
3. **Explicit Uncertainty:** Risk scores and LLM outputs prominently state confidence levels and data limitations.
4. **No Autonomous Claims:** Strictly no unsupported or independent diagnostic labeling.
5. **Traceability:** Full provenance for every AI output down to specific inputs and model context.

---

## 🚫 Scope Boundaries & Constraints

To ensure safety, responsible AI practice, and realistic project delivery:

* **No Autonomous Diagnosis:** The platform never outputs a standalone diagnostic verdict.
* **No Production Clinical Deployment / Real PII:** Built for demonstration and simulated datasets; no production EHR integrations.
* **No Pre-trained LLM from Scratch:** Utilizes foundation models via standard API fine-tuning/prompt engineering.
* **No Regulatory Claims:** Not certified as a FDA/CE medical device software.

---

## 📜 User Stories Summary

| ID | As a... | I want to... | So that... |
| :--- | :--- | :--- | :--- |
| **US-001** | Caregiver | Complete an M-CHAT-R questionnaire | Early signs of ASD are flagged for clinical review |
| **US-002** | Caregiver / Therapist | Log ABC behavior events | Triggers and behavioral patterns are tracked over time |
| **US-003** | Clinician | View flagged areas linked to exact inputs | I can audit and verify the underlying AI risk score |
| **US-004** | Clinician | Access behavioral trend charts | I can evaluate trigger frequencies across time intervals |
| **US-005** | Clinician | Receive plain-language AI insights | I quickly grasp complex behavioral data trends |
| **US-006** | Clinician | Annotate or override screening results | Clinical judgment remains the final authority |
| **US-007** | Admin / Auditor | Maintain full workflow audit logs | All actions and decisions remain traceable |

---

## 🛠 Tech Stack (Suggested Implementation)

* **Frontend:** React.js / Next.js, Tailwind CSS, Recharts / Chart.js
* **Backend:** Python (FastAPI / Django) or Node.js (Express)
* **AI & Analytics:** OpenAI API / Anthropic Claude API (LLM Insights), Scikit-Learn / PyTorch (Risk Classification Model)
* **Database:** PostgreSQL (Relational Data & Audit Logs), Redis (Caching/Queue)
* **Reporting:** WeasyPrint / ReportLab (PDF Generation), Pandas (CSV Export)
* **API Spec:** OpenAPI 3.0 / Swagger UI

---

## 📄 License

This project is developed under the **MIT License** for academic and research purposes.