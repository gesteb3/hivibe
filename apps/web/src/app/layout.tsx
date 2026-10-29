import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: {default: 'HiVibe — Tu espacio, tus panas, tu estilo',template:'%s · HiVibe'},description:'Vuelve a sentir lo que era tener tu rincón en Internet. Perfiles con personalidad, publicaciones, Panas y conversaciones en vivo.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="es"><body><a className="skip-link" href="#contenido">Saltar al contenido</a>{children}</body></html>}
