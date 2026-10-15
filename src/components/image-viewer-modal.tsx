import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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

type ImageDimensions = {
  width: number;
  height: number;
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
  const isDark =
    useFolioColorScheme() === 'dark';

  const colors =
    palettes[isDark ? 'dark' : 'light'];

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const insets = useSafeAreaInsets();

  const { width: screenWidth, height: screenHeight } =
    useWindowDimensions();

  const [imageFailed, setImageFailed] =
    useState(false);

  const [imageDimensions, setImageDimensions] =
    useState<ImageDimensions | null>(null);

  const imageUri = image?.image_uri;

  /*
   * Read the real dimensions of each image.
   *
   * This allows the photo container to adapt to
   * landscape, portrait, and panoramic images.
   */
  useEffect(() => {
    setImageFailed(false);
    setImageDimensions(null);

    if (!imageUri) {
      return;
    }

    let active = true;

    Image.getSize(
      imageUri,
      (width, height) => {
        if (
          active &&
          width > 0 &&
          height > 0
        ) {
          setImageDimensions({
            width,
            height,
          });
        }
      },
      () => {
        // The Image component also provides
        // dimensions through its onLoad event.
        // Don't mark the photo as failed here.
      }
    );

    return () => {
      active = false;
    };
  }, [image?.id, imageUri]);

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

  const hasDescription =
    Boolean(image?.content.trim());

  const hasTags =
    Boolean(image?.tags.length);

  /*
   * Available width after the photo's
   * 16-point horizontal margins.
   */
  const maxPhotoWidth = Math.max(
    1,
    screenWidth - 32
  );

  /*
   * Keep exceptionally tall photos from
   * occupying the entire screen.
   *
   * The user can scroll to see the title,
   * description, and tags below the image.
   */
  const availableHeight = Math.max(
    200,
    screenHeight -
      topInset -
      bottomInset -
      66
  );

  const maxPhotoHeight = Math.max(
    170,
    availableHeight * 0.72
  );

  /*
   * If dimensions haven't loaded yet,
   * use a temporary 4:3 ratio.
   *
   * Once the image loads, the frame
   * automatically adjusts.
   */
  const aspectRatio = imageDimensions
    ? imageDimensions.width / imageDimensions.height
    : 4 / 3;

  /*
   * Fit within both width and height limits
   * without cropping or stretching.
   */
  const photoWidth = Math.min(
    maxPhotoWidth,
    maxPhotoHeight * aspectRatio
  );

  const photoHeight =
    photoWidth / aspectRatio;

  const frameWidth = imageFailed
    ? maxPhotoWidth
    : photoWidth;

  const frameHeight = imageFailed
    ? 220
    : photoHeight;

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

        {/*
         * One scrollable content area.
         *
         * Unlike the old layout, the photo
         * no longer uses flex: 1.
         */}
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <View
            style={[
              styles.photoFrame,
              {
                width: frameWidth,
                height: frameHeight,
              },
            ]}
          >
            {imageUri && !imageFailed ? (
              <Image
                key={`${image?.id}:${imageUri}`}
                source={{ uri: imageUri }}
                style={styles.photo}
                resizeMode="contain"
                onLoad={(event) => {
                  const source =
                    event.nativeEvent.source;

                  if (
                    source.width > 0 &&
                    source.height > 0
                  ) {
                    setImageDimensions({
                      width: source.width,
                      height: source.height,
                    });
                  }
                }}
                onError={() => {
                  setImageFailed(true);
                }}
                accessibilityLabel={
                  image?.title ?? 'Saved image'
                }
              />
            ) : (
              <View style={styles.missingPhoto}>
                <Text style={styles.missingTitle}>
                  Image unavailable
                </Text>

                <Text
                  style={styles.missingDescription}
                >
                  Folio couldn't open this saved photo.
                </Text>
              </View>
            )}
          </View>

          {image ? (
            <View style={styles.details}>
              <Text
                style={styles.title}
                selectable
              >
                {image.title}
              </Text>

              {hasDescription ? (
                <Text
                  style={styles.description}
                  selectable
                >
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
            </View>
          ) : null}
        </ScrollView>
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

    contentScroll: {
      flex: 1,
    },

    content: {
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 20,
    },

    photoFrame: {
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
      flex: 1,
      justifyContent: 'center',
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
      lineHeight: 18,
      textAlign: 'center',
    },

    details: {
      width: '100%',
      paddingHorizontal: 10,
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
