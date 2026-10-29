import {cookies} from 'next/headers';import {redirect} from 'next/navigation';import {AppShell} from '@/components/shell';
export default async function SocialLayout({children}:{children:React.ReactNode}){if(!(await cookies()).has('hv_session'))redirect('/login');return <AppShell>{children}</AppShell>}
