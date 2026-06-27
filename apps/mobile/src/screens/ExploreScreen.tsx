import { useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Beer, ChevronRight, LocateFixed, MapPin, Search, SlidersHorizontal, Star, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { filters } from '../data/goodpint';
import { colors, font, radii } from '../theme';
import type { FilterKey, Venue } from '../types';
import { GoldButton } from '../components/GoldButton';
import { AmbientPulse, PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';

interface ExploreScreenProps {
  venues: Venue[];
  selectedFilter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
  onOpenBuy: (venueId: string) => void;
  onOpenRedeem: () => void;
}

export function ExploreScreen({
  venues,
  selectedFilter,
  onFilterChange,
  onOpenBuy,
  onOpenRedeem,
}: ExploreScreenProps) {
  const [query, setQuery] = useState('');

  const visibleVenues = useMemo(() => {
    const text = query.trim().toLowerCase();

    return venues.filter((venue) => {
      const matchesQuery =
        text.length === 0 ||
        venue.name.toLowerCase().includes(text) ||
        venue.area.toLowerCase().includes(text) ||
        venue.tags.some((tag) => tag.toLowerCase().includes(text));

      if (!matchesQuery) {
        return false;
      }

      if (selectedFilter === 'nearby') {
        return venue.distanceMiles <= 0.8;
      }

      if (selectedFilter === 'top-rated') {
        return venue.rating >= 4.6;
      }

      if (selectedFilter === 'happy-hour') {
        return venue.tags.includes('Happy Hour');
      }

      return venue.tags.includes('Live Music');
    });
  }, [query, selectedFilter, venues]);

  const activeVenue = visibleVenues[0] ?? venues[0];

  return (
    <View>
      <View style={styles.brandRow}>
        <View style={styles.logoLockup}>
          <View style={styles.logoMark}>
            <Beer color={colors.gold} size={19} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.brand}>
              Good<Text style={styles.brandGold}>Pint</Text>
            </Text>
            <Text style={styles.brandMeta}>pints, points, plans</Text>
          </View>
        </View>
        <PressableScale accessibilityLabel="Open redeem" onPress={onOpenRedeem} style={styles.notificationButton}>
          <MapPin color={colors.gold} size={22} strokeWidth={1.9} />
        </PressableScale>
      </View>

      <View style={styles.searchRow}>
        <Search color={colors.textMuted} size={19} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find bars, events, or venues"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          selectionColor={colors.gold}
        />
        <SlidersHorizontal color={colors.textMuted} size={20} />
      </View>

      <View style={styles.filterRow}>
        {filters.map((filter) => {
          const active = selectedFilter === filter.id;

          return (
            <PressableScale
              key={filter.id}
              accessibilityLabel={filter.label}
              onPress={() => onFilterChange(filter.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
              pressedScale={0.95}
            >
              {active ? <View style={styles.filterSpark} /> : null}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.mapWrap}>
        <LinearGradient colors={['#111416', '#0A0C0E', '#070708']} style={styles.mapBase}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.018)', 'rgba(244,200,74,0.024)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mapTint}
          />
          <View style={[styles.mapLineHorizontal, { top: '22%' }]} />
          <View style={[styles.mapLineHorizontal, { top: '43%' }]} />
          <View style={[styles.mapLineHorizontal, { top: '64%' }]} />
          <View style={[styles.mapLineVertical, { left: '22%' }]} />
          <View style={[styles.mapLineVertical, { left: '48%' }]} />
          <View style={[styles.mapLineVertical, { left: '74%' }]} />
          <View style={styles.river} />
          <Text style={[styles.mapLabel, { top: '11%', left: '31%' }]}>OLD TOWN</Text>
          <Text style={[styles.mapLabel, { top: '39%', right: '13%' }]}>STREETERVILLE</Text>
          <Text style={[styles.mapLabel, { bottom: '22%', left: '14%' }]}>RIVER WEST</Text>
          <Text style={[styles.mapLabel, { bottom: '18%', right: '15%' }]}>GOLD COAST</Text>
          <Text style={[styles.mapLabel, { bottom: '8%', left: '12%' }]}>RIVER NORTH</Text>

          {visibleVenues.map((venue) => (
            <MapVenuePin
              key={venue.id}
              position={venue.mapPosition}
              onPress={() => onOpenBuy(venue.id)}
            />
          ))}

          <AmbientPulse style={styles.userLocation} intensity={1.4}>
            <View style={styles.userHalo}>
              <View style={styles.userDot} />
            </View>
          </AmbientPulse>
          <PressableScale accessibilityLabel="Locate me" style={styles.compass}>
            <LocateFixed color={colors.text} size={22} strokeWidth={1.7} />
          </PressableScale>
        </LinearGradient>
      </View>

      {activeVenue ? (
        <SectionCard>
          <View style={styles.venueCard}>
            <Image source={{ uri: activeVenue.imageUrl }} style={styles.venueImage} />
            <View style={styles.venueCopy}>
              <View style={styles.venueTitleRow}>
                <Text style={styles.venueName} numberOfLines={1}>
                  {activeVenue.name}
                </Text>
                <View style={styles.verifiedDot} />
              </View>
              <Text style={styles.venueMeta} numberOfLines={1}>
                {activeVenue.distanceMiles.toFixed(1)} mi - {activeVenue.priceTier} - {activeVenue.area}
              </Text>
              <View style={styles.ratingRow}>
                <Star color={colors.gold} size={17} fill={colors.gold} />
                <Text style={styles.ratingText}>{activeVenue.rating.toFixed(1)}</Text>
                <Text style={styles.reviewText}>({activeVenue.reviewCount})</Text>
                <View style={styles.smallBadge}>
                  <Text style={styles.smallBadgeText}>{activeVenue.tags[0]}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.venueActions}>
            <GoldButton label="Buy ahead" compact onPress={() => onOpenBuy(activeVenue.id)} />
            <Text style={styles.pickupText}>Pickup in {activeVenue.pickupWindow}</Text>
          </View>
        </SectionCard>
      ) : null}

      <PressableScale accessibilityLabel="Open points promo" onPress={onOpenRedeem} style={styles.promoWrap}>
        <View style={styles.promo}>
          <View style={styles.promoIcon}>
            <Zap color={colors.gold} size={24} fill={colors.gold} />
          </View>
          <View style={styles.promoCopy}>
            <Text style={styles.promoTitle}>2X POINTS TONIGHT</Text>
            <Text style={styles.promoSub}>At select venues</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={24} />
        </View>
      </PressableScale>
    </View>
  );
}

function MapVenuePin({
  onPress,
  position,
}: {
  onPress: () => void;
  position: Venue['mapPosition'];
}) {
  return (
    <AmbientPulse intensity={0.65} style={[styles.pinWrap, position]}>
      <PressableScale accessibilityLabel="Open venue" onPress={onPress} pressedScale={0.9}>
        <LinearGradient colors={[colors.goldBright, '#F2A900']} style={styles.pin}>
          <View style={styles.pinInner}>
            <Beer color={colors.text} size={15} fill={colors.text} strokeWidth={1.5} />
          </View>
        </LinearGradient>
      </PressableScale>
    </AmbientPulse>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    height: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  logoMark: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  brand: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 31,
    letterSpacing: 0,
  },
  brandGold: {
    color: colors.gold,
  },
  brandMeta: {
    marginTop: -2,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  searchRow: {
    minHeight: 54,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: colors.panelGlass,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
    minHeight: 46,
  },
  filterRow: {
    marginTop: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  filterPill: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  filterPillActive: {
    backgroundColor: 'transparent',
  },
  filterSpark: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 0,
    height: 2,
    backgroundColor: colors.gold,
  },
  filterText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  filterTextActive: {
    color: colors.gold,
    fontFamily: font.medium,
  },
  mapWrap: {
    marginHorizontal: 0,
    marginTop: 12,
    height: 292,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
    overflow: 'hidden',
  },
  mapBase: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  mapLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.052)',
  },
  mapLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.052)',
  },
  river: {
    position: 'absolute',
    left: '49%',
    top: '-12%',
    width: 52,
    height: '128%',
    borderRadius: 30,
    backgroundColor: 'rgba(68,91,125,0.22)',
    transform: [{ rotate: '7deg' }],
  },
  mapLabel: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontFamily: font.regular,
    letterSpacing: 0,
  },
  pinWrap: {
    position: 'absolute',
    width: 37,
    height: 44,
    marginLeft: -18,
    marginTop: -39,
  },
  pin: {
    width: 35,
    height: 43,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  pinInner: {
    transform: [{ rotate: '45deg' }],
  },
  userLocation: {
    position: 'absolute',
    top: '48%',
    left: '55%',
  },
  userHalo: {
    width: 54,
    height: 54,
    marginTop: -27,
    marginLeft: -27,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(38,141,255,0.18)',
  },
  userDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.mapBlue,
    borderWidth: 3,
    borderColor: colors.text,
  },
  compass: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(12,13,14,0.88)',
  },
  venueCard: {
    flexDirection: 'row',
    padding: 10,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.018)',
  },
  venueImage: {
    width: 92,
    height: 92,
    borderRadius: radii.xs,
    backgroundColor: colors.panelRaised,
  },
  venueCopy: {
    flex: 1,
    justifyContent: 'center',
  },
  venueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  venueName: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  verifiedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
  venueMeta: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  ratingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 13,
  },
  reviewText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  smallBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  smallBadgeText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 11,
  },
  venueActions: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickupText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  promoWrap: {
    marginTop: 18,
  },
  promo: {
    minHeight: 72,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.panelGlass,
  },
  promoIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.06)',
  },
  promoCopy: {
    flex: 1,
  },
  promoTitle: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 14,
  },
  promoSub: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
});
