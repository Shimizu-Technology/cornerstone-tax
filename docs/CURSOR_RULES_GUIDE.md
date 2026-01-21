# Cursor Rules Setup Guide

A guide for creating `.cursor/rules/` files that give AI context about your project.

---

## Table of Contents
1. [What Are Cursor Rules?](#1-what-are-cursor-rules)
2. [File Structure](#2-file-structure)
3. [Rule File Format](#3-rule-file-format)
4. [Recommended Rules Structure](#4-recommended-rules-structure)
5. [Templates by Project Type](#5-templates-by-project-type)
6. [What to Include](#6-what-to-include)
7. [Tips & Best Practices](#7-tips--best-practices)

---

## 1. What Are Cursor Rules?

Cursor rules are markdown files (`.mdc`) that provide context to the AI about your project. They help the AI:

- Understand your tech stack and conventions
- Follow your coding standards
- Know your project structure
- Make consistent decisions

**Without rules**: AI might suggest React class components, wrong file locations, or patterns you don't use.

**With rules**: AI suggests code that fits YOUR project's style.

---

## 2. File Structure

```
your-project/
├── .cursor/
│   └── rules/
│       ├── project.mdc      # Core project context (always applied)
│       ├── frontend.mdc     # Frontend-specific rules
│       ├── backend.mdc      # Backend-specific rules
│       ├── database.mdc     # Database conventions
│       └── ai-service.mdc   # Additional service rules
├── frontend/
├── backend/
└── ...
```

### File Naming
- Use `.mdc` extension (Markdown for Cursor)
- Name by area: `project`, `frontend`, `backend`, `database`, `testing`, etc.
- Keep names simple and descriptive

---

## 3. Rule File Format

Each `.mdc` file has a YAML frontmatter header followed by Markdown content.

### Frontmatter Options

```yaml
---
description: Brief description of what this rule file covers
alwaysApply: true|false
globs: ["pattern/**/*"]
---
```

| Field | Purpose | When to Use |
|-------|---------|-------------|
| `description` | Explains the rule file | Always include |
| `alwaysApply` | Load for every conversation | Use for core project rules |
| `globs` | Load when files match pattern | Use for area-specific rules |

### When Rules Apply

| Setting | Applies When |
|---------|-------------|
| `alwaysApply: true` | Every conversation in this workspace |
| `globs: ["frontend/**/*"]` | Working on files matching that pattern |
| Both false/empty | Manually referenced or context-matched |

### Example Header

```yaml
---
description: Frontend development rules for React/Vite/Tailwind
globs: ["frontend/**/*"]
alwaysApply: false
---
```

---

## 4. Recommended Rules Structure

### For Full-Stack Projects (React + Rails/Node)

```
.cursor/rules/
├── project.mdc      # alwaysApply: true
├── frontend.mdc     # globs: ["frontend/**/*"]
├── backend.mdc      # globs: ["backend/**/*"]
└── database.mdc     # globs: ["**/db/**/*", "**/models/**/*"]
```

### For Frontend-Only Projects

```
.cursor/rules/
├── project.mdc      # alwaysApply: true
└── components.mdc   # Optional: specific component patterns
```

### For Backend-Only Projects

```
.cursor/rules/
├── project.mdc      # alwaysApply: true
├── api.mdc          # API design patterns
└── database.mdc     # Database conventions
```

### For Monorepo with Multiple Services

```
.cursor/rules/
├── project.mdc         # alwaysApply: true
├── web-app.mdc         # globs: ["apps/web/**/*"]
├── mobile-app.mdc      # globs: ["apps/mobile/**/*"]
├── api-service.mdc     # globs: ["services/api/**/*"]
└── shared.mdc          # globs: ["packages/**/*"]
```

---

## 5. Templates by Project Type

### 5.1 Core Project Rules (Always Include)

This is your `project.mdc` - the foundation. Always set `alwaysApply: true`.

```markdown
---
description: Core project context and guiding principles
alwaysApply: true
---

# Project Name

## What This Project Is
Brief description of what you're building and for whom.

## Tech Stack
- **Frontend**: [React/Vue/etc] + [Build tool] + [CSS solution]
- **Backend**: [Rails/Node/etc]
- **Database**: [PostgreSQL/MySQL/etc]
- **Auth**: [Clerk/Auth0/etc]
- **Hosting**: [Netlify/Vercel/etc] + [Render/Railway/etc]

## Guiding Principles

### 1. [First Principle]
Explanation of the principle.

### 2. [Second Principle]
Explanation of the principle.

### 3. [Third Principle]
Explanation of the principle.

## User Roles
- **Admin**: What they can do
- **User**: What they can do

## Key Domain Concepts
- **Term 1**: Definition
- **Term 2**: Definition

## Current Status
- ✅ Completed feature
- 🔜 Upcoming feature
- ❌ Not planned
```

### 5.2 React Frontend Rules

```markdown
---
description: Frontend development rules for React
globs: ["frontend/**/*", "src/**/*"]
alwaysApply: false
---

# Frontend Rules

## Tech
- React with [Vite/Next.js/CRA]
- [Tailwind CSS/CSS Modules/styled-components]
- TypeScript [preferred/required/not used]

## Component Patterns
- Functional components with hooks only
- Keep components small and focused
- Extract reusable components to `components/ui/`

## File Structure
\`\`\`
src/
├── components/
│   ├── ui/           # Reusable components
│   └── forms/        # Form components
├── pages/            # Page components
├── hooks/            # Custom hooks
├── lib/              # Utilities, API client
└── types/            # TypeScript types
\`\`\`

## Styling
- Use [Tailwind utilities / CSS Modules / etc]
- Mobile-first approach
- Minimum touch targets: 44x44px

## API Calls
- Use centralized API client at `lib/api.ts`
- Handle loading and error states
- [Token handling pattern]

## Forms
- Use [controlled components / React Hook Form / etc]
- Validation [inline / on submit]
- Required fields marked with asterisk
```

### 5.3 Rails Backend Rules

```markdown
---
description: Backend development rules for Rails API
globs: ["backend/**/*"]
alwaysApply: false
---

# Rails Backend Rules

## General
- Rails 7+ in API mode
- Ruby 3.2+
- PostgreSQL

## Naming Conventions
- Models: singular, CamelCase (`User`, `TaxReturn`)
- Tables: plural, snake_case (`users`, `tax_returns`)
- Controllers: plural (`UsersController`)

## API Structure
- Namespace under `Api::V1`
- RESTful routes
- JSON responses

## Controllers
- Keep controllers thin
- Complex logic in service objects
- Use strong parameters

## Services
- Put business logic in `app/services/`
- Name: `{Action}{Resource}Service`
- Single responsibility

## Authentication
[Describe your auth pattern]

## File Structure
\`\`\`
backend/
├── app/
│   ├── controllers/api/v1/
│   ├── models/
│   ├── services/
│   └── jobs/
├── config/
└── db/migrate/
\`\`\`
```

### 5.4 Node.js/Express Backend Rules

```markdown
---
description: Backend development rules for Node.js/Express
globs: ["backend/**/*", "api/**/*"]
alwaysApply: false
---

# Node.js Backend Rules

## General
- Node.js 18+
- Express.js
- TypeScript

## File Structure
\`\`\`
src/
├── routes/           # Route definitions
├── controllers/      # Request handlers
├── services/         # Business logic
├── models/           # Database models
├── middleware/       # Custom middleware
└── utils/            # Helpers
\`\`\`

## API Design
- RESTful endpoints
- Consistent response format: `{ data?, error?, message? }`
- Use proper HTTP status codes

## Error Handling
- Centralized error handler
- Custom error classes
- Don't expose internal errors to clients

## Database
- [Prisma/Sequelize/Mongoose]
- Migrations for schema changes
- Use transactions for multi-step operations
```

### 5.5 Database Rules

```markdown
---
description: Database schema and conventions
globs: ["**/db/**/*", "**/migrations/**/*", "**/models/**/*"]
alwaysApply: false
---

# Database Rules

## General
- PostgreSQL
- [Rails migrations / Prisma / etc]

## Naming Conventions
- Tables: plural, snake_case
- Columns: snake_case
- Foreign keys: `{table_singular}_id`

## Required Columns
Every table should have:
- `id` (primary key)
- `created_at`
- `updated_at`

## Relationships
- `users` → has many `posts`
- `posts` → belongs to `user`
[Document your specific relationships]

## Indexes
Always add indexes for:
- Foreign keys
- Columns used in WHERE clauses
- Unique constraints

## Soft Delete
Use `deleted_at` timestamp instead of actually deleting.
```

---

## 6. What to Include

### Always Include ✅

| Topic | Why |
|-------|-----|
| Tech stack | AI needs to know what frameworks/libraries |
| File structure | Where to put new files |
| Naming conventions | Consistent code style |
| Key patterns | How you do auth, API calls, etc. |
| Domain concepts | Business terms AI should understand |

### Good to Include 👍

| Topic | Why |
|-------|-----|
| Branding/styling | Color palette, design system |
| Common gotchas | Things that frequently cause issues |
| Testing patterns | How you write tests |
| Deployment info | Where things run |

### Skip ❌

| Topic | Why |
|-------|-----|
| Detailed API docs | Too verbose, changes often |
| Every environment variable | Reference .env.example instead |
| Step-by-step tutorials | This is context, not documentation |
| Code snippets for everything | Only include key patterns |

---

## 7. Tips & Best Practices

### Keep It Concise
- Aim for 50-150 lines per file
- Use bullet points, not paragraphs
- Tables are great for reference info

### Update Regularly
- Update when you add new patterns
- Update when conventions change
- Remove outdated info

### Use Code Blocks Sparingly
Only include code examples for:
- Key patterns the AI should follow
- Things that are frequently done wrong
- Complex configurations

```markdown
## Authentication Pattern
\`\`\`ruby
before_action :authenticate_user!
before_action :require_admin!, only: [:destroy]
\`\`\`
```

### Reference, Don't Duplicate
If something is well-documented elsewhere, reference it:

```markdown
## Environment Variables
See `.env.example` for all required variables.
```

### Be Specific About Preferences
Vague:
> Use good naming conventions.

Specific:
> - Components: PascalCase (`UserProfile.tsx`)
> - Hooks: camelCase with `use` prefix (`useAuth`)
> - Utils: camelCase (`formatDate`)

### Include "Don't Do" Rules
Sometimes it's helpful to specify what NOT to do:

```markdown
## Don'ts
- Don't use class components (use functional with hooks)
- Don't use `any` type in TypeScript
- Don't put business logic in controllers
```

---

## Quick Start

### 1. Create the folder structure

```bash
mkdir -p .cursor/rules
```

### 2. Create project.mdc (required)

```bash
touch .cursor/rules/project.mdc
```

Add your project context with `alwaysApply: true`.

### 3. Create area-specific rules (as needed)

```bash
touch .cursor/rules/frontend.mdc
touch .cursor/rules/backend.mdc
```

Add rules with appropriate `globs`.

### 4. Test it

Start a new Cursor conversation and ask the AI about your project. It should know your tech stack, conventions, and structure.

---

## Minimal Starter Template

For a quick start, copy this to `.cursor/rules/project.mdc`:

```markdown
---
description: Core project context
alwaysApply: true
---

# [Project Name]

## Tech Stack
- **Frontend**: 
- **Backend**: 
- **Database**: 
- **Hosting**: 

## Key Conventions
- 

## File Structure
\`\`\`
[your structure]
\`\`\`

## Current Status
- ✅ 
- 🔜 
```

---

*Last updated: January 2026*
