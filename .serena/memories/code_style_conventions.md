# Code Style and Conventions

## TypeScript
- Strict mode enabled
- Explicit type annotations for function parameters and returns
- Use `type` for object shapes, interfaces for extensible contracts
- React 19 types: `React.ReactNode`, `React.ChangeEvent<T>`

## React/Next.js Patterns
- Use `'use client'` directive for client components
- Server components by default (no directive needed)
- API routes in `app/api/*/route.ts` with named exports (GET, POST, etc.)
- Use Next.js `NextRequest` and `NextResponse` for API routes

## Naming Conventions
- Components: PascalCase (e.g., `Home`, `RootLayout`)
- Files: kebab-case for routes, PascalCase for components
- Variables/functions: camelCase
- Types: PascalCase
- Constants: camelCase (not SCREAMING_SNAKE_CASE)

## State Management
- Use React hooks (`useState`, `useRef`) for local state
- No external state management library

## Styling
- Tailwind CSS utility classes
- Inline className strings
- Responsive design with Tailwind breakpoints
