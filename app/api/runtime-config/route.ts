import { NextResponse } from 'next/server'
import { getFetchAudioMaxBytes } from '@/lib/runtime-config'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  const fetchAudioMaxBytes = await getFetchAudioMaxBytes()

  return NextResponse.json(
    {
      fetchAudioMaxBytes,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
