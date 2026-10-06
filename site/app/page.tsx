import ChatDemo from '@/components/sections/ChatDemo';
import Export from '@/components/sections/Export';
import FinalCta from '@/components/sections/FinalCta';
import Hero from '@/components/sections/Hero';
import Inputs from '@/components/sections/Inputs';
import Layers from '@/components/sections/Layers';
import Metrics from '@/components/sections/Metrics';
import OpenSource from '@/components/sections/OpenSource';
import Transform from '@/components/sections/Transform';
import WalkThrough from '@/components/sections/WalkThrough';
import Header from '@/components/ui/Header';
import Marquee from '@/components/ui/Marquee';
import { site } from '@/content/site';

export default function Home() {
  return (
    <>
      <Header />
      <main className="bg-grid">
        <Hero />
        <Transform />
        <ChatDemo />
        <WalkThrough />
        <Inputs />
        <Layers />
        <Export />
        <Metrics />
        <OpenSource />
        <Marquee items={site.marquee.formats} reverse outline />
        <FinalCta />
      </main>
    </>
  );
}
