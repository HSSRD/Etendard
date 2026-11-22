// WiringDiagram dans chacun de ses états (#102), sur le schéma de démonstration : liaison libellée
// ou non, latérales entrante et sortante, bloc prévu pour plus tard.
import WiringDiagram from '@/components/WiringDiagram';
import demo from '@/content/demo-projet';
import StyleguideStates from '@/layouts/StyleguideStates';

export default function WiringDiagramPage() {
  return (
    <StyleguideStates
      name="WiringDiagram"
      description="Composant WiringDiagram d’Étendard : le schéma des liaisons entre composants."
      states={[
        { label: 'Deux chaînes', node: <WiringDiagram {...demo.schema} /> },
      ]}
    />
  );
}
