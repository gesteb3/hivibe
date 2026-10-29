'use client';
import {createContext,useContext,useState,useCallback,useEffect,useRef} from 'react';
import {io,type Socket} from 'socket.io-client';
import {api,ApiError} from '@/lib/api';
import type {User,Notification,Message} from '@/lib/types';
type Session={user:User|null;loading:boolean;error:string;refresh:()=>Promise<void>;logout:()=>Promise<void>;connected:boolean;online:Set<string>;unread:number};
const Context=createContext<Session|null>(null);
export function SessionProvider({children}:{children:React.ReactNode}){
 const[user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[connected,setConnected]=useState(false),[online,setOnline]=useState<Set<string>>(new Set()),[unread,setUnread]=useState(0);const socket=useRef<Socket|null>(null);
 const refresh=useCallback(async()=>{try{const me=await api<User>('/users/me');setUser(me);setError('')}catch(e){if(e instanceof ApiError&&e.status===401)setUser(null);else setError(e instanceof Error?e.message:'No se pudo cargar la sesión.')}finally{setLoading(false)}},[]);
 const logout=useCallback(async()=>{const response=await fetch('/api/logout',{method:'POST'});if(!response.ok)throw new Error('No se pudo cerrar sesión.');socket.current?.disconnect();setUser(null);setOnline(new Set());setUnread(0)},[]);
 useEffect(()=>{void refresh();const expire=()=>{socket.current?.disconnect();setUser(null);setUnread(0);setOnline(new Set())};window.addEventListener('hivibe:unauthorized',expire);return()=>window.removeEventListener('hivibe:unauthorized',expire)},[refresh]);
 useEffect(()=>{
 if(!user)return;let disposed=false;const seen=new Set<string>();let lastConnected=false;
 const emit=(name:string,data:unknown)=>window.dispatchEvent(new CustomEvent(name,{detail:data}));
 const counts=(event:unknown)=>emit('hivibe:counts',event);
 const loadUnread=()=>{void api<Notification[]>('/notifications?limit=50').then(notices=>{if(!disposed)setUnread(notices.filter(n=>!n.isRead).length)}).catch(()=>{})};
 loadUnread();
 void fetch('/api/socket-token',{cache:'no-store'}).then(r=>r.json()).then(({token})=>{
 if(disposed||!token)return;const s=io(process.env.NEXT_PUBLIC_SOCKET_URL||'http://localhost:4300',{auth:{token},autoConnect:false,reconnection:true});socket.current=s;
 s.on('connect',()=>{setConnected(true);if(lastConnected){loadUnread();emit('hivibe:reconnect',{})}lastConnected=true});
 s.on('disconnect',(reason)=>{setConnected(false);if(reason==='io server disconnect')void refresh()});
 s.on('connect_error',()=>setConnected(false));
 s.on('post:counts',counts);s.on('presence:snapshot',({userIds}:{userIds:string[]})=>setOnline(new Set(userIds)));
 s.on('presence:update',({userId,online}:{userId:string;online:boolean})=>setOnline(current=>{const next=new Set(current);if(online)next.add(userId);else next.delete(userId);return next}));
 s.on('chat:new',(m:Message)=>emit('hivibe:message',m));
 s.on('notification:new',(n:Notification)=>{if(!seen.has(n.id)){seen.add(n.id);setUnread(v=>v+1);emit('hivibe:notification',n)}});s.connect();
 }).catch(()=>setConnected(false));
 const read=()=>loadUnread();window.addEventListener('hivibe:notification-read',read);
 return()=>{disposed=true;socket.current?.disconnect();socket.current=null;setConnected(false);window.removeEventListener('hivibe:notification-read',read)}
 },[user?.id,refresh]);
 return <Context.Provider value={{user,loading,error,refresh,logout,connected,online,unread}}>{children}</Context.Provider>
}
export function useSession(){const session=useContext(Context);if(!session)throw new Error('Falta SessionProvider');return session}
