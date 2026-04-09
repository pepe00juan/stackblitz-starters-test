import dynamic from 'next/dynamic';

const Chat = dynamic(() => import('../components/Chat'), { ssr: false });

export default function Home() {
  return <Chat />;
}
