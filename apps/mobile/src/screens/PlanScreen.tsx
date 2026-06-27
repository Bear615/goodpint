import { Image, StyleSheet, Text, View } from 'react-native';
import {
  CalendarDays,
  Clock3,
  MapPinned,
  Menu,
  Navigation,
  Plus,
  Share2,
  Star,
  UsersRound,
} from 'lucide-react-native';
import { colors, font, radii } from '../theme';
import type { Trip, TripStop, Venue } from '../types';
import { GoldButton } from '../components/GoldButton';
import { PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';

interface PlanScreenProps {
  trips: Trip[];
  venues: Venue[];
  onInviteFriends: () => void;
}

const guestInitials = ['MA', 'JB', 'RK', 'ST'];

function splitStopTime(time: string) {
  const [dateLabel = '', clockLabel = time] = time.split(' - ');

  return {
    dateLabel: dateLabel.replace('Fri, ', ''),
    clockLabel,
  };
}

function venueForStop(stop: TripStop, venues: Venue[]) {
  return venues.find((candidate) => candidate.id === stop.venueId);
}

export function PlanScreen({ trips, venues, onInviteFriends }: PlanScreenProps) {
  const trip = trips[0];
  const stops = trip?.stops ?? [];
  const firstVenue = stops[0] ? venueForStop(stops[0], venues) : undefined;
  const firstTime = stops[0] ? splitStopTime(stops[0].time).clockLabel : 'Pick time';
  const routeAreas = stops
    .map((stop) => venueForStop(stop, venues)?.area)
    .filter(Boolean)
    .join(' / ');

  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Plan</Text>
          <Text style={styles.title}>{trip?.title ?? 'Weekend Plan'}</Text>
        </View>
        <PressableScale accessibilityLabel="Invite group" onPress={onInviteFriends} style={styles.headerButton}>
          <UsersRound color={colors.gold} size={22} strokeWidth={2} />
        </PressableScale>
      </View>

      <SectionCard style={styles.overview}>
        <View style={styles.overviewTop}>
          <View style={styles.overviewCopy}>
            <Text style={styles.overviewMeta}>{trip?.dates ?? 'Pick dates'}</Text>
            <Text style={styles.overviewTitle} numberOfLines={1}>
              {firstVenue?.area ?? 'Build your route'}
            </Text>
          </View>
          <View style={styles.routeBadge}>
            <Navigation color={colors.gold} size={16} strokeWidth={2.2} />
            <Text style={styles.routeBadgeText}>{stops.length} stops</Text>
          </View>
        </View>

        <View style={styles.routeLine}>
          <View style={styles.routeTrack} />
          {stops.map((stop, index) => {
            const active = index === 0;
            return <View key={stop.id} style={[styles.routeNode, active && styles.routeNodeActive]} />;
          })}
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <CalendarDays color={colors.textMuted} size={17} strokeWidth={2} />
            <Text style={styles.statValue}>{trip?.dates?.split(' - ')[0] ?? 'Today'}</Text>
            <Text style={styles.statLabel}>Start</Text>
          </View>
          <View style={styles.statCell}>
            <Clock3 color={colors.textMuted} size={17} strokeWidth={2} />
            <Text style={styles.statValue}>{firstTime}</Text>
            <Text style={styles.statLabel}>Meet</Text>
          </View>
          <View style={styles.statCell}>
            <UsersRound color={colors.textMuted} size={17} strokeWidth={2} />
            <Text style={styles.statValue}>{trip?.guests ?? 0}</Text>
            <Text style={styles.statLabel}>Going</Text>
          </View>
        </View>
      </SectionCard>

      <View style={styles.tabRow}>
        <View style={styles.activeTab}>
          <Text style={styles.activeTabText}>Itinerary</Text>
        </View>
        <View style={styles.tab}>
          <Text style={styles.tabText}>Group</Text>
        </View>
        <View style={styles.tab}>
          <Text style={styles.tabText}>Notes</Text>
        </View>
      </View>

      <View style={styles.peopleRow}>
        <View style={styles.avatarStack}>
          {guestInitials.map((initials, index) => (
            <View key={initials} style={[styles.avatar, { marginLeft: index === 0 ? 0 : -8 }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.peopleText} numberOfLines={1}>
          {routeAreas || 'Choose stops'}
        </Text>
      </View>

      <View style={styles.commandRow}>
        <PressableScale accessibilityLabel="Add stop" style={styles.addStop} pressedScale={0.975}>
          <Plus color={colors.gold} size={21} strokeWidth={2.2} />
          <Text style={styles.addStopText}>Add Stop</Text>
        </PressableScale>
        <GoldButton label="Invite" compact onPress={onInviteFriends} style={styles.inviteButton} />
        <PressableScale accessibilityLabel="Share trip" onPress={onInviteFriends} style={styles.shareButton}>
          <Share2 color={colors.gold} size={20} strokeWidth={2} />
        </PressableScale>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Friday Route</Text>
        <Text style={styles.sectionMeta}>{stops.length} planned</Text>
      </View>

      <View style={styles.timeline}>
        {stops.map((stop, index) => {
          const venue = venueForStop(stop, venues);
          const { dateLabel, clockLabel } = splitStopTime(stop.time);
          const active = index === 0;

          return (
            <View key={stop.id} style={styles.stopRow}>
              <View style={styles.timeColumn}>
                <Text style={[styles.stopClock, active && styles.stopClockActive]}>{clockLabel}</Text>
                <Text style={styles.stopDate}>{dateLabel}</Text>
                {index < stops.length - 1 ? <View style={styles.timeRail} /> : null}
              </View>

              <SectionCard style={[styles.stopShell, active && styles.stopShellActive]}>
                <View style={styles.stopCard}>
                  <Image source={{ uri: venue?.imageUrl }} style={styles.stopImage} />
                  <View style={styles.stopCopy}>
                    <View style={styles.stopTitleRow}>
                      <Text style={styles.stopTitle} numberOfLines={1}>
                        {venue?.name ?? 'Venue'}
                      </Text>
                      <View style={[styles.statusBadge, active && styles.statusBadgeActive]}>
                        <Text style={[styles.statusText, active && styles.statusTextActive]}>
                          {active ? 'Upcoming' : 'Planned'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.stopMeta} numberOfLines={1}>
                      {venue?.area ?? 'Area'} - Distance {venue?.distanceMiles.toFixed(1) ?? '-'} mi
                    </Text>
                    <View style={styles.stopDetailRow}>
                      <MapPinned color={colors.textMuted} size={14} strokeWidth={2} />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {venue?.tags[0] ?? 'GoodPint'}
                      </Text>
                      <Star color={colors.gold} fill={colors.gold} size={14} strokeWidth={2} />
                      <Text style={styles.ratingText}>{venue?.rating.toFixed(1) ?? '-'}</Text>
                    </View>
                  </View>
                  <Menu color={colors.textMuted} size={21} strokeWidth={1.9} />
                </View>
              </SectionCard>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 13,
  },
  title: {
    marginTop: 3,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 25,
  },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  overview: {
    padding: 16,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  overviewCopy: {
    flex: 1,
  },
  overviewMeta: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  overviewTitle: {
    marginTop: 6,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 22,
  },
  routeBadge: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeBadgeText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 12,
  },
  routeLine: {
    marginTop: 22,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  routeTrack: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 1,
    backgroundColor: colors.border,
  },
  routeNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  routeNodeActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  statRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  statCell: {
    flex: 1,
    minHeight: 72,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  statLabel: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  tabRow: {
    marginTop: 16,
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 14,
  },
  tabText: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  peopleRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelGlass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 10,
  },
  peopleText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 13,
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addStop: {
    flex: 1,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(244,200,74,0.035)',
  },
  addStopText: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 13,
  },
  inviteButton: {
    width: 92,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelGlass,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  sectionMeta: {
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 12,
  },
  timeline: {
    gap: 12,
  },
  stopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeColumn: {
    width: 66,
    position: 'relative',
    paddingTop: 10,
    alignItems: 'flex-start',
  },
  stopClock: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  stopClockActive: {
    color: colors.gold,
  },
  stopDate: {
    marginTop: 5,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
  },
  timeRail: {
    position: 'absolute',
    top: 48,
    bottom: -20,
    left: 6,
    width: 1,
    backgroundColor: colors.border,
  },
  stopShell: {
    flex: 1,
  },
  stopShellActive: {
    borderColor: colors.borderStrong,
  },
  stopCard: {
    minHeight: 88,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  stopImage: {
    width: 64,
    height: 64,
    borderRadius: radii.xs,
    backgroundColor: colors.panelRaised,
  },
  stopCopy: {
    flex: 1,
    minWidth: 0,
  },
  stopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 15,
  },
  statusBadge: {
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  statusBadgeActive: {
    backgroundColor: colors.goldSoft,
  },
  statusText: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 10,
    lineHeight: 22,
  },
  statusTextActive: {
    color: colors.gold,
  },
  stopMeta: {
    marginTop: 7,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  stopDetailRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailText: {
    flexShrink: 1,
    color: colors.textSubtle,
    fontFamily: font.regular,
    fontSize: 11,
  },
  ratingText: {
    color: colors.gold,
    fontFamily: font.medium,
    fontSize: 11,
  },
});
