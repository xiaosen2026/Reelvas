import type { Metadata } from 'next';
import { EditorLayout } from '../components/editor/EditorLayout';

export const metadata: Metadata = { title: 'Reelvas' };

export default function Home() {
  return <EditorLayout />;
}
