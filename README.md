# Project Balrog

A prototype web application for **AI-assisted inter-trade clash resolution** in AEC/BIM coordination workflows.

The current product direction uses a case study built around the **Snowdon Towers Revit sample models** across architectural, structural, and MEP disciplines.

The system is designed to ingest model references, clash reports, and project requirements, then help users understand clashes in context and move toward resolution faster.

---

## Project goals

- Help teams **resolve** clashes, not only detect them.
- Bring together **multi-trade model context**, clash data, and requirements in one workflow.
- Reduce coordination friction from **trade-isolated** decision-making.
- Use AI to explain clash **context**, **implications**, and **possible resolution paths**.
- Support follow-up coordination actions such as drafting RFIs or emails.

### Business / outcome goal

Demonstrate a compelling prototype that shows how AI can improve BIM coordination by turning raw clash data into **actionable cross-trade resolution support**.

### Product goal

Build a web application where a user can:

1. Paste relevant **Speckle** model URLs
2. Upload a **Navisworks** clash report
3. Inspect clashes by **severity**
4. Run **AI analysis** on a selected clash
5. Receive **contextual explanations**, requirement-aware **implications**, and **possible fixes**
6. Continue with a **chatbot** or **draft coordination output** for follow-up communication

---

## Primary users

- BIM coordinators
- Design and coordination teams working across trades

---

## Problem being addressed

In AEC/BIM workflows, models are often separated by trade for practical reasons. That separation makes independent discipline work easier, but it also creates **coordination blind spots**.

A clash may be visible in a coordination tool, but resolving it well usually needs more than geometry alone. Teams also need:

- Nearby **model context**
- Awareness of **related systems** from other trades
- **Relevant project requirements**
- Support for understanding **downstream implications**

This project is grounded in the idea that the real opportunity is not just clash detection, but **context-aware clash resolution support**.

---

## Architecture

The application uses a **monolithic web app** layout with clear internal boundaries for API, web UI, and infrastructure.

```
.
├── apps/
│   ├── api/
│   └── web/
```

### Structure intent

| Path            | Responsibility                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| **`apps/api/`** | Backend ingestion, analysis orchestration, requirement retrieval, context packaging, and AI-facing application logic |
| **`apps/web/`** | Frontend: model input, clash inspection, severity filtering, AI analysis, chat, and draft coordination workflows     |

---

## Technology Stack

- React frontend
- Python backend

---

## Running locally

Run the **API** and **web app** in separate terminals. Defaults expect the API on port **8000** and Vite on **5173** (CORS in `apps/api/.env.example` already allows `http://localhost:5173`).

### Prerequisites

- **Backend:** Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- **Frontend:** Node.js and [pnpm](https://pnpm.io/) (the web app uses a `pnpm-lock.yaml`)

### Backend (`apps/api`)

```bash
cd apps/api
cp .env.example .env
# Edit .env: set LLM provider, API keys, and CORS if your frontend URL differs.
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Health check: [http://localhost:8000/health](http://localhost:8000/health)
- More detail: [apps/api/README.md](apps/api/README.md)

### Frontend (`apps/web`)

```bash
cd apps/web
pnpm install
pnpm dev
```

- Open the URL Vite prints (typically [http://localhost:5173](http://localhost:5173)).

### Production build (frontend only)

```bash
cd apps/web
pnpm run build
pnpm run preview   # optional: serve the built assets locally
```

---

## Current scope

**Intended workflow**

1. User pastes relevant Speckle model URLs.
2. User uploads a Navisworks clash report.
3. System organizes and filters clashes by severity.
4. User selects a clash and runs AI analysis.
5. System gathers local multi-trade context and relevant requirements.
6. AI returns explanation, implications, and possible resolutions.
7. User continues through chatbot interaction or drafts an email/RFI.

---
