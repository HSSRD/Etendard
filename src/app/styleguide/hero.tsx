// Hero (tickets #13 et #22) : au repos, vidéo en lecture ; survol, focus, thèmes et mouvement réduit
// (poster seul, état des captures) sont émulés par Hero.spec.ts.
import Hero from '@/components/Hero';
import BaseLayout from '@/layouts/BaseLayout';

export default function HeroPage() {
  return (
    <BaseLayout
      title="Hero — Styleguide — Étendard"
      description="Section d’accueil d’Étendard : titre, texte d’accueil et appel à l’action."
    >
      <Hero />
    </BaseLayout>
  );
}
