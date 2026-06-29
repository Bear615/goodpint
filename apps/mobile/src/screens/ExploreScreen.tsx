import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Beer, ChevronRight, LocateFixed, Navigation, Search, X, Zap } from 'lucide-react-native';
import { filters } from '../data/goodpint';
import { colors, font, radii } from '../theme';
import type { FilterKey, OsmPub, RatingMap } from '../types';
import { NativeMap, type NativeMapRef } from '../components/NativeMap';
import { PressableScale } from '../components/Motion';
import { RatingStars } from '../components/RatingStars';
import { PubDetailModal } from '../components/PubDetailModal';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ExploreScreenProps {
  selectedFilter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
  onOpenRedeem: () => void;
  locationStatus: 'pending' | 'granted' | 'denied';
  userCoords: { lat: number; lon: number } | null;
  osmPubs: OsmPub[];
  pubsLoading: boolean;
  pubsError: boolean;
  ratings: RatingMap;
  userRatings: Record<string, number>;
  onSubmitReview: (pubId: string, rating: number, pubName: string, note?: string) => void;
  onOpenBuy: (venueId: string, pubName: string) => void;
}

export function ExploreScreen({
  selectedFilter,
  onFilterChange,
  onOpenRedeem,
  locationStatus,
  userCoords,
  osmPubs,
  pubsLoading,
  pubsError,
  ratings,
  userRatings,
  onSubmitReview,
  onOpenBuy,
}: ExploreScreenProps) {
  const [query, setQuery] = useState('');
  const [selectedPub, setSelectedPub] = useState<OsmPub | null>(null);
  const nativeMapRef = useRef<NativeMapRef>(null);

  const recenter = () => {
    if (userCoords) {
      nativeMapRef.current?.recenter(userCoords.lat, userCoords.lon);
    }
  };

  const visiblePubs = useMemo(() => {
    const text = query.trim().toLowerCase();
    const filtered = osmPubs.filter((pub) => {
      if (text && !pub.name.toLowerCase().includes(text)) return false;
      if (selectedFilter === 'nearby') return pub.distanceMiles <= 1.5;
      return true;
    });

    if (selectedFilter === 'top-rated') {
      return [...filtered].sort((a, b) => (ratings[b.id]?.average ?? 0) - (ratings[a.id]?.average ?? 0));
    }
    return filtered;
  }, [osmPubs, query, selectedFilter, ratings]);

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
          <Beer color={colors.gold} size={22} strokeWidth={1.9} />
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
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X color={colors.textMuted} size={18} />
          </Pressable>
        ) : null}
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

      {/* Real OSM map */}
      <View style={styles.mapWrap}>
        <NativeMap
          ref={nativeMapRef}
          userCoords={userCoords}
          pubs={osmPubs}
          onPubPress={setSelectedPub}
          style={styles.webView}
        />

        {locationStatus === 'denied' && (
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayText}>Location access needed to find pubs nearby</Text>
          </View>
        )}

        <PressableScale accessibilityLabel="Re-centre map" onPress={recenter} style={styles.compass}>
          <LocateFixed color={colors.text} size={22} strokeWidth={1.7} />
        </PressableScale>
      </View>

      <View style={styles.nearbySection}>
        <View style={styles.nearbyHeadingRow}>
          <Text style={styles.nearbyHeading}>
            {selectedFilter === 'top-rated' ? 'Top Rated Bars'
              : selectedFilter === 'happy-hour' ? 'Happy Hour Bars'
              : selectedFilter === 'live-music' ? 'Live Music Bars'
              : 'Nearby Bars'}
          </Text>
          {!pubsLoading && !pubsError && visiblePubs.length > 0 ? (
            <Text style={styles.nearbyCount}>{visiblePubs.length}</Text>
          ) : null}
        </View>
        {pubsLoading ? (
          <View style={styles.nearbyState}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.nearbyStateText}>Finding bars near you…</Text>
          </View>
        ) : pubsError ? (
          <View style={styles.nearbyState}>
            <Beer color={colors.textMuted} size={22} strokeWidth={1.6} />
            <Text style={styles.nearbyStateText}>Couldn't load bars — check connection</Text>
          </View>
        ) : locationStatus === 'granted' && visiblePubs.length === 0 ? (
          <View style={styles.nearbyState}>
            <Beer color={colors.textMuted} size={22} strokeWidth={1.6} />
            <Text style={styles.nearbyStateText}>No bars found nearby</Text>
          </View>
        ) : visiblePubs.length > 0 ? (
          <View style={styles.pubList}>
            {visiblePubs.slice(0, 10).map((pub) => {
              const rating = ratings[pub.id];
              const distText =
                pub.distanceMiles < 0.1
                  ? `${Math.round(pub.distanceMiles * 1760)} yds`
                  : `${pub.distanceMiles.toFixed(1)} mi`;
              return (
                <PressableScale
                  key={pub.id}
                  onPress={() => setSelectedPub(pub)}
                  accessibilityLabel={pub.name}
                  pressedScale={0.98}
                >
                  <View style={styles.pubCard}>
                    <View style={styles.pubIconWrap}>
                      <Beer color={colors.gold} size={20} strokeWidth={2.2} />
                    </View>
                    <View style={styles.pubText}>
                      <Text style={styles.pubName} numberOfLines={1}>{pub.name}</Text>
                      <View style={styles.pubMetaRow}>
                        <RatingStars
                          average={rating?.average ?? 0}
                          count={rating?.count ?? 0}
                          size={13}
                        />
                        <Text style={styles.metaDot}>·</Text>
                        <Navigation color={colors.gold} size={11} strokeWidth={2} />
                        <Text style={styles.pubDist}>{distText}</Text>
                      </View>
                      {pub.address ? (
                        <Text style={styles.pubAddr} numberOfLines={1}>{pub.address}</Text>
                      ) : null}
                    </View>
                    <ChevronRight color={colors.textMuted} size={18} />
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : null}
      </View>

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

      <PubDetailModal
        pub={selectedPub}
        rating={selectedPub ? ratings[selectedPub.id] : undefined}
        userRating={selectedPub ? userRatings[selectedPub.id] : undefined}
        onSubmitReview={onSubmitReview}
        onClose={() => setSelectedPub(null)}
        onOpenBuy={onOpenBuy}
      />
    </View>
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
  brandGold: { color: colors.gold },
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
  filterPillActive: { backgroundColor: 'transparent' },
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
    marginTop: 12,
    height: 292,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
    overflow: 'hidden',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#050607',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,6,7,0.75)',
    padding: 24,
  },
  mapOverlayText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: 'center',
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
  nearbySection: { marginTop: 22 },
  nearbyHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  nearbyHeading: {
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  nearbyCount: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: colors.goldSoft,
  },
  nearbyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 4,
  },
  nearbyStateText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  pubList: { gap: 8 },
  pubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelGlass,
  },
  pubIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  pubText: { flex: 1, gap: 4 },
  pubName: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  pubMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaDot: {
    color: colors.textSubtle,
    fontSize: 13,
  },
  pubAddr: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  pubDist: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 12,
  },
  promoWrap: { marginTop: 18 },
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
  promoCopy: { flex: 1 },
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
