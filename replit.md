# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### API Server (`artifacts/api-server`)
Express 5 server with:
- `/api/fetch-page` — 单 URL 抓取，拟人 headers + cheerio 解析
- `/api/fetch-pages` — 批量抓取（最多 20，并发 3，随机延迟）
- `/api/proxies` — 代理池 CRUD（roundrobin/random 策略）
- `/api/proxies/check-all`, `/api/proxies/:id/check` — 健康检测
- `/api/proxies/scheduler/*` — 定时健康检测任务（默认每 5 分钟）
- 数据库持久化：`proxies` + `scheduler_config` 表（Drizzle ORM）

### Proxy Dashboard (`artifacts/proxy-dashboard`)
移动端友好的 React 管理面板（previewPath: `/`），功能：
- 代理池概览（总计/存活/失效 统计卡）
- 代理列表（分组展示，可展开查看详情、检测、删除）
- 单个/批量添加代理
- 定时任务管理（启动/停止/立即运行）
- 使用 `@workspace/api-client-react` 生成的 React Query hooks

## OpenAPI & Codegen
- Spec: `lib/api-spec/openapi.yaml`
- Orval config: `lib/api-spec/orval.config.ts`（zod 用 single 模式避免 api.schemas 冲突）
- Codegen 后处理：`sed -i '/api\.schemas/d' ../api-zod/src/index.ts`
- 生成产物：`lib/api-client-react/src/generated/api.ts`（hooks）、`lib/api-zod/src/generated/api.ts`（Zod schemas）

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
