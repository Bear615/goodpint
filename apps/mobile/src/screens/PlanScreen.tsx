import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  CalendarDays,
  Clock3,
  MapPinned,
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
  onAddStop: () => void;
  onOpenBuy: (venueId: string, pubName: string) => void;
}

const MAX_AVATARS = 4;

function splitStopTime(time: string) {
  const [dateLabel = '', clockLabel = time] = time.split(' - ');
  return { dateLabel: dateLabel.replace('Fri, ', ''), clockLabel };
}

function venueForStop(stop: TripStop, venues: Venue[]) {
  return venues.find((candidate) => candidate.id === stop.venueId);
}

function routeHeading(dates: string | undefined): string {
  if (!dates) return 'Your Route';
  const start = dates.split(' - ')[0] ?? '';
  if (start.toLowerCase().includes('sat')) return 'Saturday Route';
  if (start.toLowerCase().includes('sun')) return 'Sunday Route';
  if (start.toLowerCase().includes('fri')) return 'Friday Route';
  if (start.toLowerCase().includes('thu')) return 'Thursday Route';
  if (start.toLowerCase().includes('wed')) return 'Wednesday Route';
  if (start.toLowerCase().includes('tue')) return 'Tuesday Route';
  if (start.toLowerCase().includes('mon')) return 'Monday Route';
  return 'Your Route';
}

type PlanTab = 'itinerary' | 'group' | 'notes';

export function PlanScreen({ trips, venues, onInviteFriends, onAddStop, onOpenBuy }: PlanScreenProps) {
  const [activeTab, setActiveTab] = useState<PlanTab>('itinerary');
  const trip = trips[0];
  const stops = trip?.stops ?? [];
  const firstVenue = stops[0] ? venueForStop(stops[0], venues) : undefined;
  const firstTime = stops[0] ? splitStopTime(stops[0].time).clockLabel : 'Pick time';
  const routeAreas = stops
    .map((stop) => venueForStop(stop, venues)?.area)
    .filter(Boolean)
    .join(' / ');
  const guestCount = trip?.guests ?? 0;
  const avatarCount = Math.min(guestCount, MAX_AVATARS);
  const avatarSlots = Array.from({ length: avatarCount }, (_, index) => index);

  if (!trip) {
    return (
      <View>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Plan</Text>
            <Text style={styles.title}>Weekend Plan</Text>
          </View>
          <PressableScale accessibilityLabel="Invite group" onPress={onInviteFriends} style={styles.headerButton}>
            <UsersRound color={colors.gold} size={22} strokeWidth={2} />
          </PressableScale>
        </View>

        <SectionCard style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <MapPinned color={colors.gold} size={26} strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptyHint}>Plan your first GoodPint night out and invite your group.</Text>
          <View style={styles.emptyCommandRow}>
            <PressableScale accessibilityLabel="Add stop" style={styles.addStop} pressedScale={0.975} onPress={onAddStop}>
              <Plus color={colors.gold} size={21} strokeWidth={2.2} />
              <Text style={styles.addStopText}>Add Stop</Text>
            </PressableScale>
            <GoldButton label="Invite" compact onPress={onInviteFriends} style={styles.inviteButton} />
          </View>
        </SectionCard>
      </View>
    );
  }

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
        {(['itinerary', 'group', 'notes'] as PlanTab[]).map((tab) => (
          <PressableScale
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </PressableScale>
        ))}
      </View>

      {activeTab === 'itinerary' && (
        <>
          <View style={styles.peopleRow}>
            {avatarSlots.length > 0 ? (
              <View style={styles.avatarStack}>
                {avatarSlots.map((slot, index) => (
                  <View key={slot} style={[styles.avatar, { marginLeft: index === 0 ? 0 : -8 }]}>
                    <UsersRound color={colors.textMuted} size={14} strokeWidth={2} />
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.peopleText} numberOfLines={1}>
              {routeAreas || 'Choose stops'}
            </Text>
          </View>

          <View style={styles.commandRow}>
            <PressableScale accessibilityLabel="Add stop" style={styles.addStop} pressedScale={0.975} onPress={onAddStop}>
              <Plus color={colors.gold} size={21} strokeWidth={2.2} />
              <Text style={styles.addStopText}>Add Stop</Text>
            </PressableScale>
            <GoldButton label="Invite" compact onPress={onInviteFriends} style={styles.inviteButton} />
            <PressableScale accessibilityLabel="Share trip" onPress={onInviteFriends} style={styles.shareButton}>
              <Share2 color={colors.gold} size={20} strokeWidth={2} />
            </PressableScale>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{routeHeading(trip?.dates)}</Text>
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

                  <PressableScale
                    style={styles.stopShellWrap}
                    onPress={() => venue && onOpenBuy(venue.id, venue.name)}
                    pressedScale={0.98}
                  >
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
                            {venue?.area ?? 'Area'} · {venue?.distanceMiles.toFixed(1) ?? '-'} mi
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
                      </View>
                    </SectionCard>
                  </PressableScale>
                </View>
              );
            })}
          </View>
        </>
      )}

      {activeTab === 'group' && (
        <View style={styles.groupTab}>
          <Text style={styles.groupHeading}>{guestCount} people going</Text>
          {guestCount > 0 ? (
            <View style={styles.guestList}>
              {Array.from({ length: guestCount }, (_, index) => (
                <View key={index} style={styles.guestRow}>
                  <View style={styles.guestAvatar}>
                    <UsersRound color={colors.textMuted} size={18} strokeWidth={2} />
                  </View>
                  <Text style={styles.guestName}>Guest {index + 1}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.groupEmpty}>No one has joined yet — invite your friends to get started.</Text>
          )}
          <GoldButton label="Invite Friends" onPress={onInviteFriends} style={styles.groupInvite} />
        </View>
      )}

      {activeTab === 'notes' && (
        <View style={styles.notesTab}>
          <Text style={styles.notesEmpty}>No notes yet.</Text>
          <Text style={styles.notesHint}>Notes for your group will appear here.</Text>
        </View>
      )}
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
  eyebrow: { color: colors.gold, fontFamily: font.medium, fontSize: 13 },
  title: { marginTop: 3, color: colors.text, fontFamily: font.medium, fontSize: 25 },
  headerButton: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  overview: { padding: 16 },
  overviewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  overviewCopy: { flex: 1 },
  overviewMeta: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13 },
  overviewTitle: { marginTop: 6, color: colors.text, fontFamily: font.medium, fontSize: 22 },
  routeBadge: {
    height: 32, paddingHorizontal: 10, borderRadius: 16,
    borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.06)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  routeBadgeText: { color: colors.gold, fontFamily: font.medium, fontSize: 12 },
  routeLine: {
    marginTop: 22, height: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    position: 'relative',
  },
  routeTrack: { position: 'absolute', left: 6, right: 6, height: 1, backgroundColor: colors.border },
  routeNode: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelRaised,
  },
  routeNodeActive: { width: 12, height: 12, borderRadius: 6, borderColor: colors.gold, backgroundColor: colors.gold },
  statRow: { marginTop: 20, flexDirection: 'row', gap: 8 },
  statCell: {
    flex: 1, minHeight: 72, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
    paddingHorizontal: 10, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'space-between',
  },
  statValue: { color: colors.text, fontFamily: font.medium, fontSize: 13, textAlign: 'center' },
  statLabel: { color: colors.textSubtle, fontFamily: font.regular, fontSize: 11, textAlign: 'center' },
  tabRow: {
    marginTop: 16, height: 48, flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabText: { color: colors.textMuted, fontFamily: font.regular, fontSize: 14 },
  activeTabText: { color: colors.gold, fontFamily: font.medium, fontSize: 14 },
  peopleRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.panelGlass,
    borderWidth: 1, borderColor: colors.border,
  },
  peopleText: { flex: 1, color: colors.textMuted, fontFamily: font.regular, fontSize: 13 },
  commandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addStop: {
    flex: 1, height: 44, borderRadius: radii.sm,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(244,200,74,0.035)',
  },
  addStopText: { color: colors.text, fontFamily: font.medium, fontSize: 13 },
  inviteButton: { width: 92 },
  shareButton: {
    width: 44, height: 44, borderRadius: radii.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelGlass,
  },
  sectionHeader: {
    marginTop: 24, marginBottom: 12,
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.text, fontFamily: font.medium, fontSize: 18 },
  sectionMeta: { color: colors.textSubtle, fontFamily: font.regular, fontSize: 12 },
  timeline: { gap: 12 },
  stopRow: { flexDirection: 'row', gap: 12 },
  timeColumn: { width: 66, position: 'relative', paddingTop: 10, alignItems: 'flex-start' },
  stopClock: { color: colors.textMuted, fontFamily: font.medium, fontSize: 13 },
  stopClockActive: { color: colors.gold },
  stopDate: { marginTop: 5, color: colors.textSubtle, fontFamily: font.regular, fontSize: 11 },
  timeRail: {
    position: 'absolute', top: 48, bottom: -20, left: 6,
    width: 1, backgroundColor: colors.border,
  },
  stopShellWrap: { flex: 1 },
  stopShell: { flex: 1 },
  stopShellActive: { borderColor: colors.borderStrong },
  stopCard: { minHeight: 88, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  stopImage: { width: 64, height: 64, borderRadius: radii.xs, backgroundColor: colors.panelRaised },
  stopCopy: { flex: 1, minWidth: 0 },
  stopTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopTitle: { flex: 1, color: colors.text, fontFamily: font.medium, fontSize: 15 },
  statusBadge: { height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.045)' },
  statusBadgeActive: { backgroundColor: colors.goldSoft },
  statusText: { color: colors.textMuted, fontFamily: font.medium, fontSize: 10, lineHeight: 22 },
  statusTextActive: { color: colors.gold },
  stopMeta: { marginTop: 7, color: colors.textMuted, fontFamily: font.regular, fontSize: 12 },
  stopDetailRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { flexShrink: 1, color: colors.textSubtle, fontFamily: font.regular, fontSize: 11 },
  ratingText: { color: colors.gold, fontFamily: font.medium, fontSize: 11 },
  // empty state
  emptyCard: { padding: 24, alignItems: 'center', gap: 10 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: 'rgba(244,200,74,0.06)',
    marginBottom: 4,
  },
  emptyTitle: { color: colors.text, fontFamily: font.medium, fontSize: 18 },
  emptyHint: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13, textAlign: 'center' },
  emptyCommandRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  // group tab
  groupTab: { paddingTop: 20, gap: 16 },
  groupHeading: { color: colors.text, fontFamily: font.medium, fontSize: 16 },
  groupEmpty: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13 },
  guestList: { gap: 12 },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  guestAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.panelGlass, borderWidth: 1, borderColor: colors.border,
  },
  guestName: { color: colors.textMuted, fontFamily: font.regular, fontSize: 14 },
  groupInvite: { marginTop: 8 },
  // notes tab
  notesTab: { paddingTop: 48, alignItems: 'center', gap: 8 },
  notesEmpty: { color: colors.text, fontFamily: font.medium, fontSize: 16 },
  notesHint: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13 },
});
