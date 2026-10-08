import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Beer,
  ChevronRight,
  Clock,
  LocateFixed,
  MapPin,
  MapPinOff,
  Music,
  Navigation,
  RefreshCw,
  Search,
  Star,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { filters } from '../data/goodpint';
import { colors, font, formatPoints, radii } from '../theme';
import type { FilterKey, OsmPub, RatingMap } from '../types';
import { NativeMap, type NativeMapRef } from '../components/NativeMap';
import { PressableScale } from '../components/Motion';
import { RatingStars } from '../components/RatingStars';
import { useAuth } from '../context/AuthContext';
import { PubDetailModal } from '../components/PubDetailModal';

const filterIcons: Record<FilterKey, LucideIcon> = {
  nearby: MapPin,
  'top-rated': Star,
  'happy-hour': Clock,
  'live-music': Music,
};

function greeting(name?: string) {
  const hour = new Date().getHours();
  const part = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Good ${part}, ${first}` : `Good ${part}`;
}

const sectionTitles: Record<FilterKey, string> = {
  nearby: 'Nearby bars',
  'top-rated': 'Top rated',
  'happy-hour': 'Happy hour',
  'live-music': 'Live music',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ExploreScreenProps {
  selectedFilter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
  // The points chip and promo go to the Points tab; nothing is spent from here.
  onOpenRewards: () => void;
  locationStatus: 'pending' | 'granted' | 'denied';
  userCoords: { lat: number; lon: number } | null;
  osmPubs: OsmPub[];
  pubsLoading: boolean;
  pubsError: boolean;
  onRetryPubs: () => void;
  points: number;
  ratings: RatingMap;
  userRatings: Record<string, number>;
  onSubmitReview: (pubId: string, rating: number, pubName: string, note?: string) => void;
  onOpenBuy: (venueId: string, pubName: string) => void;
}

export function ExploreScreen({
  selectedFilter,
  onFilterChange,
  onOpenRewards,
  locationStatus,
  userCoords,
  osmPubs,
  pubsLoading,
  pubsError,
  onRetryPubs,
  points,
  ratings,
  userRatings,
  onSubmitReview,
  onOpenBuy,
}: ExploreScreenProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [selectedPub, setSelectedPub] = useState<OsmPub | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const nativeMapRef = useRef<NativeMapRef>(null);

  // The map loads Leaflet and tiles over the network; if it hasn't announced
  // itself after a while, say so rather than spinning forever.
  useEffect(() => {
    if (mapReady) return;
    const timer = setTimeout(() => setMapFailed(true), 12_000);
    return () => clearTimeout(timer);
  }, [mapReady]);

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

  const showCount = !pubsLoading && !pubsError && visiblePubs.length > 0;

  let listContent: ReactNode = null;
  if (locationStatus === 'denied') {
    listContent = (
      <EmptyState
        icon={MapPinOff}
        title="Location is off"
        body="Turn on location access to see bars around you."
      />
    );
  } else if (pubsLoading || (locationStatus === 'pending' && !pubsError)) {
    listContent = (
      <View style={styles.pubList}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.pubCard, styles.skeletonCard]}>
            <View style={[styles.pubIconWrap, styles.skeletonBlock]} />
            <View style={styles.pubText}>
              <View style={[styles.skeletonLine, { width: '58%' }]} />
              <View style={[styles.skeletonLine, styles.skeletonLineThin, { width: '38%' }]} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (pubsError) {
    listContent = (
      <EmptyState
        icon={WifiOff}
        title="Couldn't load bars"
        body="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetryPubs}
      />
    );
  } else if (visiblePubs.length === 0) {
    listContent = (
      <EmptyState
        icon={Beer}
        title={query.trim() ? 'No matches' : 'No bars found nearby'}
        body={query.trim() ? `Nothing matches “${query.trim()}”.` : 'Try another filter or widen your search.'}
      />
    );
  } else {
    listContent = (
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
                  <Beer color={colors.gold} size={24} strokeWidth={2} />
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
                <ChevronRight color={colors.textSubtle} size={18} />
              </View>
            </PressableScale>
          );
        })}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.brandRow}>
        <View style={styles.logoLockup}>
          <LinearGradient
            colors={[colors.goldBright, colors.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Beer color="#141006" size={20} strokeWidth={2.4} />
          </LinearGradient>
          <View>
            <Text style={styles.brand}>
              Good<Text style={styles.brandGold}>Pint</Text>
            </Text>
            <Text style={styles.brandMeta}>{greeting(user?.name)}</Text>
          </View>
        </View>
        <PressableScale
          accessibilityLabel={`${formatPoints(points)} points. Open rewards`}
          onPress={onOpenRewards}
          pressedScale={0.95}
        >
          <View style={styles.pointsChip}>
            <Zap color={colors.gold} size={18} fill={colors.gold} />
            <Text style={styles.pointsChipText}>{formatPoints(points)}</Text>
          </View>
        </PressableScale>
      </View>

      <View style={[styles.searchRow, searchFocused && styles.searchRowFocused]}>
        <Search color={searchFocused ? colors.gold : colors.textSubtle} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search bars and venues"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          selectionColor={colors.gold}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search" style={styles.clearButton}>
            <X color={colors.text} size={13} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {filters.map((filter) => {
          const active = selectedFilter === filter.id;
          const Icon = filterIcons[filter.id];
          return (
            <PressableScale
              key={filter.id}
              accessibilityLabel={filter.label}
              onPress={() => onFilterChange(filter.id)}
              pressedScale={0.95}
            >
              <View style={[styles.filterPill, active && styles.filterPillActive]}>
                <Icon color={active ? '#141006' : colors.textMuted} size={14} strokeWidth={2.2} />
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Real OSM map */}
      <View style={styles.mapWrap}>
        <NativeMap
          ref={nativeMapRef}
          userCoords={userCoords}
          pubs={osmPubs}
          onPubPress={setSelectedPub}
          onMapReady={() => setMapReady(true)}
          style={styles.webView}
        />

        {!mapReady && locationStatus !== 'denied' ? (
          <View style={styles.mapPlaceholder} pointerEvents="none">
            <View style={styles.mapPlaceholderIcon}>
              <MapPin color={mapFailed ? colors.textMuted : colors.gold} size={26} strokeWidth={1.8} />
            </View>
            <Text style={styles.mapPlaceholderText}>
              {mapFailed ? 'Map unavailable right now'
                : locationStatus === 'pending' ? 'Finding your location…'
                : 'Loading map…'}
            </Text>
          </View>
        ) : null}

        {locationStatus === 'denied' && (
          <View style={styles.mapOverlay}>
            <View style={styles.mapPlaceholderIcon}>
              <MapPinOff color={colors.textMuted} size={26} strokeWidth={1.8} />
            </View>
            <Text style={styles.mapOverlayText}>Location access needed to find pubs nearby</Text>
          </View>
        )}

        {userCoords ? (
          <PressableScale accessibilityLabel="Re-centre map" onPress={recenter} style={styles.compass}>
            <LocateFixed color={colors.text} size={20} strokeWidth={1.9} />
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.nearbySection}>
        <View style={styles.nearbyHeadingRow}>
          <Text style={styles.nearbyHeading}>{sectionTitles[selectedFilter]}</Text>
          {showCount ? (
            <View style={styles.nearbyCount}>
              <Text style={styles.nearbyCountText}>{visiblePubs.length}</Text>
            </View>
          ) : null}
        </View>
        {listContent}
      </View>

      <PressableScale accessibilityLabel="Open rewards" onPress={onOpenRewards} style={styles.promoWrap} pressedScale={0.98}>
        <LinearGradient
          colors={['rgba(244,200,74,0.16)', 'rgba(244,200,74,0.04)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promo}
        >
          <View style={styles.promoIcon}>
            <Zap color={colors.gold} size={26} fill={colors.gold} />
          </View>
          <View style={styles.promoCopy}>
            <Text style={styles.promoTitle}>Points & rewards</Text>
            <Text style={styles.promoSub}>
              You have <Text style={styles.promoPoints}>{formatPoints(points)} pts</Text> to spend
            </Text>
          </View>
          <View style={styles.promoChevron}>
            <ChevronRight color={colors.gold} size={18} strokeWidth={2.2} />
          </View>
        </LinearGradient>
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

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({ icon: Icon, title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Icon color={colors.textMuted} size={24} strokeWidth={1.8} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
      </View>
      {actionLabel && onAction ? (
        <PressableScale accessibilityLabel={actionLabel} onPress={onAction} pressedScale={0.95}>
          <View style={styles.emptyAction}>
            <RefreshCw color={colors.gold} size={14} strokeWidth={2.2} />
            <Text style={styles.emptyActionText}>{actionLabel}</Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logoLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 24,
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  brandGold: { color: colors.gold },
  brandMeta: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  pointsChip: {
    height: 36,
    paddingLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsChipText: {
    color: colors.gold,
    fontFamily: font.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  searchRow: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: colors.panelRaised,
  },
  searchRowFocused: {
    borderColor: 'rgba(244,200,74,0.4)',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  filterScroll: {
    marginTop: 12,
    marginHorizontal: -22,
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: 22,
    gap: 8,
  },
  filterPill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  filterPillActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  filterText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  filterTextActive: {
    color: '#141006',
    fontFamily: font.semibold,
  },
  mapWrap: {
    marginTop: 16,
    height: 260,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.panel,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.panel,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.panel,
  },
  mapPlaceholderIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    color: colors.textSubtle,
    fontFamily: font.medium,
    fontSize: 13,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(15,16,18,0.92)',
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
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(22,23,25,0.92)',
  },
  nearbySection: { marginTop: 26 },
  nearbyHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  nearbyHeading: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  nearbyCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  nearbyCountText: {
    color: colors.gold,
    fontFamily: font.semibold,
    fontSize: 12,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyAction: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.28)',
    backgroundColor: colors.goldSoft,
  },
  emptyActionText: {
    color: colors.gold,
    fontFamily: font.semibold,
    fontSize: 13,
  },
  pubList: { gap: 8 },
  pubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  skeletonCard: { height: 66 },
  skeletonBlock: { borderRadius: radii.sm, backgroundColor: colors.panelSoft },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.panelSoft,
  },
  skeletonLineThin: { height: 10, marginTop: 4 },
  pubIconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pubText: { flex: 1, gap: 4 },
  pubName: {
    color: colors.text,
    fontFamily: font.semibold,
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
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  pubDist: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 12,
  },
  promoWrap: { marginTop: 20 },
  promo: {
    minHeight: 76,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(244,200,74,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  promoIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoCopy: { flex: 1 },
  promoTitle: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  promoSub: {
    marginTop: 3,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  promoPoints: {
    color: colors.gold,
    fontFamily: font.semibold,
  },
  promoChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
});
