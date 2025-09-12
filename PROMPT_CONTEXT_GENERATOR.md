# Task
You are an expert AI software architect, DevOps engineer, and technical writer.  
Your job is to **analyze the entire DeenMate project** (both backend API and management/admin dashboard) and produce a **single, detailed, production-grade project context document**.

# Input
- Source code repository (both backend and admin dashboard)
- Documentation files (`README.md`, `TODO.md`, `PROJECT_TRACKING.md`, `ADMIN_DASHBOARD_ROADMAP.md`)
- Discussions and architectural decisions (provided below, if available)
- Existing context files (e.g., `PROJECT_CONTEXT.md`)

# Output Requirements
Produce a single file named:  
`PROJECT_CONTEXT.md`

This file must:
- Be **Markdown-formatted**, human-readable but structured enough for AI tools to parse.
- Include **every relevant technical detail** about:
  - 📦 Backend architecture
  - 🗄️ Database schemas, relationships, and migrations
  - 🔌 API endpoints (public + admin)
  - 🛠️ Sync mechanisms (cron + manual)
  - 🔐 Authentication & Authorization
  - 🎛️ Admin Dashboard architecture, pages, and components
  - 🧩 Module-by-module breakdown (Quran, Hadith, Prayer, Zakat, Finance, Audio, Admin)
  - 📊 Monitoring, metrics, and logging strategy
  - 🚀 Deployment strategy (Docker, scaling, cloud)
  - 🧪 Testing approach (unit, integration, E2E)
  - ⚠️ Safeguards, rollback procedures, and critical warnings
  - 🔮 Future roadmap (planned features)
- Be **safe to use as reference** by any model (no API keys, no private secrets).
- Contain **instructions for future developers** to avoid hallucinations or architectural drift.
- Follow a **logical, sectioned layout** with headings, tables, and code blocks where appropriate.
- Capture **real-world numbers** (record counts, sync frequency, example data, etc.) if available.

# Special Notes
- Treat this file as the **single source of truth**.
- Use plain English, no abbreviations without explanation.
- Prioritize correctness and completeness over brevity.
- Always explicitly mention fallback logic, dependencies, and external integrations.
- Include **critical files that must never be deleted or renamed**.
- Document **all known risks** and edge cases.

# Expected Sections
1. Executive Summary
2. Vision & Purpose
3. System Architecture (Monolithic Overview)
4. Backend Modules (one section per module)
5. Admin Dashboard Architecture
6. Database Schema (tables, relationships, migrations)
7. API Contracts (public and admin)
8. Sync Architecture (cron, manual triggers, job queues)
9. Authentication & Security
10. Deployment & Scaling
11. Monitoring & Logging
12. Testing & Quality Assurance
13. Critical Safeguards & Rollback Plans
14. Future Roadmap
15. Appendix: Documentation Index and External References

# Goal
By the end, you will produce a **complete, authoritative, AI-safe, developer-ready context document** that any future team member or AI model can use to understand and safely work on DeenMate without breaking the structure, APIs, or workflows.
