// Racine de l'app et du site : pas de barre de navigation, chaque page porte son header.
import { Slot } from 'expo-router';

export default function RootLayout() {
  return <Slot />;
}
