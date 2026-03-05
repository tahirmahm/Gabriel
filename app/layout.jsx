import './globals.css';

export const metadata = {
  title: 'Sentinel OSINT',
  description: 'Real-time geopolitical threat intelligence dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
