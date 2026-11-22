// Page du styleguide d'un composant (ADR 0003) : son nom, puis chaque état dans une région titrée.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTypography } from '@/theme/typography';
import BaseLayout from './BaseLayout';
import { pageStyles } from './page-styles';

interface Props {
  name: string;
  description: string;
  states: { label: string; node: ReactNode }[];
}

export default function StyleguideStates({ name, description, states }: Props) {
  const typography = useTypography();
  return (
    <BaseLayout
      title={`${name} — Styleguide — Étendard`}
      description={description}
    >
      <View style={[pageStyles.column, pageStyles.page]}>
        <Text role="heading" aria-level={1} style={typography.h1}>
          {name}
        </Text>
        {states.map((state, index) => (
          <View
            key={state.label}
            role="region"
            aria-labelledby={`etat-${index}`}
            style={pageStyles.state}
          >
            <Text
              role="heading"
              aria-level={2}
              id={`etat-${index}`}
              style={typography.h2}
            >
              {state.label}
            </Text>
            {state.node}
          </View>
        ))}
      </View>
    </BaseLayout>
  );
}
