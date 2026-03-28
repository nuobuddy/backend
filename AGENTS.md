# Nuobuddy Backend — Coding Guidelines

## Project Overview

This is the backend service for the **Nuobuddy AI Agent Chatbot**, built with:

- **Runtime**: Node.js (>=18)
- **Language**: TypeScript (strict mode)
- **Framework**: Express.js
- **Build tool**: tsup
- **Package manager**: pnpm

---

## Directory Structure

```
src/
  lib/          # Shared utilities and helpers (response, logger, etc.)
  types/        # Global TypeScript type declarations
  routes/       # Express route definitions, grouped by domain
  middleware/   # Custom Express middleware
  services/     # Business logic and AI agent integrations
  config/       # Configuration loaders (env, constants)
  main.ts       # Application entry point
```

Use `@/` as the path alias for `src/`. Example:

```ts
import { sendSuccess } from '@/lib/response'
```

---

## TypeScript Rules

- Always enable **strict mode**. Never use `any` unless absolutely necessary — prefer `unknown` and narrow with type guards.
- Define shared types in `src/types/`. Avoid inline type definitions for reused structures.
- Use `interface` for object shapes; use `type` for unions, intersections, and utility types.
- Always annotate function return types for exported functions.
- Never use `@ts-ignore`. Use `@ts-expect-error` only with a comment explaining why.

---

## HTTP API Response

All API responses must use the unified `ApiResponse` structure from `@/lib/response`:

```ts
interface ApiResponse<T = unknown> {
  status: number | string
  data?: T
  message?: string
}
```

Use the provided helper functions:

| Function          | Description                    |
|-------------------|--------------------------------|
| `sendSuccess`     | 2xx response with optional data/message |
| `sendError`       | 4xx generic error              |
| `sendNotFound`    | 404 Not Found                  |
| `sendUnauthorized`| 401 Unauthorized               |
| `sendForbidden`   | 403 Forbidden                  |
| `sendServerError` | 500 Internal Server Error      |

**Never** use `res.json()` directly in route handlers — always use the helpers above.

### Example

```ts
import { sendSuccess, sendNotFound } from '@/lib/response'

router.get('/users/:id', async (req, res) => {
  const user = await UserService.findById(req.params.id)
  if (!user) return sendNotFound(res, 'User not found')
  sendSuccess(res, user)
})
```

---

## Code Style

- **Max line length**: 144 characters
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Always required at end of statements
- **Trailing commas**: Required for multi-line objects and arrays
- **No unused variables**: Prefix unused parameters with `_` (e.g., `_req`)

ESLint enforces all of the above. Run before committing:

```bash
pnpm lint        # Check
pnpm lint:fix    # Auto-fix
```

---

## Git Workflow

### Branch Naming

Follow **git-flow** conventions:

| Branch type  | Pattern              |
|--------------|----------------------|
| Feature      | `feature/<name>`     |
| Bug fix      | `fix/<name>`         |
| Release      | `release/<version>`  |
| Hotfix       | `hotfix/<name>`      |
| Development  | `develop`            |
| Production   | `main`               |

### Commit Message Format

All commit messages must follow **Conventional Commits**:

```
<type>(<scope>): <short description>
```

**Allowed types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

**Examples**:
```
feat: add conversation history endpoint
fix(auth): resolve JWT refresh race condition
docs: update environment variable reference
chore: upgrade express to v4.21
refactor(agent): extract tool execution into service layer
```

Merge commits may use: `Merge <source> into <target>`

The `commit-msg` hook enforces this format automatically.

---

## Environment Variables

- Store all secrets and configuration in `.env` (never commit `.env` to version control)
- Provide `.env.example` with all required keys and placeholder values
- Access env vars only through a typed config module (e.g., `src/config/env.ts`)

---

## Error Handling

- Use try/catch in all async route handlers or use an async wrapper middleware
- Pass errors to Express's error handler via `next(err)`
- Do **not** leak stack traces or internal error details in production responses
- Log errors server-side with full context before sending a sanitized response

---

## AI Agent Integration

- Keep AI provider SDKs isolated in `src/services/`
- Define message schemas and tool definitions with explicit TypeScript types
- Never hardcode prompts in route handlers — store them in `src/config/` or dedicated prompt files
- Handle and log all AI API errors explicitly; do not let them bubble as unhandled rejections

---

## Scripts Reference

| Command          | Description                          |
|------------------|--------------------------------------|
| `pnpm dev`       | Start dev server with hot reload     |
| `pnpm build`     | Compile for production via tsup      |
| `pnpm start`     | Run compiled production build        |
| `pnpm type-check`| Run TypeScript type check (no emit)  |
| `pnpm lint`      | Run ESLint                           |
| `pnpm lint:fix`  | Run ESLint with auto-fix             |
