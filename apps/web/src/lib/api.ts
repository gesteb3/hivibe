export class ApiError extends Error {constructor(message:string,public status:number){super(message);this.name='ApiError'}}
export async function api<T>(path:string,options:{method?:string;body?:unknown|FormData}={}):Promise<T>{
 const form=typeof FormData!=='undefined'&&options.body instanceof FormData;
 let response:Response;
 try{response=await fetch('/api/backend'+path,{method:options.method||'GET',credentials:'same-origin',cache:'no-store',headers:options.body&&!form?{'Content-Type':'application/json'}:{},...(options.body?{body:form?options.body as FormData:JSON.stringify(options.body)}:{})});}
 catch{throw new ApiError('No pudimos conectar. Revisa tu conexión e intenta de nuevo.',0)}
 const data=await response.json().catch(()=>({}));
 if(!response.ok){if(response.status===401&&typeof window!=='undefined'&&!path.startsWith('/auth/'))window.dispatchEvent(new Event('hivibe:unauthorized'));throw new ApiError(Array.isArray(data.message)?data.message.join('. '):data.message||'No se pudo completar la acción.',response.status)}
 return data as T;
}
