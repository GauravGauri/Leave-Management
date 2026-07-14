import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'Not Set (Defaults to http://localhost:5000/api)';
  const nextauthUrl = process.env.NEXTAUTH_URL || 'Not Set';
  const nodeEnv = process.env.NODE_ENV || 'development';

  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      NEXT_PUBLIC_API_URL: nextPublicApiUrl,
      NEXTAUTH_URL: nextauthUrl,
      NODE_ENV: nodeEnv,
    },
    backendConnectivity: {},
  };

  const targetUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  try {
    const startTime = Date.now();
    // Ping the backend API base endpoint
    const response = await axios.get(targetUrl, { timeout: 5000 });
    const duration = Date.now() - startTime;

    diagnostics.backendConnectivity = {
      status: 'SUCCESS',
      targetUrl: targetUrl,
      responseTimeMs: duration,
      httpStatus: response.status,
      responseData: response.data,
    };
  } catch (err: any) {
    diagnostics.backendConnectivity = {
      status: 'FAILED',
      targetUrl: targetUrl,
      errorMessage: err.message,
      code: err.code,
      responseStatus: err.response?.status || null,
      responseData: err.response?.data || null,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
