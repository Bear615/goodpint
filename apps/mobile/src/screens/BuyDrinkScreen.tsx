import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Minus, Plus, Star, Trash2, WalletCards } from 'lucide-react-native';
import { colors, font, formatCurrency, formatPoints, radii } from '../theme';
import type { CartItem, Drink, Venue } from '../types';
import { GoldButton } from '../components/GoldButton';
import { PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';

interface BuyDrinkScreenProps {
  venue: Venue;
  drinks: Drink[];
  cart: CartItem[];
  total: number;
  onBack: () => void;
  onChangeQuantity: (drinkId: string, delta: number) => void;
  onPay: () => void;
}

export function BuyDrinkScreen({
  venue,
  drinks,
  cart,
  total,
  onBack,
  onChangeQuantity,
  onPay,
}: BuyDrinkScreenProps) {
  const quantityFor = (drinkId: string) => cart.find((item) => item.drinkId === drinkId)?.quantity ?? 0;
  const orderedDrinks = drinks.filter((drink) => quantityFor(drink.id) > 0);
  const pointsEarned = drinks.reduce(
    (sum, drink) => sum + drink.points * quantityFor(drink.id),
    0,
  );

  return (
    <View>
      <View style={styles.header}>
        <PressableScale accessibilityLabel="Back" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={colors.text} size={24} />
        </PressableScale>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Buy a Drink</Text>
          <Text style={styles.venueName}>{venue.name}</Text>
          <Text style={styles.pickup}>Pickup at bar</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Drinks</Text>
      {drinks.length > 0 ? (
        <SectionCard>
          {drinks.map((drink, index) => {
          const quantity = quantityFor(drink.id);
          return (
            <LinearGradient
              key={drink.id}
              colors={quantity > 0 ? ['rgba(255,211,77,0.08)', 'rgba(255,255,255,0.03)'] : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.018)']}
              style={[styles.drinkRow, index > 0 && styles.rowDivider]}
            >
              <Image source={{ uri: drink.imageUrl }} style={styles.drinkImage} />
              <View style={styles.drinkCopy}>
                <Text style={styles.drinkName}>{drink.name}</Text>
                <Text style={styles.drinkPrice}>
                  {formatCurrency(drink.price)} · {formatPoints(drink.points)} pts
                </Text>
              </View>
              <View style={styles.stepper}>
                <PressableScale
                  accessibilityLabel={`Remove ${drink.name}`}
                  disabled={quantity === 0}
                  onPress={() => onChangeQuantity(drink.id, -1)}
                  style={[styles.stepperButton, quantity === 0 && styles.stepperDisabled]}
                  pressedScale={0.88}
                >
                  <Minus color={quantity === 0 ? colors.textSubtle : colors.gold} size={18} />
                </PressableScale>
                <Text style={styles.quantity}>{quantity}</Text>
                <PressableScale
                  accessibilityLabel={`Add ${drink.name}`}
                  onPress={() => onChangeQuantity(drink.id, 1)}
                  style={styles.stepperButton}
                  pressedScale={0.88}
                >
                  <Plus color={colors.gold} size={18} />
                </PressableScale>
              </View>
            </LinearGradient>
          );
          })}
        </SectionCard>
      ) : (
        <Text style={styles.emptyOrder}>No drinks available right now.</Text>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Your Order</Text>
      {orderedDrinks.length > 0 ? (
        orderedDrinks.map((drink) => (
          <View key={drink.id} style={styles.orderRow}>
            <Image source={{ uri: drink.imageUrl }} style={styles.orderImage} />
            <View style={styles.drinkCopy}>
              <Text style={styles.drinkName}>{drink.name}</Text>
              <Text style={styles.drinkPrice}>{formatCurrency(drink.price)}</Text>
            </View>
            <Text style={styles.orderQuantity}>{quantityFor(drink.id)}</Text>
            <PressableScale accessibilityLabel={`Remove ${drink.name}`} onPress={() => onChangeQuantity(drink.id, -quantityFor(drink.id))}>
              <Trash2 color={colors.textMuted} size={20} />
            </PressableScale>
          </View>
        ))
      ) : (
        <Text style={styles.emptyOrder}>Add a drink to continue.</Text>
      )}

      {pointsEarned > 0 && (
        <View style={styles.earnRow}>
          <Star color={colors.gold} fill={colors.gold} size={16} />
          <Text style={styles.earnText}>
            You'll earn {formatPoints(pointsEarned)} points on this order
          </Text>
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>

      <GoldButton
        label={total > 0 ? `Pay ${formatCurrency(total)}` : 'Add drinks'}
        onPress={onPay}
        iconRight={
          <View style={styles.payPill}>
            <WalletCards color="#090909" size={17} />
            <Text style={styles.payText}>Pay</Text>
          </View>
        }
      />

      <Text style={styles.readyText}>Your drink will be ready at the bar.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 19,
  },
  venueName: {
    marginTop: 7,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
  },
  pickup: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  headerSpacer: {
    width: 42,
  },
  divider: {
    marginVertical: 18,
    height: 1,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 16,
    marginBottom: 11,
  },
  drinkRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  drinkImage: {
    width: 58,
    height: 58,
    borderRadius: radii.xs,
    backgroundColor: colors.panelRaised,
  },
  drinkCopy: {
    flex: 1,
  },
  drinkName: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  drinkPrice: {
    marginTop: 5,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  stepper: {
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  stepperDisabled: {
    borderColor: colors.border,
  },
  quantity: {
    minWidth: 15,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
    textAlign: 'center',
  },
  orderRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderImage: {
    width: 52,
    height: 52,
    borderRadius: radii.xs,
    backgroundColor: colors.panelRaised,
  },
  orderQuantity: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  emptyOrder: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
    paddingVertical: 16,
  },
  earnRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earnText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 13,
  },
  totalRow: {
    marginTop: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 17,
  },
  totalValue: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  payPill: {
    paddingHorizontal: 9,
    height: 32,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.text,
  },
  payText: {
    color: '#090909',
    fontFamily: font.medium,
    fontSize: 12,
  },
  readyText: {
    marginTop: 14,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
});
