import {NextRequest,NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/request-origin';
export async function POST(req:NextRequest){if(!sameOrigin(req))return NextResponse.json({message:'Origen no permitido'},{status:403});const response=NextResponse.json({ok:true});response.cookies.delete('hv_session');return response}
