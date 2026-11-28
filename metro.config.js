// Sans STYLEGUIDE=1, Metro ne voit pas src/app/styleguide/ : la require.context d'Expo Router
// ne liste donc pas ses routes, ni dans le JavaScript du web ni dans les bundles iOS et Android
// (ADR 0003). `pnpm dev` le reçoit de .env.development.
import { getDefaultConfig } from 'expo/metro-config';

const config = getDefaultConfig(import.meta.dirname);

if (process.env['STYLEGUIDE'] !== '1') {
  config.resolver.blockList = [
    ...config.resolver.blockList,
    // Chemin absolu ou relatif au projet, séparateurs de Windows compris.
    /(?:^|[\\/])src[\\/]app[\\/]styleguide(?:[\\/]|$)/,
  ];
}

export default config;
