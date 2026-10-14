import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useFolioColorScheme } from '@/components/appearance-provider';
import type { SavedItem } from '@/database/items';

type Props = {
  image: SavedItem | null;
  onClose: () => void;
};

type Palette = {
  background: string;
  photoBackground: string;
  surface: string;
  text: string;
  secondary: string;
  accent: string;
  border: string;
  chip: string;
};

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#F7F4ED',
    photoBackground: '#E9EEE6',
    surface: '#FFFEFA',
    text: '#222A22',
    secondary: '#5D6E61',
    accent: '#315C46',
    border: '#D8E0D5',
    chip: '#E8EFE5',
  },
  dark: {
    background: '#171B18',
    photoBackground: '#202822',
    surface: '#252D27',
    text: '#F7F4EE',
    secondary: '#C3CBC1',
    accent: '#B5D4BB',
    border: '#45574B',
    chip: '#314236',
  },
};

export default function ImageViewerModal({
  image,
  onClose,
}: Props) {
  const isDark = useFolioColorScheme() === 'dark';
  const colors = palettes[isDark ? 'dark' : 'light'];

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const insets = useSafeAreaInsets();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [image?.id, image?.image_uri]);

  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? 0,
    Platform.OS === 'ios' ? 56 : 0
  );

  const bottomInset = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0,
    Platform.OS === 'ios' ? 24 : 0
  );

  const hasDescription = Boolean(image?.content.trim());
  const hasTags = Boolean(image?.tags.length);

  return (
    <Modal
      visible={image?.type === 'image'}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: topInset,
            paddingBottom: bottomInset,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.overline}>
            YOUR COLLECTION
          </Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
          >
            <Text style={styles.closeText}>
              Done
            </Text>
          </Pressable>
        </View>

        <View style={styles.photoFrame}>
          {image?.image_uri && !imageFailed ? (
            <Image
              key={`${image.id}:${image.image_uri}`}
              source={{ uri: image.image_uri }}
              style={styles.photo}
              resizeMode="contain"
              onError={() => setImageFailed(true)}
              accessibilityLabel={image.title}
            />
          ) : (
            <View style={styles.missingPhoto}>
              <Text style={styles.missingTitle}>
                Image unavailable
              </Text>

              <Text style={styles.missingDescription}>
                Folio couldn't open this saved photo.
              </Text>
            </View>
          )}
        </View>

        {image ? (
          <ScrollView
            style={styles.detailsScroll}
            contentContainerStyle={styles.details}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            <Text style={styles.title} selectable>
              {image.title}
            </Text>

            {hasDescription ? (
              <Text style={styles.description} selectable>
                {image.content}
              </Text>
            ) : null}

            {hasTags ? (
              <View style={styles.tags}>
                {image.tags.map((tag, index) => (
                  <View
                    key={`${tag}-${index}`}
                    style={styles.tagChip}
                  >
                    <Text style={styles.tagText}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      height: 66,
      paddingHorizontal: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    overline: {
      color: colors.secondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.9,
    },

    closeButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 19,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },

    closeText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },

    pressed: {
      opacity: 0.65,
    },

    photoFrame: {
      flex: 1,
      minHeight: 170,
      marginHorizontal: 16,
      borderRadius: 18,
      backgroundColor: colors.photoBackground,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },

    photo: {
      width: '100%',
      height: '100%',
    },

    missingPhoto: {
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 8,
    },

    missingTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },

    missingDescription: {
      color: colors.secondary,
      fontSize: 12,
      textAlign: 'center',
    },

    detailsScroll: {
      flexGrow: 0,
      maxHeight: '38%',
    },

    details: {
      paddingHorizontal: 26,
      paddingTop: 20,
      paddingBottom: 26,
      gap: 11,
    },

    title: {
      color: colors.text,
      fontSize: 23,
      lineHeight: 30,
      fontWeight: '600',
      letterSpacing: -0.6,
    },

    description: {
      color: colors.secondary,
      fontSize: 14,
      lineHeight: 21,
    },

    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 4,
    },

    tagChip: {
      borderRadius: 999,
      backgroundColor: colors.chip,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },

    tagText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '600',
    },
  });
}
