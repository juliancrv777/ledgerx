import type {ReactNode} from 'react';
import './globals.css';
export const metadata={title:'LedgerX · Financial Systems',description:'A production-minded simulated payment platform'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body>{children}</body></html>}
