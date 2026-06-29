import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { Bell, ChevronRight, LogOut, MapPin, ShieldCheck, Star, UserRound } from 'lucide-react-native';
import { colors, font, formatCurrency, formatPoints, radii } from '../theme';
import type { MemberProfile, Venue, WalletState } from '../types';
import { useAuth } from '../context/AuthContext';
import { PressableScale } from '../components/Motion';
import { SectionCard } from '../components/SectionCard';

interface ProfileScreenProps {
  profile: MemberProfile;
  points: number;
  wallet: WalletState;
  favoriteVenue?: Venue;
}

const PLACEHOLDER = '—';

function valueOrPlaceholder(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : PLACEHOLDER;
}

export function ProfileScreen({ profile, points, wallet, favoriteVenue }: ProfileScreenProps) {
  const { signOut } = useAuth();

  const hasAvatar = Boolean(profile.avatarUrl && profile.avatarUrl.trim().length > 0);
  const homeZone = valueOrPlaceholder(favoriteVenue?.area ?? profile.homeArea);

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of GoodPint?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <PressableScale accessibilityLabel="Notifications" style={styles.iconButton} onPress={() => Alert.alert('Notifications', 'No new notifications.')}>
          <Bell color={colors.gold} size={21} />
        </PressableScale>
      </View>

      <SectionCard>
        <View style={styles.profileCard}>
          {hasAvatar ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <UserRound color={colors.textMuted} size={30} />
            </View>
          )}
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{valueOrPlaceholder(profile.name)}</Text>
            <Text style={styles.handle}>{valueOrPlaceholder(profile.handle)}</Text>
            <Text style={styles.joined}>{valueOrPlaceholder(profile.joinedLabel)}</Text>
          </View>
          <ShieldCheck color={colors.gold} size={29} fill={colors.gold} />
        </View>
      </SectionCard>

      <View style={styles.statGrid}>
        <View style={styles.statCell}>
          <Star color={colors.gold} size={22} fill={colors.gold} />
          <Text style={styles.statValue}>{formatPoints(points)}</Text>
          <Text style={styles.statLabel}>Points</Text>
        </View>
        <View style={styles.statCell}>
          <MapPin color={colors.gold} size={22} />
          <Text style={styles.statValue}>{homeZone}</Text>
          <Text style={styles.statLabel}>Home zone</Text>
        </View>
        <View style={styles.statCell}>
          <UserRound color={colors.gold} size={22} />
          <Text style={styles.statValue}>{formatCurrency(wallet.balance)}</Text>
          <Text style={styles.statLabel}>Balance</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Your Regular</Text>
      <SectionCard>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Usual spot</Text>
          <Text style={styles.preferenceValue}>{valueOrPlaceholder(favoriteVenue?.name)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Favourite style</Text>
          <Text style={styles.preferenceValue}>{valueOrPlaceholder(profile.favoriteStyle)}</Text>
        </View>
      </SectionCard>

      <Text style={styles.sectionTitle}>Account</Text>
      <SectionCard>
        {['Saved venues', 'Notification settings', 'Help and support'].map((item) => (
          <View key={item}>
            <PressableScale onPress={() => Alert.alert(item, 'Coming soon.')}>
              <View style={styles.menuRow}>
                <Text style={styles.menuText}>{item}</Text>
                <ChevronRight color={colors.textMuted} size={21} />
              </View>
            </PressableScale>
            <View style={styles.divider} />
          </View>
        ))}
        <PressableScale accessibilityLabel="Sign out" onPress={handleSignOut}>
          <View style={styles.menuRow}>
            <Text style={[styles.menuText, styles.signOutText]}>Sign out</Text>
            <LogOut color={colors.danger} size={20} />
          </View>
        </PressableScale>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 24,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  profileCard: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.panelRaised,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 19,
  },
  handle: {
    marginTop: 5,
    color: colors.gold,
    fontFamily: font.regular,
    fontSize: 13,
  },
  joined: {
    marginTop: 5,
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 12,
  },
  statGrid: {
    marginVertical: 18,
    flexDirection: 'row',
    gap: 10,
  },
  statCell: {
    flex: 1,
    minHeight: 96,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelGlass,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 5,
  },
  statValue: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
    textAlign: 'center',
  },
  statLabel: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 12,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 18,
  },
  preferenceRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  preferenceLabel: {
    color: colors.textMuted,
    fontFamily: font.regular,
    fontSize: 14,
  },
  preferenceValue: {
    flex: 1,
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 14,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  menuRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 15,
  },
  signOutText: {
    color: colors.danger,
  },
});
