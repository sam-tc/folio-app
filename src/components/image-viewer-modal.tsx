import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import type { SavedItem } from '@/database/items';

type Props = {
  image: SavedItem | null;
  onClose: () => void;
};

export default function ImageViewerModal({
  image,
  onClose,
}: Props) {
  const isDark = useColorScheme() === 'dark';

  const colors = {
    background: isDark ? '#171B18' : '#F7F4ED',
    text: isDark ? '#F7F4EE' : '#222A22',
    secondary: isDark ? '#C3CBC1' : '#526457',
  };

  return (
    <Modal
      visible={image?.type === 'image'}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView
          edges={['top', 'bottom']}
          style={[
            styles.container,
            { backgroundColor: colors.background },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.headerLabel,
                { color: colors.secondary },
              ]}
            >
              IMAGE
            </Text>

            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
            >
              <Text
                style={[
                  styles.closeText,
                  { color: colors.text },
                ]}
              >
                Close
              </Text>
            </Pressable>
          </View>

          {/* Full-screen image */}
          <View style={styles.imageContainer}>
            {image?.image_uri ? (
              <Image
                key={image.id}
                source={{ uri: image.image_uri }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel={image.title}
              />
            ) : (
              <Text style={{ color: colors.secondary }}>
                Image unavailable
              </Text>
            )}
          </View>

          {/* Image information */}
          {image && (
            <View style={styles.details}>
              <Text
                style={[
                  styles.title,
                  { color: colors.text },
                ]}
              >
                {image.title}
              </Text>

              {image.content.length > 0 && (
                <Text
                  style={[
                    styles.description,
                    { color: colors.secondary },
                  ]}
                  numberOfLines={3}
                >
                  {image.content}
                </Text>
              )}

              {image.tags.length > 0 && (
                <Text
                  style={[
                    styles.tags,
                    { color: colors.secondary },
                  ]}
                >
                  {image.tags
                    .map((tag) => `#${tag}`)
                    .join('  ')}
                </Text>
              )}
            </View>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },

  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },

  closeButton: {
    minWidth: 60,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },

  imageContainer: {
    flex: 1,
    marginHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  details: {
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 10,
  },

  title: {
    fontSize: 22,
    fontWeight: '600',
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
  },

  tags: {
    fontSize: 12,
    marginTop: 4,
  },
});
