import Link from 'next/link';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {AppShell} from '@/components/shell';
import {ProfileView} from '@/components/social';
import {Avatar,Brand} from '@/components/brand';
import type {User} from '@/lib/types';

export async function generateMetadata({params}:{params:Promise<{username:string}>}){return {title:'Perfil de @'+(await params).username}}
export default async function Profile({params}:{params:Promise<{username:string}>}){
  const {username}=await params;
  if((await cookies()).has('hv_session'))return <AppShell><ProfileView username={username}/></AppShell>;
  const response=await fetch((process.env.API_URL||'http://localhost:4300/api').replace(/\/$/,'')+'/users/'+encodeURIComponent(username),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(response.status===404)notFound();
  if(!response.ok)throw new Error('No se pudo consultar el perfil');
  const user:User=await response.json();
  return <div className="public-profile"><header className="public-header"><Brand/><Link href="/login" className="btn btn-primary">Entra a HiVibe ↗</Link></header><main id="contenido" className="public-profile-content stack"><section className="panel profile-hero"><div className="profile-cover">{user.coverUrl?<img src={user.coverUrl} alt={'Portada de '+user.displayName}/>:<><span className="cover-star star-two">✶</span></>}</div><div className="profile-header"><div className="profile-identity"><Avatar user={user} size="large"/><div><h1>{user.displayName}</h1><p className="muted">@{user.username}</p></div></div></div><div className="stat-row"><span><strong>{user.postsCount||0}</strong> publicaciones</span><span><strong>{user.followersCount||0}</strong> seguidores</span><span><strong>{user.followingCount||0}</strong> cuates</span></div><div className="panel-body profile-bio">{user.bio||'Sin biografía.'}</div></section><section className="panel"><div className="empty-state"><h2>Inicia sesión para ver las publicaciones</h2><p>También podrás seguir a este usuario y enviarle mensajes.</p><div className="button-row" style={{justifyContent:'center',marginTop:20}}><Link className="btn btn-primary" href="/registro">Crear cuenta</Link><Link className="btn" href="/login">Ya tengo cuenta</Link></div></div></section></main></div>
}
