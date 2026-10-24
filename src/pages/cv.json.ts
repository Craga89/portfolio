// The CV as JSON Resume (src/cv.json).
import type { APIRoute } from 'astro';
import cv from '../cv.json';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(cv, null, 2) + '\n', { headers: { 'content-type': 'application/json' } });
