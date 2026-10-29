import type { NextRequest } from 'next/server';
/** Next puede usar 0.0.0.0 internamente; el Host corresponde al origen que visita el navegador. */
export function sameOrigin(request: NextRequest): boolean {
  if(request.headers.get('sec-fetch-site')==='cross-site')return false;
  try {const origin=new URL(request.headers.get('origin')||'');return ['https:','http:'].includes(origin.protocol)&&origin.host===request.headers.get('host');}catch{return false;}
}
