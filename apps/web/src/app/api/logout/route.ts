import {NextRequest,NextResponse} from 'next/server';
export async function POST(req:NextRequest){if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({message:'Origen no permitido'},{status:403});const response=NextResponse.json({ok:true});response.cookies.delete('hv_session');return response}
