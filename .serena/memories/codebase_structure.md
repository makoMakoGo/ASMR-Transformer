# Codebase Structure

## Directory Layout
```
app/
├── api/
│   └── polish/
│       └── route.ts          # LLM 文本润色 API endpoint
├── globals.css               # Global styles
├── layout.tsx                # Root layout with metadata
└── page.tsx                  # Main page (audio transcription UI)
```

## Key Components

### app/page.tsx (Main UI)
- Client component with complete audio transcription workflow
- Features:
  - File upload and microphone recording
  - Real-time upload progress tracking
  - ASR transcription via SiliconFlow API
  - LLM-based text polishing
  - Detailed logging system
  - Copy to clipboard functionality

### app/api/polish/route.ts
- Server-side API route for LLM text polishing
- Accepts: text, apiUrl, model (apiKey optional)
- Calls OpenAI-compatible chat completion endpoint
- System prompt: 纠错、标点、分段排版，保持原意

## Configuration
- Next.js config: default output (local Node.js deployment)
- TypeScript: strict mode, ES2017 target
- Path alias: `@/*` maps to project root
