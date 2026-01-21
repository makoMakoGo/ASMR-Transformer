import { NextResponse } from 'next/server'
import { getFetchAudioMaxBytes } from '@/lib/runtime-config'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      fetchAudioMaxBytes: getFetchAudioMaxBytes(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

