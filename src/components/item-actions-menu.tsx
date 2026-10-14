import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';

export type ItemMenuAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  itemTitle: string;
  actions: ItemMenuAction[];
  disabled?: boolean;
};

const MENU_WIDTH = 180;
const ROW_HEIGHT = 42;
const SCREEN_MARGIN = 12;

export function ItemActionsMenu({
  itemTitle,
  actions,
  disabled = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
  });

  const { width: screenWidth, height: screenHeight } =
    useWindowDimensions();

  const isDark = useColorScheme() === 'dark';

  const colors = {
    background: isDark ? '#252D27' : '#FFFFFF',
    text: isDark ? '#F5F3EE' : '#242B26',
    border: isDark ? '#46554A' : '#E4E5DF',
    divider: isDark ? '#374138' : '#EFEFEB',
    danger: isDark ? '#E17B70' : '#BF4942',
  };

  function openMenu(event: any) {
    if (disabled) return;

    const { pageX, pageY } = event.nativeEvent;

    const menuHeight = actions.length * ROW_HEIGHT + 8;

    const left = Math.max(
      SCREEN_MARGIN,
      Math.min(
        pageX - MENU_WIDTH + 20,
        screenWidth - MENU_WIDTH - SCREEN_MARGIN
      )
    );

    // Prefer below the dots, but flip upward near the bottom.
    const below = pageY + 12;
    const above = pageY - menuHeight - 12;

    const top =
      below + menuHeight + SCREEN_MARGIN <= screenHeight
        ? below
        : Math.max(SCREEN_MARGIN, above);

    setPosition({ top, left });
    setVisible(true);
  }

  function selectAction(action: ItemMenuAction) {
    setVisible(false);

    // Allow the menu to close before showing another dialog.
    setTimeout(() => {
      action.onPress();
    }, 250);
  }

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={openMenu}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Actions for ${itemTitle}`}
        accessibilityState={{ disabled }}
      >
        <Text
          style={[styles.dots, { color: colors.text }]}
        >
          ⋯
        </Text>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
            accessibilityLabel="Close actions menu"
          />

          <View
            style={[
              styles.menu,
              {
                top: position.top,
                left: position.left,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            {actions.map((action, index) => (
              <Pressable
                key={`${action.label}-${index}`}
                style={[
                  styles.action,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.divider,
                  },
                ]}
                onPress={() => selectAction(action)}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.actionText,
                    {
                      color: action.destructive
                        ? colors.danger
                        : colors.text,
                    },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dots: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
  },

  overlay: {
    flex: 1,
  },

  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',

    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 8,
  },

  action: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
