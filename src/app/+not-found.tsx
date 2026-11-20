// Page des adresses inconnues de l'app et de l'export web (ADR 0015).
import { Text, View } from 'react-native';
import BaseLayout from '@/layouts/BaseLayout';
import { pageStyles } from '@/layouts/page-styles';
import { TextLink } from '@/lib/anchors';
import { paragraph, useTypography } from '@/theme/typography';

export default function NotFound() {
  const typography = useTypography();
  return (
    <BaseLayout
      title="Page introuvable — Étendard"
      description="Cette page n’existe pas sur Étendard."
      noindex
    >
      <View style={[pageStyles.column, pageStyles.page]}>
        <Text role="heading" aria-level={1} style={typography.h1}>
          Page introuvable
        </Text>
        <Text role={paragraph} style={typography.body}>
          <TextLink href="/" style={typography.link}>
            Retour à l’accueil
          </TextLink>
        </Text>
      </View>
    </BaseLayout>
  );
}
