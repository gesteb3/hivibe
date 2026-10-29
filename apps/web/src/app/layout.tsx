import {SessionProvider} from '@/components/session';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: {default: 'HiVibe',template:'%s · HiVibe'},description:'Publicaciones, perfiles, cuates y mensajes privados.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="es"><body><a className="skip-link" href="#contenido">Saltar al contenido</a><SessionProvider>{children}</SessionProvider></body></html>}
