import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '../../../../lib/google/oauth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const uid = searchParams.get('uid');

    if (!service || (service !== 'drive' && service !== 'gmail')) {
      return NextResponse.json(
        { error: 'Invalid or missing service query. Must be "drive" or "gmail".' },
        { status: 400 }
      );
    }

    if (!uid) {
      return NextResponse.json(
        { error: 'Missing user ID (uid).' },
        { status: 400 }
      );
    }

    const authUrl = buildAuthUrl(service, uid);
    
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Error initiating Google OAuth:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
