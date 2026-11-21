// One page d'Étendard : accueil, projets (ADR 0015).
import Hero from '@/components/Hero';
import ProjectsSection from '@/components/ProjectsSection';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import BaseLayout from '@/layouts/BaseLayout';
import { AnchorTarget } from '@/lib/anchors';

export default function Accueil() {
  return (
    <BaseLayout
      title="Étendard"
      description="Étendard, le site qui regroupe tous les projets de Hussard."
      header={<SiteHeader />}
      footer={<SiteFooter />}
    >
      <AnchorTarget id="accueil">
        <Hero />
      </AnchorTarget>
      <AnchorTarget id="projets">
        <ProjectsSection />
      </AnchorTarget>
    </BaseLayout>
  );
}
