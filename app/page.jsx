import dynamic from 'next/dynamic';

// Dashboard uses CesiumJS which requires browser APIs — disable SSR
const Dashboard = dynamic(() => import('../components/Dashboard'), { ssr: false });

export default function Home() {
  return <Dashboard />;
}
