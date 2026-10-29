import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
export const dynamic='force-dynamic';
async function proxy(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 const {path}=await params;
 if(path.some(part=>!part||part==='.'||part==='..'||part.includes('/')||part.includes('\\')))return NextResponse.json({message:'Ruta inválida'},{status:400});
 if(req.method!=='GET'&&req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({message:'Origen no permitido'},{status:403});
 const jar=await cookies(); const token=jar.get('hv_session')?.value;
 const route=path.join('/');const login=route==='auth/login'&&req.method==='POST';
 const publicRoute=route==='auth/register'||login||route==='health'||(path.length===2&&path[0]==='users'&&path[1]!=='me'&&req.method==='GET');
 if(!token&&!publicRoute)return NextResponse.json({message:'Inicia sesión para continuar.'},{status:401});
 try{
 const headers:Record<string,string>={};
 if(token)headers.Authorization='Bearer '+token;
 const contentType=req.headers.get('content-type');if(contentType)headers['Content-Type']=contentType;
 let body:ArrayBuffer|undefined;
 if(req.method!=='GET'){if(Number(req.headers.get('content-length')||0)>6*1024*1024)return NextResponse.json({message:'Archivo demasiado grande'},{status:413});body=await req.arrayBuffer();if(body.byteLength>6*1024*1024)return NextResponse.json({message:'Archivo demasiado grande'},{status:413})}
 const base=(process.env.API_URL||'http://localhost:4300/api').replace(/\/$/,'');
 const upstream=await fetch(base+'/'+path.map(encodeURIComponent).join('/')+req.nextUrl.search,{method:req.method,headers,body,cache:'no-store',signal:AbortSignal.timeout(20000)});
 const data=await upstream.json().catch(()=>({message:'Respuesta inesperada de la API.'}));
 const response=NextResponse.json(login&&upstream.ok?{user:data.user}:data,{status:upstream.status,headers:{'Cache-Control':'no-store'}});
 if(login&&upstream.ok)response.cookies.set('hv_session',data.accessToken,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:data.expiresIn||3600});
 if(upstream.status===401&&!login)response.cookies.delete('hv_session');
 return response;
 }catch{return NextResponse.json({message:'El servidor no responde. Intenta otra vez en unos segundos.'},{status:502})}
}
export {proxy as GET,proxy as POST,proxy as PATCH,proxy as DELETE};
