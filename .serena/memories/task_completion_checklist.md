# Task Completion Checklist

When completing a task in this codebase:

1. **Type Check**: Ensure TypeScript compiles without errors
   - Run `npm run build` to verify

2. **Test Locally**: 
   - Run `npm run dev` and test in browser
   - Verify API endpoints work correctly
   - Test file upload / 在线链接导入 / 润色
   - Test settings: 修改后点击保存写回 `.env`

3. **No Linting/Formatting Tools**: 
   - This project has no ESLint or Prettier configured
   - Follow existing code style manually

4. **Git Commit**:
   - Follow `.gitmessage` template: `<emoji> <type>: <subject>`
   - Example: `✨ feat: 添加设置保存按钮`
