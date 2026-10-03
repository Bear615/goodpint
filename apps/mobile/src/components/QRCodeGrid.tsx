import { useMemo } from 'react';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors, goldGlow, radii } from '../theme';

// Scanners want true white, not the app's warm off-white text colour.
const QR_LIGHT = '#FFFFFF';

interface QRCodeGridProps {
  value: string;
  size?: number;
  // Drop the gold glow and pulse ring, for a QR that sits on a coloured card.
  plain?: boolean;
}

type QRModel = {
  modules: {
    size: number;
    data: Uint8Array | boolean[];
  };
};

export function QRCodeGrid({ value, size = 236, plain = false }: QRCodeGridProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const matrix = useMemo(() => {
    const code = QRCode.create(value, { errorCorrectionLevel: 'M' }) as unknown as QRModel;
    const rows: boolean[][] = [];
    const data = Array.from(code.modules.data, Boolean);

    for (let row = 0; row < code.modules.size; row += 1) {
      rows.push(data.slice(row * code.modules.size, (row + 1) * code.modules.size));
    }

    return rows;
  }, [value]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const cellSize = Math.floor((size - 28) / matrix.length);
  const innerSize = cellSize * matrix.length;
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.08] });

  return (
    <View style={[styles.outer, plain && styles.outerPlain, { width: size, height: size }]}>
      {plain ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      )}
      <View style={[styles.inner, { width: innerSize, height: innerSize }]}>
        {matrix.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.row}>
            {row.map((isDark, columnIndex) => (
              <View
                key={`${rowIndex}-${columnIndex}`}
                style={[
                  styles.cell,
                  { width: cellSize, height: cellSize },
                  isDark ? styles.darkCell : styles.lightCell,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: QR_LIGHT,
    ...goldGlow,
  },
  outerPlain: {
    borderWidth: 0,
    borderRadius: radii.lg,
    shadowOpacity: 0,
    elevation: 0,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  inner: {
    backgroundColor: QR_LIGHT,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flexShrink: 0,
  },
  darkCell: {
    backgroundColor: '#050505',
  },
  lightCell: {
    backgroundColor: QR_LIGHT,
  },
});
