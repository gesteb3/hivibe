import {cookies} from 'next/headers';
import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(req.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({message:'Origen no permitido'},{status:403});
 const token=(await cookies()).get('hv_session')?.value;
 return NextResponse.json(token?{token}:{message:'Sin sesión'},{status:token?200:401,headers:{'Cache-Control':'no-store'}});
}
