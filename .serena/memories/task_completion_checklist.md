# Task Completion Checklist

When completing a task in this codebase:

1. **Type Check**: Ensure TypeScript compiles without errors
   - Run `npm run build` to verify

2. **Test Locally**: 
   - Run `npm run dev` and test in browser
   - Verify API endpoints work correctly
   - Test file upload and recording features

3. **No Linting/Formatting Tools**: 
   - This project has no ESLint or Prettier configured
   - Follow existing code style manually

4. **Docker Build** (if deployment-related):
   - Test `docker compose up -d --build` succeeds
   - Verify standalone build works

5. **Git Commit**:
   - Use conventional commit format (project uses gitmessage template)
   - Example: `feat: add new feature` or `fix: resolve bug`
