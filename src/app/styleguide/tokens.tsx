// Design tokens de src/theme/tokens.ts, rendus dans les deux thèmes (ticket #10).
import {
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import BaseLayout from '@/layouts/BaseLayout';
import { pageStyles } from '@/layouts/page-styles';
import { TextLink } from '@/lib/anchors';
import { ThemeScope, themedStyles } from '@/theme/theme';
import {
  borderWidth,
  fontSize,
  colorNames,
  radius,
  shadow,
  space,
  type ColorName,
  type Scheme,
} from '@/theme/tokens';
import { paragraph, useTypography } from '@/theme/typography';

const themes: { scheme: Scheme; label: string }[] = [
  { scheme: 'light', label: 'Thème clair' },
  { scheme: 'dark', label: 'Thème sombre' },
];
/** Couleurs affichées en pastille ; l'ombre est montrée par les pastilles elles-mêmes. */
const colors = colorNames.filter((name) => name !== 'shadow');
const texts = ['text', 'textMuted', 'accent'] as const;
const grounds = ['background', 'surface'] as const;
const sizes = Object.keys(fontSize) as (keyof typeof fontSize)[];
const spaces = Object.keys(space).map(Number) as (keyof typeof space)[];

export default function TokensPage() {
  const typography = useTypography();
  return (
    <BaseLayout
      title="Tokens — Styleguide — Étendard"
      description="Design tokens d’Étendard : couleurs, typographie et espacements."
    >
      <View style={[pageStyles.column, pageStyles.page]}>
        <Text role="heading" aria-level={1} style={typography.h1}>
          Tokens
        </Text>
        {themes.map((theme) => (
          <ThemeScope
            key={theme.scheme}
            scheme={theme.scheme}
            style={pageStyles.panel}
          >
            <Theme {...theme} />
          </ThemeScope>
        ))}
      </View>
    </BaseLayout>
  );
}

/** Les tokens dans un thème : couleurs du ThemeScope englobant. */
function Theme({ scheme, label }: { scheme: Scheme; label: string }) {
  const styles = useStyles();
  const swatches = useSwatches();
  const textColors = useTextColors();
  const typography = useTypography();
  return (
    <View
      role="region"
      aria-labelledby={`theme-${scheme}`}
      testID={`theme-${scheme}`}
      style={styles.theme}
    >
      <Text
        role="heading"
        aria-level={2}
        id={`theme-${scheme}`}
        style={typography.h2}
      >
        {label}
      </Text>

      <Text role="heading" aria-level={3} style={typography.h3}>
        Couleurs
      </Text>
      <View role="list" style={styles.row}>
        {colors.map((name) => (
          <View role="listitem" key={name} style={styles.item}>
            <View testID="swatch" style={[styles.swatch, swatches[name]]} />
            <Text style={[typography.body, typography.code]}>{name}</Text>
          </View>
        ))}
      </View>

      <Text role="heading" aria-level={3} style={typography.h3}>
        Textes sur fond et surface
      </Text>
      <View role="list" style={styles.row}>
        {grounds.map((ground) => (
          <View
            role="listitem"
            key={ground}
            style={[styles.ground, swatches[ground]]}
          >
            {texts.map((text) => (
              <Text
                role={paragraph}
                key={text}
                style={[typography.body, textColors[text]]}
              >
                {text} sur {ground}
              </Text>
            ))}
            <Text role={paragraph} style={typography.body}>
              <TextLink href="#contenu" style={typography.link}>
                Lien vers le début du contenu
              </TextLink>
            </Text>
          </View>
        ))}
      </View>

      <Text role="heading" aria-level={3} style={typography.h3}>
        Échelle typographique
      </Text>
      {sizes.map((size) => (
        <Text
          role={paragraph}
          key={size}
          testID="font-size"
          style={[typography.body, sizeStyles[size]]}
        >
          fontSize.{size} : Étendard
        </Text>
      ))}

      <Text role="heading" aria-level={3} style={typography.h3}>
        Espacements
      </Text>
      <View role="list" style={styles.column}>
        {spaces.map((value) => (
          <View role="listitem" key={value} style={styles.item}>
            <View testID="bar" style={[styles.bar, barStyles[value]]} />
            <Text style={[typography.body, typography.code]}>
              space[{value}]
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  theme: {
    borderColor: c.border,
    borderRadius: radius.lg,
    borderWidth,
    padding: space[5],
    rowGap: space[4],
  },
  row: {
    columnGap: space[4],
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[4],
  },
  column: { rowGap: space[4] },
  item: { alignItems: 'center', columnGap: space[2], flexDirection: 'row' },
  swatch: {
    borderColor: c.border,
    borderRadius: radius.sm,
    borderWidth,
    boxShadow: shadow(c).sm,
    height: space[7],
    width: space[7],
  },
  ground: {
    borderRadius: radius.md,
    boxShadow: shadow(c).md,
    padding: space[4],
  },
  bar: { backgroundColor: c.accent, height: space[4] },
}));

const useSwatches = themedStyles(
  (c) =>
    Object.fromEntries(
      colors.map((name) => [name, { backgroundColor: c[name] }]),
    ) as Record<ColorName, ViewStyle>,
);

const useTextColors = themedStyles(
  (c) =>
    Object.fromEntries(
      texts.map((name) => [name, { color: c[name] }]),
    ) as Record<(typeof texts)[number], TextStyle>,
);

const sizeStyles = StyleSheet.create(
  Object.fromEntries(
    sizes.map((size) => [size, { fontSize: fontSize[size] }]),
  ) as Record<(typeof sizes)[number], TextStyle>,
);

const barStyles = StyleSheet.create(
  Object.fromEntries(
    spaces.map((value) => [value, { width: space[value] }]),
  ) as Record<(typeof spaces)[number], ViewStyle>,
);
