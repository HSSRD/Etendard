// Liens et ancres de la one page (ADR 0015).
// Web : de vrais <a href> et des id, qui défilent sans JavaScript (scroll-margin-top, web-css.ts).
// iOS et Android : un lien « #x » fait défiler le ScrollView de la page jusqu'à la cible « x »,
// un lien externe s'ouvre dans le navigateur.
import {
  createContext,
  use,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

type ViewInstance = ComponentRef<typeof View>;

interface Anchors {
  targets: Map<string, ViewInstance>;
  scrollTo: (id: string) => void;
}

const AnchorContext = createContext<Anchors | null>(null);

/** iOS et Android : ScrollView de la page, que les liens « #x » font défiler. */
export function AnchorScrollView({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const content = useRef<ViewInstance>(null);
  const [targets] = useState(() => new Map<string, ViewInstance>());
  const scrollTo = (id: string) => {
    const target = targets.get(id);
    if (target && content.current) {
      target.measureLayout(content.current, (_x, y) =>
        scroll.current?.scrollTo({ y }),
      );
    }
  };
  return (
    <AnchorContext value={{ targets, scrollTo }}>
      <ScrollView ref={scroll} style={style}>
        <View ref={content}>{children}</View>
      </ScrollView>
    </AnchorContext>
  );
}

/** Cible d'ancre : une région (<section id> sur le web), jointe par un lien « #id ». */
export function AnchorTarget({
  id,
  ...props
}: Omit<ViewProps, 'id' | 'role'> & { id: string }) {
  const anchors = use(AnchorContext);
  const register = (node: ViewInstance | null) => {
    if (!anchors || !node) return undefined;
    anchors.targets.set(id, node);
    return () => {
      anchors.targets.delete(id);
    };
  };
  return <View {...props} ref={register} id={id} role="region" />;
}

interface TextLinkProps extends Omit<
  TextProps,
  'href' | 'hrefAttrs' | 'onPress' | 'role'
> {
  /** « #id » : une ancre de la page ; sinon une URL externe. */
  href: string;
  rel?: string;
}

/** Lien texte : <a href> sur le web, Text pressable sur iOS et Android. */
export function TextLink({ href, rel, ...props }: TextLinkProps) {
  const anchors = use(AnchorContext);
  if (Platform.OS === 'web') {
    return <Text {...props} href={href} {...(rel && { hrefAttrs: { rel } })} />;
  }
  const onPress = () => {
    if (href.startsWith('#')) anchors?.scrollTo(href.slice(1));
    else void Linking.openURL(href);
  };
  return <Text {...props} role="link" onPress={onPress} />;
}
